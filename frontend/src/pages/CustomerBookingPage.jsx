import { useState, useEffect, useCallback, useMemo } from 'react'
import './CustomerBookingPage.css'

// ── Country List ──
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin',
  'Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso',
  'Burundi','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China',
  'Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark',
  'Djibouti','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea',
  'Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany',
  'Ghana','Greece','Guatemala','Guinea','Guyana','Haiti','Honduras','Hungary','Iceland','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan',
  'Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya',
  'Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania',
  'Mauritius','Mexico','Moldova','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia',
  'Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Macedonia','Norway','Oman',
  'Pakistan','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar',
  'Romania','Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Sierra Leone','Singapore','Slovakia',
  'Slovenia','Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Suriname','Sweden',
  'Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Togo','Trinidad and Tobago',
  'Tunisia','Turkey','Turkmenistan','Uganda','Ukraine','United Arab Emirates','United Kingdom',
  'United States','Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
]

// ── Step Config ──
const STEPS = [
  { id: 1, label: 'Shipment Details', desc: 'Fill in the required details', icon: 'shipment' },
  { id: 2, label: 'Shipper Information', desc: 'Fill in the required details', icon: 'shipper' },
  { id: 3, label: 'Consignee Information', desc: 'Fill in the required details', icon: 'consignee' },
  { id: 4, label: 'Shipment Information', desc: 'Fill in the required details', icon: 'package' },
  { id: 5, label: 'Invoice Items', desc: 'Fill in the required details', icon: 'invoice' },
  { id: 6, label: 'Buyer Details', desc: 'Fill in the required details', icon: 'buyer' },
  { id: 7, label: 'GST & Export', desc: 'Fill in the required details', icon: 'gst' },
]

// ── Initial Form State ──
const INITIAL_FORM = {
  // Step 1 - Shipment Details
  origin_country: 'India',
  destination_country: '',
  shipment_type: 'Commercial',
  export_reason: '',
  shipment_instructions: '',
  required_label: true,
  required_performa: false,
  // Step 2 - Shipper
  shipper_name: '',
  shipper_company: '',
  shipper_phone: '',
  shipper_email: '',
  shipper_address: '',
  shipper_address_2: '',
  shipper_city: '',
  shipper_state: '',
  shipper_pincode: '',
  shipper_country: 'India',
  shipper_doc_type: '',
  shipper_doc_no: '',
  // Step 3 - Consignee
  consignee_name: '',
  consignee_company: '',
  consignee_phone: '',
  consignee_email: '',
  consignee_address: '',
  consignee_address_2: '',
  consignee_city: '',
  consignee_state: '',
  consignee_pincode: '',
  consignee_country: '',
  consignee_doc_type: '',
  consignee_doc_no: '',
  // Step 4 - Shipment Info
  package_type: 'parcel',
  weight: '',
  length: '',
  breadth: '',
  height: '',
  no_of_pieces: '1',
  content_description: '',
  declared_value: '',
  // Step 5 - Invoice Items
  invoice_items: [{ description: '', qty: '1', unit_price: '', total: '' }],
  // Step 6 - Buyer Details
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
  // Step 7 - GST & Export
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
  invoice_no: '',
  invoice_date: '',
  invoice_currency: 'INR',
  hs_code: '',
  terms_of_trade: 'CIF',
}

// ── SVG Icons ──
const Icons = {
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  arrowRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  arrowLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  shipment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  shipper: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  consignee: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  package: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  invoice: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  buyer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  gst: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
}

const LOGO_URL = 'https://princeexp.com/wp-content/uploads/2026/04/ChatGPT-Image-Apr-14-2026-06_03_34-AM.png'

