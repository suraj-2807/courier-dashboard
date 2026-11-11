import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  BookOpen,
  Receipt,
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  IndianRupee,
  Layers,
  FileText,
  Check,
  X,
  RefreshCw,
  Wallet,
  Scale,
  Printer,
  ToggleLeft,
  ToggleRight,
  Eye,
  Building,
  User,
  ArrowRight,
  Calculator,
  Coins
} from 'lucide-react'
import * as accountingApi from '../api/accounting.api'
import { customersApi } from '../api/customers.api'
import { getVendors } from '../api/rates.api'

const VOUCHER_TYPE_COLORS = {
  receipt: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', label: 'Receipt Voucher (RV)' },
  payment: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', label: 'Payment Voucher (PV)' },
  sales_invoice: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', label: 'Sales Invoice (SV)' },
  purchase_bill: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa', label: 'Purchase Bill (PB)' },
  journal: { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe', label: 'Journal Voucher (JV)' },
  contra: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', label: 'Contra Voucher (CV)' },
  credit_note: { bg: '#fefce8', text: '#ca8a04', border: '#fef08a', label: 'Credit Note (CN)' },
  debit_note: { bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8', label: 'Debit Note (DN)' }
}

const ACCOUNT_TYPE_COLORS = {
  asset: { bg: '#ecfdf5', text: '#059669', label: 'Asset (Normal Dr)' },
  liability: { bg: '#eff6ff', text: '#2563eb', label: 'Liability (Normal Cr)' },
  equity: { bg: '#f5f3ff', text: '#7c3aed', label: 'Equity (Normal Cr)' },
  revenue: { bg: '#f0fdf4', text: '#16a34a', label: 'Revenue (Normal Cr)' },
  expense: { bg: '#fff1f2', text: '#e11d48', label: 'Expense (Normal Dr)' }
}

export default function AccountingPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('vouchers') // 'vouchers', 'new_voucher', 'day_book', 'coa', 'ledger', 'trial_balance'

  // Filters & State
  const [voucherFilterType, setVoucherFilterType] = useState('')
  const [voucherSearch, setVoucherSearch] = useState('')
  const [selectedVoucher, setSelectedVoucher] = useState(null)
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState('')
  const [dayBookDate, setDayBookDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Cash Denomination state for Day Book tally
  const [denominations, setDenominations] = useState({
    d2000: 0,
    d500: 0,
    d200: 0,
    d100: 0,
    d50: 0,
    d20: 0,
    d10: 0,
    coins: 0
  })

  // New Account Modal State
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [newAccountForm, setNewAccountForm] = useState({
    account_code: '',
    account_name: '',
    account_type: 'asset',
    group_category: '',
    linked_entity_type: 'none'
  })

  // New Voucher Form State
  const [voucherForm, setVoucherForm] = useState({
    voucher_type: 'receipt',
    voucher_date: new Date().toISOString().slice(0, 10),
    reference_no: '',
    customer_id: '',
    narration: '',
    items: [
      { account_id: '', debit_amount: '', credit_amount: '', particulars: '' },
      { account_id: '', debit_amount: '', credit_amount: '', particulars: '' }
    ]
  })

  // 1. Fetch Ledger Toggle Status
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['accounting-status'],
    queryFn: accountingApi.getLedgerStatus
  })
  const isLedgerEnabled = Boolean(statusData?.enabled)

  // Toggle Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: accountingApi.toggleLedgerStatus,
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['accounting-status'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-vouchers'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to toggle ledger')
  })

  // 2. Fetch Chart of Accounts
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => accountingApi.getAccounts(),
    enabled: isLedgerEnabled
  })
  const accounts = accountsData?.accounts || []

  // 3. Fetch Customers for linkage
  const { data: customersData } = useQuery({
    queryKey: ['customers-list-accounting'],
    queryFn: () => customersApi.getAll({ limit: 500 }).then(res => res.data),
    enabled: isLedgerEnabled
  })
  const customers = customersData?.customers || []

  // 4. Fetch Vendors for linkage
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors-list-accounting'],
    queryFn: getVendors,
    enabled: isLedgerEnabled
  })
  const vendors = vendorsData?.vendors || []

  // 5. Fetch Vouchers Register
  const { data: vouchersData, isLoading: vouchersLoading } = useQuery({
    queryKey: ['accounting-vouchers', voucherFilterType, voucherSearch],
    queryFn: () => accountingApi.getVouchers({ voucher_type: voucherFilterType, search: voucherSearch }),
    enabled: isLedgerEnabled
  })
  const vouchers = vouchersData?.vouchers || []

  // 6. Fetch Trial Balance
  const { data: trialBalanceData, isLoading: tbLoading } = useQuery({
    queryKey: ['accounting-trial-balance'],
    queryFn: accountingApi.getTrialBalance,
    enabled: isLedgerEnabled && activeTab === 'trial_balance'
  })

  // 7. Fetch Day Book
  const { data: dayBookData, isLoading: dayBookLoading } = useQuery({
    queryKey: ['accounting-day-book', dayBookDate],
    queryFn: () => accountingApi.getDayBook({ date: dayBookDate }),
    enabled: isLedgerEnabled && activeTab === 'day_book'
  })

  // 8. Fetch Account Ledger
  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['accounting-ledger', selectedLedgerAccountId],
    queryFn: () => accountingApi.getAccountLedger(selectedLedgerAccountId),
    enabled: isLedgerEnabled && Boolean(selectedLedgerAccountId) && activeTab === 'ledger'
  })

  // Create Voucher Mutation
  const createVoucherMutation = useMutation({
    mutationFn: accountingApi.createVoucher,
    onSuccess: (data) => {
      toast.success(data.message || 'Voucher recorded successfully!')
      queryClient.invalidateQueries({ queryKey: ['accounting-vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-trial-balance'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-day-book'] })
      // Reset form
      setVoucherForm({
        voucher_type: 'receipt',
        voucher_date: new Date().toISOString().slice(0, 10),
        reference_no: '',
        customer_id: '',
        narration: '',
        items: [
          { account_id: '', debit_amount: '', credit_amount: '', particulars: '' },
          { account_id: '', debit_amount: '', credit_amount: '', particulars: '' }
        ]
      })
      setActiveTab('vouchers')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create voucher')
  })

  // Delete Voucher Mutation
  const deleteVoucherMutation = useMutation({
    mutationFn: accountingApi.deleteVoucher,
    onSuccess: (data) => {
      toast.success(data.message || 'Voucher deleted')
      queryClient.invalidateQueries({ queryKey: ['accounting-vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-trial-balance'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-day-book'] })
      setSelectedVoucher(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete voucher')
  })

  // Create Master Account Mutation
  const createAccountMutation = useMutation({
    mutationFn: accountingApi.createAccount,
    onSuccess: () => {
      toast.success('Master account created successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
      setShowAddAccountModal(false)
      setNewAccountForm({
        account_code: '',
        account_name: '',
        account_type: 'asset',
        group_category: '',
        linked_entity_type: 'none'
      })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create account')
  })

  // Voucher Calculations for live tally validation
  const voucherTotals = useMemo(() => {
    let debits = 0
    let credits = 0
    voucherForm.items.forEach(it => {
      debits += parseFloat(it.debit_amount) || 0
      credits += parseFloat(it.credit_amount) || 0
    })
    const d = Math.round(debits * 100) / 100
    const c = Math.round(credits * 100) / 100
    const diff = Math.round(Math.abs(d - c) * 100) / 100
    const isTallied = diff < 0.01 && d > 0 && c > 0
    return { debits: d, credits: c, diff, isTallied }
  }, [voucherForm.items])

  // Physical Cash Denomination Calculation for Day Book
  const physicalCashTotal = useMemo(() => {
    const total =
      (parseInt(denominations.d2000, 10) || 0) * 2000 +
      (parseInt(denominations.d500, 10) || 0) * 500 +
      (parseInt(denominations.d200, 10) || 0) * 200 +
      (parseInt(denominations.d100, 10) || 0) * 100 +
      (parseInt(denominations.d50, 10) || 0) * 50 +
      (parseInt(denominations.d20, 10) || 0) * 20 +
      (parseInt(denominations.d10, 10) || 0) * 10 +
      (parseFloat(denominations.coins) || 0)
    return Math.round(total * 100) / 100
  }, [denominations])

  // Key KPI balances from Chart of Accounts
  const kpis = useMemo(() => {
    let cash = 0
    let bank = 0
    let debtors = 0
    let creditors = 0
    accounts.forEach(a => {
      const bal = parseFloat(a.current_balance) || 0
      if (a.account_code === '1111' || a.account_code === '1112') cash += bal
      else if (a.account_code === '1121' || a.account_code === '1122') bank += bal
      else if (a.account_code === '1130' || a.account_code === '1139') debtors += bal
      else if (a.account_code === '2110' || a.account_code === '2119') creditors += bal
    })
    return { cash, bank, debtors, creditors }
  }, [accounts])

  // Voucher Item row handlers
  const handleItemChange = (index, field, value) => {
    setVoucherForm(prev => {
      const newItems = [...prev.items]
      newItems[index] = { ...newItems[index], [field]: value }
      // If debit is typed, clear credit (and vice-versa) for clean single-side entry
      if (field === 'debit_amount' && value) {
        newItems[index].credit_amount = ''
      } else if (field === 'credit_amount' && value) {
        newItems[index].debit_amount = ''
      }
      return { ...prev, items: newItems }
    })
  }

  const addVoucherRow = () => {
    setVoucherForm(prev => ({
      ...prev,
      items: [...prev.items, { account_id: '', debit_amount: '', credit_amount: '', particulars: '' }]
    }))
  }

  const removeVoucherRow = (index) => {
    if (voucherForm.items.length <= 2) {
      toast.error('A double-entry voucher must have at least 2 line items')
      return
    }
    setVoucherForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  // Preset Template loader (quick fill)
  const applyPreset = (presetType) => {
    const cashAcc = accounts.find(a => a.account_code === '1111')
    const bankAcc = accounts.find(a => a.account_code === '1121')
    const revDomestic = accounts.find(a => a.account_code === '4110')
    const arAcc = accounts.find(a => a.account_code === '1130')
    const apAcc = accounts.find(a => a.account_code === '2110')
    const expFreight = accounts.find(a => a.account_code === '5110')
    const expPetty = accounts.find(a => a.account_code === '5230')

    if (presetType === 'walkin_cash') {
      setVoucherForm({
        voucher_type: 'receipt',
        voucher_date: new Date().toISOString().slice(0, 10),
        reference_no: 'WALK-IN',
        customer_id: '',
        narration: 'Retail walk-in parcel freight collection in counter cash drawer',
        items: [
          { account_id: cashAcc ? String(cashAcc.id) : '', debit_amount: '', credit_amount: '', particulars: 'Cash In (Counter Drawer)' },
          { account_id: revDomestic ? String(revDomestic.id) : '', debit_amount: '', credit_amount: '', particulars: 'Domestic Courier Freight Revenue' }
        ]
      })
    } else if (presetType === 'customer_bank_receipt') {
      setVoucherForm({
        voucher_type: 'receipt',
        voucher_date: new Date().toISOString().slice(0, 10),
        reference_no: 'UPI/NEFT',
        customer_id: '',
        narration: 'Customer outstanding balance payment received via Bank/UPI',
        items: [
          { account_id: bankAcc ? String(bankAcc.id) : '', debit_amount: '', credit_amount: '', particulars: 'Operating Bank Account (Current A/c)' },
          { account_id: arAcc ? String(arAcc.id) : '', debit_amount: '', credit_amount: '', particulars: 'Accounts Receivable (Customer Credit Cleared)' }
        ]
      })
    } else if (presetType === 'carrier_payment') {
      setVoucherForm({
        voucher_type: 'payment',
        voucher_date: new Date().toISOString().slice(0, 10),
        reference_no: 'LINEHAUL-PAY',
        customer_id: '',
        narration: 'Linehaul freight carrier payment settlement',
        items: [
          { account_id: apAcc ? String(apAcc.id) : '', debit_amount: '', credit_amount: '', particulars: 'Carrier Accounts Payable (Debit to reduce liability)' },
          { account_id: bankAcc ? String(bankAcc.id) : '', debit_amount: '', credit_amount: '', particulars: 'Bank Transfer to Carrier' }
        ]
      })
    } else if (presetType === 'petty_cash') {
      setVoucherForm({
        voucher_type: 'payment',
        voucher_date: new Date().toISOString().slice(0, 10),
        reference_no: 'PETTY',
        customer_id: '',
        narration: 'Counter packaging tape, stationery & petty expenses',
        items: [
          { account_id: expPetty ? String(expPetty.id) : '', debit_amount: '', credit_amount: '', particulars: 'Printing, Barcode & Stationery Expense' },
          { account_id: cashAcc ? String(cashAcc.id) : '', debit_amount: '', credit_amount: '', particulars: 'Paid from Counter Cash Drawer' }
        ]
      })
    } else if (presetType === 'contra_deposit') {
      setVoucherForm({
        voucher_type: 'contra',
        voucher_date: new Date().toISOString().slice(0, 10),
        reference_no: 'BANK-DEP',
        customer_id: '',
        narration: 'Day-end counter cash drawer deposited into bank account',
        items: [
          { account_id: bankAcc ? String(bankAcc.id) : '', debit_amount: '', credit_amount: '', particulars: 'Operating Bank Account (Deposit Dr)' },
          { account_id: cashAcc ? String(cashAcc.id) : '', debit_amount: '', credit_amount: '', particulars: 'Counter Cash Register (Withdrawal Cr)' }
        ]
      })
    }
  }

  const handleSaveVoucher = (e) => {
    e.preventDefault()
    if (!voucherTotals.isTallied) {
      toast.error(`Voucher is not balanced! Debit: ₹${voucherTotals.debits.toFixed(2)}, Credit: ₹${voucherTotals.credits.toFixed(2)}`)
      return
    }

    const payload = {
      ...voucherForm,
      items: voucherForm.items.map(it => ({
        account_id: parseInt(it.account_id, 10),
        debit_amount: parseFloat(it.debit_amount) || 0,
        credit_amount: parseFloat(it.credit_amount) || 0,
        particulars: it.particulars || ''
      }))
    }
    createVoucherMutation.mutate(payload)
  }

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
                Accounting & General Ledger
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
              Double-entry bookkeeping ($\sum Dr = \sum Cr$), Counter Day Book tallying, Master Chart of Accounts, and Trial Balance.
            </p>
          </div>
        </div>

        {/* Enable / Disable Ledger Button */}
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
              <h3 className="text-sm font-bold">Accounting Ledger is Currently Inactive</h3>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/80 mt-1">
                To start entering balanced debit/credit vouchers, tracking customer & vendor accounts, tallying counter cash, and viewing live financial trial balances, activate the ledger toggle above.
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleStatusMutation.mutate(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap shadow-xs"
          >
            Activate Accounting Ledger
          </button>
        </div>
      )}

      {/* ── Active Module Content ── */}
      {isLedgerEnabled && (
        <>
          {/* Key KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-surface border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Cash in Hand</span>
                <Wallet className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-text-primary mt-1">
                ₹{kpis.cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-text-tertiary">Drawer & Petty Cash</span>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Bank & Gateway</span>
                <Building className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-lg font-bold text-text-primary mt-1">
                ₹{kpis.bank.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-text-tertiary">Current A/c & UPI Clearing</span>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Accounts Receivable</span>
                <User className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-lg font-bold text-text-primary mt-1">
                ₹{kpis.debtors.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-text-tertiary">Total Customer Dues (Dr)</span>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Accounts Payable</span>
                <Scale className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-lg font-bold text-text-primary mt-1">
                ₹{kpis.creditors.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-text-tertiary">Carrier & Vendor Bills (Cr)</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-1 text-sm font-semibold">
            <button
              onClick={() => setActiveTab('vouchers')}
              className={`px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'vouchers'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Voucher Register
            </button>

            <button
              onClick={() => setActiveTab('new_voucher')}
              className={`px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'new_voucher'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Plus className="w-4 h-4" />
              New Voucher Entry
            </button>

            <button
              onClick={() => setActiveTab('day_book')}
              className={`px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'day_book'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Coins className="w-4 h-4" />
              Day Book & Cash Tally
            </button>

            <button
              onClick={() => setActiveTab('coa')}
              className={`px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'coa'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Layers className="w-4 h-4" />
              Chart of Accounts (COA)
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'ledger'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Account Ledger
            </button>

            <button
              onClick={() => setActiveTab('trial_balance')}
              className={`px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'trial_balance'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Scale className="w-4 h-4" />
              Trial Balance ($\Delta = 0$)
            </button>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              TAB 1: VOUCHER REGISTER
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'vouchers' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                      type="text"
                      placeholder="Search voucher no, ref, narration..."
                      value={voucherSearch}
                      onChange={(e) => setVoucherSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <select
                    value={voucherFilterType}
                    onChange={(e) => setVoucherFilterType(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Voucher Types</option>
                    <option value="receipt">Receipt Voucher (RV)</option>
                    <option value="payment">Payment Voucher (PV)</option>
                    <option value="sales_invoice">Sales Invoice (SV)</option>
                    <option value="purchase_bill">Purchase Bill (PB)</option>
                    <option value="journal">Journal Voucher (JV)</option>
                    <option value="contra">Contra Voucher (CV)</option>
                    <option value="credit_note">Credit Note (CN)</option>
                    <option value="debit_note">Debit Note (DN)</option>
                  </select>
                </div>

                <button
                  onClick={() => setActiveTab('new_voucher')}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Record New Voucher
                </button>
              </div>

              {/* Vouchers Table */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-alt/50 text-text-secondary font-semibold">
                        <th className="py-3 px-4">Voucher No</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Narration / Particulars</th>
                        <th className="py-3 px-4">Customer / Vendor</th>
                        <th className="py-3 px-4 text-right">Debit (₹)</th>
                        <th className="py-3 px-4 text-right">Credit (₹)</th>
                        <th className="py-3 px-4 text-center">Tallied</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {vouchersLoading ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-text-tertiary">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Loading vouchers...
                          </td>
                        </tr>
                      ) : vouchers.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-text-tertiary">
                            <Receipt className="w-8 h-8 mx-auto mb-2 text-text-tertiary/50" />
                            <p className="font-semibold text-text-secondary">No vouchers recorded yet</p>
                            <p className="text-[11px] mt-1">Click "Record New Voucher" or pick a quick template to create your first balanced journal voucher.</p>
                          </td>
                        </tr>
                      ) : (
                        vouchers.map(v => {
                          const badge = VOUCHER_TYPE_COLORS[v.voucher_type] || { bg: '#f1f5f9', text: '#475569', label: v.voucher_type }
                          return (
                            <tr key={v.id} className="hover:bg-surface-alt/40 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-text-primary">
                                {v.voucher_no}
                                {v.reference_no && (
                                  <span className="block text-[10px] font-normal text-text-tertiary">Ref: {v.reference_no}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                                {String(v.voucher_date).slice(0, 10)}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                                  style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
                                >
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-text-primary max-w-xs truncate">
                                {v.narration || '—'}
                              </td>
                              <td className="py-3 px-4 text-text-secondary">
                                {v.customer_name ? (
                                  <span>{v.customer_name} {v.customer_company ? `(${v.customer_company})` : ''}</span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                ₹{parseFloat(v.total_debit).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                                ₹{parseFloat(v.total_credit).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Tallied
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={async () => {
                                      const res = await accountingApi.getVoucher(v.id)
                                      if (res?.voucher) setSelectedVoucher(res.voucher)
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-surface-alt text-text-secondary hover:text-text-primary"
                                    title="View Voucher Breakdown"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Delete voucher ${v.voucher_no}? This will reverse all associated account balance changes.`)) {
                                        deleteVoucherMutation.mutate(v.id)
                                      }
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700"
                                    title="Delete & Reverse"
                                  >
                                    <Trash2 className="w-4 h-4" />
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
              TAB 2: NEW VOUCHER ENTRY (DOUBLE ENTRY FORM)
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'new_voucher' && (
            <div className="space-y-6">
              {/* Quick Template Presets */}
              <div className="p-4 rounded-2xl bg-surface border border-border">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2.5">
                  Quick Voucher Presets (One-Click Setup)
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset('walkin_cash')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition-colors"
                  >
                    💵 Walk-in Cash Receipt (Dr Cash, Cr Revenue)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('customer_bank_receipt')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 transition-colors"
                  >
                    🏦 Customer UPI/Bank Payment (Dr Bank, Cr Debtors)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('carrier_payment')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 transition-colors"
                  >
                    🚚 Carrier Linehaul Payment (Dr Payables, Cr Bank)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('petty_cash')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 transition-colors"
                  >
                    📦 Counter Petty Expense (Dr Stationery, Cr Cash)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('contra_deposit')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 transition-colors"
                  >
                    🔄 Contra Cash Deposit to Bank (Dr Bank, Cr Cash)
                  </button>
                </div>
              </div>

              {/* Form Card */}
              <form onSubmit={handleSaveVoucher} className="p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {/* Voucher Type */}
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">
                      Voucher Type *
                    </label>
                    <select
                      value={voucherForm.voucher_type}
                      onChange={(e) => setVoucherForm({ ...voucherForm, voucher_type: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="receipt">Receipt Voucher (RV)</option>
                      <option value="payment">Payment Voucher (PV)</option>
                      <option value="sales_invoice">Sales Invoice (SV)</option>
                      <option value="purchase_bill">Purchase Bill (PB)</option>
                      <option value="journal">Journal Voucher (JV)</option>
                      <option value="contra">Contra Voucher (CV)</option>
                      <option value="credit_note">Credit Note (CN)</option>
                      <option value="debit_note">Debit Note (DN)</option>
                    </select>
                  </div>

                  {/* Voucher Date */}
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={voucherForm.voucher_date}
                      onChange={(e) => setVoucherForm({ ...voucherForm, voucher_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>

                  {/* Reference No */}
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">
                      Reference / Chq / UPI No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UPI-928372 or INV-1002"
                      value={voucherForm.reference_no}
                      onChange={(e) => setVoucherForm({ ...voucherForm, reference_no: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Customer Linkage */}
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">
                      Link Customer (Optional)
                    </label>
                    <select
                      value={voucherForm.customer_id}
                      onChange={(e) => setVoucherForm({ ...voucherForm, customer_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">None / Walk-in</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''} — Bal: ₹{parseFloat(c.current_balance || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Narration */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Narration / Transaction Description
                  </label>
                  <input
                    type="text"
                    placeholder="Provide a clear description for auditing & Day Book records..."
                    value={voucherForm.narration}
                    onChange={(e) => setVoucherForm({ ...voucherForm, narration: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* ── Double-Entry Line Items ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                      Double-Entry Breakdown Rows ($\sum Dr = \sum Cr$)
                    </span>
                    <button
                      type="button"
                      onClick={addVoucherRow}
                      className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Account Row
                    </button>
                  </div>

                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-surface-alt/60 text-text-secondary font-semibold">
                          <th className="py-2.5 px-3 w-10">#</th>
                          <th className="py-2.5 px-3">Master Account *</th>
                          <th className="py-2.5 px-3">Particulars / Note</th>
                          <th className="py-2.5 px-3 w-36 text-right">Debit ($Dr$) ₹</th>
                          <th className="py-2.5 px-3 w-36 text-right">Credit ($Cr$) ₹</th>
                          <th className="py-2.5 px-3 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {voucherForm.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-surface-alt/20">
                            <td className="py-2.5 px-3 text-text-tertiary font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <select
                                value={it.account_id}
                                onChange={(e) => handleItemChange(idx, 'account_id', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                required
                              >
                                <option value="">Select Account...</option>
                                <optgroup label="1000 - Assets (Dr Increases)">
                                  {accounts.filter(a => a.account_type === 'asset').map(a => (
                                    <option key={a.id} value={a.id}>
                                      {a.account_code} - {a.account_name} (₹{parseFloat(a.current_balance).toFixed(2)})
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="2000 - Liabilities (Cr Increases)">
                                  {accounts.filter(a => a.account_type === 'liability').map(a => (
                                    <option key={a.id} value={a.id}>
                                      {a.account_code} - {a.account_name} (₹{parseFloat(a.current_balance).toFixed(2)})
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="3000 - Equity (Cr Increases)">
                                  {accounts.filter(a => a.account_type === 'equity').map(a => (
                                    <option key={a.id} value={a.id}>
                                      {a.account_code} - {a.account_name}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="4000 - Revenue (Cr Increases)">
                                  {accounts.filter(a => a.account_type === 'revenue').map(a => (
                                    <option key={a.id} value={a.id}>
                                      {a.account_code} - {a.account_name}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="5000 - Expenses (Dr Increases)">
                                  {accounts.filter(a => a.account_type === 'expense').map(a => (
                                    <option key={a.id} value={a.id}>
                                      {a.account_code} - {a.account_name}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                placeholder="Row particulars..."
                                value={it.particulars}
                                onChange={(e) => handleItemChange(idx, 'particulars', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={it.debit_amount}
                                onChange={(e) => handleItemChange(idx, 'debit_amount', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs text-right font-mono font-bold rounded-lg border border-border bg-surface text-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={it.credit_amount}
                                onChange={(e) => handleItemChange(idx, 'credit_amount', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs text-right font-mono font-bold rounded-lg border border-border bg-surface text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {voucherForm.items.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeVoucherRow(idx)}
                                  className="text-text-tertiary hover:text-rose-500 p-1"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border bg-surface-alt/70 font-bold">
                          <td colSpan={3} className="py-3 px-3 text-right text-text-secondary">
                            Total Double-Entry Sum:
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-600">
                            ₹{voucherTotals.debits.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-blue-600">
                            ₹{voucherTotals.credits.toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* ── Real-Time Tally Status Box ── */}
                <div
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
                    voucherTotals.isTallied
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {voucherTotals.isTallied ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="text-xs font-bold">
                        {voucherTotals.isTallied
                          ? 'Voucher is Perfectly Tallied (Double Entry Valid)'
                          : voucherTotals.debits === 0 && voucherTotals.credits === 0
                          ? 'Enter Debit and Credit amounts'
                          : `Unbalanced Voucher — Difference: ₹${voucherTotals.diff.toFixed(2)}`}
                      </h4>
                      <p className="text-[11px] opacity-80">
                        {voucherTotals.isTallied
                          ? `Total Debit: ₹${voucherTotals.debits.toFixed(2)} matches Total Credit: ₹${voucherTotals.credits.toFixed(2)}. Variance = ₹0.00`
                          : `Total Debit (₹${voucherTotals.debits.toFixed(2)}) must equal Total Credit (₹${voucherTotals.credits.toFixed(2)}) before committing.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setActiveTab('vouchers')}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!voucherTotals.isTallied || createVoucherMutation.isPending}
                      className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all ${
                        voucherTotals.isTallied && !createVoucherMutation.isPending
                          ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                          : 'bg-gray-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {createVoucherMutation.isPending ? 'Validating & Committing...' : 'Commit & Tally Voucher'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB 3: DAY BOOK & CASH DRAWER TALLY
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'day_book' && (
            <div className="space-y-6">
              {/* Date Filter & Overview */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-border">
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Counter Day Book & Cash Drawer Tally</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Physical currency count verification against system booked transactions.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-text-tertiary" />
                  <input
                    type="date"
                    value={dayBookDate}
                    onChange={(e) => setDayBookDate(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                  />
                </div>
              </div>

              {/* Day Cash Movement Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Counter Cash In ($Dr$)</span>
                  <div className="text-lg font-bold text-emerald-600 mt-1">
                    +₹{(dayBookData?.day_cash_in || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-text-tertiary">Walk-in & Receipts</span>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Counter Cash Out ($Cr$)</span>
                  <div className="text-lg font-bold text-rose-600 mt-1">
                    -₹{(dayBookData?.day_cash_out || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-text-tertiary">Petty Expenses & Contra</span>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">Net Day Cash Flow</span>
                  <div className={`text-lg font-bold mt-1 ${(dayBookData?.net_cash_flow || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ₹{(dayBookData?.net_cash_flow || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-text-tertiary">Cash In minus Cash Out</span>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-border">
                  <span className="text-xs font-medium text-text-secondary">System Cash Drawer Balance</span>
                  <div className="text-lg font-bold text-primary mt-1">
                    ₹{parseFloat(dayBookData?.cash_account?.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-text-tertiary">Book Closing Balance</span>
                </div>
              </div>

              {/* Interactive Currency Counting Denomination Sheet */}
              <div className="p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-500" />
                      Physical Cash Drawer Denomination Counter
                    </h4>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Count physical notes in the cash drawer to verify tally with system cash balance.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDenominations({ d2000: 0, d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, d10: 0, coins: 0 })}
                    className="text-xs text-text-tertiary hover:text-text-primary"
                  >
                    Reset Count
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: 'd2000', label: '₹2000 Notes', mult: 2000 },
                    { key: 'd500', label: '₹500 Notes', mult: 500 },
                    { key: 'd200', label: '₹200 Notes', mult: 200 },
                    { key: 'd100', label: '₹100 Notes', mult: 100 },
                    { key: 'd50', label: '₹50 Notes', mult: 50 },
                    { key: 'd20', label: '₹20 Notes', mult: 20 },
                    { key: 'd10', label: '₹10 Notes', mult: 10 },
                    { key: 'coins', label: 'Coins / Small (₹)', mult: 1 }
                  ].map(denom => {
                    const count = denominations[denom.key] || 0
                    const subtotal = count * denom.mult
                    return (
                      <div key={denom.key} className="p-3 rounded-xl bg-surface-alt/50 border border-border space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-text-secondary">{denom.label}</span>
                          <span className="font-mono font-bold text-text-primary">₹{subtotal.toFixed(0)}</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={count || ''}
                          onChange={(e) => setDenominations({ ...denominations, [denom.key]: parseInt(e.target.value, 10) || 0 })}
                          placeholder="Count"
                          className="w-full px-2.5 py-1 text-xs text-center font-mono font-bold rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    )
                  })}
                </div>

                {/* Physical vs System Comparison Strip */}
                {(() => {
                  const systemCash = parseFloat(dayBookData?.cash_account?.current_balance || 0)
                  const diff = Math.round((physicalCashTotal - systemCash) * 100) / 100
                  const isMatch = Math.abs(diff) < 0.01 && physicalCashTotal > 0
                  return (
                    <div
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
                        isMatch
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200'
                          : physicalCashTotal === 0
                          ? 'bg-surface-alt border-border text-text-secondary'
                          : diff > 0
                          ? 'bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200'
                          : 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isMatch ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Calculator className="w-5 h-5 shrink-0 opacity-80" />
                        )}
                        <div>
                          <div className="text-xs font-bold">
                            Physical Count: ₹{physicalCashTotal.toFixed(2)} | System Book: ₹{systemCash.toFixed(2)}
                          </div>
                          <div className="text-[11px] opacity-80">
                            {isMatch
                              ? 'Cash Drawer is 100% Tallied with zero variance! (₹0.00)'
                              : physicalCashTotal === 0
                              ? 'Enter physical counts above to perform daily drawer verification.'
                              : diff > 0
                              ? `Cash Excess (Over): +₹${diff.toFixed(2)}`
                              : `Cash Shortage (Deficit): -₹${Math.abs(diff).toFixed(2)}`}
                          </div>
                        </div>
                      </div>

                      {physicalCashTotal > 0 && !isMatch && (
                        <button
                          type="button"
                          onClick={() => {
                            applyPreset('petty_cash')
                            setActiveTab('new_voucher')
                            toast('Pre-filling discrepancy adjustment voucher...')
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-surface border border-border text-text-primary hover:bg-surface-alt shadow-2xs whitespace-nowrap"
                        >
                          Record Discrepancy Voucher
                        </button>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Day Vouchers List */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="p-4 border-b border-border bg-surface-alt/40 font-bold text-xs text-text-primary">
                  Vouchers Recorded on {dayBookDate} ({dayBookData?.vouchers?.length || 0} entries)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-secondary font-semibold">
                        <th className="py-2.5 px-4">Voucher No</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Narration</th>
                        <th className="py-2.5 px-4">Customer</th>
                        <th className="py-2.5 px-4 text-right">Debit (₹)</th>
                        <th className="py-2.5 px-4 text-right">Credit (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(dayBookData?.vouchers || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-text-tertiary">
                            No vouchers recorded on {dayBookDate}
                          </td>
                        </tr>
                      ) : (
                        dayBookData.vouchers.map(v => (
                          <tr key={v.id} className="hover:bg-surface-alt/30">
                            <td className="py-2.5 px-4 font-mono font-bold text-text-primary">{v.voucher_no}</td>
                            <td className="py-2.5 px-4 uppercase text-[10px] font-bold text-text-secondary">{v.voucher_type}</td>
                            <td className="py-2.5 px-4 text-text-primary">{v.narration || '—'}</td>
                            <td className="py-2.5 px-4 text-text-secondary">{v.customer_name || '—'}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-600">
                              ₹{parseFloat(v.total_debit).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-blue-600">
                              ₹{parseFloat(v.total_credit).toFixed(2)}
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
              TAB 4: CHART OF ACCOUNTS (COA)
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'coa' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Master Chart of Accounts (COA)</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    General ledger hierarchy: Assets, Liabilities, Equity, Revenue, and Expenses.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white flex items-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Add Master Account
                </button>
              </div>

              {/* COA Table */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-alt/50 text-text-secondary font-semibold">
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Account Name</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Group Category</th>
                        <th className="py-3 px-4">Linked Entity</th>
                        <th className="py-3 px-4 text-right">Current Balance (₹)</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {accounts.map(acc => {
                        const typeBadge = ACCOUNT_TYPE_COLORS[acc.account_type] || { bg: '#f1f5f9', text: '#475569', label: acc.account_type }
                        const bal = parseFloat(acc.current_balance) || 0
                        return (
                          <tr key={acc.id} className="hover:bg-surface-alt/30 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-primary">{acc.account_code}</td>
                            <td className="py-3 px-4 font-semibold text-text-primary">{acc.account_name}</td>
                            <td className="py-3 px-4">
                              <span
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                                style={{ background: typeBadge.bg, color: typeBadge.text }}
                              >
                                {typeBadge.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-text-secondary">{acc.group_category}</td>
                            <td className="py-3 px-4 text-text-tertiary capitalize">{acc.linked_entity_type}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-text-primary">
                              ₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLedgerAccountId(acc.id)
                                  setActiveTab('ledger')
                                }}
                                className="text-xs text-primary font-semibold hover:underline"
                              >
                                View Ledger →
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB 5: ACCOUNT LEDGER STATEMENT
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-border">
                <div className="flex-1 w-full sm:w-auto">
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Select Master Account to Inspect Ledger
                  </label>
                  <select
                    value={selectedLedgerAccountId}
                    onChange={(e) => setSelectedLedgerAccountId(e.target.value)}
                    className="w-full sm:w-96 px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                  >
                    <option value="">-- Choose Account --</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.account_code} - {a.account_name} ({a.account_type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                {ledgerData?.account && (
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-[10px] text-text-tertiary uppercase font-bold">Closing Balance</span>
                      <div className="text-lg font-bold font-mono text-primary">
                        ₹{parseFloat(ledgerData.closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Ledger Statement Table */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-alt/50 text-text-secondary font-semibold">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Voucher No</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Particulars</th>
                        <th className="py-3 px-4">Narration</th>
                        <th className="py-3 px-4 text-right">Debit ($Dr$) ₹</th>
                        <th className="py-3 px-4 text-right">Credit ($Cr$) ₹</th>
                        <th className="py-3 px-4 text-right">Running Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {!selectedLedgerAccountId ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-text-tertiary">
                            Select an account above to view statement and running balance
                          </td>
                        </tr>
                      ) : ledgerLoading ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-text-tertiary">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Loading account ledger...
                          </td>
                        </tr>
                      ) : (ledgerData?.entries || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-text-tertiary">
                            No transactions recorded for this account yet
                          </td>
                        </tr>
                      ) : (
                        ledgerData.entries.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-surface-alt/30">
                            <td className="py-2.5 px-4 text-text-secondary whitespace-nowrap">
                              {String(entry.voucher_date).slice(0, 10)}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-text-primary">
                              {entry.voucher_no}
                            </td>
                            <td className="py-2.5 px-4 uppercase text-[10px] font-bold text-text-secondary">
                              {entry.voucher_type}
                            </td>
                            <td className="py-2.5 px-4 text-text-primary">
                              {entry.particulars || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-text-secondary">
                              {entry.narration || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-600">
                              {parseFloat(entry.debit_amount) > 0 ? `₹${parseFloat(entry.debit_amount).toFixed(2)}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-blue-600">
                              {parseFloat(entry.credit_amount) > 0 ? `₹${parseFloat(entry.credit_amount).toFixed(2)}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-text-primary">
                              ₹{parseFloat(entry.running_balance).toFixed(2)}
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
              TAB 6: TRIAL BALANCE REPORT
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'trial_balance' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-border">
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Trial Balance Verification</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Double-entry validation showing Total Debits vs Total Credits across all general ledger accounts.
                  </p>
                </div>

                <div
                  className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                    trialBalanceData?.is_tallied
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                  }`}
                >
                  {trialBalanceData?.is_tallied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Trial Balance is Perfectly Tallied ($\Delta = 0.00$)
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      Unbalanced Trial Balance (Variance: ₹{(trialBalanceData?.variance || 0).toFixed(2)})
                    </>
                  )}
                </div>
              </div>

              {/* Trial Balance Table */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-alt/60 text-text-secondary font-semibold">
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Master Account Name</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Debit Balance ($Dr$) ₹</th>
                        <th className="py-3 px-4 text-right">Credit Balance ($Cr$) ₹</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tbLoading ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-text-tertiary">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Calculating Trial Balance...
                          </td>
                        </tr>
                      ) : (
                        (trialBalanceData?.accounts || []).map(acc => (
                          <tr key={acc.id} className="hover:bg-surface-alt/30">
                            <td className="py-2.5 px-4 font-mono font-bold text-primary">{acc.account_code}</td>
                            <td className="py-2.5 px-4 font-semibold text-text-primary">{acc.account_name}</td>
                            <td className="py-2.5 px-4 uppercase text-[10px] font-bold text-text-tertiary">{acc.account_type}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-600">
                              {acc.debit_balance > 0 ? `₹${parseFloat(acc.debit_balance).toFixed(2)}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-blue-600">
                              {acc.credit_balance > 0 ? `₹${parseFloat(acc.credit_balance).toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-surface-alt font-bold text-xs">
                        <td colSpan={3} className="py-3.5 px-4 text-right text-text-primary uppercase tracking-wider">
                          Grand Total ($\sum Dr$ vs $\sum Cr$):
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-600 text-sm">
                          ₹{(trialBalanceData?.grand_total_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-blue-600 text-sm">
                          ₹{(trialBalanceData?.grand_total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── View Voucher Modal ── */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-primary">{selectedVoucher.voucher_no}</span>
                <h3 className="text-base font-bold text-text-primary capitalize mt-0.5">
                  {selectedVoucher.voucher_type.replace('_', ' ')} Voucher
                </h3>
                <span className="text-xs text-text-tertiary">
                  Date: {String(selectedVoucher.voucher_date).slice(0, 10)} {selectedVoucher.reference_no ? `| Ref: ${selectedVoucher.reference_no}` : ''}
                </span>
              </div>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="p-1 rounded-lg hover:bg-surface-alt text-text-secondary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedVoucher.narration && (
              <div className="p-3 rounded-xl bg-surface-alt/60 text-xs text-text-secondary">
                <span className="font-bold text-text-primary">Narration: </span>
                {selectedVoucher.narration}
              </div>
            )}

            {/* Line Items */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-alt/60 text-text-secondary font-semibold">
                    <th className="py-2 px-3">Account</th>
                    <th className="py-2 px-3">Particulars</th>
                    <th className="py-2 px-3 text-right">Debit (₹)</th>
                    <th className="py-2 px-3 text-right">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(selectedVoucher.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-semibold text-text-primary">
                        {it.account_code} - {it.account_name}
                      </td>
                      <td className="py-2 px-3 text-text-secondary">{it.particulars || '—'}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-600">
                        {parseFloat(it.debit_amount) > 0 ? `₹${parseFloat(it.debit_amount).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-blue-600">
                        {parseFloat(it.credit_amount) > 0 ? `₹${parseFloat(it.credit_amount).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-surface-alt font-bold">
                    <td colSpan={2} className="py-2.5 px-3 text-right text-text-secondary">Total:</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-600">
                      ₹{parseFloat(selectedVoucher.total_debit).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-600">
                      ₹{parseFloat(selectedVoucher.total_credit).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedVoucher(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-alt hover:bg-surface border border-border text-text-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Master Account Modal ── */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-text-primary">Create New Master Account</h3>
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="p-1 rounded-lg hover:bg-surface-alt text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-text-secondary mb-1">Account Code *</label>
                <input
                  type="text"
                  placeholder="e.g. 5260"
                  value={newAccountForm.account_code}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, account_code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-text-secondary mb-1">Account Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Vehicle Fuel & Maintenance"
                  value={newAccountForm.account_name}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, account_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-text-secondary mb-1">Account Type *</label>
                <select
                  value={newAccountForm.account_type}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, account_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="asset">Asset (Normal Debit)</option>
                  <option value="liability">Liability (Normal Credit)</option>
                  <option value="equity">Equity (Normal Credit)</option>
                  <option value="revenue">Revenue (Normal Credit)</option>
                  <option value="expense">Expense (Normal Debit)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-text-secondary mb-1">Group Category *</label>
                <input
                  type="text"
                  placeholder="e.g. Operating Expenses"
                  value={newAccountForm.group_category}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, group_category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-text-secondary mb-1">Linked Entity Type</label>
                <select
                  value={newAccountForm.linked_entity_type}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, linked_entity_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="none">None</option>
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor</option>
                  <option value="bank">Bank</option>
                  <option value="cash">Cash</option>
                  <option value="tax">Tax</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddAccountModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createAccountMutation.mutate(newAccountForm)}
                disabled={createAccountMutation.isPending || !newAccountForm.account_code || !newAccountForm.account_name}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-xs"
              >
                Save Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
