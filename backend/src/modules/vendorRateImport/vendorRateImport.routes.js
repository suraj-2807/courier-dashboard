import express from 'express'
import multer from 'multer'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  validateVendorWorkbook,
  importVendorWorkbook,
  getImportBatches,
  getBatchDetail,
  deleteImportBatch,
  getImportVendors
} from './vendorRateImport.controller.js'

const router = express.Router()

// Multer config — store in memory buffer for xlsx parsing
const upload = multer({ storage: multer.memoryStorage() })

// Validate an Excel workbook without importing
router.post('/validate', authMiddleware, upload.single('file'), validateVendorWorkbook)

// Import an Excel workbook (validate + store)
router.post('/import', authMiddleware, upload.single('file'), importVendorWorkbook)

// Get all import batches (optional ?vendor_name= filter)
router.get('/batches', authMiddleware, getImportBatches)

// Get single batch details with paginated records
router.get('/batches/:batchId', authMiddleware, getBatchDetail)

// Delete an import batch
router.delete('/batches/:batchId', authMiddleware, deleteImportBatch)

// Get distinct vendor names for dropdown
router.get('/vendors', authMiddleware, getImportVendors)

export default router
