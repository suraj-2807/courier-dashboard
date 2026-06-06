import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBookings } from '../hooks/useBookings'
import {
  Search,
  Download,
  Package,
  Plus,
  X,
  MoreVertical,
  ChevronDown
} from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import Pagination from '../components/ui/Pagination'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { formatCurrency, formatDate } from '../utils/formatters'

const STATUS_TABS = [
  { value: '', label: 'All Shipments' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' }
]

export default function BookingsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const limit = 10

  const { data, isLoading, isError, refetch } = useBookings({
    page,
    limit,
    search,
    status: statusFilter
  })

  const handleSearch = (e) => {
    if (e.key === 'Enter' || e.type === 'submit') {
      e.preventDefault()
      setSearch(searchInput)
      setPage(1)
    }
  }

  const handleTabChange = (val) => {
    setStatusFilter(val)
    setPage(1)
    setSelectedIds([])
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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-text-primary leading-tight">
            Shipment Bookings
          </h1>
          <p className="text-[13px] text-text-secondary mt-1">
            Manage, track, and analyze all active freight movements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-4 py-[7px] border border-border rounded-xl text-[12px] font-semibold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <Link
            to="/bookings/new"
            className="flex items-center gap-1.5 px-4 py-[7px] bg-primary text-white rounded-xl text-[12px] font-bold hover:bg-primary-dark transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Create Shipment
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface border border-border rounded-2xl mb-4">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center bg-surface-alt border border-border rounded-xl overflow-hidden">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={`px-3.5 py-[7px] text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.value
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:bg-surface-hover'
                }`}
              >
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

          {/* Bulk Actions */}
          <div className="relative">
            <button
              onClick={() => setBulkMenuOpen(!bulkMenuOpen)}
              className="flex items-center gap-1.5 px-3.5 py-[7px] border border-border rounded-xl text-[12px] font-semibold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Bulk Actions
              <ChevronDown className="w-3 h-3" />
            </button>
            {bulkMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setBulkMenuOpen(false)} />
                <div className="absolute right-0 top-10 w-44 bg-surface rounded-xl border border-border shadow-xl z-40 py-1 animate-slide-down">
                  <button className="w-full text-left px-4 py-2 text-[12px] text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer">
                    Mark as Delivered
                  </button>
                  <button className="w-full text-left px-4 py-2 text-[12px] text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer">
                    Mark as In Transit
                  </button>
                  <button className="w-full text-left px-4 py-2 text-[12px] text-danger hover:bg-danger-bg transition-colors cursor-pointer">
                    Cancel Selected
                  </button>
                </div>
              </>
            )}
          </div>
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
                    {['Shipment ID', 'Courier', 'Destination', 'Status', 'Est. Date', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] whitespace-nowrap ${
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
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/bookings/${b.id}`}
                          className="text-[13px] font-bold text-text-primary hover:text-primary transition-colors"
                        >
                          {b.order_id}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-surface-alt border border-border rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="w-3.5 h-3.5 text-text-tertiary" />
                          </div>
                          <span className="text-[13px] text-text-secondary">
                            {b.courier_providers?.name || 'Prince Express'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="text-[13px] text-text-primary font-medium">
                            {b.receivers?.city || '—'}
                          </p>
                          <p className="text-[11px] text-text-tertiary mt-0.5">
                            {b.receivers?.name || '—'}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={b.status} size="xs" />
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-text-secondary whitespace-nowrap">
                        {formatDate(b.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Link
                          to={`/bookings/${b.id}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4 text-text-tertiary" />
                        </Link>
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
