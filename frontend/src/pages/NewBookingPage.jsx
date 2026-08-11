import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCreateBooking } from '../hooks/useBookings'
import { getActiveVendors } from '../api/apiSettings.api'
import {
  User,
  MapPin,
  Package,
  Truck,
  Save,
  Check,
  Loader2,
  Plug,
  Zap,
  FileText,
  ChevronDown,
  Search,
  Filter,
  Edit2,
  X,
  Plus,
  Trash2,
  DollarSign,
  ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'

const INITIAL_FORM = {
  // Account / Header
  book_date: new Date().toISOString().split('T')[0],
  book_code: '2231',
  client_name: 'LIBERTY',
  client_code: 'P0503',
  search_awb: '',
  active_tab: 'AWB',

  // Shipper / Sender
  sender_origin: 'MUMBAI',
  sender_origin_code: 'BOM',
  sender_company: 'LIBERTY',
  sender_name: 'ASHFAQ MUHAMMAD',
  sender_address: '',
  sender_address_2: '',
  sender_pincode: '395003',
  sender_city: 'Surat',
  sender_state: 'GUJARAT',
  sender_phone: '8140549330',
  sender_email: 'akarodia1977@gmail.com',
  sender_country: 'INDIA',
  sender_gstin_type: 'Select',
  sender_gstin_no: '603329074611',

  // Consignee / Receiver
  receiver_destination: '',
  receiver_destination_code: '',
  receiver_company: '',
  receiver_name: '',
  receiver_address: '',
  receiver_address_2: '',
  receiver_pincode: '',
  receiver_city: '',
  receiver_state: '',
  receiver_phone: '',
  receiver_email: '',
  receiver_country: '',
  receiver_gstin_type: 'Select',
  receiver_gstin_no: '',

  // Services & Package
  product_code: '',
  vendor_config_id: '',
  vendor_code: '',
  service_code: '',
  declared_value: '',
  invoice_currency: 'INR',
  no_of_pieces: '1',
  package_type: 'DOX',
  weight: '0',
  weight_unit: 'Kgs',
  length: '',
  breadth: '',
  height: '',
  volumetric_weight: '0',
  charge_weight: '0',

  // Options Checkboxes
  is_commercial: false,
  is_oda: false,
  is_medical: false,

  // Invoice / Performa details
  invoice_no: '',
  invoice_date: '',
  hs_code: '',
  export_reason: '',
  terms_of_trade: 'CIF',
  content_description: '',

  // eAWB & Charges
  eawb_no: '',
  eawb_date: '',
  eawb_exp_date: '',
  additional_discount: '',
  additional_freight: '',
  additional_insurance: '',
  additional_other_charges: '',
  additional_specify_charges: '',
  payment_mode: 'prepaid',
  shipping_charge: '',
  total_amount: '',
  order_reference: '',
  remarks: '',
  is_cod: false,
  cod_amount: '',

  // Buyer Details
  buyer_name: '',
  buyer_person_type: 'Individual',
  buyer_address1: '',
  buyer_address2: '',
  buyer_pincode: '',
  buyer_city: '',
  buyer_state: '',
  buyer_telephone: '',
  buyer_mobile: '',
  buyer_email: '',
  buyer_country_code: '',
  buyer_destination_code: '',
  buyer_iec_no: '',

  // GST & Manifest
  gst_invoice: '0',
  lut_igst: 'N',
  total_igst: '',
  bank_ad_code: '',
  bank_account: '',
  bank_ifsc: '',
  lut_number: '',
  exchange_rate: '',
  manifest_firm: '',
  manifest_nfei: '1',
  pay_of_igst: '',
  manifest_ecommerce: '0',
  meis_scheme: '0',
  manifest_format: 'C2C',
  manifest_iec_no: ''
}

export default function NewBookingPage() {
  const navigate = useNavigate()
  const createBooking = useCreateBooking()
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)

  // Accordion toggle states
  const [openPiecesAccordion, setOpenPiecesAccordion] = useState(false)
  const [openPerformaAccordion, setOpenPerformaAccordion] = useState(false)
  const [openChargesAccordion, setOpenChargesAccordion] = useState(false)

  // Multi-piece list
  const [piecesList, setPiecesList] = useState([
    { id: 1, length: '', breadth: '', height: '', weight: '', vol_wt: '' }
  ])

  // Rate Compare Modal
  const [showRateModal, setShowRateModal] = useState(false)

  // Custom input mode toggles
  const [customVendorMode, setCustomVendorMode] = useState(false)
  const [customServiceMode, setCustomServiceMode] = useState(false)
  const [customProductMode, setCustomProductMode] = useState(false)

  // Fetch active vendors
  const { data: vendorsData } = useQuery({
    queryKey: ['active-vendors'],
    queryFn: getActiveVendors
  })
  const activeVendors = vendorsData?.vendors || []

  // Pre-fill from URL params
  const [searchParams] = useSearchParams()
  const fromRequestId = searchParams.get('from_request')

  useEffect(() => {
    if (!fromRequestId) return
    const prefillFields = [
      'sender_name', 'sender_company', 'sender_email', 'sender_phone',
      'sender_address', 'sender_address_2', 'sender_city', 'sender_pincode',
      'sender_state', 'sender_country', 'sender_gstin_type', 'sender_gstin_no',
      'receiver_name', 'receiver_email', 'receiver_phone',
      'receiver_address', 'receiver_address_2', 'receiver_city', 'receiver_pincode',
      'receiver_state', 'receiver_country', 'receiver_gstin_type', 'receiver_gstin_no',
      'package_type', 'weight', 'length', 'breadth', 'height', 'no_of_pieces',
      'content_description', 'declared_value', 'remarks'
    ]
    const updates = {}
    prefillFields.forEach(field => {
      const val = searchParams.get(field)
      if (val) updates[field] = val
    })
    if (Object.keys(updates).length > 0) {
      setForm(prev => ({ ...prev, ...updates }))
    }
  }, [fromRequestId])

  // Safe parsing helper
  const safeArr = (val) => {
    if (Array.isArray(val)) return val
    if (typeof val === 'string' && val.trim() !== '') {
      try {
        const p = JSON.parse(val)
        if (Array.isArray(p)) return p
      } catch {}
    }
    return []
  }
  const safeNullableArr = (val) => {
    if (val === null || val === undefined) return null
    if (Array.isArray(val)) return val
    if (typeof val === 'string' && val.trim() !== '') {
      try {
        const p = JSON.parse(val)
        if (Array.isArray(p)) return p
      } catch {}
    }
    return null
  }

  // Selected vendor metadata
  const selectedVendor = activeVendors.find(v => String(v.id) === String(form.vendor_config_id))
  const vendorServices = safeArr(selectedVendor?.available_services)
  const vendorVendorCodes = safeArr(selectedVendor?.available_vendor_codes)
  const vendorProductCodes = safeArr(selectedVendor?.available_product_codes)
  const vendorProductRestrictions = safeNullableArr(selectedVendor?.product_code_restrictions)

  // Volumetric & Charge weight auto-calc
  useEffect(() => {
    const l = parseFloat(form.length) || 0
    const b = parseFloat(form.breadth) || 0
    const h = parseFloat(form.height) || 0
    const pcs = parseInt(form.no_of_pieces) || 1
    const actWeight = parseFloat(form.weight) || 0

    let vol = 0
    if (l > 0 && b > 0 && h > 0) {
      vol = Math.round(((l * b * h) / 5000) * pcs * 100) / 100
    }

    const chgWeight = Math.max(actWeight, vol)
    setForm(prev => ({
      ...prev,
      volumetric_weight: String(vol),
      charge_weight: String(chgWeight)
    }))
  }, [form.length, form.breadth, form.height, form.weight, form.no_of_pieces])

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Pieces management
  const addPieceRow = () => {
    setPiecesList(prev => [
      ...prev,
      { id: Date.now(), length: '', breadth: '', height: '', weight: '', vol_wt: '' }
    ])
    updateForm('no_of_pieces', String(piecesList.length + 1))
  }

  const removePieceRow = (id) => {
    if (piecesList.length <= 1) return
    const updated = piecesList.filter(p => p.id !== id)
    setPiecesList(updated)
    updateForm('no_of_pieces', String(updated.length))
  }

  const updatePiece = (id, field, value) => {
    const updated = piecesList.map(p => {
      if (p.id === id) {
        const item = { ...p, [field]: value }
        const l = parseFloat(item.length) || 0
        const b = parseFloat(item.breadth) || 0
        const h = parseFloat(item.height) || 0
        if (l > 0 && b > 0 && h > 0) {
          item.vol_wt = String(Math.round(((l * b * h) / 5000) * 100) / 100)
        }
        return item
      }
      return p
    })
    setPiecesList(updated)

    // Recalculate totals
    let totalVol = 0
    let totalAct = 0
    updated.forEach(p => {
      totalVol += parseFloat(p.vol_wt) || 0
      totalAct += parseFloat(p.weight) || 0
    })
    if (totalVol > 0) updateForm('volumetric_weight', String(Math.round(totalVol * 100) / 100))
    if (totalAct > 0) updateForm('weight', String(Math.round(totalAct * 100) / 100))
  }

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault()

    if (!form.sender_name && !form.sender_company) {
      toast.error('Shipper Contact Name or Company is required')
      return
    }
    if (!form.receiver_name && !form.receiver_company) {
      toast.error('Consignee Contact Name or Company is required')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        sender_name: form.sender_name || form.sender_company,
        sender_company: form.sender_company,
        sender_email: form.sender_email,
        sender_phone: form.sender_phone,
        sender_address: form.sender_address || `${form.sender_origin} ${form.sender_city}`,
        sender_address_2: form.sender_address_2,
        sender_city: form.sender_city || form.sender_origin,
        sender_pincode: form.sender_pincode,
        sender_state: form.sender_state,
        sender_country: form.sender_country || 'INDIA',
        sender_gstin_type: form.sender_gstin_type,
        sender_gstin_no: form.sender_gstin_no,

        receiver_name: form.receiver_name || form.receiver_company,
        receiver_email: form.receiver_email,
        receiver_phone: form.receiver_phone,
        receiver_address: form.receiver_address || form.receiver_destination,
        receiver_address_2: form.receiver_address_2,
        receiver_city: form.receiver_city || form.receiver_destination,
        receiver_pincode: form.receiver_pincode,
        receiver_state: form.receiver_state,
        receiver_country: form.receiver_country || form.receiver_destination,
        receiver_gstin_type: form.receiver_gstin_type,
        receiver_gstin_no: form.receiver_gstin_no,

        weight: parseFloat(form.weight) || 0,
        length: parseFloat(form.length) || 0,
        breadth: parseFloat(form.breadth) || 0,
        height: parseFloat(form.height) || 0,
        no_of_pieces: parseInt(form.no_of_pieces) || 1,
        content_description: form.content_description || 'General Cargo',
        declared_value: parseFloat(form.declared_value) || 0,
        package_type: form.package_type,
        payment_mode: form.payment_mode,
        shipping_charge: parseFloat(form.shipping_charge) || 0,
        total_amount: parseFloat(form.total_amount) || parseFloat(form.shipping_charge) || 0,
        order_reference: form.order_reference,
        remarks: form.remarks,

        vendor_config_id: form.vendor_config_id || null,
        vendor_code: form.vendor_code || (selectedVendor?.vendor_code || ''),
        service_code: form.service_code || '',
        product_code: form.product_code || '',
        cod_amount: parseFloat(form.cod_amount) || 0,

        // Additional specifications
        invoice_no: form.invoice_no,
        invoice_date: form.invoice_date,
        invoice_currency: form.invoice_currency,
        hs_code: form.hs_code,
        export_reason: form.export_reason,
        terms_of_trade: form.terms_of_trade,
        is_commercial: form.is_commercial ? 1 : 0
      }

      const result = await createBooking.mutateAsync(payload)
      toast.success(
        result?.push_result?.pushed
          ? `Booking created & auto-pushed! AWB: ${result.booking?.awb_number || result.booking?.id}`
          : `Booking created successfully! AWB: ${result.booking?.awb_number || result.booking?.id}`
      )
      navigate('/bookings')
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-3 text-[#1a202c] animate-fade-in font-sans">
      {/* ── Top Toolbar ── */}
      <div className="bg-white rounded-lg border border-[#dce1e7] p-2.5 mb-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* AWB / KYC Pills */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => updateForm('active_tab', 'AWB')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-tight transition-all ${
              form.active_tab === 'AWB'
                ? 'bg-[#0D2132] text-white shadow-xs'
                : 'bg-[#e9ecef] text-[#495057] hover:bg-[#dee2e6]'
            }`}
          >
            AWB
          </button>
          <button
            type="button"
            onClick={() => updateForm('active_tab', 'KYC')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-tight transition-all ${
              form.active_tab === 'KYC'
                ? 'bg-[#0D2132] text-white shadow-xs'
                : 'bg-[#e9ecef] text-[#495057] hover:bg-[#dee2e6]'
            }`}
          >
            KYC
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="p-1.5 rounded border border-[#cfd8dc] bg-[#f8f9fa] text-[#455a64] hover:bg-[#eceff1]"
            title="Filter"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <input
              type="text"
              placeholder="Search By AWB No."
              value={form.search_awb}
              onChange={e => updateForm('search_awb', e.target.value)}
              className="w-48 sm:w-64 pl-2.5 pr-8 py-1 text-xs border border-[#cfd8dc] rounded bg-white focus:outline-none focus:border-[#0D2132]"
            />
            <button
              type="button"
              className="absolute right-0 top-0 bottom-0 px-2 bg-[#0D2132] text-white rounded-r flex items-center justify-center hover:bg-[#142D42]"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Account Details Header Bar ── */}
      <div className="bg-white rounded-lg border border-[#dce1e7] p-2.5 mb-3 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-[#0D2132] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Account Details
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Book Date */}
          <div className="flex gap-1.5 items-center">
            <CompactField label="Book Date" required className="flex-1">
              <input
                type="date"
                value={form.book_date}
                onChange={e => updateForm('book_date', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs font-semibold"
              />
            </CompactField>
            <div className="w-24 border border-[#cfd8dc] bg-[#f8f9fa] rounded px-2 py-1.5 text-center text-xs font-mono font-bold text-[#37474f]">
              {form.book_code}
            </div>
          </div>

          {/* Client Name */}
          <div className="flex gap-1.5 items-center">
            <CompactField label="Client Name" required className="flex-1">
              <input
                type="text"
                value={form.client_name}
                onChange={e => updateForm('client_name', e.target.value)}
                placeholder="Client Name"
                className="w-full bg-transparent focus:outline-none text-xs font-bold text-[#0D2132]"
              />
            </CompactField>
            <div className="w-24 border border-[#cfd8dc] bg-[#f8f9fa] rounded px-2 py-1.5 text-center text-xs font-mono font-bold text-[#37474f]">
              {form.client_code}
            </div>
            <button
              type="button"
              className="p-1.5 text-[#37474f] hover:text-[#0D2132]"
              title="Edit Client"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main 3-Column Layout ── */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
          
          {/* ── Column 1: Shipper Details ── */}
          <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-[#0D2132] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Shipper Details
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Origin */}
                <div className="flex gap-1">
                  <CompactField label="Origin" required className="flex-1">
                    <input
                      type="text"
                      value={form.sender_origin}
                      onChange={e => {
                        updateForm('sender_origin', e.target.value)
                        updateForm('sender_city', e.target.value)
                      }}
                      className="w-full bg-transparent focus:outline-none font-bold uppercase text-xs"
                    />
                  </CompactField>
                  <div className="w-16 border border-[#cfd8dc] bg-[#f8f9fa] rounded px-1.5 py-1 text-center font-mono font-bold text-xs flex items-center justify-center">
                    {form.sender_origin_code}
                  </div>
                  <SearchBtn />
                </div>

                {/* Company Name */}
                <div className="flex gap-1">
                  <CompactField label="Company Name" required className="flex-1">
                    <input
                      type="text"
                      value={form.sender_company}
                      onChange={e => updateForm('sender_company', e.target.value)}
                      className="w-full bg-transparent focus:outline-none uppercase text-xs font-semibold"
                    />
                  </CompactField>
                  <SearchBtn />
                </div>

                {/* Contact Name & Address 1 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactField label="Contact Name">
                    <input
                      type="text"
                      value={form.sender_name}
                      onChange={e => updateForm('sender_name', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                  <CompactField label="Address 1" required>
                    <input
                      type="text"
                      value={form.sender_address}
                      onChange={e => updateForm('sender_address', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>

                {/* Address 2 */}
                <CompactField label="Address 2">
                  <input
                    type="text"
                    value={form.sender_address_2}
                    onChange={e => updateForm('sender_address_2', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>

                {/* Pincode & City */}
                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Pincode" required>
                    <input
                      type="text"
                      value={form.sender_pincode}
                      onChange={e => updateForm('sender_pincode', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="City" required>
                    <input
                      type="text"
                      value={form.sender_city}
                      onChange={e => updateForm('sender_city', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>

                {/* State & Telephone */}
                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="State">
                    <input
                      type="text"
                      value={form.sender_state}
                      onChange={e => updateForm('sender_state', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs uppercase"
                    />
                  </CompactField>
                  <CompactField label="Telephone">
                    <input
                      type="text"
                      placeholder="Tel"
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>

                {/* Mobile No. & E-Mail */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactField label="Mobile No." required>
                    <input
                      type="text"
                      value={form.sender_phone}
                      onChange={e => updateForm('sender_phone', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="E-Mail">
                    <input
                      type="email"
                      value={form.sender_email}
                      onChange={e => updateForm('sender_email', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>

                {/* Country & IEC No. */}
                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Country">
                    <input
                      type="text"
                      value={form.sender_country}
                      onChange={e => updateForm('sender_country', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-bold uppercase"
                    />
                  </CompactField>
                  <CompactField label="IEC No.">
                    <input
                      type="text"
                      placeholder="IEC No."
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                </div>

                {/* Document Type & Document No. */}
                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Document Type">
                    <select
                      value={form.sender_gstin_type}
                      onChange={e => updateForm('sender_gstin_type', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs cursor-pointer"
                    >
                      <option value="Select">Select</option>
                      <option value="GSTIN">GSTIN</option>
                      <option value="PAN">PAN</option>
                      <option value="AADHAR">Aadhaar</option>
                      <option value="PASSPORT">Passport</option>
                    </select>
                  </CompactField>
                  <CompactField label="Document No.">
                    <input
                      type="text"
                      value={form.sender_gstin_no}
                      onChange={e => updateForm('sender_gstin_no', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                </div>
              </div>
            </div>
          </div>

          {/* ── Column 2: Consignee Details ── */}
          <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-[#0D2132] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Consignee Details
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Destination */}
                <div className="flex gap-1">
                  <CompactField
                    label="Destination"
                    required
                    className="flex-1"
                    highlight={!form.receiver_destination}
                  >
                    <input
                      type="text"
                      value={form.receiver_destination}
                      onChange={e => {
                        updateForm('receiver_destination', e.target.value)
                        updateForm('receiver_country', e.target.value)
                        updateForm('receiver_city', e.target.value)
                      }}
                      placeholder="Enter Destination / Country"
                      className="w-full bg-transparent focus:outline-none uppercase font-bold text-xs text-red-600 placeholder-red-300"
                    />
                  </CompactField>
                  <div className="w-16 border border-[#cfd8dc] bg-[#f8f9fa] rounded px-1.5 py-1 text-center font-mono font-bold text-xs flex items-center justify-center">
                    {form.receiver_destination_code || (form.receiver_country || '').slice(0, 3).toUpperCase()}
                  </div>
                  <SearchBtn />
                </div>

                {/* Company Name */}
                <div className="flex gap-1">
                  <CompactField label="Company Name" required className="flex-1">
                    <input
                      type="text"
                      value={form.receiver_company}
                      onChange={e => updateForm('receiver_company', e.target.value)}
                      className="w-full bg-transparent focus:outline-none uppercase text-xs font-semibold"
                    />
                  </CompactField>
                  <SearchBtn />
                </div>

                {/* Contact Name & Address 1 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactField label="Contact Name">
                    <input
                      type="text"
                      value={form.receiver_name}
                      onChange={e => updateForm('receiver_name', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                  <CompactField label="Address 1" required>
                    <input
                      type="text"
                      value={form.receiver_address}
                      onChange={e => updateForm('receiver_address', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>

                {/* Address 2 */}
                <CompactField label="Address 2">
                  <input
                    type="text"
                    value={form.receiver_address_2}
                    onChange={e => updateForm('receiver_address_2', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>

                {/* Pincode & City */}
                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Pincode" required>
                    <input
                      type="text"
                      value={form.receiver_pincode}
                      onChange={e => updateForm('receiver_pincode', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="City" required>
                    <input
                      type="text"
                      value={form.receiver_city}
                      onChange={e => updateForm('receiver_city', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>

                {/* State & Telephone */}
                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="State" required>
                    <input
                      type="text"
                      value={form.receiver_state}
                      onChange={e => updateForm('receiver_state', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs uppercase"
                    />
                  </CompactField>
                  <CompactField label="Telephone" required>
                    <input
                      type="text"
                      value={form.receiver_phone}
                      onChange={e => updateForm('receiver_phone', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                </div>

                {/* Mobile No. & E-Mail */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactField label="Mobile No.">
                    <input
                      type="text"
                      value={form.receiver_phone}
                      onChange={e => updateForm('receiver_phone', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="E-Mail">
                    <input
                      type="email"
                      value={form.receiver_email}
                      onChange={e => updateForm('receiver_email', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>

                {/* Country & IEC No. */}
                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Country">
                    <input
                      type="text"
                      value={form.receiver_country}
                      onChange={e => updateForm('receiver_country', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs uppercase font-bold"
                    />
                  </CompactField>
                  <CompactField label="IEC No.">
                    <input
                      type="text"
                      placeholder="IEC No."
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                </div>

                {/* Document Type & Document No. */}
                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Document Type">
                    <select
                      value={form.receiver_gstin_type}
                      onChange={e => updateForm('receiver_gstin_type', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs cursor-pointer"
                    >
                      <option value="Select">Select</option>
                      <option value="TAX_ID">Tax ID</option>
                      <option value="VAT">VAT</option>
                      <option value="PASSPORT">Passport</option>
                    </select>
                  </CompactField>
                  <CompactField label="Document No.">
                    <input
                      type="text"
                      value={form.receiver_gstin_no}
                      onChange={e => updateForm('receiver_gstin_no', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                </div>
              </div>
            </div>
          </div>

          {/* ── Column 3: Services Details ── */}
          <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-[#0D2132] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Services Details
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Product */}
                <div className="flex gap-1">
                  <CompactField label="Product" required className="flex-1">
                    {vendorProductCodes.length > 0 ? (
                      <select
                        value={form.product_code}
                        onChange={e => updateForm('product_code', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-bold cursor-pointer"
                      >
                        <option value="">— Select Product —</option>
                        {vendorProductCodes.map((pc, idx) => (
                          <option key={idx} value={pc.code}>
                            {pc.code} {pc.label && pc.label !== pc.code ? `(${pc.label})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form.product_code}
                        onChange={e => updateForm('product_code', e.target.value)}
                        placeholder="SPX / DOX / Sample"
                        className="w-full bg-transparent focus:outline-none text-xs font-bold uppercase"
                      />
                    )}
                  </CompactField>
                  <div className="w-16 border border-[#cfd8dc] bg-[#f8f9fa] rounded px-1.5 py-1 text-center font-mono font-bold text-xs flex items-center justify-center">
                    {form.product_code || '—'}
                  </div>
                  <SearchBtn />
                </div>

                {/* Vendor */}
                <div className="flex gap-1">
                  <CompactField label="Vendor" required className="flex-1">
                    {activeVendors.length > 0 ? (
                      <select
                        value={form.vendor_config_id}
                        onChange={e => {
                          updateForm('vendor_config_id', e.target.value)
                          updateForm('vendor_code', '')
                          updateForm('service_code', '')
                          updateForm('product_code', '')
                        }}
                        className="w-full bg-transparent focus:outline-none text-xs font-bold cursor-pointer text-[#0D2132]"
                      >
                        <option value="">— Pacific Express (Default) —</option>
                        {activeVendors.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.name} {v.vendor_code ? `(${v.vendor_code})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form.vendor_code || 'Pacific Express Corporation'}
                        onChange={e => updateForm('vendor_code', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-bold text-[#0D2132]"
                      />
                    )}
                  </CompactField>
                  <div className="w-14 border border-[#cfd8dc] bg-[#f8f9fa] rounded px-1.5 py-1 text-center font-mono font-bold text-xs flex items-center justify-center">
                    {form.vendor_code || (selectedVendor?.vendor_code || 'PC')}
                  </div>
                  <SearchBtn />
                </div>

                {/* Service */}
                <div className="flex gap-1">
                  <CompactField label="Service" required className="flex-1">
                    {vendorServices.length > 0 ? (
                      <select
                        value={form.service_code}
                        onChange={e => updateForm('service_code', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-bold cursor-pointer"
                      >
                        <option value="">SELF / Standard</option>
                        {vendorServices.map((svc, idx) => (
                          <option key={idx} value={svc.code}>
                            {svc.code} {svc.label && svc.label !== svc.code ? `(${svc.label})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form.service_code || 'SELF'}
                        onChange={e => updateForm('service_code', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-bold uppercase"
                      />
                    )}
                  </CompactField>
                  <SearchBtn />
                </div>

                {/* Shipment Value & Currency */}
                <div className="grid grid-cols-3 gap-2">
                  <CompactField label="Shipment Value" className="col-span-2">
                    <input
                      type="number"
                      value={form.declared_value}
                      onChange={e => updateForm('declared_value', e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent focus:outline-none text-xs font-semibold"
                    />
                  </CompactField>
                  <CompactField label="Currency">
                    <select
                      value={form.invoice_currency}
                      onChange={e => updateForm('invoice_currency', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-bold cursor-pointer"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="AED">AED</option>
                    </select>
                  </CompactField>
                </div>

                {/* Pieces & Package Type */}
                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Pieces" required>
                    <input
                      type="number"
                      min="1"
                      value={form.no_of_pieces}
                      onChange={e => updateForm('no_of_pieces', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-bold"
                    />
                  </CompactField>
                  <CompactField label="Type">
                    <select
                      value={form.package_type}
                      onChange={e => updateForm('package_type', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-bold cursor-pointer"
                    >
                      <option value="DOX">DOX</option>
                      <option value="SPX">SPX</option>
                      <option value="PARCEL">PARCEL</option>
                      <option value="SAMPLE">SAMPLE</option>
                    </select>
                  </CompactField>
                </div>

                {/* Actual Weight & Unit */}
                <div className="grid grid-cols-3 gap-2">
                  <CompactField label="Actual Weight" required className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      value={form.weight}
                      onChange={e => updateForm('weight', e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent focus:outline-none text-xs font-bold text-right"
                    />
                  </CompactField>
                  <CompactField label="Unit">
                    <select
                      value={form.weight_unit}
                      onChange={e => updateForm('weight_unit', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-bold cursor-pointer"
                    >
                      <option value="Kgs">Kgs</option>
                      <option value="Gms">Gms</option>
                      <option value="Lbs">Lbs</option>
                    </select>
                  </CompactField>
                </div>

                {/* Volumetric Weight & Charge Weight */}
                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Volumetric Weight">
                    <input
                      type="text"
                      readOnly
                      value={form.volumetric_weight}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono font-bold text-right text-gray-600"
                    />
                  </CompactField>
                  <CompactField label="Charge Weight" required>
                    <input
                      type="text"
                      value={form.charge_weight}
                      onChange={e => updateForm('charge_weight', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono font-bold text-right text-[#0D2132]"
                    />
                  </CompactField>
                </div>

                {/* Checkboxes Row */}
                <div className="flex items-center justify-between pt-1 text-[11px] font-semibold text-[#37474f]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_commercial}
                      onChange={e => updateForm('is_commercial', e.target.checked)}
                      className="accent-[#0D2132] rounded"
                    />
                    <span>Commercial</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_oda}
                      onChange={e => updateForm('is_oda', e.target.checked)}
                      className="accent-[#0D2132] rounded"
                    />
                    <span>ODA</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_medical}
                      onChange={e => updateForm('is_medical', e.target.checked)}
                      className="accent-[#0D2132] rounded"
                    />
                    <span>Medical Charges</span>
                  </label>
                </div>

                {/* Rate Compare Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowRateModal(true)}
                    className="bg-[#0D2132] hover:bg-[#142D42] text-white text-xs font-extrabold px-4 py-1.5 rounded-full shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Rate Compare
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── Collapsible Banner Accordions ── */}
        <div className="space-y-1 mb-4">
          
          {/* Accordion 1: Pieces details */}
          <AccordionBar
            title="Click here to enter Pieces details"
            isOpen={openPiecesAccordion}
            onToggle={() => setOpenPiecesAccordion(!openPiecesAccordion)}
          />
          {openPiecesAccordion && (
            <div className="bg-white border border-[#dce1e7] rounded p-3 my-1 space-y-2 animate-slide-down">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#0D2132]">Multi-Piece Specification (LxBxH cm & Weight)</span>
                <button
                  type="button"
                  onClick={addPieceRow}
                  className="bg-[#0D2132] text-white text-xs px-3 py-1 rounded flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Piece
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-[#cfd8dc]">
                      <th className="p-1.5 font-bold text-[#37474f]">Piece #</th>
                      <th className="p-1.5 font-bold text-[#37474f]">Length (cm)</th>
                      <th className="p-1.5 font-bold text-[#37474f]">Breadth (cm)</th>
                      <th className="p-1.5 font-bold text-[#37474f]">Height (cm)</th>
                      <th className="p-1.5 font-bold text-[#37474f]">Actual Wt (kg)</th>
                      <th className="p-1.5 font-bold text-[#37474f]">Volumetric Wt</th>
                      <th className="p-1.5 font-bold text-[#37474f] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {piecesList.map((piece, idx) => (
                      <tr key={piece.id} className="border-b border-[#eef2f5]">
                        <td className="p-1.5 font-bold text-[#0D2132]">{idx + 1}</td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            placeholder="L"
                            value={piece.length}
                            onChange={e => updatePiece(piece.id, 'length', e.target.value)}
                            className="w-20 border border-[#cfd8dc] rounded px-1.5 py-0.5 text-xs"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            placeholder="B"
                            value={piece.breadth}
                            onChange={e => updatePiece(piece.id, 'breadth', e.target.value)}
                            className="w-20 border border-[#cfd8dc] rounded px-1.5 py-0.5 text-xs"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            placeholder="H"
                            value={piece.height}
                            onChange={e => updatePiece(piece.id, 'height', e.target.value)}
                            className="w-20 border border-[#cfd8dc] rounded px-1.5 py-0.5 text-xs"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Wt"
                            value={piece.weight}
                            onChange={e => updatePiece(piece.id, 'weight', e.target.value)}
                            className="w-24 border border-[#cfd8dc] rounded px-1.5 py-0.5 text-xs"
                          />
                        </td>
                        <td className="p-1.5 font-mono font-bold text-gray-700">{piece.vol_wt || '0'} kg</td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removePieceRow(piece.id)}
                            className="text-red-500 hover:text-red-700"
                            disabled={piecesList.length <= 1}
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Accordion 2: Performa / Invoice details */}
          <AccordionBar
            title="Click here to enter Performa details"
            isOpen={openPerformaAccordion}
            onToggle={() => setOpenPerformaAccordion(!openPerformaAccordion)}
          />
          {openPerformaAccordion && (
            <div className="bg-white border border-[#dce1e7] rounded p-3 my-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-slide-down">
              <CompactField label="Invoice No">
                <input
                  type="text"
                  value={form.invoice_no}
                  onChange={e => updateForm('invoice_no', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs"
                />
              </CompactField>
              <CompactField label="Invoice Date">
                <input
                  type="date"
                  value={form.invoice_date}
                  onChange={e => updateForm('invoice_date', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs"
                />
              </CompactField>
              <CompactField label="HS Code">
                <input
                  type="text"
                  value={form.hs_code}
                  onChange={e => updateForm('hs_code', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs font-mono"
                />
              </CompactField>
              <CompactField label="Export Reason">
                <input
                  type="text"
                  placeholder="e.g. Commercial Sample / Gift"
                  value={form.export_reason}
                  onChange={e => updateForm('export_reason', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs"
                />
              </CompactField>
              <CompactField label="Terms of Trade">
                <select
                  value={form.terms_of_trade}
                  onChange={e => updateForm('terms_of_trade', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs cursor-pointer"
                >
                  <option value="CIF">CIF</option>
                  <option value="FOB">FOB</option>
                  <option value="DDP">DDP</option>
                  <option value="DDU">DDU</option>
                </select>
              </CompactField>
              <CompactField label="Content Description">
                <input
                  type="text"
                  placeholder="Items list / Goods description"
                  value={form.content_description}
                  onChange={e => updateForm('content_description', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs"
                />
              </CompactField>
            </div>
          )}

          {/* Accordion 3: Charge & eAWB details */}
          <AccordionBar
            title="Click here to enter Charge details"
            isOpen={openChargesAccordion}
            onToggle={() => setOpenChargesAccordion(!openChargesAccordion)}
          />
          {openChargesAccordion && (
            <div className="bg-white border border-[#dce1e7] rounded p-3 my-1 space-y-3 animate-slide-down">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <CompactField label="Freight Charge">
                  <input
                    type="number"
                    value={form.additional_freight}
                    onChange={e => updateForm('additional_freight', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>
                <CompactField label="Insurance">
                  <input
                    type="number"
                    value={form.additional_insurance}
                    onChange={e => updateForm('additional_insurance', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>
                <CompactField label="Discount">
                  <input
                    type="number"
                    value={form.additional_discount}
                    onChange={e => updateForm('additional_discount', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>
                <CompactField label="Payment Mode">
                  <select
                    value={form.payment_mode}
                    onChange={e => updateForm('payment_mode', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="prepaid">Prepaid</option>
                    <option value="cod">Cash On Delivery (COD)</option>
                    <option value="credit">Account Credit</option>
                  </select>
                </CompactField>
              </div>

              {form.payment_mode === 'cod' && (
                <div className="w-48">
                  <CompactField label="COD Amount" required>
                    <input
                      type="number"
                      value={form.cod_amount}
                      onChange={e => updateForm('cod_amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-transparent focus:outline-none text-xs font-bold text-red-600"
                    />
                  </CompactField>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <CompactField label="eAWB No">
                  <input
                    type="text"
                    value={form.eawb_no}
                    onChange={e => updateForm('eawb_no', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs font-mono"
                  />
                </CompactField>
                <CompactField label="eAWB Date">
                  <input
                    type="date"
                    value={form.eawb_date}
                    onChange={e => updateForm('eawb_date', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>
                <CompactField label="Remarks">
                  <input
                    type="text"
                    placeholder="Special instructions"
                    value={form.remarks}
                    onChange={e => updateForm('remarks', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>
              </div>
            </div>
          )}

        </div>

        {/* ── Footer Submit Bar ── */}
        <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-sm flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-1.5 rounded border border-[#cfd8dc] bg-[#f8f9fa] text-xs font-bold text-[#455a64] hover:bg-[#eceff1]"
          >
            Cancel / Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForm(INITIAL_FORM)}
              className="px-4 py-1.5 rounded border border-[#cfd8dc] bg-white text-xs font-bold text-[#455a64] hover:bg-[#f8f9fa]"
            >
              Reset Form
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-full bg-gradient-to-r from-[#0D2132] to-[#BB0013] text-white text-xs font-extrabold shadow-md hover:opacity-95 transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Docket...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Create Booking & Push API
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ── Rate Compare Modal ── */}
      {showRateModal && (
        <RateCompareModal
          weight={parseFloat(form.charge_weight || form.weight) || 1}
          destination={form.receiver_destination || form.receiver_country || 'International'}
          onClose={() => setShowRateModal(false)}
          onSelectRate={(vendor) => {
            if (vendor?.id) updateForm('vendor_config_id', String(vendor.id))
            if (vendor?.vendor_code) updateForm('vendor_code', vendor.vendor_code)
            setShowRateModal(false)
            toast.success(`Selected Vendor: ${vendor?.name || 'Courier'}`)
          }}
          activeVendors={activeVendors}
        />
      )}
    </div>
  )
}

// ── Sub-Components ──

function CompactField({ label, required, children, className = '', highlight = false }) {
  return (
    <div
      className={`relative border ${
        highlight
          ? 'border-red-500 ring-1 ring-red-200'
          : 'border-[#cfd8dc] focus-within:border-[#0D2132] focus-within:ring-1 focus-within:ring-[#0D2132]'
      } rounded bg-white px-2 py-1 transition-all ${className}`}
    >
      <label className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-extrabold text-[#455a64] uppercase tracking-tighter whitespace-nowrap z-10">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <div className="pt-0.5">{children}</div>
    </div>
  )
}

function SearchBtn() {
  return (
    <button
      type="button"
      className="bg-[#0D2132] hover:bg-[#142D42] text-white p-1.5 rounded flex items-center justify-center transition-colors"
      title="Search Lookup"
    >
      <Search className="w-3.5 h-3.5" />
    </button>
  )
}

function AccordionBar({ title, isOpen, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full bg-[#e0e4e8] hover:bg-[#d5dadf] text-[#0D2132] font-extrabold text-xs py-2 px-4 rounded flex items-center justify-between transition-colors shadow-2xs"
    >
      <span>{title}</span>
      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  )
}

function RateCompareModal({ weight, destination, onClose, onSelectRate, activeVendors }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-4 animate-fade-in-scale">
        <div className="flex items-center justify-between border-b border-[#e9ecef] pb-3 mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#0D2132]" />
            <h3 className="text-sm font-bold text-[#0D2132]">
              Rate Comparison ({weight} kg → {destination || 'Worldwide'})
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
          {activeVendors.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">No active vendor API connections found.</p>
          ) : (
            activeVendors.map(v => (
              <div
                key={v.id}
                className="border border-[#e0e4e8] rounded-lg p-2.5 flex items-center justify-between hover:bg-[#f8f9fa] transition-colors"
              >
                <div>
                  <p className="text-xs font-bold text-[#0D2132]">{v.name}</p>
                  <p className="text-[10px] text-gray-500">
                    Vendor Code: {v.vendor_code || 'PC'} • Environment: {v.environment || 'production'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectRate(v)}
                  className="bg-[#0D2132] hover:bg-[#142D42] text-white text-[11px] font-bold px-3 py-1 rounded-full"
                >
                  Select Vendor
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold border border-[#cfd8dc] rounded bg-[#f8f9fa] text-[#455a64]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
