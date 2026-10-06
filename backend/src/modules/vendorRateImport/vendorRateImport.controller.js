import { query, execute, getConnection } from '../../config/db.js'
import { parseVendorRateWorkbook } from './vendorRateImport.parser.js'

// ═══════════════════════════════════════════════════════════════
// VALIDATE VENDOR RATE WORKBOOK (preview without importing)
// ═══════════════════════════════════════════════════════════════
export const validateVendorWorkbook = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    const vendorName = req.body.vendor_name || ''
    if (!vendorName.trim()) {
      return res.status(400).json({ success: false, message: 'Vendor name is required' })
    }

    const buffer = req.file.buffer
    const parseResult = parseVendorRateWorkbook(buffer)

    return res.json({
      success: true,
      validation: {
        is_valid: parseResult.success,
        vendor_name: vendorName.trim(),
        file_name: req.file.originalname || 'unknown.xlsx',
        file_size: req.file.size || buffer.length,
        summary: parseResult.summary,
        errors: parseResult.errors,
        sheets: parseResult.sheets.map(s => ({
          sheetName: s.sheetName,
          record_count: s.records.length,
          errors: s.errors,
          warnings: s.warnings
        }))
      }
    })
  } catch (error) {
    console.error('Vendor workbook validation error:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// IMPORT VENDOR RATE WORKBOOK (validate + store)
// ═══════════════════════════════════════════════════════════════
export const importVendorWorkbook = async (req, res) => {
  const conn = await getConnection()
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    const vendorName = req.body.vendor_name || ''
    if (!vendorName.trim()) {
      return res.status(400).json({ success: false, message: 'Vendor name is required' })
    }

    const buffer = req.file.buffer
    const originalName = req.file.originalname || 'rate-sheet.xlsx'
    const fileSize = req.file.size || buffer.length
    const userId = req.user?.id || null

    // Parse and validate
    const parseResult = parseVendorRateWorkbook(buffer)

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Workbook validation failed. Fix errors and re-upload.',
        validation: {
          is_valid: false,
          summary: parseResult.summary,
          errors: parseResult.errors,
          sheets: parseResult.sheets.map(s => ({
            sheetName: s.sheetName,
            record_count: s.records.length,
            errors: s.errors,
            warnings: s.warnings
          }))
        }
      })
    }

    await conn.beginTransaction()

    // Create import batch record
    const [batchResult] = await conn.execute(
      `INSERT INTO vendor_rate_import_batches
        (vendor_name, file_name, file_size, status, total_sheets, total_records, total_errors, validation_summary, imported_by)
       VALUES (?, ?, ?, 'imported', ?, ?, ?, ?, ?)`,
      [
        vendorName.trim(),
        originalName,
        fileSize,
        parseResult.summary.total_sheets,
        parseResult.summary.total_records,
        parseResult.summary.total_errors,
        JSON.stringify(parseResult.summary),
        userId
      ]
    )
    const batchId = batchResult.insertId

    // Bulk-insert all records from all sheets
    let totalInserted = 0
    const BATCH_SIZE = 300

    for (const sheet of parseResult.sheets) {
      if (sheet.records.length === 0) continue

      for (let i = 0; i < sheet.records.length; i += BATCH_SIZE) {
        const batch = sheet.records.slice(i, i + BATCH_SIZE)
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
        const values = batch.flatMap(r => [
          batchId,
          vendorName.trim(),
          r.record_type,
          r.service_code,
          r.destination,
          r.zone,
          r.weight_bracket,
          r.rate_inr,
          r.service,
          r.transit_time,
          r.postcode_prefix,
          r.locality,
          r.source_sheet,
          r.source_row,
          r.notes
        ])

        await conn.execute(
          `INSERT INTO vendor_rate_import_records
            (batch_id, vendor_name, record_type, service_code, destination, zone, weight_bracket, rate_inr, service, transit_time, postcode_prefix, locality, source_sheet, source_row, notes)
           VALUES ${placeholders}`,
          values
        )
        totalInserted += batch.length
      }
    }

    await conn.commit()

    return res.json({
      success: true,
      message: `Successfully imported ${totalInserted} records from ${parseResult.summary.total_sheets} sheet(s) for vendor "${vendorName.trim()}"`,
      batch_id: batchId,
      import_summary: {
        vendor_name: vendorName.trim(),
        file_name: originalName,
        total_sheets: parseResult.summary.total_sheets,
        total_records: totalInserted,
        sheets: parseResult.summary.sheets_processed
      }
    })
  } catch (error) {
    await conn.rollback()
    console.error('Vendor rate import error:', error)
    return res.status(500).json({ success: false, message: error.message })
  } finally {
    conn.release()
  }
}

