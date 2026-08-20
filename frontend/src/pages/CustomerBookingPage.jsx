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
import { useQuery } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import { countryCodesApi } from '../api/countryCodes.api'
import CountryAutocompleteInput from '../components/CountryAutocompleteInput'

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

  // Fetch country codes list
  const { data: countryCodesData } = useQuery({
    queryKey: ['country-codes-customer'],
    queryFn: () => countryCodesApi.getAll().then(res => res.data)
  })
  const countryList = countryCodesData?.countryCodes || []

  // Parcels detail state synced with no_of_pieces
  const [parcels, setParcels] = useState([
    { parcel_no: 1, box_no: '1', weight: '', length: '', breadth: '', height: '', volumetric_weight: '', chargeable_weight: '' }
  ])

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
      let val = value
      if (typeof val === 'string' && !['quantity', 'unit_weight', 'cost', 'unit_rates', 'amount'].includes(field)) {
        val = val.toUpperCase()
      }
      updated[index] = { ...updated[index], [field]: val }
      // Auto-calculate amount = quantity * unit_rates (or cost)
      if (field === 'quantity' || field === 'unit_rates' || field === 'cost') {
        const qty = parseFloat(field === 'quantity' ? value : updated[index].quantity) || 1
        const rate = parseFloat(field === 'unit_rates' ? value : (field === 'cost' ? value : (updated[index].unit_rates || updated[index].cost || 0))) || 0
        if (rate > 0) {
          updated[index].amount = (qty * rate).toFixed(2)
          if (!updated[index].unit_rates && updated[index].cost) {
            updated[index].unit_rates = updated[index].cost
          }
        } else {
          updated[index].amount = '0.00'
        }
      } else if (field === 'amount') {
        const qty = parseFloat(updated[index].quantity) || 1
        const amt = parseFloat(value) || 0
        if (amt > 0 && qty > 0) {
          updated[index].unit_rates = (amt / qty).toFixed(2)
        } else {
          updated[index].unit_rates = '0.00'
        }
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

  // Auto-sync parcels count with no_of_pieces
  useEffect(() => {
    const count = Math.max(1, parseInt(form.no_of_pieces) || 1)
    setParcels(prev => {
      const next = [...prev]
      if (next.length > 0 && !next[0].weight && form.weight) {
        next[0] = {
          ...next[0],
          weight: form.weight,
          length: form.length || next[0].length || '',
          breadth: form.breadth || next[0].breadth || '',
          height: form.height || next[0].height || '',
          volumetric_weight: form.volumetric_weight || next[0].volumetric_weight || '',
          chargeable_weight: form.chargeable_weight || next[0].chargeable_weight || ''
        }
      }
      if (next.length < count) {
        for (let i = next.length; i < count; i++) {
          next.push({
            parcel_no: i + 1,
            box_no: String(i + 1),
            weight: '',
            length: '',
            breadth: '',
            height: '',
            volumetric_weight: '',
            chargeable_weight: ''
          })
        }
      } else if (next.length > count) {
        return next.slice(0, count)
      }
      return next
    })
  }, [form.no_of_pieces])

  const updateParcel = (index, field, value) => {
    setParcels(prev => {
      const updated = [...prev]
      const item = { ...updated[index], [field]: value }

      const l = parseFloat(field === 'length' ? value : item.length) || 0
      const b = parseFloat(field === 'breadth' ? value : item.breadth) || 0
      const h = parseFloat(field === 'height' ? value : item.height) || 0
      const act = parseFloat(field === 'weight' ? value : item.weight) || 0

      let vol = 0
      if (l > 0 && b > 0 && h > 0) {
        vol = Math.round(((l * b * h) / 5000) * 100) / 100
      }
      const chg = Math.max(act, vol)

      item.volumetric_weight = vol > 0 ? String(vol) : ''
      item.chargeable_weight = chg > 0 ? String(chg) : ''
      updated[index] = item
      return updated
    })
  }

  // Calculate totals from parcels array
  const totalParcelActual = parcels.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0)
  const totalParcelVol = parcels.reduce((sum, p) => sum + (parseFloat(p.volumetric_weight) || 0), 0)
  const totalParcelChg = parcels.reduce((sum, p) => sum + (parseFloat(p.chargeable_weight) || 0), 0)

  // Keep main form summary fields synced with per-parcel totals
  useEffect(() => {
    if (parcels.length > 1) {
      setForm(prev => ({
        ...prev,
        weight: totalParcelActual > 0 ? String(totalParcelActual) : prev.weight,
        volumetric_weight: totalParcelVol > 0 ? String(totalParcelVol) : '',
        chargeable_weight: totalParcelChg > 0 ? String(totalParcelChg) : '',
        shipping_charge: prev.shipping_charge || (totalParcelChg > 0 ? String(totalParcelChg) : '')
      }))
    } else {
      const l = parseFloat(form.length) || parseFloat(parcels[0]?.length) || 0
      const b = parseFloat(form.breadth) || parseFloat(parcels[0]?.breadth) || 0
      const h = parseFloat(form.height) || parseFloat(parcels[0]?.height) || 0
      const act = parseFloat(form.weight) || parseFloat(parcels[0]?.weight) || 0

      let vol = 0
      if (l > 0 && b > 0 && h > 0) {
        vol = Math.round(((l * b * h) / 5000) * 100) / 100
      }
      const chg = Math.max(act, vol)

      setForm(prev => ({
        ...prev,
        volumetric_weight: vol > 0 ? String(vol) : '',
        chargeable_weight: chg > 0 ? String(chg) : '',
        shipping_charge: prev.shipping_charge || (chg > 0 ? String(chg) : '')
      }))
    }
  }, [parcels, form.length, form.breadth, form.height, form.weight, form.no_of_pieces])

  const NO_AUTO_UPPERCASE_FIELDS = [
    'sender_email',
    'receiver_email',
    'package_type',
    'sender_gstin_type',
    'receiver_gstin_type',
    'invoice_currency',
    'invoice_type'
  ]

  const updateForm = (field, value) => {
    let val = value
    if (typeof val === 'string' && !NO_AUTO_UPPERCASE_FIELDS.includes(field) && !field.toLowerCase().includes('email')) {
      val = val.toUpperCase()
    }
    setForm(prev => ({ ...prev, [field]: val }))
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
    if (form.sender_gstin_type && /aadhaar|aadhar/i.test(form.sender_gstin_type)) {
      const cleanAadhaar = (form.sender_gstin_no || '').replace(/\D/g, '')
      if (cleanAadhaar.length !== 12) {
        toast.error('Aadhaar number must be exactly 12 digits')
        return
      }
    }
    if (form.receiver_gstin_type && /aadhaar|aadhar/i.test(form.receiver_gstin_type)) {
      const cleanAadhaar = (form.receiver_gstin_no || '').replace(/\D/g, '')
      if (cleanAadhaar.length !== 12) {
        toast.error('Receiver Aadhaar number must be exactly 12 digits')
        return
      }
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
        weight: (parcels.length > 1 && totalParcelActual > 0) ? totalParcelActual : (parseFloat(form.weight) || (parcels[0] ? parseFloat(parcels[0].weight) : 0) || 0),
        chargeable_weight: (parcels.length > 1 && totalParcelChg > 0) ? totalParcelChg : (parseFloat(form.chargeable_weight) || 0),
        length: parseFloat(form.length) || (parcels[0] ? parseFloat(parcels[0].length) : 0) || 0,
        breadth: parseFloat(form.breadth) || (parcels[0] ? parseFloat(parcels[0].breadth) : 0) || 0,
        height: parseFloat(form.height) || (parcels[0] ? parseFloat(parcels[0].height) : 0) || 0,
        no_of_pieces: Math.max(parcels.length, parseInt(form.no_of_pieces) || 1),
        content_description: (form.content_description && form.content_description !== 'General Goods' && form.content_description !== 'ITEMS / GOODS INSIDE')
          ? form.content_description
          : (invoiceItems.map(i => i.description).filter(Boolean).join(', ') || form.content_description || 'General Goods'),
        declared_value: parseFloat(form.declared_value) || 0,
        is_fragile: form.is_fragile,
        remarks: form.remarks,
        order_reference: form.order_reference,
        payment_mode: form.payment_mode,
        shipping_charge: parseFloat(form.shipping_charge) || 0,
        parcels: parcels.map((p, idx) => {
          const pWeight = (p.weight !== undefined && p.weight !== '') ? String(p.weight) : (parcels.length === 1 ? String(form.weight || '') : '')
          const pLength = (p.length !== undefined && p.length !== '') ? String(p.length) : (parcels.length === 1 ? String(form.length || '') : '')
          const pBreadth = (p.breadth !== undefined && p.breadth !== '') ? String(p.breadth) : (parcels.length === 1 ? String(form.breadth || '') : '')
          const pHeight = (p.height !== undefined && p.height !== '') ? String(p.height) : (parcels.length === 1 ? String(form.height || '') : '')

          const act = parseFloat(pWeight) || 0
          const l = parseFloat(pLength) || 0
          const b = parseFloat(pBreadth) || 0
          const h = parseFloat(pHeight) || 0
          const vol = (l > 0 && b > 0 && h > 0) ? Math.round(((l * b * h) / 5000) * 100) / 100 : 0
          const chg = Math.max(act, vol)

          return {
            parcel_no: idx + 1,
            box_no: p.box_no || String(idx + 1),
            weight: pWeight,
            length: pLength,
            breadth: pBreadth,
            width: pBreadth,
            height: pHeight,
            volumetric_weight: vol > 0 ? String(vol) : (p.volumetric_weight || ''),
            chargeable_weight: chg > 0 ? String(chg) : (p.chargeable_weight || '')
          }
        }),

        // Invoice & export
        invoice_type: form.invoice_type || 'INVOICE',
        invoice_currency: form.invoice_currency,
        hs_code: form.hs_code,
        export_reason: form.export_reason,
        terms_of_trade: form.terms_of_trade,
        invoice_note: form.invoice_note || '',
        invoice_items: invoiceItems.filter(item => item.description || parseFloat(item.quantity) > 0 || parseFloat(item.amount) > 0)
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
      <div className="min-h-screen bg-surface-alt p-4 flex items-center justify-center animate-fade-in font-sans">
        <Toaster position="top-center" />
        <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-success-bg rounded-2xl flex items-center justify-center mx-auto mb-4 border border-success/20">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>

          <h2 className="text-xl font-extrabold text-navy mb-1">
            Request Submitted!
          </h2>
          <p className="text-xs text-text-secondary mb-6">
            Your booking request has been submitted successfully.
          </p>

          <div className="bg-surface-alt border border-border rounded-xl p-4 mb-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block mb-1">
              Request AWB Number
            </span>
            <div className="flex items-center justify-center gap-2">
              <code className="text-lg font-mono font-bold text-primary">
                {submittedAwb}
              </code>
              <button
                type="button"
                onClick={handleCopyAwb}
                className="p-1.5 hover:bg-surface-hover rounded-lg text-text-secondary transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
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
              className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Submit Another Request
            </button>
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="w-full py-2 text-xs text-text-secondary hover:text-navy font-semibold transition-colors cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in w-full space-y-6 p-4 sm:p-6 pb-8">
      <Toaster position="top-center" />

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface p-5 rounded-2xl border border-border shadow-xs">
        <div>
          <h1 className="text-xl sm:text-[22px] font-extrabold text-navy tracking-tight">New Booking Request</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">Fill in details on a single page to submit your courier request</p>
        </div>
        <span className="bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          Single Page Form
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Main 2 Columns: Shipper & Consignee ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Column 1: Shipper Details ── */}
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs">
            <RedBadge title="Shipper Details" icon={User} />

            <div className="space-y-4">
              <CompactField label="Sender Full Name" required>
                <input
                  type="text"
                  placeholder="Sender Full Name"
                  value={form.sender_name}
                  onChange={e => updateForm('sender_name', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-[13px] text-navy font-semibold"
                />
              </CompactField>

              <CompactField label="Company Name">
                <input
                  type="text"
                  placeholder="Sender Company Name"
                  value={form.sender_company}
                  onChange={e => updateForm('sender_company', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-[13px] uppercase text-text-primary"
                />
              </CompactField>

              <CompactField label="Address Line 1" required>
                <input
                  type="text"
                  placeholder="Flat / Building / Street"
                  value={form.sender_address}
                  onChange={e => updateForm('sender_address', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                />
              </CompactField>

              <CompactField label="Address Line 2">
                <input
                  type="text"
                  placeholder="Area / Landmark"
                  value={form.sender_address_2}
                  onChange={e => updateForm('sender_address_2', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                />
              </CompactField>

              <div className="grid grid-cols-2 gap-3.5">
                <CompactField label="City" required>
                  <input
                    type="text"
                    placeholder="City"
                    value={form.sender_city}
                    onChange={e => updateForm('sender_city', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                  />
                </CompactField>
                <CompactField label="Pincode" required>
                  <input
                    type="text"
                    placeholder="Pincode"
                    value={form.sender_pincode}
                    onChange={e => updateForm('sender_pincode', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] font-mono text-text-primary"
                  />
                </CompactField>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <CompactField label="State">
                  <input
                    type="text"
                    placeholder="State"
                    value={form.sender_state}
                    onChange={e => updateForm('sender_state', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] uppercase text-text-primary"
                  />
                </CompactField>
                <CompactField label="Country">
                  <CountryAutocompleteInput
                    value={form.sender_country}
                    onChange={val => updateForm('sender_country', val)}
                    placeholder="Search Country (e.g. India, USA)"
                    className="w-full bg-transparent focus:outline-none text-[13px] font-bold uppercase text-primary pr-6"
                    countryList={countryList}
                  />
                </CompactField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <CompactField label="Phone / Mobile Number" required>
                  <input
                    type="tel"
                    placeholder="+91 99999 99999"
                    value={form.sender_phone}
                    onChange={e => updateForm('sender_phone', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] font-mono text-text-primary"
                  />
                </CompactField>
                <CompactField label="Email Address">
                  <input
                    type="email"
                    placeholder="sender@example.com"
                    value={form.sender_email}
                    onChange={e => updateForm('sender_email', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                  />
                </CompactField>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <CompactField label="Doc Type">
                  <select
                    value={form.sender_gstin_type}
                    onChange={e => updateForm('sender_gstin_type', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] cursor-pointer text-text-primary"
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
                <CompactField label={/aadhaar|aadhar/i.test(form.sender_gstin_type) ? 'Aadhaar No. (12 Digits)' : 'Document Number'}>
                  <input
                    type="text"
                    placeholder={/aadhaar|aadhar/i.test(form.sender_gstin_type) ? '12-digit Aadhaar' : 'Doc No.'}
                    value={form.sender_gstin_no}
                    maxLength={/aadhaar|aadhar/i.test(form.sender_gstin_type) ? 12 : undefined}
                    onChange={e => {
                      let val = e.target.value
                      if (/aadhaar|aadhar/i.test(form.sender_gstin_type)) {
                        val = val.replace(/\D/g, '').slice(0, 12)
                      }
                      updateForm('sender_gstin_no', val)
                    }}
                    className="w-full bg-transparent focus:outline-none text-[13px] font-mono text-text-primary"
                  />
                </CompactField>
              </div>
            </div>
          </div>

          {/* ── Column 2: Consignee Details ── */}
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs">
            <RedBadge title="Consignee Details" icon={MapPin} />

            <div className="space-y-4">
              <CompactField label="Receiver Full Name" required highlight={!form.receiver_name && !form.receiver_company}>
                <input
                  type="text"
                  placeholder="Receiver Full Name"
                  value={form.receiver_name}
                  onChange={e => updateForm('receiver_name', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-[13px] font-semibold text-navy"
                />
              </CompactField>

              <CompactField label="Company Name">
                <input
                  type="text"
                  placeholder="Receiver Company Name"
                  value={form.receiver_company}
                  onChange={e => updateForm('receiver_company', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-[13px] uppercase text-text-primary"
                />
              </CompactField>

              <CompactField label="Address Line 1" required highlight={!form.receiver_address}>
                <input
                  type="text"
                  placeholder="Street / Building / House No."
                  value={form.receiver_address}
                  onChange={e => updateForm('receiver_address', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                />
              </CompactField>

              <CompactField label="Address Line 2">
                <input
                  type="text"
                  placeholder="Apt / Suite / Area"
                  value={form.receiver_address_2}
                  onChange={e => updateForm('receiver_address_2', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                />
              </CompactField>

              <div className="grid grid-cols-2 gap-3.5">
                <CompactField label="City" required highlight={!form.receiver_city}>
                  <input
                    type="text"
                    placeholder="City"
                    value={form.receiver_city}
                    onChange={e => updateForm('receiver_city', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                  />
                </CompactField>
                <CompactField label="Pincode" required>
                  <input
                    type="text"
                    placeholder="Zip / Pincode"
                    value={form.receiver_pincode}
                    onChange={e => updateForm('receiver_pincode', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] font-mono text-text-primary"
                  />
                </CompactField>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <CompactField label="State">
                  <input
                    type="text"
                    placeholder="State / Province"
                    value={form.receiver_state}
                    onChange={e => updateForm('receiver_state', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] uppercase text-text-primary"
                  />
                </CompactField>
                <CompactField label="Country" required highlight={!form.receiver_country}>
                  <CountryAutocompleteInput
                    value={form.receiver_country}
                    onChange={val => updateForm('receiver_country', val)}
                    placeholder="Search Country (e.g. USA, UK)"
                    className="w-full bg-transparent focus:outline-none text-[13px] font-bold uppercase text-primary pr-6 placeholder-red-300"
                    countryList={countryList}
                  />
                </CompactField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <CompactField label="Phone / Mobile Number" required highlight={!form.receiver_phone}>
                  <input
                    type="tel"
                    placeholder="+1 999 999 9999"
                    value={form.receiver_phone}
                    onChange={e => updateForm('receiver_phone', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] font-mono text-text-primary"
                  />
                </CompactField>
                <CompactField label="Email Address">
                  <input
                    type="email"
                    placeholder="receiver@example.com"
                    value={form.receiver_email}
                    onChange={e => updateForm('receiver_email', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                  />
                </CompactField>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <CompactField label="Doc Type">
                  <select
                    value={form.receiver_gstin_type}
                    onChange={e => updateForm('receiver_gstin_type', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] cursor-pointer text-text-primary"
                  >
                    <option value="">Select</option>
                    <option value="Tax ID">Tax ID</option>
                    <option value="VAT">VAT</option>
                    <option value="Passport">Passport</option>
                    <option value="Aadhaar Number">Aadhaar</option>
                    <option value="PAN">PAN</option>
                    <option value="GSTIN">GSTIN</option>
                  </select>
                </CompactField>
                <CompactField label={/aadhaar|aadhar/i.test(form.receiver_gstin_type) ? 'Aadhaar No. (12 Digits)' : 'Document Number'}>
                  <input
                    type="text"
                    placeholder={/aadhaar|aadhar/i.test(form.receiver_gstin_type) ? '12-digit Aadhaar' : 'Doc No.'}
                    value={form.receiver_gstin_no}
                    maxLength={/aadhaar|aadhar/i.test(form.receiver_gstin_type) ? 12 : undefined}
                    onChange={e => {
                      let val = e.target.value
                      if (/aadhaar|aadhar/i.test(form.receiver_gstin_type)) {
                        val = val.replace(/\D/g, '').slice(0, 12)
                      }
                      updateForm('receiver_gstin_no', val)
                    }}
                    className="w-full bg-transparent focus:outline-none text-[13px] font-mono text-text-primary"
                  />
                </CompactField>
              </div>
            </div>
          </div>

        </div>

        {/* ── Package & Weight Specifications ── */}
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs">
          <RedBadge title="Package & Weight Specifications" icon={Package} />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 mb-4">
            <CompactField label="Package Type">
              <select
                value={form.package_type}
                onChange={e => updateForm('package_type', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-[13px] font-bold cursor-pointer text-navy"
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
                className="w-full bg-transparent focus:outline-none text-[13px] text-navy font-bold text-center"
              />
            </CompactField>

            <CompactField label="Declared Value (₹)">
              <input
                type="number"
                placeholder="Declared value"
                value={form.declared_value}
                onChange={e => updateForm('declared_value', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-[13px] font-semibold text-text-primary"
              />
            </CompactField>

            <CompactField label="Content Description">
              <input
                type="text"
                placeholder="Items / Goods inside"
                value={form.content_description}
                onChange={e => updateForm('content_description', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
              />
            </CompactField>
          </div>

          {/* Weights and Dimensions Table */}
          <div className="border border-border rounded-xl overflow-hidden bg-surface">
            {/* Section Header */}
            <div className="bg-navy text-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">
              Weights and Dimensions
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-4 border-b border-border bg-surface-alt/40">
              <div className="px-4 py-3 border-r border-border">
                <span className="text-[10px] font-extrabold uppercase text-text-secondary block mb-1 tracking-wider">PCS</span>
                <input
                  type="number"
                  min="1"
                  value={form.no_of_pieces}
                  onChange={e => updateForm('no_of_pieces', e.target.value)}
                  className="w-full bg-transparent focus:outline-none text-[14px] text-navy font-bold"
                />
              </div>
              <div className="px-4 py-3 border-r border-border">
                <span className="text-[10px] font-extrabold uppercase text-text-secondary block mb-1 tracking-wider">Actual Weight (kg)</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.weight}
                  onChange={e => {
                    updateForm('weight', e.target.value)
                    if (parcels.length === 1) {
                      updateParcel(0, 'weight', e.target.value)
                    }
                  }}
                  className="w-full bg-transparent focus:outline-none text-[14px] text-navy font-bold"
                />
              </div>
              <div className="px-4 py-3 border-r border-border bg-navy/5">
                <span className="text-[10px] font-extrabold uppercase text-navy block mb-1 tracking-wider">Volumetric Weight</span>
                <input
                  type="text"
                  readOnly
                  value={form.volumetric_weight || '0.00'}
                  className="w-full bg-transparent focus:outline-none text-[14px] text-navy font-extrabold"
                />
              </div>
              <div className="px-4 py-3 bg-primary/5">
                <span className="text-[10px] font-extrabold uppercase text-primary block mb-1 tracking-wider">Chargeable Weight</span>
                <input
                  type="text"
                  readOnly
                  value={form.chargeable_weight || '0.00'}
                  className="w-full bg-transparent focus:outline-none text-[14px] text-primary font-extrabold"
                />
              </div>
            </div>

            {/* Per-Parcel Table Header */}
            <div className="grid grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1.2fr_1.2fr] bg-surface-alt text-[10px] font-bold uppercase text-text-tertiary tracking-wider border-b border-border">
              <div className="px-3 py-2 text-center border-r border-border">Box No.</div>
              <div className="px-3 py-2 text-center border-r border-border">Actual Wt(Kg.)</div>
              <div className="px-3 py-2 text-center border-r border-border">L(CM)</div>
              <div className="px-3 py-2 text-center border-r border-border">B(CM)</div>
              <div className="px-3 py-2 text-center border-r border-border">H(CM)</div>
              <div className="px-3 py-2 text-center border-r border-border">Volumetric Wt(Kg.)</div>
              <div className="px-3 py-2 text-center">Chargeable Wt(Kg.)</div>
            </div>

            {/* Per-Parcel Data Rows */}
            {parcels.map((p, pIdx) => (
              <div key={pIdx} className="grid grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1.2fr_1.2fr] text-[13px] items-center hover:bg-surface-hover transition-colors border-b border-border-light last:border-0 py-1">
                <div className="px-2 py-1 border-r border-border-light">
                  <input type="text" value={p.box_no} readOnly className="w-full bg-transparent focus:outline-none text-xs text-center font-bold text-text-secondary" />
                </div>
                <div className="px-2 py-1 border-r border-border-light">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={p.weight ?? ''}
                    onChange={e => {
                      updateParcel(pIdx, 'weight', e.target.value)
                      if (parcels.length === 1) updateForm('weight', e.target.value)
                    }}
                    className="w-full bg-transparent focus:outline-none text-xs text-center font-bold text-navy"
                  />
                </div>
                <div className="px-2 py-1 border-r border-border-light">
                  <input
                    type="number"
                    placeholder="L"
                    value={p.length ?? ''}
                    onChange={e => {
                      updateParcel(pIdx, 'length', e.target.value)
                      if (parcels.length === 1) updateForm('length', e.target.value)
                    }}
                    className="w-full bg-transparent focus:outline-none text-xs text-center text-text-primary"
                  />
                </div>
                <div className="px-2 py-1 border-r border-border-light">
                  <input
                    type="number"
                    placeholder="B"
                    value={p.breadth ?? ''}
                    onChange={e => {
                      updateParcel(pIdx, 'breadth', e.target.value)
                      if (parcels.length === 1) updateForm('breadth', e.target.value)
                    }}
                    className="w-full bg-transparent focus:outline-none text-xs text-center text-text-primary"
                  />
                </div>
                <div className="px-2 py-1 border-r border-border-light">
                  <input
                    type="number"
                    placeholder="H"
                    value={p.height ?? ''}
                    onChange={e => {
                      updateParcel(pIdx, 'height', e.target.value)
                      if (parcels.length === 1) updateForm('height', e.target.value)
                    }}
                    className="w-full bg-transparent focus:outline-none text-xs text-center text-text-primary"
                  />
                </div>
                <div className="px-2 py-1 border-r border-border-light">
                  <input
                    type="text"
                    readOnly
                    value={p.volumetric_weight || '0.00'}
                    className="w-full bg-transparent focus:outline-none text-xs text-center font-bold text-navy"
                  />
                </div>
                <div className="px-2 py-1">
                  <input
                    type="text"
                    readOnly
                    value={p.chargeable_weight || '0.00'}
                    className="w-full bg-transparent focus:outline-none text-xs text-center font-extrabold text-primary"
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-text-tertiary mt-2 italic">
            * Volumetric weight = (L×B×H / 5000) × PCS. Chargeable weight = max(Actual, Volumetric).
          </p>
        </div>

        {/* ── Create Shipment Invoice Section ── */}
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs">
          <button
            type="button"
            onClick={() => setShowShipmentInvoice(!showShipmentInvoice)}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <RedBadge title="Create Shipment Invoice" icon={Receipt} />
            <ChevronDown className={`w-4 h-4 text-navy transition-transform duration-200 ${showShipmentInvoice ? 'rotate-180' : ''}`} />
          </button>

          {showShipmentInvoice && (
            <div className="mt-4 animate-slide-down">
              {/* Invoice Meta Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
                <CompactField label="Invoice Type">
                  <select
                    value={form.invoice_type || 'INVOICE'}
                    onChange={e => updateForm('invoice_type', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-navy font-bold cursor-pointer"
                  >
                    <option value="INVOICE">Invoice</option>
                    <option value="PROFORMA">Proforma Invoice</option>
                  </select>
                </CompactField>
                <CompactField label="Currency">
                  <select
                    value={form.invoice_currency}
                    onChange={e => updateForm('invoice_currency', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-navy font-bold cursor-pointer"
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
                    className="w-full bg-transparent focus:outline-none text-[13px] text-navy font-bold cursor-pointer"
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
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                  />
                </CompactField>
              </div>

              {/* Invoice Items Table */}
              <div className="border border-border rounded-xl overflow-hidden bg-surface">
                {/* Table Header */}
                <div className="bg-navy text-white grid grid-cols-[40px_45px_1fr_95px_70px_65px_80px_70px_80px_85px_45px] text-[10px] font-bold uppercase tracking-wider">
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
                  <div key={idx} className="grid grid-cols-[40px_45px_1fr_95px_70px_65px_80px_70px_80px_85px_45px] border-t border-border-light text-[13px] items-center hover:bg-surface-hover transition-colors py-1">
                    <div className="px-1.5 py-1 text-center text-xs font-bold text-text-tertiary">{item.sr_no}</div>
                    <div className="px-1">
                      <select
                        value={item.box_no}
                        onChange={e => updateInvoiceItem(idx, 'box_no', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-center font-bold text-navy cursor-pointer"
                      >
                        {Array.from({ length: Math.max(1, parseInt(form.no_of_pieces) || 1) }, (_, i) => i + 1).map(boxNum => (
                          <option key={boxNum} value={String(boxNum)}>
                            {boxNum}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="px-1">
                      <input type="text" placeholder="Item description" value={item.description} onChange={e => updateInvoiceItem(idx, 'description', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-[13px] text-navy font-medium" />
                    </div>
                    <div className="px-1">
                      <input type="text" placeholder="" value={item.hs_code} onChange={e => updateInvoiceItem(idx, 'hs_code', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-mono text-center text-text-primary" />
                    </div>
                    <div className="px-1">
                      <select value={item.unit_type} onChange={e => updateInvoiceItem(idx, 'unit_type', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-semibold cursor-pointer text-text-primary">
                        <option value="PCS">PCS</option>
                        <option value="KGS">KGS</option>
                        <option value="MTR">MTR</option>
                        <option value="SET">SET</option>
                        <option value="BOX">BOX</option>
                        <option value="PAIR">PAIR</option>
                      </select>
                    </div>
                    <div className="px-1">
                      <input type="number" placeholder="" value={item.quantity} onChange={e => updateInvoiceItem(idx, 'quantity', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-center font-bold text-navy" />
                    </div>
                    <div className="px-1">
                      <input type="number" step="0.01" placeholder="" value={item.unit_weight} onChange={e => updateInvoiceItem(idx, 'unit_weight', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-right text-text-primary" />
                    </div>
                    <div className="px-1">
                      <input type="number" step="0.01" placeholder="" value={item.cost} onChange={e => updateInvoiceItem(idx, 'cost', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-right text-text-primary" />
                    </div>
                    <div className="px-1">
                      <input type="number" step="0.01" placeholder="" value={item.unit_rates} onChange={e => updateInvoiceItem(idx, 'unit_rates', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-right text-text-primary" />
                    </div>
                    <div className="px-1">
                      <input type="number" step="0.01" placeholder="" readOnly value={item.amount}
                        className="w-full bg-transparent focus:outline-none text-xs text-right font-extrabold text-primary" />
                    </div>
                    <div className="px-1 text-center">
                      <button type="button" onClick={() => removeInvoiceItem(idx)}
                        className="text-danger/70 hover:text-danger transition-colors cursor-pointer p-1" title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Totals Row */}
                <div className="grid grid-cols-[40px_45px_1fr_95px_70px_65px_80px_70px_80px_85px_45px] border-t-2 border-border bg-surface-alt text-[11px] font-extrabold items-center py-2">
                  <div className="col-span-5"></div>
                  <div className="px-1.5 py-1 text-right text-navy uppercase tracking-wider">Total Wt</div>
                  <div className="px-1.5 py-1 text-right text-navy font-mono">{invoiceTotalWeight.toFixed(2)}</div>
                  <div className="col-span-2 px-1.5 py-1 text-right text-navy uppercase tracking-wider">Total Amount</div>
                  <div className="px-1.5 py-1 text-right text-primary text-xs font-bold font-mono">{invoiceTotalAmount.toFixed(2)}</div>
                  <div></div>
                </div>
              </div>

              {/* Add Item Button */}
              <button
                type="button"
                onClick={addInvoiceItem}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-alt hover:bg-surface-hover border border-border text-navy text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                ADD ITEM
              </button>
            </div>
          )}
        </div>

        {/* ── Footer Action Bar ── */}
        <div className="bg-surface rounded-2xl border border-border p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="px-4 py-2.5 rounded-xl border border-border bg-surface text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => { setForm(INITIAL_FORM); setInvoiceItems([{ sr_no: 1, box_no: '1', description: '', hs_code: '', unit_type: 'PCS', quantity: '', unit_weight: '', cost: '', unit_rates: '', amount: '' }]) }}
              className="px-4 py-2.5 rounded-xl border border-border bg-surface text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Reset Form
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
    <div className="flex items-center gap-2.5 mb-3.5">
      <div className="w-7 h-7 bg-navy/5 rounded-lg flex items-center justify-center text-navy flex-shrink-0">
        {Icon ? <Icon className="w-4 h-4" /> : <Package className="w-4 h-4" />}
      </div>
      <h3 className="text-sm font-bold text-navy tracking-tight">
        {title}
      </h3>
    </div>
  )
}

function CompactField({ label, required, children, className = '', highlight = false }) {
  return (
    <div
      className={`relative border ${
        highlight
          ? 'border-danger ring-2 ring-danger/10'
          : 'border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10'
      } rounded-xl bg-surface px-3.5 py-2.5 transition-all ${className}`}
    >
      <label className="absolute -top-2.5 left-3 px-1 bg-surface text-[10px] font-bold text-text-secondary uppercase tracking-wider whitespace-nowrap z-10">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <div className="pt-1">{children}</div>
    </div>
  )
}
