import { query, execute } from '../../config/db.js'

export const searchReceivers = async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.trim().length < 1) {
      return res.json({ success: true, receivers: [] })
    }
    const search = `%${q.trim()}%`
    // Deduplicated search by latest receiver per name
    const rows = await query(
      `SELECT r.* FROM receivers r
       INNER JOIN (
         SELECT MAX(id) as max_id FROM receivers GROUP BY LOWER(TRIM(name))
       ) latest ON r.id = latest.max_id
       WHERE r.name LIKE ? OR r.company LIKE ? OR r.phone LIKE ?
       ORDER BY r.name ASC LIMIT 10`,
      [search, search, search]
    )
    return res.json({ success: true, receivers: rows })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const createReceiver =
  async (req, res) => {
    try {
      const {
        name,
        company,
        phone,
        email,
        address,
        address_2,
        city,
        state,
        pincode,
        country,
        gstin_type,
        gstin_no
      } = req.body

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Name is required' })
      }

      // Check if a receiver with the same name already exists to prevent duplicate rows
      const existing = await query(
        'SELECT id FROM receivers WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
        [name.trim()]
      )

      if (existing.length > 0) {
        await execute(
          `UPDATE receivers SET company = ?, phone = ?, email = ?, address = ?, address_2 = ?, city = ?, state = ?, pincode = ?, country = ?, gstin_type = ?, gstin_no = ?
           WHERE id = ?`,
          [company || '', phone || '', email || '', address || '', address_2 || '', city || '', state || '', pincode || '', country || '', gstin_type || '', gstin_no || '', existing[0].id]
        )
        const rows = await query('SELECT * FROM receivers WHERE id = ?', [existing[0].id])
        return res.status(200).json({ success: true, receiver: rows[0] })
      }

      const result = await execute(
        `INSERT INTO receivers (name, company, phone, email, address, address_2, city, state, pincode, country, gstin_type, gstin_no)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name.trim(), company || '', phone || '', email || '', address || '', address_2 || '', city || '', state || '', pincode || '', country || '', gstin_type || '', gstin_no || '']
      )

      const rows = await query(
        'SELECT * FROM receivers WHERE id = ?',
        [result.insertId]
      )

      return res.status(201).json({
        success: true,
        receiver: rows[0]
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const getReceivers =
  async (req, res) => {
    try {
      // Deduplicated list grouping by name
      const rows = await query(
        `SELECT r.* FROM receivers r
         INNER JOIN (
           SELECT MAX(id) as max_id FROM receivers GROUP BY LOWER(TRIM(name))
         ) latest ON r.id = latest.max_id
         ORDER BY r.created_at DESC`
      )

      return res.json({
        success: true,
        receivers: rows
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const getReceiverById =
  async (req, res) => {
    try {
      const { id } = req.params

      const rows = await query(
        'SELECT * FROM receivers WHERE id = ?',
        [id]
      )

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Receiver not found'
        })
      }

      return res.json({
        success: true,
        receiver: rows[0]
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const updateReceiver =
  async (req, res) => {
    try {
      const { id } = req.params
      const fields = req.body

      // Build dynamic SET clause
      const keys = Object.keys(fields).filter(k => k !== 'id' && k !== 'created_at')
      if (keys.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' })
      }

      const setClause = keys.map(k => `\`${k}\` = ?`).join(', ')
      const values = keys.map(k => fields[k])

      await execute(
        `UPDATE receivers SET ${setClause} WHERE id = ?`,
        [...values, id]
      )

      const rows = await query(
        'SELECT * FROM receivers WHERE id = ?',
        [id]
      )

      return res.json({
        success: true,
        receiver: rows[0]
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const deleteReceiver =
  async (req, res) => {
    try {
      const { id } = req.params

      // Also remove any other duplicates with same name when deleted
      const receiver = await query('SELECT name FROM receivers WHERE id = ?', [id])
      if (receiver.length > 0) {
        await execute(
          'DELETE FROM receivers WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
          [receiver[0].name]
        )
      } else {
        await execute('DELETE FROM receivers WHERE id = ?', [id])
      }

      return res.json({
        success: true,
        message: 'Receiver deleted successfully'
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const bulkImportReceivers = async (req, res) => {
  try {
    const { receivers: importData } = req.body
    if (!Array.isArray(importData) || importData.length === 0) {
      return res.status(400).json({ success: false, message: 'No data to import' })
    }

    let imported = 0
    for (const r of importData) {
      if (!r.name || !r.name.trim()) continue

      const existing = await query(
        'SELECT id FROM receivers WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
        [r.name.trim()]
      )

      if (existing.length > 0) {
        await execute(
          `UPDATE receivers SET company = ?, phone = ?, email = ?, address = ?, address_2 = ?, city = ?, state = ?, pincode = ?, country = ?, gstin_type = ?, gstin_no = ?
           WHERE id = ?`,
          [r.company || '', r.phone || '', r.email || '', r.address || '', r.address_2 || '', r.city || '', r.state || '', r.pincode || '', r.country || '', r.gstin_type || '', r.gstin_no || '', existing[0].id]
        )
      } else {
        await execute(
          `INSERT INTO receivers (name, company, phone, email, address, address_2, city, state, pincode, country, gstin_type, gstin_no)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.name.trim(), r.company || '', r.phone || '', r.email || '', r.address || '', r.address_2 || '', r.city || '', r.state || '', r.pincode || '', r.country || '', r.gstin_type || '', r.gstin_no || '']
        )
      }
      imported++
    }

    return res.json({ success: true, message: `${imported} receivers processed successfully`, imported })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}