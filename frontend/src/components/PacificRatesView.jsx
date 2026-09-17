import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Upload,
  FileSpreadsheet,
  Search,
  Trash2,
  X,
  Check,
  MapPin,
  Layers,
  IndianRupee,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Package,
  RefreshCw,
  Table2,
  Calculator,
  GitCompare,
  History,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  Equal,
  Clock,
  ExternalLink
} from 'lucide-react'
import {
  uploadVendorRateSheet,
  getVendorVersions,
  getVendorVersionDetail,
  activateVendorVersion,
  getVendorVersionDiff,
  deleteVendorVersion,
  calculateVendorRate,
  getVendorDestinations
} from '../api/rates.api'

export default function PacificRatesView() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  // ── States ──
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadDragging, setUploadDragging] = useState(false)
  const [uploadValidation, setUploadValidation] = useState(null)
  const [activeSubTab, setActiveSubTab] = useState('rates') // 'rates' | 'calculator' | 'versions' | 'diff'
  const [rateSearch, setRateSearch] = useState('')
  const [diffModalVersionId, setDiffModalVersionId] = useState(null)

  // ── Calculator State ──
  const [calcForm, setCalcForm] = useState({
    country: '',
    postcode: '',
    weight: '1.5',
    service_code: 'SELF'
  })
  const [calcResult, setCalcResult] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)

  // ── Queries ──
  const { data: versionsData, isLoading: versionsLoading, refetch: refetchVersions } = useQuery({
    queryKey: ['pacific-versions'],
    queryFn: () => getVendorVersions('pacific')
  })

  const versions = versionsData?.versions || []
  const activeVersion = versions.find(v => v.status === 'active') || versions[0] || null

  // Auto-select active version if none selected
  const currentVersionId = selectedVersionId || activeVersion?.id

  const { data: versionDetailData, isLoading: versionDetailLoading } = useQuery({
    queryKey: ['pacific-version-detail', currentVersionId],
    queryFn: () => getVendorVersionDetail('pacific', currentVersionId),
    enabled: !!currentVersionId
  })

  const rates = versionDetailData?.rates || []
  const currentVersion = versionDetailData?.version || activeVersion

  // Destinations query for calculator
  const { data: destinationsData } = useQuery({
    queryKey: ['pacific-destinations'],
    queryFn: () => getVendorDestinations('pacific')
  })
  const destinations = destinationsData?.destinations || []

  // Diff query when modal is open
  const { data: diffData, isLoading: diffLoading } = useQuery({
    queryKey: ['pacific-version-diff', diffModalVersionId],
    queryFn: () => getVendorVersionDiff('pacific', diffModalVersionId),
    enabled: !!diffModalVersionId
  })

  // ── Mutations ──
  const uploadMutation = useMutation({
    mutationFn: (file) => uploadVendorRateSheet('pacific', file),
    onSuccess: (res) => {
      toast.success(res.message || 'Rate sheet uploaded and validated!')
      setUploadValidation(res)
      refetchVersions()
      queryClient.invalidateQueries({ queryKey: ['pacific-versions'] })
      queryClient.invalidateQueries({ queryKey: ['pacific-destinations'] })
      if (res.version_id) {
        setSelectedVersionId(res.version_id)
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Upload failed')
      setUploadValidation(null)
    }
  })

  const activateMutation = useMutation({
    mutationFn: (versionId) => activateVendorVersion('pacific', versionId),
    onSuccess: (res) => {
      toast.success(res.message || 'Version activated successfully!')
      refetchVersions()
      queryClient.invalidateQueries({ queryKey: ['pacific-versions'] })
      queryClient.invalidateQueries({ queryKey: ['pacific-version-detail'] })
      queryClient.invalidateQueries({ queryKey: ['pacific-destinations'] })
      setDiffModalVersionId(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to activate version')
  })

  const deleteMutation = useMutation({
    mutationFn: (versionId) => deleteVendorVersion('pacific', versionId),
    onSuccess: () => {
      toast.success('Version deleted')
      refetchVersions()
      queryClient.invalidateQueries({ queryKey: ['pacific-versions'] })
      if (selectedVersionId === diffModalVersionId) {
        setSelectedVersionId(null)
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete')
  })

  // ── Handlers ──
  const handleFileUpload = useCallback((file) => {
    if (!file) return
    const validExts = /\.(xlsx|xls)$/i
    if (!validExts.test(file.name)) {
      toast.error('Please upload an Excel workbook (.xlsx or .xls)')
      return
    }
    setUploadValidation(null)
    uploadMutation.mutate(file)
  }, [uploadMutation])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setUploadDragging(false)
    const file = e.dataTransfer.files[0]
    handleFileUpload(file)
  }, [handleFileUpload])

  const handleCalculate = async (e) => {
    e?.preventDefault()
    if (!calcForm.country || !calcForm.weight) {
      toast.error('Please specify destination country and weight')
      return
    }
    setCalcLoading(true)
    setCalcResult(null)
    try {
      const res = await calculateVendorRate({
        vendor_code: 'pacific',
        country: calcForm.country,
        postcode: calcForm.postcode,
        weight: parseFloat(calcForm.weight),
        service_code: calcForm.service_code
      })
      setCalcResult(res)
      if (!res.success) {
        toast.error(res.message || 'Calculation error')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to calculate rate')
    } finally {
      setCalcLoading(false)
    }
  }

  // Filter rates by search
  const filteredRates = rates.filter(r => {
    if (!rateSearch) return true
    const q = rateSearch.toLowerCase()
    return (
      (r.destination_country && r.destination_country.toLowerCase().includes(q)) ||
      (r.service_name && r.service_name.toLowerCase().includes(q)) ||
      (r.transit_time && r.transit_time.toLowerCase().includes(q))
    )
  })

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Active Version Banner / Stats ── */}
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle decorative glow */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #BB0013, #FF5722, #4CAF50)'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(187, 0, 19, 0.1), rgba(255, 87, 34, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)'
          }}>
            <Globe style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Pacific Express Rate Sheet
              </h2>
              {activeVersion ? (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: '20px',
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                  ACTIVE: {activeVersion.version_name || `v${activeVersion.id}`}
                </span>
              ) : (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: '20px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#dc2626'
                }}>
                  NO ACTIVE VERSION
                </span>
              )}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Multi-sheet tariff engine covering Self Network pricing, Canada/Aus/NZ/Scotland postcode zones, and DPD remote areas.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setActiveSubTab('calculator')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              background: activeSubTab === 'calculator' ? 'var(--color-surface-alt)' : 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Calculator style={{ width: '15px', height: '15px', color: '#BB0013' }} />
            Rate Calculator
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 700,
              color: 'white',
              background: 'linear-gradient(135deg, #BB0013, #D4001A)',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(187, 0, 19, 0.25)',
              transition: 'all 0.2s'
            }}
          >
            <Upload style={{ width: '15px', height: '15px' }} />
            Upload Pacific Excel
          </button>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '2px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setActiveSubTab('rates')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeSubTab === 'rates' ? '3px solid #BB0013' : '3px solid transparent',
              background: 'transparent',
              color: activeSubTab === 'rates' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Table2 style={{ width: '15px', height: '15px' }} />
            Active Tariffs & Slabs ({rates.length})
          </button>

          <button
            onClick={() => setActiveSubTab('calculator')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeSubTab === 'calculator' ? '3px solid #BB0013' : '3px solid transparent',
              background: 'transparent',
              color: activeSubTab === 'calculator' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Calculator style={{ width: '15px', height: '15px' }} />
            Test Rate Calculation
          </button>

          <button
            onClick={() => setActiveSubTab('versions')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeSubTab === 'versions' ? '3px solid #BB0013' : '3px solid transparent',
              background: 'transparent',
              color: activeSubTab === 'versions' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <History style={{ width: '15px', height: '15px' }} />
            Version History ({versions.length})
          </button>
        </div>

        {/* Version Selector Pill */}
        {versions.length > 0 && activeSubTab === 'rates' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>Showing Version:</span>
            <select
              value={currentVersionId || ''}
              onChange={(e) => setSelectedVersionId(parseInt(e.target.value))}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer'
              }}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_name || `Version ${v.id}`} ({v.status}) — {new Date(v.uploaded_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── TAB 1: RATES EXPLORER ── */}
      {activeSubTab === 'rates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filter and Summary Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <Search style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '15px',
                height: '15px',
                color: 'var(--color-text-tertiary)'
              }} />
              <input
                type="text"
                value={rateSearch}
                onChange={(e) => setRateSearch(e.target.value)}
                placeholder="Search destination country or service..."
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  fontSize: '13px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  outline: 'none'
                }}
              />
              {rateSearch && (
                <button
                  onClick={() => setRateSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-tertiary)'
                  }}
                >
                  <X style={{ width: '14px', height: '14px' }} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <span>Total Destinations: <strong>{rates.length}</strong></span>
              <span>Matched: <strong>{filteredRates.length}</strong></span>
            </div>
          </div>

          {/* Rates Table */}
          {versionDetailLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton" style={{ height: '42px', borderRadius: '8px' }} />
              ))}
            </div>
          ) : filteredRates.length === 0 ? (
            <div style={{
              background: 'var(--color-surface)',
              borderRadius: '14px',
              border: '1px solid var(--color-border)',
              padding: '50px 20px',
              textAlign: 'center'
            }}>
              <FileSpreadsheet style={{ width: '36px', height: '36px', color: 'var(--color-text-tertiary)', margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                No Rates Found
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                {rateSearch ? 'No destination matches your search criteria.' : 'Please upload a Pacific rate sheet to populate this tariff.'}
              </p>
              {!rateSearch && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  style={{
                    marginTop: '16px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'white',
                    background: '#BB0013',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Upload Pacific Rate Sheet
                </button>
              )}
            </div>
          ) : (
            <div style={{
              background: 'var(--color-surface)',
              borderRadius: '14px',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Destination Country</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Service</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Transit Time</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Base (500g)</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Add'l 500g</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Slab Rates (per KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRates.map((r, idx) => (
                      <tr
                        key={r.id || idx}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)',
                          transition: 'background 0.15s'
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Globe style={{ width: '14px', height: '14px', color: '#BB0013', flexShrink: 0 }} />
                            {r.destination_country}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'var(--color-surface-alt)',
                            border: '1px solid var(--color-border)'
                          }}>
                            {r.service_name || r.service_code || 'SELF'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Clock style={{ width: '13px', height: '13px', color: 'var(--color-text-tertiary)' }} />
                            {r.transit_time || '3-7 Days'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#16a34a' }}>
                          ₹{parseFloat(r.base_500g || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          ₹{parseFloat(r.addl_500g || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                          {r.slabs_display ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {r.slabs_display.split(',').map((slab, sIdx) => (
                                <span
                                  key={sIdx}
                                  style={{
                                    fontSize: '11px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(187, 0, 19, 0.06)',
                                    color: '#BB0013',
                                    fontWeight: 600
                                  }}
                                >
                                  {slab.trim()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Standard slabs</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: LIVE RATE CALCULATOR TESTER ── */}
      {activeSubTab === 'calculator' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Form */}
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #BB0013, #D4001A)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <Calculator style={{ width: '18px', height: '18px' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  Pacific Rate Calculator
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Test rate calculation logic against active version ({activeVersion?.version_name || 'Active'})
                </p>
              </div>
            </div>

            <form onSubmit={handleCalculate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Country */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Destination Country *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. United Arab Emirates, Canada, Australia, United Kingdom"
                  value={calcForm.country}
                  onChange={(e) => setCalcForm({ ...calcForm, country: e.target.value })}
                  list="pacific-destinations-list"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-primary)'
                  }}
                />
                <datalist id="pacific-destinations-list">
                  {destinations.map((d, i) => (
                    <option key={i} value={d.destination_country} />
                  ))}
                </datalist>
              </div>

              {/* Weight */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Package Weight (KG) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  placeholder="e.g. 1.5, 7.5, 25"
                  value={calcForm.weight}
                  onChange={(e) => setCalcForm({ ...calcForm, weight: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              {/* Postcode */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Destination Postcode (Optional - for Canada/Aus/NZ/Scotland/DPD Remote)
                </label>
                <input
                  type="text"
                  placeholder="e.g. M5V 2T6, 2000, 0800, IV1"
                  value={calcForm.postcode}
                  onChange={(e) => setCalcForm({ ...calcForm, postcode: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={calcLoading}
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'white',
                  background: 'linear-gradient(135deg, #BB0013, #D4001A)',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: calcLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(187, 0, 19, 0.25)'
                }}
              >
                {calcLoading ? (
                  <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Calculator style={{ width: '16px', height: '16px' }} />
                )}
                Calculate Rate
              </button>
            </form>
          </div>

          {/* Result Card */}
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            {calcResult ? (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 style={{ width: '18px', height: '18px', color: '#16a34a' }} />
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      Calculation Breakdown
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: '#16a34a'
                  }}>
                    {calcResult.pricing_model?.toUpperCase() || 'PACIFIC'}
                  </span>
                </div>

                {/* Big Price Display */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(187, 0, 19, 0.05), rgba(255, 87, 34, 0.05))',
                  padding: '20px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid rgba(187, 0, 19, 0.1)'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                    Estimated Vendor Base Rate
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#BB0013', marginTop: '4px' }}>
                    ₹{parseFloat(calcResult.base_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Chargeable Weight: <strong>{calcResult.chargeable_weight} KG</strong>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Destination:</span>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{calcResult.country}</strong>
                  </div>

                  {calcResult.zone && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Zone Resolved:</span>
                      <span style={{
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'var(--color-surface-alt)',
                        color: 'var(--color-text-primary)'
                      }}>
                        {calcResult.zone}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Transit Time:</span>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{calcResult.transit_time || '3-7 Days'}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Slab Applied:</span>
                    <span style={{ color: '#BB0013', fontWeight: 600 }}>{calcResult.slab_applied || 'Standard'}</span>
                  </div>

                  {calcResult.is_remote && (
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      color: '#b45309',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertTriangle style={{ width: '15px', height: '15px', flexShrink: 0 }} />
                      <span><strong>Remote Area:</strong> Additional surcharge applies for this postal code</span>
                    </div>
                  )}

                  {/* Calculation formula explanation */}
                  {calcResult.breakups && (
                    <div style={{
                      marginTop: '8px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--color-surface-alt)',
                      fontSize: '11px',
                      color: 'var(--color-text-secondary)',
                      lineHeight: '1.6'
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>Formula Breakdown:</div>
                      {calcResult.breakups.base_500g > 0 && <div>• Base 500g: ₹{calcResult.breakups.base_500g}</div>}
                      {calcResult.breakups.addl_units > 0 && <div>• Add'l 500g × {calcResult.breakups.addl_units}: ₹{calcResult.breakups.addl_charge}</div>}
                      {calcResult.breakups.rate_per_kg > 0 && <div>• {calcResult.chargeable_weight} KG × ₹{calcResult.breakups.rate_per_kg}/KG: ₹{calcResult.base_rate}</div>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '40px 0' }}>
                <Calculator style={{ width: '40px', height: '40px', margin: '0 auto 12px', opacity: 0.5 }} />
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  No Calculation Yet
                </h4>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  Fill in the destination and weight on the left to simulate active Pacific rate calculation.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: VERSION HISTORY ── */}
      {activeSubTab === 'versions' && (
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: '16px',
          border: '1px solid var(--color-border)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Pacific Rate Sheet Versions
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                All uploaded tariff sheets, validation statuses, and activation history
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: 'white',
                background: '#BB0013',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <Upload style={{ width: '13px', height: '13px' }} />
              Upload New Version
            </button>
          </div>

          {versionsLoading ? (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '36px', borderRadius: '8px' }} />)}
            </div>
          ) : versions.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center' }}>
              <History style={{ width: '36px', height: '36px', color: 'var(--color-text-tertiary)', margin: '0 auto 10px' }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                No versions uploaded yet
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Version</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>File Name</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Uploaded</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Destinations</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Zones</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v, idx) => {
                    const isActive = v.status === 'active'
                    const isValidated = v.status === 'validated'
                    return (
                      <tr
                        key={v.id}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          background: isActive ? 'rgba(34, 197, 94, 0.04)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          v{v.id}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileSpreadsheet style={{ width: '14px', height: '14px', color: '#16a34a' }} />
                            {v.file_name}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                          {new Date(v.uploaded_at).toLocaleDateString()} {new Date(v.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {v.rate_count || 0}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                          {v.zone_count || 0}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: '20px',
                            textTransform: 'uppercase',
                            background: isActive
                              ? 'rgba(34, 197, 94, 0.12)'
                              : isValidated
                              ? 'rgba(59, 130, 246, 0.12)'
                              : v.status === 'archived'
                              ? 'var(--color-surface-alt)'
                              : 'rgba(239, 68, 68, 0.12)',
                            color: isActive
                              ? '#16a34a'
                              : isValidated
                              ? '#2563eb'
                              : v.status === 'archived'
                              ? 'var(--color-text-tertiary)'
                              : '#dc2626'
                          }}>
                            {v.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            {/* Compare Diff button */}
                            <button
                              onClick={() => setDiffModalVersionId(v.id)}
                              title="Compare Diff against Active"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '6px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                color: 'var(--color-text-primary)',
                                cursor: 'pointer'
                              }}
                            >
                              <GitCompare style={{ width: '13px', height: '13px' }} />
                              Diff
                            </button>

                            {/* View records */}
                            <button
                              onClick={() => {
                                setSelectedVersionId(v.id)
                                setActiveSubTab('rates')
                              }}
                              title="Inspect rates in table"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '6px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                color: 'var(--color-text-primary)',
                                cursor: 'pointer'
                              }}
                            >
                              View
                            </button>

                            {/* Activate button (if validated) */}
                            {isValidated && !isActive && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Activate Pacific version v${v.id}? This will make it the live calculation tariff and archive the previous active version.`)) {
                                    activateMutation.mutate(v.id)
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#16a34a',
                                  color: 'white',
                                  cursor: 'pointer'
                                }}
                              >
                                <Check style={{ width: '13px', height: '13px' }} />
                                Activate
                              </button>
                            )}

                            {/* Delete draft/failed */}
                            {!isActive && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete Pacific rate version v${v.id}?`)) {
                                    deleteMutation.mutate(v.id)
                                  }
                                }}
                                title="Delete this version"
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  background: 'var(--color-danger-bg)',
                                  color: 'var(--color-danger)',
                                  cursor: 'pointer'
                                }}
                              >
                                <Trash2 style={{ width: '13px', height: '13px' }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── UPLOAD MODAL ── */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div
            className="animate-slide-down"
            style={{
              background: 'var(--color-surface)',
              borderRadius: '20px',
              border: '1px solid var(--color-border)',
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  Upload Pacific Rate Sheet
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Select the Pacific multi-sheet workbook (.xlsx / .xls)
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setUploadValidation(null)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-tertiary)',
                  padding: '4px'
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => { e.preventDefault(); setUploadDragging(true) }}
                onDragLeave={() => setUploadDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${uploadDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: '16px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: uploadDragging ? 'rgba(187, 0, 19, 0.04)' : 'var(--color-surface-alt)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0]
                    handleFileUpload(file)
                  }}
                />
                <div style={{
                  width: '52px',
                  height: '52px',
                  margin: '0 auto 12px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(187, 0, 19, 0.1), rgba(255, 87, 34, 0.1))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#BB0013'
                }}>
                  {uploadMutation.isPending ? (
                    <RefreshCw style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Upload style={{ width: '24px', height: '24px' }} />
                  )}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {uploadMutation.isPending ? 'Parsing & Validating Workbook...' : 'Click to upload or drag & drop'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                  Supports Pacific multi-sheet tariffs (.xlsx, .xls)
                </div>
              </div>

              {/* Expected Sheets Guide */}
              <div style={{
                background: 'var(--color-surface-alt)',
                borderRadius: '12px',
                padding: '14px 16px',
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                  Recognized Worksheets:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                  <div>✓ <strong>Self Network</strong> (Country base + slabs)</div>
                  <div>✓ <strong>Canada Zone</strong> (Postcode to Zone)</div>
                  <div>✓ <strong>Aus Zone</strong> (Postcode to Zone)</div>
                  <div>✓ <strong>NZ Zone</strong> (Postcode to Zone)</div>
                  <div>✓ <strong>Scotland Zip Code</strong> (GB Postal zones)</div>
                  <div>✓ <strong>DPD Remote Area</strong> (Remote exclusions)</div>
                </div>
              </div>

              {/* Validation Summary Card */}
              {uploadValidation && (
                <div className="animate-fade-in" style={{
                  background: 'var(--color-surface)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 style={{ width: '18px', height: '18px', color: '#16a34a' }} />
                      <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>Validation Passed</strong>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>
                      {uploadValidation.summary?.total_records} Records Parsed
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
                    <div style={{ padding: '8px', background: 'var(--color-surface-alt)', borderRadius: '6px' }}>
                      Self Network: <strong>{uploadValidation.summary?.self_network?.count || 0}</strong> rates
                    </div>
                    <div style={{ padding: '8px', background: 'var(--color-surface-alt)', borderRadius: '6px' }}>
                      Canada Zones: <strong>{uploadValidation.summary?.canada_zone?.count || 0}</strong> entries
                    </div>
                    <div style={{ padding: '8px', background: 'var(--color-surface-alt)', borderRadius: '6px' }}>
                      Australia Zones: <strong>{uploadValidation.summary?.aus_zone?.count || 0}</strong> entries
                    </div>
                    <div style={{ padding: '8px', background: 'var(--color-surface-alt)', borderRadius: '6px' }}>
                      DPD Remote: <strong>{uploadValidation.summary?.dpd_remote?.count || 0}</strong> entries
                    </div>
                  </div>

                  {/* Actions after upload */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button
                      onClick={() => {
                        if (uploadValidation.version_id) {
                          setDiffModalVersionId(uploadValidation.version_id)
                          setShowUploadModal(false)
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface-alt)',
                        color: 'var(--color-text-primary)',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <GitCompare style={{ width: '14px', height: '14px' }} />
                      View Diff
                    </button>

                    <button
                      onClick={() => {
                        if (uploadValidation.version_id) {
                          activateMutation.mutate(uploadValidation.version_id)
                          setShowUploadModal(false)
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#16a34a',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Check style={{ width: '14px', height: '14px' }} />
                      Activate Version Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DIFF MODAL ── */}
      {diffModalVersionId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div
            className="animate-slide-down"
            style={{
              background: 'var(--color-surface)',
              borderRadius: '20px',
              border: '1px solid var(--color-border)',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Diff Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GitCompare style={{ width: '18px', height: '18px', color: '#BB0013' }} />
                  Tariff Diff: Version v{diffModalVersionId} vs Active
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Preview rate adjustments and route modifications before activating
                </p>
              </div>
              <button
                onClick={() => setDiffModalVersionId(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-tertiary)',
                  padding: '4px'
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Diff Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {diffLoading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <RefreshCw style={{ width: '28px', height: '28px', animation: 'spin 1s linear infinite', color: '#BB0013', margin: '0 auto 10px' }} />
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Comparing versions...</div>
                </div>
              ) : diffData?.diff ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Summary Metric Counters */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a' }}>
                        {diffData.diff.summary?.new_destinations_count || 0}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>New Routes</div>
                    </div>

                    <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>
                        {diffData.diff.summary?.removed_destinations_count || 0}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Removed</div>
                    </div>

                    <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706' }}>
                        {diffData.diff.summary?.rates_increased_count || 0}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Increased</div>
                    </div>

                    <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb' }}>
                        {diffData.diff.summary?.rates_decreased_count || 0}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Decreased</div>
                    </div>
                  </div>

                  {/* Changes List */}
                  {diffData.diff.rate_changes && diffData.diff.rate_changes.length > 0 ? (
                    <div style={{
                      maxHeight: '260px',
                      overflowY: 'auto',
                      border: '1px solid var(--color-border)',
                      borderRadius: '10px'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Destination</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Old Base (500g)</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>New Base (500g)</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center' }}>Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffData.diff.rate_changes.slice(0, 50).map((change, cIdx) => (
                            <tr key={cIdx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{change.destination}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-tertiary)' }}>
                                ₹{change.old_base_500g}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                                ₹{change.new_base_500g}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                {change.diff > 0 ? (
                                  <span style={{ color: '#dc2626', fontWeight: 700 }}>+₹{change.diff}</span>
                                ) : (
                                  <span style={{ color: '#16a34a', fontWeight: 700 }}>₹{change.diff}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                      No rate price differences detected against the active version.
                    </div>
                  )}

                  {/* Activate CTA */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button
                      onClick={() => setDiffModalVersionId(null)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1px solid var(--color-border)',
                        background: 'transparent',
                        color: 'var(--color-text-primary)',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Close
                    </button>

                    <button
                      onClick={() => activateMutation.mutate(diffModalVersionId)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#16a34a',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Check style={{ width: '15px', height: '15px' }} />
                      Activate Version v{diffModalVersionId}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  Failed to load diff.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
