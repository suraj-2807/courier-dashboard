import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCreateBooking } from '../hooks/useBookings'
import { getActiveVendors } from '../api/apiSettings.api'
import {
  ArrowLeft,
  User,
  MapPin,
  Package,
  Truck,
  Save,
  Loader2,
  Plug,
  FileText,
  ChevronDown,
  DollarSign,
  Shield,
  Settings,
  HelpCircle,
  Check
} from 'lucide-react'
import toast from 'react-hot-toast'

const INITIAL_FORM = {
  // Step 1 — Sender
  sender_name: '',
  sender_company: '',
  sender_email: '',
  sender_phone: '',
  sender_address: '',
  sender_address_2: '',
  sender_city: '',
  sender_pincode: '',
  sender_state: '',
  sender_country: 'INDIA',
  sender_gstin_type: '',
  sender_gstin_no: '',
  // Step 1 — Receiver
  receiver_name: '',
  receiver_email: '',
  receiver_phone: '',
  receiver_address: '',
  receiver_address_2: '',
  receiver_city: '',
  receiver_pincode: '',
  receiver_state: '',
  receiver_country: '',
  receiver_gstin_type: '',
  receiver_gstin_no: '',
  // Step 2 — Package
  package_type: 'parcel',
  weight: '',
  length: '',
  breadth: '',
  height: '',
  no_of_pieces: '1',
  volumetric_weight: '',
  actual_weight: '',
  content_description: '',
  declared_value: '',
  is_fragile: false,
  // Step 2 — Invoice / Export
  invoice_no: '',
  invoice_date: '',
  invoice_currency: 'INR',
  hs_code: '',
  export_reason: '',
  terms_of_trade: 'CIF',
  // eAWB Details
  eawb_no: '',
  eawb_date: '',
  eawb_exp_date: '',
  // Additional Charges
  additional_discount: '',
  additional_freight: '',
  additional_insurance: '',
  additional_other_charges: '',
  additional_specify_charges: '',
  // Step 3 — Courier / Vendor
  courier_provider_id: '',
  vendor_config_id: '',
  vendor_code: '',
  service_code: '',
  product_code: '',
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
  manifest_iec_no: '',
  lut_issue_date: '',
  lut_till_date: '',
  // Advanced Config
  company_code: '',
  is_commercial: '',
  csb_type: '',
  otp: '',
  lsp_type: '',
  required_performa: '',
  required_label: ''
}

