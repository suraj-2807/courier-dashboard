import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLiveTracking } from '../hooks/useTracking'
import { getActiveVendors } from '../api/apiSettings.api'
import toast from 'react-hot-toast'
import {
  Search,
  Package,
  MapPin,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  RefreshCw,
  Plane,
  Box,
  CircleDot,
  AlertCircle,
  Globe,
  Hash,
  Calendar,
  Weight,
  User,
  Building2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Activity,
  Terminal,
  Server,
  Zap,
  ShieldCheck,
  Code
} from 'lucide-react'

// ─── Progress Stage Definitions ─────────────────────────────────────
const STAGES = [
  { key: 'booked', label: 'Booked', icon: Box },
  { key: 'picked_up', label: 'Picked Up', icon: Package },
  { key: 'in_transit', label: 'In Transit', icon: Plane },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 }
]

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]))

// ─── Event status → color mapping ──────────────────────────────────
function getEventColor(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('delivered')) return { dot: 'bg-emerald-500', ring: 'ring-emerald-500/20', text: 'text-emerald-700', bg: 'bg-emerald-50' }
  if (s.includes('out for delivery')) return { dot: 'bg-amber-500', ring: 'ring-amber-500/20', text: 'text-amber-700', bg: 'bg-amber-50' }
  if (s.includes('delay') || s.includes('sorry') || s.includes('reroute')) return { dot: 'bg-red-500', ring: 'ring-red-500/20', text: 'text-red-700', bg: 'bg-red-50' }
  if (s.includes('departed') || s.includes('arrived') || s.includes('transit') || s.includes('scan') || s.includes('processing')) return { dot: 'bg-blue-500', ring: 'ring-blue-500/20', text: 'text-blue-700', bg: 'bg-blue-50' }
  if (s.includes('received') || s.includes('sent') || s.includes('label') || s.includes('origin')) return { dot: 'bg-violet-500', ring: 'ring-violet-500/20', text: 'text-violet-700', bg: 'bg-violet-50' }
  return { dot: 'bg-gray-400', ring: 'ring-gray-400/20', text: 'text-gray-600', bg: 'bg-gray-50' }
}

