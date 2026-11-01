import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Terminal,
  Calculator,
  Search,
  Code2,
  Copy,
  Check,
  Send,
  Sparkles,
  Layers,
  Globe,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Table2,
  ExternalLink,
  Key,
  ShieldCheck,
  Zap,
  ArrowRight,
  ChevronRight,
  Database,
  Building2,
  Package
} from 'lucide-react'
import {
  RATES_API_KEY,
  RATES_API_BASE_URL,
  getVendors,
  getVendorCountries,
  getVendorServices,
  resolveVendorZone,
  getWorksheets,
  queryRateRecords,
  calculateVendorRate,
  executeSandboxQuery
} from '../api/rates.api'

// Quick Presets directly from Prince Express API Specification
const QUICK_PRESETS = [
  {
    id: 'calculate-pacific-usa',
    name: 'Calculate Rate (Pacific USA)',
    method: 'GET',
    url: 'https://rates.princeexp.com/api/calculate.php?vendor=pacific&country=USA&service_code=PXC-EX%20NY%20SELF&weight_kg=1&postcode=10001',
    description: 'Calculates shipping rate with zone resolution & weight slabs'
  },
  {
    id: 'calculate-pacific-germany',
    name: 'Calculate Rate (Pacific Germany)',
    method: 'GET',
    url: 'https://rates.princeexp.com/api/calculate.php?vendor=pacific&country=Germany&service_code=PXC-LHR-DDP&weight_kg=26',
    description: 'Heavy shipment rate calculation with per-kg slab breakdown'
  },
  {
    id: 'filter-services',
    name: 'Filter Services by Country',
    method: 'GET',
    url: 'https://rates.princeexp.com/api/services.php?vendor=pacific&country=Germany',
    description: 'Returns available service codes for dynamic dependent dropdowns'
  },
  {
    id: 'list-countries',
    name: 'List Countries',
    method: 'GET',
    url: 'https://rates.princeexp.com/api/countries.php?vendor=pacific',
    description: 'Returns all 190+ destination countries for a vendor workbook'
  },
  {
    id: 'rate-lookup',
    name: 'Rate Lookup (Legacy)',
    method: 'GET',
    url: 'https://rates.princeexp.com/api/rates.php?vendor=pacific&country=Germany&limit=10',
    description: 'Query raw rate records and tariffs'
  },
  {
    id: 'list-vendors',
    name: 'List Vendors',
    method: 'GET',
    url: 'https://rates.princeexp.com/api/vendors.php',
    description: 'Returns active vendors, row counts, and batch versions'
  },
  {
    id: 'list-worksheets',
    name: 'List Worksheets',
    method: 'GET',
    url: 'https://rates.princeexp.com/api/sheets.php?vendor=pacific',
    description: 'Returns worksheet metadata (regular, zonewise, zones) & headers'
  },
  {
    id: 'lookup-zone',
    name: 'Lookup Zone',
    method: 'GET',
    url: 'https://rates.princeexp.com/api/zones.php?vendor=pacific&country=USA&postcode=10001',
    description: 'Resolves destination postcode to shipping zone and city'
  }
]

