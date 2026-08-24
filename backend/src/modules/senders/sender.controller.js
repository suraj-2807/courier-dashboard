import { query, execute } from '../../config/db.js'

export const searchSenders = async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.trim().length < 1) {
      return res.json({ success: true, senders: [] })
    }
    const search = `%${q.trim()}%`
    // Deduplicated search by latest sender per name
    const rows = await query(
      `SELECT s.* FROM senders s
       INNER JOIN (
         SELECT MAX(id) as max_id FROM senders GROUP BY LOWER(TRIM(name))
       ) latest ON s.id = latest.max_id
       WHERE s.name LIKE ? OR s.company LIKE ? OR s.phone LIKE ?
       ORDER BY s.name ASC LIMIT 10`,
      [search, search, search]
    )
    return res.json({ success: true, senders: rows })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const createSender =
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

      // Check if a sender with the same name already exists to prevent duplicate rows
      const existing = await query(
        'SELECT id FROM senders WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
        [name.trim()]
      )

      if (existing.length > 0) {
        await execute(
          `UPDATE senders SET company = ?, phone = ?, email = ?, address = ?, address_2 = ?, city = ?, state = ?, pincode = ?, country = ?, gstin_type = ?, gstin_no = ?
           WHERE id = ?`,
          [company || '', phone || '', email || '', address || '', address_2 || '', city || '', state || '', pincode || '', country || 'INDIA', gstin_type || '', gstin_no || '', existing[0].id]
        )
        const rows = await query('SELECT * FROM senders WHERE id = ?', [existing[0].id])
        return res.status(200).json({ success: true, sender: rows[0] })
      }

      const result = await execute(
        `INSERT INTO senders (name, company, phone, email, address, address_2, city, state, pincode, country, gstin_type, gstin_no)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name.trim(), company || '', phone || '', email || '', address || '', address_2 || '', city || '', state || '', pincode || '', country || 'INDIA', gstin_type || '', gstin_no || '']
      )

      const rows = await query(
        'SELECT * FROM senders WHERE id = ?',
        [result.insertId]
      )

      return res.status(201).json({
        success: true,
        sender: rows[0]
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const getSenders =
  async (req, res) => {
    try {
      // Deduplicated list grouping by name
      const rows = await query(
        `SELECT s.* FROM senders s
         INNER JOIN (
           SELECT MAX(id) as max_id FROM senders GROUP BY LOWER(TRIM(name))
         ) latest ON s.id = latest.max_id
         ORDER BY s.created_at DESC`
      )

      return res.json({
        success: true,
        senders: rows
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const getSenderById =
  async (req, res) => {
    try {
      const { id } = req.params

      const rows = await query(
        'SELECT * FROM senders WHERE id = ?',
        [id]
      )

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sender not found'
        })
      }

      return res.json({
        success: true,
        sender: rows[0]
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const updateSender =
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
        `UPDATE senders SET ${setClause} WHERE id = ?`,
        [...values, id]
      )

      const rows = await query(
        'SELECT * FROM senders WHERE id = ?',
        [id]
      )

      return res.json({
        success: true,
        sender: rows[0]
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const deleteSender =
  async (req, res) => {
    try {
      const { id } = req.params

      // 1. Snapshot all shipments referencing this sender before deletion so shipment details never disappear
      const senderRows = await query('SELECT * FROM senders WHERE id = ?', [id])
      if (senderRows.length > 0) {
        const s = senderRows[0]
        try {
          await execute(`
            UPDATE shipments 
            SET sender_name = IF(sender_name = '' OR sender_name IS NULL, ?, sender_name),
                sender_company = IF(sender_company = '' OR sender_company IS NULL, ?, sender_company),
                sender_phone = IF(sender_phone = '' OR sender_phone IS NULL, ?, sender_phone),
                sender_email = IF(sender_email = '' OR sender_email IS NULL, ?, sender_email),
                sender_address = IF(sender_address = '' OR sender_address IS NULL, ?, sender_address),
                sender_address_2 = IF(sender_address_2 = '' OR sender_address_2 IS NULL, ?, sender_address_2),
                sender_city = IF(sender_city = '' OR sender_city IS NULL, ?, sender_city),
                sender_state = IF(sender_state = '' OR sender_state IS NULL, ?, sender_state),
                sender_pincode = IF(sender_pincode = '' OR sender_pincode IS NULL, ?, sender_pincode),
                sender_country = IF(sender_country = '' OR sender_country IS NULL, ?, sender_country),
                sender_gstin_type = IF(sender_gstin_type = '' OR sender_gstin_type IS NULL, ?, sender_gstin_type),
                sender_gstin_no = IF(sender_gstin_no = '' OR sender_gstin_no IS NULL, ?, sender_gstin_no)
            WHERE sender_id = ? OR (sender_name IS NOT NULL AND LOWER(TRIM(sender_name)) = LOWER(TRIM(?)))
          `, [
            s.name || '', s.company || '', s.phone || '', s.email || '',
            s.address || '', s.address_2 || '', s.city || '', s.state || '',
            s.pincode || '', s.country || 'INDIA', s.gstin_type || '', s.gstin_no || '',
            id, s.name
          ])
        } catch (snapErr) {
          console.error('Failed to snapshot sender before deletion:', snapErr.message)
        }

        await execute(
          'DELETE FROM senders WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
          [s.name]
        )
      } else {
        await execute('DELETE FROM senders WHERE id = ?', [id])
      }

      return res.json({
        success: true,
        message: 'Sender deleted successfully'
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const bulkImportSenders = async (req, res) => {
  try {
    const { senders: importData } = req.body
    if (!Array.isArray(importData) || importData.length === 0) {
      return res.status(400).json({ success: false, message: 'No data to import' })
    }

    let imported = 0
    for (const s of importData) {
      if (!s.name || !s.name.trim()) continue

      const existing = await query(
        'SELECT id FROM senders WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
        [s.name.trim()]
      )

      if (existing.length > 0) {
        await execute(
          `UPDATE senders SET company = ?, phone = ?, email = ?, address = ?, address_2 = ?, city = ?, state = ?, pincode = ?, country = ?, gstin_type = ?, gstin_no = ?
           WHERE id = ?`,
          [s.company || '', s.phone || '', s.email || '', s.address || '', s.address_2 || '', s.city || '', s.state || '', s.pincode || '', s.country || 'INDIA', s.gstin_type || '', s.gstin_no || '', existing[0].id]
        )
      } else {
        await execute(
          `INSERT INTO senders (name, company, phone, email, address, address_2, city, state, pincode, country, gstin_type, gstin_no)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.name.trim(), s.company || '', s.phone || '', s.email || '', s.address || '', s.address_2 || '', s.city || '', s.state || '', s.pincode || '', s.country || 'INDIA', s.gstin_type || '', s.gstin_no || '']
        )
      }
      imported++
    }

    return res.json({ success: true, message: `${imported} senders processed successfully`, imported })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}