import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  toggleCustomerStatus,
  deleteCustomer
} from './customers.controller.js'

const router = express.Router()

router.get('/', authMiddleware, getCustomers)
router.get('/:id', authMiddleware, getCustomerById)
router.post('/', authMiddleware, createCustomer)
router.put('/:id', authMiddleware, updateCustomer)
router.patch('/:id/status', authMiddleware, toggleCustomerStatus)
router.delete('/:id', authMiddleware, deleteCustomer)

export default router
