import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Users,
  UserPlus,
  Search,
  X,
  Mail,
  Phone,
  Building,
  MapPin,
  CreditCard,
  Lock,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
  Package,
  ArrowUpRight,
  RefreshCw,
  Copy,
  ExternalLink,
  DollarSign,
  ShieldCheck,
  Building2,
  SlidersHorizontal,
  ChevronRight,
  ClipboardList,
  Wallet,
  Receipt,
  PlusCircle,
  ArrowDownLeft,
  Calendar,
  Download
} from 'lucide-react'
import {
  useCustomers,
  useCustomerById,
  useCreateCustomer,
  useUpdateCustomer,
  useToggleCustomerStatus,
  useDeleteCustomer,
  useCustomerLedger,
  useCreateLedgerEntry,
  useDeleteLedgerEntry
} from '../hooks/useCustomers'
import Pagination from '../components/ui/Pagination'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { formatCurrency, formatDate, formatDateDDMMYYYY } from '../utils/formatters'
import toast from 'react-hot-toast'
import { countryCodesApi } from '../api/countryCodes.api'
import CountryAutocompleteInput from '../components/CountryAutocompleteInput'

const STATUS_TABS = [
  { value: '', label: 'All Accounts' },
  { value: 'active', label: 'Active Portals' },
  { value: 'inactive', label: 'Inactive' }
]

