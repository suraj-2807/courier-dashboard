import express from 'express'
import { execute, query } from '../config/db.js'

import authRoutes from '../modules/auth/auth.routes.js'
import senderRoutes from '../modules/senders/sender.routes.js'
import receiverRoutes from '../modules/receivers/receiver.routes.js'
import bookingRoutes from '../modules/bookings/booking.routes.js'
import trackingRoutes from '../modules/tracking/tracking.routes.js'
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js'
import apiSettingsRoutes from '../modules/apiSettings/apiSettings.routes.js'
import ratesRoutes from '../modules/rates/rates.routes.js'

const router = express.Router()

router.get('/health', (req, res) => {
  return res.json({
    success: true,
    message: 'Courier API running successfully'
  })
})

router.use('/auth', authRoutes)
router.use('/senders', senderRoutes)
router.use('/receivers', receiverRoutes)
router.use('/bookings', bookingRoutes)
router.use('/tracking', trackingRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/api-settings', apiSettingsRoutes)
router.use('/rates', ratesRoutes)

// Public Customer endpoints (for WP Portal iframe)
import { createBooking } from '../modules/bookings/booking.controller.js'
import { getActiveVendors } from '../modules/apiSettings/apiSettings.controller.js'
const customerRouter = express.Router()
customerRouter.get('/active-vendors', getActiveVendors)
customerRouter.post('/bookings', createBooking)
router.use('/customer', customerRouter)

export default router