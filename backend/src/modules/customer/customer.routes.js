import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import {
  getCustomerAddresses,
  saveCustomerAddress,
  deleteCustomerAddress,
  getCustomerDocuments,
  uploadCustomerDocument,
  saveCustomerDocument,
  deleteCustomerDocument
} from './customer.controller.js'

const router = express.Router()

// Configure multer storage for documents
const DOCUMENTS_DIR = path.resolve(process.cwd(), 'uploads', 'documents')
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, DOCUMENTS_DIR)
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.pdf'
    const safeName = file.originalname
      .replace(ext, '')
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 40)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6)
    cb(null, `${safeName}_${uniqueSuffix}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|pdf|doc|docx|csv|xls|xlsx/i
    const ext = path.extname(file.originalname).toLowerCase()
    const mime = file.mimetype.toLowerCase()
    if (allowedTypes.test(ext) || allowedTypes.test(mime)) {
      cb(null, true)
    } else {
      cb(new Error('Only images, PDFs, and office documents are allowed'))
    }
  }
})

// Address endpoints
router.get('/addresses', getCustomerAddresses)
router.post('/addresses', saveCustomerAddress)
router.put('/addresses/:id', saveCustomerAddress)
router.delete('/addresses/:id', deleteCustomerAddress)

// Document endpoints
router.get('/documents', getCustomerDocuments)
router.post('/documents', saveCustomerDocument)
router.put('/documents/:id', saveCustomerDocument)
router.delete('/documents/:id', deleteCustomerDocument)
router.post('/upload-document', upload.single('file'), uploadCustomerDocument)

export default router
