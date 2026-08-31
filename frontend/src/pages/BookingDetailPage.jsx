import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useBookingById, usePushBookingToApi } from '../hooks/useBookings'
import { useLiveTracking } from '../hooks/useTracking'
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
  ChevronLeft,
  ChevronRight,
  Zap,
  XCircle,
  Send,
  Lock,
  Loader2,
  Edit,
  Plane,
  Box,
  Globe,
  AlertCircle,
  DollarSign,
  Tag,
  Share2
} from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters'
import toast from 'react-hot-toast'
import { systemSettingsApi } from '../api/systemSettings.api'
import { useQuery } from '@tanstack/react-query'
import { openVendorDocument, openPdfBlob } from '../utils/openVendorDocument'

// ─── Progress Stage Definitions ─────────────────────────────────────
const STAGES = [
  { key: 'booked', label: 'Booked', icon: Box },
  { key: 'picked_up', label: 'Picked', icon: Package },
  { key: 'in_transit', label: 'In Transit', icon: Plane },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 }
]
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]))

function getEventColor(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('delivered')) return { dot: 'bg-emerald-500', ring: 'ring-emerald-500/20', text: 'text-emerald-700', bg: 'bg-emerald-50' }
  if (s.includes('out for delivery')) return { dot: 'bg-amber-500', ring: 'ring-amber-500/20', text: 'text-amber-700', bg: 'bg-amber-50' }
  if (s.includes('delay') || s.includes('sorry') || s.includes('reroute')) return { dot: 'bg-red-500', ring: 'ring-red-500/20', text: 'text-red-700', bg: 'bg-red-50' }
  if (s.includes('departed') || s.includes('arrived') || s.includes('transit') || s.includes('scan') || s.includes('processing')) return { dot: 'bg-blue-500', ring: 'ring-blue-500/20', text: 'text-blue-700', bg: 'bg-blue-50' }
  if (s.includes('received') || s.includes('sent') || s.includes('label') || s.includes('origin')) return { dot: 'bg-violet-500', ring: 'ring-violet-500/20', text: 'text-violet-700', bg: 'bg-violet-50' }
  return { dot: 'bg-gray-400', ring: 'ring-gray-400/20', text: 'text-gray-600', bg: 'bg-gray-50' }
}

