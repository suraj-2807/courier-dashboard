import express from 'express'
import multer from 'multer'
import authMiddleware from '../../middlewares/auth.middleware.js'
import {
  getVendors,
  importVendorRateSheet,
  getVendorSheetInfo,
  downloadVendorSheet,
  calculateVendorRate,
  getDestinations,
  getVendorWorkbook,
  saveVendorWorkbook,
  getCountries,
  getServices,
  resolveZone,
  getSheets,
  queryRates,
  sandboxProxy
} from './rates.controller.js'

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
})

// ═══════════════════════════════════════════════════════════════════════
// LIVE PRINCE EXPRESS RATES API ROUTES
// ═══════════════════════════════════════════════════════════════════════

// 1. Calculate Rate (Primary endpoint used by bookings & calculator)
router.post('/calculate', authMiddleware, calculateVendorRate)
router.get('/calculate', authMiddleware, calculateVendorRate)

// 2. Vendors List
router.get('/vendors', authMiddleware, getVendors)

// 3. Countries List
router.get('/countries', authMiddleware, getCountries)
router.get('/vendors/:vendorCode/countries', authMiddleware, getCountries)

// 4. Services Filtered by Country / Vendor
router.get('/services', authMiddleware, getServices)
router.get('/vendors/:vendorCode/services', authMiddleware, getServices)

// 5. Zone Resolution for Postcodes
router.get('/zones', authMiddleware, resolveZone)

// 6. Worksheets & Metadata
router.get('/sheets', authMiddleware, getSheets)
router.get('/vendors/:vendorCode/sheets', authMiddleware, getSheets)

// 7. Rate Lookup / Query Records
router.get('/query', authMiddleware, queryRates)
router.get('/records', authMiddleware, queryRates)

// 8. Live Sandbox Proxy
router.post('/proxy', authMiddleware, sandboxProxy)

// ═══════════════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY ROUTES
// ═══════════════════════════════════════════════════════════════════════
router.get('/vendors/:vendorCode/details', authMiddleware, getVendorSheetInfo)
router.get('/vendors/:vendorCode/sheet-info', authMiddleware, getVendorSheetInfo)
router.get('/vendors/:vendorCode/destinations', authMiddleware, getDestinations)
router.get('/vendors/:vendorCode/sheet-data', authMiddleware, getVendorWorkbook)
router.post('/vendors/:vendorCode/save-sheet-data', authMiddleware, saveVendorWorkbook)
router.post('/vendors/:vendorCode/import', authMiddleware, upload.single('file'), importVendorRateSheet)
router.post('/vendors/:vendorCode/upload', authMiddleware, upload.single('file'), importVendorRateSheet)
router.get('/vendors/:vendorCode/download', downloadVendorSheet)

export default router
