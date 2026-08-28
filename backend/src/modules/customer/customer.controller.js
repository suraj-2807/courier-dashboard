import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { query, execute } from '../../config/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOCUMENTS_DIR = path.resolve(process.cwd(), 'uploads', 'documents')
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true })
}

// ══════════════════════════════════════════════════════════════════════════════
//  CUSTOMER ADDRESSES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/customer/addresses
 * Query params: customer_id, email, phone, type (sender|receiver|both), q
 */
export const getCustomerAddresses = async (req, res) => {
  try {
    const { customer_id, email, phone, type, q } = req.query

    let sql = `SELECT * FROM customer_addresses WHERE 1=1`
    const params = []

    if (customer_id && parseInt(customer_id) > 0) {
      sql += ` AND (customer_id = ?`
      params.push(parseInt(customer_id))

      if (email && email.trim()) {
        sql += ` OR LOWER(customer_email) = LOWER(?)`
        params.push(email.trim())
      }
      if (phone && phone.trim()) {
        sql += ` OR customer_phone = ?`
        params.push(phone.trim())
      }
      sql += `)`
    } else if (email && email.trim()) {
      sql += ` AND LOWER(customer_email) = LOWER(?)`
      params.push(email.trim())
    } else if (phone && phone.trim()) {
      sql += ` AND customer_phone = ?`
      params.push(phone.trim())
    }

    if (type && type !== 'all') {
      sql += ` AND (address_type = ? OR address_type = 'both')`
      params.push(type)
    }

    if (q && q.trim()) {
      const term = `%${q.trim().toLowerCase()}%`
      sql += ` AND (LOWER(name) LIKE ? OR LOWER(company) LIKE ? OR phone LIKE ? OR LOWER(city) LIKE ? OR pincode LIKE ?)`
      params.push(term, term, term, term, term)
    }

    sql += ` ORDER BY is_default DESC, updated_at DESC LIMIT 100`

    const addresses = await query(sql, params)
    return res.json({ success: true, count: addresses.length, addresses })
  } catch (err) {
    console.error('Error fetching customer addresses:', err)
    return res.status(500).json({ success: false, message: 'Failed to load addresses' })
  }
}

/**
 * POST /api/customer/addresses
 * Create or save address
 */
