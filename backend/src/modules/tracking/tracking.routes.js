import express from 'express'
import { searchTracking, liveTrack } from './tracking.controller.js'

const router = express.Router()

// Public route — no auth required for tracking
router.get('/search', searchTracking)

// Live tracking via vendor APIs (Pacific, FlySwift, etc.)
router.get('/live', liveTrack)

export default router
