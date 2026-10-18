import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
  Save,
  RotateCcw,
  Download,
  Search,
  Plus,
  Trash2,
  Table2,
  Check,
  X,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Lock,
  Unlock,
  Copy,
  ClipboardPaste,
  ExternalLink,
  Upload,
  ArrowRight,
  FileText,
  Info
} from 'lucide-react'
import {
  getVendorWorkbookData,
  saveVendorWorkbookData,
  getVendorSheetDownloadUrl
} from '../api/rates.api'

function getColName(n) {
  let s = ''
  let num = n
  while (num >= 0) {
    s = String.fromCharCode((num % 26) + 65) + s
    num = Math.floor(num / 26) - 1
  }
  return s
}

/**
 * Robust parser for Excel clipboard data (HTML table or TSV plain text).
 */
export function parseExcelClipboardData(clipboardData) {
  // 1. Try HTML table from clipboard (highest fidelity from Excel & Google Sheets)
  const html = clipboardData?.getData ? clipboardData.getData('text/html') : ''
  if (html && html.includes('<table')) {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const table = doc.querySelector('table')
      if (table) {
        const rows = []
        table.querySelectorAll('tr').forEach(tr => {
          const cells = []
          tr.querySelectorAll('td, th').forEach(cell => {
            cells.push(cell.innerText.replace(/\r?\n/g, ' ').trim())
          })
          if (cells.length > 0) rows.push(cells)
        })
        if (rows.length > 0) return rows
      }
    } catch (err) {
      console.warn('HTML table parsing failed, falling back to text/plain:', err)
    }
  }

  // 2. Fallback to text/plain (tab-separated values from Excel)
  const text = typeof clipboardData === 'string'
    ? clipboardData
    : (clipboardData?.getData ? clipboardData.getData('text/plain') : '')

  if (!text || !text.trim()) return []

  const rawLines = text.split(/\r?\n/)
  const rows = []
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    if (i === rawLines.length - 1 && line.trim() === '') continue
    rows.push(line.split('\t').map(c => c.trim()))
  }
  return rows
}

