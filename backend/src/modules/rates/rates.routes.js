import express from 'express'
import multer from 'multer'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  uploadExcel,
  getCompanies,
  getCompanyServices,
  getServiceRates,
  getServiceZones,
  updateRateEntry,
  updateZoneEntry,
  deleteService,
  deleteCompany,
  uploadVendorRateSheet,
  getVendorVersions,
  getVendorVersionDetail,
  activateVendorVersion,
  getVendorVersionDiff,
  deleteVendorVersion,
  calculateVendorRate,
  getVendorDestinations
} from './rates.controller.js'

const router = express.Router()

// Multer config — store in memory buffer for xlsx parsing
const upload = multer({ storage: multer.memoryStorage() })

// Upload Excel (filename = "ServiceName CompanyName.xlsx")
router.post('/upload-excel', authMiddleware, upload.single('file'), uploadExcel)

// Companies
router.get('/companies', authMiddleware, getCompanies)
router.delete('/companies/:companyId', authMiddleware, deleteCompany)

// Services
router.get('/companies/:companyId/services', authMiddleware, getCompanyServices)
router.delete('/services/:serviceId', authMiddleware, deleteService)

// Rate Entries
router.get('/services/:serviceId/rates', authMiddleware, getServiceRates)
router.put('/rates/:id', authMiddleware, updateRateEntry)

// Postcode-Zone Mappings
router.get('/services/:serviceId/zones', authMiddleware, getServiceZones)
router.put('/zones/:id', authMiddleware, updateZoneEntry)

// ═══════════════════════════════════════════════════════════════════════
// VENDOR RATE SHEETS (Multi-Sheet Tariff & Versioning — Pacific, etc.)
// ═══════════════════════════════════════════════════════════════════════
router.post('/vendors/:vendorCode/upload', authMiddleware, upload.single('file'), uploadVendorRateSheet)
router.get('/vendors/:vendorCode/versions', authMiddleware, getVendorVersions)
router.get('/vendors/:vendorCode/versions/:versionId', authMiddleware, getVendorVersionDetail)
router.put('/vendors/:vendorCode/versions/:versionId/activate', authMiddleware, activateVendorVersion)
router.get('/vendors/:vendorCode/versions/:versionId/diff', authMiddleware, getVendorVersionDiff)
router.delete('/vendors/:vendorCode/versions/:versionId', authMiddleware, deleteVendorVersion)
router.get('/vendors/:vendorCode/destinations', authMiddleware, getVendorDestinations)

// Vendor Rate Calculator
router.post('/calculate', authMiddleware, calculateVendorRate)

export default router

