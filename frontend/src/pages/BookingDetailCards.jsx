import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, ExternalLink, FileCheck, Mail, MapPin, Phone, Plug, XCircle, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { getFullCountryName } from '../utils/countryUtils'

export function InfoField({ icon: Icon, label, value, highlight = false }) {
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

export function VendorResponseCard({ booking, vendorConfig, liveTracking, onOpenManualAwb }) {
  const [showRaw, setShowRaw] = useState(false)

  const pushStatus = booking.vendor_push_status
  const isSuccess = pushStatus === 'success'
  const isFailed = pushStatus === 'failed'

  const copyAwb = () => {
    if (booking.vendor_awb_number) {
      navigator.clipboard.writeText(booking.vendor_awb_number)
      toast.success('Vendor AWB copied!')
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold text-text-primary flex items-center gap-2">
          <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
            <Plug className="w-3.5 h-3.5 text-violet-600" />
          </div>
          Vendor API Gateway
        </h2>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide ${isSuccess
            ? 'bg-emerald-50 text-emerald-600'
            : isFailed
              ? 'bg-red-50 text-red-500'
              : 'bg-amber-50 text-amber-600'
          }`}>
          {pushStatus || 'pending'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
        {/* Vendor Gateway */}
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            API Gateway
          </p>
          <p className="text-[13px] font-bold text-text-primary">
            {vendorConfig?.name || liveTracking?.vendor || '—'}
          </p>
          {vendorConfig?.vendor_code && (
            <p className="text-[10px] text-text-tertiary font-mono mt-0.5">{vendorConfig.vendor_code}</p>
          )}
        </div>

        {/* Vendor AWB */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px]">Vendor AWB1</p>
            {onOpenManualAwb && (
              <button
                type="button"
                onClick={onOpenManualAwb}
                className="text-[10px] font-bold text-purple-600 hover:text-purple-800 underline cursor-pointer"
              >
                {booking.vendor_awb_number ? 'Edit' : '+ Set'}
              </button>
            )}
          </div>
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
        </div>

        {/* Forwarded Secondary AWB */}
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">
            {liveTracking?.shipmentInfo?.secondaryCarrier ? `${liveTracking.shipmentInfo.secondaryCarrier} AWB` : 'Vendor AWB2'}
          </p>
          {liveTracking?.shipmentInfo?.vendorAwbNo || booking.vendor_awb_number_2 ? (
            <span className="text-[12px] font-mono font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md inline-block">
              {liveTracking?.shipmentInfo?.vendorAwbNo || booking.vendor_awb_number_2}
            </span>
          ) : (
            <p className="text-[13px] text-text-tertiary">—</p>
          )}
        </div>

        {/* Tracking Link */}
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Live Tracking</p>
          {booking.vendor_tracking_url ? (
            <a
              href={booking.vendor_tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Direct Portal
            </a>
          ) : (
            <p className="text-[13px] text-emerald-600 font-semibold">Active in details</p>
          )}
        </div>
      </div>

      {/* Routing Codes */}
      <div className="mt-4 pt-4 border-t border-border-light grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Vendor Code</p>
          <p className="text-[13px] font-bold text-text-primary">{booking.vendor_code || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Product Code</p>
          <p className="text-[13px] font-bold text-text-primary">{booking.product_code || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Service Code</p>
          <p className="text-[13px] font-bold text-text-primary">{booking.service_code || '—'}</p>
        </div>
        {booking.duty_paid && (
          <div>
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Duty Paid</p>
            <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              🛡️ {booking.duty_paid}
            </span>
          </div>
        )}
        {booking.remote_status && booking.remote_status !== 'NONE' && (
          <div>
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Remote Area Status</p>
            <span className={`inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full border ${
              booking.remote_status === 'YES' ? 'bg-amber-50 text-amber-800 border-amber-200' :
              booking.remote_status === 'BOTH' ? 'bg-blue-50 text-blue-800 border-blue-200' :
              'bg-green-50 text-green-800 border-green-200'
            }`}>
              {booking.remote_status === 'YES' && '⚠️ Remote Area (Yes)'}
              {booking.remote_status === 'BOTH' && 'ℹ️ Conditional (Both)'}
              {booking.remote_status === 'NO' && '✓ Non-Remote (No)'}
            </span>
          </div>
        )}
        {booking.destination_variant && (
          <div>
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Destination Option</p>
            <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
              🏷️ {booking.destination_variant}
            </span>
          </div>
        )}
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

export function PersonCard({ title, icon: Icon, person, fallbackName, fallbackCity, fallbackCountry, iconBg, iconColor, kycUrl, kycDocName }) {
  const name = person?.name || fallbackName || person?.company
  const company = person?.company && person?.company !== name ? person?.company : ''
  const address = person?.address
  const address2 = person?.address_2
  const city = person?.city || fallbackCity
  const state = person?.state
  const country = person?.country || fallbackCountry
  const pincode = person?.pincode
  const gstinNo = person?.gstin_no
  const gstinType = person?.gstin_type

  if (!name && !city && !address) return null

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-border/60">
          <h3 className="text-[12px] font-extrabold uppercase tracking-wider text-text-tertiary flex items-center gap-2">
            <div className={`w-6 h-6 ${iconBg} rounded-lg flex items-center justify-center`}>
              <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
            </div>
            {title}
          </h3>
          {country && (
            <span className="text-[11px] font-bold text-navy bg-surface-alt px-2.5 py-0.5 rounded-md border border-border/60">
              {getFullCountryName(country)}
            </span>
          )}
        </div>

        {/* Person / Shipper / Receiver Name - Prominent */}
        <div className="mb-3">
          <h4 className="text-[15px] font-black text-navy leading-tight">
            {name || '—'}
          </h4>
          {company && (
            <p className="text-[12px] font-semibold text-text-secondary mt-0.5">
              {company}
            </p>
          )}
        </div>

        <div className="space-y-2 text-[12px]">
          {(person?.phone || person?.phone_2) && (
            <p className="text-text-secondary flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
              <span className="font-medium">{[person.phone, person.phone_2].filter(Boolean).join(' / ')}</span>
            </p>
          )}
          {person?.email && (
            <p className="text-text-secondary flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
              <span className="font-medium truncate">{person.email}</span>
            </p>
          )}
          {(address || address2 || city) && (
            <p className="text-text-secondary flex items-start gap-2 pt-0.5">
              <MapPin className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">
                {[address, address2, city, state].filter(Boolean).join(', ')}
                {pincode ? ` — ${pincode}` : ''}
              </span>
            </p>
          )}
          {gstinNo && (
            <p className="text-[11px] text-text-tertiary font-mono pt-1">
              <span className="font-bold">{gstinType || 'Tax ID / GST'}:</span> {gstinNo}
            </p>
          )}
          {kycUrl && (
            <div className="pt-2 mt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-tertiary uppercase">KYC Document</span>
              <a
                href={kycUrl.startsWith('http') ? kycUrl : `https://purple-raccoon-753399.hostingersite.com${kycUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline bg-primary/5 px-2 py-1 rounded"
              >
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="truncate max-w-[140px]">{kycDocName || 'View Document'}</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
