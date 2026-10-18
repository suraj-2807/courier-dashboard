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
  saveVendorWorkbook
} from './rates.controller.js'

const router = express.Router()

// Multer config for in-memory buffer handling of xlsx files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
})

// ═══════════════════════════════════════════════════════════════════════
// VENDOR RATE SHEETS (Direct Excel file-based, no DB storage)
// ═══════════════════════════════════════════════════════════════════════

// 1. Get all vendors available on the portal with rate sheet status
router.get('/vendors', authMiddleware, getVendors)

// 2. Import / upload a new Excel rate sheet for a vendor
router.post('/vendors/:vendorCode/import', authMiddleware, upload.single('file'), importVendorRateSheet)
router.post('/vendors/:vendorCode/upload', authMiddleware, upload.single('file'), importVendorRateSheet) // Alias

// 3. Get rate sheet details, sheets list, calculator inputs and sample destinations
router.get('/vendors/:vendorCode/details', authMiddleware, getVendorSheetInfo)
router.get('/vendors/:vendorCode/sheet-info', authMiddleware, getVendorSheetInfo) // Alias
router.get('/vendors/:vendorCode/destinations', authMiddleware, getDestinations)

// 4. In-Browser Spreadsheet Editor: Get & Save live workbook data
router.get('/vendors/:vendorCode/sheet-data', authMiddleware, getVendorWorkbook)
router.post('/vendors/:vendorCode/save-sheet-data', authMiddleware, saveVendorWorkbook)

// 5. Download active Excel rate sheet
router.get('/vendors/:vendorCode/download', downloadVendorSheet)

// 6. Calculate Vendor Rate (Sets C4, C5, C6, C7 and returns C10)
router.post('/calculate', authMiddleware, calculateVendorRate)
router.get('/calculate', authMiddleware, calculateVendorRate) // Also allow GET for quick checks

export default router