// ═══════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════
export default function CustomerBookingPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [completedSteps, setCompletedSteps] = useState(new Set())

  // ── Form Helpers ──
  const updateForm = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateInvoiceItem = useCallback((index, field, value) => {
    setForm(prev => {
      const items = [...prev.invoice_items]
      items[index] = { ...items[index], [field]: value }
      // Auto-calc total
      if (field === 'qty' || field === 'unit_price') {
        const qty = parseFloat(field === 'qty' ? value : items[index].qty) || 0
        const price = parseFloat(field === 'unit_price' ? value : items[index].unit_price) || 0
        items[index].total = (qty * price).toFixed(2)
      }
      return { ...prev, invoice_items: items }
    })
  }, [])

  const addInvoiceItem = useCallback(() => {
    setForm(prev => ({
      ...prev,
      invoice_items: [...prev.invoice_items, { description: '', qty: '1', unit_price: '', total: '' }]
    }))
  }, [])

  const removeInvoiceItem = useCallback((index) => {
    setForm(prev => ({
      ...prev,
      invoice_items: prev.invoice_items.filter((_, i) => i !== index)
    }))
  }, [])

  // ── Navigation ──
  const goToStep = (s) => {
    // Mark current step as completed when moving forward
    if (s > step) {
      setCompletedSteps(prev => new Set([...prev, step]))
    }
    setStep(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const nextStep = () => {
    if (step < 7) goToStep(step + 1)
  }

  const prevStep = () => {
    if (step > 1) goToStep(step - 1)
  }

  // ── Summary Calculations ──
  const summaryData = useMemo(() => {
    const totalPieces = parseInt(form.no_of_pieces) || 1
    const totalWeight = parseFloat(form.weight) || 0
    const declaredValue = parseFloat(form.declared_value) || 0
    const invoiceTotal = form.invoice_items.reduce((sum, item) => {
      return sum + (parseFloat(item.total) || 0)
    }, 0)
    const progressPct = Math.round((completedSteps.size / 7) * 100)
    return { totalPieces, totalWeight, declaredValue, invoiceTotal, progressPct }
  }, [form, completedSteps])

  // ── Submit ──
  const handleSubmit = async () => {
    setCompletedSteps(prev => new Set([...prev, 7]))
    setSubmitting(true)
    try {
      // Build payload mapping to the existing booking API
      const payload = {
        sender_name: form.shipper_name,
        sender_company: form.shipper_company,
        sender_email: form.shipper_email,
        sender_phone: form.shipper_phone,
        sender_address: form.shipper_address,
        sender_address_2: form.shipper_address_2,
        sender_city: form.shipper_city,
        sender_pincode: form.shipper_pincode,
        sender_state: form.shipper_state,
        sender_country: form.shipper_country || form.origin_country,
        sender_gstin_type: form.shipper_doc_type,
        sender_gstin_no: form.shipper_doc_no,
        receiver_name: form.consignee_name,
        receiver_email: form.consignee_email,
        receiver_phone: form.consignee_phone,
        receiver_address: form.consignee_address,
        receiver_address_2: form.consignee_address_2,
        receiver_city: form.consignee_city,
        receiver_pincode: form.consignee_pincode,
        receiver_state: form.consignee_state,
        receiver_country: form.consignee_country || form.destination_country,
        receiver_gstin_type: form.consignee_doc_type,
        receiver_gstin_no: form.consignee_doc_no,
        weight: parseFloat(form.weight) || 0,
        length: parseFloat(form.length) || 0,
        breadth: parseFloat(form.breadth) || 0,
        height: parseFloat(form.height) || 0,
        no_of_pieces: parseInt(form.no_of_pieces) || 1,
        content_description: form.content_description,
        declared_value: parseFloat(form.declared_value) || 0,
        package_type: form.package_type,
        payment_mode: 'prepaid',
        shipping_charge: 0,
        total_amount: 0,
        export_reason: form.export_reason,
        remarks: form.shipment_instructions,
        is_commercial: form.shipment_type === 'Commercial' ? '1' : '0',
        required_label: form.required_label ? '1' : '0',
        required_performa: form.required_performa ? '1' : '0',
        // Invoice
        invoice_no: form.invoice_no,
        invoice_date: form.invoice_date,
        invoice_currency: form.invoice_currency,
        hs_code: form.hs_code,
        terms_of_trade: form.terms_of_trade,
        // Buyer
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
        // GST
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
      }

      const apiBase = window.location.origin
      const res = await fetch(`${apiBase}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to create booking')
      }

      setSuccess(true)
    } catch (err) {
      alert(err.message || 'Failed to create booking. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Notify parent iframe of success
  useEffect(() => {
    if (success) {
      try {
        window.parent.postMessage({ type: 'PE_BOOKING_SUCCESS' }, '*')
      } catch (e) { /* ignore if no parent */ }
    }
  }, [success])

  return (
    <div className="cb-page">
      {/* ── Header ── */}
      <header className="cb-header">
        <div className="cb-header-inner">
          <div className="cb-header-left">
            <img src={LOGO_URL} alt="Prince Express" className="cb-header-logo" />
            <div>
              <div className="cb-header-title">Create Shipment</div>
              <div className="cb-header-subtitle">Complete the details below to book your international shipment.</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile Step Selector ── */}
      <div className="cb-layout">
        <div className="cb-mobile-steps">
          <select
            className="cb-mobile-step-select"
            value={step}
            onChange={e => goToStep(Number(e.target.value))}
          >
            {STEPS.map(s => (
              <option key={s.id} value={s.id}>
                {s.id}. {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Left Sidebar (Step Nav) ── */}
        <aside className="cb-steps-sidebar">
          <ul className="cb-steps-list">
            {STEPS.map(s => (
              <li
                key={s.id}
                className={`cb-step-item ${step === s.id ? 'active' : ''} ${completedSteps.has(s.id) && step !== s.id ? 'completed' : ''}`}
                onClick={() => goToStep(s.id)}
              >
                <div className="cb-step-number">
                  {completedSteps.has(s.id) && step !== s.id
                    ? Icons.check
                    : s.id
                  }
                </div>
                <div>
                  <div className="cb-step-label">{s.label}</div>
                  {step === s.id && <div className="cb-step-desc">{s.desc}</div>}
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Main Content ── */}
        <main className="cb-main">
          {step === 1 && <StepShipmentDetails form={form} updateForm={updateForm} onNext={nextStep} />}
          {step === 2 && <StepShipperInfo form={form} updateForm={updateForm} onNext={nextStep} onPrev={prevStep} />}
          {step === 3 && <StepConsigneeInfo form={form} updateForm={updateForm} onNext={nextStep} onPrev={prevStep} />}
          {step === 4 && <StepShipmentInfo form={form} updateForm={updateForm} onNext={nextStep} onPrev={prevStep} />}
          {step === 5 && (
            <StepInvoiceItems
              form={form}
              updateInvoiceItem={updateInvoiceItem}
              addInvoiceItem={addInvoiceItem}
              removeInvoiceItem={removeInvoiceItem}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}
          {step === 6 && <StepBuyerDetails form={form} updateForm={updateForm} onNext={nextStep} onPrev={prevStep} />}
          {step === 7 && (
            <StepGstExport
              form={form}
              updateForm={updateForm}
              onPrev={prevStep}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}
        </main>

        {/* ── Right Sidebar (Summary) ── */}
        <aside className="cb-summary-sidebar">
          <div className="cb-summary-card">
            <div className="cb-summary-header">
              <span className="cb-summary-title">Shipment Summary</span>
              <span className="cb-summary-pct">{summaryData.progressPct}%</span>
            </div>
            <div className="cb-progress-wrap">
              <div className="cb-progress-bar">
                <div className="cb-progress-fill" style={{ width: `${summaryData.progressPct}%` }} />
              </div>
            </div>
            <div className="cb-summary-body">
              <SummaryRow label="Origin" value={form.origin_country || '—'} />
              <SummaryRow label="Destination" value={form.destination_country || '—'} empty={!form.destination_country} />
              <SummaryRow label="Total Pieces" value={summaryData.totalPieces} />
              <SummaryRow label="Total Weight" value={summaryData.totalWeight ? `${summaryData.totalWeight} kg` : '—'} empty={!summaryData.totalWeight} />
              <SummaryRow label="Declared Value" value={summaryData.declaredValue ? `₹${summaryData.declaredValue.toLocaleString()}` : '—'} empty={!summaryData.declaredValue} />
              <SummaryRow label="Invoice Total" value={summaryData.invoiceTotal ? `USD ${summaryData.invoiceTotal.toFixed(2)}` : 'USD 0.00'} />
            </div>
            <div className="cb-cost-box">
              <div className="cb-cost-label">Estimated shipping cost</div>
              <div className="cb-cost-amount">USD 25.00</div>
              <div className="cb-cost-note">Final rate calculated at checkout.</div>
            </div>
          </div>

          <div className="cb-secure-badge">
            <div className="cb-secure-icon">{Icons.shield}</div>
            <div>
              <div className="cb-secure-title">Secure & Insured</div>
              <div className="cb-secure-desc">All shipments include tracking and standard insurance up to $100.</div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Success Overlay ── */}
      {success && (
        <div className="cb-success-overlay">
          <div className="cb-success-card">
            <div className="cb-success-icon">{Icons.check}</div>
            <div className="cb-success-title">Shipment Created!</div>
            <div className="cb-success-desc">
              Your booking has been submitted successfully. You will receive a confirmation email with your AWB number and tracking details.
            </div>
            <button
              className="cb-btn cb-btn-primary"
              onClick={() => {
                setSuccess(false)
                setForm(INITIAL_FORM)
                setStep(1)
                setCompletedSteps(new Set())
              }}
            >
              Book Another Shipment
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
//  STEP COMPONENTS
// ═══════════════════════════════════════

// ── Step 1: Shipment Details ──
function StepShipmentDetails({ form, updateForm, onNext }) {
  return (
    <div className="cb-section cb-animate-in">
      <div className="cb-section-header">
        <div className="cb-section-icon">{Icons.shipment}</div>
        <div>
          <div className="cb-section-title">Shipment Details</div>
          <div className="cb-section-subtitle">Fill in the required details</div>
        </div>
      </div>
      <div className="cb-section-body">
        <div className="cb-form-grid">
          <Field label="Origin Country" required>
            <select className="cb-input" value={form.origin_country} onChange={e => updateForm('origin_country', e.target.value)}>
              <option value="">Select country</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Destination Country" required>
            <select className="cb-input" value={form.destination_country} onChange={e => updateForm('destination_country', e.target.value)}>
              <option value="">Select country</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Shipment Type" required>
            <select className="cb-input" value={form.shipment_type} onChange={e => updateForm('shipment_type', e.target.value)}>
              <option value="Commercial">Commercial</option>
              <option value="Non-Commercial">Non-Commercial</option>
              <option value="Document">Document</option>
              <option value="Sample">Sample</option>
            </select>
          </Field>
          <Field label="Export Reason">
            <input
              type="text"
              className="cb-input"
              placeholder="e.g. Sale, Sample, Gift"
              value={form.export_reason}
              onChange={e => updateForm('export_reason', e.target.value)}
            />
          </Field>
          <div className="cb-form-full">
            <Field label="Shipment Instructions">
              <textarea
                className="cb-input"
                placeholder="Special handling notes for the courier"
                value={form.shipment_instructions}
                onChange={e => updateForm('shipment_instructions', e.target.value)}
                rows={3}
              />
            </Field>
          </div>
        </div>
        <div className="cb-checkbox-row">
          <CheckboxItem
            checked={form.required_label}
            onChange={v => updateForm('required_label', v)}
            label="Required Label"
          />
          <CheckboxItem
            checked={form.required_performa}
            onChange={v => updateForm('required_performa', v)}
            label="Required Proforma Invoice"
          />
        </div>
      </div>
      <div className="cb-actions">
        <button className="cb-btn cb-btn-primary" onClick={onNext}>
          Save & Continue {Icons.arrowRight}
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Shipper Information ──
function StepShipperInfo({ form, updateForm, onNext, onPrev }) {
  return (
    <div className="cb-section cb-animate-in">
      <div className="cb-section-header">
        <div className="cb-section-icon">{Icons.shipper}</div>
        <div>
          <div className="cb-section-title">Shipper Information</div>
          <div className="cb-section-subtitle">Fill in the required details</div>
        </div>
      </div>
      <div className="cb-section-body">
        <div className="cb-form-grid">
          <Field label="Full Name" required>
            <input type="text" className="cb-input" placeholder="e.g. Rachit Shah" value={form.shipper_name} onChange={e => updateForm('shipper_name', e.target.value)} />
          </Field>
          <Field label="Company Name">
            <input type="text" className="cb-input" placeholder="e.g. Acme Corp Pvt Ltd" value={form.shipper_company} onChange={e => updateForm('shipper_company', e.target.value)} />
          </Field>
          <Field label="Phone Number" required>
            <input type="tel" className="cb-input" placeholder="+91 99999 99999" value={form.shipper_phone} onChange={e => updateForm('shipper_phone', e.target.value)} />
          </Field>
          <Field label="Email Address">
            <input type="email" className="cb-input" placeholder="sender@example.com" value={form.shipper_email} onChange={e => updateForm('shipper_email', e.target.value)} />
          </Field>
          <Field label="Address Line 1" required>
            <input type="text" className="cb-input" placeholder="Street / Building" value={form.shipper_address} onChange={e => updateForm('shipper_address', e.target.value)} />
          </Field>
          <Field label="Address Line 2">
            <input type="text" className="cb-input" placeholder="Area / Landmark" value={form.shipper_address_2} onChange={e => updateForm('shipper_address_2', e.target.value)} />
          </Field>
          <Field label="City" required>
            <input type="text" className="cb-input" placeholder="City" value={form.shipper_city} onChange={e => updateForm('shipper_city', e.target.value)} />
          </Field>
          <Field label="State">
            <input type="text" className="cb-input" placeholder="State" value={form.shipper_state} onChange={e => updateForm('shipper_state', e.target.value)} />
          </Field>
          <Field label="Pincode" required>
            <input type="text" className="cb-input" placeholder="Zip / Postal" value={form.shipper_pincode} onChange={e => updateForm('shipper_pincode', e.target.value)} />
          </Field>
          <Field label="Country">
            <select className="cb-input" value={form.shipper_country} onChange={e => updateForm('shipper_country', e.target.value)}>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Document Type">
            <select className="cb-input" value={form.shipper_doc_type} onChange={e => updateForm('shipper_doc_type', e.target.value)}>
              <option value="">— Select —</option>
              <option value="Aadhaar Number">Aadhaar Number</option>
              <option value="Pan Number">PAN Number</option>
              <option value="Passport">Passport</option>
              <option value="Voter ID">Voter ID</option>
              <option value="Driving License">Driving License</option>
            </select>
          </Field>
          <Field label="Document Number">
            <input type="text" className="cb-input" placeholder="e.g. 1234 5678 9012" value={form.shipper_doc_no} onChange={e => updateForm('shipper_doc_no', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="cb-actions">
        <button className="cb-btn cb-btn-outline" onClick={onPrev}>{Icons.arrowLeft} Back</button>
        <button className="cb-btn cb-btn-primary" onClick={onNext}>Save & Continue {Icons.arrowRight}</button>
      </div>
    </div>
  )
}

// ── Step 3: Consignee Information ──
function StepConsigneeInfo({ form, updateForm, onNext, onPrev }) {
  return (
    <div className="cb-section cb-animate-in">
      <div className="cb-section-header">
        <div className="cb-section-icon">{Icons.consignee}</div>
        <div>
          <div className="cb-section-title">Consignee Information</div>
          <div className="cb-section-subtitle">Fill in the required details</div>
        </div>
      </div>
      <div className="cb-section-body">
        <div className="cb-form-grid">
          <Field label="Full Name / Company" required>
            <input type="text" className="cb-input" placeholder="Receiver Name" value={form.consignee_name} onChange={e => updateForm('consignee_name', e.target.value)} />
          </Field>
          <Field label="Company Name">
            <input type="text" className="cb-input" placeholder="Company (optional)" value={form.consignee_company} onChange={e => updateForm('consignee_company', e.target.value)} />
          </Field>
          <Field label="Phone Number" required>
            <input type="tel" className="cb-input" placeholder="+1 999 999 9999" value={form.consignee_phone} onChange={e => updateForm('consignee_phone', e.target.value)} />
          </Field>
          <Field label="Email Address">
            <input type="email" className="cb-input" placeholder="receiver@example.com" value={form.consignee_email} onChange={e => updateForm('consignee_email', e.target.value)} />
          </Field>
          <Field label="Address Line 1" required>
            <input type="text" className="cb-input" placeholder="Street / Building" value={form.consignee_address} onChange={e => updateForm('consignee_address', e.target.value)} />
          </Field>
          <Field label="Address Line 2">
            <input type="text" className="cb-input" placeholder="Apt / Suite / Floor" value={form.consignee_address_2} onChange={e => updateForm('consignee_address_2', e.target.value)} />
          </Field>
          <Field label="City" required>
            <input type="text" className="cb-input" placeholder="City" value={form.consignee_city} onChange={e => updateForm('consignee_city', e.target.value)} />
          </Field>
          <Field label="State">
            <input type="text" className="cb-input" placeholder="State" value={form.consignee_state} onChange={e => updateForm('consignee_state', e.target.value)} />
          </Field>
          <Field label="Pincode" required>
            <input type="text" className="cb-input" placeholder="Zip / Postal" value={form.consignee_pincode} onChange={e => updateForm('consignee_pincode', e.target.value)} />
          </Field>
          <Field label="Country" required>
            <select className="cb-input" value={form.consignee_country} onChange={e => updateForm('consignee_country', e.target.value)}>
              <option value="">Select country</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Document Type">
            <select className="cb-input" value={form.consignee_doc_type} onChange={e => updateForm('consignee_doc_type', e.target.value)}>
              <option value="">— Select —</option>
              <option value="Pan Number">PAN Number</option>
              <option value="Passport">Passport</option>
              <option value="Tax ID">Tax ID</option>
            </select>
          </Field>
          <Field label="Document Number">
            <input type="text" className="cb-input" placeholder="e.g. ABCDE1234F" value={form.consignee_doc_no} onChange={e => updateForm('consignee_doc_no', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="cb-actions">
        <button className="cb-btn cb-btn-outline" onClick={onPrev}>{Icons.arrowLeft} Back</button>
        <button className="cb-btn cb-btn-primary" onClick={onNext}>Save & Continue {Icons.arrowRight}</button>
      </div>
    </div>
  )
}

// ── Step 4: Shipment Information ──
function StepShipmentInfo({ form, updateForm, onNext, onPrev }) {
  const volWeight = form.length && form.breadth && form.height
    ? ((parseFloat(form.length) * parseFloat(form.breadth) * parseFloat(form.height)) / 5000).toFixed(2)
    : null

  return (
    <div className="cb-section cb-animate-in">
      <div className="cb-section-header">
        <div className="cb-section-icon">{Icons.package}</div>
        <div>
          <div className="cb-section-title">Shipment Information</div>
          <div className="cb-section-subtitle">Fill in the required details</div>
        </div>
      </div>
      <div className="cb-section-body">
        <div className="cb-form-grid">
          <Field label="Package Type" required>
            <select className="cb-input" value={form.package_type} onChange={e => updateForm('package_type', e.target.value)}>
              <option value="document">Document</option>
              <option value="parcel">Parcel</option>
              <option value="fragile">Fragile</option>
              <option value="heavy">Heavy</option>
            </select>
          </Field>
          <Field label="No. of Pieces" required>
            <input type="number" className="cb-input" min="1" placeholder="1" value={form.no_of_pieces} onChange={e => updateForm('no_of_pieces', e.target.value)} />
          </Field>
          <div className="cb-form-full">
            <Field label="Content Description">
              <input type="text" className="cb-input" placeholder="e.g. Electronics, Clothing, Documents..." value={form.content_description} onChange={e => updateForm('content_description', e.target.value)} />
            </Field>
          </div>
          <Field label="Actual Weight (kg)" required>
            <input type="number" className="cb-input" step="0.1" min="0" placeholder="0.0" value={form.weight} onChange={e => updateForm('weight', e.target.value)} />
          </Field>
          <Field label="Declared Value (₹)">
            <input type="number" className="cb-input" min="0" placeholder="0" value={form.declared_value} onChange={e => updateForm('declared_value', e.target.value)} />
          </Field>
        </div>

        {/* Dimensions */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--cb-border-light)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cb-text)', marginBottom: 4 }}>Dimensions (cm)</div>
          <div style={{ fontSize: 11, color: 'var(--cb-text-tertiary)', marginBottom: 16 }}>Used for volumetric weight calculation</div>
          <div className="cb-form-grid cols-3">
            <Field label="Length">
              <input type="number" className="cb-input" step="0.1" min="0" placeholder="0" value={form.length} onChange={e => updateForm('length', e.target.value)} />
            </Field>
            <Field label="Width">
              <input type="number" className="cb-input" step="0.1" min="0" placeholder="0" value={form.breadth} onChange={e => updateForm('breadth', e.target.value)} />
            </Field>
            <Field label="Height">
              <input type="number" className="cb-input" step="0.1" min="0" placeholder="0" value={form.height} onChange={e => updateForm('height', e.target.value)} />
            </Field>
          </div>
          {volWeight && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--cb-surface-alt)', borderRadius: 10, border: '1px solid var(--cb-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="cb-animate-in">
              <span style={{ fontSize: 12, color: 'var(--cb-text-secondary)', fontWeight: 500 }}>Volumetric Weight</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cb-text)' }}>{volWeight} kg</span>
            </div>
          )}
        </div>
      </div>
      <div className="cb-actions">
        <button className="cb-btn cb-btn-outline" onClick={onPrev}>{Icons.arrowLeft} Back</button>
        <button className="cb-btn cb-btn-primary" onClick={onNext}>Save & Continue {Icons.arrowRight}</button>
      </div>
    </div>
  )
}

// ── Step 5: Invoice Items ──
function StepInvoiceItems({ form, updateInvoiceItem, addInvoiceItem, removeInvoiceItem, onNext, onPrev }) {
  return (
    <div className="cb-section cb-animate-in">
      <div className="cb-section-header">
        <div className="cb-section-icon">{Icons.invoice}</div>
        <div>
          <div className="cb-section-title">Invoice Items</div>
          <div className="cb-section-subtitle">Add items for the commercial invoice</div>
        </div>
      </div>
      <div className="cb-section-body">
        <table className="cb-invoice-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Description</th>
              <th style={{ width: '15%' }}>Qty</th>
              <th style={{ width: '20%' }}>Unit Price (USD)</th>
              <th style={{ width: '20%' }}>Total (USD)</th>
              <th style={{ width: '5%' }}></th>
            </tr>
          </thead>
          <tbody>
            {form.invoice_items.map((item, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="text"
                    className="cb-input"
                    placeholder="Item description"
                    value={item.description}
                    onChange={e => updateInvoiceItem(i, 'description', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="cb-input"
                    min="1"
                    placeholder="1"
                    value={item.qty}
                    onChange={e => updateInvoiceItem(i, 'qty', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="cb-input"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={item.unit_price}
                    onChange={e => updateInvoiceItem(i, 'unit_price', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="cb-input"
                    value={item.total}
                    readOnly
                    style={{ background: 'var(--cb-surface-alt)', fontWeight: 600 }}
                  />
                </td>
                <td>
                  {form.invoice_items.length > 1 && (
                    <button className="remove-btn" onClick={() => removeInvoiceItem(i)}>
                      {Icons.trash}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="cb-add-item-btn" onClick={addInvoiceItem}>
          {Icons.plus} Add Item
        </button>
      </div>
      <div className="cb-actions">
        <button className="cb-btn cb-btn-outline" onClick={onPrev}>{Icons.arrowLeft} Back</button>
        <button className="cb-btn cb-btn-primary" onClick={onNext}>Save & Continue {Icons.arrowRight}</button>
      </div>
    </div>
  )
}

// ── Step 6: Buyer Details ──
function StepBuyerDetails({ form, updateForm, onNext, onPrev }) {
  return (
    <div className="cb-section cb-animate-in">
      <div className="cb-section-header">
        <div className="cb-section-icon">{Icons.buyer}</div>
        <div>
          <div className="cb-section-title">Buyer Details</div>
          <div className="cb-section-subtitle">Fill if buyer is different from consignee</div>
        </div>
      </div>
      <div className="cb-section-body">
        <div className="cb-form-grid">
          <Field label="Buyer Name">
            <input type="text" className="cb-input" placeholder="e.g. Anurag" value={form.buyer_name} onChange={e => updateForm('buyer_name', e.target.value)} />
          </Field>
          <Field label="Person Type">
            <select className="cb-input" value={form.buyer_person_type} onChange={e => updateForm('buyer_person_type', e.target.value)}>
              <option value="Individual">Individual</option>
              <option value="Business">Business</option>
            </select>
          </Field>
          <Field label="Address Line 1">
            <input type="text" className="cb-input" placeholder="Street / Building" value={form.buyer_address1} onChange={e => updateForm('buyer_address1', e.target.value)} />
          </Field>
          <Field label="Address Line 2">
            <input type="text" className="cb-input" placeholder="Area / Landmark" value={form.buyer_address2} onChange={e => updateForm('buyer_address2', e.target.value)} />
          </Field>
          <Field label="City">
            <input type="text" className="cb-input" placeholder="City" value={form.buyer_city} onChange={e => updateForm('buyer_city', e.target.value)} />
          </Field>
          <Field label="State">
            <input type="text" className="cb-input" placeholder="State" value={form.buyer_state} onChange={e => updateForm('buyer_state', e.target.value)} />
          </Field>
          <Field label="Pincode">
            <input type="text" className="cb-input" placeholder="Zip / Postal" value={form.buyer_pincode} onChange={e => updateForm('buyer_pincode', e.target.value)} />
          </Field>
          <Field label="Country Code">
            <input type="text" className="cb-input" placeholder="e.g. US, GB, AE" value={form.buyer_country_code} onChange={e => updateForm('buyer_country_code', e.target.value)} />
          </Field>
          <Field label="Telephone">
            <input type="tel" className="cb-input" placeholder="+1 999 999 9999" value={form.buyer_telephone} onChange={e => updateForm('buyer_telephone', e.target.value)} />
          </Field>
          <Field label="Mobile">
            <input type="tel" className="cb-input" placeholder="+1 999 999 9999" value={form.buyer_mobile} onChange={e => updateForm('buyer_mobile', e.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" className="cb-input" placeholder="buyer@example.com" value={form.buyer_email} onChange={e => updateForm('buyer_email', e.target.value)} />
          </Field>
          <Field label="IEC Number">
            <input type="text" className="cb-input" placeholder="IEC No." value={form.buyer_iec_no} onChange={e => updateForm('buyer_iec_no', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="cb-actions">
        <button className="cb-btn cb-btn-outline" onClick={onPrev}>{Icons.arrowLeft} Back</button>
        <button className="cb-btn cb-btn-primary" onClick={onNext}>Save & Continue {Icons.arrowRight}</button>
      </div>
    </div>
  )
}

// ── Step 7: GST & Export ──
function StepGstExport({ form, updateForm, onPrev, onSubmit, submitting }) {
  return (
    <div className="cb-section cb-animate-in">
      <div className="cb-section-header">
        <div className="cb-section-icon">{Icons.gst}</div>
        <div>
          <div className="cb-section-title">GST & Export Details</div>
          <div className="cb-section-subtitle">Required for customs and regulatory compliance</div>
        </div>
      </div>
      <div className="cb-section-body">
        {/* Invoice Section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cb-text)', marginBottom: 16 }}>Invoice Details</div>
          <div className="cb-form-grid cols-3">
            <Field label="Invoice Number">
              <input type="text" className="cb-input" placeholder="e.g. INV-2026-001" value={form.invoice_no} onChange={e => updateForm('invoice_no', e.target.value)} />
            </Field>
            <Field label="Invoice Date">
              <input type="date" className="cb-input" value={form.invoice_date} onChange={e => updateForm('invoice_date', e.target.value)} />
            </Field>
            <Field label="Currency">
              <select className="cb-input" value={form.invoice_currency} onChange={e => updateForm('invoice_currency', e.target.value)}>
                <option value="INR">INR — Indian Rupee</option>
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="AED">AED — UAE Dirham</option>
              </select>
            </Field>
          </div>
        </div>

        {/* GST Section */}
        <div style={{ marginBottom: 24, paddingTop: 20, borderTop: '1px solid var(--cb-border-light)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cb-text)', marginBottom: 16 }}>GST Information</div>
          <div className="cb-form-grid">
            <Field label="HS Code">
              <input type="text" className="cb-input" placeholder="e.g. 854231" value={form.hs_code} onChange={e => updateForm('hs_code', e.target.value)} />
            </Field>
            <Field label="Terms of Trade">
              <select className="cb-input" value={form.terms_of_trade} onChange={e => updateForm('terms_of_trade', e.target.value)}>
                <option value="CIF">CIF — Cost, Insurance & Freight</option>
                <option value="FOB">FOB — Free on Board</option>
                <option value="EXW">EXW — Ex Works</option>
                <option value="DAP">DAP — Delivered at Place</option>
                <option value="DDP">DDP — Delivered Duty Paid</option>
              </select>
            </Field>
            <Field label="GST Invoice">
              <select className="cb-input" value={form.gst_invoice} onChange={e => updateForm('gst_invoice', e.target.value)}>
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </Field>
            <Field label="LUT / IGST">
              <select className="cb-input" value={form.lut_igst} onChange={e => updateForm('lut_igst', e.target.value)}>
                <option value="N">Not Applicable</option>
                <option value="L">LUT</option>
                <option value="I">IGST</option>
              </select>
            </Field>
            <Field label="Total IGST">
              <input type="text" className="cb-input" placeholder="0.00" value={form.total_igst} onChange={e => updateForm('total_igst', e.target.value)} />
            </Field>
            <Field label="Exchange Rate">
              <input type="text" className="cb-input" placeholder="e.g. 83.50" value={form.exchange_rate} onChange={e => updateForm('exchange_rate', e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Bank Details */}
        <div style={{ paddingTop: 20, borderTop: '1px solid var(--cb-border-light)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cb-text)', marginBottom: 16 }}>Bank & Manifest Details</div>
          <div className="cb-form-grid cols-3">
            <Field label="Bank AD Code">
              <input type="text" className="cb-input" placeholder="AD Code" value={form.bank_ad_code} onChange={e => updateForm('bank_ad_code', e.target.value)} />
            </Field>
            <Field label="Bank Account">
              <input type="text" className="cb-input" placeholder="Account Number" value={form.bank_account} onChange={e => updateForm('bank_account', e.target.value)} />
            </Field>
            <Field label="Bank IFSC">
              <input type="text" className="cb-input" placeholder="IFSC Code" value={form.bank_ifsc} onChange={e => updateForm('bank_ifsc', e.target.value)} />
            </Field>
            <Field label="LUT Number">
              <input type="text" className="cb-input" placeholder="LUT No." value={form.lut_number} onChange={e => updateForm('lut_number', e.target.value)} />
            </Field>
            <Field label="Manifest Format">
              <select className="cb-input" value={form.manifest_format} onChange={e => updateForm('manifest_format', e.target.value)}>
                <option value="C2C">C2C</option>
                <option value="B2B">B2B</option>
                <option value="B2C">B2C</option>
              </select>
            </Field>
            <Field label="IEC Number">
              <input type="text" className="cb-input" placeholder="IEC No." value={form.manifest_iec_no} onChange={e => updateForm('manifest_iec_no', e.target.value)} />
            </Field>
          </div>
        </div>
      </div>
      <div className="cb-actions">
        <button className="cb-btn cb-btn-outline" onClick={onPrev}>{Icons.arrowLeft} Back</button>
        <button
          className="cb-btn cb-btn-success"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? <><div className="cb-spinner" /> Submitting...</> : <>{Icons.check} Submit Booking</>}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
//  REUSABLE COMPONENTS
// ═══════════════════════════════════════

function Field({ label, required, children }) {
  return (
    <div className="cb-field">
      <label className="cb-field-label">
        {label}
        {required && <span className="required">*</span>}
      </label>
      {children}
    </div>
  )
}

function CheckboxItem({ checked, onChange, label }) {
  return (
    <label className="cb-checkbox-item" onClick={() => onChange(!checked)}>
      <input type="checkbox" checked={checked} readOnly />
      <div className={`cb-checkbox-dot ${checked ? 'checked' : ''}`}>
        {Icons.check}
      </div>
      <span className="cb-checkbox-label">{label}</span>
    </label>
  )
}

function SummaryRow({ label, value, empty }) {
  return (
    <div className="cb-summary-row">
      <span className="cb-summary-label">{label}</span>
      <span className={`cb-summary-value ${empty ? 'empty' : ''}`}>{value}</span>
    </div>
  )
}
