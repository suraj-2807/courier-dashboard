import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus
} from './booking.controller.js'

const router = express.Router()

router.post('/', authMiddleware, createBooking)
router.get('/', authMiddleware, getBookings)
router.get('/:id', authMiddleware, getBookingById)
router.patch('/:id/status', authMiddleware, updateBookingStatus)

export default router