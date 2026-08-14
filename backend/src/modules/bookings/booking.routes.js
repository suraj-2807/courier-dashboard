import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  createBooking,
  saveBooking,
  pushBookingToApi,
  getBookings,
  getBookingById,
  getInvoicePdf,
  updateBookingStatus
} from './booking.controller.js'

const router = express.Router()

router.post('/', authMiddleware, createBooking)
router.post('/save', authMiddleware, saveBooking)
router.post('/:id/push', authMiddleware, pushBookingToApi)
router.get('/', authMiddleware, getBookings)
router.get('/:id', authMiddleware, getBookingById)
router.get('/:id/invoice-pdf', authMiddleware, getInvoicePdf)
router.patch('/:id/status', authMiddleware, updateBookingStatus)

export default router