export default function NewBookingPage() {
  const navigate = useNavigate()
  const createBooking = useCreateBooking()
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)

  // Custom input mode toggles for vendor, service, and product codes
  const [customVendorMode, setCustomVendorMode] = useState(false)
  const [customServiceMode, setCustomServiceMode] = useState(false)
  const [customProductMode, setCustomProductMode] = useState(false)

  // Collapsible accordion section toggles
  const [showInvoice, setShowInvoice] = useState(false)
  const [showEawb, setShowEawb] = useState(false)
  const [showAdditionalCharges, setShowAdditionalCharges] = useState(false)
  const [showBuyerDetails, setShowBuyerDetails] = useState(false)
  const [showGstManifest, setShowGstManifest] = useState(false)
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false)

  // Fetch active vendors for vendor API selection
  const { data: vendorsData } = useQuery({
    queryKey: ['active-vendors'],
    queryFn: getActiveVendors
  })
  const activeVendors = vendorsData?.vendors || []

  // Pre-fill from booking request URL params
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
      'content_description', 'declared_value', 'remarks', 'customer_name'
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

  // Safe parsing helper functions
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

  // Get selected vendor's configured codes
  const selectedVendor = activeVendors.find(v => String(v.id) === String(form.vendor_config_id))
  const vendorServices = safeArr(selectedVendor?.available_services)
  const vendorVendorCodes = safeArr(selectedVendor?.available_vendor_codes)
  const vendorProductCodes = safeArr(selectedVendor?.available_product_codes)
  const vendorRequiredFields = safeNullableArr(selectedVendor?.required_fields)
  const vendorProductRestrictions = safeNullableArr(selectedVendor?.product_code_restrictions)

  const vendorRequiresField = (fieldKey) => {
    if (!form.vendor_config_id) return true
    if (!vendorRequiredFields || !Array.isArray(vendorRequiredFields)) return true
    return vendorRequiredFields.includes(fieldKey)
  }

  const filteredProductCodes = (() => {
    if (!vendorProductRestrictions || !Array.isArray(vendorProductRestrictions) || vendorProductRestrictions.length === 0) {
      return vendorProductCodes
    }
    const destCountry = (form.receiver_country || '').toUpperCase().trim()
    const shipWeight = parseFloat(form.weight) || 0
    const pkgType = (form.package_type || '').toUpperCase().trim()

    return vendorProductRestrictions.map(rule => {
      let eligible = true
      let reason = ''

      if (rule.countries && Array.isArray(rule.countries) && !rule.countries.includes('*')) {
        const countryCodes = rule.countries.map(c => c.toUpperCase().trim())
        if (destCountry && !countryCodes.includes(destCountry)) {
          eligible = false
          reason = `Not available for ${destCountry}`
        }
      }

      if (eligible && rule.min_weight !== undefined && shipWeight > 0 && shipWeight < rule.min_weight) {
        eligible = false
        reason = `Min weight: ${rule.min_weight} kg`
      }
      if (eligible && rule.max_weight !== undefined && shipWeight > 0 && shipWeight > rule.max_weight) {
        eligible = false
        reason = `Max weight: ${rule.max_weight} kg`
      }

      if (eligible && rule.package_types && Array.isArray(rule.package_types) && rule.package_types.length > 0) {
        const allowedTypes = rule.package_types.map(t => t.toUpperCase().trim())
        if (pkgType && !allowedTypes.includes(pkgType)) {
          eligible = false
          reason = `Only for: ${rule.package_types.join(', ')}`
        }
      }

      return {
        code: rule.code,
        label: rule.label || rule.code,
        eligible,
        reason
      }
    })
  })()

  // Auto-calculate Volumetric Weight & Charge Weight
  useEffect(() => {
    const l = parseFloat(form.length) || 0
    const b = parseFloat(form.breadth) || 0
    const h = parseFloat(form.height) || 0
    const pcs = parseInt(form.no_of_pieces) || 1
    const act = parseFloat(form.weight) || 0

    let vol = 0
    if (l > 0 && b > 0 && h > 0) {
      vol = Math.round(((l * b * h) / 5000) * pcs * 100) / 100
    }
    const chg = Math.max(act, vol)

    setForm(prev => ({
      ...prev,
      volumetric_weight: vol > 0 ? String(vol) : '',
      actual_weight: act > 0 ? String(act) : '',
      shipping_charge: prev.shipping_charge || (chg > 0 ? String(chg) : '')
    }))
  }, [form.length, form.breadth, form.height, form.weight, form.no_of_pieces])

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()

    if (!form.sender_name && !form.sender_company) {
      toast.error('Sender Name or Company is required')
      return
    }
    if (!form.sender_phone) {
      toast.error('Sender Phone is required')
      return
    }
    if (!form.receiver_name && !form.receiver_company) {
      toast.error('Receiver Name or Company is required')
      return
    }
    if (!form.receiver_phone) {
      toast.error('Receiver Phone is required')
      return
    }
    if (!form.receiver_address) {
      toast.error('Receiver Address Line 1 is required')
      return
    }
    if (!form.receiver_city) {
      toast.error('Receiver City is required')
      return
    }
    if (!form.receiver_country) {
      toast.error('Receiver Country is required')
      return
    }
    if (!form.weight || parseFloat(form.weight) <= 0) {
      toast.error('Please enter the shipment weight')
      return
    }

    setSubmitting(true)
    try {
      const result = await createBooking.mutateAsync({
        sender_name: form.sender_name || form.sender_company,
        sender_company: form.sender_company,
        sender_email: form.sender_email,
        sender_phone: form.sender_phone,
        sender_address: form.sender_address,
        sender_address_2: form.sender_address_2,
        sender_city: form.sender_city,
        sender_pincode: form.sender_pincode,
        sender_state: form.sender_state,
        sender_country: form.sender_country,
        sender_gstin_type: form.sender_gstin_type,
        sender_gstin_no: form.sender_gstin_no,

        receiver_name: form.receiver_name || form.receiver_company,
        receiver_company: form.receiver_company,
        receiver_email: form.receiver_email,
        receiver_phone: form.receiver_phone,
        receiver_address: form.receiver_address,
        receiver_address_2: form.receiver_address_2,
        receiver_city: form.receiver_city,
        receiver_pincode: form.receiver_pincode,
        receiver_state: form.receiver_state,
        receiver_country: form.receiver_country,
        receiver_gstin_type: form.receiver_gstin_type,
        receiver_gstin_no: form.receiver_gstin_no,

        weight: parseFloat(form.weight) || 0,
        length: parseFloat(form.length) || 0,
        breadth: parseFloat(form.breadth) || 0,
        height: parseFloat(form.height) || 0,
        no_of_pieces: parseInt(form.no_of_pieces) || 1,
        content_description: form.content_description || 'General Goods',
        declared_value: parseFloat(form.declared_value) || 0,
        package_type: form.package_type,
        payment_mode: form.payment_mode,
        shipping_charge: parseFloat(form.shipping_charge) || 0,
        total_amount: parseFloat(form.total_amount) || parseFloat(form.shipping_charge) || 0,
        order_reference: form.order_reference,
        remarks: form.remarks,

        vendor_config_id: form.vendor_config_id || null,
        vendor_code: form.vendor_code || '',
        service_code: form.service_code || '',
        product_code: form.product_code || '',
        cod_amount: parseFloat(form.cod_amount) || 0,

        // Specifications
        invoice_no: form.invoice_no,
        invoice_date: form.invoice_date,
        invoice_currency: form.invoice_currency,
        hs_code: form.hs_code,
        export_reason: form.export_reason,
        terms_of_trade: form.terms_of_trade,
        eawb_no: form.eawb_no,
        eawb_date: form.eawb_date,
        eawb_exp_date: form.eawb_exp_date,
        additional_discount: form.additional_discount,
        additional_freight: form.additional_freight,
        additional_insurance: form.additional_insurance,
        additional_other_charges: form.additional_other_charges,
        additional_specify_charges: form.additional_specify_charges,

        // Buyer details
        buyer_name: form.buyer_name,
        buyer_person_type: form.buyer_person_type,
        buyer_address1: form.buyer_address1,
        buyer_address2: form.buyer_address2,
        buyer_pincode: form.buyer_pincode,
        buyer_city: form.buyer_city,
        buyer_state: form.buyer_state,
        buyer_telephone: form.buyer_telephone,
        buyer_mobile: form.buyer_mobile,
        buyer_email: form.buyer_email,
        buyer_country_code: form.buyer_country_code,
        buyer_destination_code: form.buyer_destination_code,
        buyer_iec_no: form.buyer_iec_no,

        // GST & Manifest
        gst_invoice: form.gst_invoice,
        lut_igst: form.lut_igst,
        total_igst: form.total_igst,
        bank_ad_code: form.bank_ad_code,
        bank_account: form.bank_account,
        bank_ifsc: form.bank_ifsc,
        lut_number: form.lut_number,
        exchange_rate: form.exchange_rate,
        manifest_firm: form.manifest_firm,
        manifest_nfei: form.manifest_nfei,
        pay_of_igst: form.pay_of_igst,
        manifest_ecommerce: form.manifest_ecommerce,
        meis_scheme: form.meis_scheme,
        manifest_format: form.manifest_format,
        manifest_iec_no: form.manifest_iec_no,
        lut_issue_date: form.lut_issue_date,
        lut_till_date: form.lut_till_date,

        // Advanced
        company_code: form.company_code,
        is_commercial: form.is_commercial,
        csb_type: form.csb_type,
        otp: form.otp,
        lsp_type: form.lsp_type,
        required_performa: form.required_performa,
        required_label: form.required_label
      })

      toast.success(
        result?.push_result?.pushed
          ? `Booking created & auto-pushed to API! AWB: ${result.booking?.awb_number}`
          : `Booking created successfully! AWB: ${result.booking?.awb_number}`
      )
      navigate('/bookings')
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-3 text-[#0D2132] animate-fade-in font-sans">
      {/* ── Page Top Header ── */}
      <div className="bg-white rounded-lg border border-[#dce1e7] p-3 mb-3 shadow-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link
            to="/bookings"
            className="p-1.5 text-gray-500 hover:text-[#0D2132] hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold text-[#0D2132] tracking-tight">
              Create New Booking
            </h1>
            <p className="text-xs text-gray-500">
              Single-page docket creation with auto vendor API dispatch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-[#0D2132] text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase">
            Single Page Form
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Main 3 Columns Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">

          {/* ── Column 1: Sender / Shipper Details ── */}
          <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-xs flex flex-col justify-between">
            <div>
              <NavyBadge title="Shipper Details" icon={User} />

              <div className="space-y-2.5">
                <CompactField label="Sender Full Name" required>
                  <input
                    type="text"
                    placeholder="Sender Full Name"
                    value={form.sender_name}
                    onChange={e => updateForm('sender_name', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs font-semibold"
                  />
                </CompactField>

                <CompactField label="Company Name">
                  <input
                    type="text"
                    placeholder="Sender Company Name"
                    value={form.sender_company}
                    onChange={e => updateForm('sender_company', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs uppercase"
                  />
                </CompactField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactField label="Phone Number" required>
                    <input
                      type="tel"
                      placeholder="+91 99999 99999"
                      value={form.sender_phone}
                      onChange={e => updateForm('sender_phone', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="Email Address">
                    <input
                      type="email"
                      placeholder="sender@example.com"
                      value={form.sender_email}
                      onChange={e => updateForm('sender_email', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>

                <CompactField label="Address Line 1" required>
                  <input
                    type="text"
                    placeholder="Flat / Building / Street"
                    value={form.sender_address}
                    onChange={e => updateForm('sender_address', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>

                <CompactField label="Address Line 2">
                  <input
                    type="text"
                    placeholder="Area / Landmark"
                    value={form.sender_address_2}
                    onChange={e => updateForm('sender_address_2', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>

                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="City" required>
                    <input
                      type="text"
                      placeholder="City"
                      value={form.sender_city}
                      onChange={e => updateForm('sender_city', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                  <CompactField label="Pincode" required>
                    <input
                      type="text"
                      placeholder="Pincode"
                      value={form.sender_pincode}
                      onChange={e => updateForm('sender_pincode', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="State">
                    <input
                      type="text"
                      placeholder="State"
                      value={form.sender_state}
                      onChange={e => updateForm('sender_state', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs uppercase"
                    />
                  </CompactField>
                  <CompactField label="Country">
                    <input
                      type="text"
                      placeholder="Country"
                      value={form.sender_country}
                      onChange={e => updateForm('sender_country', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-bold uppercase"
                    />
                  </CompactField>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Doc Type">
                    <select
                      value={form.sender_gstin_type}
                      onChange={e => updateForm('sender_gstin_type', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs cursor-pointer"
                    >
                      <option value="">Select</option>
                      <option value="GSTIN">GSTIN</option>
                      <option value="PAN">PAN</option>
                      <option value="Aadhaar Number">Aadhaar</option>
                      <option value="Passport">Passport</option>
                      <option value="Voter ID">Voter ID</option>
                      <option value="Driving License">Driving License</option>
                    </select>
                  </CompactField>
                  <CompactField label="Document Number">
                    <input
                      type="text"
                      placeholder="Doc No."
                      value={form.sender_gstin_no}
                      onChange={e => updateForm('sender_gstin_no', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                </div>
              </div>
            </div>
          </div>

          {/* ── Column 2: Receiver / Consignee Details ── */}
          <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-xs flex flex-col justify-between">
            <div>
              <NavyBadge title="Consignee Details" icon={MapPin} />

              <div className="space-y-2.5">
                <CompactField label="Receiver Full Name" required highlight={!form.receiver_name && !form.receiver_company}>
                  <input
                    type="text"
                    placeholder="Receiver Full Name"
                    value={form.receiver_name}
                    onChange={e => updateForm('receiver_name', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs font-semibold"
                  />
                </CompactField>

                <CompactField label="Company Name">
                  <input
                    type="text"
                    placeholder="Receiver Company Name"
                    value={form.receiver_company}
                    onChange={e => updateForm('receiver_company', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs uppercase"
                  />
                </CompactField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactField label="Phone Number" required highlight={!form.receiver_phone}>
                    <input
                      type="tel"
                      placeholder="+1 999 999 9999"
                      value={form.receiver_phone}
                      onChange={e => updateForm('receiver_phone', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="Email Address">
                    <input
                      type="email"
                      placeholder="receiver@example.com"
                      value={form.receiver_email}
                      onChange={e => updateForm('receiver_email', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>

                <CompactField label="Address Line 1" required highlight={!form.receiver_address}>
                  <input
                    type="text"
                    placeholder="Street / House No."
                    value={form.receiver_address}
                    onChange={e => updateForm('receiver_address', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>

                <CompactField label="Address Line 2">
                  <input
                    type="text"
                    placeholder="Apt / Suite / Area"
                    value={form.receiver_address_2}
                    onChange={e => updateForm('receiver_address_2', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>

                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="City" required highlight={!form.receiver_city}>
                    <input
                      type="text"
                      placeholder="City"
                      value={form.receiver_city}
                      onChange={e => updateForm('receiver_city', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                  <CompactField label="Pincode" required>
                    <input
                      type="text"
                      placeholder="Zip / Pincode"
                      value={form.receiver_pincode}
                      onChange={e => updateForm('receiver_pincode', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="State">
                    <input
                      type="text"
                      placeholder="State / Province"
                      value={form.receiver_state}
                      onChange={e => updateForm('receiver_state', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs uppercase"
                    />
                  </CompactField>
                  <CompactField label="Country" required highlight={!form.receiver_country}>
                    <input
                      type="text"
                      placeholder="e.g. US, GB, AE"
                      value={form.receiver_country}
                      onChange={e => updateForm('receiver_country', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-bold uppercase text-red-600 placeholder-red-300"
                    />
                  </CompactField>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Doc Type">
                    <select
                      value={form.receiver_gstin_type}
                      onChange={e => updateForm('receiver_gstin_type', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs cursor-pointer"
                    >
                      <option value="">Select</option>
                      <option value="Tax ID">Tax ID</option>
                      <option value="VAT">VAT</option>
                      <option value="Passport">Passport</option>
                    </select>
                  </CompactField>
                  <CompactField label="Document Number">
                    <input
                      type="text"
                      placeholder="Doc No."
                      value={form.receiver_gstin_no}
                      onChange={e => updateForm('receiver_gstin_no', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                </div>
              </div>
            </div>
          </div>

          {/* ── Column 3: Courier & Vendor API Details ── */}
          <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-xs flex flex-col justify-between">
            <div>
              <NavyBadge title="Courier & Vendor API" icon={Plug} />

              <div className="space-y-2.5">
                {/* Vendor API Config Selection */}
                <CompactField label="Courier Vendor API">
                  <select
                    value={form.vendor_config_id}
                    onChange={e => {
                      updateForm('vendor_config_id', e.target.value)
                      updateForm('vendor_code', '')
                      updateForm('service_code', '')
                      updateForm('product_code', '')
                      setCustomVendorMode(false)
                      setCustomServiceMode(false)
                      setCustomProductMode(false)
                    }}
                    className="w-full bg-transparent focus:outline-none text-xs font-bold text-[#0D2132] cursor-pointer"
                  >
                    <option value="">— None (Local Only) —</option>
                    {activeVendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.vendor_code ? `(${v.vendor_code})` : ''}
                      </option>
                    ))}
                  </select>
                </CompactField>

                {form.vendor_config_id && (
                  <>
                    {/* Vendor Code */}
                    {vendorRequiresField('vendor_code') && (
                      <CompactField label="Vendor Code">
                        {customVendorMode ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={form.vendor_code}
                              onChange={e => updateForm('vendor_code', e.target.value)}
                              placeholder="e.g. PC, DHL"
                              className="w-full bg-transparent focus:outline-none text-xs uppercase"
                            />
                            <button
                              type="button"
                              onClick={() => setCustomVendorMode(false)}
                              className="text-[10px] text-gray-500 underline"
                            >
                              Reset
                            </button>
                          </div>
                        ) : vendorVendorCodes.length > 0 ? (
                          <select
                            value={form.vendor_code}
                            onChange={e => {
                              if (e.target.value === '__custom__') {
                                setCustomVendorMode(true)
                                updateForm('vendor_code', '')
                              } else {
                                updateForm('vendor_code', e.target.value)
                              }
                            }}
                            className="w-full bg-transparent focus:outline-none text-xs cursor-pointer font-bold"
                          >
                            <option value="">— Config Default —</option>
                            {vendorVendorCodes.map((vc, i) => (
                              <option key={i} value={vc.code}>
                                {vc.code} {vc.label && vc.label !== vc.code ? `— ${vc.label}` : ''}
                              </option>
                            ))}
                            <option value="__custom__">Custom Vendor Code...</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={form.vendor_code}
                            onChange={e => updateForm('vendor_code', e.target.value)}
                            placeholder="e.g. PC, DHL"
                            className="w-full bg-transparent focus:outline-none text-xs uppercase"
                          />
                        )}
                      </CompactField>
                    )}

                    {/* Service Code */}
                    {vendorRequiresField('service_code') && (
                      <CompactField label="Service Code">
                        {customServiceMode ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={form.service_code}
                              onChange={e => updateForm('service_code', e.target.value)}
                              placeholder="e.g. SPX, STD"
                              className="w-full bg-transparent focus:outline-none text-xs uppercase"
                            />
                            <button
                              type="button"
                              onClick={() => setCustomServiceMode(false)}
                              className="text-[10px] text-gray-500 underline"
                            >
                              Reset
                            </button>
                          </div>
                        ) : vendorServices.length > 0 ? (
                          <select
                            value={form.service_code}
                            onChange={e => {
                              if (e.target.value === '__custom__') {
                                setCustomServiceMode(true)
                                updateForm('service_code', '')
                              } else {
                                updateForm('service_code', e.target.value)
                              }
                            }}
                            className="w-full bg-transparent focus:outline-none text-xs cursor-pointer font-bold"
                          >
                            <option value="">— Config Default —</option>
                            {vendorServices.map((svc, i) => (
                              <option key={i} value={svc.code}>
                                {svc.code} {svc.label && svc.label !== svc.code ? `— ${svc.label}` : ''}
                              </option>
                            ))}
                            <option value="__custom__">Custom Service Code...</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={form.service_code}
                            onChange={e => updateForm('service_code', e.target.value)}
                            placeholder="e.g. SPX, STD"
                            className="w-full bg-transparent focus:outline-none text-xs uppercase"
                          />
                        )}
                      </CompactField>
                    )}

                    {/* Product Code */}
                    {vendorRequiresField('product_code') && (
                      <CompactField label="Product Code">
                        {customProductMode ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={form.product_code}
                              onChange={e => updateForm('product_code', e.target.value)}
                              placeholder="e.g. SPX, DOX"
                              className="w-full bg-transparent focus:outline-none text-xs uppercase"
                            />
                            <button
                              type="button"
                              onClick={() => setCustomProductMode(false)}
                              className="text-[10px] text-gray-500 underline"
                            >
                              Reset
                            </button>
                          </div>
                        ) : vendorProductRestrictions && filteredProductCodes.length > 0 ? (
                          <select
                            value={form.product_code}
                            onChange={e => {
                              if (e.target.value === '__custom__') {
                                setCustomProductMode(true)
                                updateForm('product_code', '')
                              } else {
                                updateForm('product_code', e.target.value)
                              }
                            }}
                            className="w-full bg-transparent focus:outline-none text-xs cursor-pointer font-bold"
                          >
                            <option value="">— Select / Auto —</option>
                            {filteredProductCodes.map((pc, i) => (
                              <option key={i} value={pc.code} disabled={!pc.eligible}>
                                {pc.code} {pc.label && pc.label !== pc.code ? `— ${pc.label}` : ''} {!pc.eligible ? `(${pc.reason})` : ''}
                              </option>
                            ))}
                            <option value="__custom__">Custom Product Code...</option>
                          </select>
                        ) : vendorProductCodes.length > 0 ? (
                          <select
                            value={form.product_code}
                            onChange={e => {
                              if (e.target.value === '__custom__') {
                                setCustomProductMode(true)
                                updateForm('product_code', '')
                              } else {
                                updateForm('product_code', e.target.value)
                              }
                            }}
                            className="w-full bg-transparent focus:outline-none text-xs cursor-pointer font-bold"
                          >
                            <option value="">— Select / Auto —</option>
                            {vendorProductCodes.map((pc, i) => (
                              <option key={i} value={pc.code}>
                                {pc.code} {pc.label && pc.label !== pc.code ? `— ${pc.label}` : ''}
                              </option>
                            ))}
                            <option value="__custom__">Custom Product Code...</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={form.product_code}
                            onChange={e => updateForm('product_code', e.target.value)}
                            placeholder="e.g. SPX, DOX"
                            className="w-full bg-transparent focus:outline-none text-xs uppercase"
                          />
                        )}
                      </CompactField>
                    )}
                  </>
                )}

                {/* Payment Mode & Charges */}
                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Payment Mode">
                    <select
                      value={form.payment_mode}
                      onChange={e => updateForm('payment_mode', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-bold cursor-pointer"
                    >
                      <option value="prepaid">Prepaid</option>
                      <option value="cod">COD</option>
                      <option value="credit">Account Credit</option>
                    </select>
                  </CompactField>
                  <CompactField label="Shipping Charge (₹)">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.shipping_charge}
                      onChange={e => updateForm('shipping_charge', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-semibold text-right"
                    />
                  </CompactField>
                </div>

                {form.payment_mode === 'cod' && (
                  <CompactField label="COD Amount (₹)" required>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.cod_amount}
                      onChange={e => updateForm('cod_amount', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-bold text-red-600 text-right"
                    />
                  </CompactField>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactField label="Order Ref No.">
                    <input
                      type="text"
                      placeholder="e.g. ORD-1002"
                      value={form.order_reference}
                      onChange={e => updateForm('order_reference', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="Remarks">
                    <input
                      type="text"
                      placeholder="Handling instructions"
                      value={form.remarks}
                      onChange={e => updateForm('remarks', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── Main Section 2: Package & Weight Specs ── */}
        <div className="bg-white rounded-lg border border-[#dce1e7] p-3 mb-3 shadow-xs">
          <NavyBadge title="Package & Weight Specifications" icon={Package} />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 mb-2.5">
            <CompactField label="Package Type">
              <select
                value={form.package_type}
                onChange={e => updateForm('package_type', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs font-bold cursor-pointer"
              >
                <option value="parcel">Parcel</option>
                <option value="document">Document / DOX</option>
                <option value="cover">Cover / Flyer</option>
                <option value="box">Box / Heavy</option>
              </select>
            </CompactField>

            <CompactField label="No. of Pieces">
              <input
                type="number"
                min="1"
                value={form.no_of_pieces}
                onChange={e => updateForm('no_of_pieces', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs font-bold text-center"
              />
            </CompactField>

            <CompactField label="Declared Value (₹)">
              <input
                type="number"
                placeholder="Declared value"
                value={form.declared_value}
                onChange={e => updateForm('declared_value', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs font-semibold"
              />
            </CompactField>

            <CompactField label="Content Description">
              <input
                type="text"
                placeholder="Items / Goods inside"
                value={form.content_description}
                onChange={e => updateForm('content_description', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs"
              />
            </CompactField>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-center">
            <CompactField label="Actual Wt (kg)" required highlight={!form.weight}>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.weight}
                onChange={e => updateForm('weight', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs font-extrabold text-right text-[#0D2132]"
              />
            </CompactField>

            <CompactField label="Length (cm)">
              <input
                type="number"
                placeholder="L"
                value={form.length}
                onChange={e => updateForm('length', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs text-center"
              />
            </CompactField>

            <CompactField label="Breadth (cm)">
              <input
                type="number"
                placeholder="B"
                value={form.breadth}
                onChange={e => updateForm('breadth', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs text-center"
              />
            </CompactField>

            <CompactField label="Height (cm)">
              <input
                type="number"
                placeholder="H"
                value={form.height}
                onChange={e => updateForm('height', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs text-center"
              />
            </CompactField>

            <CompactField label="Volumetric Wt (kg)">
              <input
                type="text"
                readOnly
                value={form.volumetric_weight || '0.00'}
                className="w-full bg-transparent focus:outline-none text-xs font-mono font-bold text-right text-gray-500"
              />
            </CompactField>
          </div>
        </div>

        {/* ── Collapsible Accordion Banners ── */}
        <div className="space-y-1 mb-4">
          
          {/* Accordion 1: Invoice & Export Details */}
          {vendorRequiresField('invoice') && (
            <>
              <AccordionBanner
                title="Click here for Invoice & Export Details"
                isOpen={showInvoice}
                onToggle={() => setShowInvoice(!showInvoice)}
              />
              {showInvoice && (
                <div className="bg-white border border-[#dce1e7] rounded p-3 my-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-slide-down">
                  <CompactField label="Invoice No">
                    <input
                      type="text"
                      placeholder="INV-001"
                      value={form.invoice_no}
                      onChange={e => updateForm('invoice_no', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
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
                  <CompactField label="Invoice Currency">
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
                  <CompactField label="HS Code">
                    <input
                      type="text"
                      placeholder="8471.30"
                      value={form.hs_code}
                      onChange={e => updateForm('hs_code', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="Export Reason">
                    <input
                      type="text"
                      placeholder="Commercial Goods / Gift"
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
                </div>
              )}
            </>
          )}

          {/* Accordion 2: eAWB Details */}
          {vendorRequiresField('eawb') && (
            <>
              <AccordionBanner
                title="Click here for eAWB Details"
                isOpen={showEawb}
                onToggle={() => setShowEawb(!showEawb)}
              />
              {showEawb && (
                <div className="bg-white border border-[#dce1e7] rounded p-3 my-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-slide-down">
                  <CompactField label="eAWB No">
                    <input
                      type="text"
                      placeholder="eAWB Number"
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
                  <CompactField label="eAWB Exp Date">
                    <input
                      type="date"
                      value={form.eawb_exp_date}
                      onChange={e => updateForm('eawb_exp_date', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>
              )}
            </>
          )}

          {/* Accordion 3: Additional Charges */}
          {vendorRequiresField('additional_charges') && (
            <>
              <AccordionBanner
                title="Click here for Additional Charges"
                isOpen={showAdditionalCharges}
                onToggle={() => setShowAdditionalCharges(!showAdditionalCharges)}
              />
              {showAdditionalCharges && (
                <div className="bg-white border border-[#dce1e7] rounded p-3 my-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-slide-down">
                  <CompactField label="Freight Charge">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.additional_freight}
                      onChange={e => updateForm('additional_freight', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                  <CompactField label="Insurance">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.additional_insurance}
                      onChange={e => updateForm('additional_insurance', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                  <CompactField label="Discount">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.additional_discount}
                      onChange={e => updateForm('additional_discount', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                  <CompactField label="Other Charges">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.additional_other_charges}
                      onChange={e => updateForm('additional_other_charges', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                  <CompactField label="Specify Charges">
                    <input
                      type="text"
                      placeholder="Details"
                      value={form.additional_specify_charges}
                      onChange={e => updateForm('additional_specify_charges', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>
              )}
            </>
          )}

          {/* Accordion 4: Buyer Details */}
          {vendorRequiresField('buyer_details') && (
            <>
              <AccordionBanner
                title="Click here for Buyer Details"
                isOpen={showBuyerDetails}
                onToggle={() => setShowBuyerDetails(!showBuyerDetails)}
              />
              {showBuyerDetails && (
                <div className="bg-white border border-[#dce1e7] rounded p-3 my-1 space-y-2.5 animate-slide-down">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <CompactField label="Buyer Name">
                      <input
                        type="text"
                        value={form.buyer_name}
                        onChange={e => updateForm('buyer_name', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-semibold"
                      />
                    </CompactField>
                    <CompactField label="Person Type">
                      <select
                        value={form.buyer_person_type}
                        onChange={e => updateForm('buyer_person_type', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs cursor-pointer"
                      >
                        <option value="Individual">Individual</option>
                        <option value="Company">Company</option>
                      </select>
                    </CompactField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <CompactField label="Buyer Address 1">
                      <input
                        type="text"
                        value={form.buyer_address1}
                        onChange={e => updateForm('buyer_address1', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs"
                      />
                    </CompactField>
                    <CompactField label="Buyer Address 2">
                      <input
                        type="text"
                        value={form.buyer_address2}
                        onChange={e => updateForm('buyer_address2', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs"
                      />
                    </CompactField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <CompactField label="City">
                      <input
                        type="text"
                        value={form.buyer_city}
                        onChange={e => updateForm('buyer_city', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs"
                      />
                    </CompactField>
                    <CompactField label="State">
                      <input
                        type="text"
                        value={form.buyer_state}
                        onChange={e => updateForm('buyer_state', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs"
                      />
                    </CompactField>
                    <CompactField label="Pincode">
                      <input
                        type="text"
                        value={form.buyer_pincode}
                        onChange={e => updateForm('buyer_pincode', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-mono"
                      />
                    </CompactField>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Accordion 5: GST & Manifest Details */}
          {vendorRequiresField('gst_manifest') && (
            <>
              <AccordionBanner
                title="Click here for GST & Manifest Details"
                isOpen={showGstManifest}
                onToggle={() => setShowGstManifest(!showGstManifest)}
              />
              {showGstManifest && (
                <div className="bg-white border border-[#dce1e7] rounded p-3 my-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-slide-down">
                  <CompactField label="GST Invoice">
                    <select
                      value={form.gst_invoice}
                      onChange={e => updateForm('gst_invoice', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs cursor-pointer"
                    >
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </CompactField>
                  <CompactField label="LUT IGST">
                    <select
                      value={form.lut_igst}
                      onChange={e => updateForm('lut_igst', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs cursor-pointer"
                    >
                      <option value="N">No (N)</option>
                      <option value="Y">Yes (Y)</option>
                    </select>
                  </CompactField>
                  <CompactField label="LUT Number">
                    <input
                      type="text"
                      value={form.lut_number}
                      onChange={e => updateForm('lut_number', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="Bank AD Code">
                    <input
                      type="text"
                      value={form.bank_ad_code}
                      onChange={e => updateForm('bank_ad_code', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="Bank Account">
                    <input
                      type="text"
                      value={form.bank_account}
                      onChange={e => updateForm('bank_account', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="Manifest Format">
                    <select
                      value={form.manifest_format}
                      onChange={e => updateForm('manifest_format', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs cursor-pointer"
                    >
                      <option value="C2C">C2C</option>
                      <option value="B2C">B2C</option>
                      <option value="B2B">B2B</option>
                    </select>
                  </CompactField>
                </div>
              )}
            </>
          )}

          {/* Accordion 6: Advanced Configuration */}
          {vendorRequiresField('advanced_config') && (
            <>
              <AccordionBanner
                title="Click here for Advanced Configuration"
                isOpen={showAdvancedConfig}
                onToggle={() => setShowAdvancedConfig(!showAdvancedConfig)}
              />
              {showAdvancedConfig && (
                <div className="bg-white border border-[#dce1e7] rounded p-3 my-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-slide-down">
                  <CompactField label="Company Code">
                    <input
                      type="text"
                      value={form.company_code}
                      onChange={e => updateForm('company_code', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs font-mono"
                    />
                  </CompactField>
                  <CompactField label="CSB Type">
                    <select
                      value={form.csb_type}
                      onChange={e => updateForm('csb_type', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs cursor-pointer"
                    >
                      <option value="">— Select —</option>
                      <option value="CSB-V">CSB-V (Non-Commercial)</option>
                      <option value="CSB-IV">CSB-IV (Commercial)</option>
                    </select>
                  </CompactField>
                  <CompactField label="LSP Type">
                    <input
                      type="text"
                      value={form.lsp_type}
                      onChange={e => updateForm('lsp_type', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </CompactField>
                </div>
              )}
            </>
          )}

        </div>

        {/* ── Footer Submit Bar ── */}
        <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-sm flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/bookings')}
            className="px-4 py-1.5 rounded border border-[#cfd8dc] bg-[#f8f9fa] text-xs font-bold text-[#455a64] hover:bg-[#eceff1]"
          >
            Cancel
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
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#0D2132] to-[#BB0013] text-white text-xs font-extrabold shadow-md hover:opacity-95 transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Booking...
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
    </div>
  )
}

// ── Shared Helper Components ──

function NavyBadge({ title, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="bg-[#0D2132] text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {title}
      </span>
    </div>
  )
}

function CompactField({ label, required, children, className = '', highlight = false }) {
  return (
    <div
      className={`relative border ${
        highlight
          ? 'border-red-500 ring-1 ring-red-200'
          : 'border-[#cfd8dc] focus-within:border-[#0D2132] focus-within:ring-1 focus-within:ring-[#0D2132]'
      } rounded bg-white px-2.5 py-1.5 transition-all ${className}`}
    >
      <label className="absolute -top-2.5 left-2 px-1 bg-white text-[9px] font-extrabold text-[#455a64] uppercase tracking-tighter whitespace-nowrap z-10">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <div className="pt-0.5">{children}</div>
    </div>
  )
}

function AccordionBanner({ title, isOpen, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full bg-[#e0e4e8] hover:bg-[#d5dadf] text-[#0D2132] font-extrabold text-xs py-2.5 px-4 rounded flex items-center justify-between transition-colors shadow-2xs my-1"
    >
      <span>{title}</span>
      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  )
}
