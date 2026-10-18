import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
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
  RefreshCw
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

export default function ExcelSheetEditor({ vendorCode = 'pacific', vendorName = 'Pacific Express', onSaved }) {
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
  const [activeCell, setActiveCell] = useState({ r: 3, c: 2 }) // Default to C4 (r=3, c=2)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const pageSize = 50

  // Populate local sheets state when server data is loaded
  useEffect(() => {
    if (data?.sheets) {
      setSheets(JSON.parse(JSON.stringify(data.sheets)))
      setHasUnsavedChanges(false)
      setIsEditing(false)
    }
  }, [data])

  const activeSheet = sheets[activeSheetIdx] || null
  const sheetName = activeSheet?.name || ''
  const isRateCalculatorTab = sheetName.toLowerCase().includes('rate calculator') || activeSheetIdx === 0

  // Max columns for active sheet (minimum 10 columns for a clean spreadsheet appearance)
  const totalCols = useMemo(() => {
    if (!activeSheet?.rows) return 10
    let max = 10
    activeSheet.rows.forEach(r => {
      if (Array.isArray(r) && r.length > max) max = r.length
    })
    return max
  }, [activeSheet])

  // Current cell value helper
  const getCellValue = (r, c) => {
    if (!activeSheet?.rows?.[r]) return ''
    const val = activeSheet.rows[r][c]
    return val !== undefined && val !== null ? String(val) : ''
  }

  // Update cell value
  const updateCellValue = (r, c, val) => {
    setSheets(prevSheets => {
      const nextSheets = [...prevSheets]
      const current = { ...nextSheets[activeSheetIdx] }
      const newRows = current.rows.map(row => [...row])

      // Ensure row exists
      while (newRows.length <= r) {
        newRows.push([])
      }
      // Ensure column exists
      while (newRows[r].length <= c) {
        newRows[r].push('')
      }

      newRows[r][c] = val
      current.rows = newRows
      nextSheets[activeSheetIdx] = current
      return nextSheets
    })
    setHasUnsavedChanges(true)
  }

  // Active cell coordinate string e.g. "C4"
  const activeCellCoord = `${getColName(activeCell.c)}${activeCell.r + 1}`
  const activeCellValue = getCellValue(activeCell.r, activeCell.c)

  // Start editing active cell
  const startEditing = (initialVal) => {
    setEditValue(initialVal !== undefined ? initialVal : activeCellValue)
    setIsEditing(true)
    setTimeout(() => {
      inlineInputRef.current?.focus()
      inlineInputRef.current?.select()
    }, 10)
  }

  // Commit editing
  const commitEditing = () => {
    updateCellValue(activeCell.r, activeCell.c, editValue)
    setIsEditing(false)
  }

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false)
    setEditValue(activeCellValue)
  }

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: () => saveVendorWorkbookData(vendorCode, sheets, vendorName),
    onSuccess: (res) => {
      toast.success(res.message || 'Excel rate sheet saved to server!')
      setHasUnsavedChanges(false)
      queryClient.invalidateQueries({ queryKey: ['vendor-workbook-data', vendorCode] })
      queryClient.invalidateQueries({ queryKey: ['vendor-sheet-details', vendorCode] })
      queryClient.invalidateQueries({ queryKey: ['portal-vendors-with-sheets'] })
      if (onSaved) onSaved(res)
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to save rate sheet')
    }
  })

  // Add row to current sheet
  const handleAddRow = () => {
    setSheets(prevSheets => {
      const nextSheets = [...prevSheets]
      const current = { ...nextSheets[activeSheetIdx] }
      const newRows = [...current.rows, new Array(totalCols).fill('')]
      current.rows = newRows
      nextSheets[activeSheetIdx] = current
      return nextSheets
    })
    setHasUnsavedChanges(true)
    toast.success('Row added to bottom of sheet')
  }

  // Delete active row
  const handleDeleteActiveRow = () => {
    if (!activeSheet?.rows || activeSheet.rows.length <= 1) {
      toast.error('Cannot delete the only row in sheet')
      return
    }
    const rowIdx = activeCell.r
    setSheets(prevSheets => {
      const nextSheets = [...prevSheets]
      const current = { ...nextSheets[activeSheetIdx] }
      const newRows = current.rows.filter((_, idx) => idx !== rowIdx)
      current.rows = newRows
      nextSheets[activeSheetIdx] = current
      return nextSheets
    })
    setHasUnsavedChanges(true)
    setActiveCell(prev => ({ ...prev, r: Math.max(0, prev.r - 1) }))
    toast.success(`Row #${rowIdx + 1} deleted`)
  }

  // Add column to current sheet
  const handleAddColumn = () => {
    setSheets(prevSheets => {
      const nextSheets = [...prevSheets]
      const current = { ...nextSheets[activeSheetIdx] }
      const newRows = current.rows.map(r => [...r, ''])
      current.rows = newRows
      nextSheets[activeSheetIdx] = current
      return nextSheets
    })
    setHasUnsavedChanges(true)
    toast.success('Column added to right of sheet')
  }

  // Keyboard navigation on grid
  const handleKeyDown = (e) => {
    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitEditing()
        // Move selection down 1 row
        setActiveCell(prev => ({ ...prev, r: prev.r + 1 }))
      } else if (e.key === 'Tab') {
        e.preventDefault()
        commitEditing()
        // Move selection right 1 column
        setActiveCell(prev => ({ ...prev, c: prev.c + 1 }))
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEditing()
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveCell(prev => ({ ...prev, r: Math.max(0, prev.r - 1) }))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveCell(prev => ({ ...prev, r: Math.min((activeSheet?.rows?.length || 1) - 1, prev.r + 1) }))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setActiveCell(prev => ({ ...prev, c: Math.max(0, prev.c - 1) }))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setActiveCell(prev => ({ ...prev, c: Math.min(totalCols - 1, prev.c + 1) }))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      startEditing()
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Type directly into active cell
      startEditing(e.key)
    }
  }

  // Filtered rows based on search
  const filteredRowIndices = useMemo(() => {
    if (!activeSheet?.rows) return []
    if (!searchQuery.trim()) {
      return activeSheet.rows.map((_, i) => i)
    }
    const q = searchQuery.toLowerCase().trim()
    const matches = []
    activeSheet.rows.forEach((row, idx) => {
      const match = (row || []).some(cell => String(cell || '').toLowerCase().includes(q))
      if (match) matches.push(idx)
    })
    return matches
  }, [activeSheet, searchQuery])

  // Paginated visible row indices
  const totalPages = Math.max(1, Math.ceil(filteredRowIndices.length / pageSize))
  const paginatedRowIndices = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRowIndices.slice(start, start + pageSize)
  }, [filteredRowIndices, page, pageSize])

  // Reset page when search or sheet changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery, activeSheetIdx])

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-red-600 animate-spin mx-auto" />
        <h3 className="text-sm font-bold text-gray-800">Opening Excel Workbook in Browser...</h3>
        <p className="text-xs text-gray-500">Loading sheets, rows, and formulas for {vendorName}...</p>
      </div>
    )
  }

  if (isError || !data?.sheets) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
        <h3 className="text-sm font-bold text-gray-900">Failed to load Excel rate sheet</h3>
        <p className="text-xs text-gray-500">Could not read workbook file for vendor "{vendorCode}".</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition cursor-pointer"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden animate-fade-in" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* ── Top Header Toolbar ── */}
      <div className="p-4 border-b border-gray-200 bg-gray-50/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-900">
                In-Browser Excel Sheet Editor: <span className="text-red-600">{vendorName}</span>
              </h2>
              {hasUnsavedChanges && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              Active file: <strong className="text-gray-700">{data.filename}</strong> • Click any cell to view/edit • Changes save directly to server
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search in active sheet */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in sheet..."
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Add Row */}
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer shadow-xs"
            title="Add a new row at the bottom of sheet"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            Add Row
          </button>

          {/* Delete Row */}
          <button
            type="button"
            onClick={handleDeleteActiveRow}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer shadow-xs"
            title={`Delete active row #${activeCell.r + 1}`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            Del Row #{activeCell.r + 1}
          </button>

          {/* Add Column */}
          <button
            type="button"
            onClick={handleAddColumn}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer shadow-xs"
            title="Add a new column to the right"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            Add Col
          </button>

          {/* Discard / Reload */}
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Discard unsaved edits and reload original rate sheet?')) {
                  refetch()
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-600 text-xs font-semibold hover:bg-gray-100 transition cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
              Discard
            </button>
          )}

          {/* Save to Server Button */}
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasUnsavedChanges}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-md ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
            }`}
          >
            <Save className={`w-3.5 h-3.5 ${saveMutation.isPending ? 'animate-spin' : ''}`} />
            {saveMutation.isPending ? 'Saving to .xlsx...' : 'Save Sheet to Server'}
          </button>

          {/* Download Original */}
          <a
            href={getVendorSheetDownloadUrl(vendorCode)}
            download
            className="p-1.5 text-gray-500 hover:text-gray-800 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition cursor-pointer shadow-xs"
            title="Download .xlsx file"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* ── Sheet Tabs Bar (like Excel bottom tabs) ── */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-gray-100/70 overflow-x-auto text-xs">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-2 shrink-0">
          Worksheets:
        </span>
        {sheets.map((s, idx) => (
          <button
            key={s.name || idx}
            type="button"
            onClick={() => {
              setActiveSheetIdx(idx)
              setActiveCell({ r: 0, c: 0 })
              setIsEditing(false)
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer shrink-0 ${
              activeSheetIdx === idx
                ? 'bg-white text-gray-900 border border-gray-300 shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <Table2 className={`w-3.5 h-3.5 ${activeSheetIdx === idx ? 'text-red-600' : 'text-gray-400'}`} />
            <span>{s.name || `Sheet${idx + 1}`}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-100 text-gray-500">
              {s.rows?.length || 0} rows
            </span>
          </button>
        ))}
      </div>

      {/* ── Formula Bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white text-xs">
        {/* Cell Coordinate Badge e.g. "C4" */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 border border-gray-300 font-mono font-bold text-gray-700 min-w-[70px] justify-center">
          <span className="text-[10px] text-gray-400">Cell:</span>
          <span>{activeCellCoord}</span>
        </div>

        {/* fx label */}
        <span className="text-gray-400 font-serif italic font-bold select-none text-sm">fx</span>

        {/* Formula Input */}
        <div className="flex-1 relative">
          <input
            ref={formulaInputRef}
            type="text"
            value={isEditing ? editValue : activeCellValue}
            onChange={(e) => {
              if (!isEditing) setIsEditing(true)
              setEditValue(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitEditing()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancelEditing()
              }
            }}
            placeholder="Type cell value, number, or formula starting with '=' (e.g. =VLOOKUP(...))"
            className="w-full bg-gray-50/50 border border-gray-200 rounded-lg px-3 py-1 font-mono text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        {isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={commitEditing}
              className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
              title="Commit (Enter)"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancelEditing}
              className="p-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
              title="Cancel (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Special cell notice if Rate Calculator */}
        {isRateCalculatorTab && (
          <div className="hidden lg:flex items-center gap-1 text-[11px] text-gray-500 shrink-0">
            {activeCellCoord === 'C4' && <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">B4/C4: Country Input</span>}
            {activeCellCoord === 'C5' && <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">B5/C5: Service Input</span>}
            {activeCellCoord === 'C6' && <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">B6/C6: Weight Input</span>}
            {activeCellCoord === 'C7' && <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">B7/C7: Postcode / State Input</span>}
            {activeCellCoord === 'C10' && <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">B10/C10: Output Rate Fetched by System</span>}
          </div>
        )}
      </div>

      {/* ── Spreadsheet Grid ── */}
      <div className="overflow-auto max-h-[600px] border-b border-gray-200 select-none">
        <table className="border-collapse w-full text-xs font-sans">
          {/* Column Header Row (A, B, C, D...) */}
          <thead className="bg-gray-100 sticky top-0 z-20 text-gray-600 font-bold text-[11px]">
            <tr>
              {/* Corner header */}
              <th className="w-12 min-w-[48px] py-1 px-2 border-r border-b border-gray-300 text-center bg-gray-200 text-gray-500 font-mono text-[10px] sticky left-0 z-30">
                #
              </th>
              {Array.from({ length: totalCols }).map((_, cIdx) => (
                <th
                  key={cIdx}
                  className={`min-w-[120px] max-w-[240px] py-1 px-2.5 border-r border-b border-gray-300 text-center font-mono transition ${
                    activeCell.c === cIdx ? 'bg-blue-100 text-blue-900 font-black' : 'bg-gray-100'
                  }`}
                >
                  {getColName(cIdx)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {paginatedRowIndices.map(rIdx => {
              const isRowActive = activeCell.r === rIdx
              return (
                <tr key={rIdx} className={isRowActive ? 'bg-blue-50/20' : 'hover:bg-gray-50/50'}>
                  {/* Row Number (1, 2, 3...) */}
                  <td
                    onClick={() => setActiveCell({ r: rIdx, c: activeCell.c })}
                    className={`py-1 px-2 border-r border-b border-gray-300 text-center font-mono text-[10px] sticky left-0 z-10 cursor-pointer ${
                      isRowActive ? 'bg-blue-200 text-blue-950 font-black' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {rIdx + 1}
                  </td>

                  {/* Row Cells */}
                  {Array.from({ length: totalCols }).map((_, cIdx) => {
                    const isCellActive = activeCell.r === rIdx && activeCell.c === cIdx
                    const val = getCellValue(rIdx, cIdx)
                    const cellCoord = `${getColName(cIdx)}${rIdx + 1}`

                    // Highlighting key template cells on Rate Calculator tab
                    const isInputCell = isRateCalculatorTab && ['C4', 'C5', 'C6', 'C7'].includes(cellCoord)
                    const isOutputCell = isRateCalculatorTab && cellCoord === 'C10'
                    const isLabelCell = isRateCalculatorTab && ['B4', 'B5', 'B6', 'B7', 'B10'].includes(cellCoord)

                    return (
                      <td
                        key={cIdx}
                        onClick={() => {
                          if (isEditing && (activeCell.r !== rIdx || activeCell.c !== cIdx)) {
                            commitEditing()
                          }
                          setActiveCell({ r: rIdx, c: cIdx })
                        }}
                        onDoubleClick={() => {
                          setActiveCell({ r: rIdx, c: cIdx })
                          startEditing()
                        }}
                        className={`min-w-[120px] max-w-[240px] p-1 border-r border-b border-gray-200 text-xs truncate transition relative cursor-cell ${
                          isCellActive
                            ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/40 z-10'
                            : isOutputCell
                            ? 'bg-emerald-50 text-emerald-950 font-extrabold'
                            : isInputCell
                            ? 'bg-blue-50/60 font-bold text-blue-950'
                            : isLabelCell
                            ? 'bg-gray-50 font-bold text-gray-800'
                            : 'text-gray-800'
                        }`}
                      >
                        {isCellActive && isEditing ? (
                          <input
                            ref={inlineInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full bg-white text-xs font-mono px-1 py-0.5 outline-none border border-blue-500 rounded"
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-1 overflow-hidden">
                            <span className="truncate font-mono text-xs">
                              {val || <span className="text-gray-300">·</span>}
                            </span>
                            {/* Special badges */}
                            {isOutputCell && (
                              <span className="text-[9px] font-bold px-1 rounded bg-emerald-200 text-emerald-900 shrink-0">
                                Output C10
                              </span>
                            )}
                            {isInputCell && (
                              <span className="text-[9px] font-bold px-1 rounded bg-blue-200 text-blue-900 shrink-0">
                                Input
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Bottom Pagination & Footer Status ── */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-600">
        <div className="flex items-center gap-3">
          <span>
            Showing rows <strong>{(page - 1) * pageSize + 1}</strong> - <strong>{Math.min(filteredRowIndices.length, page * pageSize)}</strong> of <strong>{filteredRowIndices.length}</strong>
            {searchQuery && ` (filtered from ${activeSheet?.rows?.length || 0})`}
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            Total Columns: <strong>{totalCols}</strong>
          </span>
        </div>

        {/* Pagination buttons */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded bg-white border border-gray-200 text-gray-700 disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-bold text-gray-800">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 rounded bg-white border border-gray-200 text-gray-700 disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
