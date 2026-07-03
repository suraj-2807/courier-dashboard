import { useState, useRef, useCallback, useEffect } from 'react'
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
  Building2,
  RefreshCw,
  Table2,
  Eye,
  EyeOff,
  Save
} from 'lucide-react'
import {
  uploadRatesExcel,
  getCompanies,
  getCompanyServices,
  getServiceRates,
  getServiceZones,
  updateRateEntry,
  updateZoneEntry,
  deleteService,
  deleteCompany
} from '../api/rates.api'

export default function RatesPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  // ── State ──
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)
  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [activeDataTab, setActiveDataTab] = useState('rates') // 'rates' | 'zones'
  const [uploadDragging, setUploadDragging] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [editingRateId, setEditingRateId] = useState(null)
  const [editingZoneId, setEditingZoneId] = useState(null)
  const [editRateForm, setEditRateForm] = useState({})
  const [editZoneForm, setEditZoneForm] = useState({})
  const [zoneSearch, setZoneSearch] = useState('')
  const [zonePage, setZonePage] = useState(1)
  const [showUploadArea, setShowUploadArea] = useState(false)

  // ── Queries ──
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['rate-companies'],
    queryFn: getCompanies
  })

  const companies = companiesData?.companies || []

  // Auto-select first company
  useEffect(() => {
    if (selectedCompanyId === null && companies.length > 0) {
      setSelectedCompanyId(companies[0].id)
    }
  }, [companies, selectedCompanyId])

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['rate-services', selectedCompanyId],
    queryFn: () => getCompanyServices(selectedCompanyId),
    enabled: !!selectedCompanyId
  })

  const services = servicesData?.services || []

  // Auto-select first service
  useEffect(() => {
    if (services.length > 0 && !services.find(s => s.id === selectedServiceId)) {
      setSelectedServiceId(services[0].id)
    }
    if (services.length === 0) {
      setSelectedServiceId(null)
    }
  }, [services, selectedServiceId])

  const { data: ratesData, isLoading: ratesLoading } = useQuery({
    queryKey: ['service-rates', selectedServiceId],
    queryFn: () => getServiceRates(selectedServiceId),
    enabled: !!selectedServiceId
  })

  const rates = ratesData?.rates || []

  const { data: zonesData, isLoading: zonesLoading } = useQuery({
    queryKey: ['service-zones', selectedServiceId, zoneSearch, zonePage],
    queryFn: () => getServiceZones(selectedServiceId, { search: zoneSearch, page: zonePage, limit: 100 }),
    enabled: !!selectedServiceId
  })

  const zones = zonesData?.zones || []
  const zonePagination = zonesData?.pagination || {}

  // ── Mutations ──
  const uploadMutation = useMutation({
    mutationFn: uploadRatesExcel,
    onSuccess: (data) => {
      toast.success(`Imported: ${data.data.rates_inserted} rates, ${data.data.zones_inserted} zones`)
      setUploadResult(data.data)
      setShowUploadArea(false)
      queryClient.invalidateQueries({ queryKey: ['rate-companies'] })
      queryClient.invalidateQueries({ queryKey: ['rate-services'] })
      queryClient.invalidateQueries({ queryKey: ['service-rates'] })
      queryClient.invalidateQueries({ queryKey: ['service-zones'] })
      // Auto-select the uploaded company/service
      if (data.data.company_id) setSelectedCompanyId(data.data.company_id)
      if (data.data.service_id) {
        setTimeout(() => setSelectedServiceId(data.data.service_id), 300)
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Upload failed')
      setUploadResult(null)
    }
  })

  const updateRateMutation = useMutation({
    mutationFn: ({ id, data }) => updateRateEntry(id, data),
    onSuccess: () => {
      toast.success('Rate updated')
      setEditingRateId(null)
      queryClient.invalidateQueries({ queryKey: ['service-rates'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update')
  })

  const updateZoneMutation = useMutation({
    mutationFn: ({ id, data }) => updateZoneEntry(id, data),
    onSuccess: () => {
      toast.success('Zone updated')
      setEditingZoneId(null)
      queryClient.invalidateQueries({ queryKey: ['service-zones'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update')
  })

  const deleteServiceMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      toast.success('Service deleted')
      setSelectedServiceId(null)
      queryClient.invalidateQueries({ queryKey: ['rate-companies'] })
      queryClient.invalidateQueries({ queryKey: ['rate-services'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete')
  })

  const deleteCompanyMutation = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => {
      toast.success('Company deleted')
      setSelectedCompanyId(null)
      setSelectedServiceId(null)
      queryClient.invalidateQueries({ queryKey: ['rate-companies'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete')
  })

  // ── Handlers ──
  const handleFileUpload = useCallback((file) => {
    if (!file) return
    const validExts = /\.(xlsx|xls|csv)$/i
    if (!validExts.test(file.name)) {
      toast.error('Please upload an Excel file (.xlsx, .xls, or .csv)')
      return
    }
    setUploadResult(null)
    uploadMutation.mutate(file)
  }, [uploadMutation])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setUploadDragging(false)
    const file = e.dataTransfer.files[0]
    handleFileUpload(file)
  }, [handleFileUpload])

  const startEditingRate = (rate) => {
    setEditingRateId(rate.id)
    setEditRateForm({
      weight: rate.weight,
      zone_1: rate.zone_1, zone_2: rate.zone_2, zone_3: rate.zone_3,
      zone_4: rate.zone_4, zone_5: rate.zone_5, zone_6: rate.zone_6,
      zone_7: rate.zone_7, zone_8: rate.zone_8, zone_9: rate.zone_9,
      zone_10: rate.zone_10
    })
  }

  const startEditingZone = (zone) => {
    setEditingZoneId(zone.id)
    setEditZoneForm({
      postcode: zone.postcode,
      city: zone.city,
      zone: zone.zone
    })
  }

  const selectedService = services.find(s => s.id === selectedServiceId)
  const selectedCompany = companies.find(c => c.id === selectedCompanyId)

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-heading)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #BB0013, #FF1A3D)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee style={{ width: '18px', height: '18px', color: 'white' }} />
            </div>
            Rate Management
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Upload rate sheets by company & service, manage zone-wise pricing
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowUploadArea(!showUploadArea)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 18px', fontSize: '13px', fontWeight: 700,
              color: 'white', background: 'linear-gradient(135deg, #BB0013, #D4001A)',
              border: 'none', borderRadius: '10px', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(187, 0, 19, 0.25)',
              transition: 'all 0.2s'
            }}
          >
            <Upload style={{ width: '14px', height: '14px' }} />
            Upload Excel
          </button>
        </div>
      </div>

      {/* ── Upload Area (collapsible) ── */}
      {showUploadArea && (
        <div style={{ marginBottom: '20px' }} className="animate-slide-down">
          <div
            onDragOver={(e) => { e.preventDefault(); setUploadDragging(true) }}
            onDragLeave={() => setUploadDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: uploadDragging
                ? 'linear-gradient(135deg, rgba(187, 0, 19, 0.04), rgba(187, 0, 19, 0.08))'
                : 'var(--color-surface)',
              border: uploadDragging ? '2px dashed var(--color-primary)' : '2px dashed var(--color-border)',
              borderRadius: '16px', padding: '32px', cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '160px', position: 'relative', overflow: 'hidden'
            }}
          >
            {/* Background decoration */}
            <div style={{
              position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px',
              background: 'linear-gradient(135deg, rgba(187, 0, 19, 0.05), transparent)',
              borderRadius: '50%'
            }} />
            <div style={{
              position: 'absolute', bottom: '-30px', left: '-30px', width: '100px', height: '100px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.04), transparent)',
              borderRadius: '50%'
            }} />
            <div style={{
              width: '52px', height: '52px',
              background: uploadMutation.isPending
                ? 'linear-gradient(135deg, #F59E0B, #FBBF24)'
                : 'linear-gradient(135deg, #BB0013, #FF1A3D)',
              borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '12px', boxShadow: '0 4px 12px rgba(187, 0, 19, 0.2)'
            }}>
              {uploadMutation.isPending
                ? <RefreshCw style={{ width: '22px', height: '22px', color: 'white', animation: 'spin 1s linear infinite' }} />
                : <Upload style={{ width: '22px', height: '22px', color: 'white' }} />
              }
            </div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              {uploadMutation.isPending ? 'Processing...' : 'Upload Excel Rate Sheet'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
              Drag & drop or click to browse • .xlsx / .xls / .csv files
            </p>
            <div style={{
              marginTop: '12px', padding: '10px 16px', borderRadius: '10px',
              background: 'var(--color-surface-alt)', border: '1px solid var(--color-border-light)',
              maxWidth: '460px', textAlign: 'center'
            }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: '1.6' }}>
                <strong>Filename format:</strong> <code style={{ background: 'var(--color-border-light)', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>CompanyName ServiceName.xlsx</code> (first word = company, rest = service)
                <br />
                <strong>Sheet 1 "rates":</strong> Weight | ZONE 1 | ZONE 2 | ... | ZONE 10
                <br />
                <strong>Sheet 2 "zones":</strong> PostCode | City | Zones
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { handleFileUpload(e.target.files[0]); e.target.value = '' }}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      )}

      {/* ── Upload Result Banner ── */}
      {uploadResult && (
        <div style={{
          background: 'var(--color-success-bg)', border: '1px solid rgba(34, 197, 94, 0.2)',
          borderRadius: '12px', padding: '14px 18px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap'
        }} className="animate-fade-in">
          <CheckCircle2 style={{ width: '18px', height: '18px', color: 'var(--color-success)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Import Successful
          </span>
          <div style={{ display: 'flex', gap: '16px', marginLeft: 'auto', fontSize: '12px', flexWrap: 'wrap' }}>
            <span><strong>{uploadResult.company}</strong></span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>
            <span><strong>{uploadResult.service}</strong></span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>|</span>
            <span><strong>{uploadResult.rates_inserted}</strong> rates</span>
            <span><strong>{uploadResult.zones_inserted}</strong> zones</span>
          </div>
          <button onClick={() => setUploadResult(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px'
          }}>
            <X style={{ width: '14px', height: '14px', color: 'var(--color-text-tertiary)' }} />
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      {companiesLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '48px', borderRadius: '12px' }} />
          ))}
        </div>
      ) : companies.length === 0 ? (
        /* ── Empty State ── */
        <div style={{
          background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)',
          padding: '60px 24px', textAlign: 'center'
        }}>
          <div style={{
            width: '64px', height: '64px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, rgba(187, 0, 19, 0.08), rgba(187, 0, 19, 0.03))',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FileSpreadsheet style={{ width: '28px', height: '28px', color: 'var(--color-primary)' }} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
            No Rates Configured
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', maxWidth: '420px', margin: '0 auto 20px' }}>
            Upload an Excel file to get started. The filename should be in the format <strong>"CompanyName ServiceName.xlsx"</strong> (e.g., "Flyshift AUS.xlsx" — first word is company, rest is service).
          </p>
          <button
            onClick={() => setShowUploadArea(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 24px', fontSize: '13px', fontWeight: 700,
              color: 'white', background: 'linear-gradient(135deg, #BB0013, #D4001A)',
              border: 'none', borderRadius: '10px', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(187, 0, 19, 0.25)'
            }}
          >
            <Upload style={{ width: '14px', height: '14px' }} />
            Upload First Rate Sheet
          </button>
        </div>
      ) : (
        /* ── Companies + Services + Data ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Company Tabs ── */}
          <div style={{
            background: 'var(--color-surface)', borderRadius: '14px', border: '1px solid var(--color-border)',
            padding: '4px', display: 'flex', gap: '2px', overflowX: 'auto'
          }}>
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => {
                  setSelectedCompanyId(company.id)
                  setSelectedServiceId(null)
                  setActiveDataTab('rates')
                }}
                style={{
                  padding: '10px 20px', borderRadius: '11px', border: 'none',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.25s ease',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: selectedCompanyId === company.id
                    ? 'linear-gradient(135deg, #BB0013, #D4001A)'
                    : 'transparent',
                  color: selectedCompanyId === company.id ? 'white' : 'var(--color-text-secondary)',
                  boxShadow: selectedCompanyId === company.id ? '0 2px 10px rgba(187, 0, 19, 0.25)' : 'none'
                }}
              >
                <Building2 style={{ width: '14px', height: '14px' }} />
                {company.name}
                <span style={{
                  fontSize: '11px',
                  background: selectedCompanyId === company.id ? 'rgba(255,255,255,0.2)' : 'var(--color-surface-alt)',
                  padding: '1px 8px', borderRadius: '6px',
                  opacity: selectedCompanyId === company.id ? 0.9 : 0.6
                }}>
                  {company.service_count}
                </span>
              </button>
            ))}
          </div>

          {/* ── Services Row ── */}
          {selectedCompanyId && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Delete Company Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers style={{ width: '14px', height: '14px' }} />
                  Services
                  {servicesLoading && <RefreshCw style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite', color: 'var(--color-text-tertiary)' }} />}
                </h3>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete company "${selectedCompany?.name}" and ALL its services? This cannot be undone.`))
                      deleteCompanyMutation.mutate(selectedCompanyId)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', fontSize: '11px', fontWeight: 600,
                    color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
                    border: '1px solid rgba(239, 68, 68, 0.12)', borderRadius: '8px',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  <Trash2 style={{ width: '11px', height: '11px' }} />
                  Delete Company
                </button>
              </div>

              {/* Service Cards */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => {
                      setSelectedServiceId(service.id)
                      setActiveDataTab('rates')
                      setEditingRateId(null)
                      setEditingZoneId(null)
                    }}
                    style={{
                      padding: '12px 18px', borderRadius: '12px',
                      border: selectedServiceId === service.id
                        ? '2px solid var(--color-primary)'
                        : '1.5px solid var(--color-border)',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      whiteSpace: 'nowrap', transition: 'all 0.2s',
                      background: selectedServiceId === service.id
                        ? 'rgba(187, 0, 19, 0.04)'
                        : 'var(--color-surface)',
                      color: selectedServiceId === service.id
                        ? 'var(--color-primary)'
                        : 'var(--color-text-primary)',
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
                      minWidth: '140px', position: 'relative'
                    }}
                  >
                    <span>{service.name}</span>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                      <span>{service.rate_count} rates</span>
                      <span>{service.zone_count} zones</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Data Area (Rates + Zones) ── */}
          {selectedServiceId && (
            <div style={{
              background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)',
              overflow: 'hidden'
            }} className="animate-fade-in">

              {/* Data Tab Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface-alt)', flexWrap: 'wrap', gap: '8px'
              }}>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    onClick={() => { setActiveDataTab('rates'); setEditingRateId(null) }}
                    style={{
                      padding: '8px 18px', borderRadius: '8px', border: 'none',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: activeDataTab === 'rates' ? 'linear-gradient(135deg, #BB0013, #D4001A)' : 'transparent',
                      color: activeDataTab === 'rates' ? 'white' : 'var(--color-text-secondary)',
                      boxShadow: activeDataTab === 'rates' ? '0 2px 8px rgba(187, 0, 19, 0.2)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Table2 style={{ width: '13px', height: '13px' }} />
                    Rates
                    <span style={{
                      fontSize: '11px', padding: '0 6px', borderRadius: '4px',
                      background: activeDataTab === 'rates' ? 'rgba(255,255,255,0.2)' : 'var(--color-border)',
                      opacity: 0.8
                    }}>{rates.length}</span>
                  </button>
                  <button
                    onClick={() => { setActiveDataTab('zones'); setEditingZoneId(null) }}
                    style={{
                      padding: '8px 18px', borderRadius: '8px', border: 'none',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: activeDataTab === 'zones' ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'transparent',
                      color: activeDataTab === 'zones' ? 'white' : 'var(--color-text-secondary)',
                      boxShadow: activeDataTab === 'zones' ? '0 2px 8px rgba(99, 102, 241, 0.2)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <MapPin style={{ width: '13px', height: '13px' }} />
                    Zones
                    <span style={{
                      fontSize: '11px', padding: '0 6px', borderRadius: '4px',
                      background: activeDataTab === 'zones' ? 'rgba(255,255,255,0.2)' : 'var(--color-border)',
                      opacity: 0.8
                    }}>{zonePagination.total || 0}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {/* Service name badge */}
                  <span style={{
                    fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)',
                    background: 'var(--color-surface)', padding: '4px 12px', borderRadius: '6px',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    {selectedCompany?.name} → {selectedService?.name}
                  </span>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete service "${selectedService?.name}" and all its data?`))
                        deleteServiceMutation.mutate(selectedServiceId)
                    }}
                    style={{
                      width: '30px', height: '30px', borderRadius: '8px',
                      border: 'none', background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    <Trash2 style={{ width: '13px', height: '13px' }} />
                  </button>
                </div>
              </div>

              {/* ── RATES TABLE ── */}
              {activeDataTab === 'rates' && (
                <div style={{ overflowX: 'auto' }}>
                  {ratesLoading ? (
                    <div style={{ padding: '24px' }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="skeleton" style={{ height: '40px', borderRadius: '8px', marginBottom: '8px' }} />
                      ))}
                    </div>
                  ) : rates.length === 0 ? (
                    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                      <Table2 style={{ width: '28px', height: '28px', color: 'var(--color-text-tertiary)', margin: '0 auto 10px', display: 'block' }} />
                      <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
                        No rate entries found for this service.
                      </p>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                          {['Weight', 'ZONE 1', 'ZONE 2', 'ZONE 3', 'ZONE 4', 'ZONE 5', 'ZONE 6', 'ZONE 7', 'ZONE 8', 'ZONE 9', 'ZONE 10', 'Actions'].map((h) => (
                            <th key={h} style={{
                              padding: '10px 12px', textAlign: h === 'Actions' ? 'center' : 'left',
                              fontSize: '11px', fontWeight: 700, color: 'var(--color-text-tertiary)',
                              textTransform: 'uppercase', letterSpacing: '0.5px',
                              background: 'var(--color-surface-alt)', whiteSpace: 'nowrap',
                              position: h === 'Weight' ? 'sticky' : 'static',
                              left: h === 'Weight' ? 0 : 'auto',
                              zIndex: h === 'Weight' ? 2 : 1
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rates.map((rate, idx) => (
                          <tr
                            key={rate.id}
                            style={{
                              borderBottom: idx < rates.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            {editingRateId === rate.id ? (
                              <>
                                {/* Weight */}
                                <td style={{ padding: '6px 8px', position: 'sticky', left: 0, background: 'var(--color-surface)', zIndex: 1 }}>
                                  <input
                                    type="text" value={editRateForm.weight}
                                    onChange={(e) => setEditRateForm({ ...editRateForm, weight: e.target.value })}
                                    style={editInputStyle}
                                  />
                                </td>
                                {/* Zone 1-10 */}
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((z) => (
                                  <td key={z} style={{ padding: '6px 8px' }}>
                                    <input
                                      type="number" step="0.01"
                                      value={editRateForm[`zone_${z}`]}
                                      onChange={(e) => setEditRateForm({ ...editRateForm, [`zone_${z}`]: parseFloat(e.target.value) || 0 })}
                                      style={editInputStyle}
                                    />
                                  </td>
                                ))}
                                {/* Actions */}
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                    <button
                                      onClick={() => updateRateMutation.mutate({ id: rate.id, data: editRateForm })}
                                      style={actionBtnStyle('#22C55E', '#F0FDF4')}
                                    >
                                      <Check style={{ width: '13px', height: '13px' }} />
                                    </button>
                                    <button onClick={() => setEditingRateId(null)} style={actionBtnStyle('#9CA3AF', '#F7F8FA')}>
                                      <X style={{ width: '13px', height: '13px' }} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                {/* Weight */}
                                <td style={{
                                  padding: '10px 12px', fontWeight: 700,
                                  position: 'sticky', left: 0, background: 'var(--color-surface)',
                                  zIndex: 1, borderRight: '1px solid var(--color-border-light)'
                                }}>
                                  {rate.weight}
                                </td>
                                {/* Zone 1-10 */}
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((z) => {
                                  const val = parseFloat(rate[`zone_${z}`])
                                  return (
                                    <td key={z} style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                      {val > 0 ? (
                                        <span style={{
                                          fontWeight: 600,
                                          color: 'var(--color-text-primary)',
                                          fontVariantNumeric: 'tabular-nums'
                                        }}>
                                          {val.toFixed(2)}
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--color-text-tertiary)' }}>–</span>
                                      )}
                                    </td>
                                  )
                                })}
                                {/* Actions */}
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <button onClick={() => startEditingRate(rate)} style={actionBtnStyle('var(--color-info)', 'var(--color-info-bg)')}>
                                    <Save style={{ width: '13px', height: '13px' }} />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ── ZONES TABLE ── */}
              {activeDataTab === 'zones' && (
                <div>
                  {/* Search bar */}
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-light)' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: 'var(--color-surface-alt)', border: '1.5px solid var(--color-border)',
                      borderRadius: '10px', padding: '0 12px', maxWidth: '360px'
                    }}>
                      <Search style={{ width: '14px', height: '14px', color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                      <input
                        type="text"
                        placeholder="Search postcode, city, or zone..."
                        value={zoneSearch}
                        onChange={(e) => { setZoneSearch(e.target.value); setZonePage(1) }}
                        style={{
                          flex: 1, border: 'none', background: 'transparent', padding: '9px 0',
                          fontSize: '13px', color: 'var(--color-text-primary)', outline: 'none',
                          fontFamily: 'var(--font-family-body)'
                        }}
                      />
                      {zoneSearch && (
                        <button onClick={() => { setZoneSearch(''); setZonePage(1) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                          <X style={{ width: '12px', height: '12px', color: 'var(--color-text-tertiary)' }} />
                        </button>
                      )}
                    </div>
                  </div>

                  {zonesLoading ? (
                    <div style={{ padding: '24px' }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="skeleton" style={{ height: '36px', borderRadius: '8px', marginBottom: '8px' }} />
                      ))}
                    </div>
                  ) : zones.length === 0 ? (
                    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                      <MapPin style={{ width: '28px', height: '28px', color: 'var(--color-text-tertiary)', margin: '0 auto 10px', display: 'block' }} />
                      <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
                        {zoneSearch ? 'No zones matching your search.' : 'No postcode-zone mappings found.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                              {['PostCode', 'City', 'Zone', 'Actions'].map((h) => (
                                <th key={h} style={{
                                  padding: '10px 16px', textAlign: h === 'Actions' ? 'center' : 'left',
                                  fontSize: '11px', fontWeight: 700, color: 'var(--color-text-tertiary)',
                                  textTransform: 'uppercase', letterSpacing: '0.5px',
                                  background: 'var(--color-surface-alt)'
                                }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {zones.map((zone, idx) => (
                              <tr
                                key={zone.id}
                                style={{
                                  borderBottom: idx < zones.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                {editingZoneId === zone.id ? (
                                  <>
                                    <td style={{ padding: '6px 12px' }}>
                                      <input
                                        type="text" value={editZoneForm.postcode}
                                        onChange={(e) => setEditZoneForm({ ...editZoneForm, postcode: e.target.value })}
                                        style={{ ...editInputStyle, width: '120px' }}
                                      />
                                    </td>
                                    <td style={{ padding: '6px 12px' }}>
                                      <input
                                        type="text" value={editZoneForm.city}
                                        onChange={(e) => setEditZoneForm({ ...editZoneForm, city: e.target.value })}
                                        style={{ ...editInputStyle, width: '160px' }}
                                      />
                                    </td>
                                    <td style={{ padding: '6px 12px' }}>
                                      <input
                                        type="text" value={editZoneForm.zone}
                                        onChange={(e) => setEditZoneForm({ ...editZoneForm, zone: e.target.value })}
                                        style={{ ...editInputStyle, width: '120px' }}
                                      />
                                    </td>
                                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                        <button
                                          onClick={() => updateZoneMutation.mutate({ id: zone.id, data: editZoneForm })}
                                          style={actionBtnStyle('#22C55E', '#F0FDF4')}
                                        >
                                          <Check style={{ width: '13px', height: '13px' }} />
                                        </button>
                                        <button onClick={() => setEditingZoneId(null)} style={actionBtnStyle('#9CA3AF', '#F7F8FA')}>
                                          <X style={{ width: '13px', height: '13px' }} />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td style={{ padding: '10px 16px' }}>
                                      <span style={{
                                        fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                                        background: 'var(--color-surface-alt)', padding: '3px 10px',
                                        borderRadius: '6px', fontSize: '13px'
                                      }}>
                                        {zone.postcode}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 16px', color: zone.city ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                                      {zone.city || '–'}
                                    </td>
                                    <td style={{ padding: '10px 16px' }}>
                                      <span style={{
                                        fontSize: '11px', fontWeight: 700,
                                        padding: '3px 10px', borderRadius: '6px',
                                        background: getZoneColor(zone.zone).bg,
                                        color: getZoneColor(zone.zone).text
                                      }}>
                                        {zone.zone}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                      <button onClick={() => startEditingZone(zone)} style={actionBtnStyle('var(--color-info)', 'var(--color-info-bg)')}>
                                        <Save style={{ width: '13px', height: '13px' }} />
                                      </button>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {zonePagination.totalPages > 1 && (
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', borderTop: '1px solid var(--color-border-light)',
                          fontSize: '12px', color: 'var(--color-text-tertiary)'
                        }}>
                          <span>
                            Showing {((zonePage - 1) * 100) + 1}–{Math.min(zonePage * 100, zonePagination.total)} of {zonePagination.total}
                          </span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() => setZonePage(Math.max(1, zonePage - 1))}
                              disabled={zonePage <= 1}
                              style={paginationBtnStyle(zonePage <= 1)}
                            >
                              ← Prev
                            </button>
                            <span style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600 }}>
                              {zonePage} / {zonePagination.totalPages}
                            </span>
                            <button
                              onClick={() => setZonePage(Math.min(zonePagination.totalPages, zonePage + 1))}
                              disabled={zonePage >= zonePagination.totalPages}
                              style={paginationBtnStyle(zonePage >= zonePagination.totalPages)}
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helper: Zone color mapping ──
function getZoneColor(zone) {
  const zoneNum = parseInt(String(zone).replace(/\D/g, '')) || 0
  const colors = [
    { bg: '#EFF6FF', text: '#3B82F6' },   // 1 - blue
    { bg: '#F0FDF4', text: '#22C55E' },   // 2 - green
    { bg: '#FFFBEB', text: '#F59E0B' },   // 3 - amber
    { bg: '#FEF2F2', text: '#EF4444' },   // 4 - red
    { bg: '#F5F3FF', text: '#8B5CF6' },   // 5 - violet
    { bg: '#FFF1F2', text: '#FB7185' },   // 6 - rose
    { bg: '#ECFDF5', text: '#10B981' },   // 7 - emerald
    { bg: '#FEF3C7', text: '#D97706' },   // 8 - yellow
    { bg: '#E0E7FF', text: '#6366F1' },   // 9 - indigo
    { bg: '#FCE7F3', text: '#EC4899' },   // 10 - pink
  ]
  return colors[(zoneNum - 1) % colors.length] || { bg: '#F7F8FA', text: '#6B7280' }
}

// ── Shared Styles ──
const editInputStyle = {
  width: '72px', padding: '5px 8px', fontSize: '12px',
  border: '1.5px solid var(--color-border)', borderRadius: '6px',
  background: 'var(--color-surface)', color: 'var(--color-text-primary)',
  outline: 'none', fontFamily: 'var(--font-family-body)',
  transition: 'border-color 0.2s'
}

const actionBtnStyle = (color, bg) => ({
  width: '30px', height: '30px', borderRadius: '8px',
  border: 'none', background: bg, color: color,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'all 0.15s'
})

const paginationBtnStyle = (disabled) => ({
  padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
  border: '1px solid var(--color-border)', cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? 'var(--color-surface-alt)' : 'var(--color-surface)',
  color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
  opacity: disabled ? 0.5 : 1, transition: 'all 0.15s'
})