export default function SheetEditorPage() {
  const [searchParams] = useSearchParams()
  const vendorCode = searchParams.get('vendor') || 'pacific'
  const vendorName = searchParams.get('name') || vendorCode.toUpperCase()

  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const pasteModalTextareaRef = useRef(null)

  // ── Query live workbook data ──
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-workbook-data', vendorCode],
    queryFn: () => getVendorWorkbookData(vendorCode),
    enabled: !!vendorCode
  })

  // ── Local Editable Sheets State ──
  const [sheets, setSheets] = useState([])
  const [activeSheetIdx, setActiveSheetIdx] = useState(0)
  const [activeCell, setActiveCell] = useState({ r: 0, c: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100) // 100 rows per page by default
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // ── Paste Table Modal State ──
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pastedRawText, setPastedRawText] = useState('')
  const [parsedPreviewRows, setParsedPreviewRows] = useState([])
  const [pasteMode, setPasteMode] = useState('cell') // 'cell' | 'replace' | 'append'

  // Populate local sheets state when server data is loaded
  useEffect(() => {
    if (data?.sheets) {
      setSheets(JSON.parse(JSON.stringify(data.sheets)))
      setHasUnsavedChanges(false)
      // Auto-select first non-calculator tab if available
      if (data.sheets.length > 1) {
        setActiveSheetIdx(1)
      }
    }
  }, [data])

  // Update page title
  useEffect(() => {
    document.title = `Excel Editor — ${vendorName} | Courier Admin`
  }, [vendorName])

  const activeSheet = sheets[activeSheetIdx] || null
  const sheetName = activeSheet?.name || ''
  const isRateCalculatorTab = sheetName.toLowerCase().includes('rate calculator') || activeSheetIdx === 0

  // Max columns for active sheet
  const totalCols = useMemo(() => {
    if (!activeSheet?.rows) return 10
    let max = 10
    activeSheet.rows.forEach(r => {
      if (Array.isArray(r) && r.length > max) max = r.length
    })
    return Math.max(max, 12)
  }, [activeSheet])

  // Paginated rows
  const totalRows = activeSheet?.rows?.length || 0
  const maxPage = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalRows / pageSize))
  const startRow = pageSize === 0 ? 0 : (page - 1) * pageSize
  const visibleRows = pageSize === 0
    ? (activeSheet?.rows || [])
    : (activeSheet?.rows?.slice(startRow, startRow + pageSize) || [])

  // Get cell value
  const getCellValue = (r, c) => {
    if (!activeSheet?.rows?.[r]) return ''
    const val = activeSheet.rows[r][c]
    if (val === undefined || val === null) return ''
    return String(val)
  }

  // Set cell value (Single edit without double-click)
  const setCellValue = (r, c, value) => {
    if (isRateCalculatorTab) return // Read-only
    setSheets(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      if (!next[activeSheetIdx].rows[r]) {
        next[activeSheetIdx].rows[r] = []
      }
      while (next[activeSheetIdx].rows[r].length <= c) {
        next[activeSheetIdx].rows[r].push('')
      }
      next[activeSheetIdx].rows[r][c] = value
      return next
    })
    setHasUnsavedChanges(true)
  }

  // ── Direct on-cell paste handler (Ctrl+V into any cell) ──
  const handleCellPaste = (e, startR, startC) => {
    if (isRateCalculatorTab) {
      e.preventDefault()
      toast('Rate Calculator tab is read-only. Edit other tabs to modify data.', { icon: '🔒' })
      return
    }

    const rows = parseExcelClipboardData(e.clipboardData)
    // If not a multi-cell table (single cell value without tabs or newlines), allow default input paste
    if (!rows || rows.length === 0 || (rows.length === 1 && rows[0].length <= 1)) {
      return
    }

    e.preventDefault()
    applyPastedMatrix(rows, startR, startC)
    toast.success(`📋 Pasted ${rows.length} rows × ${Math.max(...rows.map(r => r.length))} cols from Excel!`)
  }

  // Apply a 2D matrix of values starting at (startR, startC)
  const applyPastedMatrix = (matrix, startR, startC) => {
    if (isRateCalculatorTab) return
    setSheets(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      const targetRows = next[activeSheetIdx].rows

      matrix.forEach((row, ri) => {
        const targetR = startR + ri
        if (!targetRows[targetR]) {
          targetRows[targetR] = []
        }
        row.forEach((val, ci) => {
          const targetC = startC + ci
          while (targetRows[targetR].length <= targetC) {
            targetRows[targetR].push('')
          }
          targetRows[targetR][targetC] = val
        })
      })

      return next
    })
    setHasUnsavedChanges(true)
  }

  // Handle Paste in Modal
  const handleModalTextareaPaste = (e) => {
    const rows = parseExcelClipboardData(e.clipboardData)
    if (rows && rows.length > 0) {
      setParsedPreviewRows(rows)
    }
  }

  const handleApplyModalPaste = () => {
    if (isRateCalculatorTab) {
      toast.error('Cannot paste into the read-only Rate Calculator tab')
      return
    }

    let rowsToApply = parsedPreviewRows
    if (rowsToApply.length === 0 && pastedRawText.trim()) {
      rowsToApply = parseExcelClipboardData(pastedRawText)
    }

    if (!rowsToApply || rowsToApply.length === 0) {
      toast.error('No table data detected. Copy cells in Excel (Ctrl+C) and paste here.')
      return
    }

    if (pasteMode === 'replace') {
      setSheets(prev => {
        const next = JSON.parse(JSON.stringify(prev))
        next[activeSheetIdx].rows = rowsToApply
        return next
      })
      toast.success(`Replaced sheet with ${rowsToApply.length} rows from Excel!`)
    } else if (pasteMode === 'append') {
      setSheets(prev => {
        const next = JSON.parse(JSON.stringify(prev))
        next[activeSheetIdx].rows.push(...rowsToApply)
        return next
      })
      toast.success(`Appended ${rowsToApply.length} rows to bottom of sheet!`)
    } else {
      // 'cell': paste starting at active cell
      applyPastedMatrix(rowsToApply, activeCell.r, activeCell.c)
      toast.success(`Pasted ${rowsToApply.length} rows starting at row ${activeCell.r + 1}!`)
    }

    setHasUnsavedChanges(true)
    setShowPasteModal(false)
    setPastedRawText('')
    setParsedPreviewRows([])
  }

  // ── Open local .xlsx file directly ──
  const handleOpenLocalXlsx = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const buffer = evt.target.result
        const wb = XLSX.read(buffer, { type: 'array' })
        const newSheets = []
        wb.SheetNames.forEach((sName) => {
          const ws = wb.Sheets[sName]
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
          newSheets.push({
            name: sName,
            rows: data
          })
        })
        if (newSheets.length > 0) {
          setSheets(newSheets)
          setHasUnsavedChanges(true)
          toast.success(`Loaded ${newSheets.length} tabs from ${file.name}. Click Save to apply!`)
        }
      } catch (err) {
        toast.error('Failed to parse Excel file: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Keyboard navigation between cells
  const handleCellKeyDown = (e, r, c) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const nextR = Math.min(r + 1, totalRows - 1)
      setActiveCell({ r: nextR, c })
      focusCellInput(nextR, c)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const nextC = e.shiftKey ? Math.max(0, c - 1) : Math.min(c + 1, totalCols - 1)
      setActiveCell({ r, c: nextC })
      focusCellInput(r, nextC)
    } else if (e.key === 'ArrowDown') {
      if (r < totalRows - 1) {
        e.preventDefault()
        setActiveCell({ r: r + 1, c })
        focusCellInput(r + 1, c)
      }
    } else if (e.key === 'ArrowUp') {
      if (r > 0) {
        e.preventDefault()
        setActiveCell({ r: r - 1, c })
        focusCellInput(r - 1, c)
      }
    }
  }

  const focusCellInput = (r, c) => {
    const el = document.getElementById(`cell-${r}-${c}`)
    if (el) el.focus()
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => saveVendorWorkbookData(vendorCode, sheets, vendorName),
    onSuccess: (data) => {
      toast.success(data.message || 'Excel rate sheet saved successfully!')
      setHasUnsavedChanges(false)
      refetch()
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to save')
    }
  })

  // Add row
  const addRow = () => {
    if (isRateCalculatorTab) return
    setSheets(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      const newRow = Array(totalCols).fill('')
      next[activeSheetIdx].rows.push(newRow)
      return next
    })
    setHasUnsavedChanges(true)
    toast.success('Row added to bottom')
  }

  // Delete row
  const deleteRow = (r) => {
    if (isRateCalculatorTab) return
    setSheets(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next[activeSheetIdx].rows.splice(r, 1)
      return next
    })
    setHasUnsavedChanges(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-red-600 animate-spin mx-auto" />
          <p className="text-sm font-bold text-gray-700">Loading live workbook for {vendorName}...</p>
        </div>
      </div>
    )
  }

  if (isError || !data?.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="text-center space-y-3 max-w-md mx-auto p-8 bg-white rounded-2xl border border-red-200 shadow-lg">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-gray-900">Rate Sheet Not Found</h2>
          <p className="text-sm text-gray-600">
            No Excel rate sheet found for vendor <strong>{vendorName}</strong>.
            Import a rate sheet on the Rates page first.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Toaster position="top-right" />

      {/* Hidden file input for opening .xlsx directly */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleOpenLocalXlsx}
      />

      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              {vendorName} — Excel Sheet Editor
              {hasUnsavedChanges && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  Unsaved Changes
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <span>Active Tab: <strong className="text-gray-800">{sheetName}</strong></span>
              {isRateCalculatorTab ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  <Lock className="w-2.5 h-2.5" />
                  Read-Only Formula Tab
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  <Unlock className="w-2.5 h-2.5" />
                  Direct Edit & Paste Enabled
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Cell Reference Indicator */}
          <span className="text-[11px] font-mono font-bold bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 min-w-[55px] text-center">
            {getColName(activeCell.c)}{activeCell.r + 1}
          </span>

          {/* Formula bar / Current cell value */}
          <input
            type="text"
            value={getCellValue(activeCell.r, activeCell.c)}
            onChange={(e) => {
              if (isRateCalculatorTab) return
              setCellValue(activeCell.r, activeCell.c, e.target.value)
            }}
            readOnly={isRateCalculatorTab}
            placeholder={isRateCalculatorTab ? 'Protected formula...' : 'Click any cell or edit value here...'}
            className={`bg-gray-50 border rounded-lg px-3 py-1.5 text-xs font-mono w-[280px] focus:outline-none transition ${
              isRateCalculatorTab
                ? 'border-gray-200 text-gray-500 cursor-not-allowed bg-gray-100'
                : 'border-gray-300 text-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
            }`}
          />

          {/* ── PASTE TABLE FROM EXCEL BUTTON (PRIMARY TOOL) ── */}
          {!isRateCalculatorTab && (
            <button
              onClick={() => {
                setPastedRawText('')
                setParsedPreviewRows([])
                setShowPasteModal(true)
                setTimeout(() => pasteModalTextareaRef.current?.focus(), 100)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm shadow-emerald-600/20 transition cursor-pointer"
              title="Copy a table in Excel (Ctrl+C) and paste it directly into this sheet"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste Table from Excel
            </button>
          )}

          {/* Open local .xlsx */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[11px] font-bold hover:bg-gray-50 transition cursor-pointer"
            title="Open an updated .xlsx file from your computer"
          >
            <Upload className="w-3 h-3 text-blue-600" />
            Open .xlsx
          </button>

          {/* Add Row */}
          {!isRateCalculatorTab && (
            <button
              onClick={addRow}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[11px] font-bold hover:bg-gray-50 transition cursor-pointer"
              title="Add blank row at bottom"
            >
              <Plus className="w-3 h-3" />
              Row
            </button>
          )}

          {/* Download active sheet */}
          <a
            href={getVendorSheetDownloadUrl(vendorCode)}
            download
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[11px] font-bold hover:bg-gray-50 transition cursor-pointer"
            title="Download active Excel rate sheet (.xlsx)"
          >
            <Download className="w-3 h-3 text-gray-500" />
          </a>

          {/* Reload from server */}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[11px] font-bold hover:bg-gray-50 transition cursor-pointer"
            title="Discard edits and reload from server"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Save to server */}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!hasUnsavedChanges || saveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold shadow-md shadow-red-600/20 disabled:opacity-50 transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saveMutation.isPending ? 'Saving...' : 'Save to Server'}
          </button>
        </div>
      </div>

      {/* ── Sheet Tabs Bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1">
          {sheets.map((sh, idx) => (
            <button
              key={idx}
              onClick={() => { setActiveSheetIdx(idx); setPage(1) }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap border ${
                idx === activeSheetIdx
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : idx === 0
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {idx === 0 && <Lock className="w-2.5 h-2.5" />}
              {sh.name || `Sheet ${idx + 1}`}
            </button>
          ))}
        </div>

        {/* Quick hint badge */}
        {!isRateCalculatorTab ? (
          <span className="text-[10px] text-gray-500 font-medium shrink-0 hidden md:inline-flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono">Click any cell & type</span> or <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">Ctrl+V to paste table</span>
          </span>
        ) : (
          <span className="text-[10px] text-amber-700 font-medium shrink-0 flex items-center gap-1">
            <Lock className="w-3 h-3 text-amber-600" />
            Formulas protected • Switch to other tabs to edit rates
          </span>
        )}
      </div>

      {/* ── Blank Sheet Notice ── */}
      {data?.is_blank && (
        <div className="mx-4 mt-2.5 bg-blue-50/80 border border-blue-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-blue-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <strong>Blank Rate Sheet:</strong> No rate sheet has been uploaded for <strong>{vendorName}</strong> yet. You can paste your rate table from Excel into the <em>Tariff Rates</em> tab (or click "Paste Table from Excel" above), and click <strong>"Save to Server"</strong> to create this vendor's rate sheet!
            </div>
          </div>
          <button
            onClick={() => {
              setActiveSheetIdx(1)
              setShowPasteModal(true)
            }}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] whitespace-nowrap cursor-pointer shadow-xs shrink-0"
          >
            Paste Table Now →
          </button>
        </div>
      )}

      {/* ── Rate Calculator Tab Lock Notice ── */}
      {isRateCalculatorTab && (
        <div className="mx-4 mt-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2.5 text-xs text-amber-900 shadow-xs">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <strong>Rate Calculator Tab is Protected (Read-Only).</strong>
            This tab contains formulas linking C4 (Country), C5 (Service), C6 (Weight), C7 (Postcode) to C10 (Result Rate).
            To change tariff prices, country zones, or service codes, click on the other tabs above (e.g. <em>Self Network, Aus Zone, Remote Area</em>). You can copy any table in Excel and paste it directly into those tabs!
          </div>
        </div>
      )}

      {/* ── Main Spreadsheet Grid (Direct Click & Type + Direct Paste) ── */}
      <div className="flex-1 overflow-auto px-4 py-2">
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'auto' }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="w-10 text-center py-1.5 px-1 font-bold text-gray-500 border-r border-gray-200 bg-gray-100 sticky left-0 z-20">
                  #
                </th>
                {Array.from({ length: totalCols }, (_, c) => (
                  <th
                    key={c}
                    className={`py-1.5 px-2 font-bold text-center border-r border-gray-200 min-w-[90px] ${
                      activeCell.c === c ? 'bg-emerald-100 text-emerald-800' : 'text-gray-600'
                    }`}
                  >
                    {getColName(c)}
                  </th>
                ))}
                {!isRateCalculatorTab && <th className="w-8 py-1.5 px-1 bg-gray-100 text-gray-400"></th>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, ri) => {
                const actualRowIdx = startRow + ri
                const isSelectedRow = actualRowIdx === activeCell.r

                return (
                  <tr
                    key={actualRowIdx}
                    className={`border-b border-gray-100 hover:bg-blue-50/20 ${
                      isSelectedRow ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    {/* Row Index */}
                    <td
                      className={`text-center py-1 px-1 font-mono font-bold border-r border-gray-200 sticky left-0 z-10 bg-gray-50 ${
                        isSelectedRow ? 'bg-emerald-100 text-emerald-800' : 'text-gray-400'
                      }`}
                    >
                      {actualRowIdx + 1}
                    </td>

                    {/* Cell Columns: Real, Instant Inputs (No Double-Click Needed!) */}
                    {Array.from({ length: totalCols }, (_, c) => {
                      const val = getCellValue(actualRowIdx, c)
                      const isActive = actualRowIdx === activeCell.r && c === activeCell.c
                      const isFormula = typeof val === 'string' && val.startsWith('=')

                      return (
                        <td
                          key={c}
                          className={`p-0 border-r border-gray-100 transition-colors relative ${
                            isActive ? 'ring-2 ring-emerald-500 z-[5]' : ''
                          } ${isFormula ? 'bg-purple-50/50' : ''}`}
                        >
                          <input
                            id={`cell-${actualRowIdx}-${c}`}
                            type="text"
                            value={val}
                            readOnly={isRateCalculatorTab}
                            onChange={(e) => {
                              if (isRateCalculatorTab) return
                              setCellValue(actualRowIdx, c, e.target.value)
                            }}
                            onFocus={() => {
                              setActiveCell({ r: actualRowIdx, c })
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, actualRowIdx, c)}
                            onPaste={(e) => handleCellPaste(e, actualRowIdx, c)}
                            title={isFormula ? `Formula: ${val}` : undefined}
                            className={`w-full h-8 px-2 py-1 bg-transparent text-[11px] font-mono border-none outline-none focus:bg-white text-gray-900 ${
                              isRateCalculatorTab
                                ? 'cursor-not-allowed text-gray-500 bg-gray-50/30'
                                : 'cursor-text'
                            } ${isFormula ? 'text-purple-700 font-bold' : ''}`}
                          />
                        </td>
                      )
                    })}

                    {/* Delete Row Action */}
                    {!isRateCalculatorTab && (
                      <td className="p-0 text-center w-8">
                        {isSelectedRow && (
                          <button
                            onClick={() => deleteRow(actualRowIdx)}
                            className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                            title="Delete this row"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom Pagination & Controls ── */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-gray-500">
          <span>
            Showing rows {startRow + 1}–{Math.min(startRow + (pageSize || totalRows), totalRows)} of {totalRows}
          </span>
          <span className="text-gray-300">|</span>
          <span>{totalCols} columns</span>

          {/* Rows per page selector */}
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-gray-400 text-[11px]">Rows/page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="bg-gray-50 border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-semibold text-gray-700"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
              <option value="0">All Rows</option>
            </select>
          </div>
        </div>

        {pageSize > 0 && maxPage > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 transition cursor-pointer disabled:opacity-40"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="text-gray-600 font-bold px-2">
              Page {page} / {maxPage}
            </span>
            <button
              onClick={() => setPage(p => Math.min(maxPage, p + 1))}
              disabled={page >= maxPage}
              className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 transition cursor-pointer disabled:opacity-40"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── MODAL: PASTE TABLE DIRECTLY FROM EXCEL ── */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                  <ClipboardPaste className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    Paste Table from Excel
                  </h3>
                  <p className="text-xs text-gray-500">
                    Target Sheet: <strong className="text-gray-800">{sheetName}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instruction Callout */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-950 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Instructions:</strong> Open your Excel file on your computer, select the table or rows you want, press <strong>Ctrl+C</strong> to copy, then click in the box below and press <strong>Ctrl+V</strong>.
              </div>
            </div>

            {/* Paste Textarea */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Paste Excel Content Here (Ctrl+V):
              </label>
              <textarea
                ref={pasteModalTextareaRef}
                rows={6}
                value={pastedRawText}
                onChange={(e) => {
                  const val = e.target.value
                  setPastedRawText(val)
                  const rows = parseExcelClipboardData(val)
                  setParsedPreviewRows(rows)
                }}
                onPaste={handleModalTextareaPaste}
                placeholder="Click here and press Ctrl+V to paste table from Excel..."
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            {/* Detected Table Preview Stats */}
            {parsedPreviewRows.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-emerald-800 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Detected: {parsedPreviewRows.length} rows × {Math.max(...parsedPreviewRows.map(r => r.length))} columns
                  </span>
                  <span className="text-gray-500 text-[11px]">Previewing first 3 rows:</span>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white max-h-32">
                  <table className="w-full border-collapse text-[10px] font-mono">
                    <tbody>
                      {parsedPreviewRows.slice(0, 3).map((r, ri) => (
                        <tr key={ri} className="border-b border-gray-100">
                          {r.slice(0, 8).map((c, ci) => (
                            <td key={ci} className="px-2 py-1 border-r border-gray-100 truncate max-w-[120px]">
                              {c || '\u00A0'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Placement Mode */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Where should this table be inserted?
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                  pasteMode === 'replace'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="pasteMode"
                    value="replace"
                    checked={pasteMode === 'replace'}
                    onChange={() => setPasteMode('replace')}
                    className="accent-emerald-600"
                  />
                  <span>Replace Entire Tab</span>
                </label>

                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                  pasteMode === 'cell'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="pasteMode"
                    value="cell"
                    checked={pasteMode === 'cell'}
                    onChange={() => setPasteMode('cell')}
                    className="accent-emerald-600"
                  />
                  <span>At Cell ({getColName(activeCell.c)}{activeCell.r + 1})</span>
                </label>

                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                  pasteMode === 'append'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="pasteMode"
                    value="append"
                    checked={pasteMode === 'append'}
                    onChange={() => setPasteMode('append')}
                    className="accent-emerald-600"
                  />
                  <span>Append to Bottom</span>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyModalPaste}
                disabled={parsedPreviewRows.length === 0 && !pastedRawText.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Apply Table to {sheetName}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
