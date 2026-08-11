import { useState, useEffect } from 'react'
import {
  User,
  MapPin,
  Package,
  Check,
  Loader2,
  Copy,
  CheckCircle2,
  ChevronDown
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
  content_description: '',
  declared_value: '',
  is_fragile: false,
  remarks: ''
}

export default function CustomerBookingPage() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submittedAwb, setSubmittedAwb] = useState(null)
  const [copied, setCopied] = useState(false)

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

  // Auto-calculate Volumetric Weight
  useEffect(() => {
    const l = parseFloat(form.length) || 0
    const b = parseFloat(form.breadth) || 0
    const h = parseFloat(form.height) || 0
    const pcs = parseInt(form.no_of_pieces) || 1

    let vol = 0
    if (l > 0 && b > 0 && h > 0) {
      vol = Math.round(((l * b * h) / 5000) * pcs * 100) / 100
    }
    setForm(prev => ({
      ...prev,
      volumetric_weight: vol > 0 ? String(vol) : ''
    }))
  }, [form.length, form.breadth, form.height, form.no_of_pieces])

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
        length: parseFloat(form.length) || 0,
        breadth: parseFloat(form.breadth) || 0,
        height: parseFloat(form.height) || 0,
        no_of_pieces: parseInt(form.no_of_pieces) || 1,
        content_description: form.content_description,
        declared_value: parseFloat(form.declared_value) || 0,
        is_fragile: form.is_fragile,
        remarks: form.remarks
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
              }}
              className="w-full py-2.5 bg-[#BB0013] hover:bg-[#990010] text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Submit Another Request
            </button>
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="w-full py-2 text-xs text-gray-600 font-semibold"
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
        {/* ── Main 3 Columns ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">

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
                  placeholder="Street / House No."
                  value={form.sender_address}
                  onChange={e => updateForm('sender_address', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs"
                />
              </CompactField>

              <CompactField label="Address Line 2">
                <input
                  type="text"
                  placeholder="Apt / Suite / Area"
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
                    <option value="Aadhaar Number">Aadhaar</option>
                    <option value="Pan Number">PAN</option>
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

          {/* ── Column 3: Package Specs ── */}
          <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-xs">
            <RedBadge title="Package & Specs" icon={Package} />

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
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
              </div>

              <CompactField label="Actual Weight (kg)" required highlight={!form.weight}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.weight}
                  onChange={e => updateForm('weight', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs font-extrabold text-right text-[#BB0013]"
                />
              </CompactField>

              <div className="grid grid-cols-3 gap-2">
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
              </div>

              <CompactField label="Volumetric Weight (kg)">
                <input
                  type="text"
                  readOnly
                  value={form.volumetric_weight || '0.00'}
                  className="w-full bg-transparent focus:outline-none text-xs font-mono font-bold text-right text-gray-500"
                />
              </CompactField>

              <CompactField label="Declared Value (₹)">
                <input
                  type="number"
                  placeholder="0"
                  value={form.declared_value}
                  onChange={e => updateForm('declared_value', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs font-semibold"
                />
              </CompactField>

              <CompactField label="Content Description">
                <input
                  type="text"
                  placeholder="General Goods / Items inside"
                  value={form.content_description}
                  onChange={e => updateForm('content_description', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs"
                />
              </CompactField>

              <CompactField label="Special Instructions / Remarks">
                <input
                  type="text"
                  placeholder="Remarks"
                  value={form.remarks}
                  onChange={e => updateForm('remarks', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-xs"
                />
              </CompactField>
            </div>
          </div>

        </div>

        {/* ── Footer Action Bar ── */}
        <div className="bg-white rounded-lg border border-[#dce1e7] p-3 shadow-sm flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="px-4 py-1.5 rounded border border-[#cfd8dc] bg-[#f8f9fa] text-xs font-bold text-[#455a64] hover:bg-[#eceff1]"
          >
            Back to Dashboard
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-full bg-[#BB0013] hover:bg-[#990010] text-white text-xs font-extrabold shadow-md transition-all flex items-center gap-2"
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
      </form>
    </div>
  )
}

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
