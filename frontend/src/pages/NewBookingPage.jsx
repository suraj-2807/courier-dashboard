import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCreateBooking } from '../hooks/useBookings'
import { getActiveVendors } from '../api/apiSettings.api'
import {
  ArrowLeft,
  ArrowRight,
  HelpCircle,
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
  DollarSign,
  Users,
  Shield,
  Settings
} from 'lucide-react'
import toast from 'react-hot-toast'

const STEPS = [
  { id: 1, label: 'Sender & Receiver', icon: User },
  { id: 2, label: 'Package Specs', icon: Package },
  { id: 3, label: 'Courier Options', icon: Truck }
]

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
  // Step 3 — Courier
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
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)

  // Custom input mode toggles for vendor, service, and product codes
  const [customVendorMode, setCustomVendorMode] = useState(false)
  const [customServiceMode, setCustomServiceMode] = useState(false)
  const [customProductMode, setCustomProductMode] = useState(false)

  // Collapsible section toggles
  const [showEawb, setShowEawb] = useState(false)
  const [showAdditionalCharges, setShowAdditionalCharges] = useState(false)
  const [showBuyerDetails, setShowBuyerDetails] = useState(false)
  const [showGstManifest, setShowGstManifest] = useState(false)
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false)

  // Fetch active vendors for Step 3 dropdown
  const { data: vendorsData } = useQuery({
    queryKey: ['active-vendors'],
    queryFn: getActiveVendors
  })
  const activeVendors = vendorsData?.vendors || []

  // Get selected vendor's service codes
  const selectedVendor = activeVendors.find(v => v.id === form.vendor_config_id)
  const vendorServices = selectedVendor?.available_services || []

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const nextStep = () => {
    if (step < 3) setStep(step + 1)
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const result = await createBooking.mutateAsync({
        sender_name: form.sender_name,
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
        receiver_name: form.receiver_name,
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
        content_description: form.content_description,
        declared_value: parseFloat(form.declared_value) || 0,
        package_type: form.package_type,
        payment_mode: form.payment_mode,
        shipping_charge: parseFloat(form.shipping_charge) || 0,
        total_amount: parseFloat(form.total_amount) || 0,
        order_reference: form.order_reference,
        remarks: form.remarks,
        vendor_config_id: form.vendor_config_id || null,
        vendor_code: form.vendor_code || '',
        service_code: form.service_code || '',
        product_code: form.product_code || '',
        cod_amount: parseFloat(form.cod_amount) || 0,
        // Pacific-specific fields
        invoice_no: form.invoice_no,
        invoice_date: form.invoice_date,
        invoice_currency: form.invoice_currency,
        hs_code: form.hs_code,
        export_reason: form.export_reason,
        terms_of_trade: form.terms_of_trade,
        // eAWB Details
        eawb_no: form.eawb_no,
        eawb_date: form.eawb_date,
        eawb_exp_date: form.eawb_exp_date,
        // Additional Charges
        additional_discount: form.additional_discount,
        additional_freight: form.additional_freight,
        additional_insurance: form.additional_insurance,
        additional_other_charges: form.additional_other_charges,
        additional_specify_charges: form.additional_specify_charges,
        // Buyer Details
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
        // Advanced Config
        company_code: form.company_code,
        is_commercial: form.is_commercial,
        csb_type: form.csb_type,
        otp: form.otp,
        lsp_type: form.lsp_type,
        required_performa: form.required_performa,
        required_label: form.required_label
      })

      // Show vendor result if available
      const vendorResult = result?.vendor_result
      if (vendorResult?.success && vendorResult?.awbNumber) {
        toast.success(`Shipment created! Vendor AWB: ${vendorResult.awbNumber}`, { duration: 5000 })
      } else if (vendorResult && !vendorResult.success) {
        toast.success('Shipment created locally!')
        toast.error(`Vendor push failed: ${vendorResult.error || 'Unknown error'}`, { duration: 5000 })
      } else {
        toast.success('Shipment created successfully!')
      }
      navigate('/bookings')
    } catch (err) {
      toast.error(err?.message || 'Failed to create shipment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-alt">
      {/* Top Bar */}
      <div className="bg-surface border-b border-border sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/bookings"
              className="flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              CANCEL
            </Link>
            <div className="w-px h-5 bg-border" />
            <h1 className="text-[16px] font-extrabold text-text-primary">New Shipment</h1>
          </div>
          <button className="p-2 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer">
            <HelpCircle className="w-[18px] h-[18px] text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Stepper */}
            <div className="bg-surface border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between">
                {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center flex-1">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all ${
                        step > s.id
                          ? 'bg-success text-white'
                          : step === s.id
                            ? 'bg-primary text-white shadow-lg shadow-primary/25'
                            : 'bg-surface-alt border border-border text-text-tertiary'
                      }`}>
                        {step > s.id ? <Check className="w-4 h-4" /> : s.id}
                      </div>
                      <span className={`text-[12px] font-semibold hidden sm:block ${
                        step === s.id ? 'text-text-primary' : 'text-text-tertiary'
                      }`}>
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-px mx-4 transition-colors ${
                        step > s.id ? 'bg-success' : 'bg-border'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1: Sender & Receiver */}
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                {/* Sender */}
                <div className="bg-surface border border-border rounded-2xl">
                  <div className="p-5 border-b border-border flex items-center gap-2.5">
                    <User className="w-5 h-5 text-text-tertiary" />
                    <h2 className="text-[16px] font-bold text-text-primary">Sender Information</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Contact Name" required>
                        <input
                          type="text"
                          placeholder="e.g. Rachit Shah"
                          value={form.sender_name}
                          onChange={e => updateForm('sender_name', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Company Name">
                        <input
                          type="text"
                          placeholder="e.g. Acme Corp Pvt Ltd"
                          value={form.sender_company}
                          onChange={e => updateForm('sender_company', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Email Address">
                        <input
                          type="email"
                          placeholder="sender@example.com"
                          value={form.sender_email}
                          onChange={e => updateForm('sender_email', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Phone Number" required>
                        <input
                          type="tel"
                          placeholder="+91 99999 99999"
                          value={form.sender_phone}
                          onChange={e => updateForm('sender_phone', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Address Line 1" required>
                        <input
                          type="text"
                          placeholder="Street / Building"
                          value={form.sender_address}
                          onChange={e => updateForm('sender_address', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Address Line 2">
                        <input
                          type="text"
                          placeholder="Area / Landmark"
                          value={form.sender_address_2}
                          onChange={e => updateForm('sender_address_2', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField label="City" required>
                        <input
                          type="text"
                          placeholder="City"
                          value={form.sender_city}
                          onChange={e => updateForm('sender_city', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Pincode" required>
                        <input
                          type="text"
                          placeholder="Zip / Postal"
                          value={form.sender_pincode}
                          onChange={e => updateForm('sender_pincode', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="State">
                        <input
                          type="text"
                          placeholder="State"
                          value={form.sender_state}
                          onChange={e => updateForm('sender_state', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Document Type">
                        <select
                          value={form.sender_gstin_type}
                          onChange={e => updateForm('sender_gstin_type', e.target.value)}
                          className="form-input"
                        >
                          <option value="">— Select —</option>
                          <option value="Aadhaar Number">Aadhaar Number</option>
                          <option value="Pan Number">PAN Number</option>
                          <option value="Passport">Passport</option>
                          <option value="Voter ID">Voter ID</option>
                          <option value="Driving License">Driving License</option>
                        </select>
                      </FormField>
                      <FormField label="Document Number">
                        <input
                          type="text"
                          placeholder="e.g. 1234 5678 9012"
                          value={form.sender_gstin_no}
                          onChange={e => updateForm('sender_gstin_no', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>
                  </div>
                </div>

                {/* Receiver */}
                <div className="bg-surface border border-border rounded-2xl">
                  <div className="p-5 border-b border-border flex items-center gap-2.5">
                    <MapPin className="w-5 h-5 text-primary" />
                    <h2 className="text-[16px] font-bold text-text-primary">Receiver Information</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <FormField label="Full Name / Company" required>
                      <input
                        type="text"
                        placeholder="Receiver Name"
                        value={form.receiver_name}
                        onChange={e => updateForm('receiver_name', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Email Address">
                        <input
                          type="email"
                          placeholder="receiver@example.com"
                          value={form.receiver_email}
                          onChange={e => updateForm('receiver_email', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Phone Number" required>
                        <input
                          type="tel"
                          placeholder="+1 999 999 9999"
                          value={form.receiver_phone}
                          onChange={e => updateForm('receiver_phone', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Address Line 1" required>
                        <input
                          type="text"
                          placeholder="Street / Building"
                          value={form.receiver_address}
                          onChange={e => updateForm('receiver_address', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Address Line 2">
                        <input
                          type="text"
                          placeholder="Apt / Suite / Floor"
                          value={form.receiver_address_2}
                          onChange={e => updateForm('receiver_address_2', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="City" required>
                        <input
                          type="text"
                          placeholder="City"
                          value={form.receiver_city}
                          onChange={e => updateForm('receiver_city', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Country" required>
                        <input
                          type="text"
                          placeholder="e.g. US, GB, AE"
                          value={form.receiver_country}
                          onChange={e => updateForm('receiver_country', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Pincode" required>
                        <input
                          type="text"
                          placeholder="Zip / Postal"
                          value={form.receiver_pincode}
                          onChange={e => updateForm('receiver_pincode', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="State">
                        <input
                          type="text"
                          placeholder="State"
                          value={form.receiver_state}
                          onChange={e => updateForm('receiver_state', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Document Type">
                        <select
                          value={form.receiver_gstin_type}
                          onChange={e => updateForm('receiver_gstin_type', e.target.value)}
                          className="form-input"
                        >
                          <option value="">— Select —</option>
                          <option value="Pan Number">PAN Number</option>
                          <option value="Passport">Passport</option>
                          <option value="Tax ID">Tax ID</option>
                        </select>
                      </FormField>
                      <FormField label="Document Number">
                        <input
                          type="text"
                          placeholder="e.g. ABCDE1234F"
                          value={form.receiver_gstin_no}
                          onChange={e => updateForm('receiver_gstin_no', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Package Specs */}
            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-surface border border-border rounded-2xl">
                  <div className="p-5 border-b border-border flex items-center gap-2.5">
                    <Package className="w-5 h-5 text-text-tertiary" />
                    <h2 className="text-[16px] font-bold text-text-primary">Package Details</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Package Type" required>
                        <select
                          value={form.package_type}
                          onChange={e => updateForm('package_type', e.target.value)}
                          className="form-input"
                        >
                          <option value="document">Document</option>
                          <option value="parcel">Parcel</option>
                          <option value="fragile">Fragile</option>
                          <option value="heavy">Heavy</option>
                        </select>
                      </FormField>
                      <FormField label="No. of Pieces" required>
                        <input
                          type="number"
                          min="1"
                          placeholder="1"
                          value={form.no_of_pieces}
                          onChange={e => updateForm('no_of_pieces', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>

                    <FormField label="Content Description">
                      <input
                        type="text"
                        placeholder="e.g. Electronics, Clothing, Documents..."
                        value={form.content_description}
                        onChange={e => updateForm('content_description', e.target.value)}
                        className="form-input"
                      />
                    </FormField>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Actual Weight (kg)" required>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0.0"
                          value={form.weight}
                          onChange={e => updateForm('weight', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Declared Value (₹)">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={form.declared_value}
                          onChange={e => updateForm('declared_value', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>
                  </div>
                </div>

                {/* Dimensions */}
                <div className="bg-surface border border-border rounded-2xl">
                  <div className="p-5 border-b border-border">
                    <h2 className="text-[16px] font-bold text-text-primary">Dimensions (cm)</h2>
                    <p className="text-[12px] text-text-tertiary mt-0.5">Used for volumetric weight calculation</p>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-3 gap-4">
                      <FormField label="Length">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0"
                          value={form.length}
                          onChange={e => updateForm('length', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Width">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0"
                          value={form.breadth}
                          onChange={e => updateForm('breadth', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Height">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0"
                          value={form.height}
                          onChange={e => updateForm('height', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>

                    {/* Volumetric weight auto-calc */}
                    {form.length && form.breadth && form.height && (
                      <div className="mt-4 p-3 bg-surface-alt rounded-xl border border-border animate-fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-text-secondary font-medium">Volumetric Weight</span>
                          <span className="text-[14px] font-bold text-text-primary">
                            {((form.length * form.breadth * form.height) / 5000).toFixed(2)} kg
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.is_fragile}
                          onChange={e => updateForm('is_fragile', e.target.checked)}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <span className="text-[13px] text-text-secondary">Fragile / Handle with care</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Invoice & Export Details */}
                <div className="bg-surface border border-border rounded-2xl">
                  <div className="p-5 border-b border-border flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <h2 className="text-[16px] font-bold text-text-primary">Invoice & Export Details</h2>
                      <p className="text-[11px] text-text-tertiary mt-0.5">Required for international shipments</p>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField label="Invoice Number">
                        <input
                          type="text"
                          placeholder="e.g. INV-2026-001"
                          value={form.invoice_no}
                          onChange={e => updateForm('invoice_no', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Invoice Date">
                        <input
                          type="date"
                          value={form.invoice_date}
                          onChange={e => updateForm('invoice_date', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Currency">
                        <select
                          value={form.invoice_currency}
                          onChange={e => updateForm('invoice_currency', e.target.value)}
                          className="form-input"
                        >
                          <option value="INR">INR — Indian Rupee</option>
                          <option value="USD">USD — US Dollar</option>
                          <option value="GBP">GBP — British Pound</option>
                          <option value="EUR">EUR — Euro</option>
                          <option value="AED">AED — UAE Dirham</option>
                          <option value="SGD">SGD — Singapore Dollar</option>
                          <option value="AUD">AUD — Australian Dollar</option>
                        </select>
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField label="HS Code">
                        <input
                          type="text"
                          placeholder="e.g. 854231"
                          value={form.hs_code}
                          onChange={e => updateForm('hs_code', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="Export Reason">
                        <select
                          value={form.export_reason}
                          onChange={e => updateForm('export_reason', e.target.value)}
                          className="form-input"
                        >
                          <option value="">— Select —</option>
                          <option value="COMMERCIAL">Commercial</option>
                          <option value="FREE SAMPLE OF NO COMMERICAL VALUE">Free Sample</option>
                          <option value="PERSONAL USE">Personal Use</option>
                          <option value="GIFT">Gift</option>
                          <option value="REPAIR AND RETURN">Repair & Return</option>
                          <option value="EXHIBITION">Exhibition</option>
                        </select>
                      </FormField>
                      <FormField label="Terms of Trade">
                        <select
                          value={form.terms_of_trade}
                          onChange={e => updateForm('terms_of_trade', e.target.value)}
                          className="form-input"
                        >
                          <option value="CIF">CIF — Cost, Insurance & Freight</option>
                          <option value="FOB">FOB — Free on Board</option>
                          <option value="EXW">EXW — Ex Works</option>
                          <option value="DAP">DAP — Delivered at Place</option>
                          <option value="DDP">DDP — Delivered Duty Paid</option>
                        </select>
                      </FormField>
                    </div>
                  </div>
                </div>

                {/* eAWB Details — Collapsible */}
                <CollapsibleSection
                  label="eAWB Details"
                  description="Electronic Airway Bill information"
                  icon={FileText}
                  isOpen={showEawb}
                  onToggle={() => setShowEawb(!showEawb)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="eAWB Number">
                      <input
                        type="text"
                        placeholder="e.g. testeawb123"
                        value={form.eawb_no}
                        onChange={e => updateForm('eawb_no', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="eAWB Date">
                      <input
                        type="date"
                        value={form.eawb_date}
                        onChange={e => updateForm('eawb_date', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="eAWB Expiry Date">
                      <input
                        type="date"
                        value={form.eawb_exp_date}
                        onChange={e => updateForm('eawb_exp_date', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                  </div>
                </CollapsibleSection>

                {/* Additional Charges — Collapsible */}
                <CollapsibleSection
                  label="Additional Charges"
                  description="Discount, freight, insurance & other charges"
                  icon={DollarSign}
                  isOpen={showAdditionalCharges}
                  onToggle={() => setShowAdditionalCharges(!showAdditionalCharges)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Discount">
                      <input
                        type="text"
                        placeholder="0.00"
                        value={form.additional_discount}
                        onChange={e => updateForm('additional_discount', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Freight Charges">
                      <input
                        type="text"
                        placeholder="0.00"
                        value={form.additional_freight}
                        onChange={e => updateForm('additional_freight', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Insurance">
                      <input
                        type="text"
                        placeholder="0.00"
                        value={form.additional_insurance}
                        onChange={e => updateForm('additional_insurance', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Other Charges">
                      <input
                        type="text"
                        placeholder="0.00"
                        value={form.additional_other_charges}
                        onChange={e => updateForm('additional_other_charges', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Specify Charges">
                      <input
                        type="text"
                        placeholder="0"
                        value={form.additional_specify_charges}
                        onChange={e => updateForm('additional_specify_charges', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                  </div>
                </CollapsibleSection>
              </div>
            )}

            {/* Step 3: Courier Options */}
            {step === 3 && (
              <div className="space-y-6 animate-fade-in">
                {/* Vendor API Selection */}
                <div className="bg-surface border border-border rounded-2xl">
                  <div className="p-5 border-b border-border flex items-center gap-2.5">
                    <Plug className="w-5 h-5 text-primary" />
                    <div>
                      <h2 className="text-[16px] font-bold text-text-primary">Vendor API</h2>
                      <p className="text-[11px] text-text-tertiary mt-0.5">Select a courier vendor to auto-push shipment via API</p>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Courier Vendor">
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
                          className="form-input"
                        >
                          <option value="">— None (Local only) —</option>
                          {activeVendors.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.name} {v.vendor_code ? `(${v.vendor_code})` : ''}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      {form.vendor_config_id && (
                        <>
                          <FormField label="Vendor Code">
                            {customVendorMode ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={form.vendor_code}
                                  onChange={e => updateForm('vendor_code', e.target.value)}
                                  placeholder="e.g. PC, DHL, FEDEX"
                                  className="form-input flex-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomVendorMode(false)
                                    updateForm('vendor_code', '')
                                  }}
                                  className="px-3 py-2 text-[12px] font-bold text-text-secondary border border-border rounded-xl hover:bg-surface-hover transition-colors"
                                >
                                  Reset
                                </button>
                              </div>
                            ) : (
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
                                className="form-input"
                              >
                                <option value="">— Select / Use Config Default —</option>
                                <option value="PC">PC — Pacific Express</option>
                                <option value="DHL">DHL — DHL Express</option>
                                <option value="FEDEX">FEDEX — FedEx</option>
                                <option value="UPS">UPS — UPS</option>
                                <option value="TNT">TNT — TNT</option>
                                <option value="ARAMEX">ARAMEX — Aramex</option>
                                <option value="SELF">SELF — Self Routing</option>
                                <option value="__custom__">Custom Vendor Code...</option>
                              </select>
                            )}
                          </FormField>

                          <FormField label="Product Code">
                            {customProductMode ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={form.product_code}
                                  onChange={e => updateForm('product_code', e.target.value)}
                                  placeholder="e.g. SPX, DOX, INTL. SPX"
                                  className="form-input flex-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomProductMode(false)
                                    updateForm('product_code', '')
                                  }}
                                  className="px-3 py-2 text-[12px] font-bold text-text-secondary border border-border rounded-xl hover:bg-surface-hover transition-colors"
                                >
                                  Reset
                                </button>
                              </div>
                            ) : (
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
                                className="form-input"
                              >
                                <option value="">— Select / Auto-detect —</option>
                                <option value="SPX">SPX — Parcel/Sample</option>
                                <option value="DOX">DOX — Document</option>
                                <option value="INTL. SPX">INTL. SPX — International Parcel</option>
                                <option value="INTL. DOX">INTL. DOX — International Document</option>
                                <option value="__custom__">Custom Product Code...</option>
                              </select>
                            )}
                          </FormField>

                          <FormField label="Service Type / Code">
                            {vendorServices.length > 0 ? (
                              <select
                                value={form.service_code}
                                onChange={e => updateForm('service_code', e.target.value)}
                                className="form-input"
                              >
                                <option value="">— Select Service —</option>
                                {vendorServices.map((svc, i) => (
                                  <option key={i} value={svc.code}>
                                    {svc.label || svc.code} ({svc.code})
                                  </option>
                                ))}
                              </select>
                            ) : customServiceMode ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={form.service_code}
                                  onChange={e => updateForm('service_code', e.target.value)}
                                  placeholder="e.g. PC-PXC-EXPRESS"
                                  className="form-input flex-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomServiceMode(false)
                                    updateForm('service_code', '')
                                  }}
                                  className="px-3 py-2 text-[12px] font-bold text-text-secondary border border-border rounded-xl hover:bg-surface-hover transition-colors"
                                >
                                  Reset
                                </button>
                              </div>
                            ) : (
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
                                className="form-input"
                              >
                                <option value="">— Select Service Code —</option>
                                <option value="EXPRESS">EXPRESS — Express Service</option>
                                <option value="ECONOMY">ECONOMY — Economy Service</option>
                                <option value="SELF">SELF — Self Service</option>
                                <option value="STANDARD">STANDARD — Standard Service</option>
                                <option value="__custom__">Custom Service Code...</option>
                              </select>
                            )}
                          </FormField>
                        </>
                      )}
                    </div>
                    {form.vendor_config_id && (
                      <div className="p-3 bg-surface-alt rounded-xl border border-border-light animate-fade-in">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[12px] font-semibold text-text-secondary">
                            Shipment will be auto-pushed to {selectedVendor?.name || 'vendor'} API after booking
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Buyer Details — Collapsible */}
                <CollapsibleSection
                  label="Buyer Details"
                  description="Fill if buyer is different from receiver"
                  icon={Users}
                  isOpen={showBuyerDetails}
                  onToggle={() => setShowBuyerDetails(!showBuyerDetails)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Buyer Name">
                      <input
                        type="text"
                        placeholder="e.g. Anurag"
                        value={form.buyer_name}
                        onChange={e => updateForm('buyer_name', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Person Type">
                      <select
                        value={form.buyer_person_type}
                        onChange={e => updateForm('buyer_person_type', e.target.value)}
                        className="form-input"
                      >
                        <option value="Individual">Individual</option>
                        <option value="Business">Business</option>
                      </select>
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Address Line 1">
                      <input
                        type="text"
                        placeholder="Street / Building"
                        value={form.buyer_address1}
                        onChange={e => updateForm('buyer_address1', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Address Line 2">
                      <input
                        type="text"
                        placeholder="Area / Landmark"
                        value={form.buyer_address2}
                        onChange={e => updateForm('buyer_address2', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="City">
                      <input
                        type="text"
                        placeholder="City"
                        value={form.buyer_city}
                        onChange={e => updateForm('buyer_city', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="State">
                      <input
                        type="text"
                        placeholder="State"
                        value={form.buyer_state}
                        onChange={e => updateForm('buyer_state', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Pincode">
                      <input
                        type="text"
                        placeholder="Zip / Postal"
                        value={form.buyer_pincode}
                        onChange={e => updateForm('buyer_pincode', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Telephone">
                      <input
                        type="tel"
                        placeholder="Telephone"
                        value={form.buyer_telephone}
                        onChange={e => updateForm('buyer_telephone', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Mobile">
                      <input
                        type="tel"
                        placeholder="Mobile"
                        value={form.buyer_mobile}
                        onChange={e => updateForm('buyer_mobile', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Email">
                      <input
                        type="email"
                        placeholder="buyer@example.com"
                        value={form.buyer_email}
                        onChange={e => updateForm('buyer_email', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Country Code">
                      <input
                        type="text"
                        placeholder="e.g. US, GB"
                        value={form.buyer_country_code}
                        onChange={e => updateForm('buyer_country_code', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Destination Code">
                      <input
                        type="text"
                        placeholder="e.g. GB, US"
                        value={form.buyer_destination_code}
                        onChange={e => updateForm('buyer_destination_code', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="IEC Number">
                      <input
                        type="text"
                        placeholder="IEC No."
                        value={form.buyer_iec_no}
                        onChange={e => updateForm('buyer_iec_no', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                  </div>
                </CollapsibleSection>

                {/* GST & Manifest Details — Collapsible */}
                <CollapsibleSection
                  label="GST & Manifest Details"
                  description="GST invoice, LUT, bank & IEC details"
                  icon={Shield}
                  isOpen={showGstManifest}
                  onToggle={() => setShowGstManifest(!showGstManifest)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="GST Invoice">
                      <select
                        value={form.gst_invoice}
                        onChange={e => updateForm('gst_invoice', e.target.value)}
                        className="form-input"
                      >
                        <option value="0">No</option>
                        <option value="1">Yes</option>
                      </select>
                    </FormField>
                    <FormField label="LUT IGST">
                      <select
                        value={form.lut_igst}
                        onChange={e => updateForm('lut_igst', e.target.value)}
                        className="form-input"
                      >
                        <option value="N">No</option>
                        <option value="Y">Yes</option>
                      </select>
                    </FormField>
                    <FormField label="Total IGST">
                      <input
                        type="text"
                        placeholder="0.00"
                        value={form.total_igst}
                        onChange={e => updateForm('total_igst', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Bank AD Code">
                      <input
                        type="text"
                        placeholder="AD Code"
                        value={form.bank_ad_code}
                        onChange={e => updateForm('bank_ad_code', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Bank Account">
                      <input
                        type="text"
                        placeholder="Account No."
                        value={form.bank_account}
                        onChange={e => updateForm('bank_account', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Bank IFSC">
                      <input
                        type="text"
                        placeholder="IFSC Code"
                        value={form.bank_ifsc}
                        onChange={e => updateForm('bank_ifsc', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="LUT Number">
                      <input
                        type="text"
                        placeholder="LUT No."
                        value={form.lut_number}
                        onChange={e => updateForm('lut_number', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="LUT Issue Date">
                      <input
                        type="date"
                        value={form.lut_issue_date}
                        onChange={e => updateForm('lut_issue_date', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="LUT Till Date">
                      <input
                        type="date"
                        value={form.lut_till_date}
                        onChange={e => updateForm('lut_till_date', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Exchange Rate">
                      <input
                        type="text"
                        placeholder="0.00"
                        value={form.exchange_rate}
                        onChange={e => updateForm('exchange_rate', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Firm">
                      <input
                        type="text"
                        placeholder="e.g. NG"
                        value={form.manifest_firm}
                        onChange={e => updateForm('manifest_firm', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="NFEI">
                      <select
                        value={form.manifest_nfei}
                        onChange={e => updateForm('manifest_nfei', e.target.value)}
                        className="form-input"
                      >
                        <option value="1">Yes (1)</option>
                        <option value="0">No (0)</option>
                      </select>
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Pay of IGST">
                      <input
                        type="text"
                        placeholder="0"
                        value={form.pay_of_igst}
                        onChange={e => updateForm('pay_of_igst', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="E-Commerce">
                      <select
                        value={form.manifest_ecommerce}
                        onChange={e => updateForm('manifest_ecommerce', e.target.value)}
                        className="form-input"
                      >
                        <option value="0">No (0)</option>
                        <option value="1">Yes (1)</option>
                      </select>
                    </FormField>
                    <FormField label="MEIS Scheme">
                      <select
                        value={form.meis_scheme}
                        onChange={e => updateForm('meis_scheme', e.target.value)}
                        className="form-input"
                      >
                        <option value="0">No (0)</option>
                        <option value="1">Yes (1)</option>
                      </select>
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Format">
                      <select
                        value={form.manifest_format}
                        onChange={e => updateForm('manifest_format', e.target.value)}
                        className="form-input"
                      >
                        <option value="C2C">C2C</option>
                        <option value="B2C">B2C</option>
                        <option value="B2B">B2B</option>
                      </select>
                    </FormField>
                    <FormField label="IEC Number">
                      <input
                        type="text"
                        placeholder="IEC No."
                        value={form.manifest_iec_no}
                        onChange={e => updateForm('manifest_iec_no', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                  </div>
                </CollapsibleSection>

                {/* Advanced Shipment Config — Collapsible */}
                <CollapsibleSection
                  label="Advanced Configuration"
                  description="Company code, CSB type, OTP & LSP settings"
                  icon={Settings}
                  isOpen={showAdvancedConfig}
                  onToggle={() => setShowAdvancedConfig(!showAdvancedConfig)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Company Code">
                      <input
                        type="text"
                        placeholder="e.g. BS, PC"
                        value={form.company_code}
                        onChange={e => updateForm('company_code', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="CSB Type">
                      <select
                        value={form.csb_type}
                        onChange={e => updateForm('csb_type', e.target.value)}
                        className="form-input"
                      >
                        <option value="">— Auto from Export Reason —</option>
                        <option value="COMMERCIAL">COMMERCIAL</option>
                        <option value="FREE SAMPLE OF NO COMMERICAL VALUE">FREE SAMPLE</option>
                        <option value="PERSONAL USE">PERSONAL USE</option>
                        <option value="GIFT">GIFT</option>
                      </select>
                    </FormField>
                    <FormField label="Is Commercial">
                      <select
                        value={form.is_commercial}
                        onChange={e => updateForm('is_commercial', e.target.value)}
                        className="form-input"
                      >
                        <option value="">— Auto-detect —</option>
                        <option value="0">No (0)</option>
                        <option value="1">Yes (1)</option>
                      </select>
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="OTP">
                      <input
                        type="text"
                        placeholder="123456"
                        value={form.otp}
                        onChange={e => updateForm('otp', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="LSP Type">
                      <select
                        value={form.lsp_type}
                        onChange={e => updateForm('lsp_type', e.target.value)}
                        className="form-input"
                      >
                        <option value="">— Default (I) —</option>
                        <option value="I">I — International</option>
                        <option value="D">D — Domestic</option>
                      </select>
                    </FormField>
                    <FormField label="Required Performa">
                      <select
                        value={form.required_performa}
                        onChange={e => updateForm('required_performa', e.target.value)}
                        className="form-input"
                      >
                        <option value="">— Default (Yes) —</option>
                        <option value="y">Yes</option>
                        <option value="n">No</option>
                      </select>
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Required Label">
                      <select
                        value={form.required_label}
                        onChange={e => updateForm('required_label', e.target.value)}
                        className="form-input"
                      >
                        <option value="">— Default (Yes) —</option>
                        <option value="y">Yes</option>
                        <option value="n">No</option>
                      </select>
                    </FormField>
                  </div>
                </CollapsibleSection>

                {/* Shipping & Payment */}
                <div className="bg-surface border border-border rounded-2xl">
                  <div className="p-5 border-b border-border flex items-center gap-2.5">
                    <Truck className="w-5 h-5 text-text-tertiary" />
                    <h2 className="text-[16px] font-bold text-text-primary">Shipping & Payment</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Payment Mode" required>
                        <select
                          value={form.payment_mode}
                          onChange={e => updateForm('payment_mode', e.target.value)}
                          className="form-input"
                        >
                          <option value="prepaid">Prepaid</option>
                          <option value="cod">Cash on Delivery (COD)</option>
                          <option value="to_pay">To Pay</option>
                        </select>
                      </FormField>
                      <FormField label="Shipping Charge (₹)">
                        <input
                          type="number"
                          min="0"
                          placeholder="0.00"
                          value={form.shipping_charge}
                          onChange={e => updateForm('shipping_charge', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    </div>

                    {form.payment_mode === 'cod' && (
                      <FormField label="COD Amount (₹)" required>
                        <input
                          type="number"
                          min="0"
                          placeholder="0.00"
                          value={form.cod_amount}
                          onChange={e => updateForm('cod_amount', e.target.value)}
                          className="form-input"
                        />
                      </FormField>
                    )}

                    <FormField label="Total Amount (₹)" required>
                      <input
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={form.total_amount}
                        onChange={e => updateForm('total_amount', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="bg-surface border border-border rounded-2xl">
                  <div className="p-5 border-b border-border">
                    <h2 className="text-[16px] font-bold text-text-primary">Additional Information</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <FormField label="Order Reference">
                      <input
                        type="text"
                        placeholder="e.g. PO-12345 or Invoice number"
                        value={form.order_reference}
                        onChange={e => updateForm('order_reference', e.target.value)}
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Special Instructions">
                      <textarea
                        rows={3}
                        placeholder="Any special handling or delivery instructions..."
                        value={form.remarks}
                        onChange={e => updateForm('remarks', e.target.value)}
                        className="form-input resize-none"
                      />
                    </FormField>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-center gap-3 py-4">
              {step > 1 && (
                <button
                  onClick={prevStep}
                  className="flex items-center gap-2 px-6 py-2.5 border border-border rounded-xl text-[13px] font-semibold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              {step === 1 && (
                <button
                  className="flex items-center gap-2 px-6 py-2.5 border border-border rounded-xl text-[13px] font-semibold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Save Draft
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-2 px-8 py-2.5 bg-primary hover:bg-primary-dark text-white text-[13px] font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-primary/25 active:scale-[0.99] cursor-pointer"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-8 py-2.5 bg-primary hover:bg-primary-dark text-white text-[13px] font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-primary/25 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Create Shipment
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Right Column — Route Estimation Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                {/* Map placeholder */}
                <div className="h-32 bg-gradient-to-br from-navy to-navy-light relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center w-full px-6">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg z-10">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 h-[3px] bg-primary/80 relative">
                        <div
                          className="absolute inset-0 bg-white/30"
                          style={{
                            animation: 'shimmer 2s infinite',
                            backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                            backgroundSize: '200% 100%'
                          }}
                        />
                      </div>
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg z-10">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-[15px] font-bold text-text-primary mb-4">Route Estimation</h3>

                  <div className="space-y-3">
                    {/* Origin */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <div className="w-3 h-3 rounded-full bg-navy-lighter border-2 border-navy" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px]">Origin</p>
                        <p className="text-[13px] font-medium text-text-primary mt-0.5">
                          {form.sender_city || 'Pending Input'}
                        </p>
                      </div>
                    </div>

                    {/* Connector */}
                    <div className="ml-[5px] w-px h-4 bg-border" />

                    {/* Destination */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <div className="w-3 h-3 rounded-full bg-primary/20 border-2 border-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-[1px]">Destination</p>
                        <p className="text-[13px] font-medium text-text-primary mt-0.5">
                          {form.receiver_city || 'Pending Input'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-text-secondary">Est. Distance</span>
                      <span className="text-[13px] font-bold text-text-primary">-- km</span>
                    </div>
                  </div>

                  {/* Summary on step 2+ */}
                  {step >= 2 && form.weight && (
                    <div className="mt-3 pt-3 border-t border-border animate-fade-in">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] text-text-secondary">Package</span>
                        <span className="text-[13px] font-bold text-text-primary capitalize">{form.package_type}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-text-secondary">Weight</span>
                        <span className="text-[13px] font-bold text-text-primary">{form.weight} kg</span>
                      </div>
                    </div>
                  )}

                  {step >= 3 && form.total_amount && (
                    <div className="mt-3 pt-3 border-t border-border animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-text-secondary font-semibold">Total Amount</span>
                        <span className="text-[15px] font-extrabold text-primary">₹{form.total_amount}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Reusable form field component
function FormField({ label, required, children }) {
  return (
    <div>
      <label className="block text-[12px] font-bold text-text-secondary mb-1.5">
        {label}
        {required && <span className="text-primary ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// Collapsible section with checkbox toggle
function CollapsibleSection({ label, description, icon: Icon, isOpen, onToggle, children }) {
  return (
    <div className={`bg-surface border rounded-2xl overflow-hidden transition-colors ${isOpen ? 'border-primary/30' : 'border-border'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-5 flex items-center gap-3 hover:bg-surface-hover transition-colors cursor-pointer"
      >
        <input
          type="checkbox"
          checked={isOpen}
          readOnly
          className="w-4 h-4 rounded border-border accent-primary flex-shrink-0 cursor-pointer"
        />
        {Icon && <Icon className={`w-5 h-5 flex-shrink-0 ${isOpen ? 'text-primary' : 'text-text-tertiary'}`} />}
        <div className="text-left flex-1 min-w-0">
          <h2 className={`text-[14px] font-bold ${isOpen ? 'text-primary' : 'text-text-primary'}`}>{label}</h2>
          {description && <p className="text-[11px] text-text-tertiary mt-0.5">{description}</p>}
        </div>
        <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t border-border animate-fade-in">
          <div className="pt-4 space-y-4">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