export const saveCustomerAddress = async (req, res) => {
  try {
    const {
      id,
      customer_id,
      customer_email,
      customer_phone,
      address_type,
      name,
      company,
      phone,
      phone_2,
      email,
      address,
      address_2,
      city,
      state,
      pincode,
      country,
      gstin_type,
      gstin_no,
      is_default
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' })
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone is required' })
    }
    if (!address || !address.trim()) {
      return res.status(400).json({ success: false, message: 'Address Line 1 is required' })
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ success: false, message: 'City is required' })
    }

    const resolvedCustId = customer_id ? parseInt(customer_id) : null
    const defFlag = is_default ? 1 : 0

    // If setting as default, unset other defaults for this customer & type
    if (defFlag && (resolvedCustId || customer_email || customer_phone)) {
      let unsetSql = `UPDATE customer_addresses SET is_default = 0 WHERE 1=1`
      const unsetParams = []
      if (resolvedCustId) {
        unsetSql += ` AND customer_id = ?`
        unsetParams.push(resolvedCustId)
      } else if (customer_email) {
        unsetSql += ` AND LOWER(customer_email) = LOWER(?)`
        unsetParams.push(customer_email.trim())
      }
      await execute(unsetSql, unsetParams)
    }

    if (id && parseInt(id) > 0) {
      // Update existing address
      await execute(
        `UPDATE customer_addresses SET
          customer_id = COALESCE(?, customer_id),
          customer_email = COALESCE(?, customer_email),
          customer_phone = COALESCE(?, customer_phone),
          address_type = ?,
          name = ?, company = ?, phone = ?, phone_2 = ?, email = ?,
          address = ?, address_2 = ?, city = ?, state = ?, pincode = ?, country = ?,
          gstin_type = ?, gstin_no = ?, is_default = ?
        WHERE id = ?`,
        [
          resolvedCustId,
          customer_email || '',
          customer_phone || '',
          address_type || 'both',
          name.trim(),
          (company || '').trim(),
          phone.trim(),
          (phone_2 || '').trim(),
          (email || '').trim(),
          address.trim(),
          (address_2 || '').trim(),
          city.trim(),
          (state || '').trim(),
          (pincode || '').trim(),
          (country || 'INDIA').trim(),
          (gstin_type || '').trim(),
          (gstin_no || '').trim(),
          defFlag,
          parseInt(id)
        ]
      )

      const updated = await query(`SELECT * FROM customer_addresses WHERE id = ?`, [parseInt(id)])
      return res.json({ success: true, message: 'Address updated successfully', address: updated[0] })
    } else {
      // Check if exact duplicate exists for this customer
      const existing = await query(
        `SELECT id FROM customer_addresses 
         WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) 
           AND TRIM(phone) = TRIM(?) 
           AND LOWER(TRIM(address)) = LOWER(TRIM(?))
           AND (customer_id = ? OR LOWER(customer_email) = LOWER(?)) LIMIT 1`,
        [name, phone, address, resolvedCustId || 0, customer_email || '']
      )

      if (existing.length > 0) {
        // Update updated_at
        await execute(
          `UPDATE customer_addresses SET
            company = ?, phone_2 = ?, email = ?, address_2 = ?, city = ?, state = ?, pincode = ?, country = ?, gstin_type = ?, gstin_no = ?
          WHERE id = ?`,
          [
            (company || '').trim(),
            (phone_2 || '').trim(),
            (email || '').trim(),
            (address_2 || '').trim(),
            city.trim(),
            (state || '').trim(),
            (pincode || '').trim(),
            (country || 'INDIA').trim(),
            (gstin_type || '').trim(),
            (gstin_no || '').trim(),
            existing[0].id
          ]
        )
        const row = await query(`SELECT * FROM customer_addresses WHERE id = ?`, [existing[0].id])
        return res.json({ success: true, message: 'Address updated', address: row[0] })
      }

      // Insert new address
      const resHeader = await execute(
        `INSERT INTO customer_addresses (
          customer_id, customer_email, customer_phone, address_type,
          name, company, phone, phone_2, email,
          address, address_2, city, state, pincode, country,
          gstin_type, gstin_no, is_default
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resolvedCustId,
          (customer_email || '').trim(),
          (customer_phone || '').trim(),
          address_type || 'both',
          name.trim(),
          (company || '').trim(),
          phone.trim(),
          (phone_2 || '').trim(),
          (email || '').trim(),
          address.trim(),
          (address_2 || '').trim(),
          city.trim(),
          (state || '').trim(),
          (pincode || '').trim(),
          (country || 'INDIA').trim(),
          (gstin_type || '').trim(),
          (gstin_no || '').trim(),
          defFlag
        ]
      )

      const created = await query(`SELECT * FROM customer_addresses WHERE id = ?`, [resHeader.insertId])
      return res.status(201).json({ success: true, message: 'Address saved to address book', address: created[0] })
    }
  } catch (err) {
    console.error('Error saving customer address:', err)
    return res.status(500).json({ success: false, message: 'Failed to save address' })
  }
}

/**
 * DELETE /api/customer/addresses/:id
 */
export const deleteCustomerAddress = async (req, res) => {
  try {
    const { id } = req.params
    await execute(`DELETE FROM customer_addresses WHERE id = ?`, [parseInt(id)])
    return res.json({ success: true, message: 'Address deleted successfully' })
  } catch (err) {
    console.error('Error deleting address:', err)
    return res.status(500).json({ success: false, message: 'Failed to delete address' })
  }
}


// ══════════════════════════════════════════════════════════════════════════════
//  CUSTOMER DOCUMENTS & KYC
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/customer/documents
 * Query params: customer_id, email, phone, doc_type
 */
export const getCustomerDocuments = async (req, res) => {
  try {
    const { customer_id, email, phone, doc_type } = req.query

    let sql = `SELECT * FROM customer_documents WHERE 1=1`
    const params = []

    if (customer_id && parseInt(customer_id) > 0) {
      sql += ` AND (customer_id = ?`
      params.push(parseInt(customer_id))
      if (email && email.trim()) {
        sql += ` OR LOWER(customer_email) = LOWER(?)`
        params.push(email.trim())
      }
      if (phone && phone.trim()) {
        sql += ` OR customer_phone = ?`
        params.push(phone.trim())
      }
      sql += `)`
    } else if (email && email.trim()) {
      sql += ` AND LOWER(customer_email) = LOWER(?)`
      params.push(email.trim())
    } else if (phone && phone.trim()) {
      sql += ` AND customer_phone = ?`
      params.push(phone.trim())
    }

    if (doc_type && doc_type.trim()) {
      sql += ` AND LOWER(doc_type) = LOWER(?)`
      params.push(doc_type.trim())
    }

    sql += ` ORDER BY created_at DESC LIMIT 100`

    const documents = await query(sql, params)
    return res.json({ success: true, count: documents.length, documents })
  } catch (err) {
    console.error('Error fetching customer documents:', err)
    return res.status(500).json({ success: false, message: 'Failed to load documents' })
  }
}

/**
 * POST /api/customer/upload-document
 * Upload file handler via multer
 */
export const uploadCustomerDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document file uploaded' })
    }

    const file = req.file
    const fileUrl = `/uploads/documents/${file.filename}`
    const { customer_id, customer_email, customer_phone, doc_type, doc_name, doc_number, notes } = req.body

    const resolvedCustId = customer_id ? parseInt(customer_id) : null
    const dType = (doc_type || 'Other').trim()
    const dName = (doc_name || file.originalname || 'Document').trim()
    const dNumber = (doc_number || '').trim()

    // Save record to customer_documents table
    const resHeader = await execute(
      `INSERT INTO customer_documents (
        customer_id, customer_email, customer_phone,
        doc_type, doc_name, doc_number,
        file_url, file_name, file_size, file_type, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resolvedCustId,
        (customer_email || '').trim(),
        (customer_phone || '').trim(),
        dType,
        dName,
        dNumber,
        fileUrl,
        file.originalname,
        file.size,
        file.mimetype,
        (notes || '').trim()
      ]
    )

    const doc = await query(`SELECT * FROM customer_documents WHERE id = ?`, [resHeader.insertId])

    return res.status(201).json({
      success: true,
      message: 'Document uploaded and saved successfully',
      fileUrl,
      document: doc[0]
    })
  } catch (err) {
    console.error('Error uploading document:', err)
    return res.status(500).json({ success: false, message: 'Failed to upload document' })
  }
}

