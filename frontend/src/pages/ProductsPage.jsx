import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '../api/products.api'
import { countryCodesApi } from '../api/countryCodes.api'
import CountryAutocompleteInput from '../components/CountryAutocompleteInput'
import {
  Tag,
  Search,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Download,
  X,
  Globe,
  Loader2,
  FileSpreadsheet,
  Check,
  Building,
  HelpCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  name: '',
  hs_code: '',
  country: '',
  description: ''
}

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('ALL')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)

  // Import Modal State
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importData, setImportData] = useState([])
  const fileInputRef = useRef(null)

  // Fetch Country Codes
  const { data: countryCodesData } = useQuery({
    queryKey: ['country-codes'],
    queryFn: () => countryCodesApi.getAll().then(res => res.data)
  })
  const countryList = countryCodesData?.countryCodes || []

  // Products Query
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', selectedCountry, searchTerm],
    queryFn: () => productsApi.getAll({
      country: selectedCountry !== 'ALL' ? selectedCountry : undefined,
      search: searchTerm.trim() || undefined
    }).then(res => res.data)
  })
  const products = productsData?.products || []

  // Filtered list (if local filtering needed)
  const filteredProducts = useMemo(() => {
    return products.filter(item => {
      const matchSearch = !searchTerm.trim() ||
        (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.hs_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchTerm.toLowerCase())

      const matchCountry = selectedCountry === 'ALL' ||
        (item.country || '').toUpperCase() === selectedCountry.toUpperCase() ||
        (selectedCountry === 'GLOBAL' && (!item.country || item.country.toUpperCase() === 'ALL'))

      return matchSearch && matchCountry
    })
  }, [products, searchTerm, selectedCountry])

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingItem?.id) {
        return productsApi.update(editingItem.id, data)
      } else {
        return productsApi.create(data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(`Product ${editingItem?.id ? 'updated' : 'created'} successfully!`)
      closeModal()
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save product')
    }
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return productsApi.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product deleted successfully')
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete product')
    }
  })

  // Bulk Import Mutation
  const importMutation = useMutation({
    mutationFn: async (items) => {
      return productsApi.bulkImport(items)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(res.data?.message || `Imported ${res.data?.imported || importData.length} products!`)
      setIsImportOpen(false)
      setImportData([])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to import products')
    }
  })

  const openAddModal = () => {
    setEditingItem(null)
    setFormData(EMPTY_FORM)
    setIsModalOpen(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setFormData({
      name: item.name || '',
      hs_code: item.hs_code || '',
      country: item.country || '',
      description: item.description || ''
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
      toast.error('Product Name is required')
      return
    }
    if (!formData.hs_code.trim()) {
      toast.error('HSN Code is required')
      return
    }
    saveMutation.mutate(formData)
  }

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete product "${name || 'this item'}"?`)) {
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
        toast.error('Failed to parse CSV file. Please check format.')
      }
    }
    reader.readAsText(file)
  }

  const parseCSV = (csvText) => {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const records = []

    for (let i = 1; i < lines.length; i++) {
      const matches = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || lines[i].split(',')
      const values = matches.map(val => val.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))

      const record = { ...EMPTY_FORM }
      headers.forEach((header, colIndex) => {
        const val = values[colIndex] || ''
        if (header.includes('name') || header.includes('product') || header.includes('item')) {
          record.name = val
        } else if (header.includes('hs') || header.includes('hsn') || header.includes('tariff')) {
          record.hs_code = val
        } else if (header.includes('country')) {
          record.country = val
        } else if (header.includes('desc') || header.includes('note')) {
          record.description = val
        }
      })

      if (record.name && record.hs_code) {
        records.push(record)
      }
    }

    return records
  }

  const downloadSampleCSV = () => {
    const headers = 'product_name,hs_code,country,description'
    const sample1 = 'Cotton Men T-Shirt,61091000,US,100% Cotton Knitted T-Shirt'
    const sample2 = 'Leather Handbag,42022100,GB,Genuine Leather Ladies Handbag'
    const sample3 = 'Handicraft Wooden Box,44209090,,Decorative Sheesham Wood Box'
    const sample4 = 'Ayurvedic Herbal Soap,34011110,AE,Natural Herbal Body Soap'
    const content = `${headers}\n${sample1}\n${sample2}\n${sample3}\n${sample4}`

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'Sample_Products_HSN.csv')
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
              <Tag className="w-5 h-5" />
            </div>
            Products & HSN Directory
          </h1>
          <p className="text-[13px] text-text-tertiary mt-1">
            Maintain product catalog and country-wise HSN codes. Typing product name in booking invoices will auto-fill description & HSN code.
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
            Add Product & HSN
          </button>
        </div>
      </div>

      {/* ── Filter & Search Bar ── */}
      <div className="bg-surface rounded-2xl border border-border p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Country Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCountry('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCountry === 'ALL'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-alt hover:bg-surface text-text-secondary border border-border-light'
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            onClick={() => setSelectedCountry('GLOBAL')}
            className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              selectedCountry === 'GLOBAL'
                ? 'bg-navy text-white shadow-xs'
                : 'bg-surface-alt hover:bg-surface text-text-secondary border border-border-light'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Global (All Countries)
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search product name, HSN code, or description..."
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
            <p className="text-[13px] text-text-tertiary font-medium">Loading products catalog...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-3 text-text-tertiary border border-border">
              <Tag className="w-6 h-6" />
            </div>
            <h3 className="text-[15px] font-bold text-text-primary mb-1">
              {searchTerm ? `No products match "${searchTerm}"` : 'No products added yet'}
            </h3>
            <p className="text-[13px] text-text-tertiary max-w-md mx-auto mb-5">
              {searchTerm
                ? 'Try searching with a different product name or HSN code.'
                : 'Add your frequent shipment items and HSN codes or import a CSV file to speed up invoice generation.'}
            </p>
            {!searchTerm && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-[13px] font-bold rounded-xl hover:bg-primary-dark transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add First Product
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-alt/70 border-b border-border text-[11px] font-extrabold text-text-tertiary uppercase tracking-wider">
                  <th className="py-3.5 px-4">Product Name / Item Description</th>
                  <th className="py-3.5 px-4">HSN / Tariff Code</th>
                  <th className="py-3.5 px-4">Country Scope</th>
                  <th className="py-3.5 px-4">Notes / Details</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[13px]">
                {filteredProducts.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-alt/40 transition-colors group">
                    {/* Product Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-navy leading-snug">
                        {item.name}
                      </div>
                    </td>

                    {/* HSN Code */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-extrabold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg text-[12px]">
                        {item.hs_code}
                      </span>
                    </td>

                    {/* Country Scope */}
                    <td className="py-3.5 px-4">
                      {item.country && item.country !== 'ALL' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-navy text-[11px] bg-surface-alt border border-border px-2 py-0.5 rounded-md uppercase">
                          {item.country}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 text-[11px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          <Globe className="w-3 h-3 text-emerald-600" />
                          Global (All)
                        </span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 text-text-secondary text-[12px] max-w-[260px] truncate">
                      {item.description || '—'}
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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-alt/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[16px] font-extrabold text-navy">
                    {editingItem ? 'Edit Product & HSN' : 'Add New Product & HSN'}
                  </h2>
                  <p className="text-[11px] text-text-tertiary">
                    This will appear in autocomplete suggestions when creating invoice items.
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-xl hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1">
                  Product / Item Name <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cotton T-Shirt, Leather Shoes, Ayurvedic Soap"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary font-semibold focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1">
                  HSN / Tariff Code (6 to 8 Digits) <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 61091000"
                  value={formData.hs_code}
                  onChange={(e) => setFormData({ ...formData, hs_code: e.target.value.replace(/\s+/g, '') })}
                  className="w-full px-3.5 py-2 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary font-mono font-bold focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1">
                  Country Scope (Leave blank or select Global for all destinations)
                </label>
                <CountryAutocompleteInput
                  value={formData.country}
                  onChange={(val) => setFormData({ ...formData, country: val })}
                  placeholder="Global / All Countries (or search e.g. USA, UK, UAE)"
                  className="w-full px-3.5 py-2 bg-surface-alt border border-border rounded-xl text-[13px] text-primary font-bold uppercase focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  countryList={countryList}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1">
                  Description / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional material specs, composition, or custom notes"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none"
                />
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl text-[13px] font-bold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-5 py-2 rounded-xl text-[13px] font-bold text-white bg-primary hover:bg-primary-dark transition-all duration-200 shadow-sm hover:shadow-primary/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Import Modal ── */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-alt/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[16px] font-extrabold text-navy">
                    Import Products & HSN Codes from CSV
                  </h2>
                  <p className="text-[11px] text-text-tertiary">
                    Upload a CSV file with columns: product_name, hs_code, country, description.
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-surface-alt border border-dashed border-border">
                <div>
                  <h4 className="text-[13px] font-bold text-navy">Need a template?</h4>
                  <p className="text-[11px] text-text-tertiary">
                    Download our formatted CSV template with required columns.
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
                          <th className="py-2 px-3">Product Name</th>
                          <th className="py-2 px-3">HSN Code</th>
                          <th className="py-2 px-3">Country</th>
                          <th className="py-2 px-3">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {importData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-surface-alt/50">
                            <td className="py-2 px-3 font-mono text-text-tertiary">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-navy">{row.name}</td>
                            <td className="py-2 px-3 font-mono text-primary font-bold">{row.hs_code}</td>
                            <td className="py-2 px-3 uppercase">{row.country || 'Global'}</td>
                            <td className="py-2 px-3 text-text-secondary truncate max-w-[150px]">{row.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-surface-alt/60">
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
                Import {importData.length} Products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
