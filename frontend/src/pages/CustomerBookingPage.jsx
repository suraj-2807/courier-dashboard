import { useState, useEffect } from 'react'
import {
  User,
  MapPin,
  Package,
  Check,
  Loader2,
  Copy,
  CheckCircle2,
  ChevronDown,
  Plus,
  Trash2,
  Receipt
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const INITIAL_FORM = {
  // Sender
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

  // Receiver
  receiver_name: '',
  receiver_company: '',
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

  // Package
  package_type: 'parcel',
  weight: '',
  length: '',
  breadth: '',
  height: '',
  no_of_pieces: '1',
  volumetric_weight: '',
  chargeable_weight: '',
  actual_weight: '',
  content_description: '',
  declared_value: '',
  is_fragile: false,

  // Invoice / Export
  invoice_type: 'INVOICE',
  invoice_currency: 'INR',
  terms_of_trade: 'CIF',
  invoice_note: '',
  hs_code: '',
  export_reason: '',

  // Payment & Other
  payment_mode: 'prepaid',
  shipping_charge: '',
  order_reference: '',
  remarks: ''
}

export default function CustomerBookingPage() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submittedAwb, setSubmittedAwb] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showShipmentInvoice, setShowShipmentInvoice] = useState(true)

  // Invoice items state
  const [invoiceItems, setInvoiceItems] = useState([
    { sr_no: 1, box_no: '1', description: '', hs_code: '', unit_type: 'PCS', quantity: '', unit_weight: '', cost: '', unit_rates: '', amount: '' }
  ])

  const addInvoiceItem = () => {
    setInvoiceItems(prev => [
      ...prev,
      { sr_no: prev.length + 1, box_no: '1', description: '', hs_code: '', unit_type: 'PCS', quantity: '', unit_weight: '', cost: '', unit_rates: '', amount: '' }
    ])
  }

  const removeInvoiceItem = (index) => {
    if (invoiceItems.length <= 1) return
    setInvoiceItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, sr_no: i + 1 })))
  }

  const updateInvoiceItem = (index, field, value) => {
    setInvoiceItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      // Auto-calculate amount = quantity * unit_rates
      if (field === 'quantity' || field === 'unit_rates') {
        const qty = parseFloat(field === 'quantity' ? value : updated[index].quantity) || 0
        const rate = parseFloat(field === 'unit_rates' ? value : updated[index].unit_rates) || 0
        updated[index].amount = (qty * rate).toFixed(2)
      }
      return updated
    })
  }

  const invoiceTotalWeight = invoiceItems.reduce((sum, item) => sum + (parseFloat(item.unit_weight) || 0) * (parseFloat(item.quantity) || 0), 0)
  const invoiceTotalAmount = invoiceItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)

  // Pre-fill from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const custName = params.get('cust_name') || ''
    const custPhone = params.get('cust_phone') || ''
    const custEmail = params.get('cust_email') || ''
    const custCompany = params.get('cust_company') || ''

    setForm(prev => ({
      ...prev,
      sender_name: custName || prev.sender_name,
      sender_phone: custPhone || prev.sender_phone,
      sender_email: custEmail || prev.sender_email,
      sender_company: custCompany || prev.sender_company
    }))
  }, [])

  // Auto-calculate Volumetric Weight & Chargeable Weight
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
      chargeable_weight: chg > 0 ? String(chg) : '',
      actual_weight: act > 0 ? String(act) : ''
    }))
  }, [form.length, form.breadth, form.height, form.weight, form.no_of_pieces])

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()

    if (!form.sender_name && !form.sender_company) {
      toast.error('Sender Name is required')
      return
    }
    if (!form.sender_phone) {
      toast.error('Sender Phone is required')
      return
    }
    if (!form.receiver_name && !form.receiver_company) {
      toast.error('Receiver Name is required')
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
      toast.error('Please enter the package weight')
      return
    }

    setSubmitting(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const apiPayload = {
        customer_id: params.get('cust_id') ? parseInt(params.get('cust_id')) : null,
        customer_name: params.get('cust_name') || form.sender_name,
        customer_email: params.get('cust_email') || form.sender_email,
        customer_phone: params.get('cust_phone') || form.sender_phone,
        customer_company: params.get('cust_company') || form.sender_company,
        sender_name: form.sender_name || form.sender_company,
        sender_company: form.sender_company,
        sender_email: form.sender_email,
        sender_phone: form.sender_phone,
        sender_address: form.sender_address,
        sender_address_2: form.sender_address_2,
        sender_city: form.sender_city,
        sender_pincode: form.sender_pincode,
        sender_state: form.sender_state,
        sender_country: form.sender_country || 'INDIA',
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

        package_type: form.package_type,
        weight: parseFloat(form.weight) || 0,
        chargeable_weight: parseFloat(form.chargeable_weight) || 0,
        length: parseFloat(form.length) || 0,
        breadth: parseFloat(form.breadth) || 0,
        height: parseFloat(form.height) || 0,
        no_of_pieces: parseInt(form.no_of_pieces) || 1,
        content_description: form.content_description,
        declared_value: parseFloat(form.declared_value) || 0,
        is_fragile: form.is_fragile,
        remarks: form.remarks,
        order_reference: form.order_reference,
        payment_mode: form.payment_mode,
        shipping_charge: parseFloat(form.shipping_charge) || 0,

        // Invoice & export
        invoice_type: form.invoice_type || 'INVOICE',
        invoice_currency: form.invoice_currency,
        hs_code: form.hs_code,
        export_reason: form.export_reason,
        terms_of_trade: form.terms_of_trade,
        invoice_note: form.invoice_note || '',
        invoice_items: invoiceItems.filter(item => item.description)
      }

      const res = await fetch('/api/customer/booking-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit booking request')
      }

      setSubmittedAwb(data.request_awb)
      toast.success('Booking request submitted successfully!')
      try {
        window.parent.postMessage({ type: 'PE_BOOKING_SUCCESS', awb: data.request_awb }, '*')
      } catch (e) {}
    } catch (err) {
      toast.error(err?.message || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyAwb = () => {
    if (submittedAwb) {
      navigator.clipboard.writeText(submittedAwb).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  const handleBackToDashboard = () => {
    try {
      window.parent.postMessage({ type: 'PE_GO_BACK' }, '*')
    } catch (e) {}
  }

  if (submittedAwb) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] p-4 flex items-center justify-center animate-fade-in font-sans">
        <Toaster position="top-center" />
        <div className="bg-white border border-[#dce1e7] rounded-2xl p-6 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>

          <h2 className="text-xl font-extrabold text-[#BB0013] mb-1">
            Request Submitted!
          </h2>
          <p className="text-xs text-gray-500 mb-6">
            Your booking request has been submitted successfully.
          </p>

          <div className="bg-[#f8f9fa] border border-[#dce1e7] rounded-xl p-4 mb-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
              Request AWB Number
            </span>
            <div className="flex items-center justify-center gap-2">
              <code className="text-lg font-mono font-bold text-[#BB0013]">
                {submittedAwb}
              </code>
              <button
                type="button"
                onClick={handleCopyAwb}
                className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setSubmittedAwb(null)
                setForm(INITIAL_FORM)
                setInvoiceItems([{ sr_no: 1, box_no: '1', description: '', hs_code: '', unit_type: 'PCS', quantity: '', unit_weight: '', cost: '', unit_rates: '', amount: '' }])
              }}
              className="w-full py-2.5 bg-[#BB0013] hover:bg-[#990010] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Submit Another Request
            </button>
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="w-full py-2 text-xs text-gray-600 font-semibold cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-3 text-[#1a202c] animate-fade-in font-sans">
      <Toaster position="top-center" />

      {/* ── Top Header ── */}
      <div className="bg-white rounded-lg border border-[#dce1e7] p-3 mb-3 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-base font-extrabold text-[#BB0013]">New Booking Request</h1>
          <p className="text-xs text-gray-500">Fill in details on a single page to submit your courier request</p>
        </div>
        <span className="bg-[#BB0013] text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase">
          Single Page Form
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Main 2 Columns: Shipper & Consignee ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">

          {/* ── Column 1: Shipper Details ── */}
          <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-xs">
            <RedBadge title="Shipper Details" icon={User} />

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
                    className="w-full bg-transparent focus:outline-none text-xs font-bold uppercase text-[#BB0013]"
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

          {/* ── Column 2: Consignee Details ── */}
          <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-xs">
            <RedBadge title="Consignee Details" icon={MapPin} />

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
                  placeholder="Street / Building / House No."
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
                    className="w-full bg-transparent focus:outline-none text-xs font-bold uppercase text-[#BB0013] placeholder-red-300"
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

        {/* ── Package & Weight Specifications ── */}
        <div className="bg-white rounded-lg border border-[#dce1e7] p-3 mb-3 shadow-xs">
          <RedBadge title="Package & Weight Specifications" icon={Package} />

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

          {/* Weights and Dimensions Table */}
          <div className="border border-[#1a237e] rounded-md overflow-hidden">
            {/* Section Header */}
            <div className="bg-[#1a237e] text-white px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider">
              Weights and Dimensions
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-4 border-b border-[#c5cae9]">
              <div className="px-3 py-2.5 border-r border-[#c5cae9]">
                <span className="text-[10px] font-extrabold uppercase text-[#37474f] block mb-1 tracking-tight">PCS</span>
                <input
                  type="number"
                  min="1"
                  value={form.no_of_pieces}
                  onChange={e => updateForm('no_of_pieces', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-bold"
                />
              </div>
              <div className="px-3 py-2.5 border-r border-[#c5cae9]">
                <span className="text-[10px] font-extrabold uppercase text-[#37474f] block mb-1 tracking-tight">Actual Weight</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.weight}
                  onChange={e => updateForm('weight', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-bold"
                />
              </div>
              <div className="px-3 py-2.5 border-r border-[#c5cae9] bg-[#1a237e]">
                <span className="text-[10px] font-extrabold uppercase text-white block mb-1 tracking-tight">Volumetric Weight</span>
                <input
                  type="text"
                  readOnly
                  value={form.volumetric_weight || '0.00'}
                  className="w-full bg-transparent focus:outline-none text-[13px] text-white font-extrabold"
                />
              </div>
              <div className="px-3 py-2.5">
                <span className="text-[10px] font-extrabold uppercase text-[#37474f] block mb-1 tracking-tight">Chargeable Weight</span>
                <input
                  type="text"
                  readOnly
                  value={form.chargeable_weight || '0.00'}
                  className="w-full bg-transparent focus:outline-none text-[13px] text-[#BB0013] font-extrabold"
                />
              </div>
            </div>

            {/* Per-Parcel Table Header */}
            <div className="grid grid-cols-[1fr_1fr_1.2fr_1fr_1fr_1fr_1.2fr_1.2fr] bg-[#e8eaf6] text-[10px] font-extrabold uppercase text-[#1a237e] tracking-tight border-b border-[#c5cae9]">
              <div className="px-2 py-2 text-center border-r border-[#c5cae9]">Parcel No.</div>
              <div className="px-2 py-2 text-center border-r border-[#c5cae9]">Box No.</div>
              <div className="px-2 py-2 text-center border-r border-[#c5cae9]">Actual Wt(Kg.)</div>
              <div className="px-2 py-2 text-center border-r border-[#c5cae9]">L(CM)</div>
              <div className="px-2 py-2 text-center border-r border-[#c5cae9]">B(CM)</div>
              <div className="px-2 py-2 text-center border-r border-[#c5cae9]">H(CM)</div>
              <div className="px-2 py-2 text-center border-r border-[#c5cae9]">Volumetric Wt(Kg.)</div>
              <div className="px-2 py-2 text-center">Chargeable Wt(Kg.)</div>
            </div>

            {/* Per-Parcel Data Row */}
            <div className="grid grid-cols-[1fr_1fr_1.2fr_1fr_1fr_1fr_1.2fr_1.2fr] text-[13px] items-center hover:bg-blue-50/30 transition-colors">
              <div className="px-2 py-2 text-center text-xs font-bold text-gray-400 border-r border-[#dce1e7]">1</div>
              <div className="px-1 py-1 border-r border-[#dce1e7]">
                <input type="text" value="1" readOnly className="w-full bg-transparent focus:outline-none text-xs text-center font-bold text-gray-600" />
              </div>
              <div className="px-1 py-1 border-r border-[#dce1e7]">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.weight}
                  onChange={e => updateForm('weight', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs text-center font-bold"
                />
              </div>
              <div className="px-1 py-1 border-r border-[#dce1e7]">
                <input
                  type="number"
                  placeholder="L"
                  value={form.length}
                  onChange={e => updateForm('length', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs text-center"
                />
              </div>
              <div className="px-1 py-1 border-r border-[#dce1e7]">
                <input
                  type="number"
                  placeholder="B"
                  value={form.breadth}
                  onChange={e => updateForm('breadth', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs text-center"
                />
              </div>
              <div className="px-1 py-1 border-r border-[#dce1e7]">
                <input
                  type="number"
                  placeholder="H"
                  value={form.height}
                  onChange={e => updateForm('height', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs text-center"
                />
              </div>
              <div className="px-1 py-1 border-r border-[#dce1e7]">
                <input
                  type="text"
                  readOnly
                  value={form.volumetric_weight || '0.00'}
                  className="w-full bg-transparent focus:outline-none text-xs text-center font-bold text-[#1a237e]"
                />
              </div>
              <div className="px-1 py-1">
                <input
                  type="text"
                  readOnly
                  value={form.chargeable_weight || '0.00'}
                  className="w-full bg-transparent focus:outline-none text-xs text-center font-extrabold text-[#BB0013]"
                />
              </div>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 mt-1.5 italic">
            * Volumetric weight = (L×B×H / 5000) × PCS. Chargeable weight = max(Actual, Volumetric).
          </p>
        </div>

        {/* ── Create Shipment Invoice Section ── */}
        <div className="bg-white rounded-lg border border-[#dce1e7] p-3 mb-3 shadow-xs">
          <button
            type="button"
            onClick={() => setShowShipmentInvoice(!showShipmentInvoice)}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <RedBadge title="Create Shipment Invoice" icon={Receipt} />
            <ChevronDown className={`w-4 h-4 text-[#BB0013] transition-transform duration-200 ${showShipmentInvoice ? 'rotate-180' : ''}`} />
          </button>

          {showShipmentInvoice && (
            <div className="mt-3 animate-slide-down">
              {/* Invoice Meta Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                <CompactField label="Invoice Type">
                  <select
                    value={form.invoice_type || 'INVOICE'}
                    onChange={e => updateForm('invoice_type', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="INVOICE">Invoice</option>
                    <option value="PROFORMA">Proforma Invoice</option>
                  </select>
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
                <CompactField label="Incoterms">
                  <select
                    value={form.terms_of_trade}
                    onChange={e => updateForm('terms_of_trade', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="CIF">CIF</option>
                    <option value="FOB">FOB</option>
                    <option value="DDP">DDP</option>
                    <option value="DDU">DDU</option>
                  </select>
                </CompactField>
                <CompactField label="Note / Export Reason">
                  <input
                    type="text"
                    placeholder="e.g. Gift, Commercial, Personal Use"
                    value={form.invoice_note || ''}
                    onChange={e => updateForm('invoice_note', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </CompactField>
              </div>

              {/* Invoice Items Table */}
              <div className="border border-[#1a237e] rounded-md overflow-hidden">
                {/* Table Header */}
                <div className="bg-[#1a237e] text-white grid grid-cols-[40px_45px_1fr_95px_70px_65px_80px_70px_80px_85px_45px] text-[11px] font-extrabold uppercase tracking-tight">
                  <div className="px-1.5 py-2.5 text-center">SR</div>
                  <div className="px-1.5 py-2.5 text-center">Box</div>
                  <div className="px-1.5 py-2.5">Description</div>
                  <div className="px-1.5 py-2.5 text-center">HS Code</div>
                  <div className="px-1.5 py-2.5 text-center">Unit</div>
                  <div className="px-1.5 py-2.5 text-center">Qty</div>
                  <div className="px-1.5 py-2.5 text-right">Unit Wt</div>
                  <div className="px-1.5 py-2.5 text-right">Cost</div>
                  <div className="px-1.5 py-2.5 text-right">Rate</div>
                  <div className="px-1.5 py-2.5 text-right">Amount</div>
                  <div className="px-1.5 py-2.5 text-center">×</div>
                </div>

                {/* Item Rows */}
                {invoiceItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[40px_45px_1fr_95px_70px_65px_80px_70px_80px_85px_45px] border-t border-[#dce1e7] text-[13px] items-center hover:bg-red-50/30 transition-colors py-1">
                    <div className="px-1.5 py-1 text-center text-xs font-bold text-gray-500">{item.sr_no}</div>
                    <div className="px-1">
                      <input type="text" value={item.box_no} onChange={e => updateInvoiceItem(idx, 'box_no', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-center font-bold" />
                    </div>
                    <div className="px-1">
                      <input type="text" placeholder="Item description" value={item.description} onChange={e => updateInvoiceItem(idx, 'description', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800" />
                    </div>
                    <div className="px-1">
                      <input type="text" placeholder="840590" value={item.hs_code} onChange={e => updateInvoiceItem(idx, 'hs_code', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-mono text-center" />
                    </div>
                    <div className="px-1">
                      <select value={item.unit_type} onChange={e => updateInvoiceItem(idx, 'unit_type', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-semibold cursor-pointer">
                        <option value="PCS">PCS</option>
                        <option value="KGS">KGS</option>
                        <option value="MTR">MTR</option>
                        <option value="SET">SET</option>
                        <option value="BOX">BOX</option>
                        <option value="PAIR">PAIR</option>
                      </select>
                    </div>
                    <div className="px-1">
                      <input type="number" placeholder="0" value={item.quantity} onChange={e => updateInvoiceItem(idx, 'quantity', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-center font-bold" />
                    </div>
                    <div className="px-1">
                      <input type="number" step="0.01" placeholder="0.00" value={item.unit_weight} onChange={e => updateInvoiceItem(idx, 'unit_weight', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-right" />
                    </div>
                    <div className="px-1">
                      <input type="number" step="0.01" placeholder="0.00" value={item.cost} onChange={e => updateInvoiceItem(idx, 'cost', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-right" />
                    </div>
                    <div className="px-1">
                      <input type="number" step="0.01" placeholder="0.00" value={item.unit_rates} onChange={e => updateInvoiceItem(idx, 'unit_rates', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-right" />
                    </div>
                    <div className="px-1">
                      <input type="number" step="0.01" readOnly value={item.amount}
                        className="w-full bg-transparent focus:outline-none text-xs text-right font-extrabold text-[#BB0013]" />
                    </div>
                    <div className="px-1 text-center">
                      <button type="button" onClick={() => removeInvoiceItem(idx)}
                        className="text-red-400 hover:text-red-600 transition-colors cursor-pointer p-1" title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Totals Row */}
                <div className="grid grid-cols-[40px_45px_1fr_95px_70px_65px_80px_70px_80px_85px_45px] border-t-2 border-[#1a237e] bg-[#f5f5ff] text-[11px] font-extrabold items-center py-1.5">
                  <div className="col-span-5"></div>
                  <div className="px-1.5 py-2 text-right text-[#1a237e] uppercase">Total</div>
                  <div className="px-1.5 py-2 text-right text-[#1a237e]">{invoiceTotalWeight.toFixed(2)}</div>
                  <div className="col-span-2 px-1.5 py-2 text-right text-[#1a237e] uppercase">Total Amount</div>
                  <div className="px-1.5 py-2 text-right text-[#BB0013] text-xs">{invoiceTotalAmount.toFixed(2)}</div>
                  <div></div>
                </div>
              </div>

              {/* Add Item Button */}
              <button
                type="button"
                onClick={addInvoiceItem}
                className="mt-2.5 flex items-center gap-1.5 px-4 py-2 rounded bg-[#e8eaf6] text-[#1a237e] text-xs font-extrabold hover:bg-[#c5cae9] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                ADD ITEM
              </button>
            </div>
          )}
        </div>

        {/* ── Footer Action Bar ── */}
        <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-sm flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="px-4 py-1.5 rounded border border-[#cfd8dc] bg-[#f8f9fa] text-xs font-bold text-[#455a64] hover:bg-[#eceff1] cursor-pointer"
          >
            Back to Dashboard
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setForm(INITIAL_FORM); setInvoiceItems([{ sr_no: 1, box_no: '1', description: '', hs_code: '', unit_type: 'PCS', quantity: '', unit_weight: '', cost: '', unit_rates: '', amount: '' }]) }}
              className="px-4 py-1.5 rounded border border-[#cfd8dc] bg-white text-xs font-bold text-[#455a64] hover:bg-[#f8f9fa] cursor-pointer"
            >
              Reset Form
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-[#BB0013] hover:bg-[#990010] text-white text-xs font-extrabold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting Request...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Submit Booking Request
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

function RedBadge({ title, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="bg-[#BB0013] text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs flex items-center gap-1.5">
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
          : 'border-[#cfd8dc] focus-within:border-[#BB0013] focus-within:ring-1 focus-within:ring-[#BB0013]'
      } rounded bg-white px-2.5 py-1.5 transition-all ${className}`}
    >
      <label className="absolute -top-2.5 left-2 px-1 bg-white text-[9px] font-extrabold text-[#455a64] uppercase tracking-tighter whitespace-nowrap z-10">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <div className="pt-0.5">{children}</div>
    </div>
  )
}
