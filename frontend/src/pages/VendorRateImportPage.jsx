import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  FileSpreadsheet,
  Upload,
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  FileCheck,
  Building,
  Calendar,
  X
} from 'lucide-react'
import {
  validateVendorWorkbook,
  importVendorWorkbook,
  getImportBatches,
  getBatchDetail,
  deleteImportBatch,
  getImportVendors
} from '../api/vendorRateImport.api'

export default function VendorRateImportPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  // ── States ──
  const [selectedFile, setSelectedFile] = useState(null)
  const [vendorName, setVendorName] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [validationResult, setValidationResult] = useState(null)
  const [selectedBatchId, setSelectedBatchId] = useState(null)
  const [vendorFilter, setVendorFilter] = useState('')
  
  // Batch detail filter states
  const [detailSearch, setDetailSearch] = useState('')
  const [detailServiceCode, setDetailServiceCode] = useState('')
  const [detailSheetName, setDetailSheetName] = useState('')
  const [detailPage, setDetailPage] = useState(1)
  const [detailLimit] = useState(50)

  // ── Queries ──
  const { data: batchesData, isLoading: batchesLoading, refetch: refetchBatches } = useQuery({
    queryKey: ['vendor-rate-batches', vendorFilter],
    queryFn: () => getImportBatches({ vendor_name: vendorFilter || undefined })
  })

  const { data: vendorsData } = useQuery({
    queryKey: ['vendor-rate-vendors'],
    queryFn: getImportVendors
  })

  const { data: batchDetailData, isLoading: batchDetailLoading } = useQuery({
    queryKey: ['vendor-rate-batch-detail', selectedBatchId, detailPage, detailSearch, detailServiceCode, detailSheetName],
    queryFn: () => getBatchDetail(selectedBatchId, {
      page: detailPage,
      limit: detailLimit,
      search: detailSearch,
      service_code: detailServiceCode,
      sheet_name: detailSheetName
    }),
    enabled: !!selectedBatchId
  })

  // ── Mutations ──
  const validateMutation = useMutation({
    mutationFn: ({ file, vendorName }) => validateVendorWorkbook(file, vendorName),
    onSuccess: (data) => {
      setValidationResult(data.validation)
      if (data.validation.is_valid) {
        toast.success(`Validated! Found ${data.validation.summary.total_records} records across ${data.validation.summary.total_sheets} sheet(s).`)
      } else {
        toast.error(`Validation found ${data.validation.errors.length} error(s). Please review below.`)
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Workbook validation failed')
    }
  })

  const importMutation = useMutation({
    mutationFn: ({ file, vendorName }) => importVendorWorkbook(file, vendorName),
    onSuccess: (data) => {
      toast.success(data.message || 'Vendor rate sheet imported successfully!')
      setSelectedFile(null)
      setValidationResult(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      queryClient.invalidateQueries({ queryKey: ['vendor-rate-batches'] })
      queryClient.invalidateQueries({ queryKey: ['vendor-rate-vendors'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Import failed')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (batchId) => deleteImportBatch(batchId),
    onSuccess: () => {
      toast.success('Import batch deleted')
      if (selectedBatchId) setSelectedBatchId(null)
      queryClient.invalidateQueries({ queryKey: ['vendor-rate-batches'] })
      queryClient.invalidateQueries({ queryKey: ['vendor-rate-vendors'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete batch')
    }
  })

  // ── Handlers ──
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0])
    }
  }

  const handleFileSelected = (file) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please upload an Excel file (.xlsx or .xls)')
      return
    }
    setSelectedFile(file)
    setValidationResult(null)

    // Suggest vendor name from filename if empty
    if (!vendorName) {
      const suggested = file.name.replace(/\.[^/.]+$/, '').split(/[-_ ]/)[0]
      if (suggested && suggested.length > 2) {
        setVendorName(suggested.toUpperCase())
      }
    }
  }

  const handleValidate = () => {
    if (!selectedFile) {
      toast.error('Please select an Excel file first')
      return
    }
    if (!vendorName.trim()) {
      toast.error('Please enter a vendor name')
      return
    }
    validateMutation.mutate({ file: selectedFile, vendorName: vendorName.trim() })
  }

  const handleImport = () => {
    if (!selectedFile) {
      toast.error('Please select an Excel file')
      return
    }
    if (!vendorName.trim()) {
      toast.error('Please enter a vendor name')
      return
    }
    importMutation.mutate({ file: selectedFile, vendorName: vendorName.trim() })
  }

  const handleDeleteBatch = (batchId, e) => {
    e?.stopPropagation()
    if (window.confirm('Are you sure you want to delete this import batch and all associated rate records?')) {
      deleteMutation.mutate(batchId)
    }
  }

  const batches = batchesData?.batches || []
  const vendors = vendorsData?.vendors || []

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendor Rate Import</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Import multi-tab standardized vendor rate sheets with pre-validation and isolated batch tracking.
          </p>
        </div>

        {selectedBatchId && (
          <button
            onClick={() => setSelectedBatchId(null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Batches
          </button>
        )}
      </div>

      {/* ── Detail View Mode ── */}
      {selectedBatchId ? (
        <div className="space-y-6">
          {batchDetailLoading ? (
            <div className="p-12 text-center text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading batch records...
            </div>
          ) : batchDetailData?.batch ? (
            <div className="space-y-6">
              {/* Batch Metadata Header */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                        {batchDetailData.batch.vendor_name}
                      </span>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {batchDetailData.batch.file_name}
                      </h2>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>Imported: {new Date(batchDetailData.batch.created_at).toLocaleString()}</span>
                      <span>Total Sheets: {batchDetailData.batch.total_sheets}</span>
                      <span>Total Records: {batchDetailData.batch.total_records.toLocaleString()}</span>
                      {batchDetailData.batch.imported_by_name && (
                        <span>By: {batchDetailData.batch.imported_by_name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => handleDeleteBatch(batchDetailData.batch.id, e)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-100 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Batch
                    </button>
                  </div>
                </div>
              </div>

              {/* Records Filter Toolbar */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search destination, service code, zone, locality..."
                    value={detailSearch}
                    onChange={(e) => {
                      setDetailSearch(e.target.value)
                      setDetailPage(1)
                    }}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {batchDetailData.filters?.sheets?.length > 0 && (
                  <select
                    value={detailSheetName}
                    onChange={(e) => {
                      setDetailSheetName(e.target.value)
                      setDetailPage(1)
                    }}
                    className="w-full md:w-auto px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg"
                  >
                    <option value="">All Sheets ({batchDetailData.filters.sheets.length})</option>
                    {batchDetailData.filters.sheets.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}

                {batchDetailData.filters?.service_codes?.length > 0 && (
                  <select
                    value={detailServiceCode}
                    onChange={(e) => {
                      setDetailServiceCode(e.target.value)
                      setDetailPage(1)
                    }}
                    className="w-full md:w-auto px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg"
                  >
                    <option value="">All Services ({batchDetailData.filters.service_codes.length})</option>
                    {batchDetailData.filters.service_codes.map((sc) => (
                      <option key={sc} value={sc}>{sc}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Records Table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3">Sheet / Row</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Service Code</th>
                        <th className="px-4 py-3">Destination</th>
                        <th className="px-4 py-3">Zone</th>
                        <th className="px-4 py-3">Weight</th>
                        <th className="px-4 py-3 text-right">Rate (INR)</th>
                        <th className="px-4 py-3">Transit Time</th>
                        <th className="px-4 py-3">Postcode</th>
                        <th className="px-4 py-3">Locality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                      {batchDetailData.records?.length === 0 ? (
                        <tr>
                          <td colSpan="10" className="px-4 py-8 text-center text-gray-400">
                            No records found matching filters.
                          </td>
                        </tr>
                      ) : (
                        batchDetailData.records.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2.5 text-xs font-mono text-gray-500">
                              {r.source_sheet} : #{r.source_row}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                r.record_type === 'zone' 
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              }`}>
                                {r.record_type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-medium">{r.service_code || '—'}</td>
                            <td className="px-4 py-2.5">{r.destination || '—'}</td>
                            <td className="px-4 py-2.5">{r.zone || '—'}</td>
                            <td className="px-4 py-2.5">{r.weight_bracket || '—'}</td>
                            <td className="px-4 py-2.5 text-right font-medium">
                              {r.rate_inr ? `₹${parseFloat(r.rate_inr).toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{r.transit_time || '—'}</td>
                            <td className="px-4 py-2.5 text-xs font-mono">{r.postcode_prefix || '—'}</td>
                            <td className="px-4 py-2.5 text-xs">{r.locality || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {batchDetailData.pagination && batchDetailData.pagination.totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
                    <div>
                      Showing {((detailPage - 1) * detailLimit) + 1} to{' '}
                      {Math.min(detailPage * detailLimit, batchDetailData.pagination.total)} of{' '}
                      {batchDetailData.pagination.total} records
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDetailPage(p => Math.max(1, p - 1))}
                        disabled={detailPage === 1}
                        className="p-1.5 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span>
                        Page {detailPage} of {batchDetailData.pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setDetailPage(p => Math.min(batchDetailData.pagination.totalPages, p + 1))}
                        disabled={detailPage === batchDetailData.pagination.totalPages}
                        className="p-1.5 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        /* ── Import & Batches Overview Mode ── */
        <div className="space-y-8">
          {/* ── Top Section: Upload & Pre-Validation Card ── */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Upload Vendor Rate Sheet
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Form Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Vendor / Carrier Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DHL, FEDEX, ARAMEX, PACIFIC"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-medium"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Isolated under this vendor's rate catalog.
                  </p>
                </div>

                {/* File Drop Area */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Excel File (.xlsx) *
                  </label>
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                      dragActive
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                        : selectedFile
                        ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 bg-gray-50/50 dark:bg-gray-900/40'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileSelected(e.target.files[0])
                      }}
                    />
                    <FileSpreadsheet className={`w-8 h-8 mx-auto mb-2 ${
                      selectedFile ? 'text-emerald-600' : 'text-gray-400'
                    }`} />
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Drop file here or click to browse
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Multi-sheet Excel sheets supported
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleValidate}
                    disabled={!selectedFile || !vendorName.trim() || validateMutation.isPending}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-40"
                  >
                    {validateMutation.isPending ? 'Validating...' : 'Preview & Validate'}
                  </button>

                  <button
                    onClick={handleImport}
                    disabled={!selectedFile || !vendorName.trim() || importMutation.isPending}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {importMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    Import Now
                  </button>
                </div>
              </div>

              {/* Validation Preview / Format Guide */}
              <div className="md:col-span-2 bg-gray-50 dark:bg-gray-900/60 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
                {validationResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {validationResult.is_valid ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        )}
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                          Validation Report: {validationResult.vendor_name}
                        </h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        validationResult.is_valid
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      }`}>
                        {validationResult.is_valid ? 'Ready to Import' : 'Has Errors'}
                      </span>
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-400">Total Sheets</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {validationResult.summary?.total_sheets || 0}
                        </div>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-400">Valid Records</div>
                        <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                          {validationResult.summary?.total_records || 0}
                        </div>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-400">Errors</div>
                        <div className={`text-lg font-bold ${
                          validationResult.summary?.total_errors > 0 ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {validationResult.summary?.total_errors || 0}
                        </div>
                      </div>
                    </div>

                    {/* Error list if any */}
                    {validationResult.errors?.length > 0 && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 max-h-36 overflow-y-auto space-y-1">
                        <div className="font-semibold mb-1">Errors detected:</div>
                        {validationResult.errors.map((err, i) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                    )}

                    {/* Sheets Summary */}
                    {validationResult.sheets?.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-gray-500 uppercase">
                          Sheet Breakdown
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                          {validationResult.sheets.map((s, idx) => (
                            <div key={idx} className="p-2.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs flex items-center justify-between">
                              <span className="font-medium text-gray-800 dark:text-gray-200 truncate pr-2">
                                {s.sheetName}
                              </span>
                              <span className="text-gray-500 font-mono">
                                {s.record_count} rows
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center text-xs text-gray-500 dark:text-gray-400 space-y-3">
                    <div className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                      Standardized Sheet Structure Guidelines
                    </div>
                    <p>
                      Each sheet in your workbook represents a vendor service or tariff tab. Columns are dynamically discovered by header name (case-insensitive).
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <div className="font-bold text-indigo-600">record_type</div>
                        <div className="text-[11px] text-gray-400">rate or zone</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <div className="font-bold text-indigo-600">service_code</div>
                        <div className="text-[11px] text-gray-400">e.g. DOCS, NON-DOC, EXPRESS</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <div className="font-bold text-indigo-600">destination</div>
                        <div className="text-[11px] text-gray-400">Country name or code</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <div className="font-bold text-indigo-600">rate_inr / weight_bracket</div>
                        <div className="text-[11px] text-gray-400">Pricing and slabs</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Bottom Section: Import History Batches ── */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                Import History & Batches
              </h2>

              {/* Vendor Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                >
                  <option value="">All Vendors ({batches.length} batches)</option>
                  {vendors.map((v) => (
                    <option key={v.vendor_name} value={v.vendor_name}>
                      {v.vendor_name} ({v.batch_count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {batchesLoading ? (
              <div className="p-12 text-center text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                Loading import history...
              </div>
            ) : batches.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No vendor rate batches imported yet.</p>
                <p className="text-xs mt-1">Upload a vendor workbook above to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {batches.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      setSelectedBatchId(b.id)
                      setDetailPage(1)
                      setDetailSearch('')
                    }}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
                          {b.vendor_name}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          #{b.id}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate" title={b.file_name}>
                        {b.file_name}
                      </h3>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-gray-50 dark:bg-gray-900/40 rounded">
                          <span className="text-gray-400 block text-[10px] uppercase">Sheets</span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{b.total_sheets}</span>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-900/40 rounded">
                          <span className="text-gray-400 block text-[10px] uppercase">Records</span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {b.total_records.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs text-gray-500">
                      <span className="text-[11px]">
                        {new Date(b.created_at).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedBatchId(b.id)
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition"
                          title="View Records"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteBatch(b.id, e)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition"
                          title="Delete Batch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
