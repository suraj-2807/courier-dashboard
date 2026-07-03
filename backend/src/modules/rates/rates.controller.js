import { query, execute, getConnection } from '../../config/db.js'
import * as XLSX from 'xlsx'

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
