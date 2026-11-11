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
  getDayBook
} from './accounting.controller.js'

const router = express.Router()

// All routes require authentication
router.use(authMiddleware)

// Accounting Ledger Toggle Status
router.get('/status', getLedgerStatus)
router.post('/status', toggleLedgerStatus)

// Master Accounts / Chart of Accounts
router.get('/accounts', getAccounts)
router.post('/accounts', createAccount)
router.put('/accounts/:id', updateAccount)
router.delete('/accounts/:id', deleteAccount)

// Double-Entry Vouchers
router.get('/vouchers', getVouchers)
router.post('/vouchers', createVoucher)
router.get('/vouchers/:id', getVoucher)
router.delete('/vouchers/:id', deleteVoucher)

// Reports & Ledgers
router.get('/ledger/:accountId', getAccountLedger)
router.get('/trial-balance', getTrialBalance)
router.get('/day-book', getDayBook)

export default router
