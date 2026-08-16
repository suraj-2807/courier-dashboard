import { useState, useMemo } from 'react'
import { useLiveTracking } from '../hooks/useTracking'
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
  Loader2
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
  const [showVendorSelect, setShowVendorSelect] = useState(false)

  const { data, isLoading, isError, error, refetch } = useLiveTracking(awb, vendorCode)
  const tracking = data?.tracking

  const handleSearch = (e) => {
    e.preventDefault()
    if (inputValue.trim()) {
      setAwb(inputValue.trim())
    }
  }

  const handleRefresh = () => {
    if (awb) refetch()
  }

  // Compute progress
  const activeStageIdx = useMemo(() => {
    if (!tracking) return -1
    return STAGE_INDEX[tracking.currentStage] ?? 0
  }, [tracking])

  const vendorOptions = [
    { value: '', label: 'Auto Detect' },
    { value: 'pacific', label: 'Pacific Express' },
    { value: 'flyswift', label: 'FlySwift' },
    { value: 'acx', label: 'ACX International' }
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-text-primary leading-tight">
          Live Tracking
        </h1>
        <p className="text-[13px] text-text-secondary mt-1">
          Track shipments in real-time across all vendors with live status updates.
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
                    AWB / Tracking Number
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-text-tertiary pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Enter AWB or tracking number..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-alt border border-border rounded-xl text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                  </div>
                </div>

                {/* Vendor Selector */}
                <div className="w-[180px]">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-2 block">
                    Vendor
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
                  disabled={isLoading || !inputValue.trim()}
                  className="px-7 py-2.5 bg-primary hover:bg-primary-dark text-white text-[13px] font-bold rounded-xl transition-all cursor-pointer hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
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
            {error?.response?.data?.message || `No tracking data found for AWB "${awb}". Please check the number and try again.`}
          </p>
          <button
            onClick={handleRefresh}
            className="px-5 py-2 bg-surface-alt hover:bg-surface-hover border border-border rounded-xl text-[13px] font-bold text-text-primary transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* ── Default Empty State ────────────────────────────────────── */}
      {!awb && !isLoading && (
        <div className="bg-surface border border-border rounded-2xl p-20 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-primary/5 to-primary/15 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <Globe className="w-10 h-10 text-primary/60" />
          </div>
          <h3 className="text-[18px] font-bold text-text-primary mb-2">Track Your Shipment</h3>
          <p className="text-[13px] text-text-secondary max-w-md mx-auto leading-relaxed">
            Enter a tracking number or AWB to see real-time shipment status, route events, and delivery details from Pacific Express & FlySwift.
          </p>
          <div className="flex items-center justify-center gap-4 mt-6">
            {['Pacific Express', 'FlySwift'].map(v => (
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
                <RefreshCw className="w-4 h-4 text-text-tertiary group-hover:text-primary transition-colors" />
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
