import { query } from '../config/db.js'

/**
 * Generate a unique 7-digit random AWB number.
 * Checks uniqueness against the shipments table.
 * This is OUR internal AWB — same for customer and admin bookings.
 */
const generateTracking = async () => {
  let awb
  let exists = true
  while (exists) {
    awb = String(Math.floor(1000000 + Math.random() * 9000000)) // 7 digits
    const rows = await query('SELECT id FROM shipments WHERE tracking_number = ?', [awb])
    exists = rows.length > 0
  }
  return awb
}

export default generateTracking