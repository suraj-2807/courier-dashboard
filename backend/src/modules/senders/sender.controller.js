import { query, execute } from '../../config/db.js'

export const createSender =
  async (req, res) => {
    try {
      const {
        name,
        phone,
        email,
        address,
        city,
        state,
        pincode
      } = req.body

      const result = await execute(
        `INSERT INTO senders (name, phone, email, address, city, state, pincode)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, phone || '', email || '', address || '', city || '', state || '', pincode || '']
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
      const rows = await query(
        'SELECT * FROM senders ORDER BY created_at DESC'
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

      await execute(
        'DELETE FROM senders WHERE id = ?',
        [id]
      )

      return res.json({
        success: true,
        message:
          'Sender deleted successfully'
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }