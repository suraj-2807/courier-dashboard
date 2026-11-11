import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Calculator,
  Search,
  Plus,
  Trash2,
  Edit3,
  Check,
  TrendingUp,
  Percent,
  Layers,
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Table2,
  Zap,
  Building2,
  Package,
  Sliders,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  X,
  Scale
} from 'lucide-react'
import {
  getVendors,
  getVendorCountries,
  getVendorServices,
  getWorksheets,
  queryRateRecords,
  calculateVendorRate,
  getProfitRules,
  createProfitRule,
  updateProfitRule,
  deleteProfitRule,
  clearAllProfitRules,
  previewProfit
} from '../api/rates.api'

export default function RatesPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'margins'
  const [activeTab, setActiveTab] = useState(initialTab) // 'margins' | 'calculator' | 'explorer' | 'sheets'

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VENDORS QUERY
  // ═══════════════════════════════════════════════════════════════════════
  const { data: vendorsData } = useQuery({
    queryKey: ['rates-vendors'],
    queryFn: getVendors
  })
  const vendorsList = vendorsData?.vendors || [
    { name: 'Pacific', vendor_code: 'pacific' },
    { name: 'SAIRAJ', vendor_code: 'sairaj' },
    { name: 'ACX', vendor_code: 'acx' }
  ]

  // ═══════════════════════════════════════════════════════════════════════
  // TAB 1: PROFIT MARGIN RULES STATE
  // ═══════════════════════════════════════════════════════════════════════
  const {
    data: profitRulesData,
    isLoading: rulesLoading,
    refetch: refetchRules
  } = useQuery({
    queryKey: ['profit-rules'],
    queryFn: () => getProfitRules()
  })

  const profitRules = profitRulesData?.rules || []
  const weightRules = useMemo(() => profitRules.filter(r => r.rule_type === 'weight'), [profitRules])
  const countryRules = useMemo(() => profitRules.filter(r => r.rule_type === 'country'), [profitRules])

  // Modal State for Add / Edit Rule
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [ruleForm, setRuleForm] = useState({
    rule_type: 'weight',
    vendor_code: 'all',
    country: '',
    min_weight: '0',
    max_weight: '9999',
    margin_type: 'percentage',
    margin_value: '15',
    is_active: 1,
    notes: ''
  })

  const openAddModal = (type = 'weight') => {
    setEditingRule(null)
    setRuleForm({
      rule_type: type,
      vendor_code: 'all',
      country: '',
      min_weight: '0',
      max_weight: '9999',
      margin_type: 'percentage',
      margin_value: type === 'weight' ? '15' : '20',
      is_active: 1,
      notes: ''
    })
    setRuleModalOpen(true)
  }

  const openEditModal = (rule) => {
    setEditingRule(rule)
    setRuleForm({
      rule_type: rule.rule_type || 'weight',
      vendor_code: rule.vendor_code || 'all',
      country: rule.country || '',
      min_weight: String(rule.min_weight ?? 0),
      max_weight: String(rule.max_weight ?? 9999),
      margin_type: rule.margin_type || 'percentage',
      margin_value: String(rule.margin_value ?? 0),
      is_active: rule.is_active ? 1 : 0,
      notes: rule.notes || ''
    })
    setRuleModalOpen(true)
  }

  // Save Rule Mutation
  const saveRuleMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingRule?.id) {
        return updateProfitRule(editingRule.id, payload)
      }
      return createProfitRule(payload)
    },
    onSuccess: () => {
      toast.success(editingRule ? 'Rule updated successfully' : 'Rule created successfully')
      setRuleModalOpen(false)
      queryClient.invalidateQueries(['profit-rules'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to save rule')
    }
  })

  // Delete Rule Mutation
  const deleteRuleMutation = useMutation({
    mutationFn: (id) => deleteProfitRule(id),
    onSuccess: () => {
      toast.success('Profit rule removed')
      queryClient.invalidateQueries(['profit-rules'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete rule')
    }
  })

  // Clear All Rules Mutation
  const clearAllMutation = useMutation({
    mutationFn: clearAllProfitRules,
    onSuccess: () => {
      toast.success('All profit rules deleted')
      queryClient.invalidateQueries(['profit-rules'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to clear rules')
    }
  })

  // Toggle Active Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => updateProfitRule(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries(['profit-rules'])
    }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // LIVE PROFIT SIMULATOR / TESTER STATE
  // ═══════════════════════════════════════════════════════════════════════
  const [simVendor, setSimVendor] = useState('pacific')
  const [simCountry, setSimCountry] = useState('USA')
  const [simWeight, setSimWeight] = useState('3')
  const [simBaseCost, setSimBaseCost] = useState('300')
  const [simLoading, setSimLoading] = useState(false)
  const [simResult, setSimResult] = useState(null)

  const handleRunSimulator = async () => {
    setSimLoading(true)
    try {
      const res = await previewProfit({
        vendor_code: simVendor,
        country: simCountry,
        weight: parseFloat(simWeight) || 1,
        base_vendor_cost: parseFloat(simBaseCost) || 0
      })
      setSimResult(res)
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Simulator failed')
    } finally {
      setSimLoading(false)
    }
  }

  // Auto-run simulation on initial mount or parameters change
  useEffect(() => {
    handleRunSimulator()
  }, [profitRules, simVendor, simCountry, simWeight, simBaseCost])

  // Quick Preset buttons for simulator
  const applySimPreset = (vendor, country, weight, baseCost) => {
    setSimVendor(vendor)
    setSimCountry(country)
    setSimWeight(String(weight))
    setSimBaseCost(String(baseCost))
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TAB 2: INTERACTIVE RATE CALCULATOR STATE
  // ═══════════════════════════════════════════════════════════════════════
  const [calcVendor, setCalcVendor] = useState('pacific')
  const [calcCountry, setCalcCountry] = useState('USA')
  const [calcService, setCalcService] = useState('')
  const [calcWeight, setCalcWeight] = useState('3')
  const [calcPostcode, setCalcPostcode] = useState('10001')
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcResult, setCalcResult] = useState(null)
  const [calcError, setCalcError] = useState(null)

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['vendor-services', calcVendor, calcCountry],
    queryFn: () => getVendorServices(calcVendor, calcCountry),
    enabled: !!calcVendor
  })
  const availableServices = servicesData?.services || []

  useEffect(() => {
    if (availableServices.length > 0 && !availableServices.find(s => s.service_code === calcService)) {
      setCalcService(availableServices[0].service_code)
    }
  }, [availableServices])

  const handleCalculateRate = async (e) => {
    if (e) e.preventDefault()
    if (!calcWeight || parseFloat(calcWeight) <= 0) {
      toast.error('Please enter a valid weight in kg')
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
      setCalcResult(res)
      toast.success('Rate calculated with profit margin!')
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to calculate rate'
      setCalcError(errMsg)
      toast.error(errMsg)
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
      {/* ── CLEAN EXECUTIVE HEADER ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-gray-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Profit Margin Engine Active
            </span>
            <span className="text-gray-400 text-xs font-medium">Automatic Booking Markup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-emerald-600 shrink-0" />
            Vendor Rate Margins & Profit Configuration
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm max-w-3xl leading-relaxed">
            Configure automatic profit markups on vendor costs by weight tier and destination country. When live rates are fetched into booking forms, your profit is automatically added to the shipping charge and calculated into the rate per kg.
          </p>
        </div>

        {/* Quick Summary Pill Box */}
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200/80 rounded-2xl p-3 shrink-0">
          <div className="text-center px-2">
            <div className="text-base font-black text-gray-900">{weightRules.length}</div>
            <div className="text-[10px] uppercase font-bold text-gray-500">Weight Rules</div>
          </div>
          <div className="h-7 w-px bg-gray-200"></div>
          <div className="text-center px-2">
            <div className="text-base font-black text-gray-900">{countryRules.length}</div>
            <div className="text-[10px] uppercase font-bold text-gray-500">Country Rules</div>
          </div>
          <div className="h-7 w-px bg-gray-200"></div>
          {profitRules.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete all profit margin rules? Rates will then be fetched at 0% markup (raw vendor cost).')) {
                  clearAllMutation.mutate()
                }
              }}
              className="px-3 py-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Delete all rules"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
          <button
            type="button"
            onClick={() => openAddModal('weight')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Rule
          </button>
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => handleTabChange('margins')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'margins'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Profit Margin Rules
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('calculator')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'calculator'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Rate & Margin Calculator
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('explorer')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'explorer'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Table2 className="w-4 h-4" />
          Vendor Rate Explorer
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('sheets')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'sheets'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          Worksheets Schema
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PROFIT MARGIN RULES (Weight & Country)                        */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'margins' && (
        <div className="space-y-8">
          {/* ── LIVE PROFIT SIMULATOR / VISUAL PROOF CARD ── */}
          <div className="bg-gradient-to-br from-slate-900 via-gray-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-gray-700/60 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="space-y-1.5 max-w-xl">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  Live Simulator & Formula Verification
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  Test Rate Profit Addition in Real-Time
                </h3>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Enter or test sample values below to verify how profit additions are calculated and divided into the rate per kg when booking forms fetch rates.
                </p>

                {/* Example Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="text-[11px] text-gray-400 font-semibold">Test User Examples:</span>
                  <button
                    type="button"
                    onClick={() => applySimPreset('pacific', 'USA', 3, 300)}
                    className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-[11px] font-mono text-emerald-300 transition cursor-pointer"
                  >
                    Pacific 3kg @ ₹300 (+15%)
                  </button>
                  <button
                    type="button"
                    onClick={() => applySimPreset('sairaj', 'USA', 10, 400)}
                    className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-[11px] font-mono text-emerald-300 transition cursor-pointer"
                  >
                    Sairaj 10kg USA @ ₹400 (+20%)
                  </button>
                </div>
              </div>

              {/* Simulation Result Card */}
              <div className="bg-gray-800/90 border border-gray-700 rounded-2xl p-4 w-full lg:w-[420px] shadow-xl space-y-3">
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Vendor</label>
                    <select
                      value={simVendor}
                      onChange={e => setSimVendor(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                    >
                      <option value="all">All Vendors</option>
                      {vendorsList.map(v => (
                        <option key={v.vendor_code} value={v.vendor_code}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Country</label>
                    <input
                      type="text"
                      value={simCountry}
                      onChange={e => setSimCountry(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                      placeholder="e.g. USA"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={simWeight}
                      onChange={e => setSimWeight(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                      placeholder="3"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Vendor ₹</label>
                    <input
                      type="number"
                      value={simBaseCost}
                      onChange={e => setSimBaseCost(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                      placeholder="300"
                    />
                  </div>
                </div>

                {/* Calculation Output Box */}
                <div className="bg-gray-950/90 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-300">
                    <span>Base Vendor Cost:</span>
                    <span className="font-mono font-bold text-gray-200">₹{parseFloat(simBaseCost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-emerald-400">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Profit Added ({simResult?.total_percentage || 0}%):
                    </span>
                    <span className="font-mono font-bold">+₹{simResult?.profit_margin_amount?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="h-px bg-gray-800"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400">Customer Shipping Charge</div>
                      <div className="text-xl font-black text-emerald-400 font-mono">
                        ₹{simResult?.final_customer_rate?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Rate / Kg on Form</div>
                      <div className="text-lg font-black text-white font-mono">
                        ₹{simResult?.rate_per_kg?.toFixed(2) || '0.00'}<span className="text-xs text-gray-400">/kg</span>
                      </div>
                    </div>
                  </div>
                  {simResult?.applied_rules?.length > 0 && (
                    <div className="text-[10px] text-gray-400 pt-1 border-t border-gray-800/80 flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-gray-300">Applied:</span>
                      {simResult.applied_rules.map((r, idx) => (
                        <span key={idx} className="bg-gray-800 text-emerald-300 px-1.5 py-0.5 rounded border border-gray-700">
                          {r.notes || r.label} (+₹{r.profit_amount})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 1: WEIGHT-WISE PROFIT MARGINS ── */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-indigo-600" />
                  Weight-Wise Profit Margins
                </h3>
                <p className="text-xs text-gray-500">
                  Adds profit margin based on parcel chargeable weight bracket (e.g. Pacific offers ₹300 for 3 kg → +15% profit added).
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAddModal('weight')}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer w-fit"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Weight Margin
              </button>
            </div>

            {weightRules.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                No weight-wise profit rules added yet. Click &quot;Add Weight Margin&quot; to configure.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-2.5 px-3">Rule Description</th>
                      <th className="py-2.5 px-3">Vendor</th>
                      <th className="py-2.5 px-3">Weight Bracket</th>
                      <th className="py-2.5 px-3 text-right">Profit Addition</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                    {weightRules.map(rule => (
                      <tr key={rule.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-bold text-gray-900">{rule.notes || 'Weight Tier Margin'}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 font-mono text-[11px] font-bold uppercase">
                            {rule.vendor_code === 'all' ? 'All Vendors' : rule.vendor_code}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-gray-800">
                          {parseFloat(rule.min_weight).toFixed(2)} kg — {parseFloat(rule.max_weight) >= 9999 ? '∞' : `${parseFloat(rule.max_weight).toFixed(2)} kg`}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 text-sm">
                          +{parseFloat(rule.margin_value)}{rule.margin_type === 'percentage' ? '%' : (rule.margin_type === 'fixed_per_kg' ? '₹/kg' : '₹')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleActiveMutation.mutate({ id: rule.id, is_active: rule.is_active ? 0 : 1 })}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                              rule.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-100 text-gray-500 border border-gray-200'
                            }`}
                          >
                            {rule.is_active ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(rule)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Delete this profit margin rule?')) {
                                deleteRuleMutation.mutate(rule.id)
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECTION 2: COUNTRY-WISE PROFIT MARGINS ── */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-600" />
                  Country-Wise Profit Margins
                </h3>
                <p className="text-xs text-gray-500">
                  Adds profit margin based on destination country (e.g. Sairaj offers ₹400 for 10 kg in USA → +20% country addition).
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAddModal('country')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer w-fit"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Country Margin
              </button>
            </div>

            {countryRules.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                No country-wise profit rules added yet. Click &quot;Add Country Margin&quot; to configure.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-2.5 px-3">Rule Description</th>
                      <th className="py-2.5 px-3">Vendor</th>
                      <th className="py-2.5 px-3">Destination Country</th>
                      <th className="py-2.5 px-3">Weight Tier</th>
                      <th className="py-2.5 px-3 text-right">Profit Addition</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                    {countryRules.map(rule => (
                      <tr key={rule.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-bold text-gray-900">{rule.notes || `${rule.country} Margin`}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 font-mono text-[11px] font-bold uppercase">
                            {rule.vendor_code === 'all' ? 'All Vendors' : rule.vendor_code}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                            {rule.country || 'Any Country'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-gray-600">
                          {parseFloat(rule.min_weight) === 0 && parseFloat(rule.max_weight) >= 9999
                            ? 'All Weights'
                            : `${parseFloat(rule.min_weight).toFixed(2)} - ${parseFloat(rule.max_weight).toFixed(2)} kg`}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 text-sm">
                          +{parseFloat(rule.margin_value)}{rule.margin_type === 'percentage' ? '%' : (rule.margin_type === 'fixed_per_kg' ? '₹/kg' : '₹')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleActiveMutation.mutate({ id: rule.id, is_active: rule.is_active ? 0 : 1 })}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                              rule.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-100 text-gray-500 border border-gray-200'
                            }`}
                          >
                            {rule.is_active ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(rule)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Delete this country profit rule?')) {
                                deleteRuleMutation.mutate(rule.id)
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: INTERACTIVE RATE CALCULATOR                                   */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Calculator Form */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" />
                Live Rate Calculator & Margin Testbench
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Calculates vendor tariffs via Live API and applies configured weight/country profit margins.
              </p>
            </div>

            <form onSubmit={handleCalculateRate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Vendor</label>
                <select
                  value={calcVendor}
                  onChange={e => setCalcVendor(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                >
                  {vendorsList.map(v => (
                    <option key={v.vendor_code} value={v.vendor_code}>{v.name} ({v.vendor_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Destination Country</label>
                <input
                  type="text"
                  value={calcCountry}
                  onChange={e => setCalcCountry(e.target.value)}
                  placeholder="e.g. USA, Germany, U.K."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {availableServices.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Service</label>
                  <select
                    value={calcService}
                    onChange={e => setCalcService(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                  >
                    {availableServices.map(s => (
                      <option key={s.service_code} value={s.service_code}>
                        {s.service_code} {s.service_name ? `(${s.service_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={calcWeight}
                    onChange={e => setCalcWeight(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Postcode / State</label>
                  <input
                    type="text"
                    value={calcPostcode}
                    onChange={e => setCalcPostcode(e.target.value)}
                    placeholder="e.g. 10001"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={calcLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
              >
                {calcLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                Calculate Final Rate & Profit
              </button>
            </form>
          </div>

          {/* Calculator Output Display */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Calculation Breakdown</h3>
              <p className="text-xs text-gray-500">Live breakdown showing vendor cost, profit addition, and final customer rate.</p>
            </div>

            {calcResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/70">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Base Vendor Cost</span>
                    <span className="text-xl font-black text-gray-800 font-mono">
                      ₹{parseFloat(calcResult.base_vendor_cost ?? calcResult.vendor_rate ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200/70">
                    <span className="text-[10px] text-emerald-700 uppercase font-bold block mb-1">
                      Profit Added (+{calcResult.profit_percentage || 0}%)
                    </span>
                    <span className="text-xl font-black text-emerald-700 font-mono">
                      +₹{parseFloat(calcResult.profit_margin_amount ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Final Selling Rate</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">
                      ₹{parseFloat(calcResult.final_rate ?? calcResult.vendor_rate ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Chargeable Weight:</span>
                    <span className="font-mono font-bold text-gray-800">{calcResult.chargeable_weight} kg</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Customer Rate Per Kg (Form Value):</span>
                    <span className="font-mono font-bold text-emerald-700">₹{calcResult.rate_per_kg}/kg</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Estimated Transit Time:</span>
                    <span className="font-mono font-bold text-gray-800">{calcResult.transit_time || 'Standard'}</span>
                  </div>
                  {calcResult.zone && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Destination Zone:</span>
                      <span className="font-mono font-bold text-gray-800">{calcResult.zone}</span>
                    </div>
                  )}
                </div>

                {calcResult.applied_profit_rules?.length > 0 && (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                    <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Applied Profit Margin Rules:
                    </div>
                    {calcResult.applied_profit_rules.map((r, i) => (
                      <div key={i} className="text-xs text-emerald-800 flex items-center justify-between font-mono">
                        <span>• {r.notes || r.label}</span>
                        <span className="font-bold">+₹{r.profit_amount}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 text-xs">
                Enter shipment details and click &quot;Calculate Final Rate & Profit&quot; to test.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: RATE RECORDS EXPLORER                                         */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'explorer' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <Table2 className="w-5 h-5 text-gray-700" />
                Raw Vendor Rate Tariffs
              </h3>
              <p className="text-xs text-gray-500">Live rate tariff entries directly stored in the vendor rate sheets database.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={explorerCountry}
                onChange={e => setExplorerCountry(e.target.value)}
                placeholder="Filter country..."
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-800"
              />
              <button
                type="button"
                onClick={() => refetchExplorer()}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {explorerLoading ? (
            <div className="text-center py-12 text-gray-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              Loading tariff entries...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400 uppercase text-[10px] tracking-wider font-bold">
                    <th className="py-2.5 px-3">Service Code</th>
                    <th className="py-2.5 px-3">Country</th>
                    <th className="py-2.5 px-3">Weight (kg)</th>
                    <th className="py-2.5 px-3">Zone</th>
                    <th className="py-2.5 px-3 text-right">Vendor Rate</th>
                    <th className="py-2.5 px-3">Transit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {rateRecords.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-gray-900">{r.service_code}</td>
                      <td className="py-2.5 px-3">{r.country || '—'}</td>
                      <td className="py-2.5 px-3 font-mono">{r.weight_kg ?? '—'}</td>
                      <td className="py-2.5 px-3 font-mono">{r.zone || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">₹{r.rate ?? r.rate_raw}</td>
                      <td className="py-2.5 px-3 text-gray-500">{r.transit_time || '—'}</td>
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
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-xs space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-gray-700" />
              Detected Worksheets Metadata
            </h3>
            <p className="text-xs text-gray-500">Recognized sheet structure and tariff types per vendor workbook.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            {worksheets.map((w, idx) => (
              <div key={idx} className="bg-gray-50 rounded-2xl p-4 border border-gray-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-900">{w.sheet_name}</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase">
                    {w.sheet_type}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Rows: <span className="font-mono font-bold text-gray-700">{w.row_count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ADD / EDIT RULE MODAL ── */}
      {ruleModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-gray-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                {editingRule ? 'Edit Profit Margin Rule' : 'Add Profit Margin Rule'}
              </h3>
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveRuleMutation.mutate(ruleForm)
              }}
              className="space-y-4"
            >
              {/* Rule Type */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Rule Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRuleForm(prev => ({ ...prev, rule_type: 'weight' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      ruleForm.rule_type === 'weight'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Weight-Wise Margin
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuleForm(prev => ({ ...prev, rule_type: 'country' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      ruleForm.rule_type === 'country'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Country-Wise Margin
                  </button>
                </div>
              </div>

              {/* Vendor Selector */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Applicable Vendor</label>
                <select
                  value={ruleForm.vendor_code}
                  onChange={e => setRuleForm(prev => ({ ...prev, vendor_code: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Vendors (Global)</option>
                  {vendorsList.map(v => (
                    <option key={v.vendor_code} value={v.vendor_code}>{v.name} ({v.vendor_code})</option>
                  ))}
                </select>
              </div>

              {/* If Country-Wise, show Country Input */}
              {ruleForm.rule_type === 'country' && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Destination Country</label>
                  <input
                    type="text"
                    required
                    value={ruleForm.country}
                    onChange={e => setRuleForm(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="e.g. USA, United States, Germany, U.K."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Weight Brackets */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Min Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={ruleForm.min_weight}
                    onChange={e => setRuleForm(prev => ({ ...prev, min_weight: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Max Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={ruleForm.max_weight}
                    onChange={e => setRuleForm(prev => ({ ...prev, max_weight: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Margin Type & Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Profit Addition Type</label>
                  <select
                    value={ruleForm.margin_type}
                    onChange={e => setRuleForm(prev => ({ ...prev, margin_type: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="percentage">Percentage (+%)</option>
                    <option value="fixed_amount">Fixed Amount (+₹)</option>
                    <option value="fixed_per_kg">Per Kg (+₹/kg)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Value {ruleForm.margin_type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={ruleForm.margin_value}
                    onChange={e => setRuleForm(prev => ({ ...prev, margin_value: e.target.value }))}
                    placeholder="e.g. 15 or 20"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Note / Description */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Rule Note / Description</label>
                <input
                  type="text"
                  value={ruleForm.notes}
                  onChange={e => setRuleForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Pacific 3kg 15% profit, Sairaj USA 20% margin"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rule-active"
                  checked={!!ruleForm.is_active}
                  onChange={e => setRuleForm(prev => ({ ...prev, is_active: e.target.checked ? 1 : 0 }))}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                />
                <label htmlFor="rule-active" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Rule is active and applied automatically to bookings
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveRuleMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {saveRuleMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {editingRule ? 'Update Rule' : 'Save Profit Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
