import { query, execute } from '../../config/db.js'

/**
 * Get all system settings as a key-value object.
 */
export async function getSystemSettings(req, res) {
  try {
    const rows = await query('SELECT setting_key, setting_value, description FROM system_settings')
    const settings = {}
    for (const r of rows) {
      // Parse booleans and numbers if applicable
      let val = r.setting_value
      if (val === 'true') val = true
      else if (val === 'false') val = false
      settings[r.setting_key] = val
    }
    return res.json({
      success: true,
      settings,
      raw: rows
    })
  } catch (err) {
    console.error('Error fetching system settings:', err)
    return res.status(500).json({ success: false, message: 'Failed to fetch settings' })
  }
}

/**
 * Update system settings (single or batch).
 */
export async function updateSystemSettings(req, res) {
  try {
    const body = req.body || {}

    // Support both `{ key: 'allow_post_push_billing_edit', value: true }`
    // and batch `{ settings: { allow_post_push_billing_edit: true, ... } }`
    // and flat `{ allow_post_push_billing_edit: true }`
    const entriesToUpdate = []

    if (body.key && body.value !== undefined) {
      entriesToUpdate.push({
        key: body.key,
        value: String(body.value),
        desc: body.description || ''
      })
    } else {
      const source = body.settings || body
      for (const [k, v] of Object.entries(source)) {
        if (k !== 'key' && k !== 'value' && k !== 'description') {
          entriesToUpdate.push({
            key: k,
            value: String(v),
            desc: ''
          })
        }
      }
    }

    for (const item of entriesToUpdate) {
      await execute(
        `INSERT INTO system_settings (setting_key, setting_value, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), description = IF(VALUES(description) != '', VALUES(description), description)`,
        [item.key, item.value, item.desc]
      )
    }

    // Refetch updated settings
    const rows = await query('SELECT setting_key, setting_value, description FROM system_settings')
    const settings = {}
    for (const r of rows) {
      let val = r.setting_value
      if (val === 'true') val = true
      else if (val === 'false') val = false
      settings[r.setting_key] = val
    }

    return res.json({
      success: true,
      message: 'Settings updated successfully',
      settings
    })
  } catch (err) {
    console.error('Error updating system settings:', err)
    return res.status(500).json({ success: false, message: 'Failed to update settings' })
  }
}

/**
 * Helper to check a system setting boolean value.
 */
export async function isSettingEnabled(key, defaultValue = false) {
  try {
    const rows = await query('SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1', [key])
    if (rows.length === 0) return defaultValue
    const val = String(rows[0].setting_value).toLowerCase().trim()
    return val === 'true' || val === '1' || val === 'yes'
  } catch (err) {
    console.error(`Error checking setting ${key}:`, err.message)
    return defaultValue
  }
}
