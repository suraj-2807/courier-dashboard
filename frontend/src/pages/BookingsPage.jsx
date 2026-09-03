import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
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
  AlertTriangle,
  DollarSign,
  Tag,
  Printer,
  RefreshCw,
  Calendar,
  Globe,
  Truck,
  Filter,
  SlidersHorizontal
} from 'lucide-react'
import { bookingsApi } from '../api/bookings.api'
import { getActiveVendors } from '../api/apiSettings.api'
import StatusBadge from '../components/ui/StatusBadge'
import Pagination from '../components/ui/Pagination'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { formatCurrency, formatDate, formatDateDDMMYYYY } from '../utils/formatters'
import { exportShipmentsToExcel } from '../utils/exportShipmentsExcel'
import { openVendorDocument, openPdfBlob } from '../utils/openVendorDocument'
import toast from 'react-hot-toast'

const ISO_COUNTRY_MAP = {
  IN: 'INDIA',
  IND: 'INDIA',
  US: 'UNITED STATES',
  USA: 'UNITED STATES',
  GB: 'UNITED KINGDOM',
  GBR: 'UNITED KINGDOM',
  UK: 'UNITED KINGDOM',
  CA: 'CANADA',
  CAN: 'CANADA',
  AU: 'AUSTRALIA',
  AUS: 'AUSTRALIA',
  AE: 'UNITED ARAB EMIRATES',
  ARE: 'UNITED ARAB EMIRATES',
  UAE: 'UNITED ARAB EMIRATES',
  MW: 'MALAWI',
  MWI: 'MALAWI',
  ZM: 'ZAMBIA',
  ZMB: 'ZAMBIA',
  ZW: 'ZIMBABWE',
  ZWE: 'ZIMBABWE',
  MZ: 'MOZAMBIQUE',
  MOZ: 'MOZAMBIQUE',
  TZ: 'TANZANIA',
  TZA: 'TANZANIA',
  KE: 'KENYA',
  KEN: 'KENYA',
  UG: 'UGANDA',
  UGA: 'UGANDA',
  RW: 'RWANDA',
  RWA: 'RWANDA',
  CD: 'DR CONGO',
  COD: 'DR CONGO',
  ZA: 'SOUTH AFRICA',
  ZAF: 'SOUTH AFRICA',
  NG: 'NIGERIA',
  NGA: 'NIGERIA',
  GH: 'GHANA',
  GHA: 'GHANA',
  NZ: 'NEW ZEALAND',
  NZL: 'NEW ZEALAND',
  SG: 'SINGAPORE',
  SGP: 'SINGAPORE',
  MY: 'MALAYSIA',
  MYS: 'MALAYSIA',
  TH: 'THAILAND',
  THA: 'THAILAND',
  ID: 'INDONESIA',
  IDN: 'INDONESIA',
  PH: 'PHILIPPINES',
  PHL: 'PHILIPPINES',
  VN: 'VIETNAM',
  VNM: 'VIETNAM',
  CN: 'CHINA',
  CHN: 'CHINA',
  HK: 'HONG KONG',
  HKG: 'HONG KONG',
  JP: 'JAPAN',
  JPN: 'JAPAN',
  KR: 'SOUTH KOREA',
  KOR: 'SOUTH KOREA',
  DE: 'GERMANY',
  DEU: 'GERMANY',
  FR: 'FRANCE',
  FRA: 'FRANCE',
  IT: 'ITALY',
  ITA: 'ITALY',
  ES: 'SPAIN',
  ESP: 'SPAIN',
  NL: 'NETHERLANDS',
  NLD: 'NETHERLANDS',
  BE: 'BELGIUM',
  BEL: 'BELGIUM',
  CH: 'SWITZERLAND',
  CHE: 'SWITZERLAND',
  AT: 'AUSTRIA',
  AUT: 'AUSTRIA',
  SE: 'SWEDEN',
  SWE: 'SWEDEN',
  NO: 'NORWAY',
  NOR: 'NORWAY',
  DK: 'DENMARK',
  DNK: 'DENMARK',
  FI: 'FINLAND',
  FIN: 'FINLAND',
  IE: 'IRELAND',
  IRL: 'IRELAND',
  PT: 'PORTUGAL',
  PRT: 'PORTUGAL',
  PL: 'POLAND',
  POL: 'POLAND',
  TR: 'TURKEY',
  TUR: 'TURKEY',
  SA: 'SAUDI ARABIA',
  SAU: 'SAUDI ARABIA',
  QA: 'QATAR',
  QAT: 'QATAR',
  KW: 'KUWAIT',
  KWT: 'KUWAIT',
  OM: 'OMAN',
  OMN: 'OMAN',
  BH: 'BAHRAIN',
  BHR: 'BAHRAIN',
  LK: 'SRI LANKA',
  LKA: 'SRI LANKA',
  BD: 'BANGLADESH',
  BGD: 'BANGLADESH',
  NP: 'NEPAL',
  NPL: 'NEPAL',
  MU: 'MAURITIUS',
  MUS: 'MAURITIUS',
  SC: 'SEYCHELLES',
  SYC: 'SEYCHELLES',
  BR: 'BRAZIL',
  BRA: 'BRAZIL',
  MX: 'MEXICO',
  MEX: 'MEXICO',
  AR: 'ARGENTINA',
  ARG: 'ARGENTINA',
  CL: 'CHILE',
  CHL: 'CHILE',
  CO: 'COLOMBIA',
  COL: 'COLOMBIA',
  PE: 'PERU',
  PER: 'PERU',
  EG: 'EGYPT',
  EGY: 'EGYPT',
  ET: 'ETHIOPIA',
  ETH: 'ETHIOPIA',
  BW: 'BOTSWANA',
  BWA: 'BOTSWANA',
  NA: 'NAMIBIA',
  NAM: 'NAMIBIA',
  SZ: 'ESWATINI',
  SWZ: 'ESWATINI',
  LS: 'LESOTHO',
  LSO: 'LESOTHO',
  MG: 'MADAGASCAR',
  MDG: 'MADAGASCAR'
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

function getForwardingInfo(b) {
  const clean = (val) => {
    if (val === undefined || val === null) return ''
    const s = String(val).trim()
    if (!s || s === '0' || s === '0.00' || s === 'null' || s === 'undefined' || s === 'None' || s === '-' || s === '—') return ''
    return s
  }

  let rawData = null
  if (b?.vendor_raw_response) {
    try {
      const raw = typeof b.vendor_raw_response === 'string' ? JSON.parse(b.vendor_raw_response) : b.vendor_raw_response
      rawData = raw?.response || raw?.data || raw
    } catch {}
  }

  const ourAwb = clean(b?.tracking_number)
  const primaryVendorAwb = clean(
    b?.vendor_awb_number || rawData?.AwbNo || rawData?.awbNo || rawData?.AWBNo || rawData?.docket_no || rawData?.docketNo || ''
  )

  const isValidFwd = (val) => {
    const c = clean(val)
    if (!c) return ''
    if (c === primaryVendorAwb || c === ourAwb) return ''
    return c
  }

  // Check explicit database columns first
  let fwdNo = isValidFwd(b?.vendor_awb_number_2) || isValidFwd(b?.forwarding_no) || isValidFwd(b?.vendor_awb_2) || isValidFwd(b?.awb_2) || isValidFwd(b?.secondary_awb)
  let carrier = b?.secondary_carrier || b?.forwarding_vendor || b?.forwarded_vendor || ''

  // Fallback to raw response ONLY if strictly distinct from primary vendor AWB and our AWB
  if (!fwdNo && rawData) {
    const rawFwd = clean(
      rawData?.ForwardingNo || rawData?.ForwardingNo1 || rawData?.forwarding_no || rawData?.Forwarding_No || rawData?.vendor_awb_2 || rawData?.vendorAwb2
    )
    if (isValidFwd(rawFwd)) {
      fwdNo = rawFwd
      if (!carrier && (rawData?.ForwardingCarrier || rawData?.Carrier || rawData?.carrier || rawData?.secondary_carrier)) {
        carrier = rawData?.ForwardingCarrier || rawData?.Carrier || rawData?.carrier || rawData?.secondary_carrier
      }
    }
  }

  if (fwdNo && (!carrier || carrier === 'Forwarded Vendor' || carrier === 'Carrier')) {
    if (/^1Z/i.test(fwdNo)) carrier = 'UPS'
    else if (/^[0-9]{12}$/.test(fwdNo)) carrier = 'FedEx'
    else if (/^[0-9]{10}$/.test(fwdNo)) carrier = 'DHL'
  }

  return {
    forwardingNo: fwdNo || '',
    forwardingCarrier: carrier ? String(carrier).trim() : '',
    primaryVendorAwb
  }
}

/**
 * Parses a forwarding number string that may contain multiple piece AWBs
 * (e.g. "1550 3036 0794 51Q 1550 3036 0794 52O 1550 3036 0794 53M 1550 3036 0794 54K").
 * Returns an array of individual numbers if matched, or a single-item array otherwise.
 */
export function parseForwardingNumbers(raw) {
  if (!raw || typeof raw !== 'string') return []
  let text = raw.trim()
  if (!text) return []
  text = text.replace(/^FWD\s*:\s*/i, '')

  // Specific 4-block pattern: 4 digits, space, 4 digits, space, 4 digits, space, 2-4 alphanumeric characters
  const blockPattern = /\b\d{4}\s+\d{4}\s+\d{4}\s+[0-9A-Za-z]+\b/g
  const blockMatches = text.match(blockPattern)
  if (blockMatches && blockMatches.length > 1) {
    return blockMatches
  }

  // Also handle newline, comma, or semicolon separated multi-AWBs
  if (/[\n,;]/.test(text)) {
    const parts = text.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
    if (parts.length > 1) return parts
  }

  return [text]
}

const STATUS_TABS = [
  { value: '', label: 'All Shipments' },
  { value: 'booked', label: 'Booking' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'draft', label: 'Draft' },
  { value: 'trashed', label: 'Trash', isTrash: true }
]

export default function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const page = Math.max(1, parseInt(searchParams.get('page')) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit')) || 10))
  const search = searchParams.get('search') || ''
  const statusFilter = searchParams.get('status') || ''
  const vendorFilter = searchParams.get('vendor') || ''
  const countryFilter = searchParams.get('country') || ''
  const fromDateFilter = searchParams.get('from_date') || ''
  const toDateFilter = searchParams.get('to_date') || ''

  const [searchInput, setSearchInput] = useState(search)
  const [selectedIds, setSelectedIds] = useState([])
  const [isExporting, setIsExporting] = useState(false)
  const [syncingRowIds, setSyncingRowIds] = useState(new Set())
  const autoSyncedIdsRef = useRef(new Set())
  const navigate = useNavigate()
  const pushToApiMutation = usePushBookingToApi()
  const [pushingId, setPushingId] = useState(null)

  // Fetch full country codes list
  const { data: countryCodesData } = useQuery({
    queryKey: ['country-codes'],
    queryFn: () => countryCodesApi.getAll().then(res => res.data),
    staleTime: 1000 * 60 * 30
  })

  // Fetch active vendor API configurations for vendor dropdown
  const { data: activeVendorsData } = useQuery({
    queryKey: ['active-vendors'],
    queryFn: getActiveVendors,
    staleTime: 1000 * 60 * 10
  })
  const activeVendors = activeVendorsData?.vendors || []

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

  const availableCountries = useMemo(() => {
    // Use actual distinct countries from shipments data returned by the API
    const apiCountries = data?.distinctCountries || []
    if (apiCountries.length > 0) {
      const set = new Set()
      apiCountries.forEach(c => {
        if (c) {
          // Resolve ISO codes to full names using the map
          const resolved = countryCodeToNameMap[c.trim().toUpperCase()] || c.trim().toUpperCase()
          set.add(resolved)
        }
      })
      return Array.from(set).sort()
    }
    return []
  }, [data?.distinctCountries, countryCodeToNameMap])

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
    status: statusFilter,
    vendor: vendorFilter,
    country: countryFilter,
    from_date: fromDateFilter,
    to_date: toDateFilter
  })

  // Automatic live forwarding and delivery status sync when shipments load on the page
  useEffect(() => {
    if (!data?.bookings?.length) return

    const pendingSyncIds = data.bookings
      .filter((b) => {
        if (b.status === 'delivered' || b.status === 'cancelled' || b.is_trashed) return false
        if (!b.vendor_awb_number && !b.tracking_number) return false
        return true
      })
      .map((b) => b.id)
      .filter((id) => !autoSyncedIdsRef.current.has(id))

    if (pendingSyncIds.length > 0) {
      pendingSyncIds.forEach((id) => autoSyncedIdsRef.current.add(id))
      setSyncingRowIds((prev) => new Set([...prev, ...pendingSyncIds]))

      bookingsApi
        .syncTracking(pendingSyncIds)
        .then((res) => {
          const summary = res.data?.summary
          if (summary?.updatedDelivered > 0 || summary?.updatedInTransit > 0 || summary?.updatedForwarding > 0) {
            refetch()
          }
        })
        .catch(() => {})
        .finally(() => {
          setSyncingRowIds((prev) => {
            const next = new Set(prev)
            pendingSyncIds.forEach((id) => next.delete(id))
            return next
          })
        })
    }
  }, [data?.bookings, refetch])

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

  // 1. Open our official Shipping Bill (Waybill) PDF (Dollar icon)
  const handleOpenOurBillRow = async (b) => {
    const toastId = toast.loading('Loading Our Shipping Bill...')
    try {
      const res = await bookingsApi.downloadWaybill(b.id)
      const awb = b.tracking_number || b.order_id || b.id
      openPdfBlob(res.data, `ShippingBill_${awb}.pdf`)
      toast.success('Our Shipping Bill opened successfully', { id: toastId })
    } catch (err) {
      toast.error('Failed to open Shipping Bill', { id: toastId })
    }
  }

  // 2. Open Vendor Invoice (File icon)
  const handleOpenVendorInvoiceRow = (b) => {
    openVendorDocument(b, 'vendor_invoice')
  }

  // 3. Open Vendor Shipper Copy / Vendor Bill (Download icon)
  const handleOpenVendorShipperCopyRow = (b) => {
    openVendorDocument(b, 'vendor_shipper_copy')
  }

  // 4. Open Vendor Label / Box Label (Box icon)
  const handleOpenVendorBoxLabelRow = (b) => {
    openVendorDocument(b, 'vendor_box_label')
  }

  // 5. Open Our Prince Official Box / Thermal Label PDF (Tag icon)
  const handleOpenPrinceLabelRow = async (b) => {
    const toastId = toast.loading('Loading Our Box Label...')
    try {
      const res = await bookingsApi.downloadBoxLabels(b.id)
      const awb = b.tracking_number || b.order_id || b.id
      openPdfBlob(res.data, `BoxLabels_${awb}.pdf`)
      toast.success('Our Box Label opened successfully', { id: toastId })
    } catch (err) {
      toast.error('Failed to open Prince Label', { id: toastId })
    }
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

  const handleLimitChange = (newLimit) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (newLimit === 10) {
        next.delete('limit')
      } else {
        next.set('limit', String(newLimit))
      }
      next.delete('page')
      return next
    })
  }

  const handleVendorChange = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) {
        next.set('vendor', val)
      } else {
        next.delete('vendor')
      }
      next.delete('page')
      return next
    })
  }

  const handleCountryChange = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) {
        next.set('country', val)
      } else {
        next.delete('country')
      }
      next.delete('page')
      return next
    })
  }

  const handleFromDateChange = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) {
        next.set('from_date', val)
      } else {
        next.delete('from_date')
      }
      next.delete('page')
      return next
    })
  }

  const handleToDateChange = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) {
        next.set('to_date', val)
      } else {
        next.delete('to_date')
      }
      next.delete('page')
      return next
    })
  }

  const handleDatePreset = (preset) => {
    const today = new Date()
    const formatDateForInput = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (preset === 'today') {
        const str = formatDateForInput(today)
        next.set('from_date', str)
        next.set('to_date', str)
      } else if (preset === 'yesterday') {
        const y = new Date(today)
        y.setDate(today.getDate() - 1)
        const str = formatDateForInput(y)
        next.set('from_date', str)
        next.set('to_date', str)
      } else if (preset === '7days') {
        const d7 = new Date(today)
        d7.setDate(today.getDate() - 7)
        next.set('from_date', formatDateForInput(d7))
        next.set('to_date', formatDateForInput(today))
      } else if (preset === 'month') {
        const mStart = new Date(today.getFullYear(), today.getMonth(), 1)
        next.set('from_date', formatDateForInput(mStart))
        next.set('to_date', formatDateForInput(today))
      } else if (preset === 'all') {
        next.delete('from_date')
        next.delete('to_date')
      }
      next.delete('page')
      return next
    })
  }

  const handleClearAllFilters = () => {
    setSearchInput('')
    setSearchParams({})
  }

  const hasActiveFilters = Boolean(search || vendorFilter || countryFilter || fromDateFilter || toDateFilter)

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
    if (e && e.preventDefault) e.preventDefault()
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
                placeholder="Search AWB, Vendor AWB, Shipper, Consignee, Destination, Date..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary outline-none w-full"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-text-tertiary hover:text-text-secondary cursor-pointer p-0.5"
                  title="Clear search"
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

        {/* Secondary Filter Bar: Date Filter, Vendor Filter, Destination Country Filter */}
        <div className="px-4 py-3 border-t border-border bg-surface-alt/40 flex flex-wrap items-center justify-between gap-3 text-[12px]">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5 bg-surface border border-border px-2.5 py-1.5 rounded-xl shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Date:</span>
              <input
                type="date"
                value={fromDateFilter}
                onChange={(e) => handleFromDateChange(e.target.value)}
                className="bg-transparent text-text-primary text-[12px] outline-none cursor-pointer"
                title="From Date"
              />
              <span className="text-text-tertiary font-bold text-[11px]">to</span>
              <input
                type="date"
                value={toDateFilter}
                onChange={(e) => handleToDateChange(e.target.value)}
                className="bg-transparent text-text-primary text-[12px] outline-none cursor-pointer"
                title="To Date"
              />
              {(fromDateFilter || toDateFilter) && (
                <button
                  type="button"
                  onClick={() => handleDatePreset('all')}
                  className="text-text-tertiary hover:text-danger p-0.5 cursor-pointer ml-1"
                  title="Clear dates"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7days', label: '7 Days' },
                { id: 'month', label: 'This Month' }
              ].map((p) => {
                const today = new Date()
                const formatDateForInput = (d) => {
                  const y = d.getFullYear()
                  const m = String(d.getMonth() + 1).padStart(2, '0')
                  const day = String(d.getDate()).padStart(2, '0')
                  return `${y}-${m}-${day}`
                }
                const todayStr = formatDateForInput(today)
                const yest = new Date(today)
                yest.setDate(today.getDate() - 1)
                const yestStr = formatDateForInput(yest)
                const d7 = new Date(today)
                d7.setDate(today.getDate() - 7)
                const d7Str = formatDateForInput(d7)
                const mStart = new Date(today.getFullYear(), today.getMonth(), 1)
                const mStartStr = formatDateForInput(mStart)

                const isActive = (
                  (p.id === 'today' && fromDateFilter === todayStr && toDateFilter === todayStr) ||
                  (p.id === 'yesterday' && fromDateFilter === yestStr && toDateFilter === yestStr) ||
                  (p.id === '7days' && fromDateFilter === d7Str && toDateFilter === todayStr) ||
                  (p.id === 'month' && fromDateFilter === mStartStr && toDateFilter === todayStr)
                )

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleDatePreset(p.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      isActive
                        ? 'bg-navy text-white shadow-2xs'
                        : 'bg-surface border border-border text-text-secondary hover:text-navy hover:bg-surface-hover'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* Vendor / Carrier Filter */}
            <div className="flex items-center gap-1.5 bg-surface border border-border px-2.5 py-1.5 rounded-xl shadow-2xs">
              <Truck className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
              <select
                value={vendorFilter}
                onChange={(e) => handleVendorChange(e.target.value)}
                className="bg-transparent text-text-primary text-[12px] font-semibold outline-none cursor-pointer max-w-[170px]"
              >
                <option value="">All Vendors / Carriers</option>
                {activeVendors.map((v) => (
                  <option key={v.id} value={v.vendor_code || v.id}>
                    {v.name} {v.vendor_code ? `(${v.vendor_code})` : ''}
                  </option>
                ))}
              </select>
              {vendorFilter && (
                <button
                  type="button"
                  onClick={() => handleVendorChange('')}
                  className="text-text-tertiary hover:text-danger p-0.5 cursor-pointer"
                  title="Clear vendor filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Country Filter */}
            <div className="flex items-center gap-1.5 bg-surface border border-border px-2.5 py-1.5 rounded-xl shadow-2xs">
              <Globe className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <select
                value={countryFilter}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="bg-transparent text-text-primary text-[12px] font-semibold outline-none cursor-pointer max-w-[160px]"
              >
                <option value="">All Countries</option>
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {countryFilter && (
                <button
                  type="button"
                  onClick={() => handleCountryChange('')}
                  className="text-text-tertiary hover:text-danger p-0.5 cursor-pointer"
                  title="Clear country filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ml-auto"
              title="Reset all active search and filters"
            >
              <RotateCcw className="w-3 h-3 text-red-600" />
              <span>Reset Filters</span>
            </button>
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
                    {['Our AWB', 'Vendor AWB', 'Forwarding No.', 'Shipper', 'Consignee', 'Status', 'Actions'].map((h) => (
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
                  {data.bookings.map((b) => {
                    const fwd = getForwardingInfo(b)
                    return (
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

                      {/* Our AWB (7-digit) & Date */}
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
                        <div className="text-[11px] font-medium text-text-tertiary mt-0.5">
                          {formatDateDDMMYYYY(b.created_at || b.booking_date)}
                        </div>
                      </td>

                      {/* Vendor AWB (Dedicated Column) */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          {(b.vendor_awb_number || fwd.primaryVendorAwb) ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[12px] font-bold text-[#1a237e]">
                                {b.vendor_awb_number || fwd.primaryVendorAwb}
                              </span>
                              <CopyButton text={b.vendor_awb_number || fwd.primaryVendorAwb} label="Vendor AWB copied!" />
                            </div>
                          ) : (
                            <span className="text-[12px] text-text-tertiary italic">—</span>
                          )}
                          <span className="block text-[10px] text-text-tertiary font-medium">
                            {b.vendor_api_configs?.name || b.courier_providers?.name || 'Local'}
                          </span>
                        </div>
                      </td>

                      {/* Forwarding Number / Vendor AWB 2 (Dedicated Column) */}
                      <td className="px-4 py-3.5">
                        {fwd.forwardingNo ? (
                          (() => {
                            const formattedFwd = parseForwardingNumbers(fwd.forwardingNo).join('\n')
                            return (
                              <div className="space-y-0.5">
                                <div className="flex items-start gap-1.5 flex-wrap">
                                  <span className="inline-flex items-start gap-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11.5px] font-bold text-amber-900 shadow-2xs select-all">
                                    <span className="text-[9px] uppercase tracking-wider text-amber-700 font-extrabold select-none pt-0.5">FWD:</span>
                                    <span className="whitespace-pre-line font-mono leading-tight">{formattedFwd}</span>
                                  </span>
                                  <CopyButton text={formattedFwd} label="Forwarding number copied!" />
                                </div>
                                <span className="block text-[10px] text-text-tertiary font-medium">
                                  {fwd.forwardingCarrier || 'Forwarded Vendor'}
                                </span>
                              </div>
                            )
                          })()
                        ) : syncingRowIds.has(b.id) ? (
                          <div className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50/80 border border-amber-200/60 px-2 py-0.5 rounded-md animate-pulse">
                            <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-600" />
                            <span>Syncing...</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-text-tertiary italic">—</span>
                        )}
                      </td>

                      {/* Shipper (Full name wrap) */}
                      <td className="px-4 py-3.5 min-w-[130px] max-w-[180px] align-middle">
                        <div>
                          <p className="text-[12px] text-text-primary font-bold break-words whitespace-normal leading-snug">
                            {b.senders?.name || b.sender_name || '—'}
                          </p>
                          <p className="text-[10px] text-text-tertiary font-medium uppercase mt-0.5">
                            {getFullCountryName(b.senders?.country || b.sender_country || 'INDIA')}
                          </p>
                          {b.customer_id || b.customer_type === 'registered' ? (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded max-w-full truncate">
                                <span className="font-mono font-black shrink-0">CUST-{String(b.customer_id || '').padStart(4, '0')}</span>
                                {b.customer_name && b.customer_name !== 'Walk-in Customer' && (
                                  <span className="truncate">{b.customer_name}</span>
                                )}
                              </span>
                            </div>
                          ) : (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                Walk-in Customer
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Consignee (Full name wrap) */}
                      <td className="px-4 py-3.5 min-w-[130px] max-w-[180px] align-middle">
                        <div>
                          <p className="text-[12px] text-text-primary font-bold break-words whitespace-normal leading-snug">
                            {b.receivers?.name || b.receiver_name || '—'}
                          </p>
                          <p className="text-[10px] text-text-tertiary font-medium uppercase mt-0.5">
                            {getFullCountryName(b.receivers?.country || b.receiver_country || b.receivers?.city || '—')}
                          </p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={b.status} size="xs" />
                          {Boolean(b.is_locked) && (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded tracking-wide">
                              LOCKED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
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
                              {/* 1. View details */}
                              <Link
                                to={`/bookings/${b.id}`}
                                className="p-1.5 text-text-secondary hover:text-navy hover:bg-surface-hover rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>

                              {/* 2. Dollar icon: Our Bill / Waybill */}
                              <button
                                type="button"
                                onClick={() => handleOpenOurBillRow(b)}
                                className="p-1.5 text-navy hover:text-primary hover:bg-navy/5 rounded-lg transition-colors cursor-pointer"
                                title="Our Shipping Bill / Waybill"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>

                              {/* 3. File icon: Vendor Invoice */}
                              <button
                                type="button"
                                onClick={() => handleOpenVendorInvoiceRow(b)}
                                className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                title="Vendor Invoice (Commercial / Freeform Invoice)"
                              >
                                <FileText className="w-4 h-4" />
                              </button>

                              {/* 4. Download icon: Vendor AWB Copy / Vendor Bill */}
                              <button
                                type="button"
                                onClick={() => handleOpenVendorShipperCopyRow(b)}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Vendor AWB Copy / Vendor Bill"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              {/* 5. Box icon: Vendor Label */}
                              <button
                                type="button"
                                onClick={() => handleOpenVendorBoxLabelRow(b)}
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Vendor Box / Barcode Label"
                              >
                                <Package className="w-4 h-4" />
                              </button>

                              {/* 6. Tag icon: Our Label (Prince Box / Thermal Label) */}
                              <button
                                type="button"
                                onClick={() => handleOpenPrinceLabelRow(b)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Our Prince Box / Thermal Label"
                              >
                                <Tag className="w-4 h-4" />
                              </button>

                              {/* 7. Edit / View Booking Form */}
                              <Link
                                to={`/bookings/edit/${b.id}`}
                                className="p-1.5 text-navy hover:text-primary hover:bg-primary/5 rounded-lg transition-colors font-bold flex items-center gap-1 text-[11px]"
                                title={Boolean(b.is_locked) ? "View Booking Form (Locked)" : "Edit Booking"}
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">{Boolean(b.is_locked) ? 'Form' : 'Edit'}</span>
                              </Link>

                              {/* If unlocked / draft: Show Push button */}
                              {!Boolean(b.is_locked) && (
                                <button
                                  type="button"
                                  disabled={pushingId === b.id}
                                  onClick={() => handlePushRow(b)}
                                  className="px-2 py-1 bg-primary hover:bg-primary-dark text-white rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
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
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer with enhanced Pagination & Per-Page Limit Controls (10, 20, 50, 100) */}
            <div className="p-3 border-t border-border">
              <Pagination
                page={page}
                totalPages={data?.pagination?.totalPages || data?.totalPages || 1}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={handleLimitChange}
                total={data?.pagination?.total || data?.total || 0}
                limitOptions={[10, 20, 50, 100]}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
