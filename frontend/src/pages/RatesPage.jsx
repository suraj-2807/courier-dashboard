import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  FileSpreadsheet,
  Upload,
  Search,
  Calculator,
  Download,
  CheckCircle2,
  AlertCircle,
  Building2,
  RefreshCw,
  Globe,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
  Clock,
  MapPin,
  Check,
  X,
  FileCheck,
  Edit3,
  ExternalLink,
  ClipboardPaste
} from 'lucide-react'
import {
  getVendorsWithSheets,
  importVendorRateSheet,
  getVendorSheetDetails,
  calculateVendorRate,
  getVendorSheetDownloadUrl
} from '../api/rates.api'
import { systemSettingsApi } from '../api/systemSettings.api'
import ExcelSheetEditor from '../components/ExcelSheetEditor'

export default function RatesPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const vendorParam = searchParams.get('vendor')

  // ── States ──
  const [selectedVendorCode, setSelectedVendorCode] = useState(vendorParam || 'pacific')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importVendorTarget, setImportVendorTarget] = useState(vendorParam || 'pacific')
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  // Rate Calculator State (Inputs for C4, C5, C6, C7)
  const [calcCountry, setCalcCountry] = useState('')
  const [calcService, setCalcService] = useState('')
  const [calcWeight, setCalcWeight] = useState('1.5')
  const [calcState, setCalcState] = useState('')
  const [calcPostcode, setCalcPostcode] = useState('')
  const [calcResult, setCalcResult] = useState(null)
  const [calcError, setCalcError] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)

  // Explorer filter
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState(tabParam === 'editor' ? 'editor' : 'calculator') // 'calculator' | 'editor' | 'explorer' | 'sheets'

  // ── Queries ──
  const { data: vendorsData, isLoading: vendorsLoading, refetch: refetchVendors } = useQuery({
    queryKey: ['portal-vendors-with-sheets'],
    queryFn: getVendorsWithSheets
  })

  const vendors = vendorsData?.vendors || []

  // Auto-select first vendor if none selected
  useEffect(() => {
    if (vendors.length > 0 && !vendors.find(v => v.vendor_code === selectedVendorCode)) {
      setSelectedVendorCode(vendors[0].vendor_code)
      setImportVendorTarget(vendors[0].vendor_code)
    }
  }, [vendors, selectedVendorCode])

  const currentVendor = vendors.find(v => v.vendor_code === selectedVendorCode) || vendors[0] || null

  const { data: sheetDetailsData, isLoading: detailsLoading } = useQuery({
    queryKey: ['vendor-sheet-details', selectedVendorCode],
    queryFn: () => getVendorSheetDetails(selectedVendorCode),
    enabled: !!selectedVendorCode
  })

  const destinations = sheetDetailsData?.destinations || []
  const allServices = sheetDetailsData?.all_services || []
  const stateOptions = sheetDetailsData?.state_options || []
  const sheets = sheetDetailsData?.sheets || []
  const calculatorTemplate = sheetDetailsData?.calculator || {}
  const hasActiveSheet = !!currentVendor?.has_sheet && sheetDetailsData?.has_sheet !== false

  // ── System settings for rate sheet calculation toggle ──
  const { data: sysSettingsData } = useQuery({
    queryKey: ['system-settings'],
    queryFn: systemSettingsApi.getAll
  })
  const isRateSheetEnabled = sysSettingsData?.settings?.enable_rate_sheet_calculation !== false

  const updateSettingMutation = useMutation({
    mutationFn: systemSettingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] })
      toast.success('Rate sheet booking setting saved')
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to update setting')
    }
  })

  // Check if chosen destination is USA
  const isUSADestination = useMemo(() => {
    const c = (calcCountry || '').toLowerCase().trim()
    return c === 'united states' || c === 'usa' || c.includes('united states') || c === 'u.s.a.'
  }, [calcCountry])

  // Check if chosen destination needs state/postcode (from destination data)
  const currentDestData = useMemo(() => {
    return destinations.find(d => d.country.toLowerCase() === calcCountry.toLowerCase().trim()) || null
  }, [destinations, calcCountry])

  const requiresState = currentDestData?.requires_state || isUSADestination
  const requiresPostcode = currentDestData?.requires_postcode

  // Available services for the currently chosen country in calculator
  const servicesForSelectedCountry = useMemo(() => {
    if (!calcCountry) return allServices
    const match = destinations.find(d => d.country.toLowerCase() === calcCountry.toLowerCase().trim())
    if (match && match.services && match.services.length > 0) {
      return match.services
    }
    return allServices
  }, [destinations, calcCountry, allServices])

  const isUSASelf = isUSADestination && calcService === 'PXC-EX NY SELF'

  // Reset calculator when vendor changes
  useEffect(() => {
    setCalcCountry('')
    setCalcService('')
    setCalcState('')
    setCalcPostcode('')
    setCalcResult(null)
    setCalcError(null)
  }, [selectedVendorCode])

  // Set initial defaults from calculator template or destinations when vendor changes or data loads
  useEffect(() => {
    if (destinations.length > 0) {
      const hasCurrent = calcCountry && destinations.some(d => d.country.toLowerCase() === calcCountry.toLowerCase().trim())
      if (!calcCountry || !hasCurrent) {
        const defaultCountry = (calculatorTemplate?.c4_default && destinations.some(d => d.country.toLowerCase() === calculatorTemplate.c4_default.toLowerCase().trim()))
          ? calculatorTemplate.c4_default
          : destinations[0].country
        setCalcCountry(defaultCountry)

        const matchedDest = destinations.find(d => d.country.toLowerCase() === defaultCountry.toLowerCase().trim())
        const availServices = matchedDest?.services?.length > 0 ? matchedDest.services : allServices
        const defaultService = (calculatorTemplate?.c5_default && availServices.includes(calculatorTemplate.c5_default))
          ? calculatorTemplate.c5_default
          : (availServices[0] || '')
        setCalcService(defaultService)
      }
    }
  }, [selectedVendorCode, destinations, calculatorTemplate, allServices, calcCountry])

  // Quick destination chips — dynamic from first 8 destinations
  const quickDestinations = useMemo(() => {
    return destinations.slice(0, 8).map(d => d.country)
  }, [destinations])

  // Handlers for switching country/service
  const handleCountryChange = (countryName) => {
    setCalcCountry(countryName)
    setCalcResult(null)
    setCalcError(null)

    const match = destinations.find(d => d.country.toLowerCase() === countryName.toLowerCase().trim())
    if (match && match.services && match.services.length > 0) {
      setCalcService(match.services[0])
    }
    const isUSA = countryName.toLowerCase() === 'united states' || countryName.toLowerCase() === 'usa' || countryName.toLowerCase().includes('united states')
    if (isUSA && !calcState) {
      setCalcState('NY')
    }
  }

  const handleServiceChange = (serviceName) => {
    setCalcService(serviceName)
    setCalcResult(null)
    setCalcError(null)
    if (isUSADestination && serviceName === 'PXC-EX NY SELF' && !calcState) {
      setCalcState('NY')
    }
  }

  // ── Calculate Handler (C4, C5, C6, C7 ➔ C10) ──
  const runCalculation = async () => {
    if (!calcCountry) {
      toast.error('Please select a destination country')
      return
    }
    const weightNum = parseFloat(calcWeight)
    if (!calcWeight || isNaN(weightNum) || weightNum <= 0) {
      toast.error('Please enter a valid weight in kg')
      return
    }

    if (isUSASelf && !calcState) {
      const msg = 'Please select a US State for PXC-EX NY SELF service.'
      setCalcError(msg)
      toast.error(msg)
      return
    }

    if (isUSASelf && weightNum > 21.5) {
      const msg = `Shipment weight (${weightNum} kg) exceeds maximum permissible weight of 21.5 kg for USA PXC-EX NY SELF.`
      setCalcError(msg)
      setCalcResult(null)
      toast.error(msg)
      return
    }

    setCalcLoading(true)
    setCalcError(null)
    try {
      const res = await calculateVendorRate({
        vendor_code: selectedVendorCode,
        country: calcCountry,
        service_code: calcService,
        weight: weightNum,
        state: calcState,
        postcode: calcPostcode
      })
      if (res && res.success) {
        setCalcResult(res)
        setCalcError(null)
      } else {
        setCalcResult(null)
        setCalcError(res?.message || 'Rate calculation failed')
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to calculate rate from sheet'
      setCalcError(msg)
      setCalcResult(null)
      toast.error(msg)
    } finally {
      setCalcLoading(false)
    }
  }

  // Auto-calculate on initial load or parameter change
  useEffect(() => {
    if (selectedVendorCode && calcCountry && calcWeight) {
      if (isUSASelf && !calcState) return
      runCalculation()
    }
  }, [selectedVendorCode, calcCountry, calcService, calcWeight, calcState, calcPostcode])

  // ── Import Mutation ──
  const importMutation = useMutation({
    mutationFn: ({ vendorCode, file }) => {
      const targetVendor = vendors.find(v => v.vendor_code === vendorCode)
      return importVendorRateSheet(vendorCode, file, targetVendor?.name || vendorCode)
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Vendor rate sheet imported successfully!')
      setShowImportModal(false)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      refetchVendors()
      queryClient.invalidateQueries({ queryKey: ['portal-vendors-with-sheets'] })
      queryClient.invalidateQueries({ queryKey: ['vendor-sheet-details', importVendorTarget] })
      setSelectedVendorCode(importVendorTarget)
      setCalcCountry('')
      setCalcService('')
      setCalcResult(null)
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || err.message || 'Import failed')
    }
  })

  const handleFileDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file && /\.xlsx$/i.test(file.name)) {
      setSelectedFile(file)
    } else {
      toast.error('Please drop an Excel .xlsx rate sheet file')
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!/\.xlsx$/i.test(file.name)) {
        toast.error('Please select an Excel .xlsx rate sheet file')
        return
      }
      setSelectedFile(file)
    }
  }

  // Filtered destinations for explorer tab
  const filteredDestinations = useMemo(() => {
    if (!searchQuery) return destinations
    const q = searchQuery.toLowerCase().trim()
    return destinations.filter(d =>
      d.country.toLowerCase().includes(q) ||
      d.services.some(s => s.toLowerCase().includes(q))
    )
  }, [destinations, searchQuery])

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                Vendor Rate Sheets & Rate Calculator
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Excel Driven • No DB Storage
                </span>
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Inputs placed directly into Sheet 1 Rate Calculator (C4 Country, C5 Service, C6 Weight, C7 Postcode) ➔ Result fetched from C10
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs shadow-md shadow-red-600/20 hover:from-red-700 hover:to-rose-700 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Import New Vendor Rate Sheet
          </button>
          {selectedVendorCode && (
            <>
              <a
                href={`/rates/editor?vendor=${selectedVendorCode}&name=${encodeURIComponent(currentVendor?.name || selectedVendorCode)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer shadow-sm shadow-blue-600/20"
                title="Open and edit active Excel rate sheet in a new browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Sheet in New Tab ↗
              </a>
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer shadow-sm"
                title="Open and edit active Excel rate sheet in the browser"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                Edit in Browser
              </button>
              <a
                href={getVendorSheetDownloadUrl(selectedVendorCode)}
                download
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer shadow-sm"
                title="Download active Excel rate sheet"
              >
                <Download className="w-3.5 h-3.5 text-gray-500" />
                Download .xlsx
              </a>
            </>
          )}
        </div>
      </div>

      {/* ── Rate Sheet Booking Integration Toggle ── */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl mt-0.5 ${
            isRateSheetEnabled ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-900">
                Rate Sheet Calculation in New Booking Form
              </h3>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                isRateSheetEnabled
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-300'
              }`}>
                {isRateSheetEnabled ? 'FEATURE ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              {isRateSheetEnabled
                ? 'Active: The "Take rate from rate sheet" option is available in the New Booking form. By default, bookings use standard rates; checking the box evaluates rates directly from the vendor Excel sheet (C4 ➔ C10).'
                : 'Disabled: The rate sheet checkbox is completely hidden in the New Booking form. All bookings will strictly use standard rates.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isRateSheetEnabled}
              disabled={updateSettingMutation.isPending}
              onChange={(e) => {
                const val = e.target.checked
                updateSettingMutation.mutate({
                  key: 'enable_rate_sheet_calculation',
                  value: val
                })
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
          <span className="text-xs font-extrabold text-gray-800 min-w-[55px]">
            {updateSettingMutation.isPending ? 'Saving...' : isRateSheetEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* ── Vendor Selection Ribbon ── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              Portal Vendor:
            </label>
            <select
              value={selectedVendorCode}
              onChange={(e) => setSelectedVendorCode(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition cursor-pointer min-w-[200px]"
            >
              {vendors.map((v) => (
                <option key={v.vendor_code} value={v.vendor_code}>
                  {v.name} ({v.vendor_code.toUpperCase()}) {v.has_sheet ? '• Sheet Ready' : '• No Sheet'}
                </option>
              ))}
            </select>
          </div>

          {/* Quick stats for selected vendor */}
          {currentVendor && (
            <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
              <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                <FileCheck className={`w-3.5 h-3.5 ${hasActiveSheet ? 'text-emerald-600' : 'text-gray-400'}`} />
                Sheet: <strong className="text-gray-900">{hasActiveSheet ? (currentVendor.sheet_filename || `${selectedVendorCode}.xlsx`) : 'No Sheet (Blank)'}</strong>
              </span>
              <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                <Globe className={`w-3.5 h-3.5 ${hasActiveSheet ? 'text-blue-600' : 'text-gray-400'}`} />
                Destinations: <strong className="text-gray-900">{hasActiveSheet ? destinations.length : 0}</strong>
              </span>
              <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                <Layers className={`w-3.5 h-3.5 ${hasActiveSheet ? 'text-purple-600' : 'text-gray-400'}`} />
                Workbook Tabs: <strong className="text-gray-900">{hasActiveSheet ? sheets.length : 0}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab('calculator')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'calculator'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          First Tab: Rate Calculator (C4 ➔ C10)
        </button>
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'editor'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5 text-blue-500" />
          In-Browser Sheet Editor
          {currentVendor?.has_sheet && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
              Live
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('explorer')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'explorer'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Destinations & Services ({destinations.length})
        </button>
        <button
          onClick={() => setActiveTab('sheets')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'sheets'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Workbook Tabs ({sheets.length})
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB 1: RATE CALCULATOR (Replicating First Tab)                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'calculator' && (
        !hasActiveSheet ? (
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto shadow-xs">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-base font-extrabold text-gray-900">
                No Rate Sheet Uploaded for {currentVendor?.name || selectedVendorCode.toUpperCase()}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                This vendor currently does not have an Excel rate sheet file. You can import an Excel (.xlsx) file, or open the in-browser spreadsheet editor to paste your rate table directly from Excel.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setImportVendorTarget(selectedVendorCode)
                  setShowImportModal(true)
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Import Rate Sheet (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <ClipboardPaste className="w-4 h-4" />
                Open Blank Sheet & Paste Table
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Inputs Card (C4, C5, C6, C7) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h2 className="text-sm font-bold text-gray-900">
                    Excel Rate Sheet Input Parameters
                  </h2>
                </div>
              <span className="text-[11px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                Tab: {calculatorTemplate.sheet_name || 'Rate Calculator'}
              </span>
            </div>

            {/* Cell Mapping Note */}
            <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Cell Mapping Protocol (Dynamic Formula-Driven):</strong> Destination country is written to <code>{calculatorTemplate.dest_input_cell || 'C4'}</code>, Service Code to <code>{calculatorTemplate.service_input_cell || 'C5'}</code>, Weight to <code>{calculatorTemplate.weight_input_cell || 'C6'}</code>, Postcode/State to <code>{calculatorTemplate.postcode_input_cell || 'C7'}</code>. Excel formulas are evaluated and the calculated vendor rate is fetched from <code>{calculatorTemplate.rate_output_cell || 'C10'}</code>.
              </div>
            </div>

            <div className="space-y-4 pt-1">
              {/* Destination Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px] font-extrabold border">
                      {calculatorTemplate.dest_label_cell || 'B4'}
                    </span>
                    {calculatorTemplate.dest_label || calculatorTemplate.b4_label || 'Country / Destination'} (Input ➔ {calculatorTemplate.dest_input_cell || 'C4'})
                  </label>
                  <span className="text-[11px] text-gray-400 font-medium">Valid tariff destination</span>
                </div>
                <select
                  value={calcCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition cursor-pointer"
                >
                  <option value="">-- Select Destination Country --</option>
                  {destinations.map(d => (
                    <option key={d.country} value={d.country}>
                      {d.country} {d.services?.length ? `(${d.services.join(', ')})` : ''}
                    </option>
                  ))}
                </select>

                {/* Quick destination chips - dynamic from vendor's data */}
                {quickDestinations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {quickDestinations.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleCountryChange(c)}
                      className={`text-[10px] px-2.5 py-0.5 rounded-md border transition cursor-pointer font-medium ${
                        calcCountry.toLowerCase() === c.toLowerCase()
                          ? 'bg-red-50 text-red-700 border-red-300 font-bold shadow-xs'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                )}
              </div>

              {/* Service Code Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px] font-extrabold border">
                      {calculatorTemplate.service_label_cell || 'B5'}
                    </span>
                    {calculatorTemplate.service_label || calculatorTemplate.b5_label || 'Service Code'} (Input ➔ {calculatorTemplate.service_input_cell || 'C5'})
                  </label>
                  <span className="text-[11px] text-emerald-600 font-semibold">
                    {servicesForSelectedCountry.length} supported for {calcCountry || 'destination'}
                  </span>
                </div>
                <select
                  value={calcService}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition cursor-pointer"
                >
                  {servicesForSelectedCountry.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  {servicesForSelectedCountry.length === 0 && (
                    <option value="PXC-SELF">PXC-SELF (Default Standard)</option>
                  )}
                </select>
              </div>

              {/* USA State Dropdown for PXC-EX NY SELF */}
              {isUSASelf && (
                <div className="bg-amber-50/60 border border-amber-300/80 rounded-xl p-3.5 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-mono text-[10px] font-extrabold border border-amber-300">
                        USA State
                      </span>
                      US Destination State (Required for Zone 2–8 Tariff)
                    </label>
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                      Max: 21.5 kg
                    </span>
                  </div>
                  <select
                    value={calcState}
                    onChange={(e) => {
                      setCalcState(e.target.value)
                      setCalcResult(null)
                    }}
                    className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 transition cursor-pointer"
                  >
                    <option value="">-- Select Destination US State --</option>
                    {stateOptions.map(st => (
                      <option key={st.code} value={st.code}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                  {calcState && (
                    <div className="flex items-center gap-2 text-xs pt-1">
                      <span className="text-amber-800 font-medium">Resolved State Zone:</span>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold text-[11px] border border-blue-200">
                        {stateOptions.find(s => s.code === calcState)?.zone || 'Zone'}
                      </span>
                      <span className="text-gray-500 text-[11px]">
                        (e.g. 1kg in CT = ₹2,345 | 1kg in CA = ₹2,445)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Weight in kg */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px] font-extrabold border">
                      {calculatorTemplate.weight_label_cell || 'B6'}
                    </span>
                    {calculatorTemplate.weight_label || calculatorTemplate.b6_label || 'Weight (kg)'} (Input ➔ {calculatorTemplate.weight_input_cell || 'C6'})
                  </label>
                  <div className="flex items-center gap-2">
                    {isUSASelf && (
                      <span className="text-[11px] font-bold text-amber-700">Limit: 21.5 kg</span>
                    )}
                    <span className="text-[11px] text-gray-400">Kilograms</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(e.target.value)}
                    placeholder="1.0"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
                  />
                  <div className="flex gap-1 shrink-0">
                    {['0.5', '1', '2.5', '5', '10', '21.5'].map(w => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setCalcWeight(w)}
                        className={`text-[10px] px-2 py-1.5 rounded-lg border font-bold transition cursor-pointer ${
                          calcWeight === w
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {w}kg
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Postcode / State */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px] font-extrabold border">
                      {calculatorTemplate.postcode_label_cell || 'B7'}
                    </span>
                    {calculatorTemplate.postcode_label || calculatorTemplate.b7_label || 'Postcode / State'} (Input ➔ {calculatorTemplate.postcode_input_cell || 'C7'})
                  </label>
                  <span className="text-[11px] text-gray-400">Zone / remote check</span>
                </div>
                <input
                  type="text"
                  value={calcPostcode}
                  onChange={(e) => setCalcPostcode(e.target.value)}
                  placeholder="e.g. 2000 (Aus), M5V 2T6 (Canada), SW1A 1AA (UK)..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
                />
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={runCalculation}
                  disabled={calcLoading}
                  className="w-full py-3 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${calcLoading ? 'animate-spin' : ''}`} />
                  {calcLoading ? 'Evaluating Excel Sheet...' : `Evaluate & Fetch Rate from ${calculatorTemplate.rate_output_cell || 'C10'}`}
                </button>
              </div>
            </div>
          </div>

          {/* Output Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-gradient-to-br from-gray-950 via-slate-900 to-gray-900 text-white rounded-2xl p-6 shadow-xl border border-gray-800 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="text-[11px] uppercase font-mono tracking-wider font-bold text-rose-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Excel Output Result (Cell {calculatorTemplate.rate_output_cell || 'C10'})
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LIVE FETCH
                </span>
              </div>

              {/* Validation / Error banner if any */}
              {calcError && (
                <div className="bg-rose-500/15 border border-rose-500/40 rounded-xl p-3.5 text-xs text-rose-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    Validation Notice:
                  </div>
                  <div className="text-[11px] leading-relaxed text-rose-300/90 pl-6">
                    {calcError}
                  </div>
                </div>
              )}

              {/* Main Output Rate */}
              <div>
                <span className="text-xs font-medium text-gray-400 block mb-1">
                  {calculatorTemplate.rate_label || calculatorTemplate.b10_label || 'Calculated Vendor Rate'} [{calculatorTemplate.rate_output_cell || 'C10'}]
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white tracking-tight">
                    ₹{calcResult?.vendor_rate ? calcResult.vendor_rate.toLocaleString('en-IN') : '0.00'}
                  </span>
                  <span className="text-xs font-bold text-gray-400">INR</span>
                </div>
                {calcResult?.rate_per_kg && (
                  <span className="text-xs text-rose-300 font-semibold block mt-1">
                    (Tier Rate: ₹{calcResult.rate_per_kg}/kg)
                  </span>
                )}
              </div>

              {/* Pricing Badges: Zone, Method, Matched Band */}
              {calcResult && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {calcResult.zone && (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-extrabold border border-blue-500/30">
                      {calcResult.zone}
                    </span>
                  )}
                  {calcResult.matched_band && (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-extrabold border border-purple-500/30">
                      Band: {calcResult.matched_band}
                    </span>
                  )}
                  {calcResult.pricing_method && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                      Method: {calcResult.pricing_method}
                    </span>
                  )}
                </div>
              )}

              {/* C9, C11, C12 Outputs */}
              <div className="space-y-3 pt-3 border-t border-gray-800/80 text-xs">
                {/* C9: Matched Service */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-gray-400 font-mono text-[11px]">B9 Matched Service [C9]:</span>
                  <span className="font-bold text-gray-200 text-right">
                    {calcResult?.matched_service || calcResult?.service_code || calcService}
                  </span>
                </div>

                {/* C11: Rate Basis */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-gray-400 font-mono text-[11px]">B11 Rate Basis [C11]:</span>
                  <span className="font-semibold text-emerald-300 text-right text-[11px]">
                    {calcResult?.rate_basis || (calcError ? 'N/A' : 'Pending evaluation')}
                  </span>
                </div>

                {/* C12: Source Row */}
                {calcResult?.source_row && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-gray-400 font-mono text-[11px]">B12 Source Row [C12]:</span>
                    <span className="font-mono font-bold text-gray-300">
                      Row #{calcResult.source_row} ({calcResult.source_sheet || 'Self Network'})
                    </span>
                  </div>
                )}

                {/* Transit time if found */}
                {calcResult?.transit_time && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-gray-400 font-mono text-[11px]">Transit Time:</span>
                    <span className="font-semibold text-amber-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      {calcResult.transit_time}
                    </span>
                  </div>
                )}
              </div>

              {/* Input echo */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-[11px] font-mono text-gray-300 space-y-1">
                <div className="text-gray-400 font-bold uppercase text-[10px] tracking-wider mb-1">
                  Parameters Sent to Excel Sheet:
                </div>
                <div>C4 (Country) = <strong className="text-white">{calcResult?.country || calcCountry}</strong></div>
                <div>C5 (Service) = <strong className="text-white">{calcResult?.service_code || calcService}</strong></div>
                <div>C6 (Weight) = <strong className="text-white">{calcWeight} kg</strong></div>
                {(calcState || calcPostcode) && (
                  <div>C7 (State / Postcode) = <strong className="text-white">{calcState || calcPostcode}</strong></div>
                )}
              </div>
            </div>

            {/* Quick Helper Guide */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-xs text-gray-600 space-y-2">
              <strong className="text-gray-900 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                How Rates Are Handled in Bookings:
              </strong>
              <p className="leading-relaxed">
                When you create a booking on the <strong>New Booking</strong> page, tick the checkbox <strong>"Take rate from rate sheet"</strong>. The booking will automatically query this Excel engine with your destination and weight, and enter the shipping charge into the docket!
              </p>
            </div>
          </div>
        </div>
        )
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB 2: DESTINATIONS & SERVICES EXPLORER                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'explorer' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Destinations & Services in Sheet ({destinations.length})
              </h3>
              <p className="text-xs text-gray-500">
                Loaded directly from active vendor workbook ({hasActiveSheet ? (currentVendor?.sheet_filename || `${selectedVendorCode}.xlsx`) : 'No Sheet (Blank)'})
              </p>
            </div>
            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search countries or services..."
                className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-9 pr-3.5 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px] border border-gray-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-gray-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3.5 w-12 text-center">#</th>
                  <th className="py-2.5 px-3.5">Destination Country / Territory</th>
                  <th className="py-2.5 px-3.5">Available Service Codes</th>
                  <th className="py-2.5 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredDestinations.map((d, idx) => (
                  <tr key={d.country} className="hover:bg-gray-50/80 transition">
                    <td className="py-2.5 px-3.5 text-center font-mono text-gray-400 text-[11px]">{idx + 1}</td>
                    <td className="py-2.5 px-3.5 font-bold text-gray-900 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      {d.country}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="flex flex-wrap gap-1">
                        {d.services.map(s => (
                          <span key={s} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px] font-bold border border-gray-200">
                            {s}
                          </span>
                        ))}
                        {d.services.length === 0 && (
                          <span className="text-gray-400 italic text-[11px]">Standard Self Network</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() => {
                          setCalcCountry(d.country)
                          if (d.services.length > 0) setCalcService(d.services[0])
                          setActiveTab('calculator')
                        }}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                      >
                        Calculate Rate ➔
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDestinations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400 text-xs">
                      No matching destinations found for "{searchQuery}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB 3: WORKBOOK SHEETS OVERVIEW                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'sheets' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Excel Workbook Tabs ({sheets.length})
            </h3>
            <p className="text-xs text-gray-500">
              Worksheets present in the active vendor file ({hasActiveSheet ? (currentVendor?.sheet_filename || `${selectedVendorCode}.xlsx`) : 'No Sheet (Blank)'})
            </p>
          </div>

          {sheets.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs">
              No workbook tabs found for this vendor. Open the in-browser sheet editor to paste your rate table or import an Excel file.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sheets.map((sheetName, idx) => (
              <div
                key={sheetName}
                className={`p-4 rounded-xl border transition ${
                  idx === 0
                    ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                    : 'bg-gray-50/60 border-gray-200 text-gray-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border text-gray-600">
                    Tab #{idx + 1}
                  </span>
                  {idx === 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-600 text-white">
                      Primary Rate Calculator
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-extrabold truncate">{sheetName}</h4>
                <p className="text-[11px] text-gray-500 mt-1">
                  {idx === 0
                    ? 'Active calculator tab: C4 (Country), C5 (Service), C6 (Weight), C7 (Postcode) ➔ C10 Rate'
                    : sheetName.toLowerCase().includes('zone')
                    ? 'Zone mapping table for destination postcodes'
                    : sheetName.toLowerCase().includes('remote')
                    ? 'Remote area delivery surcharge reference list'
                    : 'Tariff rate schedule matrix'}
                </p>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: IN-BROWSER EXCEL SPREADSHEET EDITOR                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'editor' && (
        <ExcelSheetEditor
          vendorCode={selectedVendorCode}
          vendorName={currentVendor?.name || selectedVendorCode.toUpperCase()}
          onSaved={() => {
            refetchVendors()
            queryClient.invalidateQueries({ queryKey: ['vendor-sheet-details', selectedVendorCode] })
            queryClient.invalidateQueries({ queryKey: ['vendor-workbook-data', selectedVendorCode] })
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: IMPORT NEW VENDOR RATE SHEET                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  Import New Vendor Rate Sheet
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setSelectedFile(null)
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vendor Selector */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                Select Vendor Available on Portal:
              </label>
              <select
                value={importVendorTarget}
                onChange={(e) => setImportVendorTarget(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition cursor-pointer"
              >
                {vendors.map((v) => (
                  <option key={v.vendor_code} value={v.vendor_code}>
                    {v.name} ({v.vendor_code.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* File Drag and Drop */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                Excel Rate Sheet (.xlsx):
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                  dragActive
                    ? 'border-red-500 bg-red-50/50'
                    : selectedFile
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="space-y-1">
                    <FileCheck className="w-8 h-8 text-emerald-600 mx-auto" />
                    <p className="text-xs font-bold text-emerald-900">{selectedFile.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click to change
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-xs font-bold text-gray-800">
                        Drag and drop your vendor rate sheet here
                      </p>
                      <p className="text-[11px] text-gray-500">or click to browse (.xlsx only)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Note about first tab structure */}
            <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-3 text-xs text-blue-900 space-y-1">
              <strong className="font-bold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                Sheet Structure Requirement:
              </strong>
              <p className="text-[11px] leading-relaxed text-blue-800">
                The imported rate sheet must contain a first tab (e.g. <code>Rate Calculator</code>) where:
                <br />
                • <strong>B4:</strong> Country / Destination (Input into <strong>C4</strong>)
                <br />
                • <strong>B5:</strong> Service Code (Input into <strong>C5</strong>)
                <br />
                • <strong>B6:</strong> Weight in kg (Input into <strong>C6</strong>)
                <br />
                • <strong>B7:</strong> Postcode (Input into <strong>C7</strong>)
                <br />
                • <strong>B10:</strong> Calculated Vendor Rate (Fetched from <strong>C10</strong>)
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false)
                  setSelectedFile(null)
                }}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedFile || importMutation.isPending}
                onClick={() => {
                  if (selectedFile) {
                    importMutation.mutate({ vendorCode: importVendorTarget, file: selectedFile })
                  }
                }}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 disabled:opacity-50 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {importMutation.isPending ? 'Importing...' : 'Confirm & Activate Rate Sheet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
