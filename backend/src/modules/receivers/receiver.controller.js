import { query, execute } from '../../config/db.js'

export const createReceiver =
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
        `INSERT INTO receivers (name, phone, email, address, city, state, pincode)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, phone || '', email || '', address || '', city || '', state || '', pincode || '']
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