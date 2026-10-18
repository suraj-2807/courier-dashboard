import path from 'path'
import fs from 'fs'
import {
  getVendorsRateSheetStatus,
  saveVendorRateSheet,
  getVendorSheetDetails,
  calculateRateFromExcelSheet,
  getWorkbookPathForVendor
} from '../../services/excelRateSheet.service.js'
import { query } from '../../config/db.js'

/**
 * Get all vendors available on the portal with rate sheet status
 */
export const getVendors = async (req, res) => {
  try {
    let portalVendors = []

    // Try fetching active vendors from DB if available
    try {
      const rows = await query(
        `SELECT id, name, vendor_code, available_services, available_vendor_codes, available_product_codes
         FROM vendor_api_configs
         WHERE is_active = TRUE
         ORDER BY name ASC`
      )
      if (rows && rows.length > 0) {
        portalVendors = rows.map(r => ({
          ...r,
          available_services: typeof r.available_services === 'string' ? JSON.parse(r.available_services || '[]') : (r.available_services || [])
        }))
      }
    } catch (dbErr) {
      // DB offline or not configured — will use file registry
    }

    const vendors = getVendorsRateSheetStatus(portalVendors)
    return res.json({ success: true, vendors })
  } catch (error) {
    console.error('Error fetching vendors with rate sheets:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Import/Upload a new Excel rate sheet for a vendor available on the portal
 */
export const importVendorRateSheet = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No Excel file uploaded' })
    }

    const vendorCode = req.params.vendorCode || req.body.vendor_code || 'pacific'
    const vendorName = req.body.vendor_name || vendorCode.toUpperCase()

    const result = saveVendorRateSheet(
      vendorCode,
      vendorName,
      req.file.buffer,
      req.file.originalname
    )

    return res.json({
      success: true,
      message: `Vendor rate sheet imported successfully for ${vendorName}!`,
      data: result
    })
  } catch (error) {
    console.error('Error importing vendor rate sheet:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Get details, sheet tabs, calculator inputs, and destinations for a vendor's rate sheet
 */
export const getVendorSheetInfo = async (req, res) => {
  try {
    const vendorCode = req.params.vendorCode || 'pacific'
    const details = getVendorSheetDetails(vendorCode)
    return res.json(details)
  } catch (error) {
    console.error('Error getting vendor sheet info:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Download the Excel rate sheet for a vendor
 */
export const downloadVendorSheet = async (req, res) => {
  try {
    const vendorCode = req.params.vendorCode || 'pacific'
    const wbInfo = getWorkbookPathForVendor(vendorCode)

    if (!wbInfo || !fs.existsSync(wbInfo.path)) {
      return res.status(404).json({ success: false, message: 'Rate sheet file not found' })
    }

    const filename = path.basename(wbInfo.path)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    const fileStream = fs.createReadStream(wbInfo.path)
    fileStream.pipe(res)
  } catch (error) {
    console.error('Error downloading vendor sheet:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Calculate rate from Excel rate sheet:
 * Inputs placed into C4 (Country), C5 (Service Code), C6 (Weight), C7 (Postcode)
 * and calculated rate retrieved from C10.
 */
export const calculateVendorRate = async (req, res) => {
  try {
    const params = { ...(req.body || {}), ...(req.query || {}) }
    const { vendor_code, country, service_code, weight, postcode } = params

    if (!country) {
      return res.status(400).json({
        success: false,
        message: 'Destination country is required.'
      })
    }

    if (!weight || parseFloat(weight) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid shipment weight (kg) is required.'
      })
    }

    const result = await calculateRateFromExcelSheet({
      vendor_code: vendor_code || 'pacific',
      country: String(country),
      service_code: service_code ? String(service_code) : '',
      weight: parseFloat(weight),
      postcode: postcode ? String(postcode) : ''
    })

    if (!result.success) {
      return res.status(404).json(result)
    }

    return res.json(result)
  } catch (error) {
    console.error('Rate calculation error:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Get destinations list for autocomplete
 */
export const getDestinations = async (req, res) => {
  try {
    const vendorCode = req.params.vendorCode || 'pacific'
    const details = getVendorSheetDetails(vendorCode)
    return res.json({
      success: true,
      destinations: details.destinations || [],
      services: details.all_services || []
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}
