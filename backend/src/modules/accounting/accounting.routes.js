import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'
import {
  getLedgerStatus,
  toggleLedgerStatus,
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getVouchers,
  getVoucher,
  createVoucher,
  deleteVoucher,
  getAccountLedger,
  getTrialBalance,
  getDayBook,
  getMasterBalanceSheet,
  getCustomersBalanceSheet,
  getWalkinBalanceSheet,
  getVendorsBalanceSheet,
  getEntries,
  createSimpleEntry,
  deleteSimpleEntry
} from './accounting.controller.js'

const router = express.Router()

// All routes require authentication
router.use(authMiddleware)

// ── 1. Accounting Ledger Toggle Status ──
router.get('/status', getLedgerStatus)
router.post('/status', toggleLedgerStatus)

// ── 2. Simplified Balance Sheets (User Requested) ──
router.get('/master-balance-sheet', getMasterBalanceSheet)
router.get('/customers-balance-sheet', getCustomersBalanceSheet)
router.get('/walkin-balance-sheet', getWalkinBalanceSheet)
router.get('/vendors-balance-sheet', getVendorsBalanceSheet)

// ── 3. Simple Financial Entries Register ──
router.get('/entries', getEntries)
router.post('/entries', createSimpleEntry)
router.delete('/entries/:id', deleteSimpleEntry)

// ── 4. Master Accounts / Chart of Accounts (Legacy / Audit) ──
router.get('/accounts', getAccounts)
router.post('/accounts', createAccount)
router.put('/accounts/:id', updateAccount)
router.delete('/accounts/:id', deleteAccount)

// ── 5. Double-Entry Vouchers ──
router.get('/vouchers', getVouchers)
router.post('/vouchers', createVoucher)
router.get('/vouchers/:id', getVoucher)
router.delete('/vouchers/:id', deleteVoucher)

// ── 6. Reports & Ledgers ──
router.get('/ledger/:accountId', getAccountLedger)
router.get('/trial-balance', getTrialBalance)
router.get('/day-book', getDayBook)

export default router