export default function CustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, parseInt(searchParams.get('page')) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit')) || 10))
  const search = searchParams.get('search') || ''
  const statusFilter = searchParams.get('status') || ''

  const [searchInput, setSearchInput] = useState(search)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordTargetCustomer, setPasswordTargetCustomer] = useState(null)
  const [detailCustomerId, setDetailCustomerId] = useState(null)
  const [ledgerCustomer, setLedgerCustomer] = useState(null)

  const navigate = useNavigate()

  const { data, isLoading, isError, refetch } = useCustomers({
    page,
    limit,
    search,
    status: statusFilter
  })

  // Fetch Country Codes
  const { data: countryCodesData } = useQuery({
    queryKey: ['country-codes'],
    queryFn: () => countryCodesApi.getAll().then(res => res.data)
  })
  const countryList = countryCodesData?.countryCodes || []

  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const toggleMutation = useToggleCustomerStatus()
  const deleteMutation = useDeleteCustomer()

  const handleSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setSearchParams((prev) => {
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
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('search')
      next.delete('page')
      return next
    })
  }

  const handleTabChange = (val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (val) {
        next.set('status', val)
      } else {
        next.delete('status')
      }
      next.delete('page')
      return next
    })
  }

  const handleLimitChange = (newLimit) => {
    setSearchParams((prev) => {
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

  const setPage = (newPageOrFn) => {
    const targetPage = typeof newPageOrFn === 'function' ? newPageOrFn(page) : newPageOrFn
    const validPage = Math.max(1, parseInt(targetPage) || 1)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (validPage > 1) {
        next.set('page', String(validPage))
      } else {
        next.delete('page')
      }
      return next
    })
  }

  const handleOpenCreate = () => {
    setEditingCustomer(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer)
    setModalOpen(true)
  }

  const handleOpenPasswordReset = (customer) => {
    setPasswordTargetCustomer(customer)
    setPasswordModalOpen(true)
  }

  const handleToggleStatus = async (customer) => {
    const newStatus = customer.status === 'active' ? 'inactive' : 'active'
    try {
      await toggleMutation.mutateAsync({ id: customer.id, status: newStatus })
      toast.success(`Customer marked as ${newStatus}`)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status')
    }
  }

  const handleDelete = async (customer) => {
    if (!window.confirm(`Are you sure you want to delete customer "${customer.name}"? This action cannot be undone!`)) return
    try {
      await deleteMutation.mutateAsync(customer.id)
      toast.success(`Customer "${customer.name}" deleted`)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete customer')
    }
  }

  const stats = data?.stats || {}

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold text-navy leading-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary" />
            <span>Customer Accounts</span>
          </h1>
          <p className="text-[13px] text-text-secondary mt-0.5">
            Manage customer portal logins, passwords, account balances, and shipping history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-[13px] font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Customer</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-surface border border-border p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-text-tertiary">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Customers</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <p className="text-[22px] font-extrabold text-navy mt-1.5 leading-none">
            {stats.total_customers || 0}
          </p>
          <p className="text-[11px] text-text-secondary mt-1">Registered portal users</p>
        </div>

        <div className="bg-surface border border-border p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-text-tertiary">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Portals</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-[22px] font-extrabold text-emerald-700 mt-1.5 leading-none">
            {stats.active_customers || 0}
          </p>
          <p className="text-[11px] text-text-secondary mt-1">Authorized for PHP portal</p>
        </div>

        <div className="bg-surface border border-border p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-text-tertiary">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Balances</span>
            <Wallet className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-[22px] font-extrabold text-amber-700 mt-1.5 leading-none">
            {formatCurrency(stats.total_balance || 0)}
          </p>
          <p className="text-[11px] text-text-secondary mt-1">Net customer balance</p>
        </div>

        <div className="bg-surface border border-border p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-text-tertiary">
            <span className="text-[11px] font-bold uppercase tracking-wider">Credit Limits</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-[22px] font-extrabold text-indigo-700 mt-1.5 leading-none">
            {formatCurrency(stats.total_credit_limit || 0)}
          </p>
          <p className="text-[11px] text-text-secondary mt-1">Approved credit allowance</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-surface border border-border rounded-2xl p-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center bg-surface-alt border border-border rounded-xl p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={`px-3 py-1 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === tab.value
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-secondary hover:text-navy hover:bg-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="flex items-center gap-2 bg-surface-alt border border-border rounded-xl px-3.5 py-1.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <Search className="w-4 h-4 text-text-tertiary flex-shrink-0" />
              <input
                type="text"
                placeholder="Search by Name, Email, Phone, Company, GSTIN, City..."
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
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-border border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-[13px] text-text-tertiary font-medium">Loading customer accounts...</p>
          </div>
        ) : isError ? (
          <div className="p-8">
            <ErrorState message="Failed to load customer accounts." onRetry={refetch} />
          </div>
        ) : !data?.customers?.length ? (
          <div className="p-8">
            <EmptyState
              title="No customer accounts found"
              description={search || statusFilter ? 'No customers match your search criteria.' : 'Create your first customer to enable PHP Customer Portal access.'}
              actionLabel="Create Customer"
              onAction={handleOpenCreate}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-surface-alt/70 text-[11px] font-extrabold text-text-tertiary uppercase tracking-wider">
                    <th className="px-4 py-3">Customer / Portal User</th>
                    <th className="px-4 py-3">Login Credentials</th>
                    <th className="px-4 py-3">Location / GSTIN</th>
                    <th className="px-4 py-3 text-center">Shipments</th>
                    <th className="px-4 py-3 text-right">Account Balance</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.customers.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-hover/50 transition-colors">
                      {/* Name & Company */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-[13px] flex-shrink-0">
                            {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setDetailCustomerId(c.id)}
                                className="font-bold text-navy hover:text-primary transition-colors text-left cursor-pointer"
                              >
                                {c.name}
                              </button>
                              <span className="font-mono text-[10px] font-extrabold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                CUST-{String(c.id).padStart(4, '0')}
                              </span>
                            </div>
                            {c.company && (
                              <p className="text-[11.5px] text-text-tertiary flex items-center gap-1 mt-0.5">
                                <Building2 className="w-3 h-3 text-text-tertiary flex-shrink-0" />
                                <span className="truncate max-w-[150px]">{c.company}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Login Credentials: Email & Phone */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-text-primary font-medium text-[12.5px]">
                            <Mail className="w-3 h-3 text-text-tertiary flex-shrink-0" />
                            <span className="font-mono text-[12px]">{c.email}</span>
                          </div>
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-text-secondary text-[12px]">
                              <Phone className="w-3 h-3 text-text-tertiary flex-shrink-0" />
                              <span className="font-mono text-[11.5px]">{c.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Location & GSTIN */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <p className="text-[12px] text-text-secondary flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-text-tertiary flex-shrink-0" />
                            <span>{[c.city, c.state].filter(Boolean).join(', ') || c.country || 'INDIA'}</span>
                          </p>
                          {c.gstin_no && (
                            <p className="text-[11px] font-mono text-text-tertiary">
                              GST: {c.gstin_no}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Shipments count */}
                      <td className="px-4 py-3.5 text-center">
                        <Link
                          to={`/bookings?search=${encodeURIComponent(c.name || c.email)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-alt hover:bg-surface-hover border border-border rounded-lg text-[12px] font-bold text-navy transition-colors"
                          title="View customer shipments in Bookings page"
                        >
                          <Package className="w-3 h-3 text-primary" />
                          <span>{c.total_shipments || 0}</span>
                          <ArrowUpRight className="w-3 h-3 text-text-tertiary" />
                        </Link>
                      </td>

                      {/* Account Balance & Credit Limit */}
                      <td className="px-4 py-3.5 text-right">
                        <div>
                          <button
                            type="button"
                            onClick={() => setLedgerCustomer(c)}
                            className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer text-right group ml-auto"
                            title="Click to view ledger and debit/credit entries"
                          >
                            <span className={`font-mono font-bold text-[13px] ${parseFloat(c.current_balance) > 0 ? 'text-amber-700' : (parseFloat(c.current_balance) < 0 ? 'text-emerald-700' : 'text-text-secondary')}`}>
                              {formatCurrency(Math.abs(parseFloat(c.current_balance) || 0))}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border leading-none tracking-wider ${
                              parseFloat(c.current_balance) > 0
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : parseFloat(c.current_balance) < 0
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                              {parseFloat(c.current_balance) > 0 ? 'DUE' : (parseFloat(c.current_balance) < 0 ? 'ADV' : '0')}
                            </span>
                          </button>
                          {parseFloat(c.credit_limit) > 0 && (
                            <p className="text-[10.5px] text-text-tertiary mt-0.5">
                              Limit: {formatCurrency(c.credit_limit)}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(c)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                            c.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-surface-alt text-text-tertiary border-border hover:bg-surface-hover'
                          }`}
                          title={`Click to mark as ${c.status === 'active' ? 'inactive' : 'active'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'active' ? 'bg-emerald-600' : 'bg-text-tertiary'}`} />
                          <span>{c.status === 'active' ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Ledger & Debit/Credit */}
                          <button
                            type="button"
                            onClick={() => setLedgerCustomer(c)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Accounting Ledger & Debit/Credit Entries"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>

                          {/* View details */}
                          <button
                            type="button"
                            onClick={() => setDetailCustomerId(c.id)}
                            className="p-1.5 text-text-secondary hover:text-navy hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                            title="View Customer Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => handleOpenPasswordReset(c)}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Reset Portal Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 text-navy hover:text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer"
                            title="Edit Customer Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger-bg rounded-lg transition-colors cursor-pointer"
                            title="Delete Customer Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-3 border-t border-border">
              <Pagination
                page={page}
                totalPages={data?.pagination?.totalPages || 1}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={handleLimitChange}
                total={data?.pagination?.total || 0}
                limitOptions={[10, 20, 50, 100]}
              />
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Customer Modal */}
      {modalOpen && (
        <CustomerFormModal
          isOpen={modalOpen}
          customer={editingCustomer}
          countryList={countryList}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            refetch()
          }}
        />
      )}

      {/* Password Reset Modal */}
      {passwordModalOpen && passwordTargetCustomer && (
        <PasswordResetModal
          isOpen={passwordModalOpen}
          customer={passwordTargetCustomer}
          onClose={() => setPasswordModalOpen(false)}
          onSaved={() => {
            setPasswordModalOpen(false)
            refetch()
          }}
        />
      )}

      {/* Customer Detail Drawer */}
      {detailCustomerId && (
        <CustomerDetailDrawer
          customerId={detailCustomerId}
          onClose={() => setDetailCustomerId(null)}
          onEdit={() => {
            const cust = data?.customers?.find((x) => x.id === detailCustomerId)
            if (cust) {
              setDetailCustomerId(null)
              handleOpenEdit(cust)
            }
          }}
          onOpenLedger={(cust) => {
            setDetailCustomerId(null)
            setLedgerCustomer(cust)
          }}
        />
      )}

      {/* Customer Ledger & Accounting Modal */}
      {ledgerCustomer && (
        <CustomerLedgerModal
          customer={ledgerCustomer}
          onClose={() => {
            setLedgerCustomer(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}

// ─── Create / Edit Customer Modal ──────────────────────────────────────────
function CustomerFormModal({ isOpen, customer, onClose, onSaved, countryList = [] }) {
  const isEdit = Boolean(customer?.id)

  const [formData, setFormData] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    company: customer?.company || '',
    password: '',
    address: customer?.address || '',
    city: customer?.city || '',
    state: customer?.state || '',
    pincode: customer?.pincode || '',
    country: customer?.country || 'INDIA',
    gstin_no: customer?.gstin_no || '',
    credit_limit: customer?.credit_limit !== undefined ? String(customer.credit_limit) : '0',
    current_balance: customer?.current_balance !== undefined ? String(customer.current_balance) : '0',
    status: customer?.status || 'active'
  })

  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'
    let pass = ''
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData((prev) => ({ ...prev, password: pass }))
    setShowPassword(true)
    navigator.clipboard.writeText(pass)
    toast.success('Generated password copied to clipboard!')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Customer name is required')
      return
    }
    if (!formData.email.trim()) {
      toast.error('Customer email is required')
      return
    }
    if (!isEdit && (!formData.password || formData.password.length < 6)) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: customer.id,
          ...formData
        })
        toast.success('Customer account updated successfully!')
      } else {
        await createMutation.mutateAsync(formData)
        toast.success('Customer account created! They can now log in.')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save customer account')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
      {/* Light subtle backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/10 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        className="relative bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col my-auto z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">
              {isEdit ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-[16px] font-extrabold text-navy leading-tight">
                {isEdit ? `Edit Customer: ${customer.name}` : 'Create Customer Account'}
              </h2>
              <p className="text-[12px] text-text-secondary mt-0.5">
                {isEdit ? 'Update profile, address, and credit settings.' : 'Customer will be able to log in to the PHP portal with these credentials.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-tertiary hover:text-navy rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* Section 1: Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11.5px] font-bold text-text-secondary mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary outline-none focus:border-primary focus:bg-surface transition-all"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-text-secondary mb-1">
                  Company / Business Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary outline-none focus:border-primary focus:bg-surface transition-all"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-text-secondary mb-1">
                  Email Address (Login Username) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="customer@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary outline-none focus:border-primary focus:bg-surface transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-text-secondary mb-1">
                  Phone Number (Login Alternative)
                </label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary outline-none focus:border-primary focus:bg-surface transition-all font-mono"
                />
              </div>
            </div>

            {/* Section 2: Password */}
            <div className="bg-surface-alt/70 p-3.5 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11.5px] font-bold text-navy flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-primary" />
                  <span>{isEdit ? 'Reset Password (Leave blank to keep current)' : 'Portal Login Password *'}</span>
                </label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Generate Password</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required={!isEdit}
                  placeholder={isEdit ? '••••••••' : 'Min. 6 characters'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  data-case="normal"
                  style={{ textTransform: 'none' }}
                  className="w-full px-3 py-1.5 pr-9 bg-surface border border-border rounded-xl text-[13px] text-text-primary font-mono outline-none focus:border-primary normal-case"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-navy cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Section 3: Address Information */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-navy">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Address & Tax Information</span>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-tertiary uppercase mb-1">
                  Full Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street address, building, landmark"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary outline-none focus:border-primary resize-none"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-text-tertiary uppercase mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Surat"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-tertiary uppercase mb-1">State</label>
                  <input
                    type="text"
                    placeholder="Gujarat"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-tertiary uppercase mb-1">Pincode</label>
                  <input
                    type="text"
                    placeholder="395003"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-tertiary uppercase mb-1">Country</label>
                  <CountryAutocompleteInput
                    value={formData.country || ''}
                    onChange={(code) => setFormData({ ...formData, country: code || '' })}
                    placeholder="Search Country (e.g. India, USA)..."
                    countryList={countryList}
                    className="w-full px-2.5 py-1.5 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-tertiary uppercase mb-1">
                  GSTIN / Tax ID
                </label>
                <input
                  type="text"
                  placeholder="24AAAAA0000A1Z5"
                  value={formData.gstin_no}
                  onChange={(e) => setFormData({ ...formData, gstin_no: e.target.value })}
                  className="w-full px-3 py-1.5 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary font-mono outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Section 4: Financials & Status */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-navy">
                <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                <span>Financials & Account Status</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-text-tertiary uppercase mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    className="w-full px-3 py-1.5 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary font-mono outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-tertiary uppercase mb-1">
                    Current Balance (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.current_balance}
                    onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                    className="w-full px-3 py-1.5 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary font-mono outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-tertiary uppercase mb-1">
                    Portal Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-1.5 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary font-bold outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="active">Active (Can Login)</option>
                    <option value="inactive">Inactive (Disabled)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer Buttons */}
          <div className="px-5 py-3.5 border-t border-border flex items-center justify-end gap-2.5 bg-surface-alt/70 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-xl text-[12.5px] font-bold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-[12.5px] font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
            >
              {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{isEdit ? 'Save Changes' : 'Create Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// ─── Reset Password Modal ──────────────────────────────────────────────────
function PasswordResetModal({ isOpen, customer, onClose, onSaved }) {
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const updateMutation = useUpdateCustomer()

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'
    let pass = ''
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewPassword(pass)
    navigator.clipboard.writeText(pass)
    toast.success('Generated password copied to clipboard!')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newPassword || newPassword.trim().length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setSubmitting(true)
    try {
      await updateMutation.mutateAsync({
        id: customer.id,
        password: newPassword.trim()
      })
      toast.success(`Password for ${customer.name} reset successfully!`)
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reset password')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      {/* Light backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/10 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        className="relative bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-600" />
            <h2 className="text-[15px] font-extrabold text-navy">
              Reset Password: {customer.name}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-text-tertiary hover:text-navy rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-[12.5px] text-text-secondary leading-relaxed">
            Set a new login password for <span className="font-bold text-navy">{customer.email}</span>. The customer will be able to log in immediately with this password.
          </p>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11.5px] font-bold text-navy">New Password *</label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" />
                <span>Generate Random</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                placeholder="Min. 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-case="normal"
                style={{ textTransform: 'none' }}
                className="w-full px-3 py-2 pr-9 bg-surface-alt border border-border rounded-xl text-[13px] text-text-primary font-mono outline-none focus:border-primary normal-case"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-navy cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-border rounded-xl text-[12px] font-bold text-text-secondary hover:bg-surface-hover cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[12px] font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>Reset & Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// ─── Customer Detail Drawer ────────────────────────────────────────────────
function CustomerDetailDrawer({ customerId, onClose, onEdit, onOpenLedger }) {
  const { data, isLoading } = useCustomerById(customerId)
  const customer = data?.customer
  const shipments = data?.recent_shipments || []

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-hidden flex justify-end animate-fade-in">
      {/* 100% Invisible click-away backdrop - NO DARK OVERLAY */}
      <div
        className="fixed inset-0 bg-black/[0.03] cursor-default"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Full 100vh Height Slide-out Drawer */}
      <div
        className="relative w-full max-w-lg sm:max-w-xl md:max-w-2xl bg-surface border-l border-border h-screen flex flex-col shadow-[-16px_0_40px_rgba(0,0,0,0.12)] z-10 animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-extrabold flex items-center justify-center text-[16px] flex-shrink-0">
              {customer?.name ? customer.name.charAt(0).toUpperCase() : 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-extrabold text-navy leading-tight">
                  {customer?.name || 'Customer Details'}
                </h2>
                <span className="font-mono text-[11px] font-extrabold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md">
                  CUST-{String(customerId).padStart(4, '0')}
                </span>
              </div>
              <p className="text-[12px] text-text-secondary mt-0.5">{customer?.company || 'Individual Account'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onEdit}
              className="p-2 text-navy hover:text-primary hover:bg-surface-hover rounded-xl transition-colors cursor-pointer"
              title="Edit Customer"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-text-tertiary hover:text-navy hover:bg-surface-hover rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-3 border-border border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-[13px] text-text-tertiary mt-2 font-medium">Loading customer details...</p>
            </div>
          ) : !customer ? (
            <div className="p-8 text-center text-text-tertiary">Customer information not found.</div>
          ) : (
            <>
              {/* Financial Summary Banner */}
              <div className="p-4 bg-surface-alt rounded-2xl border border-border shadow-2xs space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Account Balance</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <p className={`text-[20px] font-mono font-extrabold ${parseFloat(customer.current_balance) > 0 ? 'text-amber-700' : (parseFloat(customer.current_balance) < 0 ? 'text-emerald-700' : 'text-navy')}`}>
                        {formatCurrency(Math.abs(parseFloat(customer.current_balance) || 0))}
                      </p>
                      <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded border leading-none ${
                        parseFloat(customer.current_balance) > 0
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : parseFloat(customer.current_balance) < 0
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {parseFloat(customer.current_balance) > 0 ? 'Due' : (parseFloat(customer.current_balance) < 0 ? 'Advance' : 'Cleared')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Credit Limit</span>
                    <p className="text-[20px] font-mono font-extrabold text-indigo-700 mt-1">
                      {formatCurrency(customer.credit_limit || 0)}
                    </p>
                  </div>
                </div>

                {onOpenLedger && (
                  <button
                    type="button"
                    onClick={() => onOpenLedger(customer)}
                    className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-[12px] font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    <span>Open Account Ledger & Debit/Credit Entries</span>
                  </button>
                )}
              </div>

              {/* Contact Details */}
              <div className="space-y-2.5">
                <h3 className="text-[12px] font-extrabold text-text-tertiary uppercase tracking-wider">Contact & Credentials</h3>
                <div className="bg-surface-alt/60 border border-border rounded-xl p-3.5 space-y-2.5 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">Email (Login ID):</span>
                    <span className="font-mono font-bold text-navy">{customer.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">Phone Number:</span>
                    <span className="font-mono font-semibold text-text-primary">{customer.phone || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">Portal Status:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${customer.status === 'active' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-surface text-text-tertiary border border-border'}`}>
                      {customer.status === 'active' ? 'Active Portal' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">Account Created:</span>
                    <span className="text-text-secondary">{formatDate(customer.created_at)}</span>
                  </div>
                  {customer.last_login && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-tertiary">Last Portal Login:</span>
                      <span className="text-text-secondary">{formatDate(customer.last_login)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2.5">
                <h3 className="text-[12px] font-extrabold text-text-tertiary uppercase tracking-wider">Billing Address</h3>
                <div className="bg-surface-alt/60 border border-border rounded-xl p-3.5 text-[13px] space-y-1">
                  <p className="font-medium text-text-primary">{customer.address || '—'}</p>
                  <p className="text-text-secondary text-[12px]">
                    {[customer.city, customer.state, customer.pincode, customer.country || 'INDIA'].filter(Boolean).join(', ')}
                  </p>
                  {customer.gstin_no && (
                    <p className="text-[11.5px] font-mono text-text-tertiary pt-1">
                      GSTIN: {customer.gstin_no}
                    </p>
                  )}
                </div>
              </div>

              {/* Recent Shipments */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-extrabold text-text-tertiary uppercase tracking-wider">
                    Recent Shipments ({shipments.length})
                  </h3>
                  {shipments.length > 0 && (
                    <Link
                      to={`/bookings?search=${encodeURIComponent(customer.name || customer.email)}`}
                      className="text-[11.5px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <span>View All In Bookings</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>

                {!shipments.length ? (
                  <div className="p-4 text-center bg-surface-alt/40 rounded-xl border border-border text-text-tertiary text-[12.5px]">
                    No shipments found for this customer yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-surface">
                    {shipments.map((s) => (
                      <div key={s.id} className="p-3.5 flex items-center justify-between hover:bg-surface-hover transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-navy text-[13px]">
                              {s.tracking_number || s.order_id}
                            </span>
                            <span className="px-2 py-0.5 bg-surface-alt text-text-secondary rounded text-[10px] font-bold uppercase">
                              {s.status}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-text-secondary mt-0.5">
                            To: {s.receiver_name} ({s.receiver_city || s.receiver_country || '—'}) · {formatDateDDMMYYYY(s.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-text-primary text-[12.5px]">
                            {formatCurrency(s.total_amount || 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Customer Ledger & Debit/Credit Accounting Modal ─────────────────────────
function CustomerLedgerModal({ customer, onClose }) {
  const { data, isLoading, refetch } = useCustomerLedger(customer?.id)
  const createMutation = useCreateLedgerEntry()
  const deleteMutation = useDeleteLedgerEntry()

  const entries = data?.entries || []
  const summary = data?.summary || {
    total_debit: 0,
    total_credit: 0,
    current_balance: parseFloat(customer?.current_balance) || 0,
    credit_limit: parseFloat(customer?.credit_limit) || 0
  }

  const [entryType, setEntryType] = useState('credit') // default 'credit' (payment received)
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [referenceNo, setReferenceNo] = useState('')
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [description, setDescription] = useState('')
  const [searchLedger, setSearchLedger] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filteredEntries = useMemo(() => {
    if (!searchLedger.trim()) return entries
    const term = searchLedger.toLowerCase().trim()
    return entries.filter(e =>
      (e.description && e.description.toLowerCase().includes(term)) ||
      (e.reference_no && e.reference_no.toLowerCase().includes(term)) ||
      (e.payment_mode && e.payment_mode.toLowerCase().includes(term)) ||
      String(e.amount).includes(term) ||
      (e.entry_date && e.entry_date.includes(term))
    )
  }, [entries, searchLedger])

  const handleAddEntry = async (e) => {
    e.preventDefault()
    const numAmt = parseFloat(amount)
    if (isNaN(numAmt) || numAmt <= 0) {
      toast.error('Please enter a valid amount greater than 0')
      return
    }

    setSubmitting(true)
    try {
      await createMutation.mutateAsync({
        id: customer.id,
        data: {
          entry_type: entryType,
          amount: numAmt,
          description: description.trim(),
          reference_no: referenceNo.trim(),
          payment_mode: paymentMode,
          entry_date: entryDate
        }
      })
      toast.success(
        entryType === 'credit'
          ? `₹${numAmt.toFixed(2)} payment recorded! Customer balance reduced.`
          : `₹${numAmt.toFixed(2)} charge recorded! Customer balance increased.`
      )
      setAmount('')
      setDescription('')
      setReferenceNo('')
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to record entry')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteEntry = async (entry) => {
    if (!window.confirm(`Are you sure you want to delete this ${entry.entry_type} entry of ₹${entry.amount}? This will reverse the customer's balance.`)) {
      return
    }
    try {
      await deleteMutation.mutateAsync({ id: customer.id, entryId: entry.id })
      toast.success('Entry deleted and customer balance adjusted')
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete entry')
    }
  }

  const exportLedgerCSV = () => {
    if (!entries.length) {
      toast.error('No transactions to export')
      return
    }
    const headers = ['Date', 'Type', 'Particulars / Description', 'Payment Mode', 'Reference / Receipt No', 'Debit (Charges)', 'Credit (Payment)', 'Balance After']
    const rows = entries.map(e => [
      e.entry_date,
      e.entry_type.toUpperCase(),
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(e.payment_mode || '').replace(/"/g, '""')}"`,
      `"${(e.reference_no || '').replace(/"/g, '""')}"`,
      e.entry_type === 'debit' ? e.amount : '',
      e.entry_type === 'credit' ? e.amount : '',
      e.balance_after
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Statement_${(customer?.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const curBal = parseFloat(summary.current_balance) || 0

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative bg-surface border border-border w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10 max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-alt/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-[18px]">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-extrabold text-navy">
                  Account Ledger: {customer?.name}
                </h2>
                <span className="font-mono text-[11px] font-black bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
                  CUST-{String(customer?.id || '').padStart(4, '0')}
                </span>
              </div>
              <p className="text-[12px] text-text-secondary mt-0.5">
                {customer?.company ? `${customer.company} · ` : ''}{customer?.email} {customer?.phone ? `· ${customer.phone}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-tertiary hover:text-navy hover:bg-surface-hover rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Top Balance Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Current Balance */}
            <div className={`p-4 rounded-xl border ${curBal > 0 ? 'bg-amber-50/70 border-amber-200 text-amber-900' : (curBal < 0 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-surface-alt border-border text-navy')}`}>
              <span className="text-[10.5px] font-bold uppercase tracking-wider block opacity-75">
                Current Balance
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-[22px] font-mono font-black">
                  {formatCurrency(Math.abs(curBal))}
                </span>
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded leading-none ${
                  curBal > 0
                    ? 'bg-amber-200/60 text-amber-800'
                    : curBal < 0
                    ? 'bg-emerald-200/60 text-emerald-800'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {curBal > 0 ? 'DUE / RECEIVABLE' : (curBal < 0 ? 'ADVANCE CREDIT' : 'CLEARED')}
                </span>
              </div>
            </div>

            {/* Total Charges / Debits */}
            <div className="p-4 rounded-xl bg-surface-alt border border-border">
              <span className="text-[10.5px] font-bold text-text-tertiary uppercase tracking-wider block">
                Total Charges (Debits)
              </span>
              <span className="text-[20px] font-mono font-extrabold text-navy mt-1 block">
                {formatCurrency(summary.total_debit || 0)}
              </span>
            </div>

            {/* Total Payments / Credits */}
            <div className="p-4 rounded-xl bg-surface-alt border border-border">
              <span className="text-[10.5px] font-bold text-text-tertiary uppercase tracking-wider block">
                Total Paid (Credits)
              </span>
              <span className="text-[20px] font-mono font-extrabold text-emerald-700 mt-1 block">
                {formatCurrency(summary.total_credit || 0)}
              </span>
            </div>

            {/* Credit Limit */}
            <div className="p-4 rounded-xl bg-surface-alt border border-border">
              <span className="text-[10.5px] font-bold text-text-tertiary uppercase tracking-wider block">
                Credit Limit
              </span>
              <span className="text-[20px] font-mono font-extrabold text-indigo-700 mt-1 block">
                {formatCurrency(summary.credit_limit || 0)}
              </span>
            </div>
          </div>

          {/* Add Debit / Credit Entry Form */}
          <div className="bg-surface-alt/70 border border-border rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-[13px] font-extrabold text-navy flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-primary" />
                Record Debit / Credit Entry
              </h3>
              <div className="flex items-center bg-surface border border-border rounded-xl p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setEntryType('credit')}
                  className={`px-3 py-1 rounded-lg text-[11.5px] font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    entryType === 'credit'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-text-secondary hover:text-navy'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Credit (-) Payment Received</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('debit')}
                  className={`px-3 py-1 rounded-lg text-[11.5px] font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    entryType === 'debit'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-text-secondary hover:text-navy'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Debit (+) Charge / Surcharge</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Amount */}
                <div>
                  <label className="block text-[11px] font-extrabold text-text-tertiary uppercase mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-[13px] font-mono font-bold text-navy outline-none focus:border-primary shadow-2xs"
                  />
                </div>

                {/* Entry Date */}
                <div>
                  <label className="block text-[11px] font-extrabold text-text-tertiary uppercase mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-[13px] font-medium text-text-primary outline-none focus:border-primary shadow-2xs"
                  />
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="block text-[11px] font-extrabold text-text-tertiary uppercase mb-1">
                    Mode / Channel
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-[13px] font-semibold text-text-primary outline-none focus:border-primary shadow-2xs cursor-pointer"
                  >
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit Note">Credit Note / Discount</option>
                    <option value="Invoice Charge">Invoice Charge</option>
                    <option value="Adjustment">Adjustment / Round-off</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Reference No */}
                <div>
                  <label className="block text-[11px] font-extrabold text-text-tertiary uppercase mb-1">
                    Reference / Receipt #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-98214, CHQ#1024"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-[13px] font-mono text-text-primary outline-none focus:border-primary shadow-2xs"
                  />
                </div>
              </div>

              {/* Description & Submit Button */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="Particulars / Description (e.g. Payment received for August bookings, Freight discount)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full sm:flex-1 px-3 py-2 bg-surface border border-border rounded-xl text-[13px] text-text-primary outline-none focus:border-primary shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={submitting || !amount}
                  className={`px-5 py-2 rounded-xl text-[12.5px] font-extrabold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap ${
                    entryType === 'credit'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{entryType === 'credit' ? 'Post Payment (Credit)' : 'Post Charge (Debit)'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Statement / Ledger Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-extrabold text-navy uppercase tracking-wider">
                  Transaction Statement ({filteredEntries.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter entries..."
                  value={searchLedger}
                  onChange={(e) => setSearchLedger(e.target.value)}
                  className="px-2.5 py-1 bg-surface-alt border border-border rounded-lg text-[12px] outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={exportLedgerCSV}
                  disabled={!entries.length}
                  className="px-3 py-1 bg-surface-alt hover:bg-surface-hover text-navy border border-border rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Download Statement CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="p-8 text-center">
                <div className="w-7 h-7 border-3 border-border border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-[12px] text-text-tertiary mt-2">Loading transactions...</p>
              </div>
            ) : !filteredEntries.length ? (
              <div className="p-8 text-center bg-surface-alt/40 border border-border rounded-xl text-text-tertiary text-[13px]">
                No transaction entries found. Record a credit payment or debit entry above to manage this customer's balance.
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-surface-alt/80 text-[10.5px] font-bold uppercase text-text-tertiary sticky top-0 z-10 border-b border-border">
                      <tr>
                        <th className="px-3.5 py-2.5">Date</th>
                        <th className="px-3.5 py-2.5">Type</th>
                        <th className="px-3.5 py-2.5">Particulars / Mode</th>
                        <th className="px-3.5 py-2.5">Reference</th>
                        <th className="px-3.5 py-2.5 text-right">Debit (+)</th>
                        <th className="px-3.5 py-2.5 text-right">Credit (-)</th>
                        <th className="px-3.5 py-2.5 text-right">Balance</th>
                        <th className="px-2.5 py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-surface">
                      {filteredEntries.map((e) => (
                        <tr key={e.id} className="hover:bg-surface-hover/60 transition-colors">
                          <td className="px-3.5 py-2.5 font-mono text-[11.5px] text-text-secondary whitespace-nowrap">
                            {e.entry_date}
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              e.entry_type === 'credit'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {e.entry_type === 'credit' ? 'CREDIT' : 'DEBIT'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 max-w-[220px]">
                            <p className="font-medium text-text-primary truncate" title={e.description || '—'}>
                              {e.description || '—'}
                            </p>
                            {e.payment_mode && (
                              <span className="text-[10px] text-text-tertiary font-bold block">
                                {e.payment_mode}
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-[11px] text-text-secondary max-w-[120px] truncate" title={e.reference_no}>
                            {e.reference_no || '—'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                            {e.entry_type === 'debit' ? formatCurrency(e.amount) : '—'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {e.entry_type === 'credit' ? formatCurrency(e.amount) : '—'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-black text-navy whitespace-nowrap">
                            {formatCurrency(e.balance_after)}
                          </td>
                          <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(e)}
                              className="p-1 text-text-tertiary hover:text-red-600 rounded transition-colors cursor-pointer"
                              title="Delete entry and revert balance"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