/**
 * POST /api/customer/documents
 * Save or record document metadata
 */
export const saveCustomerDocument = async (req, res) => {
  try {
    const {
      id,
      customer_id,
      customer_email,
      customer_phone,
      doc_type,
      doc_name,
      doc_number,
      file_url,
      file_name,
      file_size,
      file_type,
      notes
    } = req.body

    if (!doc_type || !doc_type.trim()) {
      return res.status(400).json({ success: false, message: 'Document type is required' })
    }
    if (!file_url || !file_url.trim()) {
      return res.status(400).json({ success: false, message: 'Document file URL is required' })
    }

    const resolvedCustId = customer_id ? parseInt(customer_id) : null

    if (id && parseInt(id) > 0) {
      await execute(
        `UPDATE customer_documents SET
          customer_id = COALESCE(?, customer_id),
          customer_email = COALESCE(?, customer_email),
          customer_phone = COALESCE(?, customer_phone),
          doc_type = ?, doc_name = ?, doc_number = ?,
          file_url = ?, file_name = ?, notes = ?
        WHERE id = ?`,
        [
          resolvedCustId,
          customer_email || '',
          customer_phone || '',
          doc_type.trim(),
          (doc_name || '').trim(),
          (doc_number || '').trim(),
          file_url.trim(),
          (file_name || '').trim(),
          (notes || '').trim(),
          parseInt(id)
        ]
      )
      const updated = await query(`SELECT * FROM customer_documents WHERE id = ?`, [parseInt(id)])
      return res.json({ success: true, message: 'Document updated successfully', document: updated[0] })
    } else {
      const resHeader = await execute(
        `INSERT INTO customer_documents (
          customer_id, customer_email, customer_phone,
          doc_type, doc_name, doc_number,
          file_url, file_name, file_size, file_type, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resolvedCustId,
          (customer_email || '').trim(),
          (customer_phone || '').trim(),
          doc_type.trim(),
          (doc_name || '').trim(),
          (doc_number || '').trim(),
          file_url.trim(),
          (file_name || '').trim(),
          file_size || 0,
          file_type || '',
          (notes || '').trim()
        ]
      )
      const created = await query(`SELECT * FROM customer_documents WHERE id = ?`, [resHeader.insertId])
      return res.status(201).json({ success: true, message: 'Document saved successfully', document: created[0] })
    }
  } catch (err) {
    console.error('Error saving document:', err)
    return res.status(500).json({ success: false, message: 'Failed to save document' })
  }
}

/**
 * DELETE /api/customer/documents/:id
 */
export const deleteCustomerDocument = async (req, res) => {
  try {
    const { id } = req.params
    const rows = await query(`SELECT * FROM customer_documents WHERE id = ?`, [parseInt(id)])
    if (rows.length > 0) {
      const doc = rows[0]
      if (doc.file_url && doc.file_url.startsWith('/uploads/documents/')) {
        const filePath = path.resolve(process.cwd(), doc.file_url.replace(/^\//, ''))
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath) } catch {}
        }
      }
      await execute(`DELETE FROM customer_documents WHERE id = ?`, [parseInt(id)])
    }
    return res.json({ success: true, message: 'Document deleted successfully' })
  } catch (err) {
    console.error('Error deleting document:', err)
    return res.status(500).json({ success: false, message: 'Failed to delete document' })
  }
}
