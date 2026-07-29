import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  getBookingRequests,
  getBookingRequestById,
  updateBookingRequestStatus
} from './bookingRequest.controller.js'

const router = express.Router()

// Admin endpoints (auth required)
router.get('/', authMiddleware, getBookingRequests)
router.get('/:id', authMiddleware, getBookingRequestById)
router.patch('/:id/status', authMiddleware, updateBookingRequestStatus)

export default router
