import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  createBooking,
  saveBooking,
  pushBookingToApi,
  getBookings,
  getBookingById,
  getInvoicePdf,
  getWaybillPdf,
  getBoxLabelsPdf,
  getVendorDocument,
  updateBookingStatus,
  updateBookingBilling,
  trashBookings,
  restoreBookings,
  deletePermanentBookings,
  syncTrackingController
} from './booking.controller.js'

const router = express.Router()

router.post('/', authMiddleware, createBooking)
router.post('/save', authMiddleware, saveBooking)
router.post('/sync-tracking', authMiddleware, syncTrackingController)
router.post('/trash', authMiddleware, trashBookings)
router.post('/restore', authMiddleware, restoreBookings)
router.post('/delete-permanent', authMiddleware, deletePermanentBookings)
router.post('/:id/push', authMiddleware, pushBookingToApi)
router.get('/', authMiddleware, getBookings)
router.get('/:id', authMiddleware, getBookingById)
router.get('/:id/vendor-document', authMiddleware, getVendorDocument)
router.get('/:id/invoice-pdf', authMiddleware, getInvoicePdf)
router.get('/:id/bill-pdf', authMiddleware, getWaybillPdf)
router.get('/:id/labels-pdf', authMiddleware, getBoxLabelsPdf)
router.patch('/:id/status', authMiddleware, updateBookingStatus)
router.patch('/:id/billing', authMiddleware, updateBookingBilling)

export default router