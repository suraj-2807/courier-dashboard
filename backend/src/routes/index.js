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
import bookingRequestRoutes from '../modules/bookingRequests/bookingRequest.routes.js'
import countryCodeRoutes from '../modules/countryCodes/countryCode.routes.js'
import systemSettingsRoutes from '../modules/systemSettings/systemSettings.routes.js'
import productRoutes from '../modules/products/product.routes.js'

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
router.use('/system-settings', systemSettingsRoutes)
router.use('/rates', ratesRoutes)
router.use('/booking-requests', bookingRequestRoutes)
router.use('/country-codes', countryCodeRoutes)
router.use('/products', productRoutes)

// Public Customer endpoints (for WP Portal iframe & Customer Portal)
import { createBooking } from '../modules/bookings/booking.controller.js'
import { getActiveVendors } from '../modules/apiSettings/apiSettings.controller.js'
import { createBookingRequest, getCustomerRequests, getCustomerRequest } from '../modules/bookingRequests/bookingRequest.controller.js'
import customerRoutes from '../modules/customer/customer.routes.js'

const customerRouter = express.Router()
customerRouter.get('/active-vendors', getActiveVendors)
customerRouter.post('/bookings', createBooking)
customerRouter.post('/booking-requests', createBookingRequest)
customerRouter.get('/my-requests', getCustomerRequests)
customerRouter.get('/my-requests/:request_awb', getCustomerRequest)
customerRouter.use('/', customerRoutes)
router.use('/customer', customerRouter)

export default router