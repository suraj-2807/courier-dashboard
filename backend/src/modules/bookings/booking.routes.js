import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  createBooking,
  saveBooking,
  pushBookingToApi,
  getBookings,
  getBookingById,
  getInvoicePdf,
  getWaybillPdf,
  getBoxLabelsPdf,
  getVendorDocument,
  updateBookingStatus,
  updateBookingBilling,
  trashBookings,
  restoreBookings,
  deletePermanentBookings,
  syncTrackingController,
  cloneBooking
} from './booking.controller.js'

const router = express.Router()

// Configure multer storage for KYC and booking documents
const DOCS_DIR = path.resolve(process.cwd(), 'uploads', 'documents')
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOCS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf'
    const clean = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    cb(null, `${clean}_${Date.now()}_${Math.round(Math.random() * 1e4)}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|pdf|doc|docx/i
    const ext = path.extname(file.originalname).toLowerCase()
    const mime = file.mimetype.toLowerCase()
    if (allowed.test(ext) || allowed.test(mime)) {
      cb(null, true)
    } else {
      cb(new Error('Only images, PDFs, and document files are allowed'))
    }
  }
})

// Document Upload endpoint for KYC documents (accepts field name 'document' or 'file')
router.post('/upload-document', upload.fields([{ name: 'document', maxCount: 1 }, { name: 'file', maxCount: 1 }]), (req, res) => {
  const file = req.files?.document?.[0] || req.files?.file?.[0] || req.file
  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' })
  }
  const fileUrl = `/uploads/documents/${file.filename}`
  return res.json({
    success: true,
    fileUrl,
    fileName: file.originalname,
    fileSize: file.size,
    fileType: file.mimetype
  })
})

router.post('/', authMiddleware, createBooking)
router.post('/save', authMiddleware, saveBooking)
router.post('/sync-tracking', authMiddleware, syncTrackingController)
router.post('/trash', authMiddleware, trashBookings)
router.post('/restore', authMiddleware, restoreBookings)
router.post('/delete-permanent', authMiddleware, deletePermanentBookings)
router.post('/:id/push', authMiddleware, pushBookingToApi)
router.post('/:id/clone', authMiddleware, cloneBooking)
router.get('/', authMiddleware, getBookings)
router.get('/:id', authMiddleware, getBookingById)
router.get('/:id/vendor-document', authMiddleware, getVendorDocument)
router.get('/:id/invoice-pdf', authMiddleware, getInvoicePdf)
router.get('/:id/bill-pdf', authMiddleware, getWaybillPdf)
router.get('/:id/labels-pdf', authMiddleware, getBoxLabelsPdf)
router.patch('/:id/status', authMiddleware, updateBookingStatus)
router.patch('/:id/billing', authMiddleware, updateBookingBilling)

export default router