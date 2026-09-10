import { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sendersApi } from '../api/senders.api'
import { receiversApi } from '../api/receivers.api'
import { countryCodesApi } from '../api/countryCodes.api'
import CountryAutocompleteInput from '../components/CountryAutocompleteInput'
import { getFullCountryName } from '../utils/countryUtils'
import {
  Users,
  Truck,
  MapPin,
  Search,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Download,
  X,
  Check,
  Building,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  FileSpreadsheet,
  UserCheck,
  Globe,
  Hash,
  ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  name: '',
  company: '',
  phone: '',
  email: '',
  address: '',
  address_2: '',
  city: '',
  state: '',
  pincode: '',
  country: '',
  gstin_type: '',
  gstin_no: ''
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('senders') // 'senders' | 'receivers'
  const [searchTerm, setSearchTerm] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)

  // Import Modal State
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importData, setImportData] = useState([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  // Fetch Country Codes
  const { data: countryCodesData } = useQuery({
    queryKey: ['country-codes'],
    queryFn: () => countryCodesApi.getAll().then(res => res.data)
  })
  const countryList = countryCodesData?.countryCodes || []

  // Helper to deduplicate list by name
  const deduplicateContacts = (list = []) => {
    const map = new Map()
    for (const item of list) {
      const key = (item.name || '').trim().toLowerCase()
      if (key && !map.has(key)) {
        map.set(key, item)
      }
    }
    return Array.from(map.values())
  }

  // Senders Query
  const { data: sendersData, isLoading: loadingSenders } = useQuery({
    queryKey: ['senders'],
    queryFn: () => sendersApi.getAll().then(res => res.data)
  })
  const senders = useMemo(() => deduplicateContacts(sendersData?.senders || []), [sendersData])

  // Receivers Query
  const { data: receiversData, isLoading: loadingReceivers } = useQuery({
    queryKey: ['receivers'],
    queryFn: () => receiversApi.getAll().then(res => res.data)
  })
  const receivers = useMemo(() => deduplicateContacts(receiversData?.receivers || []), [receiversData])

  const currentList = activeTab === 'senders' ? senders : receivers
  const isLoading = activeTab === 'senders' ? loadingSenders : loadingReceivers

  // Filtered List
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return currentList
    const term = searchTerm.toLowerCase().trim()
    return currentList.filter(item =>
      (item.name || '').toLowerCase().includes(term) ||
      (item.company || '').toLowerCase().includes(term) ||
      (item.phone || '').toLowerCase().includes(term) ||
      (item.email || '').toLowerCase().includes(term) ||
      (item.city || '').toLowerCase().includes(term) ||
      (item.state || '').toLowerCase().includes(term) ||
      (item.pincode || '').toLowerCase().includes(term) ||
      (item.country || '').toLowerCase().includes(term) ||
      (item.gstin_no || '').toLowerCase().includes(term)
    )
  }, [currentList, searchTerm])

  // Save (Create / Update) Mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const api = activeTab === 'senders' ? sendersApi : receiversApi
      if (editingItem?.id) {
        return api.update(editingItem.id, data)
      } else {
        return api.create(data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeTab] })
      toast.success(`${activeTab === 'senders' ? 'Sender' : 'Receiver'} saved successfully!`)
      closeModal()
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save record')
    }
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const api = activeTab === 'senders' ? sendersApi : receiversApi
      return api.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeTab] })
      toast.success(`${activeTab === 'senders' ? 'Sender' : 'Receiver'} deleted`)
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete record')
    }
  })

  // Bulk Import Mutation
  const importMutation = useMutation({
    mutationFn: async (items) => {
      const api = activeTab === 'senders' ? sendersApi : receiversApi
      return api.bulkImport(items)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: [activeTab] })
      toast.success(res.data?.message || `Imported ${res.data?.imported || importData.length} records!`)
      setIsImportOpen(false)
      setImportData([])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to import records')
    }
  })

  const openAddModal = () => {
    setEditingItem(null)
    setFormData({
      ...EMPTY_FORM,
      country: activeTab === 'senders' ? 'INDIA' : ''
    })
    setIsModalOpen(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setFormData({
      name: item.name || '',
      company: item.company || '',
      phone: item.phone || '',
      email: item.email || '',
      address: item.address || '',
      address_2: item.address_2 || '',
      city: item.city || '',
      state: item.state || '',
      pincode: item.pincode || '',
      country: item.country || (activeTab === 'senders' ? 'INDIA' : ''),
      gstin_type: item.gstin_type || '',
      gstin_no: item.gstin_no || ''
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingItem(null)
    setFormData(EMPTY_FORM)
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('Full Name is required')
      return
    }
    saveMutation.mutate(formData)
  }

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name || 'this contact'}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  // Parse CSV for bulk import
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result
      if (!text) return
      try {
        const rows = parseCSV(text)
        if (rows.length === 0) {
          toast.error('No valid rows found in CSV file.')
          return
        }
        setImportData(rows)
      } catch {
        toast.error('Failed to parse CSV file. Please verify formatting.')
      }
    }
    reader.readAsText(file)
  }

  // Simple CSV parser
  const parseCSV = (csvText) => {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const records = []

    for (let i = 1; i < lines.length; i++) {
      // Regex to handle quoted commas
      const matches = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || lines[i].split(',')
      const values = matches.map(val => val.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))

      const record = { ...EMPTY_FORM }
      headers.forEach((header, colIndex) => {
        const val = values[colIndex] || ''
        if (header.includes('name')) record.name = val
        else if (header.includes('company')) record.company = val
        else if (header.includes('phone') || header.includes('mobile')) record.phone = val
        else if (header.includes('email')) record.email = val
        else if (header.includes('address_2') || header.includes('line2') || header.includes('area')) record.address_2 = val
        else if (header.includes('address') || header.includes('street')) record.address = val
        else if (header.includes('city')) record.city = val
        else if (header.includes('state') || header.includes('province')) record.state = val
        else if (header.includes('pin') || header.includes('zip')) record.pincode = val
        else if (header.includes('country')) record.country = val
        else if (header.includes('doc_type') || header.includes('gstin_type')) record.gstin_type = val
        else if (header.includes('doc_no') || header.includes('gstin_no') || header.includes('aadhaar')) record.gstin_no = val
      })

      if (record.name || record.company || record.phone) {
        records.push(record)
      }
    }

    return records
  }

  // Download Sample CSV
  const downloadSampleCSV = () => {
    const headers = 'name,company,phone,email,address,address_2,city,state,pincode,country,doc_type,doc_no'
    const sampleSender = 'Rajesh Kumar,ABC Exporters,+91 9876543210,rajesh@example.com,"Shop 12, Market Road",Sector 18,Noida,Uttar Pradesh,201301,INDIA,Aadhaar Number,123456789012'
    const sampleReceiver = 'John Doe,Global Imports,+1 4155552671,john@example.com,"742 Evergreen Terrace",Apt 4B,Springfield,Oregon,97477,US,Tax ID,US98765432'
    const content = `${headers}\n${activeTab === 'senders' ? sampleSender : sampleReceiver}`

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Sample_${activeTab === 'senders' ? 'Senders' : 'Receivers'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-navy tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="w-5 h-5" />
            </div>
            Address Book & Contacts
          </h1>
          <p className="text-[13px] text-text-tertiary mt-1">
            Manage saved senders (shippers) and receivers (consignees) for quick autofill during booking creation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setImportData([])
              setIsImportOpen(true)
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold text-navy bg-surface hover:bg-surface-hover border border-border transition-colors shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4 text-primary" />
            Import CSV
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-primary hover:bg-primary-dark transition-all duration-200 shadow-sm hover:shadow-primary/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab === 'senders' ? 'Sender' : 'Receiver'}
          </button>
        </div>
      </div>

      {/* ── Tabs & Search Bar ── */}
      <div className="bg-surface rounded-2xl border border-border p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 bg-surface-alt p-1 rounded-xl border border-border-light self-start">
          <button
            onClick={() => {
              setActiveTab('senders')
              setSearchTerm('')
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${
              activeTab === 'senders'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface'
            }`}
          >
            <Truck className="w-4 h-4" />
            Senders / Shippers
            <span className={`px-1.5 py-0.2 rounded-full text-[11px] ${
              activeTab === 'senders' ? 'bg-white/20 text-white' : 'bg-border text-text-tertiary'
            }`}>
              {senders.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('receivers')
              setSearchTerm('')
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${
              activeTab === 'receivers'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Receivers / Consignees
            <span className={`px-1.5 py-0.2 rounded-full text-[11px] ${
              activeTab === 'receivers' ? 'bg-white/20 text-white' : 'bg-border text-text-tertiary'
            }`}>
              {receivers.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'senders' ? 'senders' : 'receivers'} by name, phone, company, city...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-7 h-7 text-primary animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-text-tertiary font-medium">Loading {activeTab}...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-3 text-text-tertiary border border-border">
              {activeTab === 'senders' ? <Truck className="w-6 h-6" /> : <MapPin className="w-6 h-6" />}
            </div>
            <h3 className="text-[15px] font-bold text-text-primary mb-1">
              {searchTerm ? `No ${activeTab} match "${searchTerm}"` : `No ${activeTab} saved yet`}
            </h3>
            <p className="text-[13px] text-text-tertiary max-w-md mx-auto mb-5">
              {searchTerm
                ? 'Try searching with a different name, phone number, company, or pincode.'
                : `Add your frequently used ${activeTab === 'senders' ? 'senders' : 'receivers'} or import a CSV list to quickly autofill shipments.`}
            </p>
            {!searchTerm && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-[13px] font-bold rounded-xl hover:bg-primary-dark transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add First {activeTab === 'senders' ? 'Sender' : 'Receiver'}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-alt/70 border-b border-border text-[11px] font-extrabold text-text-tertiary uppercase tracking-wider">
                  <th className="py-3.5 px-4">Contact & Company</th>
                  <th className="py-3.5 px-4">Phone & Email</th>
                  <th className="py-3.5 px-4">Address Details</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Tax / Identity Doc</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[13px]">
                {filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-alt/40 transition-colors group">
                    {/* Name & Company */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-navy leading-snug">
                        {item.name || '—'}
                      </div>
                      {item.company && (
                        <div className="text-[11px] font-semibold text-text-tertiary flex items-center gap-1 mt-0.5 uppercase">
                          <Building className="w-3 h-3 text-text-tertiary/70" />
                          {item.company}
                        </div>
                      )}
                    </td>

                    {/* Phone & Email */}
                    <td className="py-3.5 px-4">
                      {item.phone && (
                        <div className="font-mono text-[12px] font-bold text-text-primary flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {item.phone}
                        </div>
                      )}
                      {item.email && (
                        <div className="text-[11px] text-text-secondary flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3 text-primary/70" />
                          {item.email}
                        </div>
                      )}
                      {!item.phone && !item.email && <span className="text-text-tertiary">—</span>}
                    </td>

                    {/* Address */}
                    <td className="py-3.5 px-4 max-w-[260px]">
                      <p className="text-text-secondary line-clamp-1 font-medium text-[12px]">
                        {item.address || '—'}
                      </p>
                      {item.address_2 && (
                        <p className="text-[11px] text-text-tertiary line-clamp-1 mt-0.5">
                          {item.address_2}
                        </p>
                      )}
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-navy text-[12px]">
                        {[item.city, item.state].filter(Boolean).join(', ') || '—'}
                      </div>
                      <div className="text-[11px] text-text-tertiary flex items-center gap-1.5 mt-0.5">
                        {item.pincode && <span className="font-mono font-bold text-text-secondary">{item.pincode}</span>}
                        {item.pincode && item.country && <span>•</span>}
                        {item.country && <span className="font-bold uppercase text-primary text-[10px]">{getFullCountryName(item.country)}</span>}
                      </div>
                    </td>

                    {/* Doc */}
                    <td className="py-3.5 px-4">
                      {item.gstin_no ? (
                        <div className="inline-flex flex-col">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary">
                            {item.gstin_type || 'Doc No'}
                          </span>
                          <span className="font-mono font-extrabold text-[12px] text-navy">
                            {item.gstin_no}
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-tertiary text-[11px]">None</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-lg text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger-bg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={closeModal}
          />
          <div
            className="relative bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col my-auto z-10 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top subtle gradient highlight bar */}
            <div className={`h-1.5 w-full ${activeTab === 'senders' ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`} />

            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-border flex items-center justify-between bg-surface-alt/40 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs ${
                  activeTab === 'senders' 
                    ? 'bg-blue-50 border border-blue-200 text-blue-600' 
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                }`}>
                  {activeTab === 'senders' ? <Truck className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[17px] font-black text-navy tracking-tight">
                      {editingItem ? `Edit ${activeTab === 'senders' ? 'Sender' : 'Receiver'}` : `Add New ${activeTab === 'senders' ? 'Sender' : 'Receiver'}`}
                    </h2>
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                      activeTab === 'senders'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {activeTab === 'senders' ? 'Pickup Address' : 'Delivery Address'}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-0.5">
                    Saved details will auto-fill in booking invoices and dispatch manifests.
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* SECTION 1: Contact Information */}
              <div className="bg-surface-alt/40 border border-border/80 rounded-2xl p-4.5 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <UserCheck className="w-4 h-4 text-primary" />
                  <span className="text-[12px] font-black text-navy uppercase tracking-wide">
                    1. Contact Information
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                      Contact / Full Name <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-text-primary font-bold focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                      Company Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Global Logistics"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-text-primary focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                      Primary Phone <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-text-primary font-mono focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                      Secondary Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Landline / Alternate Mobile"
                      value={formData.phone_2}
                      onChange={(e) => setFormData({ ...formData, phone_2: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-text-primary font-mono focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. contact@domain.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-text-primary focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Address Details */}
              <div className="bg-surface-alt/40 border border-border/80 rounded-2xl p-4.5 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-[12px] font-black text-navy uppercase tracking-wide">
                    2. Address Location
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                      Address Line 1 <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Building No, Flat / Office No, Street Name"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-text-primary focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      placeholder="Landmark, Area, Sector, Industrial Estate"
                      value={formData.address_2}
                      onChange={(e) => setFormData({ ...formData, address_2: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-text-primary focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                        City <span className="text-primary">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Surat"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-text-primary font-bold focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                        State
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Gujarat"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-text-primary focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                        Pincode / Postal <span className="text-primary">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 395007"
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-navy font-mono font-bold focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                      Country <span className="text-primary">*</span>
                    </label>
                    <CountryAutocompleteInput
                      value={formData.country}
                      onChange={(val) => setFormData({ ...formData, country: (val || '').toUpperCase() })}
                      placeholder="Select Country (e.g. INDIA, UNITED STATES, UNITED ARAB EMIRATES)"
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-primary font-bold uppercase focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                      countryList={countryList}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Tax Identification & Customs */}
              <div className="bg-surface-alt/40 border border-border/80 rounded-2xl p-4.5 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <Hash className="w-4 h-4 text-primary" />
                  <span className="text-[12px] font-black text-navy uppercase tracking-wide">
                    3. Tax / Identity Document (For Customs Dispatch)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                      Document Type
                    </label>
                    <select
                      value={formData.gstin_type}
                      onChange={(e) => setFormData({ ...formData, gstin_type: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-text-primary font-bold focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs cursor-pointer"
                    >
                      <option value="GSTIN">GSTIN (India)</option>
                      <option value="PAN">PAN Card (India)</option>
                      <option value="Aadhaar">Aadhaar (India)</option>
                      <option value="Passport">Passport Number</option>
                      <option value="VAT">VAT / Tax ID (International)</option>
                      <option value="EIN">EIN / SSN (USA)</option>
                      <option value="EORI">EORI (Europe / UK)</option>
                      <option value="OTHER">Other Identification</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                      Document / Identification Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 24AAAAA0000A1Z5 / ABXPK1234F"
                      value={formData.gstin_no}
                      onChange={(e) => setFormData({ ...formData, gstin_no: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-navy font-mono font-bold uppercase focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-text-secondary hover:bg-surface-hover border border-border/80 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white bg-primary hover:bg-primary-dark transition-all duration-200 shadow-sm hover:shadow-primary/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save {activeTab === 'senders' ? 'Sender' : 'Receiver'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Bulk Import Modal ── */}
      {isImportOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setIsImportOpen(false)}
          />
          <div
            className="relative bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col my-auto z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-alt/60 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[16px] font-extrabold text-navy">
                    Import {activeTab === 'senders' ? 'Senders' : 'Receivers'} from CSV
                  </h2>
                  <p className="text-[11px] text-text-tertiary">
                    Upload a CSV file with contact details to bulk insert them into your address book.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportOpen(false)}
                className="p-1.5 rounded-xl hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Dropzone & Sample Download */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-surface-alt border border-dashed border-border">
                <div>
                  <h4 className="text-[13px] font-bold text-navy">Need a template?</h4>
                  <p className="text-[11px] text-text-tertiary">
                    Download our formatted CSV template with required contact and address headers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleCSV}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface border border-border text-[12px] font-bold text-navy rounded-xl hover:bg-surface-hover shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-primary" />
                  Download Sample CSV
                </button>
              </div>

              {/* Upload Input */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border hover:border-primary/50 bg-surface-alt/50 hover:bg-primary/5 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200"
                >
                  <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-[13px] font-bold text-navy">Click to browse and upload CSV file</p>
                  <p className="text-[11px] text-text-tertiary mt-1">Supports UTF-8 encoded .csv files</p>
                </div>
              </div>

              {/* Preview Table */}
              {importData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-extrabold text-navy">
                      Preview ({importData.length} records detected)
                    </span>
                    <button
                      onClick={() => setImportData([])}
                      className="text-[11px] font-bold text-danger hover:underline"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="border border-border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-surface-alt sticky top-0 border-b border-border">
                        <tr className="font-extrabold text-text-tertiary uppercase tracking-wider">
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Company</th>
                          <th className="py-2 px-3">Phone</th>
                          <th className="py-2 px-3">City</th>
                          <th className="py-2 px-3">Country</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {importData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-surface-alt/50">
                            <td className="py-2 px-3 font-mono text-text-tertiary">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-navy">{row.name}</td>
                            <td className="py-2 px-3 text-text-secondary">{row.company || '—'}</td>
                            <td className="py-2 px-3 font-mono text-text-secondary">{row.phone}</td>
                            <td className="py-2 px-3">{row.city}</td>
                            <td className="py-2 px-3 uppercase">{row.country || 'INDIA'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-surface-alt/60 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="px-4 py-2 rounded-xl text-[13px] font-bold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importData.length === 0 || importMutation.isPending}
                onClick={() => importMutation.mutate(importData)}
                className="px-5 py-2 rounded-xl text-[13px] font-bold text-white bg-primary hover:bg-primary-dark transition-all duration-200 shadow-sm hover:shadow-primary/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {importMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Import {importData.length} {activeTab === 'senders' ? 'Senders' : 'Receivers'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
