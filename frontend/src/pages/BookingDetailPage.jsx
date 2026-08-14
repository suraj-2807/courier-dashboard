import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useBookingById, usePushBookingToApi } from '../hooks/useBookings'
import { bookingsApi } from '../api/bookings.api'
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Weight,
  Ruler,
  CreditCard,
  FileText,
  CheckCircle2,
  Clock,
  RefreshCw,
  Truck,
  ArrowRight,
  Copy,
  Plug,
  ExternalLink,
  Download,
  ChevronDown,
  ChevronUp,
  Zap,
  XCircle,
  Send,
  Lock,
  Loader2
} from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters'
import toast from 'react-hot-toast'

export default function BookingDetailPage() {
  const { id } = useParams()
  const { data, isLoading, isError, refetch } = useBookingById(id)
  const booking = data?.booking
  const pushToApiMutation = usePushBookingToApi()
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const copyTracking = () => {
    if (booking?.tracking_number) {
      navigator.clipboard.writeText(booking.tracking_number)
      toast.success('Our AWB copied!')
    }
  }

  const handleDownloadInvoice = async () => {
    setDownloadingPdf(true)
    try {
      const res = await bookingsApi.downloadInvoice(id)
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Invoice_${booking.tracking_number}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Invoice PDF downloaded!')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to download invoice PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handlePushToApi = async () => {
    try {
      const res = await pushToApiMutation.mutateAsync(id)
      toast.success(res.message || 'Booking pushed to Vendor API successfully!')
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to push to Vendor API')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton h-8 w-72" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="skeleton h-[200px] rounded-2xl" />
            <div className="grid grid-cols-2 gap-4">
              <div className="skeleton h-[160px] rounded-2xl" />
              <div className="skeleton h-[160px] rounded-2xl" />
            </div>
          </div>
          <div className="skeleton h-[400px] rounded-2xl" />
        </div>
      </div>
    )
  }

  if (isError || !booking) {
    return (
      <div className="animate-fade-in">
        <Link to="/bookings" className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Shipments
        </Link>
        <div className="bg-surface border border-border rounded-2xl p-16 text-center">
          <Package className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
          <h3 className="text-lg font-bold text-text-primary mb-1">Booking Not Found</h3>
          <p className="text-[13px] text-text-secondary">The booking you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const sender = booking.senders
  const receiver = booking.receivers
  const courier = booking.courier_providers
  const vendorConfig = booking.vendor_api_configs
  const events = booking.tracking_events || []

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <Link
        to="/bookings"
        className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Shipments
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[24px] font-extrabold text-[#BB0013]">
              AWB: {booking.tracking_number}
            </h1>
            <StatusBadge status={booking.status} size="md" />
            {booking.is_locked ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
                <Lock className="w-3 h-3" /> Locked (Pushed)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                Draft (Editable)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            {/* Our AWB */}
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-1 rounded-lg">
              <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider">Our AWB:</span>
              <button
                onClick={copyTracking}
                className="inline-flex items-center gap-1 text-[13px] font-mono font-extrabold text-[#BB0013] hover:underline cursor-pointer"
                title="Copy Our AWB"
              >
                {booking.tracking_number}
                <Copy className="w-3 h-3 text-red-400" />
              </button>
            </div>

            {/* Vendor AWB 1 */}
            {booking.vendor_awb_number && (
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg">
                <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Vendor AWB1:</span>
                <span className="text-[13px] font-mono font-extrabold text-[#1a237e]">
                  {booking.vendor_awb_number}
                </span>
              </div>
            )}

            {/* Vendor AWB 2 */}
            {booking.vendor_awb_number_2 && (
              <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 px-3 py-1 rounded-lg">
                <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Vendor AWB2:</span>
                <span className="text-[13px] font-mono font-extrabold text-purple-900">
                  {booking.vendor_awb_number_2}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Download Invoice PDF */}
          <button
            onClick={handleDownloadInvoice}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1a237e] hover:bg-[#0d1754] text-white text-[12px] font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download Invoice PDF
          </button>

          {/* Push to API button for draft / unlocked bookings */}
          {!booking.is_locked && booking.vendor_config_id && (
            <button
              onClick={handlePushToApi}
              disabled={pushToApiMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#BB0013] hover:bg-[#990010] text-white text-[12px] font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {pushToApiMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Push to Vendor API
            </button>
          )}

          <button
            onClick={refetch}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-[12px] font-bold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left */}
        <div className="lg:col-span-2 space-y-4">
          {/* Shipment Details */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <h2 className="text-[14px] font-bold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-primary" />
              </div>
              Shipment Details
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
              <InfoField icon={Calendar} label="Booked On" value={formatDate(booking.created_at)} />
              <InfoField icon={Truck} label="Courier" value={courier?.name || '—'} />
              <InfoField icon={Weight} label="Weight" value={booking.weight ? `${booking.weight} kg` : '—'} />
              <InfoField icon={CreditCard} label="Payment" value={booking.payment_mode?.toUpperCase() || '—'} />
              <InfoField
                icon={Ruler}
                label="Dimensions"
                value={booking.length ? `${booking.length}×${booking.breadth}×${booking.height} cm` : '—'}
              />
              <InfoField icon={Package} label="Package" value={booking.package_type || '—'} />
              <InfoField icon={FileText} label="Reference" value={booking.order_reference || '—'} />
              <InfoField icon={CreditCard} label="Amount" value={formatCurrency(booking.total_amount)} highlight />
            </div>
            {booking.remarks && (
              <div className="mt-4 p-3 bg-surface-alt rounded-xl border border-border-light">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Remarks</p>
                <p className="text-[13px] text-text-secondary">{booking.remarks}</p>
              </div>
            )}
          </div>

          {/* Vendor API Response Card */}
          {booking.vendor_config_id && (
            <VendorResponseCard
              booking={booking}
              vendorConfig={vendorConfig}
            />
          )}

          {/* Sender & Receiver */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PersonCard
              title="Origin — Sender"
              icon={User}
              person={sender}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <PersonCard
              title="Destination — Receiver"
              icon={MapPin}
              person={receiver}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
            />
          </div>
        </div>

        {/* Right — Timeline */}
        <div className="bg-surface border border-border rounded-2xl p-5 self-start">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[14px] font-bold text-text-primary flex items-center gap-2">
              <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-primary" />
              </div>
              Live Tracking
            </h2>
            <button
              onClick={refetch}
              className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-text-tertiary" />
            </button>
          </div>

          {events.length > 0 ? (
            <div className="space-y-0">
              {events.map((event, idx) => {
                const isLatest = idx === 0
                return (
                  <div key={event.id} className="flex gap-3">
                    {/* Line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          isLatest
                            ? 'bg-primary text-white shadow-md shadow-primary/30'
                            : 'bg-surface-alt text-text-tertiary border border-border'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      {idx < events.length - 1 && (
                        <div className={`w-px flex-1 min-h-[32px] ${isLatest ? 'bg-primary/20' : 'bg-border'}`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pb-5 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[13px] font-bold ${isLatest ? 'text-primary' : 'text-text-primary'}`}>
                          {event.status}
                        </p>
                        <span className="text-[10px] text-text-tertiary whitespace-nowrap font-medium">
                          {formatDateTime(event.event_time)}
                        </span>
                      </div>
                      <p className="text-[12px] text-text-secondary mt-0.5 leading-relaxed">
                        {event.description}
                      </p>
                      {event.location && event.location !== 'System' && (
                        <p className="text-[11px] text-text-tertiary mt-1 flex items-center gap-1 font-medium">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </p>
                      )}
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
              <p className="text-[13px] text-text-tertiary font-medium">No tracking events yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoField({ icon: Icon, label, value, highlight = false }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1 flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <p className={`text-[13px] font-bold ${highlight ? 'text-primary' : 'text-text-primary'}`}>
        {value}
      </p>
    </div>
  )
}

function VendorResponseCard({ booking, vendorConfig }) {
  const [showRaw, setShowRaw] = useState(false)

  const pushStatus = booking.vendor_push_status
  const isSuccess = pushStatus === 'success'
  const isFailed = pushStatus === 'failed'

  const copyAwb = () => {
    if (booking.vendor_awb_number) {
      navigator.clipboard.writeText(booking.vendor_awb_number)
      toast.success('AWB number copied!')
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold text-text-primary flex items-center gap-2">
          <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
            <Plug className="w-3.5 h-3.5 text-violet-600" />
          </div>
          Vendor API Response
        </h2>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide ${
          isSuccess
            ? 'bg-emerald-50 text-emerald-600'
            : isFailed
              ? 'bg-red-50 text-red-500'
              : 'bg-amber-50 text-amber-600'
        }`}>
          {pushStatus || 'pending'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
        {/* Vendor Name */}
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Vendor
          </p>
          <p className="text-[13px] font-bold text-text-primary">
            {vendorConfig?.name || '—'}
          </p>
          {vendorConfig?.vendor_code && (
            <p className="text-[10px] text-text-tertiary font-mono mt-0.5">{vendorConfig.vendor_code}</p>
          )}
        </div>

        {/* AWB Numbers (Vendor AWB 1 & Vendor AWB 2) */}
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Vendor AWB1</p>
          {booking.vendor_awb_number ? (
            <button
              onClick={copyAwb}
              className="inline-flex items-center gap-1.5 text-[13px] font-mono font-bold text-primary bg-red-50 px-2 py-0.5 rounded-md hover:bg-red-100 transition-colors cursor-pointer"
            >
              {booking.vendor_awb_number}
              <Copy className="w-3 h-3 text-text-tertiary" />
            </button>
          ) : (
            <p className="text-[13px] text-text-tertiary">—</p>
          )}
          {booking.vendor_awb_number_2 && (
            <div className="mt-2">
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-0.5">Vendor AWB2 (Forwarded)</p>
              <p className="text-[12px] font-mono font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md inline-block">
                {booking.vendor_awb_number_2}
              </p>
            </div>
          )}
        </div>

        {/* Tracking URL */}
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Tracking</p>
          {booking.vendor_tracking_url ? (
            <a
              href={booking.vendor_tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Track Shipment
            </a>
          ) : (
            <p className="text-[13px] text-text-tertiary">—</p>
          )}
        </div>

        {/* Label URL */}
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Label</p>
          {booking.vendor_label_url ? (
            <a
              href={booking.vendor_label_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
            >
              <Download className="w-3 h-3" />
              Download
            </a>
          ) : (
            <p className="text-[13px] text-text-tertiary">—</p>
          )}
        </div>
      </div>

      {/* Routing Details */}
      <div className="mt-4 pt-4 border-t border-border-light grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Routing Vendor Code</p>
          <p className="text-[13px] font-bold text-text-primary">{booking.vendor_code || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Routing Product Code</p>
          <p className="text-[13px] font-bold text-text-primary">{booking.product_code || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Routing Service Code</p>
          <p className="text-[13px] font-bold text-text-primary">{booking.service_code || '—'}</p>
        </div>
      </div>

      {/* Error message for failed pushes */}
      {isFailed && booking.vendor_raw_response?.error && (
        <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-red-700">Push Failed</p>
              <p className="text-[12px] text-red-600 mt-0.5">{booking.vendor_raw_response.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Raw Response Toggle */}
      {booking.vendor_raw_response && Object.keys(booking.vendor_raw_response).length > 0 && (
        <div className="mt-4 pt-3 border-t border-border-light">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
          >
            {showRaw ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showRaw ? 'Hide' : 'Show'} Raw Response
          </button>
          {showRaw && (
            <pre className="mt-2 p-3 bg-surface-alt rounded-xl text-[11px] text-text-secondary overflow-auto max-h-48 font-mono leading-relaxed border border-border-light">
              {JSON.stringify(booking.vendor_raw_response, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function PersonCard({ title, icon: Icon, person, iconBg, iconColor }) {
  if (!person) return null
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <h3 className="text-[13px] font-bold text-text-primary mb-3 flex items-center gap-2">
        <div className={`w-6 h-6 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-3 h-3 ${iconColor}`} />
        </div>
        {title}
      </h3>
      <div className="space-y-2">
        <p className="text-[14px] font-bold text-text-primary">{person.name}</p>
        {person.phone && (
          <p className="text-[12px] text-text-secondary flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-text-tertiary" /> {person.phone}
          </p>
        )}
        {person.email && (
          <p className="text-[12px] text-text-secondary flex items-center gap-1.5">
            <Mail className="w-3 h-3 text-text-tertiary" /> {person.email}
          </p>
        )}
        {person.address && (
          <p className="text-[12px] text-text-secondary flex items-start gap-1.5">
            <MapPin className="w-3 h-3 text-text-tertiary flex-shrink-0 mt-0.5" />
            <span>
              {person.address}{person.city && `, ${person.city}`}
              {person.state && `, ${person.state}`}
              {person.pincode && ` — ${person.pincode}`}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
