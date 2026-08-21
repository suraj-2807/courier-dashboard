import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'
import { getSystemSettings, updateSystemSettings } from './systemSettings.controller.js'

const router = express.Router()

router.get('/', authMiddleware, getSystemSettings)
router.post('/', authMiddleware, updateSystemSettings)
router.put('/', authMiddleware, updateSystemSettings)

export default router
