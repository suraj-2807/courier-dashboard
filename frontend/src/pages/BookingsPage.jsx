import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useBookings, usePushBookingToApi } from '../hooks/useBookings'
import { countryCodesApi } from '../api/countryCodes.api'
import {
  Search,
  Download,
  Package,
  Plus,
  X,
  MoreVertical,
  ChevronDown,
  Edit,
  Send,
  Eye,
  Loader2,
  FileText,
  Copy,
  Check,
  Trash2,
  RotateCcw,
  AlertTriangle
} from 'lucide-react'
import { bookingsApi } from '../api/bookings.api'
import StatusBadge from '../components/ui/StatusBadge'
import Pagination from '../components/ui/Pagination'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { formatCurrency, formatDate } from '../utils/formatters'
import { exportShipmentsToExcel } from '../utils/exportShipmentsExcel'
import { openVendorDocument } from '../utils/openVendorDocument'
import toast from 'react-hot-toast'

const ISO_COUNTRY_MAP = {
  IN: 'INDIA',
  IND: 'INDIA',
  US: 'UNITED STATES',
  USA: 'UNITED STATES',
  GB: 'UNITED KINGDOM',
  UK: 'UNITED KINGDOM',
  CA: 'CANADA',
  CAN: 'CANADA',
  AU: 'AUSTRALIA',
  AUS: 'AUSTRALIA',
  AE: 'UNITED ARAB EMIRATES',
  UAE: 'UNITED ARAB EMIRATES',
  MW: 'MALAWI',
  ZM: 'ZAMBIA',
  ZW: 'ZIMBABWE',
  MZ: 'MOZAMBIQUE',
  TZ: 'TANZANIA',
  KE: 'KENYA',
  UG: 'UGANDA',
  RW: 'RWANDA',
  CD: 'DR CONGO',
  ZA: 'SOUTH AFRICA',
  NG: 'NIGERIA',
  GH: 'GHANA',
  NZ: 'NEW ZEALAND',
  SG: 'SINGAPORE',
  MY: 'MALAYSIA',
  TH: 'THAILAND',
  ID: 'INDONESIA',
  PH: 'PHILIPPINES',
  VN: 'VIETNAM',
  CN: 'CHINA',
  HK: 'HONG KONG',
  JP: 'JAPAN',
  KR: 'SOUTH KOREA',
  DE: 'GERMANY',
  FR: 'FRANCE',
  IT: 'ITALY',
  ES: 'SPAIN',
  NL: 'NETHERLANDS',
  BE: 'BELGIUM',
  CH: 'SWITZERLAND',
  AT: 'AUSTRIA',
  SE: 'SWEDEN',
  NO: 'NORWAY',
  DK: 'DENMARK',
  FI: 'FINLAND',
  IE: 'IRELAND',
  PT: 'PORTUGAL',
  PL: 'POLAND',
  TR: 'TURKEY',
  SA: 'SAUDI ARABIA',
  QA: 'QATAR',
  KW: 'KUWAIT',
  OM: 'OMAN',
  BH: 'BAHRAIN',
  LK: 'SRI LANKA',
  BD: 'BANGLADESH',
  NP: 'NEPAL',
  MU: 'MAURITIUS',
  SC: 'SEYCHELLES',
  BR: 'BRAZIL',
  MX: 'MEXICO',
  AR: 'ARGENTINA',
  CL: 'CHILE',
  CO: 'COLOMBIA',
  PE: 'PERU',
  EG: 'EGYPT',
  ET: 'ETHIOPIA',
  BW: 'BOTSWANA',
  NA: 'NAMIBIA',
  SZ: 'ESWATINI',
  LS: 'LESOTHO',
  MG: 'MADAGASCAR'
}