export default function TrackingPage() {
  const [inputValue, setInputValue] = useState('')
  const [awb, setAwb] = useState('')
  const [vendorCode, setVendorCode] = useState('')
  const [showLogDrawer, setShowLogDrawer] = useState(false)
  const [lastSyncedTime, setLastSyncedTime] = useState(null)

  // Fetch active vendors dynamically from backend DB
  const { data: vendorsData } = useQuery({
    queryKey: ['active-vendors'],
    queryFn: getActiveVendors,
    staleTime: 60000
  })

  const configuredVendors = vendorsData?.vendors || []

  const vendorOptions = useMemo(() => {
    const list = [{ value: '', label: 'Auto Detect (All Vendors)' }]
    if (configuredVendors.length > 0) {
      configuredVendors.forEach(v => {
        list.push({
          value: v.vendor_code || v.name.toLowerCase().replace(/\s+/g, ''),
          label: v.name || v.vendor_code
        })
      })
    } else {
      // Fallback defaults
      list.push(
        { value: 'pacific', label: 'Pacific Express' },
        { value: 'flyswift', label: 'FlySwift' },
        { value: 'acx', label: 'ACX International' },
        { value: 'bhabani', label: 'Bhabani Express' }
      )
    }
    return list
  }, [configuredVendors])

  const { data, isLoading, isFetching, isError, error, refetch } = useLiveTracking(awb, vendorCode)
  const tracking = data?.tracking

  const handleSearch = (e) => {
    e.preventDefault()
    if (inputValue.trim()) {
      setAwb(inputValue.trim())
      setLastSyncedTime(new Date())
    }
  }

  const handleRefresh = async () => {
    if (!awb) return
    const vendorName = tracking?.vendor || vendorCode || 'Carrier'
    const toastId = toast.loading(`Pushing live tracking sync to ${vendorName} API...`)
    try {
      await refetch()
      setLastSyncedTime(new Date())
      toast.success(`Live tracking updated from ${vendorName} API!`, { id: toastId })
    } catch {
      toast.error('Failed to sync live tracking', { id: toastId })
    }
  }

  // Compute progress
  const activeStageIdx = useMemo(() => {
    if (!tracking) return -1
    let stage = tracking.currentStage

    // Comprehensive fallback across events & status text
    const allText = [
      tracking.currentStatus,
      tracking.shipmentInfo?.status,
      ...(Array.isArray(tracking.events) ? tracking.events.map(e => e.status) : [])
    ].join(' ').toLowerCase()

    if (/delivered|dlvd|signed by/i.test(allText) && !/out for delivery/i.test(tracking.currentStatus?.toLowerCase() || '')) {
      stage = 'delivered'
    } else if (/out for delivery|ofd|with courier|out for del|today.*delivery|for delivery/i.test(allText)) {
      stage = 'out_for_delivery'
    } else if (/transit|depart|arriv|custom|hub|facility|tranship|clearance|flight|in-transit|scan|hold|processing/i.test(allText)) {
      if (stage !== 'out_for_delivery' && stage !== 'delivered') stage = 'in_transit'
    } else if (/picked|pickup|received|origin scan|collected|manifest/i.test(allText)) {
      if (stage === 'booked') stage = 'picked_up'
    }

    return STAGE_INDEX[stage] ?? (STAGE_INDEX[tracking.currentStage] ?? 0)
  }, [tracking])

  const formattedSyncTime = useMemo(() => {
    if (lastSyncedTime) {
      return lastSyncedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
    if (tracking?.apiLog?.timestamp) {
      return new Date(tracking.apiLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }, [lastSyncedTime, tracking])

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-text-primary leading-tight">
          Live Tracking
        </h1>
        <p className="text-[13px] text-text-secondary mt-1">
          Track shipments in real-time across all configured vendors with direct API sync.
        </p>
      </div>

      {/* ── Search Section ─────────────────────────────────────────── */}
      <div className="mb-6">
        <div
          className="bg-surface rounded-2xl overflow-hidden"
          style={{
            border: '1px solid transparent',
            backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, #BB0013 0%, #FF4D6A 50%, #BB0013 100%)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box'
          }}
        >
          <div className="p-5">
            <form onSubmit={handleSearch}>
              <div className="flex gap-3 items-end">
                {/* AWB Input */}
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-2 block">
                    AWB / Tracking Number / Order ID
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-text-tertiary pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Enter AWB, Tracking No, or Order ID (e.g., ACX, Bhabani, Pacific)..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-alt border border-border rounded-xl text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                  </div>
                </div>

                {/* Vendor Selector */}
                <div className="w-[200px]">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-2 block">
                    Vendor API
                  </label>
                  <div className="relative">
                    <select
                      value={vendorCode}
                      onChange={(e) => setVendorCode(e.target.value)}
                      className="w-full py-2.5 px-3.5 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all appearance-none cursor-pointer pr-8"
                    >
                      {vendorOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
                  </div>
                </div>

                {/* Track Button */}
                <button
                  type="submit"
                  disabled={isLoading || isFetching || !inputValue.trim()}
                  className="px-7 py-2.5 bg-primary hover:bg-primary-dark text-white text-[13px] font-bold rounded-xl transition-all cursor-pointer hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading || isFetching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  Track
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ── Loading State ──────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-4 animate-fade-in">
          <div className="skeleton h-[100px] rounded-2xl" />
          <div className="skeleton h-[200px] rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 skeleton h-[180px] rounded-2xl" />
            <div className="skeleton h-[300px] rounded-2xl" />
          </div>
        </div>
      )}

      {/* ── Error State ────────────────────────────────────────────── */}
      {isError && awb && !isLoading && (
        <div className="bg-surface border border-border rounded-2xl p-14 text-center animate-fade-in">
          <div className="w-16 h-16 bg-danger-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-danger" />
          </div>
          <h3 className="text-[16px] font-bold text-text-primary mb-1.5">Tracking Not Found</h3>
          <p className="text-[13px] text-text-secondary max-w-md mx-auto mb-4">
            {error?.response?.data?.message || `No tracking data found for AWB "${awb}". Please check the number or verify your vendor API settings.`}
          </p>
          <button
            onClick={handleRefresh}
            className="px-5 py-2 bg-surface-alt hover:bg-surface-hover border border-border rounded-xl text-[13px] font-bold text-text-primary transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Sync
          </button>
        </div>
      )}

      {/* ── Default Empty State ────────────────────────────────────── */}
      {!awb && !isLoading && (
        <div className="bg-surface border border-border rounded-2xl p-20 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-primary/5 to-primary/15 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <Globe className="w-10 h-10 text-primary/60" />
          </div>
          <h3 className="text-[18px] font-bold text-text-primary mb-2">Track Your Shipment Live</h3>
          <p className="text-[13px] text-text-secondary max-w-md mx-auto leading-relaxed">
            Enter a tracking number or AWB to fetch live status, route events, and carrier waybills via direct API integration.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
            {(configuredVendors.length > 0 ? configuredVendors.map(v => v.name) : ['Pacific Express', 'FlySwift', 'ACX International', 'Bhabani Express']).map(v => (
              <span key={v} className="px-3 py-1.5 bg-surface-alt border border-border rounded-lg text-[11px] font-bold text-text-secondary">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── Tracking Result ──────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tracking && !isLoading && (
        <div className="space-y-4 animate-fade-in">

          {/* ── Live API Sync Status Banner & Log Panel ────────────────── */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <span className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute" />
                  <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full relative z-10" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold text-emerald-900">
                      LIVE API SYNCED: {tracking.vendor}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-200/60 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wider">
                      HTTP {tracking.apiLog?.httpStatus || 200} OK
                    </span>
                    {tracking.apiLog?.latencyMs && (
                      <span className="text-[11px] font-mono font-bold text-emerald-700">
                        ⚡ {tracking.apiLog.latencyMs}ms
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Last refreshed: <span className="font-semibold">{formattedSyncTime}</span> • Real-time carrier events: <span className="font-semibold">{tracking.events?.length || 0}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLogDrawer(!showLogDrawer)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-100/50 border border-emerald-300 text-emerald-800 text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-700" />
                  {showLogDrawer ? 'Hide API Log' : 'View API Sync Log'}
                  {showLogDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <button
                  onClick={handleRefresh}
                  disabled={isFetching}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  title="Push fresh tracking request to vendor API"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                  {isFetching ? 'Pushing Sync...' : 'Refresh API'}
                </button>
              </div>
            </div>

            {/* Collapsible API Sync Log Inspector */}
            {showLogDrawer && (
              <div className="mt-3.5 pt-3.5 border-t border-emerald-200/60 text-[11px] font-mono text-emerald-950 bg-white/80 rounded-xl p-3.5 space-y-2 border border-emerald-100 animate-fade-in">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <Server className="w-3.5 h-3.5 text-emerald-600" />
                    Vendor Integration Details
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                    Direct Gateway Sync
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-emerald-700 font-sans font-bold block text-[10px] uppercase">Queried Endpoint:</span>
                    <span className="break-all text-slate-800 font-mono select-all bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                      {tracking.apiLog?.endpoint || 'Direct Vendor REST Gateway'}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-700 font-sans font-bold block text-[10px] uppercase">Vendor Engine & Status:</span>
                    <span className="text-slate-800 font-mono">
                      {tracking.vendor} ({tracking.vendorCode || 'api'}) • Status: {tracking.currentStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-700 font-sans font-bold block text-[10px] uppercase">Database Sync:</span>
                    <span className="text-emerald-800 font-medium">
                      ✓ Shipments & tracking_events tables updated automatically
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-700 font-sans font-bold block text-[10px] uppercase">Response Message:</span>
                    <span className="text-slate-700">
                      {tracking.apiLog?.message || 'Sync completed successfully'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Progress Stepper ────────────────────────────────────── */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold text-text-primary">Shipment Progress</h2>
                <span className="px-2.5 py-0.5 bg-primary/8 text-primary text-[10px] font-bold rounded-full uppercase tracking-wider">
                  {tracking.vendor}
                </span>
              </div>
              <button
                onClick={handleRefresh}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer group"
                title="Refresh tracking"
              >
                <RefreshCw className={`w-4 h-4 text-text-tertiary group-hover:text-primary transition-colors ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-between relative">
              {/* Background line */}
              <div className="absolute top-[18px] left-[36px] right-[36px] h-[3px] bg-border rounded-full" />
              {/* Active line */}
              {activeStageIdx >= 0 && (
                <div
                  className="absolute top-[18px] left-[36px] h-[3px] bg-gradient-to-r from-primary to-primary-light rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${activeStageIdx === 0 ? 0 : (activeStageIdx / (STAGES.length - 1)) * (100 - (72 / (typeof window !== 'undefined' ? window.innerWidth : 1000)) * 100)}%`,
                    maxWidth: `calc(100% - 72px)`
                  }}
                />
              )}

              {STAGES.map((stage, idx) => {
                const isCompleted = idx <= activeStageIdx
                const isCurrent = idx === activeStageIdx
                const StageIcon = stage.icon

                return (
                  <div key={stage.key} className="flex flex-col items-center relative z-10" style={{ width: '72px' }}>
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isCurrent
                          ? 'bg-primary text-white shadow-lg shadow-primary/30 ring-4 ring-primary/15'
                          : isCompleted
                            ? 'bg-primary text-white'
                            : 'bg-surface border-2 border-border text-text-tertiary'
                      }`}
                    >
                      <StageIcon className="w-4 h-4" />
                      {isCurrent && (
                        <span className="absolute w-9 h-9 rounded-full bg-primary/20 animate-ping" />
                      )}
                    </div>
                    <span className={`text-[10px] font-bold mt-2 text-center leading-tight ${
                      isCompleted ? 'text-primary' : 'text-text-tertiary'
                    }`}>
                      {stage.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Shipment Summary + Route ────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Left: Summary Card */}
            <div className="lg:col-span-2 space-y-4">
              {/* Main Info */}
              <div className="bg-surface border border-border rounded-2xl p-5">
                <h2 className="text-[14px] font-bold text-text-primary mb-4 flex items-center gap-2">
                  <div className="w-7 h-7 bg-primary/8 rounded-lg flex items-center justify-center">
                    <Package className="w-3.5 h-3.5 text-primary" />
                  </div>
                  Shipment Details
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-5">
                  {tracking.internalShipment?.ourAwb && (
                    <InfoItem icon={Hash} label="Our AWB" value={tracking.internalShipment.ourAwb} mono highlight />
                  )}
                  <InfoItem icon={Hash} label="Vendor AWB" value={tracking.shipmentInfo.awbNo} mono />
                  {tracking.shipmentInfo.vendorAwbNo && (
                    <InfoItem 
                      icon={Hash} 
                      label={tracking.shipmentInfo.secondaryCarrier ? `${tracking.shipmentInfo.secondaryCarrier} AWB` : "Carrier AWB"} 
                      value={tracking.shipmentInfo.vendorAwbNo} 
                      mono 
                    />
                  )}
                  <InfoItem icon={Truck} label="Carrier" value={tracking.shipmentInfo.vendorName || tracking.vendor} />
                  <InfoItem icon={Package} label="Service" value={tracking.shipmentInfo.serviceName || '—'} />
                  <InfoItem icon={Calendar} label="Booking Date" value={tracking.shipmentInfo.bookingDate || '—'} />
                  <InfoItem icon={Weight} label="Weight" value={tracking.shipmentInfo.weight ? `${tracking.shipmentInfo.weight} kg` : '—'} />
                  <InfoItem
                    icon={CheckCircle2}
                    label="Current Status"
                    value={tracking.currentStatus}
                    highlight
                  />
                </div>

                {tracking.shipmentInfo.deliveryDate && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[11px] text-text-tertiary font-bold">Delivered On</p>
                        <p className="text-[13px] font-bold text-emerald-600">
                          {tracking.shipmentInfo.deliveryDate} {tracking.shipmentInfo.deliveryTime && `at ${tracking.shipmentInfo.deliveryTime}`}
                        </p>
                      </div>
                      {tracking.shipmentInfo.receiverName && (
                        <div className="ml-auto">
                          <p className="text-[11px] text-text-tertiary font-bold">Received By</p>
                          <p className="text-[13px] font-bold text-text-primary">{tracking.shipmentInfo.receiverName}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Route Card — Origin → Destination */}
              <div className="bg-surface border border-border rounded-2xl p-5">
                <h2 className="text-[14px] font-bold text-text-primary mb-4 flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  Route Information
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                  {/* Origin */}
                  <div className="bg-surface-alt rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-3 h-3 text-blue-600" />
                      </div>
                      <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px]">Origin</span>
                    </div>
                    <p className="text-[14px] font-bold text-text-primary">{tracking.shipmentInfo.origin || '—'}</p>
                    <p className="text-[12px] text-text-secondary">{tracking.shipmentInfo.originCountry}</p>
                    {tracking.shipmentInfo.shipperName && (
                      <p className="text-[11px] text-text-tertiary mt-1.5 flex items-center gap-1">
                        <User className="w-3 h-3" /> {tracking.shipmentInfo.shipperName}
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className="hidden sm:flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-0.5">
                      <div className="w-8 h-[2px] bg-gradient-to-r from-blue-400 to-transparent rounded-full" />
                      <Plane className="w-5 h-5 text-primary -rotate-0" />
                      <div className="w-8 h-[2px] bg-gradient-to-l from-emerald-400 to-transparent rounded-full" />
                    </div>
                    <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-wider">In Transit</span>
                  </div>

                  {/* Destination */}
                  <div className="bg-surface-alt rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px]">Destination</span>
                    </div>
                    <p className="text-[14px] font-bold text-text-primary">{tracking.shipmentInfo.destination || '—'}</p>
                    <p className="text-[12px] text-text-secondary">{tracking.shipmentInfo.destinationCountry}</p>
                    {tracking.shipmentInfo.consignee && (
                      <p className="text-[11px] text-text-tertiary mt-1.5 flex items-center gap-1">
                        <User className="w-3 h-3" /> {tracking.shipmentInfo.consignee}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: Live Timeline ────────────────────────────────── */}
            <div className="bg-surface border border-border rounded-2xl self-start" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <div className="p-5 border-b border-border sticky top-0 bg-surface z-10 rounded-t-2xl">
                <h2 className="text-[14px] font-bold text-text-primary flex items-center gap-2">
                  <div className="w-7 h-7 bg-primary/8 rounded-lg flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                  </div>
                  Live Events
                  <span className="ml-auto text-[11px] font-medium text-text-tertiary bg-surface-alt px-2 py-0.5 rounded-full">
                    {tracking.events?.length || 0}
                  </span>
                </h2>
              </div>

              <div className="p-5">
                {tracking.events?.length > 0 ? (
                  <div className="stagger">
                    {tracking.events.map((event, idx) => {
                      const isFirst = idx === 0
                      const isLast = idx === tracking.events.length - 1
                      const color = getEventColor(event.status)

                      return (
                        <div key={idx} className="flex gap-3.5">
                          {/* Timeline line & dot */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-3 h-3 rounded-full flex-shrink-0 ring-4 transition-all ${color.dot} ${color.ring} ${
                                isFirst ? 'scale-125' : ''
                              }`}
                            >
                              {isFirst && (
                                <span className={`absolute w-3 h-3 rounded-full ${color.dot} opacity-50 animate-ping`} />
                              )}
                            </div>
                            {!isLast && (
                              <div className={`w-[1.5px] flex-1 min-h-[36px] ${
                                isFirst ? 'bg-gradient-to-b from-primary/40 to-border' : 'bg-border'
                              }`} />
                            )}
                          </div>

                          {/* Content */}
                          <div className={`pb-5 flex-1 min-w-0 -mt-0.5 ${isFirst ? '' : ''}`}>
                            <div className={`rounded-lg px-2.5 py-1.5 -mx-1 ${isFirst ? color.bg : ''}`}>
                              <p className={`text-[12px] font-bold leading-snug ${
                                isFirst ? color.text : 'text-text-primary'
                              }`}>
                                {event.status}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                {event.location && (
                                  <span className="text-[10px] text-text-secondary flex items-center gap-0.5 font-medium">
                                    <MapPin className="w-2.5 h-2.5" /> {event.location}
                                  </span>
                                )}
                                <span className="text-[10px] text-text-tertiary font-medium">
                                  {event.date}{event.time ? ` · ${event.time}` : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 bg-surface-alt rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-text-tertiary" />
                    </div>
                    <p className="text-[13px] text-text-tertiary">No tracking events yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Dimensions Breakdown (if returned by carrier) ────────── */}
          {Array.isArray(tracking.dimensions) && tracking.dimensions.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <h2 className="text-[14px] font-bold text-text-primary mb-3 flex items-center gap-2">
                <div className="w-7 h-7 bg-primary/8 rounded-lg flex items-center justify-center">
                  <Box className="w-3.5 h-3.5 text-primary" />
                </div>
                Box Dimensions ({tracking.dimensions.length} {tracking.dimensions.length === 1 ? 'Box' : 'Boxes'})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-border text-text-tertiary uppercase text-[10px] tracking-wider">
                      <th className="py-2 px-3">Box #</th>
                      <th className="py-2 px-3">Actual Weight (kg)</th>
                      <th className="py-2 px-3">Length (cm)</th>
                      <th className="py-2 px-3">Width (cm)</th>
                      <th className="py-2 px-3">Height (cm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 font-medium">
                    {tracking.dimensions.map((dim, dIdx) => (
                      <tr key={dIdx} className="hover:bg-surface-alt/50">
                        <td className="py-2.5 px-3 font-bold text-text-primary">Box {dIdx + 1}</td>
                        <td className="py-2.5 px-3">{dim.ActualWeight || dim.weight || dim.actual_weight || '—'}</td>
                        <td className="py-2.5 px-3">{dim.Vol_WeightL || dim.length || '—'}</td>
                        <td className="py-2.5 px-3">{dim.Vol_WeightW || dim.width || dim.breadth || '—'}</td>
                        <td className="py-2.5 px-3">{dim.Vol_WeightH || dim.height || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Performa Items (if returned by carrier) ──────────────── */}
          {Array.isArray(tracking.performa) && tracking.performa.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <h2 className="text-[14px] font-bold text-text-primary mb-3 flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                Performa Invoice Items ({tracking.performa.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-border text-text-tertiary uppercase text-[10px] tracking-wider">
                      <th className="py-2 px-3">Box</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3">HSN Code</th>
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 font-medium">
                    {tracking.performa.map((item, pIdx) => (
                      <tr key={pIdx} className="hover:bg-surface-alt/50">
                        <td className="py-2.5 px-3 font-bold text-text-primary">{item.BoxNo || `Box-${pIdx + 1}`}</td>
                        <td className="py-2.5 px-3 text-text-secondary">{item.Description || item.description || '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-text-tertiary">{item.HSNCode || item.hsn_code || '—'}</td>
                        <td className="py-2.5 px-3 text-center">{item.Quantity || item.quantity || 1} {item.Unit || 'PCS'}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{item.Rate || item.rate || '0.00'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-text-primary">{item.Amount || item.amount || '0.00'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Vendor Remark ───────────────────────────────────────── */}
          {tracking.shipmentInfo.remark && (
            <div className="bg-amber-50 border border-amber-200/50 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">Vendor Remark</p>
                <p className="text-[13px] text-amber-800">{tracking.shipmentInfo.remark}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Reusable Info Item ─────────────────────────────────────────────
function InfoItem({ icon: Icon, label, value, mono, highlight }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>
      <p className={`text-[13px] font-bold ${
        highlight ? 'text-primary' : 'text-text-primary'
      } ${mono ? 'font-mono' : ''} truncate`}>
        {value || '—'}
      </p>
    </div>
  )
}
