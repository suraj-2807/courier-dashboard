import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCreateBooking, useSaveBooking, usePushBookingToApi } from '../hooks/useBookings'
import { getActiveVendors } from '../api/apiSettings.api'
import { bookingsApi } from '../api/bookings.api'
import { sendersApi } from '../api/senders.api'
import { receiversApi } from '../api/receivers.api'
import { countryCodesApi } from '../api/countryCodes.api'
import { systemSettingsApi } from '../api/systemSettings.api'
import CountryAutocompleteInput from '../components/CountryAutocompleteInput'
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
  Check,
  Send,
  Plus,
  Trash2,
  Receipt,
  Lock,
  Eye
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
  chargeable_weight: '',
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
  rate_per_kg: '',
  shipping_charge: '',
  extra_charge: '',
  final_chargeable_weight: '',
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
  const saveBookingMutation = useSaveBooking()
  const pushToApiMutation = usePushBookingToApi()
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  // Custom input mode toggles for vendor, service, and product codes
  const [customVendorMode, setCustomVendorMode] = useState(false)
  const [customServiceMode, setCustomServiceMode] = useState(false)
  const [customProductMode, setCustomProductMode] = useState(false)

  // Form collapse toggles
  const [showShipmentInvoice, setShowShipmentInvoice] = useState(true)

  // Bill-only fields (NOT sent to API)
  const [finalChargeableWeight, setFinalChargeableWeight] = useState('')
  const [extraCharge, setExtraCharge] = useState('')
  const finalShippingCharge = ((parseFloat(form.shipping_charge) || 0) + (parseFloat(extraCharge) || 0)).toFixed(2)

  // Ref for auto-focus on new invoice row
  const invoiceDescRefs = useRef([])

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
      if (typeof val === 'string' && !['quantity', 'unit_weight', 'cost', 'unit_rates', 'amount', 'unit_type'].includes(field)) {
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

  // Fetch active vendors for vendor API selection
  const { data: vendorsData } = useQuery({
    queryKey: ['active-vendors'],
    queryFn: getActiveVendors
  })
  const activeVendors = vendorsData?.vendors || []

  const { data: countryCodesData } = useQuery({
    queryKey: ['country-codes'],
    queryFn: () => countryCodesApi.getAll().then(res => res.data)
  })
  const countryList = countryCodesData?.countryCodes || []
  const countryLookupMap = countryCodesData?.lookupMap || {}

  // Senders for autocomplete
  const { data: sendersData } = useQuery({
    queryKey: ['senders'],
    queryFn: () => sendersApi.getAll().then(res => res.data)
  })
  const allSenders = sendersData?.senders || []
  const [senderSuggestionsOpen, setSenderSuggestionsOpen] = useState(false)
  const senderContainerRef = useRef(null)

  // Receivers for autocomplete
  const { data: receiversData } = useQuery({
    queryKey: ['receivers'],
    queryFn: () => receiversApi.getAll().then(res => res.data)
  })
  const allReceivers = receiversData?.receivers || []
  const [receiverSuggestionsOpen, setReceiverSuggestionsOpen] = useState(false)
  const receiverContainerRef = useRef(null)

  // Click outside listener to close autocomplete dropdowns
  useEffect(() => {
    function handleClickOutside(e) {
      if (senderContainerRef.current && !senderContainerRef.current.contains(e.target)) {
        setSenderSuggestionsOpen(false)
      }
      if (receiverContainerRef.current && !receiverContainerRef.current.contains(e.target)) {
        setReceiverSuggestionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtered Senders Autocomplete
  const filteredSenders = useMemo(() => {
    if (!form.sender_name || form.sender_name.trim().length < 1) return []
    const q = form.sender_name.toLowerCase().trim()
    return allSenders.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.company || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q) ||
      (s.city || '').toLowerCase().includes(q)
    ).slice(0, 8)
  }, [allSenders, form.sender_name])

  // Filtered Receivers Autocomplete
  const filteredReceivers = useMemo(() => {
    if (!form.receiver_name || form.receiver_name.trim().length < 1) return []
    const q = form.receiver_name.toLowerCase().trim()
    return allReceivers.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.company || '').toLowerCase().includes(q) ||
      (r.phone || '').includes(q) ||
      (r.city || '').toLowerCase().includes(q)
    ).slice(0, 8)
  }, [allReceivers, form.receiver_name])

  // Select Sender Handler
  const handleSelectSender = (sender) => {
    setForm(prev => ({
      ...prev,
      sender_name: sender.name || '',
      sender_company: sender.company || '',
      sender_phone: sender.phone || '',
      sender_email: sender.email || '',
      sender_address: sender.address || '',
      sender_address_2: sender.address_2 || '',
      sender_city: sender.city || '',
      sender_pincode: sender.pincode || '',
      sender_state: sender.state || '',
      sender_country: sender.country || 'INDIA',
      sender_gstin_type: sender.gstin_type || '',
      sender_gstin_no: sender.gstin_no || ''
    }))
    setSenderSuggestionsOpen(false)
    toast.success(`Autofilled details for sender "${sender.name}"!`)
  }

  // Select Receiver Handler
  const handleSelectReceiver = (receiver) => {
    setForm(prev => ({
      ...prev,
      receiver_name: receiver.name || '',
      receiver_company: receiver.company || '',
      receiver_phone: receiver.phone || '',
      receiver_email: receiver.email || '',
      receiver_address: receiver.address || '',
      receiver_address_2: receiver.address_2 || '',
      receiver_city: receiver.city || '',
      receiver_pincode: receiver.pincode || '',
      receiver_state: receiver.state || '',
      receiver_country: receiver.country || '',
      receiver_gstin_type: receiver.gstin_type || '',
      receiver_gstin_no: receiver.gstin_no || ''
    }))
    setReceiverSuggestionsOpen(false)
    toast.success(`Autofilled details for receiver "${receiver.name}"!`)
  }

  const resolveCountryCode = (val) => {
    if (!val) return ''
    const clean = val.trim().toUpperCase()
    if (countryLookupMap && countryLookupMap[clean]) {
      return countryLookupMap[clean]
    }
    // Standard fallbacks
    if (clean === 'USA' || clean === 'UNITED STATES' || clean === 'UNITED STATES OF AMERICA') return 'US'
    if (clean === 'INDIA' || clean === 'IND') return 'IN'
    if (clean === 'UK' || clean === 'UNITED KINGDOM' || clean === 'GREAT BRITAIN') return 'GB'
    if (clean === 'CANADA' || clean === 'CAN') return 'CA'
    if (clean === 'AUSTRALIA' || clean === 'AUS') return 'AU'
    if (clean === 'UAE' || clean === 'UNITED ARAB EMIRATES' || clean === 'DUBAI') return 'AE'
    return val
  }

  // Edit Mode or Pre-fill from URL params
  const { id: paramId } = useParams()
  const [searchParams] = useSearchParams()
  const editId = paramId || searchParams.get('edit') || searchParams.get('id')
  const fromRequestId = searchParams.get('from_request')
  const requestAwb = searchParams.get('request_awb')

  // Fetch existing booking when editing
  const { data: editBookingData, isLoading: loadingEditBooking } = useQuery({
    queryKey: ['booking-edit', editId],
    queryFn: async () => {
      const res = await bookingsApi.getById(editId)
      return res.data?.booking
    },
    enabled: !!editId
  })

  // Fetch System Settings (e.g. allow_post_push_billing_edit)
  const { data: sysSettingsData } = useQuery({
    queryKey: ['system-settings'],
    queryFn: systemSettingsApi.getAll
  })
  const allowPostPushEdit = sysSettingsData?.settings?.allow_post_push_billing_edit !== false

  const isLocked = !!editBookingData?.is_locked
  const isGeneralLocked = isLocked
  const isBillingLocked = isLocked && !allowPostPushEdit

  // Pre-fill form when editing an existing shipment
  useEffect(() => {
    if (!editBookingData) return
    const b = editBookingData
    const sender = b.senders || {}
    const receiver = b.receivers || {}

    setForm(prev => ({
      ...prev,
      id: b.id,
      sender_name: sender.name || b.sender_name || '',
      sender_company: b.sender_company || sender.company || '',
      sender_email: sender.email || b.sender_email || '',
      sender_phone: sender.phone || b.sender_phone || '',
      sender_address: sender.address || b.sender_address || '',
      sender_address_2: b.sender_address_2 || '',
      sender_city: sender.city || b.sender_city || '',
      sender_pincode: sender.pincode || b.sender_pincode || '',
      sender_state: sender.state || b.sender_state || '',
      sender_country: sender.country || b.sender_country || 'INDIA',
      sender_gstin_type: b.sender_gstin_type || '',
      sender_gstin_no: b.sender_gstin_no || '',

      receiver_name: receiver.name || b.receiver_name || '',
      receiver_company: b.receiver_company || receiver.company || '',
      receiver_email: receiver.email || b.receiver_email || '',
      receiver_phone: receiver.phone || b.receiver_phone || '',
      receiver_address: receiver.address || b.receiver_address || '',
      receiver_address_2: b.receiver_address_2 || '',
      receiver_city: receiver.city || b.receiver_city || '',
      receiver_pincode: receiver.pincode || b.receiver_pincode || '',
      receiver_state: receiver.state || b.receiver_state || '',
      receiver_country: receiver.country || b.receiver_country || '',
      receiver_gstin_type: b.receiver_gstin_type || '',
      receiver_gstin_no: b.receiver_gstin_no || '',

      courier_provider_id: b.courier_provider_id || '',
      vendor_config_id: b.vendor_config_id || '',
      vendor_code: b.vendor_code || '',
      service_code: b.service_code || '',
      product_code: b.product_code || '',

      package_type: b.package_type || 'parcel',
      weight: String(b.weight || ''),
      length: String(b.length || ''),
      breadth: String(b.breadth || ''),
      height: String(b.height || ''),
      no_of_pieces: String(b.no_of_pieces || '1'),
      volumetric_weight: String(b.volumetric_weight || ''),
      chargeable_weight: String(b.chargeable_weight || ''),
      actual_weight: String(b.weight || ''),
      content_description: b.content_description || '',
      declared_value: String(b.declared_value || ''),
      cod_amount: String(b.cod_amount || ''),
      is_fragile: !!b.is_fragile,

      invoice_type: b.invoice_type || 'INVOICE',
      invoice_currency: b.invoice_currency || 'INR',
      terms_of_trade: b.terms_of_trade || 'CIF',
      invoice_note: b.invoice_note || '',
      hs_code: b.hs_code || '',
      export_reason: b.export_reason || '',

      payment_mode: b.payment_mode || 'prepaid',
      rate_per_kg: String(b.rate_per_kg || ''),
      shipping_charge: String(b.shipping_charge || ''),
      extra_charge: String(b.extra_charge || ''),
      final_chargeable_weight: String(b.final_chargeable_weight || b.chargeable_weight || ''),
      order_reference: b.order_reference || '',
      remarks: b.remarks || ''
    }))

    if (b.final_chargeable_weight || b.chargeable_weight) {
      setFinalChargeableWeight(String(b.final_chargeable_weight || b.chargeable_weight))
    }
    if (b.extra_charge !== undefined && b.extra_charge !== null && b.extra_charge !== '') {
      setExtraCharge(String(b.extra_charge))
    }

    if (b.parcels) {
      try {
        const pList = typeof b.parcels === 'string' ? JSON.parse(b.parcels) : b.parcels
        if (Array.isArray(pList) && pList.length > 0) {
          setParcels(pList)
        } else {
          setParcels([{
            parcel_no: 1,
            box_no: '1',
            weight: String(b.weight || ''),
            length: String(b.length || ''),
            breadth: String(b.breadth || ''),
            height: String(b.height || ''),
            volumetric_weight: String(b.volumetric_weight || ''),
            chargeable_weight: String(b.chargeable_weight || '')
          }])
        }
      } catch (err) {}
    } else if (b.weight || b.length || b.breadth || b.height) {
      setParcels([{
        parcel_no: 1,
        box_no: '1',
        weight: String(b.weight || ''),
        length: String(b.length || ''),
        breadth: String(b.breadth || ''),
        height: String(b.height || ''),
        volumetric_weight: String(b.volumetric_weight || ''),
        chargeable_weight: String(b.chargeable_weight || '')
      }])
    }

    if (b.invoice_items) {
      const items = typeof b.invoice_items === 'string' ? JSON.parse(b.invoice_items) : b.invoice_items
      if (Array.isArray(items) && items.length > 0) {
        setInvoiceItems(items)
      }
    }
  }, [editBookingData])

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
  const isPacificVendor = selectedVendor?.name?.toLowerCase().includes('pacific') || selectedVendor?.vendor_code?.toLowerCase()?.includes('pacific')
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
      // Round up ONLY chargeable weight (ceil max of actual & vol)
      const maxWeight = Math.max(act, vol)
      const chg = maxWeight > 0 ? Math.ceil(maxWeight) : 0

      item.volumetric_weight = vol > 0 ? String(vol) : ''
      item.chargeable_weight = chg > 0 ? String(chg) : ''
      updated[index] = item
      return updated
    })
  }

  // Calculate totals from parcels array (exact actual and vol weight, rounded chargeable)
  const totalParcelActual = Math.round(parcels.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0) * 1000) / 1000
  const totalParcelVol = Math.round(parcels.reduce((sum, p) => sum + (parseFloat(p.volumetric_weight) || 0), 0) * 100) / 100
  const totalParcelChg = parcels.reduce((sum, p) => sum + (parseFloat(p.chargeable_weight) || Math.ceil(Math.max(parseFloat(p.weight) || 0, parseFloat(p.volumetric_weight) || 0))), 0)

  // Keep main form summary fields synced with per-parcel totals and recalculate shipping charges if rate_per_kg is set
  useEffect(() => {
    if (parcels.length > 1) {
      setForm(prev => {
        const chgWt = totalParcelChg > 0 ? String(totalParcelChg) : ''
        const rate = parseFloat(prev.rate_per_kg) || 0
        const chgNum = parseFloat(chgWt) || (totalParcelActual > 0 ? Math.ceil(totalParcelActual) : 0)
        const updatedShipping = (rate > 0 && chgNum > 0)
          ? (rate * chgNum).toFixed(2)
          : prev.shipping_charge

        return {
          ...prev,
          weight: totalParcelActual > 0 ? String(totalParcelActual) : prev.weight,
          volumetric_weight: totalParcelVol > 0 ? String(totalParcelVol) : '',
          chargeable_weight: chgWt,
          shipping_charge: updatedShipping
        }
      })
    } else {
      const l = parseFloat(form.length) || parseFloat(parcels[0]?.length) || 0
      const b = parseFloat(form.breadth) || parseFloat(parcels[0]?.breadth) || 0
      const h = parseFloat(form.height) || parseFloat(parcels[0]?.height) || 0
      const act = parseFloat(form.weight) || parseFloat(parcels[0]?.weight) || 0

      let vol = 0
      if (l > 0 && b > 0 && h > 0) {
        vol = Math.round(((l * b * h) / 5000) * 100) / 100
      }
      const maxWeight = Math.max(act, vol)
      const chg = maxWeight > 0 ? Math.ceil(maxWeight) : 0

      setForm(prev => {
        const rate = parseFloat(prev.rate_per_kg) || 0
        const chgNum = chg > 0 ? chg : (act > 0 ? Math.ceil(act) : 0)
        const updatedShipping = (rate > 0 && chgNum > 0)
          ? (rate * chgNum).toFixed(2)
          : prev.shipping_charge

        return {
          ...prev,
          weight: act > 0 ? String(act) : prev.weight,
          volumetric_weight: vol > 0 ? String(vol) : '',
          chargeable_weight: chg > 0 ? String(chg) : '',
          shipping_charge: updatedShipping
        }
      })
    }
  }, [parcels, form.length, form.breadth, form.height, form.weight, form.no_of_pieces])

  // Auto-sync final chargeable weight from computed chargeable weight
  useEffect(() => {
    if (!editId && form.chargeable_weight) {
      setFinalChargeableWeight(form.chargeable_weight)
    }
  }, [form.chargeable_weight, editId])

  // Sync total_amount and declared_value with invoice total
  useEffect(() => {
    if (invoiceTotalAmount > 0) {
      setForm(prev => ({
        ...prev,
        total_amount: String(invoiceTotalAmount.toFixed(2)),
        declared_value: String(invoiceTotalAmount.toFixed(2))
      }))
    }
  }, [invoiceTotalAmount])

  const NO_AUTO_UPPERCASE_FIELDS = [
    'sender_email',
    'receiver_email',
    'buyer_email',
    'package_type',
    'sender_gstin_type',
    'receiver_gstin_type',
    'payment_mode',
    'vendor_config_id',
    'service_code',
    'product_code',
    'terms_of_trade',
    'invoice_currency',
    'invoice_type',
    'csb_type',
    'export_reason',
    'company_code'
  ]

  const updateForm = (field, value) => {
    let val = value
    if (typeof val === 'string' && !NO_AUTO_UPPERCASE_FIELDS.includes(field) && !field.toLowerCase().includes('email')) {
      val = val.toUpperCase()
    }
    setForm(prev => ({ ...prev, [field]: val }))
  }

  // Build the common payload used by both save and push
  const buildPayload = () => {
    const decVal = parseFloat(form.declared_value) || invoiceTotalAmount || 0
    const shipCharge = parseFloat(form.shipping_charge) || 0
    const totAmount = decVal || shipCharge || 0

    return {
    id: editId ? parseInt(editId) : undefined,
    sender_name: form.sender_name || form.sender_company,
    sender_company: form.sender_company,
    sender_email: form.sender_email,
    sender_phone: form.sender_phone,
    sender_address: form.sender_address,
    sender_address_2: form.sender_address_2,
    sender_city: form.sender_city,
    sender_pincode: form.sender_pincode,
    sender_state: form.sender_state,
    sender_country: resolveCountryCode(form.sender_country) || 'IN',
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
    receiver_country: resolveCountryCode(form.receiver_country),
    receiver_gstin_type: form.receiver_gstin_type,
    receiver_gstin_no: form.receiver_gstin_no,

    weight: (parcels.length > 1 && totalParcelActual > 0) ? String(totalParcelActual) : String(parseFloat(form.weight) || (parcels[0] ? parseFloat(parcels[0].weight) : 0) || 0),
    chargeable_weight: (parcels.length > 1 && totalParcelChg > 0) ? totalParcelChg : (parseFloat(form.chargeable_weight) ? Math.ceil(parseFloat(form.chargeable_weight)) : 0),
    length: parseFloat(form.length) || (parcels[0] ? parseFloat(parcels[0].length) : 0) || 0,
    breadth: parseFloat(form.breadth) || (parcels[0] ? parseFloat(parcels[0].breadth) : 0) || 0,
    height: parseFloat(form.height) || (parcels[0] ? parseFloat(parcels[0].height) : 0) || 0,
    no_of_pieces: Math.max(parcels.length, parseInt(form.no_of_pieces) || 1),
    content_description: (form.content_description && form.content_description !== 'General Goods' && form.content_description !== 'ITEMS / GOODS INSIDE')
      ? form.content_description
      : (invoiceItems.map(i => i.description).filter(Boolean).join(', ') || form.content_description || 'Books'),
    declared_value: decVal,
    package_type: form.package_type,
    payment_mode: form.payment_mode,
    rate_per_kg: parseFloat(form.rate_per_kg) || 0,
    shipping_charge: shipCharge,
    extra_charge: parseFloat(extraCharge) || 0,
    final_chargeable_weight: parseFloat(finalChargeableWeight) ? Math.ceil(parseFloat(finalChargeableWeight)) : (parcels.length > 1 && totalParcelChg > 0 ? totalParcelChg : (parseFloat(form.chargeable_weight) ? Math.ceil(parseFloat(form.chargeable_weight)) : 0)),
    total_amount: totAmount,
    order_reference: form.order_reference,
    remarks: form.remarks,

    vendor_config_id: form.vendor_config_id || null,
    vendor_code: form.vendor_code || '',
    service_code: form.service_code || '',
    product_code: form.product_code || '',
    cod_amount: parseFloat(form.cod_amount) || 0,

    // Invoice & export
    invoice_no: form.invoice_no,
    invoice_date: form.invoice_date,
    invoice_currency: form.invoice_currency,
    hs_code: form.hs_code,
    export_reason: form.export_reason || form.invoice_note || '',
    terms_of_trade: form.terms_of_trade,
    invoice_type: form.invoice_type || 'INVOICE',
    invoice_note: form.invoice_note || '',
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
      const maxWeight = Math.max(act, vol)
      const chg = maxWeight > 0 ? Math.ceil(maxWeight) : 0

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
    invoice_items: invoiceItems.filter(item => item.description || parseFloat(item.quantity) > 0 || parseFloat(item.amount) > 0),

    eawb_no: form.eawb_no,
    eawb_date: form.eawb_date,
    eawb_exp_date: form.eawb_exp_date,
    additional_discount: form.additional_discount,
    additional_freight: form.additional_freight,
    additional_insurance: form.additional_insurance,
    additional_other_charges: form.additional_other_charges,
    additional_specify_charges: form.additional_specify_charges,

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

    company_code: form.company_code,
    is_commercial: form.is_commercial,
    csb_type: form.csb_type,
    otp: form.otp,
    lsp_type: form.lsp_type,
    required_performa: form.required_performa,
    required_label: form.required_label,

    from_request: fromRequestId || undefined,
    request_awb: requestAwb || undefined
  }
  }

  const validateForm = () => {
    if (!form.sender_name && !form.sender_company) {
      toast.error('Sender Name or Company is required')
      return false
    }
    if (!form.sender_phone) {
      toast.error('Sender Phone is required')
      return false
    }
    if (!form.receiver_name && !form.receiver_company) {
      toast.error('Receiver Name or Company is required')
      return false
    }
    if (!form.receiver_phone) {
      toast.error('Receiver Phone is required')
      return false
    }
    if (!form.receiver_address) {
      toast.error('Receiver Address Line 1 is required')
      return false
    }
    if (!form.receiver_city) {
      toast.error('Receiver City is required')
      return false
    }
    if (!form.receiver_country) {
      toast.error('Receiver Country is required')
      return false
    }
    if (!form.weight || parseFloat(form.weight) <= 0) {
      toast.error('Please enter the shipment weight')
      return false
    }
    if (form.sender_gstin_type && /aadhaar|aadhar/i.test(form.sender_gstin_type)) {
      const cleanAadhaar = (form.sender_gstin_no || '').replace(/\D/g, '')
      if (cleanAadhaar.length !== 12) {
        toast.error('Aadhaar number must be exactly 12 digits')
        return false
      }
    }
    if (form.receiver_gstin_type && /aadhaar|aadhar/i.test(form.receiver_gstin_type)) {
      const cleanAadhaar = (form.receiver_gstin_no || '').replace(/\D/g, '')
      if (cleanAadhaar.length !== 12) {
        toast.error('Receiver Aadhaar number must be exactly 12 digits')
        return false
      }
    }
    return true
  }

  // SAVE BOOKING — draft, no vendor API push
  const handleSaveBooking = async () => {
    if (!validateForm()) return

    setSavingDraft(true)
    try {
      const result = await saveBookingMutation.mutateAsync(buildPayload())
      const awb = result?.awb_number || result?.booking?.tracking_number || 'N/A'
      toast.success(`Booking saved as draft! AWB: ${awb}`)
      navigate('/bookings')
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to save booking')
    } finally {
      setSavingDraft(false)
    }
  }

  // SAVE BILLING CHARGES ONLY (For locked/dispatched shipments)
  const handleSaveBillingLocked = async () => {
    const finalChg = parseFloat(finalChargeableWeight) || parseFloat(form.chargeable_weight) || parseFloat(form.weight) || 0
    const rate = parseFloat(form.rate_per_kg) || 0
    const ship = parseFloat(form.shipping_charge) || 0
    const extra = parseFloat(extraCharge) || 0
    const total = parseFloat((ship + extra).toFixed(2))

    setSavingDraft(true)
    try {
      await bookingsApi.updateBilling(editId, {
        final_chargeable_weight: finalChg,
        rate_per_kg: rate,
        shipping_charge: ship,
        extra_charge: extra,
        total_amount: total
      })
      toast.success('Billing charges updated & synced to remote AWBENTRY!')
      navigate('/bookings')
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to update billing details')
    } finally {
      setSavingDraft(false)
    }
  }

  // PUSH TO API — saves + pushes to vendor API in one step, locks the booking
  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!validateForm()) return

    if (!form.vendor_config_id) {
      toast.error('Please select a Vendor API to push to')
      return
    }

    setSubmitting(true)
    try {
      const result = await createBooking.mutateAsync(buildPayload())

      const ourAwb = result?.booking?.tracking_number || 'N/A'
      const vendorAwb = result?.vendor_result?.awbNumber || 'N/A'
      const vendorPushed = result?.vendor_result?.success

      toast.success(
        vendorPushed
          ? `Booking created & pushed! Our AWB: ${ourAwb} | Vendor AWB: ${vendorAwb}`
          : `Booking created! Our AWB: ${ourAwb}`
      )
      navigate('/bookings')
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-in w-full space-y-6 pb-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface p-5 rounded-2xl border border-border shadow-xs">
        <div className="flex items-center gap-3.5">
          <Link
            to="/bookings"
            className="p-2 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-[22px] font-extrabold text-navy tracking-tight flex items-center gap-2 flex-wrap">
              {isLocked ? (
                <>
                  <span>View Booking (AWB: {editBookingData?.tracking_number || editId})</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-amber-500/15 text-amber-800 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    <Lock className="w-3 h-3 text-amber-700" /> Locked / Dispatched
                  </span>
                </>
              ) : editId ? (
                `Edit Booking (AWB: ${editBookingData?.tracking_number || editId})`
              ) : (
                'Create New Booking'
              )}
            </h1>
            <p className="text-[12px] text-text-secondary mt-0.5">
              {isLocked
                ? 'This shipment was dispatched and pushed to the carrier API. All details are open in read-only mode for review.'
                : editId
                ? 'Update shipment details or select vendor API to dispatch'
                : 'Single-page docket creation with auto vendor API dispatch'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLocked ? (
            <Link
              to={`/bookings/${editId}`}
              className="bg-navy hover:bg-navy-light text-white text-[12px] font-bold px-3.5 py-1.5 rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              Tracking & Documents
            </Link>
          ) : (
            <span className="bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Single Page Form
            </span>
          )}
        </div>
      </div>

      {/* ── Locked Shipment Notice Banner ── */}
      {isLocked && (
        <div className={`rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
          allowPostPushEdit
            ? 'bg-emerald-500/10 border border-emerald-500/25'
            : 'bg-amber-500/10 border border-amber-500/25'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              allowPostPushEdit ? 'bg-emerald-500/20 text-emerald-700' : 'bg-amber-500/20 text-amber-700'
            }`}>
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-navy">
                {allowPostPushEdit ? 'Shipment is Locked (API Pushed) — Post-Push Billing Edit Mode' : 'Shipment is Locked (API Pushed)'}
              </h4>
              <p className="text-xs text-text-secondary mt-0.5">
                {allowPostPushEdit
                  ? 'Shipper, Consignee, and Package details are locked to protect carrier records. You can modify Final Chargeable Wt, Rate/Kg, Shipping Charge, Extra Charge, and Final Shipping below. Click "Save Billing Changes" to save and sync with remote AWBENTRY.'
                  : 'All inputs are disabled to protect dispatched carrier data. Admin can inspect all shipper, consignee, package, charges, and invoice details.'}
              </p>
            </div>
          </div>
          <span className={`text-xs font-extrabold uppercase px-3 py-1 text-white rounded-full tracking-wider shadow-xs self-start sm:self-center ${
            allowPostPushEdit ? 'bg-emerald-600' : 'bg-amber-500'
          }`}>
            {allowPostPushEdit ? 'Billing Editable' : 'Read-Only'}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Main 3 Columns Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Column 1: Sender / Shipper Details ── */}
          <fieldset disabled={isGeneralLocked} className="contents">
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs flex flex-col justify-between">
            <div>
              <RedBadge title="Shipper Details" icon={User} />

              <div className="space-y-2.5">
                <div ref={senderContainerRef} className="relative">
                  <CompactField label="Sender Full Name" required>
                    <input
                      type="text"
                      placeholder="Type name to autofill or enter new..."
                      value={form.sender_name}
                      onFocus={() => { if (filteredSenders.length > 0) setSenderSuggestionsOpen(true) }}
                      onChange={e => {
                        updateForm('sender_name', e.target.value)
                        setSenderSuggestionsOpen(true)
                      }}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-navy font-semibold"
                    />
                  </CompactField>

                  {/* Sender Autocomplete Dropdown */}
                  {senderSuggestionsOpen && filteredSenders.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-border animate-fade-in">
                      <div className="px-3 py-1.5 bg-red-50/70 text-[10px] font-extrabold text-primary uppercase tracking-wider flex items-center justify-between sticky top-0 backdrop-blur-xs">
                        <span>Saved Senders (Click to Autofill)</span>
                        <span className="text-[9px] text-text-tertiary">{filteredSenders.length} found</span>
                      </div>
                      {filteredSenders.map((s) => (
                        <div
                          key={s.id}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleSelectSender(s)
                          }}
                          className="px-3 py-2.5 hover:bg-surface-alt cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-extrabold text-[13px] text-navy truncate">
                              {s.name}
                            </div>
                            {s.company && (
                              <span className="text-[10px] uppercase font-bold text-text-tertiary px-1.5 py-0.5 bg-surface-alt rounded border border-border-light shrink-0">
                                {s.company}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-text-secondary flex-wrap">
                            {s.phone && <span className="font-mono text-emerald-700 font-bold">{s.phone}</span>}
                            {s.phone && (s.city || s.state) && <span>•</span>}
                            {(s.city || s.state) && <span>{[s.city, s.state].filter(Boolean).join(', ')}</span>}
                            {s.gstin_no && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] text-text-tertiary bg-gray-100 px-1 rounded">
                                  {s.gstin_type || 'Doc'}: {s.gstin_no}
                                </span>
                              </>
                            )}
                          </div>
                          {s.address && (
                            <div className="text-[10px] text-text-tertiary truncate mt-0.5">
                              {s.address}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <CompactField label="Company Name">
                  <input
                    type="text"
                    placeholder="Sender Company Name"
                    value={form.sender_company}
                    onChange={e => updateForm('sender_company', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 uppercase"
                  />
                </CompactField>

                <CompactField label="Address Line 1" required>
                  <input
                    type="text"
                    placeholder="Flat / Building / Street"
                    value={form.sender_address}
                    onChange={e => updateForm('sender_address', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800"
                  />
                </CompactField>

                <CompactField label="Address Line 2">
                  <input
                    type="text"
                    placeholder="Area / Landmark"
                    value={form.sender_address_2}
                    onChange={e => updateForm('sender_address_2', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800"
                  />
                </CompactField>

                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="City" required>
                    <input
                      type="text"
                      placeholder="City"
                      value={form.sender_city}
                      onChange={e => updateForm('sender_city', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800"
                    />
                  </CompactField>
                  <CompactField label="Pincode" required>
                    <input
                      type="text"
                      placeholder="Pincode"
                      value={form.sender_pincode}
                      onChange={e => updateForm('sender_pincode', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-mono"
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
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 uppercase"
                    />
                  </CompactField>
                  <CompactField label="Country">
                    <CountryAutocompleteInput
                      value={form.sender_country}
                      onChange={val => updateForm('sender_country', val)}
                      placeholder="Search Country (e.g. India, USA)"
                      className="w-full bg-transparent focus:outline-none text-[13px] text-primary font-bold uppercase pr-6"
                      countryList={countryList}
                    />
                  </CompactField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactField label="Phone / Mobile Number" required>
                    <input
                      type="tel"
                      placeholder="+91 99999 99999"
                      value={form.sender_phone}
                      onChange={e => updateForm('sender_phone', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-mono"
                    />
                  </CompactField>
                  <CompactField label="Email Address">
                    <input
                      type="email"
                      placeholder="sender@example.com"
                      value={form.sender_email}
                      onChange={e => updateForm('sender_email', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800"
                    />
                  </CompactField>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Doc Type">
                    <select
                      value={form.sender_gstin_type}
                      onChange={e => updateForm('sender_gstin_type', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 cursor-pointer"
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
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-mono"
                    />
                  </CompactField>
                </div>
              </div>
            </div>
          </div>
          </fieldset>

          {/* ── Column 2: Receiver / Consignee Details ── */}
          <fieldset disabled={isGeneralLocked} className="contents">
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs flex flex-col justify-between">
            <div>
              <RedBadge title="Consignee Details" icon={MapPin} />

              <div className="space-y-2.5">
                <div ref={receiverContainerRef} className="relative">
                  <CompactField label="Receiver Full Name" required highlight={!form.receiver_name && !form.receiver_company}>
                    <input
                      type="text"
                      placeholder="Type name to autofill or enter new..."
                      value={form.receiver_name}
                      onFocus={() => { if (filteredReceivers.length > 0) setReceiverSuggestionsOpen(true) }}
                      onChange={e => {
                        updateForm('receiver_name', e.target.value)
                        setReceiverSuggestionsOpen(true)
                      }}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-semibold"
                    />
                  </CompactField>

                  {/* Receiver Autocomplete Dropdown */}
                  {receiverSuggestionsOpen && filteredReceivers.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-border animate-fade-in">
                      <div className="px-3 py-1.5 bg-emerald-50/70 text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center justify-between sticky top-0 backdrop-blur-xs">
                        <span>Saved Receivers (Click to Autofill)</span>
                        <span className="text-[9px] text-text-tertiary">{filteredReceivers.length} found</span>
                      </div>
                      {filteredReceivers.map((r) => (
                        <div
                          key={r.id}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleSelectReceiver(r)
                          }}
                          className="px-3 py-2.5 hover:bg-surface-alt cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-extrabold text-[13px] text-navy truncate">
                              {r.name}
                            </div>
                            {r.company && (
                              <span className="text-[10px] uppercase font-bold text-text-tertiary px-1.5 py-0.5 bg-surface-alt rounded border border-border-light shrink-0">
                                {r.company}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-text-secondary flex-wrap">
                            {r.phone && <span className="font-mono text-emerald-700 font-bold">{r.phone}</span>}
                            {r.phone && (r.city || r.country) && <span>•</span>}
                            {(r.city || r.country) && (
                              <span>{[r.city, r.state, r.country].filter(Boolean).join(', ')}</span>
                            )}
                            {r.gstin_no && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] text-text-tertiary bg-gray-100 px-1 rounded">
                                  {r.gstin_type || 'Doc'}: {r.gstin_no}
                                </span>
                              </>
                            )}
                          </div>
                          {r.address && (
                            <div className="text-[10px] text-text-tertiary truncate mt-0.5">
                              {r.address}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <CompactField label="Company Name">
                  <input
                    type="text"
                    placeholder="Receiver Company Name"
                    value={form.receiver_company}
                    onChange={e => updateForm('receiver_company', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 uppercase"
                  />
                </CompactField>

                <CompactField label="Address Line 1" required highlight={!form.receiver_address}>
                  <input
                    type="text"
                    placeholder="Street / House No."
                    value={form.receiver_address}
                    onChange={e => updateForm('receiver_address', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800"
                  />
                </CompactField>

                <CompactField label="Address Line 2">
                  <input
                    type="text"
                    placeholder="Apt / Suite / Area"
                    value={form.receiver_address_2}
                    onChange={e => updateForm('receiver_address_2', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800"
                  />
                </CompactField>

                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="City" required highlight={!form.receiver_city}>
                    <input
                      type="text"
                      placeholder="City"
                      value={form.receiver_city}
                      onChange={e => updateForm('receiver_city', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800"
                    />
                  </CompactField>
                  <CompactField label="Pincode" required>
                    <input
                      type="text"
                      placeholder="Zip / Pincode"
                      value={form.receiver_pincode}
                      onChange={e => updateForm('receiver_pincode', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-mono"
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
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 uppercase"
                    />
                  </CompactField>
                  <CompactField label="Country" required highlight={!form.receiver_country}>
                    <CountryAutocompleteInput
                      value={form.receiver_country}
                      onChange={val => updateForm('receiver_country', val)}
                      placeholder="Search Country (e.g. USA, UK)"
                      className="w-full bg-transparent focus:outline-none text-[13px] text-primary font-bold uppercase pr-6 placeholder-red-300"
                      countryList={countryList}
                    />
                  </CompactField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CompactField label="Phone / Mobile Number" required highlight={!form.receiver_phone}>
                    <input
                      type="tel"
                      placeholder="+1 999 999 9999"
                      value={form.receiver_phone}
                      onChange={e => updateForm('receiver_phone', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-mono"
                    />
                  </CompactField>
                  <CompactField label="Email Address">
                    <input
                      type="email"
                      placeholder="receiver@example.com"
                      value={form.receiver_email}
                      onChange={e => updateForm('receiver_email', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800"
                    />
                  </CompactField>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <CompactField label="Doc Type">
                    <select
                      value={form.receiver_gstin_type}
                      onChange={e => updateForm('receiver_gstin_type', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 cursor-pointer"
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
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-mono"
                    />
                  </CompactField>
                </div>
              </div>
            </div>
          </div>
          </fieldset>

          {/* ── Column 3: Courier & Vendor API Details ── */}
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs flex flex-col justify-between">
            <div>
              <RedBadge title="Courier & Vendor API" icon={Plug} />

              <div className="space-y-2.5">
                <fieldset disabled={isGeneralLocked} className="contents">
                {/* Vendor API Config Selection */}
                <CompactField label="Courier Vendor API">
                  <select
                    value={form.vendor_config_id}
                    disabled={isLocked || (!!editId && !!form.vendor_config_id)}
                    onChange={e => {
                      const newId = e.target.value
                      updateForm('vendor_config_id', newId)
                      const newVendor = activeVendors.find(v => String(v.id) === String(newId))
                      const isPacific = newVendor?.name?.toLowerCase().includes('pacific') || newVendor?.vendor_code?.toLowerCase()?.includes('pacific')
                      updateForm('vendor_code', isPacific ? 'PC' : (newVendor?.vendor_code || ''))
                      
                      let defService = ''
                      const services = Array.isArray(newVendor?.available_services) ? newVendor.available_services : []
                      if (services.length > 0) {
                        defService = services[0].code || services[0].id || services[0].service || ''
                      }
                      updateForm('service_code', defService)

                      let defProduct = ''
                      const products = Array.isArray(newVendor?.available_product_codes) ? newVendor.available_product_codes : []
                      if (products.length > 0) {
                        defProduct = products[0].code || products[0].id || products[0].product || ''
                      }
                      updateForm('product_code', defProduct)

                      setCustomVendorMode(false)
                      setCustomServiceMode(false)
                      setCustomProductMode(false)
                    }}
                    className={`w-full bg-transparent focus:outline-none text-[13px] text-primary font-bold cursor-pointer ${(isLocked || (!!editId && !!form.vendor_config_id)) ? 'cursor-not-allowed text-gray-500 opacity-75' : ''}`}
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
                    {/* Vendor Code — Only shown for Pacific, disabled with default value 'PC' */}
                    {isPacificVendor && (
                      <CompactField label="Vendor Code">
                        <input
                          type="text"
                          value="PC"
                          disabled
                          readOnly
                          className="w-full bg-gray-100/80 text-gray-500 text-[13px] font-bold cursor-not-allowed border border-gray-200 rounded px-2.5 py-1 select-none"
                        />
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
                              className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 uppercase"
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
                            className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 cursor-pointer font-bold"
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
                            className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 uppercase"
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
                              className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 uppercase"
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
                            className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 cursor-pointer font-bold"
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
                            className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 cursor-pointer font-bold"
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
                            className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 uppercase"
                          />
                        )}
                      </CompactField>
                    )}
                  </>
                )}
                </fieldset>

                {/* Payment Mode & Charges — Editable even when shipment is locked if allowPostPushEdit is enabled */}
                <fieldset disabled={isBillingLocked} className="contents">
                <div className="space-y-2">
                  <CompactField label="Payment Mode">
                    <select
                      value={form.payment_mode}
                      onChange={e => updateForm('payment_mode', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-bold cursor-pointer"
                    >
                      <option value="prepaid">Prepaid</option>
                      <option value="cod">COD</option>
                      <option value="credit">Account Credit</option>
                    </select>
                  </CompactField>

                  {/* Final Chargeable Weight — editable override, for bill/invoice only */}
                  <CompactField label="Final Chargeable Wt (kg)">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={finalChargeableWeight}
                      onChange={e => {
                        const val = e.target.value
                        setFinalChargeableWeight(val)
                        // Recalculate shipping charge using rate_per_kg
                        const rate = parseFloat(form.rate_per_kg) || 0
                        if (rate > 0 && parseFloat(val) > 0) {
                          setForm(prev => ({
                            ...prev,
                            shipping_charge: String((rate * parseFloat(val)).toFixed(2))
                          }))
                        }
                      }}
                      className="w-full bg-transparent focus:outline-none text-[13px] font-bold text-navy text-right"
                    />
                  </CompactField>

                  <div className="grid grid-cols-2 gap-2">
                    <CompactField label="Rate / Kg (₹)">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.rate_per_kg || ''}
                        onChange={e => {
                          const rateVal = e.target.value
                          const chgWt = parseFloat(finalChargeableWeight) || parseFloat(form.chargeable_weight) || parseFloat(form.weight) || 0
                          const calcTotal = (parseFloat(rateVal) > 0 && chgWt > 0)
                            ? String((parseFloat(rateVal) * chgWt).toFixed(2))
                            : form.shipping_charge
                          setForm(prev => ({
                            ...prev,
                            rate_per_kg: rateVal,
                            shipping_charge: calcTotal
                          }))
                        }}
                        className="w-full bg-transparent focus:outline-none text-[13px] font-semibold text-right text-gray-800"
                      />
                    </CompactField>

                    <CompactField label="Shipping Charge (₹)">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.shipping_charge || ''}
                        onChange={e => {
                          const val = e.target.value
                          const chgWt = parseFloat(finalChargeableWeight) || parseFloat(form.chargeable_weight) || parseFloat(form.weight) || 0
                          const calcRate = (parseFloat(val) > 0 && chgWt > 0)
                            ? String((parseFloat(val) / chgWt).toFixed(2))
                            : form.rate_per_kg
                          setForm(prev => ({
                            ...prev,
                            shipping_charge: val,
                            rate_per_kg: calcRate
                          }))
                        }}
                        className="w-full bg-transparent focus:outline-none text-[13px] font-bold text-primary text-right"
                      />
                    </CompactField>
                  </div>

                  {/* Extra Charge & Final Shipping Charge — bill/invoice only, NOT sent to API */}
                  <div className="grid grid-cols-2 gap-2">
                    <CompactField label="Extra Charge (₹)">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={extraCharge}
                        onChange={e => setExtraCharge(e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-[13px] font-semibold text-right text-gray-800"
                      />
                    </CompactField>
                    <CompactField label="Final Shipping (₹)">
                      <input
                        type="text"
                        readOnly
                        value={finalShippingCharge}
                        className="w-full bg-transparent focus:outline-none text-[13px] font-extrabold text-primary text-right cursor-default"
                      />
                    </CompactField>
                  </div>
                </div>
                </fieldset>

                <fieldset disabled={isGeneralLocked} className="contents">

                {form.payment_mode === 'cod' && (
                  <CompactField label="COD Amount (₹)" required>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.cod_amount}
                      onChange={e => updateForm('cod_amount', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-primary font-bold text-right"
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
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-mono"
                    />
                  </CompactField>
                  <CompactField label="Remarks">
                    <input
                      type="text"
                      placeholder="Handling instructions"
                      value={form.remarks}
                      onChange={e => updateForm('remarks', e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800"
                    />
                  </CompactField>
                </div>
                </fieldset>
              </div>
            </div>
          </div>

        </div>

        {/* ── Main Section 2: Package & Weight Specs & Commercial Invoice ── */}
        <fieldset disabled={isGeneralLocked} className="contents">
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs">
          <RedBadge title="Package & Weight Specifications" icon={Package} />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 mb-4">
            <CompactField label="Package Type">
              <select
                value={form.package_type}
                onChange={e => updateForm('package_type', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-bold cursor-pointer"
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
                className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-bold text-center"
              />
            </CompactField>

            <CompactField label="Declared Value (₹)">
              <input
                type="number"
                placeholder="Declared value"
                value={form.declared_value}
                onChange={e => updateForm('declared_value', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800 font-semibold"
              />
            </CompactField>

            <CompactField label="Content Description">
              <input
                type="text"
                placeholder="Items / Goods inside"
                value={form.content_description}
                onChange={e => updateForm('content_description', e.target.value)}
                className="w-full bg-transparent focus:outline-none text-[13px] text-gray-800"
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
                  type="text"
                  readOnly
                  value={form.weight || '0.00'}
                  className="w-full bg-transparent focus:outline-none text-[14px] text-navy font-bold cursor-default"
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
                        ref={el => invoiceDescRefs.current[idx] = el}
                        className="w-full bg-transparent focus:outline-none text-[13px] text-navy font-medium" />
                    </div>
                    <div className="px-1">
                      <input type="text" placeholder="" value={item.hs_code} onChange={e => updateInvoiceItem(idx, 'hs_code', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-mono text-center text-text-primary" />
                    </div>
                    <div className="px-1">
                      <select
                        value={item.unit_type || 'PCS'}
                        onChange={e => updateInvoiceItem(idx, 'unit_type', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs font-semibold cursor-pointer text-text-primary"
                      >
                        <option value="">Select...</option>
                        <option value="Pkt">Pkt</option>
                        <option value="Pc">Pc</option>
                        <option value="PCS">PCS</option>
                        <option value="Nos">Nos</option>
                        <option value="Bottle">Bottle</option>
                        <option value="Pair">Pair</option>
                        <option value="Strip">Strip</option>
                        <option value="Dozen">Dozen</option>
                        <option value="Gross">Gross</option>
                        <option value="Sets">Sets</option>
                        <option value="Box">Box</option>
                        <option value="KG">KG</option>
                        <option value="Gram">Gram</option>
                        <option value="Container">Container</option>
                        <option value="Carats">Carats</option>
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
                        className="w-full bg-transparent focus:outline-none text-xs text-right font-extrabold text-primary"
                        onKeyDown={e => {
                          if (e.key === 'Tab' && !e.shiftKey && idx === invoiceItems.length - 1) {
                            e.preventDefault()
                            addInvoiceItem()
                            setTimeout(() => {
                              const newRef = invoiceDescRefs.current[idx + 1]
                              if (newRef) newRef.focus()
                            }, 50)
                          }
                        }}
                      />
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
        </fieldset>

        {/* ── Footer Submit Bar ── */}
        <div className="bg-surface rounded-2xl border border-border p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/bookings')}
            className="px-4 py-2.5 rounded-xl border border-border bg-surface text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            {isLocked ? 'Back' : 'Cancel'}
          </button>

          <div className="flex items-center gap-3">
            {isLocked ? (
              <div className="flex items-center gap-3 flex-wrap">
                {allowPostPushEdit && (
                  <button
                    type="button"
                    onClick={handleSaveBillingLocked}
                    disabled={savingDraft || submitting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {savingDraft ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving & Syncing...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Billing Changes
                      </>
                    )}
                  </button>
                )}
                <Link
                  to={`/bookings/${editId}`}
                  className="px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-navy text-xs font-bold transition-colors flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Tracking Details
                </Link>
                <Link
                  to="/bookings"
                  className="px-5 py-2.5 rounded-xl bg-navy hover:bg-navy-light text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Bookings
                </Link>
              </div>
            ) : (
              <>
                {/* SAVE DRAFT / UPDATE */}
                <button
                  type="button"
                  onClick={handleSaveBooking}
                  disabled={savingDraft || submitting}
                  className="px-5 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-navy text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingDraft ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editId ? 'Save Changes' : 'Save Booking'}
                    </>
                  )}
                </button>

                {/* PUSH TO API */}
                <button
                  type="submit"
                  disabled={submitting || savingDraft}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Pushing to API...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Push to API
                    </>
                  )}
                </button>
              </>
            )}
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
