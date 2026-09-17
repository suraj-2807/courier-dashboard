import { query, execute, getConnection } from '../../config/db.js'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { parsePacificWorkbook } from './parsers/pacificParser.js'
import { calculateRate, getActiveVersion } from './services/rateCalculation.service.js'
import { compareVersions } from './services/rateDiff.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads/rate-sheets')

// ═══════════════════════════════════════════════════════════════
// UPLOAD EXCEL — Parse filename for company+service, bulk-insert
// File format: "<ServiceName> <CompanyName>.xlsx"
// Sheet 1 "rates": Weight | ZONE 1 | ZONE 2 | ... | ZONE 10
// Sheet 2 "zones": PostCode | City | Zones
// ═══════════════════════════════════════════════════════════════
export const uploadExcel = async (req, res) => {
  const conn = await getConnection()
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    // ── Parse company + service from filename ──
    const originalName = req.file.originalname || ''
    const baseName = originalName.replace(/\.(xlsx|xls|csv)$/i, '').trim()
    const parts = baseName.split(/\s+/)

    if (parts.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Filename must be in format "CompanyName ServiceName" (e.g. "Flyshift AUS.xlsx" — first word = company, rest = service)'
      })
    }

    // Last word = company name, everything before = service name
    const companyName = parts[parts.length - 1].trim()
    const serviceName = parts.slice(0, -1).join(' ').trim()

    if (!companyName || !serviceName) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract company and service name from filename'
      })
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheetNames = workbook.SheetNames

    await conn.beginTransaction()

    // ── Find or create company ──
    const [existingCompany] = await conn.execute(
      'SELECT id FROM rate_companies WHERE name = ?', [companyName]
    )
    let companyId
    if (existingCompany.length === 0) {
      const [companyResult] = await conn.execute(
        'INSERT INTO rate_companies (name) VALUES (?)', [companyName]
      )
      companyId = companyResult.insertId
    } else {
      companyId = existingCompany[0].id
    }

    // ── Find or create service ──
    const [existingService] = await conn.execute(
      'SELECT id FROM rate_services WHERE company_id = ? AND name = ?', [companyId, serviceName]
    )
    let serviceId
    if (existingService.length === 0) {
      const [serviceResult] = await conn.execute(
        'INSERT INTO rate_services (company_id, name) VALUES (?, ?)', [companyId, serviceName]
      )
      serviceId = serviceResult.insertId
    } else {
      serviceId = existingService[0].id
      // Clear existing data for re-upload
      await conn.execute('DELETE FROM rate_entries WHERE service_id = ?', [serviceId])
      await conn.execute('DELETE FROM postcode_zones WHERE service_id = ?', [serviceId])
    }

    let ratesInserted = 0
    let zonesInserted = 0

    // ── Parse "rates" sheet ──
    const ratesSheetName = sheetNames.find(
      (n) => n.toLowerCase() === 'rates' || n.toLowerCase().includes('rate')
    )
    if (ratesSheetName) {
      const ratesSheet = workbook.Sheets[ratesSheetName]
      const ratesData = XLSX.utils.sheet_to_json(ratesSheet, { defval: '' })

      for (const row of ratesData) {
        // Find weight column (could be "Weight", "weight", "WEIGHT")
        const weight = String(
          row['Weight'] || row['weight'] || row['WEIGHT'] || ''
        ).trim()

        if (!weight) continue

        // Extract zone values (ZONE 1 through ZONE 10)
        const zoneValues = []
        for (let i = 1; i <= 10; i++) {
          const val = parseFloat(
            row[`ZONE ${i}`] || row[`Zone ${i}`] || row[`zone ${i}`] ||
            row[`ZONE${i}`] || row[`Zone${i}`] || row[`zone${i}`] || 0
          )
          zoneValues.push(isNaN(val) ? 0 : val)
        }

        await conn.execute(
          `INSERT INTO rate_entries (service_id, weight, zone_1, zone_2, zone_3, zone_4, zone_5, zone_6, zone_7, zone_8, zone_9, zone_10)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [serviceId, weight, ...zoneValues]
        )
        ratesInserted++
      }
    }

    // ── Parse "zones" sheet ──
    const zonesSheetName = sheetNames.find(
      (n) => n.toLowerCase() === 'zones' || n.toLowerCase().includes('zone')
    )
    if (zonesSheetName) {
      const zonesSheet = workbook.Sheets[zonesSheetName]
      const zonesData = XLSX.utils.sheet_to_json(zonesSheet, { defval: '' })

      for (const row of zonesData) {
        const postcode = String(
          row['PostCode'] || row['Postcode'] || row['postcode'] || row['POSTCODE'] ||
          row['Pincode'] || row['pincode'] || row['PINCODE'] || ''
        ).trim()

        const city = String(
          row['City'] || row['city'] || row['CITY'] || ''
        ).trim()

        const zone = String(
          row['Zones'] || row['zones'] || row['ZONES'] || row['Zone'] || row['zone'] || row['ZONE'] || ''
        ).trim()

        if (!postcode || !zone) continue

        // Use INSERT ... ON DUPLICATE KEY UPDATE for upsert
        await conn.execute(
          `INSERT INTO postcode_zones (service_id, postcode, city, zone)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE city = VALUES(city), zone = VALUES(zone)`,
          [serviceId, postcode, city, zone]
        )
        zonesInserted++
      }
    }

    await conn.commit()

    return res.json({
      success: true,
      message: 'Excel imported successfully',
      data: {
        company: companyName,
        company_id: companyId,
        service: serviceName,
        service_id: serviceId,
        rates_inserted: ratesInserted,
        zones_inserted: zonesInserted,
        sheets_found: sheetNames
      }
    })
  } catch (error) {
    await conn.rollback()
    return res.status(500).json({ success: false, message: error.message })
  } finally {
    conn.release()
  }
}

// ═══════════════════════════════════════════════════════════════
// GET ALL COMPANIES
// ═══════════════════════════════════════════════════════════════
export const getCompanies = async (req, res) => {
  try {
    const companies = await query(
      `SELECT rc.*,
        (SELECT COUNT(*) FROM rate_services rs WHERE rs.company_id = rc.id) as service_count
       FROM rate_companies rc
       ORDER BY rc.name ASC`
    )
    return res.json({ success: true, companies })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// GET SERVICES FOR A COMPANY
// ═══════════════════════════════════════════════════════════════
export const getCompanyServices = async (req, res) => {
  try {
    const { companyId } = req.params
    const services = await query(
      `SELECT rs.*,
        (SELECT COUNT(*) FROM rate_entries re WHERE re.service_id = rs.id) as rate_count,
        (SELECT COUNT(*) FROM postcode_zones pz WHERE pz.service_id = rs.id) as zone_count
       FROM rate_services rs
       WHERE rs.company_id = ?
       ORDER BY rs.name ASC`,
      [companyId]
    )
    return res.json({ success: true, services })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// GET RATE ENTRIES FOR A SERVICE
// ═══════════════════════════════════════════════════════════════
export const getServiceRates = async (req, res) => {
  try {
    const { serviceId } = req.params
    const rates = await query(
      `SELECT * FROM rate_entries WHERE service_id = ? ORDER BY CAST(weight AS DECIMAL(10,2)) ASC`,
      [serviceId]
    )
    return res.json({ success: true, rates })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// GET POSTCODE-ZONE MAPPINGS FOR A SERVICE (paginated + search)
// ═══════════════════════════════════════════════════════════════
export const getServiceZones = async (req, res) => {
  try {
    const { serviceId } = req.params
    const { page = 1, limit = 100, search = '' } = req.query
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const offset = (pageNum - 1) * limitNum

    let whereClause = 'WHERE pz.service_id = ?'
    const params = [serviceId]

    if (search) {
      whereClause += ' AND (pz.postcode LIKE ? OR pz.city LIKE ? OR pz.zone LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const countRows = await query(
      `SELECT COUNT(*) as total FROM postcode_zones pz ${whereClause}`,
      params
    )
    const total = countRows[0].total

    const zones = await query(
      `SELECT pz.* FROM postcode_zones pz
       ${whereClause}
       ORDER BY pz.postcode ASC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    )

    return res.json({
      success: true,
      zones,
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
// UPDATE A RATE ENTRY (inline edit)
// ═══════════════════════════════════════════════════════════════
export const updateRateEntry = async (req, res) => {
  try {
    const { id } = req.params
    const { weight, zone_1, zone_2, zone_3, zone_4, zone_5, zone_6, zone_7, zone_8, zone_9, zone_10 } = req.body

    await execute(
      `UPDATE rate_entries SET
        weight = COALESCE(?, weight),
        zone_1 = COALESCE(?, zone_1),
        zone_2 = COALESCE(?, zone_2),
        zone_3 = COALESCE(?, zone_3),
        zone_4 = COALESCE(?, zone_4),
        zone_5 = COALESCE(?, zone_5),
        zone_6 = COALESCE(?, zone_6),
        zone_7 = COALESCE(?, zone_7),
        zone_8 = COALESCE(?, zone_8),
        zone_9 = COALESCE(?, zone_9),
        zone_10 = COALESCE(?, zone_10)
       WHERE id = ?`,
      [weight, zone_1, zone_2, zone_3, zone_4, zone_5, zone_6, zone_7, zone_8, zone_9, zone_10, id]
    )

    const updated = await query('SELECT * FROM rate_entries WHERE id = ?', [id])
    return res.json({ success: true, rate: updated[0] })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// UPDATE A POSTCODE-ZONE ENTRY (inline edit)
// ═══════════════════════════════════════════════════════════════
export const updateZoneEntry = async (req, res) => {
  try {
    const { id } = req.params
    const { postcode, city, zone } = req.body

    await execute(
      `UPDATE postcode_zones SET
        postcode = COALESCE(?, postcode),
        city = COALESCE(?, city),
        zone = COALESCE(?, zone)
       WHERE id = ?`,
      [postcode, city, zone, id]
    )

    const updated = await query('SELECT * FROM postcode_zones WHERE id = ?', [id])
    return res.json({ success: true, zone: updated[0] })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE A SERVICE (and all its rates + zones)
// ═══════════════════════════════════════════════════════════════
export const deleteService = async (req, res) => {
  try {
    const { serviceId } = req.params

    // Check if company will be empty after this
    const service = await query('SELECT company_id FROM rate_services WHERE id = ?', [serviceId])

    await execute('DELETE FROM rate_services WHERE id = ?', [serviceId])

    // If company has no more services, delete company too
    if (service.length > 0) {
      const remaining = await query(
        'SELECT COUNT(*) as cnt FROM rate_services WHERE company_id = ?',
        [service[0].company_id]
      )
      if (remaining[0].cnt === 0) {
        await execute('DELETE FROM rate_companies WHERE id = ?', [service[0].company_id])
      }
    }

    return res.json({ success: true, message: 'Service and all associated data deleted' })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE A COMPANY (and all its services)
// ═══════════════════════════════════════════════════════════════
export const deleteCompany = async (req, res) => {
  try {
    const { companyId } = req.params
    await execute('DELETE FROM rate_companies WHERE id = ?', [companyId])
    return res.json({ success: true, message: 'Company and all associated data deleted' })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════════════
// VENDOR RATE SHEET MANAGEMENT — Upload, Versions, Activate, Diff, Calc
// ═══════════════════════════════════════════════════════════════════════

// ── Ensure uploads directory exists ──
function ensureUploadDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
}

// ═══════════════════════════════════════════════════════════════
// UPLOAD VENDOR RATE SHEET (Pacific)
// ═══════════════════════════════════════════════════════════════
export const uploadVendorRateSheet = async (req, res) => {
  const conn = await getConnection()
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    const vendorCode = req.params.vendorCode || 'pacific'
    const buffer = req.file.buffer
    const originalName = req.file.originalname || 'rate-sheet.xlsx'
    const fileSize = req.file.size || buffer.length
    const userId = req.user?.id || null

    // Parse and validate the workbook
    let parseResult
    if (vendorCode === 'pacific') {
      parseResult = parsePacificWorkbook(buffer)
    } else {
      return res.status(400).json({ success: false, message: `Unsupported vendor: ${vendorCode}` })
    }

    // Build validation summary
    const validationSummary = {
      sheets_found: parseResult.sheets_found,
      sheets_matched: parseResult.sheets_matched,
      self_network: { count: parseResult.selfNetwork.records.length, errors: parseResult.selfNetwork.errors, warnings: parseResult.selfNetwork.warnings },
      canada_zone: { count: parseResult.canadaZone.records.length, errors: parseResult.canadaZone.errors, warnings: parseResult.canadaZone.warnings },
      aus_zone: { count: parseResult.ausZone.records.length, errors: parseResult.ausZone.errors, warnings: parseResult.ausZone.warnings },
      nz_zone: { count: parseResult.nzZone.records.length, errors: parseResult.nzZone.errors, warnings: parseResult.nzZone.warnings },
      scotland_zip: { count: parseResult.scotlandZip.records.length, errors: parseResult.scotlandZip.errors, warnings: parseResult.scotlandZip.warnings },
      dpd_remote: { count: parseResult.dpdRemote.records.length, errors: parseResult.dpdRemote.errors, warnings: parseResult.dpdRemote.warnings },
      total_errors: parseResult.summary.total_errors,
      total_warnings: parseResult.summary.total_warnings,
      total_records: parseResult.summary.total_records,
      global_errors: parseResult.errors
    }

    const status = parseResult.success ? 'validated' : 'failed'
    const versionName = `${originalName.replace(/\.[^.]+$/, '')} - ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`

    await conn.beginTransaction()

    // Create version record
    const [versionResult] = await conn.execute(
      `INSERT INTO vendor_rate_versions (vendor_code, version_name, file_name, file_size, status, validation_summary, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vendorCode, versionName, originalName, fileSize, status, JSON.stringify(validationSummary), userId]
    )
    const versionId = versionResult.insertId

    // Save uploaded file to disk
    if (status !== 'failed') {
      ensureUploadDir()
      const savedPath = path.join(UPLOADS_DIR, `${vendorCode}_v${versionId}_${Date.now()}_${originalName}`)
      fs.writeFileSync(savedPath, buffer)
      await conn.execute('UPDATE vendor_rate_versions SET file_path = ? WHERE id = ?', [savedPath, versionId])
    }

    // If validation passed, bulk-insert the parsed data
    if (parseResult.success) {
      // Insert Self Network rates + slabs
      await insertSelfNetworkRates(conn, versionId, vendorCode, parseResult.selfNetwork.records)

      // Insert zone data for each country
      await insertPostcodeZones(conn, versionId, parseResult.canadaZone.records)
      await insertPostcodeZones(conn, versionId, parseResult.ausZone.records)
      await insertPostcodeZones(conn, versionId, parseResult.nzZone.records)
      await insertPostcodeZones(conn, versionId, parseResult.scotlandZip.records)

      // Insert DPD remote areas
      await insertRemoteAreas(conn, versionId, parseResult.dpdRemote.records)
    }

    await conn.commit()

    // Compute diff against active version (if any)
    let diff = null
    if (parseResult.success) {
      const activeVersion = await getActiveVersion(vendorCode)
      if (activeVersion) {
        diff = await compareVersions(vendorCode, versionId, activeVersion.id)
      }
    }

    return res.json({
      success: true,
      message: parseResult.success ? 'Rate sheet validated and imported successfully' : 'Rate sheet validation failed',
      version_id: versionId,
      status,
      validation: validationSummary,
      diff
    })
  } catch (error) {
    await conn.rollback()
    console.error('Vendor rate upload error:', error)
    return res.status(500).json({ success: false, message: error.message })
  } finally {
    conn.release()
  }
}

// ═══════════════════════════════════════════════════════════════
// BULK INSERT HELPERS
// ═══════════════════════════════════════════════════════════════
async function insertSelfNetworkRates(conn, versionId, vendorCode, records) {
  const BATCH_SIZE = 200
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    
    for (const rec of batch) {
      const [rateResult] = await conn.execute(
        `INSERT INTO vendor_rates (version_id, vendor_code, service_code, service_name, destination_country, transit_time, base_500g, addl_500g)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [versionId, vendorCode, rec.service_code, rec.service_name, rec.destination_country, rec.transit_time, rec.base_500g, rec.addl_500g]
      )
      const rateId = rateResult.insertId

      // Insert slabs for this rate
      if (rec.slabs && rec.slabs.length > 0) {
        const slabValues = rec.slabs.map(s => [rateId, s.min_weight, s.max_weight, s.rate_per_kg, s.rate_type])
        for (const sv of slabValues) {
          await conn.execute(
            `INSERT INTO vendor_rate_slabs (rate_id, min_weight, max_weight, rate_per_kg, rate_type) VALUES (?, ?, ?, ?, ?)`,
            sv
          )
        }
      }
    }
  }
}

async function insertPostcodeZones(conn, versionId, records) {
  if (records.length === 0) return
  const BATCH_SIZE = 500
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
    const values = batch.flatMap(r => [
      versionId, r.country_code, r.postcode, r.postcode_prefix, r.city, r.state_province, r.zone, r.is_remote ? 1 : 0, r.remote_remarks
    ])
    await conn.execute(
      `INSERT INTO vendor_postcode_zones (version_id, country_code, postcode, postcode_prefix, city, state_province, zone, is_remote, remote_remarks) VALUES ${placeholders}`,
      values
    )
  }
}

async function insertRemoteAreas(conn, versionId, records) {
  if (records.length === 0) return
  const BATCH_SIZE = 500
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
    const values = batch.flatMap(r => [
      versionId, r.country_name, r.country_code, r.postcode_from, r.postcode_to, r.postcode_exact, r.city, r.carrier_network
    ])
    await conn.execute(
      `INSERT INTO vendor_remote_areas (version_id, country_name, country_code, postcode_from, postcode_to, postcode_exact, city, carrier_network) VALUES ${placeholders}`,
      values
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// GET VENDOR RATE VERSIONS
// ═══════════════════════════════════════════════════════════════
export const getVendorVersions = async (req, res) => {
  try {
    const vendorCode = req.params.vendorCode || 'pacific'
    const versions = await query(
      `SELECT vrv.*,
        u.name as uploaded_by_name,
        (SELECT COUNT(*) FROM vendor_rates vr WHERE vr.version_id = vrv.id) as rate_count,
        (SELECT COUNT(*) FROM vendor_postcode_zones vpz WHERE vpz.version_id = vrv.id) as zone_count,
        (SELECT COUNT(*) FROM vendor_remote_areas vra WHERE vra.version_id = vrv.id) as remote_count
       FROM vendor_rate_versions vrv
       LEFT JOIN users u ON u.id = vrv.uploaded_by
       WHERE vrv.vendor_code = ?
       ORDER BY vrv.id DESC`,
      [vendorCode]
    )
    return res.json({ success: true, versions })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// GET SINGLE VERSION DETAILS
// ═══════════════════════════════════════════════════════════════
export const getVendorVersionDetail = async (req, res) => {
  try {
    const { vendorCode, versionId } = req.params
    const versions = await query(
      `SELECT vrv.*,
        u.name as uploaded_by_name
       FROM vendor_rate_versions vrv
       LEFT JOIN users u ON u.id = vrv.uploaded_by
       WHERE vrv.id = ? AND vrv.vendor_code = ?`,
      [versionId, vendorCode]
    )
    if (versions.length === 0) {
      return res.status(404).json({ success: false, message: 'Version not found' })
    }

    // Get sample rates
    const rates = await query(
      `SELECT vr.*, GROUP_CONCAT(
         CONCAT(vrs.min_weight, 'kg-', COALESCE(vrs.max_weight, '∞'), 'kg: ₹', vrs.rate_per_kg, '/kg')
         ORDER BY vrs.min_weight ASC SEPARATOR ', '
       ) as slabs_display
       FROM vendor_rates vr
       LEFT JOIN vendor_rate_slabs vrs ON vrs.rate_id = vr.id
       WHERE vr.version_id = ?
       GROUP BY vr.id
       ORDER BY vr.destination_country ASC`,
      [versionId]
    )

    return res.json({ success: true, version: versions[0], rates })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// ACTIVATE A VERSION
// ═══════════════════════════════════════════════════════════════
export const activateVendorVersion = async (req, res) => {
  const conn = await getConnection()
  try {
    const { vendorCode, versionId } = req.params
    const userId = req.user?.id || null

    // Verify the version exists and is validated
    const [version] = await conn.execute(
      'SELECT * FROM vendor_rate_versions WHERE id = ? AND vendor_code = ?',
      [versionId, vendorCode]
    )
    if (version.length === 0) {
      return res.status(404).json({ success: false, message: 'Version not found' })
    }
    if (version[0].status !== 'validated') {
      return res.status(400).json({
        success: false,
        message: `Cannot activate version with status "${version[0].status}". Only validated versions can be activated.`
      })
    }

    await conn.beginTransaction()

    // Archive current active version
    await conn.execute(
      `UPDATE vendor_rate_versions SET status = 'archived', effective_to = CURDATE()
       WHERE vendor_code = ? AND status = 'active'`,
      [vendorCode]
    )

    // Activate the new version
    await conn.execute(
      `UPDATE vendor_rate_versions SET status = 'active', activated_at = NOW(), activated_by = ?, effective_from = CURDATE()
       WHERE id = ?`,
      [userId, versionId]
    )

    await conn.commit()

    return res.json({
      success: true,
      message: `Version v${versionId} is now active. Previous active version has been archived.`
    })
  } catch (error) {
    await conn.rollback()
    console.error('Version activation error:', error)
    return res.status(500).json({ success: false, message: error.message })
  } finally {
    conn.release()
  }
}

// ═══════════════════════════════════════════════════════════════
// GET VERSION DIFF
// ═══════════════════════════════════════════════════════════════
export const getVendorVersionDiff = async (req, res) => {
  try {
    const { vendorCode, versionId } = req.params

    // Get active version
    const activeVersion = await getActiveVersion(vendorCode)
    const activeVersionId = activeVersion?.id || null

    const diff = await compareVersions(vendorCode, parseInt(versionId), activeVersionId)
    return res.json({ success: true, diff })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE A DRAFT/FAILED VERSION
// ═══════════════════════════════════════════════════════════════
export const deleteVendorVersion = async (req, res) => {
  try {
    const { vendorCode, versionId } = req.params

    const versions = await query(
      'SELECT * FROM vendor_rate_versions WHERE id = ? AND vendor_code = ?',
      [versionId, vendorCode]
    )
    if (versions.length === 0) {
      return res.status(404).json({ success: false, message: 'Version not found' })
    }
    if (versions[0].status === 'active') {
      return res.status(400).json({ success: false, message: 'Cannot delete the active version' })
    }

    // Delete file from disk if exists
    if (versions[0].file_path && fs.existsSync(versions[0].file_path)) {
      fs.unlinkSync(versions[0].file_path)
    }

    await execute('DELETE FROM vendor_rate_versions WHERE id = ?', [versionId])
    return res.json({ success: true, message: 'Version deleted' })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// CALCULATE VENDOR RATE
// ═══════════════════════════════════════════════════════════════
export const calculateVendorRate = async (req, res) => {
  try {
    const { vendor_code, country, postcode, weight, service_code } = req.body || req.query || {}
    if (!vendor_code || !country || !weight) {
      return res.status(400).json({
        success: false,
        message: 'Required: vendor_code, country, weight. Optional: postcode, service_code'
      })
    }

    const result = await calculateRate({
      vendor_code,
      country,
      postcode: postcode || '',
      weight: parseFloat(weight),
      service_code: service_code || ''
    })

    return res.json(result)
  } catch (error) {
    console.error('Rate calculation error:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// GET VENDOR RATE DESTINATIONS (for autocomplete/lookup)
// ═══════════════════════════════════════════════════════════════
export const getVendorDestinations = async (req, res) => {
  try {
    const vendorCode = req.params.vendorCode || 'pacific'
    const activeVersion = await getActiveVersion(vendorCode)
    if (!activeVersion) {
      return res.json({ success: true, destinations: [] })
    }

    const destinations = await query(
      `SELECT DISTINCT destination_country, service_code, service_name, transit_time
       FROM vendor_rates
       WHERE version_id = ?
       ORDER BY destination_country ASC`,
      [activeVersion.id]
    )
    return res.json({ success: true, destinations })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}