export default function RatesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'sandbox'
  const [activeTab, setActiveTab] = useState(initialTab) // 'sandbox' | 'calculator' | 'explorer' | 'sheets' | 'docs'

  // Sync tab with URL
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // ── Copied State ──
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedResponse, setCopiedResponse] = useState(false)

  const copyToClipboard = (text, type = 'key') => {
    navigator.clipboard.writeText(text)
    if (type === 'key') {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } else {
      setCopiedResponse(true)
      setTimeout(() => setCopiedResponse(false), 2000)
    }
    toast.success('Copied to clipboard!')
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TAB 1: LIVE API CONSOLE / SANDBOX STATE
  // ═══════════════════════════════════════════════════════════════════════
  const [sandboxMethod, setSandboxMethod] = useState('GET')
  const [sandboxUrl, setSandboxUrl] = useState(QUICK_PRESETS[0].url)
  const [sandboxLoading, setSandboxLoading] = useState(false)
  const [sandboxResponse, setSandboxResponse] = useState(null)
  const [sandboxStatus, setSandboxStatus] = useState(null)
  const [sandboxLatency, setSandboxLatency] = useState(null)
  const [sandboxError, setSandboxError] = useState(null)
  const [responseViewMode, setResponseViewMode] = useState('visual') // 'visual' | 'json'

  // Apply a quick preset
  const handleApplyPreset = (preset) => {
    setSandboxMethod(preset.method)
    setSandboxUrl(preset.url)
    toast.success(`Loaded preset: ${preset.name}`)
  }

  // Send request in Sandbox
  const handleSendSandboxRequest = async () => {
    if (!sandboxUrl) {
      toast.error('Please enter an endpoint URL')
      return
    }

    setSandboxLoading(true)
    setSandboxError(null)
    setSandboxResponse(null)
    setSandboxStatus(null)

    const startTime = Date.now()
    try {
      const res = await executeSandboxQuery({
        method: sandboxMethod,
        url: sandboxUrl
      })

      const latency = res.latencyMs || (Date.now() - startTime)
      setSandboxLatency(latency)
      setSandboxStatus(res.statusCode || 200)
      setSandboxResponse(res.data)

      if (res.statusCode >= 400 || (res.data && res.data.ok === false && res.data.success === false)) {
        setSandboxError(res.data?.error || res.data?.message || `Request returned status ${res.statusCode}`)
      } else {
        toast.success(`200 OK (${latency}ms)`)
      }
    } catch (err) {
      const latency = Date.now() - startTime
      setSandboxLatency(latency)
      setSandboxStatus(err.response?.status || 500)
      const data = err.response?.data || { error: err.message }
      setSandboxResponse(data)
      setSandboxError(data.error || data.message || err.message)
      toast.error(err.message || 'Request failed')
    } finally {
      setSandboxLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TAB 2: INTERACTIVE RATE CALCULATOR STATE
  // ═══════════════════════════════════════════════════════════════════════
  const [calcVendor, setCalcVendor] = useState('pacific')
  const [calcCountry, setCalcCountry] = useState('Germany')
  const [calcService, setCalcService] = useState('PXC-LHR-DDP')
  const [calcWeight, setCalcWeight] = useState('26')
  const [calcPostcode, setCalcPostcode] = useState('')
  const [calcResult, setCalcResult] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState(null)

  // Fetch vendors
  const { data: vendorsData } = useQuery({
    queryKey: ['portal-vendors'],
    queryFn: getVendors
  })
  const vendors = vendorsData?.vendors || [{ name: 'Pacific Express', slug: 'pacific', vendor_code: 'pacific' }]

  // Fetch countries for selected vendor
  const { data: countriesData } = useQuery({
    queryKey: ['vendor-countries', calcVendor],
    queryFn: () => getVendorCountries(calcVendor),
    enabled: !!calcVendor
  })
  const availableCountries = countriesData?.countries || []

  // Fetch services for vendor & country
  const { data: servicesData } = useQuery({
    queryKey: ['vendor-services', calcVendor, calcCountry],
    queryFn: () => getVendorServices(calcVendor, calcCountry),
    enabled: !!calcVendor && !!calcCountry
  })
  const availableServices = servicesData?.services || []

  // Auto-select first service when services update
  useEffect(() => {
    if (availableServices.length > 0 && !availableServices.find(s => s.service_code === calcService)) {
      setCalcService(availableServices[0].service_code)
    }
  }, [availableServices, calcService])

  // Run Calculator
  const handleCalculateRate = async (e) => {
    if (e) e.preventDefault()
    if (!calcCountry) {
      toast.error('Destination country is required')
      return
    }
    if (!calcWeight || parseFloat(calcWeight) <= 0) {
      toast.error('Valid shipment weight (kg) is required')
      return
    }

    setCalcLoading(true)
    setCalcError(null)
    try {
      const res = await calculateVendorRate({
        vendor: calcVendor,
        country: calcCountry,
        service_code: calcService,
        weight_kg: parseFloat(calcWeight),
        postcode: calcPostcode
      })

      if (res && (res.success || res.ok)) {
        setCalcResult(res)
        toast.success(`Calculated Rate: ₹${res.final_rate || res.vendor_rate}`)
      } else {
        setCalcResult(null)
        setCalcError(res?.message || res?.error || 'Rate could not be calculated')
        toast.error(res?.message || res?.error || 'Rate calculation failed')
      }
    } catch (err) {
      setCalcResult(null)
      const msg = err.response?.data?.message || err.response?.data?.error || err.message
      setCalcError(msg)
      toast.error(msg)
    } finally {
      setCalcLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TAB 3: RATE RECORDS / EXPLORER STATE
  // ═══════════════════════════════════════════════════════════════════════
  const [explorerCountry, setExplorerCountry] = useState('')
  const [explorerService, setExplorerService] = useState('')
  const [explorerLimit, setExplorerLimit] = useState(25)

  const { data: explorerData, isLoading: explorerLoading, refetch: refetchExplorer } = useQuery({
    queryKey: ['rate-records', calcVendor, explorerCountry, explorerService, explorerLimit],
    queryFn: () => queryRateRecords({
      vendor: calcVendor,
      country: explorerCountry || undefined,
      service_code: explorerService || undefined,
      limit: explorerLimit
    }),
    enabled: activeTab === 'explorer'
  })

  const rateRecords = explorerData?.rates || []

  // ═══════════════════════════════════════════════════════════════════════
  // TAB 4: WORKSHEETS METADATA
  // ═══════════════════════════════════════════════════════════════════════
  const { data: sheetsData, isLoading: sheetsLoading } = useQuery({
    queryKey: ['worksheets-metadata', calcVendor],
    queryFn: () => getWorksheets(calcVendor),
    enabled: activeTab === 'sheets'
  })
  const worksheets = sheetsData?.worksheets || []

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ── HEADER BANNER ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-700/50">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-red-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Rates API v2.0 • Live
              </span>
              <span className="text-gray-400 text-xs font-medium">Prince Express Rates Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Zap className="w-7 h-7 text-red-500 shrink-0" />
              Rates API & Live Sandbox
            </h1>
            <p className="text-gray-300 text-sm max-w-2xl leading-relaxed">
              Dynamically calculate shipping tariffs with itemized arithmetic, zone resolution, and incremental weight tiers.
              All rates are evaluated live via <code className="text-red-300 font-mono text-xs">rates.princeexp.com</code>.
            </p>
          </div>

          {/* API Key Box */}
          <div className="bg-gray-800/80 backdrop-blur-md border border-gray-700/80 rounded-2xl p-4 w-full sm:w-auto min-w-[320px] shadow-lg">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5 font-medium">
              <span className="flex items-center gap-1.5 text-gray-200 font-semibold">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                API Key
              </span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Authenticated
              </span>
            </div>
            <div className="flex items-center gap-2 bg-gray-950/70 border border-gray-700/60 rounded-xl px-3 py-2 font-mono text-xs text-gray-200">
              <span className="truncate max-w-[210px] select-all">{RATES_API_KEY}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(RATES_API_KEY, 'key')}
                className="ml-auto p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
                title="Copy API Key"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-700/50">
              <span>Endpoint:</span>
              <span className="font-mono text-gray-300">rates.princeexp.com/api</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 pt-4 border-t border-gray-700/60 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleTabChange('sandbox')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'sandbox'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Live API Console / Sandbox
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('calculator')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4" />
            Interactive Rate Calculator
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('explorer')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'explorer'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Table2 className="w-4 h-4" />
            Rate Records / Explorer
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('sheets')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'sheets'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            Worksheets Schema
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('docs')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Endpoints Reference
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: LIVE API CONSOLE / SANDBOX                                    */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sandbox' && (
        <div className="space-y-6">
          {/* Preset Buttons */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-red-600" />
                Quick Presets
              </span>
              <span className="text-xs text-gray-400">Click a preset to load into the live console</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_PRESETS.map((preset) => {
                const isActive = sandboxUrl === preset.url
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? 'bg-red-50 text-red-700 border-red-300 shadow-xs'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 font-bold">
                      {preset.method}
                    </span>
                    <span>{preset.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Request Query Bar */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-red-600" />
                Live Query Request
              </div>
              <span className="text-xs text-gray-500 font-mono">
                Header: <code className="text-red-600 font-bold">X-API-Key</code> auto-injected
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              {/* Method Selector */}
              <div className="w-full sm:w-28 shrink-0">
                <select
                  value={sandboxMethod}
                  onChange={(e) => setSandboxMethod(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>

              {/* Endpoint URL Input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={sandboxUrl}
                  onChange={(e) => setSandboxUrl(e.target.value)}
                  placeholder="https://rates.princeexp.com/api/calculate.php?..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-mono text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSendSandboxRequest}
                disabled={sandboxLoading}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm shadow-red-600/30 cursor-pointer disabled:opacity-50"
              >
                {sandboxLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Request
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── RESPONSE PANEL ── */}
          <div className="bg-gray-900 text-gray-100 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
            {/* Response Top Bar */}
            <div className="px-5 py-3.5 bg-gray-950/80 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Response Output</span>
                {sandboxStatus && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                      sandboxStatus >= 200 && sandboxStatus < 300
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : sandboxStatus >= 400 && sandboxStatus < 500
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {sandboxStatus} {sandboxStatus === 200 ? 'OK' : sandboxStatus === 422 ? 'Unprocessable' : ''}
                  </span>
                )}
                {sandboxLatency !== null && (
                  <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    {sandboxLatency} ms
                  </span>
                )}
              </div>

              {sandboxResponse && (
                <div className="flex items-center gap-2">
                  {/* View Mode Toggle (Visual Card vs Raw JSON) */}
                  <div className="bg-gray-800 rounded-lg p-0.5 flex items-center text-xs">
                    <button
                      type="button"
                      onClick={() => setResponseViewMode('visual')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                        responseViewMode === 'visual' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Visual Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setResponseViewMode('json')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                        responseViewMode === 'json' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Raw JSON
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(sandboxResponse, null, 2), 'response')}
                    className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition cursor-pointer"
                    title="Copy Raw JSON"
                  >
                    {copiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Response Body */}
            <div className="p-5">
              {!sandboxResponse && !sandboxLoading && !sandboxError && (
                <div className="py-12 text-center text-gray-500 space-y-2">
                  <Terminal className="w-10 h-10 mx-auto text-gray-700" />
                  <p className="text-sm font-medium text-gray-400">Ready to execute query</p>
                  <p className="text-xs max-w-sm mx-auto text-gray-500">
                    Click "Send Request" or select a preset above to test the Live Rates API.
                  </p>
                </div>
              )}

              {sandboxLoading && (
                <div className="py-12 text-center text-gray-400 space-y-3">
                  <RefreshCw className="w-8 h-8 mx-auto text-red-500 animate-spin" />
                  <p className="text-sm font-medium">Fetching response from rates.princeexp.com...</p>
                </div>
              )}

              {sandboxResponse && responseViewMode === 'visual' && (
                <div className="space-y-4">
                  {/* Calculation Visual Card */}
                  {sandboxResponse.final_rate !== undefined ? (
                    <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-5 border border-gray-700/80 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-gray-700/60">
                        <div>
                          <div className="text-xs text-gray-400">Calculated Final Rate</div>
                          <div className="text-3xl font-extrabold text-white flex items-baseline gap-1 mt-0.5">
                            <span className="text-red-400">₹</span>
                            {Number(sandboxResponse.final_rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            <span className="text-xs text-gray-400 font-normal ml-1">{sandboxResponse.currency || 'INR'}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {sandboxResponse.transit_time && (
                            <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-1.5 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              {sandboxResponse.transit_time}
                            </div>
                          )}
                          {sandboxResponse.active_slab && (
                            <div className="px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-1.5 font-medium">
                              <Layers className="w-3.5 h-3.5" />
                              {sandboxResponse.active_slab}
                            </div>
                          )}
                          {sandboxResponse.rate_type && (
                            <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 text-xs flex items-center gap-1.5 font-medium">
                              <Globe className="w-3.5 h-3.5" />
                              {sandboxResponse.rate_type}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Arithmetic Formula */}
                      {sandboxResponse.formula && (
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Evaluation Formula</div>
                          <div className="bg-gray-950/80 border border-gray-700/70 rounded-xl px-3.5 py-2 font-mono text-xs text-emerald-400 font-semibold break-all">
                            {sandboxResponse.formula}
                          </div>
                        </div>
                      )}

                      {/* Key Attributes Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                          <span className="text-gray-400 block">Vendor</span>
                          <span className="font-semibold text-white mt-0.5 block truncate">
                            {sandboxResponse.vendor || 'Pacific'}
                          </span>
                        </div>
                        <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                          <span className="text-gray-400 block">Destination</span>
                          <span className="font-semibold text-white mt-0.5 block truncate">
                            {sandboxResponse.country} {sandboxResponse.zone ? `(${sandboxResponse.zone})` : ''}
                          </span>
                        </div>
                        <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                          <span className="text-gray-400 block">Service Code</span>
                          <span className="font-semibold text-white mt-0.5 block truncate">
                            {sandboxResponse.service || '—'}
                          </span>
                        </div>
                        <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                          <span className="text-gray-400 block">Chargeable Wt</span>
                          <span className="font-semibold text-white mt-0.5 block">
                            {sandboxResponse.chargeable_weight} kg (Actual: {sandboxResponse.actual_weight} kg)
                          </span>
                        </div>
                      </div>

                      {/* Step-by-Step Breakdown */}
                      {sandboxResponse.calculation?.steps && (
                        <div className="space-y-1.5 pt-2">
                          <div className="text-xs font-semibold text-gray-300">Calculation Steps Trace</div>
                          <div className="space-y-1.5">
                            {sandboxResponse.calculation.steps.map((st, i) => (
                              <div key={i} className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800 text-xs">
                                <span className="font-bold text-red-400 mr-1.5">{st.title || `Step ${st.step}`}:</span>
                                <span className="text-gray-300">{st.detail}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : sandboxResponse.countries ? (
                    /* Countries Visual List */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Total Countries: <strong className="text-white">{sandboxResponse.count}</strong></span>
                        <span>Vendor: <strong className="text-white">{sandboxResponse.vendor?.name}</strong></span>
                      </div>
                      <div className="max-h-80 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-2 pr-1">
                        {sandboxResponse.countries.map((c, i) => (
                          <div key={i} className="bg-gray-800/60 hover:bg-gray-800 p-2 rounded-xl text-xs text-gray-200 border border-gray-700/50 truncate">
                            {c}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : sandboxResponse.services ? (
                    /* Services Visual List */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Available Services: <strong className="text-white">{sandboxResponse.count}</strong></span>
                        <span>Country: <strong className="text-white">{sandboxResponse.country || 'All'}</strong></span>
                      </div>
                      <div className="space-y-2">
                        {sandboxResponse.services.map((srv, i) => (
                          <div key={i} className="bg-gray-800/70 p-3 rounded-xl border border-gray-700/60 flex items-center justify-between text-xs">
                            <div className="font-mono font-bold text-red-400">{srv.service_code}</div>
                            <div className="text-gray-400">{srv.service_name || 'Standard'}</div>
                            <div className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] uppercase font-bold">
                              {srv.rate_type}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Generic JSON display */
                    <pre className="font-mono text-xs text-gray-300 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(sandboxResponse, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Raw JSON View */}
              {sandboxResponse && responseViewMode === 'json' && (
                <pre className="font-mono text-xs text-emerald-400 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                  {JSON.stringify(sandboxResponse, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: INTERACTIVE RATE CALCULATOR                                   */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-red-600" />
                Live Shipping Rate Calculator
              </h2>
              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                API Driven
              </span>
            </div>

            <form onSubmit={handleCalculateRate} className="space-y-4">
              {/* Vendor */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Shipping Vendor
                </label>
                <select
                  value={calcVendor}
                  onChange={(e) => setCalcVendor(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                >
                  {vendors.map((v) => (
                    <option key={v.slug || v.vendor_code} value={v.slug || v.vendor_code}>
                      {v.name} ({v.slug || v.vendor_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Country */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Destination Country *</span>
                  <span className="text-gray-400 font-normal text-[11px]">{availableCountries.length} available</span>
                </label>
                <input
                  type="text"
                  list="country-suggestions"
                  value={calcCountry}
                  onChange={(e) => setCalcCountry(e.target.value)}
                  placeholder="e.g. Germany, USA, United Kingdom"
                  required
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
                <datalist id="country-suggestions">
                  {availableCountries.map((c, i) => (
                    <option key={i} value={c} />
                  ))}
                </datalist>
              </div>

              {/* Service Code */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Service Code</span>
                  <span className="text-gray-400 font-normal text-[11px]">Dynamic from /services.php</span>
                </label>
                {availableServices.length > 0 ? (
                  <select
                    value={calcService}
                    onChange={(e) => setCalcService(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                  >
                    {availableServices.map((s, i) => (
                      <option key={i} value={s.service_code}>
                        {s.service_code} {s.service_name ? `- ${s.service_name}` : ''} ({s.rate_type})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={calcService}
                    onChange={(e) => setCalcService(e.target.value)}
                    placeholder="e.g. PXC-LHR-DDP"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                  />
                )}
              </div>

              {/* Weight (kg) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Shipment Weight (kg) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={calcWeight}
                  onChange={(e) => setCalcWeight(e.target.value)}
                  placeholder="e.g. 1.5"
                  required
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
                {/* Quick Weight Slabs */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-gray-400">Quick:</span>
                  {['0.5', '1.5', '5', '10', '26', '50'].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setCalcWeight(w)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer border ${
                        calcWeight === w
                          ? 'bg-red-50 text-red-600 border-red-200'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {w} kg
                    </button>
                  ))}
                </div>
              </div>

              {/* Postcode / ZIP */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Destination Postcode / ZIP</span>
                  <span className="text-gray-400 font-normal text-[11px]">Optional (for Zonewise rates)</span>
                </label>
                <input
                  type="text"
                  value={calcPostcode}
                  onChange={(e) => setCalcPostcode(e.target.value)}
                  placeholder="e.g. 10001"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={calcLoading}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm shadow-red-600/30 cursor-pointer disabled:opacity-50 mt-2"
              >
                {calcLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Calculating Rate via API...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    Calculate Shipping Rate
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Result Card */}
          <div className="lg:col-span-7 space-y-4">
            {calcResult ? (
              <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs space-y-5">
                <div className="flex flex-wrap items-center justify-between pb-4 border-b border-gray-100 gap-2">
                  <div>
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Cost</span>
                    <div className="text-4xl font-extrabold text-gray-900 mt-0.5 flex items-baseline gap-1">
                      <span className="text-red-600 text-2xl font-bold">₹</span>
                      {Number(calcResult.final_rate || calcResult.vendor_rate).toLocaleString('en-IN', {
                        minimumFractionDigits: 2
                      })}
                      <span className="text-xs text-gray-500 font-normal ml-1">INR</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {calcResult.transit_time && (
                      <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        {calcResult.transit_time}
                      </span>
                    )}
                    {calcResult.active_slab && (
                      <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-red-600" />
                        {calcResult.active_slab}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arithmetic Formula */}
                {calcResult.formula && (
                  <div>
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Calculation Formula
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 font-mono text-xs text-gray-900 font-semibold break-all">
                      {calcResult.formula}
                    </div>
                  </div>
                )}

                {/* Parameter Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                    <span className="text-gray-500 block">Destination</span>
                    <span className="font-bold text-gray-900 mt-0.5 block truncate">
                      {calcResult.country} {calcResult.zone ? `(${calcResult.zone})` : ''}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                    <span className="text-gray-500 block">Service</span>
                    <span className="font-bold text-gray-900 mt-0.5 block truncate">
                      {calcResult.service_code || calcService}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                    <span className="text-gray-500 block">Weight</span>
                    <span className="font-bold text-gray-900 mt-0.5 block">
                      {calcResult.chargeable_weight} kg
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                    <span className="text-gray-500 block">Rate Type</span>
                    <span className="font-bold text-gray-900 mt-0.5 block capitalize">
                      {calcResult.rate_type || 'Regular'}
                    </span>
                  </div>
                </div>

                {/* Breakdown Table */}
                {calcResult.breakdown && calcResult.breakdown.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Itemized Breakdown
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                          <tr>
                            <th className="p-2.5">Item</th>
                            <th className="p-2.5 text-right">Unit Price</th>
                            <th className="p-2.5 text-right">Quantity</th>
                            <th className="p-2.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {calcResult.breakdown.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="p-2.5 font-medium text-gray-900">{item.item}</td>
                              <td className="p-2.5 text-right font-mono">₹{item.unit_price}</td>
                              <td className="p-2.5 text-right font-mono">{item.quantity}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-red-600">₹{item.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-gray-200/80 shadow-xs text-center space-y-3">
                <Calculator className="w-12 h-12 text-gray-300 mx-auto" />
                <h3 className="text-base font-bold text-gray-800">No Rate Calculated Yet</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Fill in the shipping details on the left and click "Calculate Shipping Rate" to compute live rates from the API.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: RATE RECORDS / EXPLORER                                       */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'explorer' && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Table2 className="w-5 h-5 text-red-600" />
                Live Rate Records
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Query rates directly from the live database via <code className="text-red-600">/api/rates.php</code>
              </p>
            </div>

            {/* Filter inputs */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Filter by country..."
                value={explorerCountry}
                onChange={(e) => setExplorerCountry(e.target.value)}
                className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
              />
              <input
                type="text"
                placeholder="Filter by service..."
                value={explorerService}
                onChange={(e) => setExplorerService(e.target.value)}
                className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
              />
              <select
                value={explorerLimit}
                onChange={(e) => setExplorerLimit(Number(e.target.value))}
                className="bg-gray-50 border border-gray-300 rounded-xl px-2 py-1.5 text-xs font-medium text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
              >
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {explorerLoading ? (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <RefreshCw className="w-7 h-7 text-red-500 animate-spin mx-auto" />
              <p className="text-xs">Loading rates from API...</p>
            </div>
          ) : rateRecords.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              No rates found matching the filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Service Code</th>
                    <th className="p-3">Destination</th>
                    <th className="p-3">Weight Slab</th>
                    <th className="p-3">Zone</th>
                    <th className="p-3">Rate (INR)</th>
                    <th className="p-3">Transit Time</th>
                    <th className="p-3">Sheet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rateRecords.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/60 transition">
                      <td className="p-3 font-mono text-gray-500">{row.id}</td>
                      <td className="p-3 font-bold text-red-600 font-mono">{row.service_code}</td>
                      <td className="p-3 font-medium text-gray-900">{row.country || '—'}</td>
                      <td className="p-3 text-gray-700">{row.weight_label || '—'}</td>
                      <td className="p-3 text-gray-600">{row.zone || '—'}</td>
                      <td className="p-3 font-mono font-bold text-gray-900">
                        {row.rate ? `₹${parseFloat(row.rate).toFixed(2)}` : row.rate_raw || '—'}
                      </td>
                      <td className="p-3 text-gray-600">{row.transit_time || '—'}</td>
                      <td className="p-3 text-gray-400 font-mono text-[11px] truncate max-w-[150px]">{row.sheet_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: WORKSHEETS SCHEMA                                             */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sheets' && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs space-y-5">
          <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-red-600" />
                Detected Worksheets & Schema
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Worksheet schemas detected by the Rates API engine (<code className="text-red-600">/api/sheets.php</code>)
              </p>
            </div>
            <span className="text-xs text-gray-400 font-medium">Vendor: Pacific Express</span>
          </div>

          {sheetsLoading ? (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <RefreshCw className="w-7 h-7 text-red-500 animate-spin mx-auto" />
              <p className="text-xs">Loading worksheet schemas...</p>
            </div>
          ) : worksheets.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">No worksheets detected.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {worksheets.map((ws) => {
                let headers = []
                try {
                  headers = typeof ws.column_headers === 'string' ? JSON.parse(ws.column_headers) : ws.column_headers
                } catch (e) {
                  headers = []
                }

                return (
                  <div key={ws.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                          <Table2 className="w-4 h-4 text-red-600" />
                          {ws.sheet_name}
                        </div>
                        <span className="text-xs text-gray-500 capitalize">{ws.sheet_type} Sheet</span>
                      </div>
                      <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold font-mono">
                        {Number(ws.row_count).toLocaleString()} rows
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        Column Headers ({headers.length})
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
                        {headers.map((h, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[10.5px] font-mono text-gray-700"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 5: ENDPOINTS REFERENCE & DOCS                                    */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'docs' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Code2 className="w-5 h-5 text-red-600" />
                Prince Express Rates API Reference
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Complete documentation for integrating shipping rates, dependent dropdowns, and arithmetic calculations.
              </p>
            </div>

            {/* Auth Reference */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-2">
              <span className="font-bold text-gray-800">Authentication</span>
              <p className="text-gray-600">
                All endpoints require authentication using the API Key via any of the following methods:
              </p>
              <ul className="list-disc list-inside space-y-1 font-mono text-[11.5px] text-gray-700">
                <li>Header: <code className="text-red-600 font-bold">X-API-Key: {RATES_API_KEY}</code></li>
                <li>Bearer Token: <code className="text-red-600 font-bold">Authorization: Bearer {RATES_API_KEY}</code></li>
                <li>Query Param: <code className="text-red-600 font-bold">?api_key={RATES_API_KEY}</code></li>
              </ul>
            </div>

            {/* Endpoints List */}
            <div className="space-y-4">
              {/* Endpoint 1: calculate */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">GET / POST</span>
                  <code className="text-sm font-bold text-gray-900">/api/calculate.php</code>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold ml-auto">
                    Primary Engine
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Calculates total rate with itemized breakdown, zone resolution, and incremental weight arithmetic.
                </p>
                <div className="bg-gray-900 text-gray-200 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                  curl -H "X-API-Key: {RATES_API_KEY}" "https://rates.princeexp.com/api/calculate.php?vendor=pacific&country=Germany&service_code=PXC-LHR-DDP&weight_kg=26"
                </div>
              </div>

              {/* Endpoint 2: services */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">GET</span>
                  <code className="text-sm font-bold text-gray-900">/api/services.php</code>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold ml-auto">
                    Dependent Dropdown
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Returns available shipping service codes filtered by vendor and destination country.
                </p>
                <div className="bg-gray-900 text-gray-200 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                  curl -H "X-API-Key: {RATES_API_KEY}" "https://rates.princeexp.com/api/services.php?vendor=pacific&country=Germany"
                </div>
              </div>

              {/* Endpoint 3: countries */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">GET</span>
                  <code className="text-sm font-bold text-gray-900">/api/countries.php</code>
                </div>
                <p className="text-xs text-gray-600">
                  Returns all distinct destination countries across regular rates, country services, and postal zones.
                </p>
                <div className="bg-gray-900 text-gray-200 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                  curl -H "X-API-Key: {RATES_API_KEY}" "https://rates.princeexp.com/api/countries.php?vendor=pacific"
                </div>
              </div>

              {/* Endpoint 4: zones */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">GET</span>
                  <code className="text-sm font-bold text-gray-900">/api/zones.php</code>
                </div>
                <p className="text-xs text-gray-600">
                  Resolves destination postcodes to shipping zones and city names.
                </p>
                <div className="bg-gray-900 text-gray-200 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                  curl -H "X-API-Key: {RATES_API_KEY}" "https://rates.princeexp.com/api/zones.php?vendor=pacific&country=USA&postcode=10001"
                </div>
              </div>

              {/* Endpoint 5: vendors */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">GET</span>
                  <code className="text-sm font-bold text-gray-900">/api/vendors.php</code>
                </div>
                <p className="text-xs text-gray-600">
                  Returns active vendors, upload timestamps, and active workbook version batch IDs.
                </p>
                <div className="bg-gray-900 text-gray-200 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                  curl -H "X-API-Key: {RATES_API_KEY}" "https://rates.princeexp.com/api/vendors.php"
                </div>
              </div>

              {/* Endpoint 6: sheets */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">GET</span>
                  <code className="text-sm font-bold text-gray-900">/api/sheets.php</code>
                </div>
                <p className="text-xs text-gray-600">
                  Returns detected worksheets (regular, zonewise, zones, country_services) and column headers.
                </p>
                <div className="bg-gray-900 text-gray-200 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                  curl -H "X-API-Key: {RATES_API_KEY}" "https://rates.princeexp.com/api/sheets.php?vendor=pacific"
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
