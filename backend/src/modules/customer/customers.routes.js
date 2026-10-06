import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  toggleCustomerStatus,
  deleteCustomer,
  getCustomerLedger,
  createCustomerLedgerEntry,
  deleteCustomerLedgerEntry
} from './customers.controller.js'

const router = express.Router()

router.get('/', authMiddleware, getCustomers)
router.get('/:id', authMiddleware, getCustomerById)
router.post('/', authMiddleware, createCustomer)
router.put('/:id', authMiddleware, updateCustomer)
router.patch('/:id/status', authMiddleware, toggleCustomerStatus)
router.delete('/:id', authMiddleware, deleteCustomer)

// Customer Ledger (Debit & Credit entries)
router.get('/:id/ledger', authMiddleware, getCustomerLedger)
router.post('/:id/ledger', authMiddleware, createCustomerLedgerEntry)
router.delete('/:id/ledger/:entryId', authMiddleware, deleteCustomerLedgerEntry)

export default router
