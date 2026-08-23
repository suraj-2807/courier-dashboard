import { query, execute } from '../../config/db.js'

export const searchReceivers = async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.trim().length < 1) {
      return res.json({ success: true, receivers: [] })
    }
    const search = `%${q.trim()}%`
    const rows = await query(
      `SELECT * FROM receivers
       WHERE name LIKE ? OR company LIKE ? OR phone LIKE ?
       ORDER BY name ASC LIMIT 10`,
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

      const result = await execute(
        `INSERT INTO receivers (name, company, phone, email, address, address_2, city, state, pincode, country, gstin_type, gstin_no)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, company || '', phone || '', email || '', address || '', address_2 || '', city || '', state || '', pincode || '', country || '', gstin_type || '', gstin_no || '']
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
      const rows = await query(
        'SELECT * FROM receivers ORDER BY created_at DESC'
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

      await execute(
        'DELETE FROM receivers WHERE id = ?',
        [id]
      )

      return res.json({
        success: true,
        message:
          'Receiver deleted successfully'
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
      if (!r.name) continue
      await execute(
        `INSERT INTO receivers (name, company, phone, email, address, address_2, city, state, pincode, country, gstin_type, gstin_no)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.name || '', r.company || '', r.phone || '', r.email || '', r.address || '', r.address_2 || '', r.city || '', r.state || '', r.pincode || '', r.country || '', r.gstin_type || '', r.gstin_no || '']
      )
      imported++
    }

    return res.json({ success: true, message: `${imported} receivers imported successfully`, imported })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}