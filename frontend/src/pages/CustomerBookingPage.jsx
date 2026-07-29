import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  User,
  MapPin,
  Package,
  Check,
  Loader2,
  Copy,
  CheckCircle2,
  Clock,
  ChevronDown
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const STEPS = [
  { id: 1, label: 'Sender & Receiver', icon: User },
  { id: 2, label: 'Package & Submit', icon: Package }
]

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
  content_description: '',
  declared_value: '',
  is_fragile: false,
  // Notes
  remarks: ''
}

export default function CustomerBookingPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submittedAwb, setSubmittedAwb] = useState(null)
  const [copied, setCopied] = useState(false)

  // Pre-fill from URL params (customer portal passes these)
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
      sender_company: custCompany || prev.sender_company,
    }))
  }, [])

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const nextStep = () => {
    // Step 1 validation
    if (step === 1) {
      if (!form.sender_name.trim()) {
        toast.error('Sender name is required')
        return
      }
      if (!form.sender_phone.trim()) {
        toast.error('Sender phone is required')
        return
      }
      if (!form.receiver_name.trim()) {
        toast.error('Receiver name is required')
        return
      }
      if (!form.receiver_phone.trim()) {
        toast.error('Receiver phone is required')
        return
      }
    }
    if (step < 2) setStep(step + 1)
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async () => {
    if (!form.weight || parseFloat(form.weight) <= 0) {
      toast.error('Please enter the package weight')
      return
    }

    setSubmitting(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const apiPayload = {
        customer_name: params.get('cust_name') || form.sender_name,
        customer_email: params.get('cust_email') || form.sender_email,
        customer_phone: params.get('cust_phone') || form.sender_phone,
        customer_company: params.get('cust_company') || form.sender_company,
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
      toast.success('Booking request submitted!')
    } catch (err) {
      toast.error(err?.message || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBackToDashboard = () => {
    try {
      window.parent.postMessage({ type: 'PE_GO_BACK' }, '*')
    } catch (e) {}
  }

  const handleCopyAwb = () => {
    if (submittedAwb) {
      navigator.clipboard.writeText(submittedAwb).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  // ═══════════════════════════════════════════
  //  SUCCESS SCREEN
  // ═══════════════════════════════════════════

  if (submittedAwb) {
    return (
      <div className="min-h-screen bg-surface-alt w-full flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <div className="bg-surface border border-border rounded-3xl p-8 max-w-[520px] w-full text-center animate-fade-in">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>

          <h1 className="text-[24px] font-extrabold text-text-primary mb-2">
            Booking Request Submitted!
          </h1>
          <p className="text-[14px] text-text-secondary mb-8 leading-relaxed">
            Your shipment booking request has been received and is being reviewed by our team. 
            You'll be notified once it's confirmed.
          </p>

          {/* AWB Number Card */}
          <div className="bg-surface-alt border border-border rounded-2xl p-6 mb-6">
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-[2px] mb-2">
              Your AWB / Request Number
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-[36px] font-black text-text-primary tracking-[4px] font-mono">
                {submittedAwb}
              </span>
              <button
                onClick={handleCopyAwb}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                title="Copy AWB"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-success" />
                ) : (
                  <Copy className="w-5 h-5 text-text-tertiary" />
                )}
              </button>
            </div>
            <p className="text-[12px] text-text-tertiary mt-2">
              Save this number for tracking your shipment
            </p>
          </div>

          {/* Status Timeline */}
          <div className="bg-surface-alt border border-border rounded-2xl p-5 mb-8 text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-text-primary">Pending Admin Review</p>
                <p className="text-[11px] text-text-tertiary">Our team will process your request shortly</p>
              </div>
            </div>
            <div className="ml-4 border-l-2 border-border pl-6 space-y-3">
              <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
                <div className="w-2 h-2 rounded-full bg-border flex-shrink-0" />
                Admin fills shipping & export details
              </div>
              <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
                <div className="w-2 h-2 rounded-full bg-border flex-shrink-0" />
                Courier vendor selected & shipment created
              </div>
              <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
                <div className="w-2 h-2 rounded-full bg-border flex-shrink-0" />
                You'll receive tracking updates
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSubmittedAwb(null)
                setForm(INITIAL_FORM)
                setStep(1)
                // re-fill customer info from URL
                const params = new URLSearchParams(window.location.search)
                setForm(prev => ({
                  ...prev,
                  sender_name: params.get('cust_name') || '',
                  sender_phone: params.get('cust_phone') || '',
                  sender_email: params.get('cust_email') || '',
                  sender_company: params.get('cust_company') || '',
                }))
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-[13px] font-semibold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Package className="w-4 h-4" />
              New Request
            </button>
            <button
              onClick={() => {
                try {
                  window.parent.postMessage({ type: 'PE_BOOKING_SUCCESS' }, '*')
                } catch (e) {}
                handleBackToDashboard()
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white text-[13px] font-bold rounded-xl transition-all cursor-pointer"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  //  BOOKING REQUEST FORM (Simplified)
  // ═══════════════════════════════════════════

  return (
    <div className="min-h-screen bg-surface-alt w-full">
      <Toaster position="top-right" />

      {/* Top Bar */}
      <div className="bg-surface border-b border-border sticky top-0 z-30">
        <div className="w-full px-4 lg:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              BACK TO DASHBOARD
            </button>
            <div className="w-px h-5 bg-border" />
            <h1 className="text-[16px] font-extrabold text-text-primary">Request Shipment Booking</h1>
          </div>
          <button className="p-2 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer">
            <HelpCircle className="w-[18px] h-[18px] text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 lg:px-6 py-6">
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

            {/* Info Banner */}
            <div className="bg-primary/5 border border-primary/15 rounded-2xl px-5 py-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <HelpCircle className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-text-primary">Simplified Booking Request</p>
                <p className="text-[12px] text-text-secondary mt-0.5">
                  Fill in your sender, receiver, and package details. Our team will handle shipping charges, courier selection, 
                  export documentation, and all other details. You'll receive your AWB number instantly after submitting.
                </p>
              </div>
            </div>

            {/* ─── Step 1: Sender & Receiver ─── */}
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

            {/* ─── Step 2: Package & Submit ─── */}
            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                {/* Package Details */}
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

                {/* Special Instructions */}
                <div className="bg-surface border border-border rounded-2xl">
                  <div className="p-5 border-b border-border">
                    <h2 className="text-[16px] font-bold text-text-primary">Special Instructions</h2>
                    <p className="text-[12px] text-text-tertiary mt-0.5">Any notes for our shipping team (optional)</p>
                  </div>
                  <div className="p-5">
                    <textarea
                      rows={3}
                      placeholder="Any special handling or delivery instructions..."
                      value={form.remarks}
                      onChange={e => updateForm('remarks', e.target.value)}
                      className="form-input resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-center gap-3 py-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex items-center gap-2 px-6 py-2.5 border border-border rounded-xl text-[13px] font-semibold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              {step < 2 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center gap-2 px-8 py-2.5 bg-primary hover:bg-primary-dark text-white text-[13px] font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-primary/25 active:scale-[0.99] cursor-pointer"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-8 py-2.5 bg-primary hover:bg-primary-dark text-white text-[13px] font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-primary/25 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Request Booking
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

                  {/* Summary on step 2 */}
                  {step >= 2 && form.weight && (
                    <div className="mt-3 pt-3 border-t border-border animate-fade-in">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] text-text-secondary">Package</span>
                        <span className="text-[13px] font-bold text-text-primary capitalize">{form.package_type}</span>
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className="text-[12px] text-text-secondary">Weight</span>
                        <span className="text-[13px] font-bold text-text-primary">{form.weight} kg</span>
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
