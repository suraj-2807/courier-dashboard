import express from 'express'

import authRoutes from '../modules/auth/auth.routes.js'
import senderRoutes from '../modules/senders/sender.routes.js'
import receiverRoutes from '../modules/receivers/receiver.routes.js'
import bookingRoutes from '../modules/bookings/booking.routes.js'
import trackingRoutes from '../modules/tracking/tracking.routes.js'
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js'
import apiSettingsRoutes from '../modules/apiSettings/apiSettings.routes.js'

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

export default router