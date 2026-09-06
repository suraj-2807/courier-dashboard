import { useState, useEffect, useRef, useMemo } from 'react'
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
  Receipt,
  FileText,
  Upload,
  BookUser,
  Shield,
  ExternalLink,
  X,
  Bookmark,
  CheckSquare,
  Square
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import { countryCodesApi } from '../api/countryCodes.api'
import { customerApi } from '../api/customer.api'
import CountryAutocompleteInput from '../components/CountryAutocompleteInput'

const INITIAL_FORM = {
  // Sender
  sender_name: '',
  sender_company: '',
  sender_email: '',
  sender_phone: '',
  sender_phone_2: '',
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
  receiver_phone_2: '',
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
  const queryClient = useQueryClient()
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submittedAwb, setSubmittedAwb] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showShipmentInvoice, setShowShipmentInvoice] = useState(true)

  // Address book save toggles
  const [saveSenderAddress, setSaveSenderAddress] = useState(true)
  const [saveReceiverAddress, setSaveReceiverAddress] = useState(true)
  const [savingSenderAddr, setSavingSenderAddr] = useState(false)
  const [savingReceiverAddr, setSavingReceiverAddr] = useState(false)

  // Document upload & attached state (for Shipper & Receiver KYC)
  const [attachedDocs, setAttachedDocs] = useState([])
  const [senderKycDoc, setSenderKycDoc] = useState(null)
  const [receiverKycDoc, setReceiverKycDoc] = useState(null)
  const [uploadingSenderDoc, setUploadingSenderDoc] = useState(false)
  const [uploadingReceiverDoc, setUploadingReceiverDoc] = useState(false)
  const senderFileInputRef = useRef(null)
  const receiverFileInputRef = useRef(null)

  // Customer context from URL params
  const [customerContext, setCustomerContext] = useState({
    customerId: null,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerCompany: ''
  })

  // Fetch country codes list
  const { data: countryCodesData } = useQuery({
    queryKey: ['country-codes-customer'],
    queryFn: () => countryCodesApi.getAll().then(res => res.data)
  })
  const countryList = countryCodesData?.countryCodes || []

  // Pre-fill from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const custId = params.get('cust_id') ? parseInt(params.get('cust_id')) : null
    const custName = params.get('cust_name') || ''
    const custPhone = params.get('cust_phone') || ''
    const custEmail = params.get('cust_email') || ''
    const custCompany = params.get('cust_company') || ''

    setCustomerContext({
      customerId: custId,
      customerName: custName,
      customerEmail: custEmail,
      customerPhone: custPhone,
      customerCompany: custCompany
    })

    setForm(prev => ({
      ...prev,
      sender_name: custName || prev.sender_name,
      sender_phone: custPhone || prev.sender_phone,
      sender_email: custEmail || prev.sender_email,
      sender_company: custCompany || prev.sender_company
    }))
  }, [])

  // Addresses received from parent window (WP Customer Dashboard iframe bridge)
  const [parentAddresses, setParentAddresses] = useState([])

  useEffect(() => {
    function handleMsg(e) {
      if (e.data && e.data.type === 'PE_SAVED_ADDRESSES' && Array.isArray(e.data.addresses)) {
        setParentAddresses(e.data.addresses)
      } else if (e.data && e.data.type === 'PE_ADDRESS_SAVED' && e.data.address) {
        setParentAddresses(prev => [e.data.address, ...prev.filter(a => a.id !== e.data.address.id)])
      }
    }
    window.addEventListener('message', handleMsg)
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'PE_REQUEST_SAVED_ADDRESSES' }, '*')
      }
    } catch (_) {}
    return () => window.removeEventListener('message', handleMsg)
  }, [])

  // Fetch customer saved addresses from Node API
  const { data: addressesData, refetch: refetchAddresses } = useQuery({
    queryKey: ['customer-addresses', customerContext.customerId, customerContext.customerEmail, customerContext.customerPhone],
    queryFn: () => customerApi.getAddresses({
      customer_id: customerContext.customerId || undefined,
      email: customerContext.customerEmail || undefined,
      phone: customerContext.customerPhone || undefined
    }).then(res => res.data),
    enabled: true
  })

  // Deduplicate and combine addresses from API and parent WP window
  const savedAddresses = useMemo(() => {
    const apiAddrs = addressesData?.addresses || []
    const combined = [...apiAddrs, ...parentAddresses]
    const map = new Map()
    for (const a of combined) {
      const key = `${(a.name || '').trim().toLowerCase()}_${(a.phone || '').trim()}_${(a.address || '').trim().toLowerCase()}`
      if (key && !map.has(key)) map.set(key, a)
    }
    return Array.from(map.values())
  }, [addressesData, parentAddresses])

  // Extract and deduplicate senders and receivers for autocomplete
  const allSenders = useMemo(() => {
    const map = new Map()
    for (const a of savedAddresses) {
      const rawType = (a.address_type || 'both').toLowerCase()
      if (rawType === 'sender' || rawType === 'both' || !a.address_type) {
        const key = `${(a.name || '').trim().toLowerCase()}_${(a.phone || '').trim()}`
        if (key && !map.has(key)) map.set(key, a)
      }
    }
    return Array.from(map.values())
  }, [savedAddresses])

  const allReceivers = useMemo(() => {
    const map = new Map()
    for (const a of savedAddresses) {
      const rawType = (a.address_type || 'both').toLowerCase()
      if (rawType === 'receiver' || rawType === 'both' || !a.address_type) {
        const key = `${(a.name || '').trim().toLowerCase()}_${(a.phone || '').trim()}`
        if (key && !map.has(key)) map.set(key, a)
      }
    }
    return Array.from(map.values())
  }, [savedAddresses])

  const [senderSuggestionsOpen, setSenderSuggestionsOpen] = useState(false)
  const senderContainerRef = useRef(null)

  const [receiverSuggestionsOpen, setReceiverSuggestionsOpen] = useState(false)
  const receiverContainerRef = useRef(null)

  const filteredSenders = useMemo(() => {
    if (!form.sender_name || form.sender_name.trim().length < 1) {
      return allSenders.slice(0, 10)
    }
    const q = form.sender_name.toLowerCase().trim()
    const matches = allSenders.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.company || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q) ||
      (s.city || '').toLowerCase().includes(q)
    )
    return matches.length > 0 ? matches.slice(0, 10) : allSenders.slice(0, 10)
  }, [allSenders, form.sender_name])

  const filteredReceivers = useMemo(() => {
    if (!form.receiver_name || form.receiver_name.trim().length < 1) {
      return allReceivers.slice(0, 10)
    }
    const q = form.receiver_name.toLowerCase().trim()
    const matches = allReceivers.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.company || '').toLowerCase().includes(q) ||
      (r.phone || '').includes(q) ||
      (r.city || '').toLowerCase().includes(q)
    )
    return matches.length > 0 ? matches.slice(0, 10) : allReceivers.slice(0, 10)
  }, [allReceivers, form.receiver_name])

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

  // Fetch customer saved documents
  const { data: documentsData, refetch: refetchDocuments } = useQuery({
    queryKey: ['customer-documents', customerContext.customerId, customerContext.customerEmail, customerContext.customerPhone],
    queryFn: () => customerApi.getDocuments({
      customer_id: customerContext.customerId || undefined,
      email: customerContext.customerEmail || undefined,
      phone: customerContext.customerPhone || undefined
    }).then(res => res.data),
    enabled: true
  })
  const savedDocuments = documentsData?.documents || []

  // Parcels detail state synced with no_of_pieces
  const [parcels, setParcels] = useState([
    { parcel_no: 1, box_no: '1', weight: '', length: '', breadth: '', height: '', volumetric_weight: '', chargeable_weight: '' }
  ])

  // Invoice items state
  const invoiceDescRefs = useRef([])
  const [invoiceItems, setInvoiceItems] = useState([
    { sr_no: 1, box_no: '1', description: '', hs_code: '', unit_type: 'PCS', quantity: '', unit_weight: '00', cost: '', unit_rates: '', amount: '' }
  ])

  const addInvoiceItem = () => {
    setInvoiceItems(prev => {
      const lastBoxNo = prev.length > 0 ? prev[prev.length - 1].box_no : '1'
      return [
        ...prev,
        { sr_no: prev.length + 1, box_no: lastBoxNo, description: '', hs_code: '', unit_type: 'PCS', quantity: '', unit_weight: '00', cost: '', unit_rates: '', amount: '' }
      ]
    })
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
      let sanitizedVal = value

      // Centimeters must not have point values (integers only)
      if (['length', 'breadth', 'height'].includes(field)) {
        sanitizedVal = sanitizedVal === '' ? '' : String(parseInt(String(sanitizedVal).replace(/\D/g, ''), 10) || '')
      }

      const item = { ...updated[index], [field]: sanitizedVal }

      const l = parseInt(item.length, 10) || 0
      const b = parseInt(item.breadth, 10) || 0
      const h = parseInt(item.height, 10) || 0
      const act = parseFloat(item.weight) || 0

      let vol = 0
      if (l > 0 && b > 0 && h > 0) {
        vol = Math.round(((l * b * h) / 5000) * 100) / 100
      }
      const maxWeight = Math.max(act, vol)
      const chg = maxWeight > 0 ? Math.ceil(maxWeight) : 0

      item.volumetric_weight = vol > 0 ? vol.toFixed(2) : ''
      item.chargeable_weight = chg > 0 ? chg.toFixed(2) : ''
      updated[index] = item
      return updated
    })
  }

  // Calculate totals from parcels array
  const totalParcelActual = Math.round(parcels.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0) * 100) / 100
  const totalParcelVol = Math.round(parcels.reduce((sum, p) => sum + (parseFloat(p.volumetric_weight) || 0), 0) * 100) / 100
  const totalParcelChg = parcels.reduce((sum, p) => sum + (parseFloat(p.chargeable_weight) || Math.ceil(Math.max(parseFloat(p.weight) || 0, parseFloat(p.volumetric_weight) || 0))), 0)

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
      const maxWeight = Math.max(act, vol)
      const chg = maxWeight > 0 ? Math.ceil(maxWeight) : 0

      setForm(prev => ({
        ...prev,
        weight: act > 0 ? String(act) : prev.weight,
        volumetric_weight: vol > 0 ? String(vol) : '',
        chargeable_weight: chg > 0 ? String(chg) : '',
        shipping_charge: prev.shipping_charge || (chg > 0 ? String(chg) : '')
      }))
    }
  }, [parcels, form.length, form.breadth, form.height, form.weight, form.no_of_pieces])

  // Normalize document type from DB to match dropdown <option> values exactly
  const normalizeDocType = (raw, isSender = true) => {
    if (!raw) return ''
    const upper = String(raw).trim().toUpperCase()
    const senderMap = {
      'GSTIN': 'GSTIN', 'GST': 'GSTIN',
      'PAN': 'PAN', 'PAN CARD': 'PAN',
      'AADHAAR NUMBER': 'Aadhaar Number', 'AADHAAR': 'Aadhaar Number', 'AADHAR': 'Aadhaar Number', 'AADHAR NUMBER': 'Aadhaar Number',
      'PASSPORT': 'Passport',
      'VOTER ID': 'Voter ID', 'VOTER': 'Voter ID',
      'DRIVING LICENSE': 'Driving License', 'DRIVING LICENCE': 'Driving License', 'DL': 'Driving License'
    }
    const receiverMap = {
      'TAX ID': 'Tax ID', 'TAXID': 'Tax ID', 'TAX': 'Tax ID',
      'VAT': 'VAT',
      'PASSPORT': 'Passport',
      'AADHAAR NUMBER': 'Aadhaar Number', 'AADHAAR': 'Aadhaar Number', 'AADHAR': 'Aadhaar Number', 'AADHAR NUMBER': 'Aadhaar Number',
      'PAN': 'PAN', 'PAN CARD': 'PAN',
      'GSTIN': 'GSTIN', 'GST': 'GSTIN'
    }
    const map = isSender ? senderMap : receiverMap
    return map[upper] || raw.trim()
  }

  const NO_AUTO_UPPERCASE_FIELDS = [
    'sender_email',
    'receiver_email',
    'sender_gstin_type',
    'receiver_gstin_type',
    'package_type',
    'payment_mode',
    'invoice_type',
    'invoice_currency',
    'terms_of_trade'
  ]

  const updateForm = (field, value) => {
    let val = value
    if (typeof val === 'string' && !NO_AUTO_UPPERCASE_FIELDS.includes(field) && !field.toLowerCase().includes('email')) {
      val = val.toUpperCase()
    }
    setForm(prev => ({ ...prev, [field]: val }))
  }

  // ── Address Selection & Quick Save ──
  const handleSelectSavedSender = (addr) => {
    if (!addr) return
    setForm(prev => ({
      ...prev,
      sender_name: (addr.name || '').toUpperCase(),
      sender_company: (addr.company || '').toUpperCase(),
      sender_phone: addr.phone || '',
      sender_phone_2: addr.phone_2 || '',
      sender_email: addr.email || '',
      sender_address: (addr.address || '').toUpperCase(),
      sender_address_2: (addr.address_2 || '').toUpperCase(),
      sender_city: (addr.city || '').toUpperCase(),
      sender_pincode: (addr.pincode || '').toUpperCase(),
      sender_state: (addr.state || '').toUpperCase(),
      sender_country: (addr.country || 'INDIA').toUpperCase(),
      sender_gstin_type: normalizeDocType(addr.gstin_type, true),
      sender_gstin_no: (addr.gstin_no || '').toUpperCase()
    }))
    setSenderSuggestionsOpen(false)
    toast.success(`Autofilled details for sender "${addr.name}"!`)
  }

  const handleSelectSavedReceiver = (addr) => {
    if (!addr) return
    setForm(prev => ({
      ...prev,
      receiver_name: (addr.name || '').toUpperCase(),
      receiver_company: (addr.company || '').toUpperCase(),
      receiver_phone: addr.phone || '',
      receiver_phone_2: addr.phone_2 || '',
      receiver_email: addr.email || '',
      receiver_address: (addr.address || '').toUpperCase(),
      receiver_address_2: (addr.address_2 || '').toUpperCase(),
      receiver_city: (addr.city || '').toUpperCase(),
      receiver_pincode: (addr.pincode || '').toUpperCase(),
      receiver_state: (addr.state || '').toUpperCase(),
      receiver_country: (addr.country || '').toUpperCase(),
      receiver_gstin_type: normalizeDocType(addr.gstin_type, false),
      receiver_gstin_no: (addr.gstin_no || '').toUpperCase()
    }))
    setReceiverSuggestionsOpen(false)
    toast.success(`Autofilled details for receiver "${addr.name}"!`)
  }

  const handleQuickSaveSender = async () => {
    if (!form.sender_name || !form.sender_phone || !form.sender_address || !form.sender_city) {
      toast.error('Please enter Sender Name, Phone, Address Line 1, and City before saving')
      return
    }
    try {
      setSavingSenderAddr(true)
      await customerApi.saveAddress({
        customer_id: customerContext.customerId,
        customer_email: customerContext.customerEmail || form.sender_email,
        customer_phone: customerContext.customerPhone || form.sender_phone,
        address_type: 'sender',
        name: form.sender_name,
        company: form.sender_company,
        phone: form.sender_phone,
        phone_2: form.sender_phone_2,
        email: form.sender_email,
        address: form.sender_address,
        address_2: form.sender_address_2,
        city: form.sender_city,
        state: form.sender_state,
        pincode: form.sender_pincode,
        country: form.sender_country || 'INDIA',
        gstin_type: form.sender_gstin_type,
        gstin_no: form.sender_gstin_no
      })
      toast.success('Sender address saved to Address Book!')
      refetchAddresses()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save address')
    } finally {
      setSavingSenderAddr(false)
    }
  }

  const handleQuickSaveReceiver = async () => {
    if (!form.receiver_name || !form.receiver_phone || !form.receiver_address || !form.receiver_city) {
      toast.error('Please enter Receiver Name, Phone, Address Line 1, and City before saving')
      return
    }
    try {
      setSavingReceiverAddr(true)
      await customerApi.saveAddress({
        customer_id: customerContext.customerId,
        customer_email: customerContext.customerEmail || form.sender_email,
        customer_phone: customerContext.customerPhone || form.sender_phone,
        address_type: 'receiver',
        name: form.receiver_name,
        company: form.receiver_company,
        phone: form.receiver_phone,
        phone_2: form.receiver_phone_2,
        email: form.receiver_email,
        address: form.receiver_address,
        address_2: form.receiver_address_2,
        city: form.receiver_city,
        state: form.receiver_state,
        pincode: form.receiver_pincode,
        country: form.receiver_country,
        gstin_type: form.receiver_gstin_type,
        gstin_no: form.receiver_gstin_no
      })
      toast.success('Receiver address saved to Address Book!')
      refetchAddresses()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save address')
    } finally {
      setSavingReceiverAddr(false)
    }
  }

  // ── Document Upload for Shipper & Receiver ──
  const handleSenderDocUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be under 25MB')
      return
    }
    try {
      setUploadingSenderDoc(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('customer_id', customerContext.customerId || '')
      formData.append('customer_email', customerContext.customerEmail || form.sender_email || '')
      formData.append('customer_phone', customerContext.customerPhone || form.sender_phone || '')
      formData.append('doc_type', form.sender_gstin_type || 'Shipper KYC')
      formData.append('doc_name', file.name)
      formData.append('doc_number', form.sender_gstin_no || '')

      const res = await customerApi.uploadDocument(formData)
      if (res.data?.success) {
        const uploadedDoc = {
          id: res.data.document?.id || Date.now(),
          doc_type: form.sender_gstin_type || 'Shipper KYC',
          doc_name: file.name,
          doc_number: form.sender_gstin_no || '',
          file_url: res.data.fileUrl || res.data.document?.file_url,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          category: 'sender'
        }
        setSenderKycDoc(uploadedDoc)
        setAttachedDocs(prev => [...prev.filter(d => d.category !== 'sender'), uploadedDoc])
        toast.success(`Shipper KYC "${file.name}" uploaded!`)
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to upload document')
    } finally {
      setUploadingSenderDoc(false)
      if (senderFileInputRef.current) senderFileInputRef.current.value = ''
    }
  }

  const handleRemoveSenderDoc = () => {
    setSenderKycDoc(null)
    setAttachedDocs(prev => prev.filter(d => d.category !== 'sender'))
  }

  const handleReceiverDocUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be under 25MB')
      return
    }
    try {
      setUploadingReceiverDoc(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('customer_id', customerContext.customerId || '')
      formData.append('customer_email', customerContext.customerEmail || form.sender_email || '')
      formData.append('customer_phone', customerContext.customerPhone || form.sender_phone || '')
      formData.append('doc_type', form.receiver_gstin_type || 'Receiver ID')
      formData.append('doc_name', file.name)
      formData.append('doc_number', form.receiver_gstin_no || '')

      const res = await customerApi.uploadDocument(formData)
      if (res.data?.success) {
        const uploadedDoc = {
          id: res.data.document?.id || Date.now(),
          doc_type: form.receiver_gstin_type || 'Receiver ID',
          doc_name: file.name,
          doc_number: form.receiver_gstin_no || '',
          file_url: res.data.fileUrl || res.data.document?.file_url,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          category: 'receiver'
        }
        setReceiverKycDoc(uploadedDoc)
        setAttachedDocs(prev => [...prev.filter(d => d.category !== 'receiver'), uploadedDoc])
        toast.success(`Receiver ID "${file.name}" uploaded!`)
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to upload document')
    } finally {
      setUploadingReceiverDoc(false)
      if (receiverFileInputRef.current) receiverFileInputRef.current.value = ''
    }
  }

  const handleRemoveReceiverDoc = () => {
    setReceiverKycDoc(null)
    setAttachedDocs(prev => prev.filter(d => d.category !== 'receiver'))
  }

  // ── Form Submit ──
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

    try {
      setSubmitting(true)
      const params = new URLSearchParams(window.location.search)
      const apiPayload = {
        customer_id: params.get('cust_id') ? parseInt(params.get('cust_id')) : customerContext.customerId,
        customer_name: params.get('cust_name') || customerContext.customerName || form.sender_name,
        customer_email: params.get('cust_email') || customerContext.customerEmail || form.sender_email,
        customer_phone: params.get('cust_phone') || customerContext.customerPhone || form.sender_phone,
        customer_company: params.get('cust_company') || customerContext.customerCompany || form.sender_company,
        sender_name: form.sender_name || form.sender_company,
        sender_company: form.sender_company,
        sender_email: form.sender_email,
        sender_phone: form.sender_phone,
        sender_phone_2: form.sender_phone_2,
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
        receiver_phone_2: form.receiver_phone_2,
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
        chargeable_weight: (parcels.length > 1 && totalParcelChg > 0) ? totalParcelChg : (parseFloat(form.chargeable_weight) ? Math.ceil(parseFloat(form.chargeable_weight)) : 0),
        length: parseFloat(form.length) || (parcels[0] ? parseFloat(parcels[0].length) : 0) || 0,
        breadth: parseFloat(form.breadth) || (parcels[0] ? parseFloat(parcels[0].breadth) : 0) || 0,
        height: parseFloat(form.height) || (parcels[0] ? parseFloat(parcels[0].height) : 0) || 0,
        no_of_pieces: Math.max(parcels.length, parseInt(form.no_of_pieces) || 1),
        content_description: (form.content_description && form.content_description !== 'General Goods' && form.content_description !== 'ITEMS / GOODS INSIDE')
          ? form.content_description
          : (invoiceItems.map(i => i.description).filter(Boolean).join(', ') || form.content_description || 'Books'),
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

        // Invoice & export
        invoice_type: form.invoice_type || 'INVOICE',
        invoice_currency: form.invoice_currency,
        hs_code: form.hs_code,
        export_reason: form.export_reason || form.invoice_note || '',
        terms_of_trade: form.terms_of_trade,
        invoice_note: form.invoice_note || '',
        invoice_items: invoiceItems
          .filter(item => item.description || parseFloat(item.quantity) > 0 || parseFloat(item.amount) > 0)
          .map(item => ({
            ...item,
            unit_weight: (item.unit_weight !== undefined && item.unit_weight !== null && String(item.unit_weight).trim() !== '') ? String(item.unit_weight).trim() : '00'
          })),

        // Documents & Address Book flags (manual saving only)
        documents: attachedDocs,
        save_sender_address: false,
        save_receiver_address: false,
        save_documents: false
      }

      const res = await customerApi.submitBookingRequest(apiPayload)
      const data = res.data
      if (!data.success) {
        throw new Error(data.message || 'Failed to submit booking request')
      }

      setSubmittedAwb(data.request_awb)
      toast.success('Booking request submitted successfully!')
      try {
        window.parent.postMessage({ type: 'PE_BOOKING_SUCCESS', awb: data.request_awb }, '*')
      } catch (e) {}
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to submit request')
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
                className="p-1.5 hover:bg-surface-hover rounded-lg text-text-secondary transition-colors cursor-pointer"
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
                setAttachedDocs([])
                setInvoiceItems([{ sr_no: 1, box_no: '1', description: '', hs_code: '', unit_type: 'PCS', quantity: '', unit_weight: '00', cost: '', unit_rates: '', amount: '' }])
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
          <p className="text-[12px] text-text-secondary mt-0.5">Fill in shipment details, select saved addresses, and upload KYC documents</p>
        </div>
        <div className="flex items-center gap-2">
          {savedAddresses.length > 0 && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <BookUser className="w-3.5 h-3.5" />
              {savedAddresses.length} Saved Addresses
            </span>
          )}
          <span className="bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Express Booking
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Main 2 Columns: Shipper & Consignee ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Column 1: Shipper Details ── */}
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3.5 flex-wrap">
              <RedBadge title="Shipper (Pickup Details)" icon={User} />
              {allSenders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSenderSuggestionsOpen(p => !p)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 text-blue-600" />
                  Saved Senders ({allSenders.length})
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div ref={senderContainerRef} className="relative">
                <CompactField label="Sender Full Name" required>
                  <input
                    type="text"
                    placeholder="Type name to autofill or select saved..."
                    value={form.sender_name}
                    onFocus={() => { if (allSenders.length > 0) setSenderSuggestionsOpen(true) }}
                    onClick={() => { if (allSenders.length > 0) setSenderSuggestionsOpen(true) }}
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
                          handleSelectSavedSender(s)
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
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
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
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
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
                    value={normalizeDocType(form.sender_gstin_type, true)}
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
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                  />
                </CompactField>
              </div>

              {/* Optional Shipper KYC Document Upload */}
              <div className="bg-surface-alt/60 border border-dashed border-border rounded-xl p-2.5">
                <input
                  ref={senderFileInputRef}
                  type="file"
                  onChange={handleSenderDocUpload}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  className="hidden"
                  id="sender-kyc-input"
                />
                {senderKycDoc ? (
                  <div className="flex items-center justify-between gap-2 p-1 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-navy truncate" title={senderKycDoc.file_name}>
                          {senderKycDoc.file_name}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          Shipper KYC Attached {senderKycDoc.file_size ? `(${(senderKycDoc.file_size / 1024).toFixed(0)} KB)` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {senderKycDoc.file_url && (
                        <a
                          href={senderKycDoc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-text-secondary hover:text-primary transition-colors"
                          title="View Document"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={handleRemoveSenderDoc}
                        className="p-1 text-danger/70 hover:text-danger transition-colors cursor-pointer"
                        title="Remove Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-[11px]">Upload Shipper KYC Document (Optional)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => senderFileInputRef.current?.click()}
                      disabled={uploadingSenderDoc}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface border border-border hover:border-primary hover:text-primary rounded-lg text-xs font-bold text-navy shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {uploadingSenderDoc ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-primary" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3 text-primary" />
                          <span>Choose File</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Manual Save to Address Book */}
              <div className="pt-2 border-t border-border-light flex items-center justify-between gap-2 flex-wrap text-xs">
                <span className="text-[11px] text-text-tertiary">
                  Save this shipper for future bookings:
                </span>

                <button
                  type="button"
                  onClick={handleQuickSaveSender}
                  disabled={savingSenderAddr}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary-dark bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-primary/20"
                >
                  {savingSenderAddr ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
                  Save to Address Book
                </button>
              </div>
            </div>
          </div>

          {/* ── Column 2: Consignee Details ── */}
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3.5 flex-wrap">
              <RedBadge title="Consignee (Delivery Details)" icon={MapPin} />
              {allReceivers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReceiverSuggestionsOpen(p => !p)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 text-emerald-600" />
                  Saved Receivers ({allReceivers.length})
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div ref={receiverContainerRef} className="relative">
                <CompactField label="Receiver Full Name" required highlight={!form.receiver_name && !form.receiver_company}>
                  <input
                    type="text"
                    placeholder="Type name to autofill or select saved..."
                    value={form.receiver_name}
                    onFocus={() => { if (allReceivers.length > 0) setReceiverSuggestionsOpen(true) }}
                    onClick={() => { if (allReceivers.length > 0) setReceiverSuggestionsOpen(true) }}
                    onChange={e => {
                      updateForm('receiver_name', e.target.value)
                      setReceiverSuggestionsOpen(true)
                    }}
                    className="w-full bg-transparent focus:outline-none text-[13px] font-semibold text-navy"
                  />
                </CompactField>

                {/* Receiver Autocomplete Dropdown */}
                {receiverSuggestionsOpen && filteredReceivers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-border animate-fade-in">
                    <div className="px-3 py-1.5 bg-red-50/70 text-[10px] font-extrabold text-primary uppercase tracking-wider flex items-center justify-between sticky top-0 backdrop-blur-xs">
                      <span>Saved Receivers (Click to Autofill)</span>
                      <span className="text-[9px] text-text-tertiary">{filteredReceivers.length} found</span>
                    </div>
                    {filteredReceivers.map((r) => (
                      <div
                        key={r.id}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleSelectSavedReceiver(r)
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
                          {r.phone && (r.city || r.state || r.country) && <span>•</span>}
                          {(r.city || r.state || r.country) && <span>{[r.city, r.state, r.country].filter(Boolean).join(', ')}</span>}
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
                    placeholder="City / Hub"
                    value={form.receiver_city}
                    onChange={e => updateForm('receiver_city', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                  />
                </CompactField>
                <CompactField label="Zip / Postal Code">
                  <input
                    type="text"
                    placeholder="Zip code"
                    value={form.receiver_pincode}
                    onChange={e => updateForm('receiver_pincode', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                  />
                </CompactField>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <CompactField label="State / Province">
                  <input
                    type="text"
                    placeholder="State / Province"
                    value={form.receiver_state}
                    onChange={e => updateForm('receiver_state', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] uppercase text-text-primary"
                  />
                </CompactField>
                <CompactField label="Destination Country" required highlight={!form.receiver_country}>
                  <CountryAutocompleteInput
                    value={form.receiver_country}
                    onChange={val => updateForm('receiver_country', val)}
                    placeholder="Destination Country"
                    className="w-full bg-transparent focus:outline-none text-[13px] font-bold uppercase text-primary pr-6"
                    countryList={countryList}
                  />
                </CompactField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <CompactField label="Phone / Mobile Number" required highlight={!form.receiver_phone}>
                  <input
                    type="tel"
                    placeholder="Receiver Phone Number"
                    value={form.receiver_phone}
                    onChange={e => updateForm('receiver_phone', e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
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
                    value={normalizeDocType(form.receiver_gstin_type, false)}
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
                    <option value="Voter ID">Voter ID</option>
                    <option value="Driving License">Driving License</option>
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
                    className="w-full bg-transparent focus:outline-none text-[13px] text-text-primary"
                  />
                </CompactField>
              </div>

              {/* Optional Receiver KYC / ID Document Upload */}
              <div className="bg-surface-alt/60 border border-dashed border-border rounded-xl p-2.5">
                <input
                  ref={receiverFileInputRef}
                  type="file"
                  onChange={handleReceiverDocUpload}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  className="hidden"
                  id="receiver-kyc-input"
                />
                {receiverKycDoc ? (
                  <div className="flex items-center justify-between gap-2 p-1 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-navy truncate" title={receiverKycDoc.file_name}>
                          {receiverKycDoc.file_name}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          Receiver ID Attached {receiverKycDoc.file_size ? `(${(receiverKycDoc.file_size / 1024).toFixed(0)} KB)` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {receiverKycDoc.file_url && (
                        <a
                          href={receiverKycDoc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-text-secondary hover:text-primary transition-colors"
                          title="View Document"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={handleRemoveReceiverDoc}
                        className="p-1 text-danger/70 hover:text-danger transition-colors cursor-pointer"
                        title="Remove Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-[11px]">Upload Receiver KYC / ID Document (Optional)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => receiverFileInputRef.current?.click()}
                      disabled={uploadingReceiverDoc}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface border border-border hover:border-primary hover:text-primary rounded-lg text-xs font-bold text-navy shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {uploadingReceiverDoc ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-primary" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3 text-primary" />
                          <span>Choose File</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Manual Save to Address Book */}
              <div className="pt-2 border-t border-border-light flex items-center justify-between gap-2 flex-wrap text-xs">
                <span className="text-[11px] text-text-tertiary">
                  Save this consignee for future bookings:
                </span>

                <button
                  type="button"
                  onClick={handleQuickSaveReceiver}
                  disabled={savingReceiverAddr}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary-dark bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-primary/20"
                >
                  {savingReceiverAddr ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
                  Save to Address Book
                </button>
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
              <div className="px-4 py-3 border-r border-border bg-surface-alt/20">
                <span className="text-[10px] font-extrabold uppercase text-text-secondary block mb-1 tracking-wider">Actual Weight (kg)</span>
                <input
                  type="text"
                  readOnly
                  placeholder="0.00"
                  value={totalParcelActual > 0 ? totalParcelActual.toFixed(2) : (parseFloat(form.weight) ? parseFloat(form.weight).toFixed(2) : '0.00')}
                  className="w-full bg-transparent focus:outline-none text-[14px] text-navy font-bold cursor-not-allowed"
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
                    onBlur={e => {
                      const num = parseFloat(e.target.value)
                      if (!isNaN(num) && num > 0) {
                        const formatted = num.toFixed(2)
                        updateParcel(pIdx, 'weight', formatted)
                        if (parcels.length === 1) updateForm('weight', formatted)
                      }
                    }}
                    className="w-full bg-transparent focus:outline-none text-xs text-center font-bold text-navy"
                  />
                </div>
                <div className="px-2 py-1 border-r border-border-light">
                  <input
                    type="number"
                    step="1"
                    placeholder="L"
                    value={p.length ?? ''}
                    onKeyDown={e => {
                      if (e.key === '.' || e.key === ',') e.preventDefault()
                    }}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      updateParcel(pIdx, 'length', val)
                      if (parcels.length === 1) updateForm('length', val)
                    }}
                    className="w-full bg-transparent focus:outline-none text-xs text-center text-text-primary"
                  />
                </div>
                <div className="px-2 py-1 border-r border-border-light">
                  <input
                    type="number"
                    step="1"
                    placeholder="B"
                    value={p.breadth ?? ''}
                    onKeyDown={e => {
                      if (e.key === '.' || e.key === ',') e.preventDefault()
                    }}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      updateParcel(pIdx, 'breadth', val)
                      if (parcels.length === 1) updateForm('breadth', val)
                    }}
                    className="w-full bg-transparent focus:outline-none text-xs text-center text-text-primary"
                  />
                </div>
                <div className="px-2 py-1 border-r border-border-light">
                  <input
                    type="number"
                    step="1"
                    placeholder="H"
                    value={p.height ?? ''}
                    onKeyDown={e => {
                      if (e.key === '.' || e.key === ',') e.preventDefault()
                    }}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      updateParcel(pIdx, 'height', val)
                      if (parcels.length === 1) updateForm('height', val)
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
                      <input
                        type="text"
                        placeholder="Item description"
                        value={item.description}
                        ref={el => (invoiceDescRefs.current[idx] = el)}
                        onChange={e => updateInvoiceItem(idx, 'description', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-[13px] text-navy font-medium"
                      />
                    </div>
                    <div className="px-1">
                      <input type="text" placeholder="" value={item.hs_code} onChange={e => updateInvoiceItem(idx, 'hs_code', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-center text-text-primary" />
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
                      <input type="text" placeholder="00" value={item.unit_weight} onChange={e => updateInvoiceItem(idx, 'unit_weight', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-right text-text-primary" />
                    </div>
                    <div className="px-1">
                      <input type="number" step="0.01" placeholder="" value={item.cost} onChange={e => updateInvoiceItem(idx, 'cost', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-right text-text-primary" />
                    </div>
                    <div className="px-1">
                      <input
                        type="number"
                        step="0.01"
                        placeholder=""
                        value={item.unit_rates}
                        onChange={e => updateInvoiceItem(idx, 'unit_rates', e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-xs text-right text-text-primary"
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
                    <div className="px-1">
                      <input type="number" step="0.01" placeholder="" readOnly tabIndex={-1} value={item.amount}
                        className="w-full bg-transparent focus:outline-none text-xs text-right font-extrabold text-primary cursor-default" />
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
                  <div className="px-1.5 py-1 text-right text-navy">{invoiceTotalWeight.toFixed(2)}</div>
                  <div className="col-span-2 px-1.5 py-1 text-right text-navy uppercase tracking-wider">Total Amount</div>
                  <div className="px-1.5 py-1 text-right text-primary text-xs font-bold">{invoiceTotalAmount.toFixed(2)}</div>
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
              onClick={() => {
                setForm(INITIAL_FORM)
                setAttachedDocs([])
                setInvoiceItems([{ sr_no: 1, box_no: '1', description: '', hs_code: '', unit_type: 'PCS', quantity: '', unit_weight: '00', cost: '', unit_rates: '', amount: '' }])
              }}
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
