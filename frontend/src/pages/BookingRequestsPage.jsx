import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  MapPin,
  Package,
  Eye,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Boxes,
  FileText,
  Paperclip
} from 'lucide-react'
import api from '../api/axios'
import toast, { Toaster } from 'react-hot-toast'

const STATUS_TABS = [
  { key: '', label: 'All', icon: ClipboardList },
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'processing', label: 'Processing', icon: Loader2 },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'rejected', label: 'Rejected', icon: XCircle }
]

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500'
  },
  processing: {
    label: 'Processing',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500'
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500'
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500'
  }
}

export default function BookingRequestsPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState({ all: 0, pending: 0, processing: 0, confirmed: 0, rejected: 0 })
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(null)

  const fetchRequests = async (page = 1) => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (activeTab) params.status = activeTab
      if (search) params.search = search
      const { data } = await api.get('/booking-requests', { params })
      setRequests(data.requests || [])
      setCounts(data.counts || {})
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 })
    } catch (err) {
      toast.error('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests(1)
  }, [activeTab])

  const handleSearch = () => fetchRequests(1)

  const handleViewDetail = async (id) => {
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/booking-requests/${id}`)
      setSelectedRequest(data.request)
    } catch (err) {
      toast.error('Failed to load request details')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleUpdateStatus = async (id, status, notes = '') => {
    try {
      await api.patch(`/booking-requests/${id}/status`, { status, admin_notes: notes })
      toast.success(`Request ${status}`)
      setSelectedRequest(null)
      setShowRejectModal(null)
      fetchRequests(pagination.page)
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const handleConfirmAndBook = async (request) => {
    // Fetch full request data (with parsed parcels/invoice_items) from API
    try {
      const { data } = await api.get(`/booking-requests/${request.id}`)
      const fullRequest = data.request || request

      // Navigate to new booking page with full request data via state
      // NOTE: We do NOT mark as 'processing' here. Status will be updated
      // only when the booking is actually created in NewBookingPage.
      const params = new URLSearchParams({
        from_request: fullRequest.id,
        request_awb: fullRequest.request_awb
      })
      navigate(`/bookings/new?${params.toString()}`, {
        state: { requestData: fullRequest }
      })
    } catch (err) {
      toast.error('Failed to load request data')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <Toaster position="top-right" />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-extrabold text-text-primary tracking-tight">Customer Requests</h1>
        <p className="text-[14px] text-text-secondary mt-1">Review and process booking requests submitted by customers</p>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {STATUS_TABS.map(tab => {
          const count = tab.key === '' ? counts.all : counts[tab.key] || 0
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer border
                ${active
                  ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                  : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                active ? 'bg-white/20 text-white' : 'bg-surface-alt text-text-tertiary'
              }`}>
                {count}
              </span>
            </button>
          )
        })}

        {/* Refresh */}
        <button
          onClick={() => fetchRequests(pagination.page)}
          className="ml-auto p-2 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-text-secondary" />
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <Search className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by AWB, customer name, city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary outline-none w-full"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-5 py-2.5 bg-primary text-white text-[13px] font-bold rounded-xl hover:bg-primary-dark transition-colors cursor-pointer"
        >
          Search
        </button>
      </div>

      {/* Requests Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-surface-alt">
                <th className="text-left px-5 py-3 text-[10px] font-extrabold text-text-tertiary uppercase tracking-[1.5px]">AWB</th>
                <th className="text-left px-5 py-3 text-[10px] font-extrabold text-text-tertiary uppercase tracking-[1.5px]">Customer</th>
                <th className="text-left px-5 py-3 text-[10px] font-extrabold text-text-tertiary uppercase tracking-[1.5px]">Route</th>
                <th className="text-left px-5 py-3 text-[10px] font-extrabold text-text-tertiary uppercase tracking-[1.5px]">Package</th>
                <th className="text-left px-5 py-3 text-[10px] font-extrabold text-text-tertiary uppercase tracking-[1.5px]">Date</th>
                <th className="text-left px-5 py-3 text-[10px] font-extrabold text-text-tertiary uppercase tracking-[1.5px]">Status</th>
                <th className="text-center px-5 py-3 text-[10px] font-extrabold text-text-tertiary uppercase tracking-[1.5px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-4 bg-surface-alt rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                    </td>
                  </tr>
                ))
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <ClipboardList className="w-10 h-10 text-text-tertiary/30 mx-auto mb-3" />
                    <p className="text-[14px] font-semibold text-text-tertiary">No requests found</p>
                    <p className="text-[12px] text-text-tertiary/70 mt-1">Customer booking requests will appear here</p>
                  </td>
                </tr>
              ) : (
                requests.map(req => {
                  const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
                  return (
                    <tr key={req.id} className="border-b border-border/50 hover:bg-surface-alt/50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-[14px] font-bold text-text-primary font-mono tracking-wider">
                          {req.request_awb}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-text-primary truncate max-w-[140px]">
                              {req.customer_name || req.sender_name || '—'}
                            </p>
                            <p className="text-[11px] text-text-tertiary truncate max-w-[140px]">
                              {req.customer_phone || req.sender_phone || ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-[12px] text-text-secondary">
                          <span className="font-semibold">{req.sender_city || '—'}</span>
                          <ArrowRight className="w-3 h-3 text-text-tertiary" />
                          <span className="font-semibold">{req.receiver_city || '—'}, {req.receiver_country || ''}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-[12px]">
                          <span className="font-semibold text-text-primary">{req.weight || 0} kg</span>
                          <span className="text-text-tertiary ml-1.5">· {req.no_of_pieces || 1} pc</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[12px] text-text-secondary font-medium">
                          {formatDate(req.created_at)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${sc.bg} ${sc.text} ${sc.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewDetail(req.id)}
                            className="p-2 rounded-lg border border-border hover:bg-surface-hover transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-text-secondary" />
                          </button>
                          {req.status === 'pending' && (
                            <button
                              onClick={() => handleConfirmAndBook(req)}
                              className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary-dark transition-colors cursor-pointer"
                            >
                              Process →
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-alt">
            <span className="text-[12px] text-text-tertiary">
              Showing <strong className="text-text-secondary">{requests.length}</strong> of <strong className="text-text-secondary">{pagination.total}</strong> · Page {pagination.page}/{pagination.totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => fetchRequests(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="w-8 h-8 rounded-lg border border-border bg-surface flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                const start = Math.max(1, pagination.page - 2)
                const pg = start + i
                if (pg > pagination.totalPages) return null
                return (
                  <button
                    key={pg}
                    onClick={() => fetchRequests(pg)}
                    className={`w-8 h-8 rounded-lg border text-[12px] font-bold flex items-center justify-center transition-colors cursor-pointer ${
                      pg === pagination.page
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                    }`}
                  >
                    {pg}
                  </button>
                )
              })}
              <button
                onClick={() => fetchRequests(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="w-8 h-8 rounded-lg border border-border bg-surface flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/*  DETAIL SLIDE-OVER PANEL               */}
      {/* ═══════════════════════════════════════ */}

      {selectedRequest && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50"
            onClick={() => setSelectedRequest(null)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-[560px] max-w-full bg-surface border-l border-border z-50 overflow-y-auto animate-slide-in-right">
            {/* Header */}
            <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center">
                  <ClipboardList className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-[16px] font-extrabold text-text-primary">Request #{selectedRequest.request_awb}</h3>
                  <p className="text-[11px] text-text-tertiary">{formatDate(selectedRequest.created_at)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="w-8 h-8 rounded-lg border border-border bg-surface hover:bg-surface-hover flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Badge */}
              {(() => {
                const sc = STATUS_CONFIG[selectedRequest.status] || STATUS_CONFIG.pending
                return (
                  <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${sc.bg} ${sc.border}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${sc.dot}`} />
                    <span className={`text-[14px] font-bold ${sc.text}`}>{sc.label}</span>
                  </div>
                )
              })()}

              {/* Customer Info */}
              <DetailSection title="Customer" icon={User}>
                <DetailGrid>
                  <DetailField label="Name" value={selectedRequest.customer_name || selectedRequest.sender_name} />
                  <DetailField label="Phone" value={selectedRequest.customer_phone || selectedRequest.sender_phone} />
                  <DetailField label="Email" value={selectedRequest.customer_email || selectedRequest.sender_email} full />
                </DetailGrid>
              </DetailSection>

              {/* Sender */}
              <DetailSection title="Sender" icon={User}>
                <DetailGrid>
                  <DetailField label="Name" value={selectedRequest.sender_name} />
                  <DetailField label="Company" value={selectedRequest.sender_company} />
                  <DetailField label="Phone" value={selectedRequest.sender_phone} />
                  <DetailField label="Email" value={selectedRequest.sender_email} />
                  <DetailField label="Address" value={[selectedRequest.sender_address, selectedRequest.sender_address_2].filter(Boolean).join(', ')} full />
                  <DetailField label="City" value={selectedRequest.sender_city} />
                  <DetailField label="Pincode" value={selectedRequest.sender_pincode} />
                  <DetailField label="State" value={selectedRequest.sender_state} />
                  <DetailField label="Country" value={selectedRequest.sender_country} />
                  {selectedRequest.sender_gstin_type && (
                    <DetailField label={selectedRequest.sender_gstin_type} value={selectedRequest.sender_gstin_no} full />
                  )}
                </DetailGrid>
              </DetailSection>

              {/* Receiver */}
              <DetailSection title="Receiver" icon={MapPin}>
                <DetailGrid>
                  <DetailField label="Name" value={selectedRequest.receiver_name} />
                  <DetailField label="Phone" value={selectedRequest.receiver_phone} />
                  <DetailField label="Email" value={selectedRequest.receiver_email} />
                  <DetailField label="Address" value={[selectedRequest.receiver_address, selectedRequest.receiver_address_2].filter(Boolean).join(', ')} full />
                  <DetailField label="City" value={selectedRequest.receiver_city} />
                  <DetailField label="Pincode" value={selectedRequest.receiver_pincode} />
                  <DetailField label="State" value={selectedRequest.receiver_state} />
                  <DetailField label="Country" value={selectedRequest.receiver_country} />
                  {selectedRequest.receiver_gstin_type && (
                    <DetailField label={selectedRequest.receiver_gstin_type} value={selectedRequest.receiver_gstin_no} full />
                  )}
                </DetailGrid>
              </DetailSection>

              {/* Package */}
              <DetailSection title="Package" icon={Package}>
                <DetailGrid>
                  <DetailField label="Type" value={selectedRequest.package_type} />
                  <DetailField label="Weight" value={`${selectedRequest.weight || 0} kg`} />
                  <DetailField label="Pieces" value={selectedRequest.no_of_pieces} />
                  <DetailField label="Declared Value" value={`₹${selectedRequest.declared_value || 0}`} />
                  {(selectedRequest.length > 0 || selectedRequest.breadth > 0 || selectedRequest.height > 0) && (
                    <DetailField
                      label="Dimensions (L×W×H)"
                      value={`${selectedRequest.length || 0} × ${selectedRequest.breadth || 0} × ${selectedRequest.height || 0} cm`}
                      full
                    />
                  )}
                  <DetailField label="Content" value={selectedRequest.content_description} full />
                  {selectedRequest.is_fragile ? (
                    <DetailField label="Fragile" value="⚠️ Yes — Handle with care" full />
                  ) : null}
                </DetailGrid>
              </DetailSection>

              {/* Parcels & Dimensions Table */}
              {(() => {
                const parcels = typeof selectedRequest.parcels === 'string'
                  ? (() => { try { return JSON.parse(selectedRequest.parcels) } catch { return null } })()
                  : selectedRequest.parcels
                if (!Array.isArray(parcels) || parcels.length === 0) return null
                return (
                  <DetailSection title={`Parcels & Dimensions (${parcels.length} boxes)`} icon={Boxes}>
                    <div className="overflow-x-auto border border-border rounded-xl">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="bg-surface-alt border-b border-border">
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">Box</th>
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">Weight (kg)</th>
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">L × B × H (cm)</th>
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">Vol. Wt</th>
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">Chg. Wt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parcels.map((p, i) => (
                            <tr key={i} className="border-b border-border/50 last:border-0">
                              <td className="px-3 py-2 font-semibold text-text-primary">{p.box_no || i + 1}</td>
                              <td className="px-3 py-2 text-text-secondary">{p.weight || '—'}</td>
                              <td className="px-3 py-2 text-text-secondary">{p.length || 0} × {p.breadth || 0} × {p.height || 0}</td>
                              <td className="px-3 py-2 text-text-secondary">{p.volumetric_weight || '—'}</td>
                              <td className="px-3 py-2 font-semibold text-text-primary">{p.chargeable_weight || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DetailSection>
                )
              })()}

              {/* Invoice Items Table */}
              {(() => {
                const items = typeof selectedRequest.invoice_items === 'string'
                  ? (() => { try { return JSON.parse(selectedRequest.invoice_items) } catch { return null } })()
                  : selectedRequest.invoice_items
                if (!Array.isArray(items) || items.length === 0) return null
                return (
                  <DetailSection title={`Invoice Items (${items.length})`} icon={FileText}>
                    <div className="overflow-x-auto border border-border rounded-xl">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="bg-surface-alt border-b border-border">
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">#</th>
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">Box</th>
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">Description</th>
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">HS Code</th>
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">Qty</th>
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">Rate</th>
                            <th className="px-3 py-2 text-left font-bold text-text-tertiary uppercase text-[9px] tracking-[1px]">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, i) => (
                            <tr key={i} className="border-b border-border/50 last:border-0">
                              <td className="px-3 py-2 text-text-tertiary">{item.sr_no || i + 1}</td>
                              <td className="px-3 py-2 text-text-secondary">{item.box_no || '—'}</td>
                              <td className="px-3 py-2 font-semibold text-text-primary max-w-[160px] truncate">{item.description || '—'}</td>
                              <td className="px-3 py-2 text-text-secondary">{item.hs_code || '—'}</td>
                              <td className="px-3 py-2 text-text-secondary">{item.quantity || '—'} {item.unit_type || ''}</td>
                              <td className="px-3 py-2 text-text-secondary">{item.unit_rates || item.rate || '—'}</td>
                              <td className="px-3 py-2 font-semibold text-text-primary">₹{item.amount || item.cost || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DetailSection>
                )
              })()}

              {/* Attached Documents */}
              {(() => {
                const docs = typeof selectedRequest.documents === 'string'
                  ? (() => { try { return JSON.parse(selectedRequest.documents) } catch { return null } })()
                  : selectedRequest.documents
                if (!Array.isArray(docs) || docs.length === 0) return null
                return (
                  <DetailSection title={`Attached Documents (${docs.length})`} icon={Paperclip}>
                    <div className="space-y-2">
                      {docs.map((doc, i) => (
                        <div key={i} className="flex items-center gap-3 bg-surface-alt border border-border rounded-xl px-3.5 py-2.5">
                          <Paperclip className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-text-primary truncate">{doc.doc_type || doc.name || `Document ${i + 1}`}</p>
                            {doc.doc_number && <p className="text-[10px] text-text-tertiary">No: {doc.doc_number}</p>}
                          </div>
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-primary hover:underline">View</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                )
              })()}

              {/* Remarks */}
              {selectedRequest.remarks && (
                <DetailSection title="Customer Notes" icon={AlertCircle}>
                  <p className="text-[13px] text-text-secondary bg-surface-alt rounded-xl p-4 border border-border">
                    {selectedRequest.remarks}
                  </p>
                </DetailSection>
              )}

              {/* Admin Notes */}
              {selectedRequest.admin_notes && (
                <DetailSection title="Admin Notes" icon={AlertCircle}>
                  <p className="text-[13px] text-text-secondary bg-surface-alt rounded-xl p-4 border border-border">
                    {selectedRequest.admin_notes}
                  </p>
                </DetailSection>
              )}

              {/* Action Buttons */}
              {(selectedRequest.status === 'pending' || selectedRequest.status === 'processing') && (
                <div className="flex gap-3 pt-4 border-t border-border">
                  <button
                    onClick={() => handleConfirmAndBook(selectedRequest)}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white text-[13px] font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-primary/20"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Process & Create Booking
                  </button>
                  <button
                    onClick={() => setShowRejectModal(selectedRequest.id)}
                    className="px-5 py-3 border border-red-200 text-red-600 text-[13px] font-bold rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[60]" onClick={() => setShowRejectModal(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface border border-border rounded-2xl p-6 w-[420px] max-w-[90vw] z-[60] shadow-2xl">
            <h3 className="text-[16px] font-extrabold text-text-primary mb-2">Reject Request</h3>
            <p className="text-[13px] text-text-secondary mb-4">Optionally provide a reason for rejection.</p>
            <textarea
              rows={3}
              placeholder="Reason for rejection (optional)..."
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              className="w-full p-3 border border-border rounded-xl text-[13px] text-text-primary bg-surface-alt outline-none focus:border-primary/40 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRejectModal(null); setRejectNotes('') }}
                className="flex-1 px-4 py-2.5 border border-border rounded-xl text-[13px] font-semibold text-text-secondary hover:bg-surface-hover cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus(showRejectModal, 'rejected', rejectNotes)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700 cursor-pointer transition-colors"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </>
      )}

      {/* Slide-in animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in-right { animation: slideInRight 0.3s ease-out; }
      `}} />
    </div>
  )
}

// ═══════════════════════════════════════
//  HELPER COMPONENTS
// ═══════════════════════════════════════

function DetailSection({ title, icon: Icon, children }) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-[11px] font-extrabold text-text-tertiary uppercase tracking-[1.5px] mb-3">
        {Icon && <Icon className="w-4 h-4 text-primary" />}
        {title}
      </h4>
      {children}
    </div>
  )
}

function DetailGrid({ children }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

function DetailField({ label, value, full }) {
  if (!value && value !== 0) return null
  return (
    <div className={`bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 ${full ? 'col-span-2' : ''}`}>
      <p className="text-[9px] font-extrabold text-text-tertiary uppercase tracking-[1px] mb-0.5">{label}</p>
      <p className="text-[13px] font-semibold text-text-primary">{value}</p>
    </div>
  )
}
