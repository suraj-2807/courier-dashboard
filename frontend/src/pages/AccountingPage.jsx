import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Scale,
  Users,
  UserCheck,
  Truck,
  FileText,
  Plus,
  Search,
  Trash2,
  Calendar,
  IndianRupee,
  Wallet,
  Building,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Eye,
  User,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Send,
  Download
} from 'lucide-react'
import * as accountingApi from '../api/accounting.api'
import { customersApi } from '../api/customers.api'
import { getVendors } from '../api/rates.api'

const ENTRY_TYPE_BADGES = {
  customer_payment: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', label: 'Customer Payment' },
  customer_charge: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', label: 'Customer Charge' },
  walkin_cash: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', label: 'Walk-in Cash' },
  vendor_payment: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa', label: 'Vendor Payment' },
  vendor_bill: { bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8', label: 'Vendor Bill' },
  expense: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', label: 'Office Expense' }
}

export default function AccountingPage() {
  const queryClient = useQueryClient()

  // 5 Simplified Tabs: 'master', 'customers', 'walkin', 'vendors', 'entries'
  const [activeTab, setActiveTab] = useState('master')

  // Search & Filters
  const [customerSearch, setCustomerSearch] = useState('')
  const [walkinSearch, setWalkinSearch] = useState('')
  const [entriesFilterType, setEntriesFilterType] = useState('')
  const [entriesSearch, setEntriesSearch] = useState('')

  // Selected Customer for Statement Modal
  const [statementCustomer, setStatementCustomer] = useState(null)

  // New Entry Modal State
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [entryForm, setEntryForm] = useState({
    entry_type: 'customer_payment',
    party_type: 'customer',
    customer_id: '',
    vendor_id: '',
    vendor_code: '',
    party_name: '',
    amount: '',
    payment_mode: 'cash',
    reference_no: '',
    entry_date: new Date().toISOString().slice(0, 10),
    description: ''
  })

  // 1. Ledger Toggle Status
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['accounting-status'],
    queryFn: accountingApi.getLedgerStatus
  })
  const isLedgerEnabled = Boolean(statusData?.enabled)

  const toggleStatusMutation = useMutation({
    mutationFn: accountingApi.toggleLedgerStatus,
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['accounting-status'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-master'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to toggle ledger')
  })

  // 2. Master Balance Sheet Query
  const { data: masterData, isLoading: masterLoading } = useQuery({
    queryKey: ['accounting-master'],
    queryFn: accountingApi.getMasterBalanceSheet,
    enabled: isLedgerEnabled
  })

  // 3. Customers Balance Sheet Query
  const { data: customersSheetData, isLoading: custLoading } = useQuery({
    queryKey: ['accounting-customers-sheet'],
    queryFn: accountingApi.getCustomersBalanceSheet,
    enabled: isLedgerEnabled && (activeTab === 'customers' || activeTab === 'master')
  })

  // 4. Walk-in Balance Sheet Query
  const { data: walkinData, isLoading: walkinLoading } = useQuery({
    queryKey: ['accounting-walkin-sheet', walkinSearch],
    queryFn: () => accountingApi.getWalkinBalanceSheet({ search: walkinSearch }),
    enabled: isLedgerEnabled && (activeTab === 'walkin' || activeTab === 'master')
  })

  // 5. Vendors Balance Sheet Query
  const { data: vendorsSheetData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['accounting-vendors-sheet'],
    queryFn: accountingApi.getVendorsBalanceSheet,
    enabled: isLedgerEnabled && (activeTab === 'vendors' || activeTab === 'master')
  })

  // 6. Entries Register Query
  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['accounting-entries', entriesFilterType, entriesSearch],
    queryFn: () => accountingApi.getEntries({ entry_type: entriesFilterType, search: entriesSearch }),
    enabled: isLedgerEnabled && (activeTab === 'entries' || activeTab === 'master')
  })

  // Customer Ledger Statement for Modal
  const { data: customerLedgerData, isLoading: statementLoading } = useQuery({
    queryKey: ['customer-statement-ledger', statementCustomer?.id],
    queryFn: () => customersApi.getLedger(statementCustomer.id).then(res => res.data),
    enabled: Boolean(statementCustomer?.id)
  })

  // Customers dropdown list for New Entry modal
  const customersList = customersSheetData?.customers || []

  // Vendors dropdown list for New Entry modal
  const vendorsList = vendorsSheetData?.vendors || []

  // Create Entry Mutation
  const createEntryMutation = useMutation({
    mutationFn: accountingApi.createSimpleEntry,
    onSuccess: (data) => {
      toast.success(data.message || 'Entry recorded successfully!')
      queryClient.invalidateQueries({ queryKey: ['accounting-master'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-customers-sheet'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-vendors-sheet'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-entries'] })
      queryClient.invalidateQueries({ queryKey: ['customer-statement-ledger'] })
      setShowEntryModal(false)
      // Reset form
      setEntryForm({
        entry_type: 'customer_payment',
        party_type: 'customer',
        customer_id: '',
        vendor_id: '',
        vendor_code: '',
        party_name: '',
        amount: '',
        payment_mode: 'cash',
        reference_no: '',
        entry_date: new Date().toISOString().slice(0, 10),
        description: ''
      })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to record entry')
  })

  // Delete Entry Mutation
  const deleteEntryMutation = useMutation({
    mutationFn: accountingApi.deleteSimpleEntry,
    onSuccess: (data) => {
      toast.success(data.message || 'Entry deleted')
      queryClient.invalidateQueries({ queryKey: ['accounting-master'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-customers-sheet'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-vendors-sheet'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-entries'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete entry')
  })

  // Helper to open New Entry modal with preset
  const openNewEntry = (type, prefill = {}) => {
    setEntryForm({
      entry_type: type,
      party_type: type.startsWith('customer') ? 'customer' : type.startsWith('vendor') ? 'vendor' : type === 'walkin_cash' ? 'walkin' : 'expense',
      customer_id: prefill.customer_id || '',
      vendor_id: prefill.vendor_id || '',
      vendor_code: prefill.vendor_code || '',
      party_name: prefill.party_name || '',
      amount: prefill.amount || '',
      payment_mode: prefill.payment_mode || 'cash',
      reference_no: prefill.reference_no || '',
      entry_date: new Date().toISOString().slice(0, 10),
      description: prefill.description || ''
    })
    setShowEntryModal(true)
  }

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customersList
    const term = customerSearch.toLowerCase()
    return customersList.filter(c =>
      c.name?.toLowerCase().includes(term) ||
      c.company?.toLowerCase().includes(term) ||
      c.phone?.includes(term) ||
      c.email?.toLowerCase().includes(term)
    )
  }, [customersList, customerSearch])

  return (
    <div className="space-y-6">
      {/* ── Top Header & Ledger Activation Toggle ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-surface border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Scale className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-text-primary">
                Financial Balance Sheets & Accounting
              </h1>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  isLedgerEnabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                }`}
              >
                {isLedgerEnabled ? 'LEDGER ACTIVE' : 'LEDGER DISABLED'}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Master Balance Sheet, Customer Accounts, Walk-in Counter Cash, Vendor Payables, and Direct Financial Entries.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleStatusMutation.mutate(!isLedgerEnabled)}
            disabled={toggleStatusMutation.isPending || statusLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
              isLedgerEnabled
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-surface-alt hover:bg-surface border border-border text-text-primary'
            }`}
          >
            {isLedgerEnabled ? (
              <>
                <ToggleRight className="w-4 h-4 text-white" />
                Ledger Enabled
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4 text-text-tertiary" />
                Enable Ledger
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── When Ledger Is Disabled Banner ── */}
      {!isLedgerEnabled && (
        <div className="p-6 rounded-2xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold">Accounting Ledger is Currently Disabled</h3>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/80 mt-1">
                Enable the ledger to view real-time customer balances, walk-in counter revenue, vendor linehaul payables, and record payment entries.
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleStatusMutation.mutate(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap shadow-xs"
          >
            Activate Ledger
          </button>
        </div>
      )}

      {/* ── Active Module Content ── */}
      {isLedgerEnabled && (
        <>
          {/* Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-border pb-1">
            <div className="flex items-center gap-2 overflow-x-auto text-sm font-semibold">
              <button
                onClick={() => setActiveTab('master')}
                className={`px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'master'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Scale className="w-4 h-4" />
                Master Balance Sheet
              </button>

              <button
                onClick={() => setActiveTab('customers')}
                className={`px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'customers'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Users className="w-4 h-4" />
                Customers Accounts
              </button>

              <button
                onClick={() => setActiveTab('walkin')}
                className={`px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'walkin'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Wallet className="w-4 h-4" />
                Walk-in Customers
              </button>

              <button
                onClick={() => setActiveTab('vendors')}
                className={`px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'vendors'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Truck className="w-4 h-4" />
                Vendors Balance Sheet
              </button>

              <button
                onClick={() => setActiveTab('entries')}
                className={`px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'entries'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <FileText className="w-4 h-4" />
                Entries Register
              </button>
            </div>

            {/* Quick Add Entry Button */}
            <button
              onClick={() => openNewEntry('customer_payment')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-xs"
            >
              <Plus className="w-4 h-4" />
              + Add Entry
            </button>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              TAB 1: MASTER BALANCE SHEET
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'master' && (
            <div className="space-y-6">
              {/* Primary KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Customer Dues (Receivable)</span>
                    <User className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                    ₹{(masterData?.receivables?.total_customer_due || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-tertiary mt-2 pt-2 border-t border-border/50">
                    <span>{masterData?.receivables?.total_customers_count || 0} Registered Accounts</span>
                    <button onClick={() => setActiveTab('customers')} className="text-primary hover:underline font-bold">
                      View →
                    </button>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Walk-in Counter Revenue</span>
                    <Wallet className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                    ₹{(masterData?.walkin?.total_walkin_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-tertiary mt-2 pt-2 border-t border-border/50">
                    <span>{masterData?.walkin?.total_walkin_shipments_count || 0} Cash Shipments</span>
                    <button onClick={() => setActiveTab('walkin')} className="text-primary hover:underline font-bold">
                      View →
                    </button>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Vendor Linehaul Payables</span>
                    <Truck className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-2">
                    ₹{(masterData?.payables?.total_vendor_payable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-tertiary mt-2 pt-2 border-t border-border/50">
                    <span>Total Cost: ₹{(masterData?.payables?.total_vendor_linehaul_cost || 0).toLocaleString('en-IN')}</span>
                    <button onClick={() => setActiveTab('vendors')} className="text-primary hover:underline font-bold">
                      View →
                    </button>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Gross Operating Margin</span>
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                    ₹{(masterData?.profitability?.gross_profit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-tertiary mt-2 pt-2 border-t border-border/50">
                    <span>{masterData?.profitability?.margin_pct || 0}% Profit Margin</span>
                    <span className="text-emerald-600 font-bold">Profitable</span>
                  </div>
                </div>
              </div>

              {/* Master Balance Sheet Layout (Assets vs Liabilities) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Card: Assets & Receivables */}
                <div className="p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-emerald-500" />
                      Current Assets & Receivables (Money Coming In)
                    </h3>
                    <span className="text-xs font-bold text-emerald-600">ASSETS</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt/50 border border-border">
                      <div>
                        <div className="font-bold text-text-primary">Accounts Receivable (Customer Dues)</div>
                        <div className="text-[11px] text-text-tertiary">Outstanding credit balances from registered customers</div>
                      </div>
                      <div className="font-mono font-bold text-sm text-text-primary">
                        ₹{(masterData?.receivables?.total_customer_due || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt/50 border border-border">
                      <div>
                        <div className="font-bold text-text-primary">Walk-in Counter Cash Revenue</div>
                        <div className="text-[11px] text-text-tertiary">Direct retail shipments billed & collected</div>
                      </div>
                      <div className="font-mono font-bold text-sm text-emerald-600">
                        ₹{(masterData?.walkin?.total_walkin_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt/50 border border-border">
                      <div>
                        <div className="font-bold text-text-primary">Cash in Drawer (Petty Cash)</div>
                        <div className="text-[11px] text-text-tertiary">Counter register drawer balance</div>
                      </div>
                      <div className="font-mono font-bold text-sm text-text-primary">
                        ₹{(masterData?.liquid_funds?.cash_in_hand || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt/50 border border-border">
                      <div>
                        <div className="font-bold text-text-primary">Operating Bank & UPI Clearing</div>
                        <div className="text-[11px] text-text-tertiary">Current Account & Gateway funds</div>
                      </div>
                      <div className="font-mono font-bold text-sm text-text-primary">
                        ₹{(masterData?.liquid_funds?.bank_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Card: Liabilities & Direct Costs */}
                <div className="p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <Truck className="w-4 h-4 text-rose-500" />
                      Current Liabilities & Costs (Money Owed / Paid)
                    </h3>
                    <span className="text-xs font-bold text-rose-600">LIABILITIES</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt/50 border border-border">
                      <div>
                        <div className="font-bold text-text-primary">Vendor Linehaul Costs Incurred</div>
                        <div className="text-[11px] text-text-tertiary">Total forwarder bills (Pacific, ACX, Sairaj, etc.)</div>
                      </div>
                      <div className="font-mono font-bold text-sm text-text-primary">
                        ₹{(masterData?.payables?.total_vendor_linehaul_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt/50 border border-border">
                      <div>
                        <div className="font-bold text-text-primary">Payments Settled to Vendors</div>
                        <div className="text-[11px] text-text-tertiary">Amount already transferred to carriers</div>
                      </div>
                      <div className="font-mono font-bold text-sm text-emerald-600">
                        -₹{(masterData?.payables?.total_vendor_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900">
                      <div>
                        <div className="font-bold text-rose-700 dark:text-rose-300">Net Outstanding Vendor Payable</div>
                        <div className="text-[11px] text-rose-600/80 dark:text-rose-400">Balance Prince Express currently owes to carriers</div>
                      </div>
                      <div className="font-mono font-bold text-sm text-rose-700 dark:text-rose-300">
                        ₹{(masterData?.payables?.total_vendor_payable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt/50 border border-border">
                      <div>
                        <div className="font-bold text-text-primary">Operating & Administrative Expenses</div>
                        <div className="text-[11px] text-text-tertiary">Stationery, tape, rent, hub expenses</div>
                      </div>
                      <div className="font-mono font-bold text-sm text-text-primary">
                        ₹{(masterData?.liquid_funds?.total_expenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons Strip */}
              <div className="p-4 rounded-2xl bg-surface border border-border flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-text-secondary">
                  Fast Accounting Actions:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openNewEntry('customer_payment')}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  >
                    + Record Customer Payment
                  </button>
                  <button
                    onClick={() => openNewEntry('vendor_payment')}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors"
                  >
                    + Record Vendor Payment
                  </button>
                  <button
                    onClick={() => openNewEntry('expense')}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                  >
                    + Record Office Expense
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB 2: CUSTOMERS ACCOUNTS BALANCE SHEET
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'customers' && (
            <div className="space-y-4">
              {/* Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Total Customers</span>
                  <div className="text-lg font-bold text-text-primary mt-1">
                    {customersSheetData?.total_customers || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Total Payments Received</span>
                  <div className="text-lg font-bold text-emerald-600 mt-1">
                    ₹{(customersSheetData?.grand_total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Total Outstanding Receivables</span>
                  <div className="text-lg font-bold text-purple-600 mt-1">
                    ₹{(customersSheetData?.grand_total_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Search Bar & Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Search customer name, company, phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <button
                  onClick={() => openNewEntry('customer_payment')}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  + Record Customer Payment
                </button>
              </div>

              {/* Customers Accounts Table */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-alt/50 text-text-secondary font-semibold">
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Contact</th>
                        <th className="py-3 px-4 text-center">Shipments</th>
                        <th className="py-3 px-4 text-right">Total Invoiced (₹)</th>
                        <th className="py-3 px-4 text-right">Total Paid (₹)</th>
                        <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {custLoading ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-text-tertiary">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Loading customer accounts...
                          </td>
                        </tr>
                      ) : filteredCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-text-tertiary">
                            No customers found.
                          </td>
                        </tr>
                      ) : (
                        filteredCustomers.map(c => {
                          const bal = parseFloat(c.current_balance) || 0
                          return (
                            <tr key={c.id} className="hover:bg-surface-alt/40 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-bold text-text-primary">{c.name}</div>
                                {c.company && (
                                  <div className="text-[11px] text-text-tertiary">{c.company}</div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-text-secondary">
                                <div>{c.phone || '—'}</div>
                                <div className="text-[11px] text-text-tertiary">{c.email || ''}</div>
                              </td>
                              <td className="py-3 px-4 text-center font-bold font-mono">
                                {c.shipments_count || 0}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-text-primary">
                                ₹{(c.total_shipment_billing || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">
                                ₹{(c.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                                <span className={bal > 0 ? 'text-rose-600' : bal < 0 ? 'text-blue-600' : 'text-emerald-600'}>
                                  ₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    bal > 0
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : bal < 0
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  {c.status_label}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => openNewEntry('customer_payment', { customer_id: c.id, party_name: c.name })}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                    title="Record payment received from this customer"
                                  >
                                    + Pay
                                  </button>
                                  <button
                                    onClick={() => setStatementCustomer(c)}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-surface-alt border border-border text-text-primary hover:bg-surface"
                                    title="View customer ledger statement"
                                  >
                                    Statement
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB 3: WALK-IN CUSTOMERS BALANCE SHEET
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'walkin' && (
            <div className="space-y-4">
              {/* Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Walk-in Bookings</span>
                  <div className="text-lg font-bold text-text-primary mt-1">
                    {walkinData?.summary?.total_count || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Total Billed / Revenue</span>
                  <div className="text-lg font-bold text-emerald-600 mt-1">
                    ₹{(walkinData?.summary?.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Cash Drawer Collections</span>
                  <div className="text-lg font-bold text-primary mt-1">
                    ₹{(walkinData?.summary?.cash_collected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Digital / UPI Collections</span>
                  <div className="text-lg font-bold text-blue-600 mt-1">
                    ₹{(walkinData?.summary?.digital_collected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Search AWB, sender, receiver, country..."
                    value={walkinSearch}
                    onChange={(e) => setWalkinSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <button
                  onClick={() => openNewEntry('walkin_cash')}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  + Record Walk-in Cash
                </button>
              </div>

              {/* Walk-in Shipments Table */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-alt/50 text-text-secondary font-semibold">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Tracking AWB</th>
                        <th className="py-3 px-4">Sender</th>
                        <th className="py-3 px-4">Receiver & Country</th>
                        <th className="py-3 px-4 text-center">Weight</th>
                        <th className="py-3 px-4 text-center">Payment Mode</th>
                        <th className="py-3 px-4 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {walkinLoading ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-text-tertiary">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Loading walk-in shipments...
                          </td>
                        </tr>
                      ) : (walkinData?.shipments || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-text-tertiary">
                            No walk-in shipments found.
                          </td>
                        </tr>
                      ) : (
                        walkinData.shipments.map(s => (
                          <tr key={s.id} className="hover:bg-surface-alt/40 transition-colors">
                            <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                              {String(s.created_at || '').slice(0, 10)}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-primary">
                              {s.tracking_number}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-text-primary">{s.sender_name || 'Walk-in Sender'}</div>
                              {s.sender_phone && <div className="text-[11px] text-text-tertiary">{s.sender_phone}</div>}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-text-primary">{s.receiver_name}</div>
                              <div className="text-[11px] text-text-tertiary">{s.receiver_country}</div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-semibold">
                              {parseFloat(s.chargeable_weight || 0).toFixed(2)} kg
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-surface-alt border border-border">
                                {s.payment_mode || 'cash'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 text-sm">
                              ₹{parseFloat(s.total_amount || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB 4: VENDORS BALANCE SHEET
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'vendors' && (
            <div className="space-y-4">
              {/* Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Total Linehaul Cost Incurred</span>
                  <div className="text-lg font-bold text-text-primary mt-1">
                    ₹{(vendorsSheetData?.grand_total_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Total Paid to Vendors</span>
                  <div className="text-lg font-bold text-emerald-600 mt-1">
                    ₹{(vendorsSheetData?.grand_total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Total Outstanding Payables</span>
                  <div className="text-lg font-bold text-rose-600 mt-1">
                    ₹{(vendorsSheetData?.grand_total_payable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex justify-end">
                <button
                  onClick={() => openNewEntry('vendor_payment')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white flex items-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  + Record Vendor Payment
                </button>
              </div>

              {/* Vendors Table */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-alt/50 text-text-secondary font-semibold">
                        <th className="py-3 px-4">Vendor / Carrier</th>
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4 text-center">Shipments Forwarded</th>
                        <th className="py-3 px-4 text-center">Total Weight</th>
                        <th className="py-3 px-4 text-right">Freight Cost Billed (₹)</th>
                        <th className="py-3 px-4 text-right">Total Paid (₹)</th>
                        <th className="py-3 px-4 text-right">Payable Balance (₹)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {vendorsLoading ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-text-tertiary">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Loading vendors balance sheet...
                          </td>
                        </tr>
                      ) : (vendorsSheetData?.vendors || []).length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-text-tertiary">
                            No vendors configured yet.
                          </td>
                        </tr>
                      ) : (
                        vendorsSheetData.vendors.map(v => (
                          <tr key={v.id} className="hover:bg-surface-alt/40 transition-colors">
                            <td className="py-3 px-4 font-bold text-text-primary">{v.name}</td>
                            <td className="py-3 px-4 font-mono font-bold text-text-secondary">{v.vendor_code}</td>
                            <td className="py-3 px-4 text-center font-bold font-mono">{v.shipments_count}</td>
                            <td className="py-3 px-4 text-center font-mono">{v.total_weight.toFixed(2)} kg</td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-text-primary">
                              ₹{v.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">
                              ₹{v.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                              <span className={v.balance_payable > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                ₹{v.balance_payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  v.balance_payable > 0
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {v.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => openNewEntry('vendor_payment', { vendor_id: v.id, vendor_code: v.vendor_code, party_name: v.name })}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                              >
                                + Record Pay
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB 5: ENTRIES REGISTER
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'entries' && (
            <div className="space-y-4">
              {/* Filter Strip */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                      type="text"
                      placeholder="Search entry no, party, reference..."
                      value={entriesSearch}
                      onChange={(e) => setEntriesSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <select
                    value={entriesFilterType}
                    onChange={(e) => setEntriesFilterType(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Entry Types</option>
                    <option value="customer_payment">Customer Payment</option>
                    <option value="customer_charge">Customer Charge</option>
                    <option value="walkin_cash">Walk-in Cash</option>
                    <option value="vendor_payment">Vendor Payment</option>
                    <option value="expense">Office Expense</option>
                  </select>
                </div>

                <button
                  onClick={() => openNewEntry('customer_payment')}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  + Record Entry
                </button>
              </div>

              {/* Entries Table */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-alt/50 text-text-secondary font-semibold">
                        <th className="py-3 px-4">Entry No</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Party Name</th>
                        <th className="py-3 px-4">Mode / Ref</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4 text-right">Amount (₹)</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {entriesLoading ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-text-tertiary">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Loading entries...
                          </td>
                        </tr>
                      ) : (entriesData?.entries || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-text-tertiary">
                            No entries recorded yet. Click "+ Record Entry" above to add one.
                          </td>
                        </tr>
                      ) : (
                        entriesData.entries.map(e => {
                          const badge = ENTRY_TYPE_BADGES[e.entry_type] || { bg: '#f1f5f9', text: '#475569', label: e.entry_type }
                          return (
                            <tr key={e.id} className="hover:bg-surface-alt/40 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-text-primary">
                                {e.entry_number}
                              </td>
                              <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                                {String(e.entry_date).slice(0, 10)}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                                  style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
                                >
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold text-text-primary">
                                {e.party_name || '—'}
                              </td>
                              <td className="py-3 px-4 text-text-secondary">
                                <span className="uppercase font-semibold">{e.payment_mode}</span>
                                {e.reference_no && <span className="block text-[10px] text-text-tertiary">Ref: {e.reference_no}</span>}
                              </td>
                              <td className="py-3 px-4 text-text-secondary max-w-xs truncate">
                                {e.description || '—'}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-text-primary">
                                ₹{parseFloat(e.amount).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Delete entry ${e.entry_number}? Any customer balance updates will be reversed.`)) {
                                      deleteEntryMutation.mutate(e.id)
                                    }
                                  }}
                                  className="p-1 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700"
                                  title="Delete & Reverse"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── NEW ENTRY MODAL ── */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-text-primary">Record Financial Entry</h3>
              <button
                onClick={() => setShowEntryModal(false)}
                className="p-1 rounded-lg hover:bg-surface-alt text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createEntryMutation.mutate(entryForm)
              }}
              className="space-y-4 text-xs"
            >
              {/* Entry Type */}
              <div>
                <label className="block font-bold text-text-secondary mb-1">Entry Type *</label>
                <select
                  value={entryForm.entry_type}
                  onChange={(e) => {
                    const val = e.target.value
                    setEntryForm({
                      ...entryForm,
                      entry_type: val,
                      party_type: val.startsWith('customer') ? 'customer' : val.startsWith('vendor') ? 'vendor' : val === 'walkin_cash' ? 'walkin' : 'expense'
                    })
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="customer_payment">💰 Customer Payment Received (Credit Customer)</option>
                  <option value="customer_charge">📄 Customer Shipment / Charge (Debit Customer)</option>
                  <option value="walkin_cash">💵 Walk-in Cash Collected</option>
                  <option value="vendor_payment">🚚 Vendor / Carrier Payment Paid (Debit Vendor)</option>
                  <option value="vendor_bill">📦 Vendor Bill Incurred (Credit Vendor)</option>
                  <option value="expense">🏢 Office / Counter Expense</option>
                </select>
              </div>

              {/* Conditional Customer / Vendor Selector */}
              {entryForm.entry_type.startsWith('customer') && (
                <div>
                  <label className="block font-bold text-text-secondary mb-1">Select Customer *</label>
                  <select
                    value={entryForm.customer_id}
                    onChange={(e) => {
                      const cust = customersList.find(c => String(c.id) === e.target.value)
                      setEntryForm({
                        ...entryForm,
                        customer_id: e.target.value,
                        party_name: cust ? cust.name : ''
                      })
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customersList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''} — Bal: ₹{parseFloat(c.current_balance || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {entryForm.entry_type.startsWith('vendor') && (
                <div>
                  <label className="block font-bold text-text-secondary mb-1">Select Vendor / Carrier *</label>
                  <select
                    value={entryForm.vendor_code}
                    onChange={(e) => {
                      const v = vendorsList.find(item => item.vendor_code === e.target.value)
                      setEntryForm({
                        ...entryForm,
                        vendor_code: e.target.value,
                        vendor_id: v?.id || '',
                        party_name: v ? v.name : ''
                      })
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendorsList.map(v => (
                      <option key={v.id} value={v.vendor_code}>
                        {v.name} ({v.vendor_code}) — Payable: ₹{parseFloat(v.balance_payable || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* General Party Name for Walkin or Expense */}
              {['walkin_cash', 'expense'].includes(entryForm.entry_type) && (
                <div>
                  <label className="block font-bold text-text-secondary mb-1">Party / Expense Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Counter Cash Drawer or Packaging Tape Purchase"
                    value={entryForm.party_name}
                    onChange={(e) => setEntryForm({ ...entryForm, party_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {/* Amount & Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-secondary mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={entryForm.amount}
                    onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-bold text-text-secondary mb-1">Payment Mode *</label>
                  <select
                    value={entryForm.payment_mode}
                    onChange={(e) => setEntryForm({ ...entryForm, payment_mode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="cash">Cash (Counter Drawer)</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Card / POS</option>
                  </select>
                </div>
              </div>

              {/* Reference & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-secondary mb-1">Ref / UPI / Chq No</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI-928372"
                    value={entryForm.reference_no}
                    onChange={(e) => setEntryForm({ ...entryForm, reference_no: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-bold text-text-secondary mb-1">Date *</label>
                  <input
                    type="date"
                    value={entryForm.entry_date}
                    onChange={(e) => setEntryForm({ ...entryForm, entry_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-text-secondary mb-1">Notes / Description</label>
                <input
                  type="text"
                  placeholder="Additional remarks..."
                  value={entryForm.description}
                  onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createEntryMutation.isPending || !entryForm.amount}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-xs"
                >
                  {createEntryMutation.isPending ? 'Saving Entry...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CUSTOMER STATEMENT MODAL ── */}
      {statementCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-text-primary">{statementCustomer.name}</h3>
                <span className="text-xs text-text-tertiary">
                  {statementCustomer.company ? `${statementCustomer.company} | ` : ''}Phone: {statementCustomer.phone || '—'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-text-tertiary uppercase font-bold">Outstanding Balance</span>
                <div className="text-base font-bold font-mono text-purple-600">
                  ₹{parseFloat(statementCustomer.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Statement Table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-alt/60 text-text-secondary font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                    <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                    <th className="py-2.5 px-3 text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {statementLoading ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-text-tertiary">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-primary" />
                        Loading statement...
                      </td>
                    </tr>
                  ) : (customerLedgerData?.entries || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-text-tertiary">
                        No ledger entries for this customer.
                      </td>
                    </tr>
                  ) : (
                    customerLedgerData.entries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-surface-alt/30">
                        <td className="py-2 px-3 text-text-secondary whitespace-nowrap">
                          {String(entry.entry_date).slice(0, 10)}
                        </td>
                        <td className="py-2 px-3 font-semibold uppercase text-[10px]">
                          <span className={entry.entry_type === 'debit' ? 'text-rose-600' : 'text-emerald-600'}>
                            {entry.entry_type === 'debit' ? 'Charge' : 'Payment'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-text-tertiary">{entry.reference_no || '—'}</td>
                        <td className="py-2 px-3 text-text-primary">{entry.description || '—'}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-rose-600">
                          {entry.entry_type === 'debit' ? `₹${parseFloat(entry.amount).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-600">
                          {entry.entry_type === 'credit' ? `₹${parseFloat(entry.amount).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-text-primary">
                          ₹{parseFloat(entry.balance_after || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  const cust = statementCustomer
                  setStatementCustomer(null)
                  openNewEntry('customer_payment', { customer_id: cust.id, party_name: cust.name })
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              >
                + Record Payment Received
              </button>
              <button
                onClick={() => setStatementCustomer(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-surface-alt border border-border text-text-primary hover:bg-surface"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