export default function BookingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useBookingById(id)
  const booking = data?.booking
  const pushToApiMutation = usePushBookingToApi()

  // Billing edit modal state
  const [showBillingModal, setShowBillingModal] = useState(false)
  const [savingBilling, setSavingBilling] = useState(false)
  const [billingForm, setBillingForm] = useState({
    final_chargeable_weight: '',
    rate_per_kg: '',
    shipping_charge: '',
    extra_charge: '',
    total_amount: ''
  })

  // System settings query
  const { data: sysSettingsData } = useQuery({
    queryKey: ['system-settings'],
    queryFn: systemSettingsApi.getAll
  })
  const allowPostPushEdit = sysSettingsData?.settings?.allow_post_push_billing_edit !== false

  const openBillingModal = () => {
    if (!booking) return
    const chgWt = booking.final_chargeable_weight || booking.chargeable_weight || booking.weight || ''
    const rate = booking.rate_per_kg || ''
    const shipping = booking.shipping_charge || ''
    const extra = booking.extra_charge || ''
    const total = booking.total_amount || ''
    setBillingForm({
      final_chargeable_weight: String(chgWt),
      rate_per_kg: String(rate),
      shipping_charge: String(shipping),
      extra_charge: String(extra),
      total_amount: String(total)
    })
    setShowBillingModal(true)
  }

  const handleSaveBilling = async (e) => {
    e?.preventDefault()
    setSavingBilling(true)
    try {
      await bookingsApi.updateBilling(booking.id, {
        final_chargeable_weight: parseFloat(billingForm.final_chargeable_weight) || 0,
        rate_per_kg: parseFloat(billingForm.rate_per_kg) || 0,
        shipping_charge: parseFloat(billingForm.shipping_charge) || 0,
        extra_charge: parseFloat(billingForm.extra_charge) || 0,
        total_amount: parseFloat(billingForm.total_amount) || 0
      })
      toast.success('Billing details updated & synced to remote AWBENTRY!')
      setShowBillingModal(false)
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update billing details')
    } finally {
      setSavingBilling(false)
    }
  }

  // Live vendor tracking hook
  const awbToTrack = booking?.vendor_awb_number || booking?.tracking_number || ''
  const vendorCodeToTrack = booking?.vendor_code || booking?.vendor_api_configs?.vendor_code || booking?.courier_providers?.code || ''
  const {
    data: liveData,
    isLoading: isLiveLoading,
    isRefetching: isLiveRefetching,
    refetch: refetchLiveTracking
  } = useLiveTracking(awbToTrack, vendorCodeToTrack)

  const liveTracking = liveData?.tracking

  const copyTracking = () => {
    if (booking?.tracking_number) {
      navigator.clipboard.writeText(booking.tracking_number)
      toast.success('Our AWB copied!')
    }
  }

  // 1. Official Shipping Bill (Ours - Dollar icon)
  const handleOpenOurBill = async () => {
    const toastId = toast.loading('Loading Our Shipping Bill...')
    try {
      const res = await bookingsApi.downloadWaybill(booking.id)
      const awb = booking.tracking_number || booking.order_id || booking.id
      openPdfBlob(res.data, `ShippingBill_${awb}.pdf`)
      toast.success('Our Shipping Bill opened successfully', { id: toastId })
    } catch (err) {
      toast.error('Failed to open Shipping Bill', { id: toastId })
    }
  }

  // 2. Vendor Invoice (File icon)
  const handleOpenVendorInvoice = async () => {
    await openVendorDocument(booking, 'vendor_invoice')
  }

  // 3. Vendor Shipper Copy / Vendor Bill (Download icon)
  const handleOpenVendorShipperCopy = async () => {
    await openVendorDocument(booking, 'vendor_shipper_copy')
  }

  // 4. Vendor Box Labels (Box icon)
  const handleOpenVendorLabels = async () => {
    await openVendorDocument(booking, 'vendor_box_label')
  }

  // 5. Our Prince Box / Thermal Label (Tag icon)
  const handleOpenPrinceLabel = async () => {
    const toastId = toast.loading('Loading Our Box Label...')
    try {
      const res = await bookingsApi.downloadBoxLabels(booking.id)
      const awb = booking.tracking_number || booking.order_id || booking.id
      openPdfBlob(res.data, `BoxLabels_${awb}.pdf`)
      toast.success('Our Box Label opened successfully', { id: toastId })
    } catch (err) {
      toast.error('Failed to open Prince Label', { id: toastId })
    }
  }

  // 6. Share Final Amount & Labels with Customer via WhatsApp & Public Links
  const handleShareWithCustomer = () => {
    const awb = booking.tracking_number || booking.order_id || booking.id
    const customerName = sender.name || booking.sender_name || 'Customer'
    const consigneeName = receiver.name || booking.receiver_name || ''
    const dest = receiver.city || receiver.country || booking.destination_country || ''
    const amountVal = booking.total_amount || booking.shipping_charge
    const amountStr = amountVal ? `₹${parseFloat(amountVal).toLocaleString('en-IN')}` : ''

    const labelUrl = `https://purple-raccoon-753399.hostingersite.com/api/customer/labels-pdf/${awb}`
    const waybillUrl = `https://purple-raccoon-753399.hostingersite.com/api/customer/waybill-pdf/${awb}`

    let text = `📦 *Prince Express Shipment Update*\n\n`
    text += `Dear *${customerName}*,\n`
    text += `Your shipment *#${awb}* is booked & processed.\n\n`
    if (consigneeName) text += `📍 *Consignee:* ${consigneeName} (${dest})\n`
    if (amountStr) text += `💰 *Final Amount:* ${amountStr}\n`
    text += `\n🏷️ *Download Box Label:* ${labelUrl}\n`
    text += `📄 *Download Shipping Bill:* ${waybillUrl}\n\n`
    text += `Thank you for choosing Prince Express!`

    const phone = (sender.phone || '').replace(/[^0-9]/g, '')
    const waUrl = phone && phone.length >= 10 ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`

    navigator.clipboard.writeText(text)
    toast.success('Share text copied! Opening WhatsApp...')
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  const handlePushToApi = async () => {
    try {
      await pushToApiMutation.mutateAsync({
        id: booking.id,
        payload: {
          vendor_config_id: booking.vendor_config_id,
          vendor_code: booking.vendor_code,
          service_code: booking.service_code,
          product_code: booking.product_code
        }
      })
      toast.success('Successfully pushed to vendor API!')
      refetch()
      refetchLiveTracking()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to push to vendor API')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="skeleton h-[220px] rounded-2xl" />
            <div className="skeleton h-[180px] rounded-2xl" />
          </div>
          <div className="skeleton h-[420px] rounded-2xl" />
        </div>
      </div>
    )
  }

  if (isError || (!isLoading && !booking)) {
    return (
      <div className="p-8 text-center bg-surface border border-border rounded-2xl max-w-lg mx-auto mt-12">
        <h2 className="text-[18px] font-bold text-text-primary mb-2">Shipment Not Found</h2>
        <p className="text-[13px] text-text-secondary mb-5">The requested booking could not be loaded.</p>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-[13px] font-bold rounded-xl hover:bg-primary-dark transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Bookings
        </button>
      </div>
    )
  }

  const sender = booking.senders ? {
    ...booking.senders,
    name: booking.senders.name || booking.sender_name || booking.sender_company || '',
    company: booking.senders.company || booking.sender_company || '',
    phone: booking.senders.phone || booking.sender_phone || '',
    phone_2: booking.senders.phone_2 || booking.sender_phone_2 || '',
    email: booking.senders.email || booking.sender_email || '',
    address: booking.senders.address || booking.sender_address || '',
    address_2: booking.senders.address_2 || booking.sender_address_2 || '',
    city: booking.senders.city || booking.sender_city || '',
    state: booking.senders.state || booking.sender_state || '',
    pincode: booking.senders.pincode || booking.sender_pincode || '',
    country: booking.senders.country || booking.sender_country || 'INDIA',
    gstin_type: booking.senders.gstin_type || booking.sender_gstin_type || '',
    gstin_no: booking.senders.gstin_no || booking.sender_gstin_no || ''
  } : {
    name: booking.sender_name || booking.sender_company || '',
    company: booking.sender_company || '',
    phone: booking.sender_phone || '',
    phone_2: booking.sender_phone_2 || '',
    email: booking.sender_email || '',
    address: booking.sender_address || '',
    address_2: booking.sender_address_2 || '',
    city: booking.sender_city || '',
    state: booking.sender_state || '',
    pincode: booking.sender_pincode || '',
    country: booking.sender_country || 'INDIA',
    gstin_type: booking.sender_gstin_type || '',
    gstin_no: booking.sender_gstin_no || ''
  }

  const receiver = booking.receivers ? {
    ...booking.receivers,
    name: booking.receivers.name || booking.receiver_name || booking.receiver_company || '',
    company: booking.receivers.company || booking.receiver_company || '',
    phone: booking.receivers.phone || booking.receiver_phone || '',
    phone_2: booking.receivers.phone_2 || booking.receiver_phone_2 || '',
    email: booking.receivers.email || booking.receiver_email || '',
    address: booking.receivers.address || booking.receiver_address || '',
    address_2: booking.receivers.address_2 || booking.receiver_address_2 || '',
    city: booking.receivers.city || booking.receiver_city || '',
    state: booking.receivers.state || booking.receiver_state || '',
    pincode: booking.receivers.pincode || booking.receiver_pincode || '',
    country: booking.receivers.country || booking.receiver_country || '',
    gstin_type: booking.receivers.gstin_type || booking.receiver_gstin_type || '',
    gstin_no: booking.receivers.gstin_no || booking.receiver_gstin_no || ''
  } : {
    name: booking.receiver_name || booking.receiver_company || '',
    company: booking.receiver_company || '',
    phone: booking.receiver_phone || '',
    phone_2: booking.receiver_phone_2 || '',
    email: booking.receiver_email || '',
    address: booking.receiver_address || '',
    address_2: booking.receiver_address_2 || '',
    city: booking.receiver_city || '',
    state: booking.receiver_state || '',
    pincode: booking.receiver_pincode || '',
    country: booking.receiver_country || '',
    gstin_type: booking.receiver_gstin_type || '',
    gstin_no: booking.receiver_gstin_no || ''
  }
  const courier = booking.courier_providers
  const vendorConfig = booking.vendor_api_configs
  const events = booking.tracking_events || []

  return (
    <div className="animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-text-tertiary hover:text-primary transition-colors mb-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[24px] font-extrabold text-text-primary leading-tight">
              Order #{booking.order_id || booking.id}
            </h1>
            <StatusBadge status={liveTracking?.currentStage || booking.status} size="md" />
            {booking.is_locked ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <Lock className="w-3 h-3" /> Locked (API Pushed)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Draft (Not Pushed)
              </span>
            )}
          </div>

          {/* AWBs Row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {/* Our AWB */}
            <div className="flex items-center gap-1.5 bg-surface border border-border px-3 py-1 rounded-lg">
              <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Our AWB:</span>
              <button
                onClick={copyTracking}
                className="inline-flex items-center gap-1 text-[13px] font-mono font-extrabold text-primary hover:underline cursor-pointer"
                title="Copy Our AWB"
              >
                {booking.tracking_number}
                <Copy className="w-3 h-3 text-red-400" />
              </button>
            </div>

            {/* Vendor AWB 1 */}
            {booking.vendor_awb_number && (
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg">
                <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Vendor AWB:</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(booking.vendor_awb_number)
                    toast.success('Vendor AWB copied!')
                  }}
                  className="inline-flex items-center gap-1 text-[13px] font-mono font-extrabold text-[#1a237e] hover:underline cursor-pointer"
                  title="Copy Vendor AWB"
                >
                  {booking.vendor_awb_number}
                  <Copy className="w-3 h-3 text-indigo-500" />
                </button>
              </div>
            )}

            {/* Secondary Carrier / Forwarding AWB (e.g. UPS / FedEx / Carrier AWB 2) */}
            {(booking.vendor_awb_number_2 || booking.forwarding_no || (liveTracking?.shipmentInfo?.vendorAwbNo && liveTracking.shipmentInfo.vendorAwbNo !== booking.vendor_awb_number)) && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 px-3 py-1 rounded-lg">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                  {booking.secondary_carrier || liveTracking?.shipmentInfo?.secondaryCarrier || (/^1Z/i.test(booking.vendor_awb_number_2 || booking.forwarding_no || liveTracking?.shipmentInfo?.vendorAwbNo || '') ? 'UPS' : 'Forwarding')} AWB:
                </span>
                <button
                  onClick={() => {
                    const fwdNo = booking.vendor_awb_number_2 || booking.forwarding_no || liveTracking?.shipmentInfo?.vendorAwbNo
                    navigator.clipboard.writeText(fwdNo)
                    toast.success('Forwarding AWB copied!')
                  }}
                  className="inline-flex items-center gap-1 text-[13px] font-mono font-extrabold text-amber-900 hover:underline cursor-pointer"
                  title="Copy Forwarding AWB"
                >
                  {booking.vendor_awb_number_2 || booking.forwarding_no || liveTracking?.shipmentInfo?.vendorAwbNo}
                  <Copy className="w-3 h-3 text-amber-600" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/bookings/edit/${booking.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy hover:bg-navy-light text-white text-[12px] font-bold rounded-xl shadow-xs transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            {booking.is_locked ? 'View Full Form (Locked)' : 'Edit Shipment'}
          </Link>

          {/* 1. Official Shipping Bill (Ours) (Dollar icon) */}
          <button
            onClick={handleOpenOurBill}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-navy hover:bg-navy-light text-white text-[12px] font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Open Our Shipping Bill / Waybill"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Our Bill
          </button>

          {/* 2. Vendor Invoice (File icon) */}
          <button
            onClick={handleOpenVendorInvoice}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-[12px] font-bold rounded-xl transition-colors cursor-pointer"
            title="Open Vendor Invoice (Commercial / Freeform Invoice)"
          >
            <FileText className="w-3.5 h-3.5 text-purple-700" />
            Vendor Invoice
          </button>

          {/* 3. Vendor Shipper Copy / Vendor Bill (Download icon) */}
          <button
            onClick={handleOpenVendorShipperCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-[12px] font-bold rounded-xl transition-colors cursor-pointer"
            title="Open Vendor Shipper Copy / Vendor Bill"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            Vendor Shipper Copy
          </button>

          {/* 4. Vendor Box Labels (Box icon) */}
          <button
            onClick={handleOpenVendorLabels}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[12px] font-bold rounded-xl transition-colors cursor-pointer"
            title="Open Vendor Box / Barcode Label"
          >
            <Package className="w-3.5 h-3.5 text-amber-700" />
            Vendor Label
          </button>

          {/* 5. Our Prince Box Label (Tag icon) */}
          <button
            onClick={handleOpenPrinceLabel}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 text-[12px] font-bold rounded-xl transition-colors cursor-pointer"
            title="Open Our Prince Box / Thermal Label"
          >
            <Tag className="w-3.5 h-3.5 text-blue-700" />
            Our Label
          </button>

          {/* 6. Share with Customer (WhatsApp / Link) */}
          <button
            onClick={handleShareWithCustomer}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
            title="Share shipment details, final amount & label download link via WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share with Customer
          </button>

          {/* Push to API button for draft */}
          {!Boolean(booking.is_locked) && (
            <button
              onClick={() => {
                if (!booking.vendor_config_id) {
                  toast.error('Please select a vendor API before pushing')
                  navigate(`/bookings/edit/${booking.id}`)
                } else {
                  handlePushToApi()
                }
              }}
              disabled={pushToApiMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {pushToApiMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Push to Vendor API
            </button>
          )}

          <button
            onClick={async () => {
              const toastId = toast.loading('Pushing live tracking sync to carrier API...')
              try {
                await Promise.all([refetch(), refetchLiveTracking()])
                toast.success('Live tracking & shipment updated!', { id: toastId })
              } catch {
                toast.error('Failed to sync live tracking', { id: toastId })
              }
            }}
            disabled={isLiveRefetching}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-[12px] font-bold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLiveRefetching ? 'animate-spin' : ''}`} />
            {isLiveRefetching ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Shipment Info + Vendor Response + People */}
        <div className="lg:col-span-2 space-y-4">
          {/* Shipment Details Card */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <h2 className="text-[14px] font-bold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-primary" />
              </div>
              Shipment Details
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
              <InfoField icon={Calendar} label="Booked On" value={formatDate(booking.created_at)} />
              <InfoField
                icon={Truck}
                label="Carrier / Network"
                value={liveTracking?.shipmentInfo?.secondaryCarrier || liveTracking?.shipmentInfo?.vendorName || courier?.name || booking.vendor_code || 'Direct'}
              />
              <InfoField
                icon={Zap}
                label="API Gateway"
                value={vendorConfig?.name || liveTracking?.vendor || 'Local / Direct'}
              />
              <InfoField
                icon={Weight}
                label="Weight"
                value={booking.weight ? `${booking.weight} kg` : (liveTracking?.shipmentInfo?.weight ? `${liveTracking.shipmentInfo.weight} kg` : '—')}
              />
              <InfoField icon={CreditCard} label="Payment" value={booking.payment_mode?.toUpperCase() || '—'} />
              <InfoField
                icon={Ruler}
                label="Dimensions"
                value={
                  (booking.length !== undefined && booking.length !== null && booking.length !== '')
                    ? `${parseFloat(booking.length) || 0} × ${parseFloat(booking.breadth) || 0} × ${parseFloat(booking.height) || 0} cm`
                    : '—'
                }
              />
              <InfoField icon={Package} label="Package & Boxes" value={`${booking.package_type || 'Parcel'} (${booking.no_of_pieces || 1} Box${(parseInt(booking.no_of_pieces) || 1) > 1 ? 'es' : ''})`} />
              <InfoField icon={CreditCard} label="Amount" value={formatCurrency(booking.total_amount)} highlight />
            </div>
            {booking.remarks && (
              <div className="mt-4 p-3 bg-surface-alt rounded-xl border border-border-light">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Remarks</p>
                <p className="text-[13px] text-text-secondary">{booking.remarks}</p>
              </div>
            )}
          </div>

          {/* Pricing & Billing Details Card */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-[14px] font-bold text-text-primary flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                Pricing & Billing Details
              </h2>

            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-surface-alt p-3 rounded-xl border border-border-light">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Final Chargeable Wt</p>
                <p className="text-[15px] font-extrabold text-navy mt-1">
                  {parseFloat(booking.final_chargeable_weight || booking.chargeable_weight || booking.weight || 0).toFixed(2)} kg
                </p>
              </div>

              <div className="bg-surface-alt p-3 rounded-xl border border-border-light">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Rate / Kg</p>
                <p className="text-[15px] font-extrabold text-text-primary mt-1">
                  ₹{parseFloat(booking.rate_per_kg || 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-surface-alt p-3 rounded-xl border border-border-light">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Shipping Charge</p>
                <p className="text-[15px] font-extrabold text-primary mt-1">
                  ₹{parseFloat(booking.shipping_charge || 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-surface-alt p-3 rounded-xl border border-border-light">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Extra Charge</p>
                <p className="text-[15px] font-extrabold text-amber-700 mt-1">
                  ₹{parseFloat(booking.extra_charge || 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 col-span-2 sm:col-span-1">
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Final Shipping</p>
                <p className="text-[16px] font-black text-emerald-700 mt-1">
                  ₹{(() => {
                    const ship = parseFloat(booking.shipping_charge) || 0
                    const extra = parseFloat(booking.extra_charge) || 0
                    const sum = ship + extra
                    if (sum > 0) return sum.toFixed(2)
                    return (parseFloat(booking.total_amount) || 0).toFixed(2)
                  })()}
                </p>
              </div>
            </div>
          </div>

          {/* Multi-Box (Parcels) Breakdown Card */}
          {Array.isArray(booking.parcels) && booking.parcels.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-bold text-text-primary flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Package className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  Box Breakdown ({booking.parcels.length} Boxes)
                </h2>
                <span className="text-[11px] font-bold text-text-tertiary">
                  Total Weight: {parseFloat(booking.weight || 0).toFixed(2)} kg
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-border text-text-tertiary font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2 px-3">Box #</th>
                      <th className="py-2 px-3">Actual Wt (kg)</th>
                      <th className="py-2 px-3">Dimensions (L × W × H cm)</th>
                      <th className="py-2 px-3">Vol. Wt (kg)</th>
                      <th className="py-2 px-3">Chargeable Wt (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {booking.parcels.map((p, idx) => (
                      <tr key={idx} className="hover:bg-surface-alt/50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-primary">Box {p.box_no || idx + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-text-primary">{p.weight ? parseFloat(p.weight).toFixed(2) : '—'} kg</td>
                        <td className="py-2.5 px-3 text-text-secondary">
                          {parseFloat(p.length) || 0} × {parseFloat(p.breadth || p.width) || 0} × {parseFloat(p.height) || 0} cm
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary">{p.volumetric_weight ? parseFloat(p.volumetric_weight).toFixed(2) : '—'} kg</td>
                        <td className="py-2.5 px-3 font-bold text-text-primary">{p.chargeable_weight ? parseFloat(p.chargeable_weight).toFixed(2) : (p.weight ? parseFloat(p.weight).toFixed(2) : '—')} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vendor API Response Card */}
          {booking.vendor_config_id && (
            <VendorResponseCard
              booking={booking}
              vendorConfig={vendorConfig}
              liveTracking={liveTracking}
            />
          )}

          {/* Sender & Receiver */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PersonCard
              title="Origin — Sender"
              icon={User}
              person={sender}
              fallbackName={liveTracking?.shipmentInfo?.shipperName}
              fallbackCity={liveTracking?.shipmentInfo?.origin}
              fallbackCountry={liveTracking?.shipmentInfo?.originCountry}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <PersonCard
              title="Destination — Receiver"
              icon={MapPin}
              person={receiver}
              fallbackName={liveTracking?.shipmentInfo?.consignee}
              fallbackCity={liveTracking?.shipmentInfo?.destination}
              fallbackCountry={liveTracking?.shipmentInfo?.destinationCountry}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
            />
          </div>

          {/* Previous & Next Booking Navigation (Under Sender & Receiver) */}
          <div className="bg-surface rounded-2xl border border-border p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => booking?.adjacent?.prev_id && navigate(`/bookings/${booking.adjacent.prev_id}`)}
              disabled={!booking?.adjacent?.prev_id}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface-alt hover:bg-surface-hover border border-border rounded-xl text-[12px] font-bold text-navy transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-2xs group"
              title={booking?.adjacent?.prev_tracking ? `Previous: #${booking.adjacent.prev_order || booking.adjacent.prev_tracking}` : 'No previous shipment'}
            >
              <ChevronLeft className="w-4 h-4 text-primary group-hover:-translate-x-0.5 transition-transform" />
              <div className="text-left">
                <span className="block text-[9px] uppercase font-extrabold text-text-tertiary">Previous</span>
                <span className="block text-[12px] font-bold text-navy truncate max-w-[140px]">
                  {booking?.adjacent?.prev_order ? `#${booking.adjacent.prev_order}` : (booking?.adjacent?.prev_tracking || 'None')}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={handleBack}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-text-secondary hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Back to Shipments
            </button>

            <button
              type="button"
              onClick={() => booking?.adjacent?.next_id && navigate(`/bookings/${booking.adjacent.next_id}`)}
              disabled={!booking?.adjacent?.next_id}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface-alt hover:bg-surface-hover border border-border rounded-xl text-[12px] font-bold text-navy transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-2xs group text-right"
              title={booking?.adjacent?.next_tracking ? `Next: #${booking.adjacent.next_order || booking.adjacent.next_tracking}` : 'No next shipment'}
            >
              <div className="text-right">
                <span className="block text-[9px] uppercase font-extrabold text-text-tertiary">Next</span>
                <span className="block text-[12px] font-bold text-navy truncate max-w-[140px]">
                  {booking?.adjacent?.next_order ? `#${booking.adjacent.next_order}` : (booking?.adjacent?.next_tracking || 'None')}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Right — Live Tracking & Timeline Section */}
        <div className="bg-surface border border-border rounded-2xl p-5 self-start">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-text-primary flex items-center gap-1.5">
                  Live Tracking
                  {liveTracking && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  )}
                </h2>
                {liveTracking?.vendor && (
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                    {liveTracking.vendor}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => refetchLiveTracking()}
              disabled={isLiveLoading || isLiveRefetching}
              className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
              title="Refresh live tracking"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-text-tertiary ${isLiveRefetching ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Progress Stage Stepper */}
          {liveTracking && (
            <div className="mb-5 p-3.5 bg-surface-alt rounded-xl border border-border-light">
              <div className="flex items-center justify-between relative">
                {/* Background bar */}
                <div className="absolute top-[14px] left-[15px] right-[15px] h-[2px] bg-border rounded-full" />
                {/* Active bar */}
                <div
                  className="absolute top-[14px] left-[15px] h-[2px] bg-primary rounded-full transition-all duration-700"
                  style={{
                    width: `${((STAGE_INDEX[liveTracking.currentStage] ?? 0) / (STAGES.length - 1)) * 100}%`
                  }}
                />

                {STAGES.map((stage, sIdx) => {
                  const activeIdx = STAGE_INDEX[liveTracking.currentStage] ?? 0
                  const isCompleted = sIdx <= activeIdx
                  const isCurrent = sIdx === activeIdx
                  const StageIcon = stage.icon

                  return (
                    <div key={stage.key} className="flex flex-col items-center relative z-10">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isCurrent
                            ? 'bg-primary text-white ring-2 ring-primary/20 shadow-xs'
                            : isCompleted
                              ? 'bg-primary text-white'
                              : 'bg-surface border border-border text-text-tertiary'
                          }`}
                      >
                        <StageIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className={`text-[9px] font-bold mt-1 text-center ${isCompleted ? 'text-primary' : 'text-text-tertiary'
                        }`}>
                        {stage.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Status description */}
              <div className="mt-3 pt-2 border-t border-border-light flex items-center justify-between text-[11px]">
                <span className="text-text-tertiary font-medium">Status:</span>
                <span className="font-bold text-primary">{liveTracking.currentStatus}</span>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLiveLoading && (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
              <p className="text-[12px] text-text-secondary font-medium">Fetching real-time tracking from vendor...</p>
            </div>
          )}

          {/* Live Events Timeline */}
          {!isLiveLoading && liveTracking?.events?.length > 0 ? (
            <div className="space-y-0 max-h-[500px] overflow-y-auto pr-1">
              {liveTracking.events.map((event, idx) => {
                const isLatest = idx === 0
                const color = getEventColor(event.status)
                return (
                  <div key={idx} className="flex gap-3">
                    {/* Line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isLatest
                            ? `${color.dot} text-white ring-4 ${color.ring}`
                            : 'bg-surface-alt border border-border text-text-tertiary'
                          }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                      {idx < liveTracking.events.length - 1 && (
                        <div className={`w-px flex-1 min-h-[30px] ${isLatest ? 'bg-primary/30' : 'bg-border'}`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pb-4 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[12px] font-bold ${isLatest ? 'text-primary' : 'text-text-primary'}`}>
                          {event.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {event.location && (
                          <span className="text-[10px] text-text-tertiary font-medium flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" /> {event.location}
                          </span>
                        )}
                        <span className="text-[10px] text-text-tertiary font-medium">
                          {event.date} {event.time && `· ${event.time}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : !isLiveLoading && events.length > 0 ? (
            /* Fallback to Database Events */
            <div className="space-y-0">
              {events.map((event, idx) => {
                const isLatest = idx === 0
                return (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isLatest ? 'bg-primary text-white shadow-xs' : 'bg-surface-alt text-text-tertiary border border-border'
                          }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                      {idx < events.length - 1 && (
                        <div className={`w-px flex-1 min-h-[28px] ${isLatest ? 'bg-primary/20' : 'bg-border'}`} />
                      )}
                    </div>
                    <div className="pb-4 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[12px] font-bold ${isLatest ? 'text-primary' : 'text-text-primary'}`}>
                          {event.status}
                        </p>
                        <span className="text-[10px] text-text-tertiary whitespace-nowrap font-medium">
                          {formatDateTime(event.event_time)}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">{event.description}</p>
                      {event.location && event.location !== 'System' && (
                        <p className="text-[10px] text-text-tertiary mt-0.5 flex items-center gap-1 font-medium">
                          <MapPin className="w-2.5 h-2.5" /> {event.location}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : !isLiveLoading ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 bg-surface-alt rounded-xl flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-text-tertiary" />
              </div>
              <p className="text-[12px] text-text-tertiary font-medium">No tracking events recorded yet</p>
            </div>
          ) : null}
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

function VendorResponseCard({ booking, vendorConfig, liveTracking }) {
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

function PersonCard({ title, icon: Icon, person, fallbackName, fallbackCity, fallbackCountry, iconBg, iconColor }) {
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
              {country}
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
        </div>
      </div>
    </div>
  )
}
