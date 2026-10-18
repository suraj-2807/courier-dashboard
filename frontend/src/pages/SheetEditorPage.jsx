import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
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
  ExternalLink
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

export default function SheetEditorPage() {
  const [searchParams] = useSearchParams()
  const vendorCode = searchParams.get('vendor') || 'pacific'
  const vendorName = searchParams.get('name') || vendorCode.toUpperCase()

  const queryClient = useQueryClient()
  const inlineInputRef = useRef(null)
  const formulaInputRef = useRef(null)

  // ── Query live workbook data ──
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-workbook-data', vendorCode],
    queryFn: () => getVendorWorkbookData(vendorCode),
    enabled: !!vendorCode
  })

  // ── Local Editable Sheets State ──
  const [sheets, setSheets] = useState([])
  const [activeSheetIdx, setActiveSheetIdx] = useState(0)
  const [activeCell, setActiveCell] = useState({ r: 3, c: 2 }) // Default to C4
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const pageSize = 80

  // Populate local sheets state when server data is loaded
  useEffect(() => {
    if (data?.sheets) {
      setSheets(JSON.parse(JSON.stringify(data.sheets)))
      setHasUnsavedChanges(false)
      setIsEditing(false)
      // Auto-select first non-calculator tab if available
      if (data.sheets.length > 1) {
        setActiveSheetIdx(1)
      }
    }
  }, [data])

  // Update page title
  useEffect(() => {
    document.title = `Sheet Editor — ${vendorName} | Courier Admin`
  }, [vendorName])

  const activeSheet = sheets[activeSheetIdx] || null
  const sheetName = activeSheet?.name || ''
  const isRateCalculatorTab = sheetName.toLowerCase().includes('rate calculator') || activeSheetIdx === 0

  // Max columns
  const totalCols = useMemo(() => {
    if (!activeSheet?.rows) return 10
    let max = 10
    activeSheet.rows.forEach(r => {
      if (Array.isArray(r) && r.length > max) max = r.length
    })
    return Math.min(max, 26)
  }, [activeSheet])

  // Paginated rows
  const totalRows = activeSheet?.rows?.length || 0
  const maxPage = Math.max(1, Math.ceil(totalRows / pageSize))
  const startRow = (page - 1) * pageSize
  const visibleRows = activeSheet?.rows?.slice(startRow, startRow + pageSize) || []

  // Get cell value
  const getCellValue = (r, c) => {
    if (!activeSheet?.rows?.[r]) return ''
    const val = activeSheet.rows[r][c]
    if (val === undefined || val === null) return ''
    return String(val)
  }

  // Set cell value
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

  // Cell click
  const handleCellClick = (r, c) => {
    setActiveCell({ r, c })
    setIsEditing(false)
  }

  // Cell double click
  const handleCellDoubleClick = (r, c) => {
    if (isRateCalculatorTab) {
      toast('Rate Calculator tab is read-only. Edit other tabs to modify data.', { icon: '🔒' })
      return
    }
    setActiveCell({ r, c })
    setEditValue(getCellValue(r, c))
    setIsEditing(true)
    setTimeout(() => inlineInputRef.current?.focus(), 50)
  }

  // Commit edit
  const commitEdit = () => {
    if (isEditing) {
      setCellValue(activeCell.r, activeCell.c, editValue)
      setIsEditing(false)
    }
  }

  // Cancel edit
  const cancelEdit = () => {
    setIsEditing(false)
    setEditValue('')
  }

  // Handle paste from clipboard (multi-cell)
  const handlePaste = async (e) => {
    if (isRateCalculatorTab) {
      e.preventDefault()
      toast('Rate Calculator tab is read-only', { icon: '🔒' })
      return
    }
    const clipText = e.clipboardData?.getData('text') || ''
    if (!clipText) return

    const lines = clipText.split('\n').filter(l => l.length > 0)
    if (lines.length <= 1 && !lines[0]?.includes('\t')) return // Let normal paste happen for single-cell

    e.preventDefault()
    const { r: startR, c: startC } = activeCell
    setSheets(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      lines.forEach((line, ri) => {
        const cells = line.split('\t')
        cells.forEach((val, ci) => {
          const tr = startR + ri
          const tc = startC + ci
          if (!next[activeSheetIdx].rows[tr]) {
            next[activeSheetIdx].rows[tr] = []
          }
          while (next[activeSheetIdx].rows[tr].length <= tc) {
            next[activeSheetIdx].rows[tr].push('')
          }
          next[activeSheetIdx].rows[tr][tc] = val.trim()
        })
      })
      return next
    })
    setHasUnsavedChanges(true)
    toast.success(`Pasted ${lines.length} rows from clipboard`)
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => saveVendorWorkbookData(vendorCode, sheets, vendorName),
    onSuccess: (data) => {
      toast.success(data.message || 'Workbook saved successfully!')
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

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (isEditing) {
      if (e.key === 'Enter') {
        commitEdit()
        setActiveCell(prev => ({ r: Math.min(prev.r + 1, totalRows - 1), c: prev.c }))
      } else if (e.key === 'Escape') {
        cancelEdit()
      } else if (e.key === 'Tab') {
        e.preventDefault()
        commitEdit()
        setActiveCell(prev => ({ r: prev.r, c: Math.min(prev.c + 1, totalCols - 1) }))
      }
      return
    }

    if (e.key === 'Enter' || e.key === 'F2') {
      if (!isRateCalculatorTab) {
        e.preventDefault()
        setEditValue(getCellValue(activeCell.r, activeCell.c))
        setIsEditing(true)
        setTimeout(() => inlineInputRef.current?.focus(), 50)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveCell(prev => ({ r: Math.min(prev.r + 1, totalRows - 1), c: prev.c }))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveCell(prev => ({ r: Math.max(prev.r - 1, 0), c: prev.c }))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setActiveCell(prev => ({ r: prev.r, c: Math.min(prev.c + 1, totalCols - 1) }))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setActiveCell(prev => ({ r: prev.r, c: Math.max(prev.c - 1, 0) }))
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!isRateCalculatorTab) {
        setCellValue(activeCell.r, activeCell.c, '')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-red-600 animate-spin mx-auto" />
          <p className="text-sm font-bold text-gray-700">Loading workbook for {vendorName}...</p>
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
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      onPaste={handlePaste}
      style={{ outline: 'none' }}
    >
      <Toaster position="top-right" />

      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-md">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              {vendorName} — Sheet Editor
              {hasUnsavedChanges && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  Unsaved Changes
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <span className="font-mono">{sheetName}</span>
              {isRateCalculatorTab && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  <Lock className="w-2.5 h-2.5" />
                  Read-Only
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Cell Reference Display */}
          <span className="text-[11px] font-mono font-bold bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 min-w-[60px] text-center">
            {getColName(activeCell.c)}{activeCell.r + 1}
          </span>

          {/* Formula / Value Bar */}
          <input
            ref={formulaInputRef}
            type="text"
            value={isEditing ? editValue : getCellValue(activeCell.r, activeCell.c)}
            onChange={(e) => {
              if (isRateCalculatorTab) return
              setEditValue(e.target.value)
              if (!isEditing) setIsEditing(true)
            }}
            onBlur={() => { if (isEditing) commitEdit() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { commitEdit(); formulaInputRef.current?.blur() }
              if (e.key === 'Escape') cancelEdit()
            }}
            readOnly={isRateCalculatorTab}
            placeholder="Cell value..."
            className={`bg-gray-50 border rounded-lg px-3 py-1.5 text-xs font-mono w-[300px] focus:outline-none transition ${
              isRateCalculatorTab
                ? 'border-gray-200 text-gray-500 cursor-not-allowed bg-gray-100'
                : 'border-gray-300 text-gray-900 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
            }`}
          />

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cells..."
              className="bg-gray-50 border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium text-gray-900 w-[180px] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>

          <div className="h-5 border-l border-gray-200 mx-1" />

          {/* Add Row */}
          {!isRateCalculatorTab && (
            <button
              onClick={addRow}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[11px] font-bold hover:bg-gray-50 transition cursor-pointer"
              title="Add row at bottom"
            >
              <Plus className="w-3 h-3" />
              Row
            </button>
          )}

          {/* Reload */}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[11px] font-bold hover:bg-gray-50 transition cursor-pointer"
            title="Reload from server"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Download */}
          <a
            href={getVendorSheetDownloadUrl(vendorCode)}
            download
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[11px] font-bold hover:bg-gray-50 transition cursor-pointer"
            title="Download .xlsx"
          >
            <Download className="w-3 h-3" />
          </a>

          {/* Save */}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!hasUnsavedChanges || saveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold shadow-md shadow-red-600/20 disabled:opacity-50 transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Sheet Tabs ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center gap-1 overflow-x-auto">
        {sheets.map((sh, idx) => (
          <button
            key={idx}
            onClick={() => { setActiveSheetIdx(idx); setPage(1); setIsEditing(false) }}
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

      {/* ── Rate Calculator Read-Only Notice ── */}
      {isRateCalculatorTab && (
        <div className="mx-4 mt-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2.5 text-xs text-amber-900">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <strong>Rate Calculator tab is read-only.</strong> This tab contains formulas that calculate rates automatically.
            To modify tariff data, switch to other tabs (e.g. Self Network, Aus Zone, etc.). Copy-paste is fully supported on editable tabs.
          </div>
        </div>
      )}

      {/* ── Spreadsheet Grid ── */}
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
                    className={`py-1.5 px-2 font-bold text-center border-r border-gray-200 min-w-[80px] ${
                      activeCell.c === c ? 'bg-red-100 text-red-800' : 'text-gray-600'
                    }`}
                  >
                    {getColName(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, ri) => {
                const actualRowIdx = startRow + ri
                return (
                  <tr
                    key={actualRowIdx}
                    className={`border-b border-gray-100 hover:bg-blue-50/30 ${
                      actualRowIdx === activeCell.r ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td
                      className={`text-center py-1 px-1 font-mono font-bold border-r border-gray-200 sticky left-0 z-10 bg-gray-50 ${
                        actualRowIdx === activeCell.r ? 'bg-red-100 text-red-800' : 'text-gray-400'
                      }`}
                    >
                      {actualRowIdx + 1}
                    </td>
                    {Array.from({ length: totalCols }, (_, c) => {
                      const val = getCellValue(actualRowIdx, c)
                      const isActive = actualRowIdx === activeCell.r && c === activeCell.c
                      const isFormula = typeof val === 'string' && val.startsWith('=')

                      return (
                        <td
                          key={c}
                          className={`py-0.5 px-1.5 border-r border-gray-100 cursor-cell transition-colors relative ${
                            isActive
                              ? 'bg-blue-100 outline outline-2 outline-blue-500 z-[5]'
                              : isFormula
                              ? 'bg-purple-50/50'
                              : ''
                          } ${isRateCalculatorTab ? 'cursor-default' : ''}`}
                          onClick={() => handleCellClick(actualRowIdx, c)}
                          onDoubleClick={() => handleCellDoubleClick(actualRowIdx, c)}
                        >
                          {isActive && isEditing && !isRateCalculatorTab ? (
                            <input
                              ref={inlineInputRef}
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { commitEdit(); setActiveCell(prev => ({ r: prev.r + 1, c: prev.c })) }
                                if (e.key === 'Escape') cancelEdit()
                                if (e.key === 'Tab') { e.preventDefault(); commitEdit(); setActiveCell(prev => ({ r: prev.r, c: prev.c + 1 })) }
                              }}
                              className="w-full bg-white border-none outline-none text-[11px] font-mono px-0 py-0 text-gray-900"
                              autoFocus
                            />
                          ) : (
                            <span className={`block truncate max-w-[200px] ${
                              isFormula ? 'text-purple-700 font-mono text-[10px]' : 'text-gray-800'
                            } ${!val ? 'text-gray-300' : ''}`}>
                              {val || '\u00A0'}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    {/* Delete row button */}
                    {!isRateCalculatorTab && actualRowIdx === activeCell.r && (
                      <td className="p-0 w-6">
                        <button
                          onClick={() => deleteRow(actualRowIdx)}
                          className="text-red-400 hover:text-red-600 p-0.5 cursor-pointer"
                          title="Delete this row"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom Pagination ── */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-gray-500">
          <span>
            Rows {startRow + 1}–{Math.min(startRow + pageSize, totalRows)} of {totalRows}
          </span>
          <span className="text-gray-300">|</span>
          <span>{totalCols} columns</span>
          {isRateCalculatorTab && (
            <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
              <Lock className="w-3 h-3" />
              Read-Only Tab
            </span>
          )}
        </div>
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
      </div>
    </div>
  )
}
