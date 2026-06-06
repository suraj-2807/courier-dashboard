import express from 'express'
import { searchTracking } from './tracking.controller.js'

const router = express.Router()

// Public route — no auth required for tracking
router.get('/search', searchTracking)

export default router
