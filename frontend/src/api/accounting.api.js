import api from './axios'

/**
 * Check if accounting ledger is enabled
 */
export const getLedgerStatus = () =>
  api.get('/accounting/status').then(res => res.data)

/**
 * Toggle accounting ledger enable/disable
 */
export const toggleLedgerStatus = (enabled) =>
  api.post('/accounting/status', { enabled }).then(res => res.data)

/**
 * Get Chart of Accounts
 */
export const getAccounts = (params = {}) =>
  api.get('/accounting/accounts', { params }).then(res => res.data)

/**
 * Create Master Account
 */
export const createAccount = (data) =>
  api.post('/accounting/accounts', data).then(res => res.data)

/**
 * Update Master Account
 */
export const updateAccount = (id, data) =>
  api.put(`/accounting/accounts/${id}`, data).then(res => res.data)

/**
 * Delete Master Account
 */
export const deleteAccount = (id) =>
  api.delete(`/accounting/accounts/${id}`).then(res => res.data)

/**
 * Get Vouchers List
 */
export const getVouchers = (params = {}) =>
  api.get('/accounting/vouchers', { params }).then(res => res.data)

/**
 * Get Single Voucher by ID
 */
export const getVoucher = (id) =>
  api.get(`/accounting/vouchers/${id}`).then(res => res.data)

/**
 * Create Double-Entry Voucher
 */
export const createVoucher = (data) =>
  api.post('/accounting/vouchers', data).then(res => res.data)

/**
 * Delete Voucher
 */
export const deleteVoucher = (id) =>
  api.delete(`/accounting/vouchers/${id}`).then(res => res.data)

/**
 * Get Account Ledger Statement
 */
export const getAccountLedger = (accountId, params = {}) =>
  api.get(`/accounting/ledger/${accountId}`, { params }).then(res => res.data)

/**
 * Get Trial Balance Report
 */
export const getTrialBalance = () =>
  api.get('/accounting/trial-balance').then(res => res.data)

/**
 * Get Day Book & Cash Drawer Tally
 */
export const getDayBook = (params = {}) =>
  api.get('/accounting/day-book', { params }).then(res => res.data)


/**
 * ═══════════════════════════════════════════════════════════════════════
 * SIMPLIFIED BALANCE SHEETS & DIRECT ENTRIES APIS
 * ═══════════════════════════════════════════════════════════════════════
 */

export const getMasterBalanceSheet = () =>
  api.get('/accounting/master-balance-sheet').then(res => res.data)

export const getCustomersBalanceSheet = () =>
  api.get('/accounting/customers-balance-sheet').then(res => res.data)

export const getWalkinBalanceSheet = (params = {}) =>
  api.get('/accounting/walkin-balance-sheet', { params }).then(res => res.data)

export const getVendorsBalanceSheet = () =>
  api.get('/accounting/vendors-balance-sheet').then(res => res.data)

export const getEntries = (params = {}) =>
  api.get('/accounting/entries', { params }).then(res => res.data)

export const createSimpleEntry = (data) =>
  api.post('/accounting/entries', data).then(res => res.data)

export const deleteSimpleEntry = (id) =>
  api.delete(`/accounting/entries/${id}`).then(res => res.data)