// ═══════════════════════════════════════════════════════════════
// GET ALL IMPORT BATCHES (with optional vendor filter)
// ═══════════════════════════════════════════════════════════════
export const getImportBatches = async (req, res) => {
  try {
    const { vendor_name } = req.query
    let sql = `
      SELECT vrib.*,
        u.name as imported_by_name
      FROM vendor_rate_import_batches vrib
      LEFT JOIN users u ON u.id = vrib.imported_by
    `
    const params = []

    if (vendor_name) {
      sql += ' WHERE vrib.vendor_name = ?'
      params.push(vendor_name)
    }

    sql += ' ORDER BY vrib.id DESC'

    const batches = await query(sql, params)
    return res.json({ success: true, batches })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// GET SINGLE BATCH DETAILS WITH RECORDS
// ═══════════════════════════════════════════════════════════════
export const getBatchDetail = async (req, res) => {
  try {
    const { batchId } = req.params
    const { page = 1, limit = 100, search = '', service_code = '', sheet_name = '' } = req.query
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const offset = (pageNum - 1) * limitNum

    // Get batch info
    const batches = await query(
      `SELECT vrib.*, u.name as imported_by_name
       FROM vendor_rate_import_batches vrib
       LEFT JOIN users u ON u.id = vrib.imported_by
       WHERE vrib.id = ?`,
      [batchId]
    )
    if (batches.length === 0) {
      return res.status(404).json({ success: false, message: 'Import batch not found' })
    }

    // Build filter conditions
    let whereClause = 'WHERE vrir.batch_id = ?'
    const params = [batchId]

    if (search) {
      whereClause += ' AND (vrir.destination LIKE ? OR vrir.service_code LIKE ? OR vrir.locality LIKE ? OR vrir.zone LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }
    if (service_code) {
      whereClause += ' AND vrir.service_code = ?'
      params.push(service_code)
    }
    if (sheet_name) {
      whereClause += ' AND vrir.source_sheet = ?'
      params.push(sheet_name)
    }

    // Count
    const countRows = await query(
      `SELECT COUNT(*) as total FROM vendor_rate_import_records vrir ${whereClause}`,
      params
    )
    const total = countRows[0].total

    // Get records
    const records = await query(
      `SELECT vrir.* FROM vendor_rate_import_records vrir
       ${whereClause}
       ORDER BY vrir.source_sheet ASC, vrir.source_row ASC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    )

    // Get distinct sheets and service codes for filters
    const sheets = await query(
      `SELECT DISTINCT source_sheet FROM vendor_rate_import_records WHERE batch_id = ? ORDER BY source_sheet ASC`,
      [batchId]
    )
    const serviceCodes = await query(
      `SELECT DISTINCT service_code FROM vendor_rate_import_records WHERE batch_id = ? AND service_code != '' ORDER BY service_code ASC`,
      [batchId]
    )

    return res.json({
      success: true,
      batch: batches[0],
      records,
      filters: {
        sheets: sheets.map(s => s.source_sheet),
        service_codes: serviceCodes.map(s => s.service_code)
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE AN IMPORT BATCH (and all its records)
// ═══════════════════════════════════════════════════════════════
export const deleteImportBatch = async (req, res) => {
  try {
    const { batchId } = req.params

    const batches = await query('SELECT id FROM vendor_rate_import_batches WHERE id = ?', [batchId])
    if (batches.length === 0) {
      return res.status(404).json({ success: false, message: 'Import batch not found' })
    }

    // CASCADE delete will remove records too
    await execute('DELETE FROM vendor_rate_import_batches WHERE id = ?', [batchId])

    return res.json({ success: true, message: 'Import batch and all associated records deleted' })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// GET DISTINCT VENDOR NAMES (for dropdown)
// ═══════════════════════════════════════════════════════════════
export const getImportVendors = async (req, res) => {
  try {
    const vendors = await query(
      `SELECT DISTINCT vendor_name, COUNT(*) as batch_count, MAX(created_at) as last_import
       FROM vendor_rate_import_batches
       GROUP BY vendor_name
       ORDER BY vendor_name ASC`
    )
    return res.json({ success: true, vendors })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}