function CopyButton({ text, label = 'Copied to clipboard!' }) {
  const [copied, setCopied] = useState(false)
  if (!text) return null
  const handleCopy = (e) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(String(text).trim())
    setCopied(true)
    toast.success(label)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 text-text-tertiary hover:text-primary hover:bg-surface-hover rounded transition-colors cursor-pointer inline-flex items-center"
      title={`Copy ${text}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 animate-scale-in" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

const STATUS_TABS = [
  { value: '', label: 'All Shipments' },
  { value: 'draft', label: 'Draft' },
  { value: 'booked', label: 'Booked' },
  { value: 'processing', label: 'Processing' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'trashed', label: 'Trash', isTrash: true }
]

export default function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, parseInt(searchParams.get('page')) || 1)
  const search = searchParams.get('search') || ''
  const statusFilter = searchParams.get('status') || ''

  const [searchInput, setSearchInput] = useState(search)
  const [selectedIds, setSelectedIds] = useState([])
  const [isExporting, setIsExporting] = useState(false)
  const limit = 10
  const navigate = useNavigate()
  const pushToApiMutation = usePushBookingToApi()
  const [pushingId, setPushingId] = useState(null)

  // Fetch full country codes list
  const { data: countryCodesData } = useQuery({
    queryKey: ['country-codes'],
    queryFn: () => countryCodesApi.getAll().then(res => res.data),
    staleTime: 1000 * 60 * 30
  })

  const countryCodeToNameMap = useMemo(() => {
    const map = { ...ISO_COUNTRY_MAP }
    const list = countryCodesData?.countryCodes || []
    list.forEach(item => {
      if (item.country_code && item.country_name) {
        map[item.country_code.trim().toUpperCase()] = item.country_name.trim().toUpperCase()
      }
    })
    return map
  }, [countryCodesData])

  const getFullCountryName = (codeOrName) => {
    if (!codeOrName || codeOrName === '—') return '—'
    const clean = String(codeOrName).trim().toUpperCase()
    return countryCodeToNameMap[clean] || codeOrName
  }

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  const { data, isLoading, isError, refetch } = useBookings({
    page,
    limit,
    search,
    status: statusFilter
  })

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const res = await bookingsApi.getAll({
        page: 1,
        limit: 5000,
        search,
        status: statusFilter
      })
      const shipmentsToExport = res?.data?.bookings || data?.bookings || []
      if (shipmentsToExport.length === 0) {
        toast.error('No shipments found to export')
        return
      }
      const filterTag = statusFilter ? `_${statusFilter}` : ''
      const dateTag = new Date().toISOString().split('T')[0]
      exportShipmentsToExcel(shipmentsToExport, `PrinceExp_Shipments${filterTag}_${dateTag}.xlsx`)
      toast.success(`Exported ${shipmentsToExport.length} shipments to Excel successfully!`)
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Failed to export shipments: ' + (err.message || 'Unknown error'))
    } finally {
      setIsExporting(false)
    }
  }

  const handlePushRow = async (booking) => {
    if (!booking.vendor_config_id) {
      toast.error('Please select a vendor API before pushing')
      navigate(`/bookings/edit/${booking.id}`)
      return
    }

    setPushingId(booking.id)
    try {
      const res = await pushToApiMutation.mutateAsync(booking.id)
      toast.success(res.message || 'Booking pushed to Vendor API!')
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to push booking')
    } finally {
      setPushingId(null)
    }
  }

  // Open our official Shipping Bill (Waybill) PDF
  const handleOpenOurBillRow = async (b) => {
    const toastId = toast.loading('Opening Shipping Bill...')
    try {
      const res = await bookingsApi.downloadWaybill(b.id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      toast.success('Shipping Bill opened in new tab', { id: toastId })
    } catch (err) {
      toast.error('Failed to open Shipping Bill', { id: toastId })
    }
  }

  // Open Vendor Invoice (from API response)
  const handleOpenInvoiceRow = (b) => {
    openVendorDocument(b, 'invoice')
  }

  // Open Vendor Label (from API response)
  const handleOpenLabelRow = (b) => {
    openVendorDocument(b, 'label')
  }

  const setPage = (newPageOrFn) => {
    const targetPage = typeof newPageOrFn === 'function' ? newPageOrFn(page) : newPageOrFn
    const validPage = Math.max(1, parseInt(targetPage) || 1)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (validPage > 1) {
        next.set('page', String(validPage))
      } else {
        next.delete('page')
      }
      return next
    })
  }

  const handleTabChange = (val) => {
    setSelectedIds([])
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) {
        next.set('status', val)
      } else {
        next.delete('status')
      }
      next.delete('page') // Reset to page 1 on tab filter change
      return next
    })
  }

  const handleSearch = (e) => {
    if (e.key === 'Enter' || e.type === 'submit') {
      e.preventDefault()
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        if (searchInput.trim()) {
          next.set('search', searchInput.trim())
        } else {
          next.delete('search')
        }
        next.delete('page')
        return next
      })
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('search')
      next.delete('page')
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!data?.bookings) return
    if (selectedIds.length === data.bookings.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(data.bookings.map(b => b.id))
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const allSelected = data?.bookings?.length > 0 && selectedIds.length === data.bookings.length

  const handleTrashBulk = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Move ${selectedIds.length} selected shipment(s) to Trash?`)) return
    try {
      await bookingsApi.trash(selectedIds)
      toast.success(`Moved ${selectedIds.length} shipment(s) to Trash`)
      setSelectedIds([])
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to move to Trash')
    }
  }

  const handleTrashSingle = async (booking) => {
    if (!window.confirm(`Move shipment #${booking.tracking_number || booking.id} to Trash?`)) return
    try {
      await bookingsApi.trash(booking.id)
      toast.success(`Shipment #${booking.tracking_number || booking.id} moved to Trash`)
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to move to Trash')
    }
  }

  const handleRestoreBulk = async () => {
    if (selectedIds.length === 0) return
    try {
      await bookingsApi.restore(selectedIds)
      toast.success(`Restored ${selectedIds.length} shipment(s) from Trash`)
      setSelectedIds([])
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to restore shipments')
    }
  }

  const handleRestoreSingle = async (booking) => {
    try {
      await bookingsApi.restore(booking.id)
      toast.success(`Shipment #${booking.tracking_number || booking.id} restored`)
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to restore shipment')
    }
  }

  const handleDeletePermanentBulk = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`⚠️ PERMANENT ACTION: Are you sure you want to permanently delete ${selectedIds.length} shipment(s)? This cannot be undone!`)) return
    try {
      await bookingsApi.deletePermanent(selectedIds)
      toast.success(`Permanently deleted ${selectedIds.length} shipment(s)`)
      setSelectedIds([])
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to permanently delete shipments')
    }
  }

  const handleDeletePermanentSingle = async (booking) => {
    if (!window.confirm(`⚠️ PERMANENT ACTION: Are you sure you want to permanently delete shipment #${booking.tracking_number || booking.id}? This cannot be undone!`)) return
    try {
      await bookingsApi.deletePermanent(booking.id)
      toast.success(`Permanently deleted shipment #${booking.tracking_number || booking.id}`)
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete shipment')
    }
  }

  const isTrashTab = statusFilter === 'trashed'

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-text-primary leading-tight">
            {isTrashTab ? 'Trash / Deleted Shipments' : 'Shipment Bookings'}
          </h1>
          <p className="text-[13px] text-text-secondary mt-1">
            {isTrashTab
              ? 'View, restore, or permanently remove discarded shipments.'
              : 'Manage, track, and analyze all active freight movements.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-[7px] border border-border rounded-xl text-[12px] font-bold text-navy bg-surface hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            title="Export shipments with complete form details to Excel (.xlsx)"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <Download className="w-3.5 h-3.5 text-navy" />
            )}
            <span>Export Excel</span>
          </button>
          {!isTrashTab && (
            <Link
              to="/bookings/new"
              className="flex items-center gap-1.5 px-4 py-[7px] bg-primary hover:bg-primary-dark text-white rounded-xl text-[12px] font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Shipment</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface border border-border rounded-2xl mb-4">
        <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center bg-surface-alt border border-border rounded-xl overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={`px-3.5 py-[7px] text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === tab.value
                    ? (tab.isTrash ? 'bg-danger text-white' : 'bg-primary text-white')
                    : (tab.isTrash ? 'text-danger hover:bg-danger-bg' : 'text-text-secondary hover:bg-surface-hover')
                }`}
              >
                {tab.isTrash && <Trash2 className="w-3.5 h-3.5" />}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="flex items-center gap-2 bg-surface-alt border border-border rounded-xl px-3.5 py-[7px] focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <Search className="w-4 h-4 text-text-tertiary flex-shrink-0" />
              <input
                type="text"
                placeholder="Filter by ID, Dest..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearch}
                className="bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary outline-none w-full"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}
                  className="text-text-tertiary hover:text-text-secondary cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Bulk Selection Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-fade-in flex-wrap">
              {isTrashTab ? (
                <>
                  <button
                    onClick={handleRestoreBulk}
                    className="flex items-center gap-1.5 px-3.5 py-[7px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12px] font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore ({selectedIds.length})
                  </button>
                  <button
                    onClick={handleDeletePermanentBulk}
                    className="flex items-center gap-1.5 px-3.5 py-[7px] bg-red-700 hover:bg-red-800 text-white rounded-xl text-[12px] font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Permanently ({selectedIds.length})
                  </button>
                </>
              ) : (
                <button
                  onClick={handleTrashBulk}
                  className="flex items-center gap-1.5 px-3.5 py-[7px] bg-danger hover:bg-danger-hover text-white rounded-xl text-[12px] font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Move to Trash ({selectedIds.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : isError ? (
          <ErrorState message="Failed to load shipments" onRetry={refetch} />
        ) : !data?.bookings?.length ? (
          <EmptyState
            icon={Package}
            title="No shipments found"
            description={
              statusFilter || search
                ? 'Try adjusting your search or filters.'
                : 'Create your first shipment to get started.'
            }
            action={
              (statusFilter || search) ? (
                <button
                  onClick={() => { setStatusFilter(''); setSearch(''); setSearchInput(''); setPage(1) }}
                  className="px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-primary-dark transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-alt/40">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </th>
                    {['Our AWB', 'Vendor / AWB', 'Shipper', 'Consignee', 'Status', 'Date', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] whitespace-nowrap ${
                          h === 'Actions' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.bookings.map((b) => (
                    <tr
                      key={b.id}
                      className={`border-b border-border-light hover:bg-surface-alt/40 transition-colors group ${
                        selectedIds.includes(b.id) ? 'bg-primary/[0.02]' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(b.id)}
                          onChange={() => toggleSelect(b.id)}
                          className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </td>
                      {/* Our AWB (7-digit) */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/bookings/${b.id}`}
                            className="group/awb"
                          >
                            <span className="text-[13px] font-extrabold text-[#BB0013] hover:underline">
                              {b.tracking_number || '—'}
                            </span>
                          </Link>
                          {b.tracking_number && (
                            <CopyButton text={b.tracking_number} label="Our AWB copied!" />
                          )}
                        </div>
                      </td>
                      {/* Vendor / AWB & Forwarding Number */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {b.vendor_awb_number ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[12px] font-bold text-[#1a237e]">
                                {b.vendor_awb_number}
                              </span>
                              <CopyButton text={b.vendor_awb_number} label="Vendor AWB copied!" />
                            </div>
                          ) : (
                            <span className="text-[11px] text-text-tertiary italic">—</span>
                          )}

                          {/* Forwarding Number (Vendor AWB 2 / UPS / FedEx / Carrier AWB) */}
                          {(b.vendor_awb_number_2 || b.forwarding_no) && (
                            <div className="inline-flex items-center gap-1 bg-amber-50/90 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-bold text-amber-900 shadow-2xs">
                              <span className="text-[9px] uppercase font-sans tracking-wider text-amber-700 font-extrabold">
                                {b.secondary_carrier || (/^1Z/i.test(b.vendor_awb_number_2 || b.forwarding_no) ? 'UPS AWB' : 'FWD')}:
                              </span>
                              <span className="select-all">{b.vendor_awb_number_2 || b.forwarding_no}</span>
                              <CopyButton text={b.vendor_awb_number_2 || b.forwarding_no} label="Forwarding AWB copied!" />
                            </div>
                          )}

                          <span className="block text-[10px] text-text-tertiary font-medium">
                            {b.vendor_api_configs?.name || b.courier_providers?.name || 'Local'}
                          </span>
                        </div>
                      </td>
                      {/* Shipper */}
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-[12px] text-text-primary font-bold">
                            {b.senders?.name || b.sender_name || '—'}
                          </p>
                          <p className="text-[10px] text-text-tertiary font-medium uppercase mt-0.5">
                            {getFullCountryName(b.senders?.country || b.sender_country || 'INDIA')}
                          </p>
                        </div>
                      </td>
                      {/* Consignee */}
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-[12px] text-text-primary font-bold">
                            {b.receivers?.name || b.receiver_name || '—'}
                          </p>
                          <p className="text-[10px] text-text-tertiary font-medium uppercase mt-0.5">
                            {getFullCountryName(b.receivers?.country || b.receiver_country || b.receivers?.city || '—')}
                          </p>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={b.status} size="xs" />
                        {Boolean(b.is_locked) && (
                          <span className="ml-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">LOCKED</span>
                        )}
                      </td>
                      {/* Date */}
                      <td className="px-4 py-3.5 text-[12px] text-text-secondary whitespace-nowrap">
                        {formatDate(b.created_at)}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isTrashTab ? (
                            <>
                              {/* Restore button */}
                              <button
                                type="button"
                                onClick={() => handleRestoreSingle(b)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                title="Restore Shipment"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Restore</span>
                              </button>

                              {/* Permanent delete button */}
                              <button
                                type="button"
                                onClick={() => handleDeletePermanentSingle(b)}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                title="Permanently Delete Shipment"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                <span>Delete Forever</span>
                              </button>
                            </>
                          ) : (
                            <>
                              {/* View details */}
                              <Link
                                to={`/bookings/${b.id}`}
                                className="p-1.5 text-text-secondary hover:text-navy hover:bg-surface-hover rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>

                              {/* Our Official Shipping Bill */}
                              <button
                                type="button"
                                onClick={() => handleOpenOurBillRow(b)}
                                className="p-1.5 text-navy hover:text-primary hover:bg-navy/5 rounded-lg transition-colors cursor-pointer"
                                title="Open Shipping Bill (Ours)"
                              >
                                <FileText className="w-4 h-4" />
                              </button>

                              {/* Vendor Invoice — open in new tab */}
                              <button
                                type="button"
                                onClick={() => handleOpenInvoiceRow(b)}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Open Vendor Invoice"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              {/* Vendor Label — open in new tab */}
                              <button
                                type="button"
                                onClick={() => handleOpenLabelRow(b)}
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Open Vendor Label"
                              >
                                <Package className="w-4 h-4" />
                              </button>

                              {/* Edit / View Booking Form */}
                              <Link
                                to={`/bookings/edit/${b.id}`}
                                className="p-1.5 text-navy hover:text-primary hover:bg-primary/5 rounded-lg transition-colors font-bold flex items-center gap-1 text-[11px]"
                                title={Boolean(b.is_locked) ? "View Booking Form (Locked)" : "Edit Booking"}
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{Boolean(b.is_locked) ? 'Form' : 'Edit'}</span>
                              </Link>

                              {/* If unlocked / draft: Show Push button */}
                              {!Boolean(b.is_locked) && (
                                <button
                                  type="button"
                                  disabled={pushingId === b.id}
                                  onClick={() => handlePushRow(b)}
                                  className="px-2.5 py-1 bg-primary hover:bg-primary-dark text-white rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="Push to Vendor API"
                                >
                                  {pushingId === b.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Send className="w-3 h-3" />
                                  )}
                                  <span>Push</span>
                                </button>
                              )}

                              {/* Move to Trash */}
                              <button
                                type="button"
                                onClick={() => handleTrashSingle(b)}
                                className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger-bg rounded-lg transition-colors cursor-pointer"
                                title="Move to Trash"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer with pagination */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <p className="text-[12px] text-text-tertiary font-medium">
                Showing {((data.pagination.page - 1) * limit) + 1} to {Math.min(data.pagination.page * limit, data.pagination.total)} of {data.pagination.total} entries
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border border-border rounded-lg text-[12px] font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page >= data.pagination.totalPages}
                  className="px-3 py-1.5 border border-border rounded-lg text-[12px] font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
