/**
 * WP Sync Utility
 * ───────────────
 * Syncs booking requests and status updates from the Node.js backend
 * to the WordPress database via WP REST API endpoints.
 *
 * This is fire-and-forget — sync failures are logged but never block
 * the main API response to the client.
 */

import dotenv from 'dotenv'
dotenv.config()

const WP_SYNC_URL = process.env.WP_SYNC_URL || ''
const WP_SYNC_KEY = process.env.WP_SYNC_KEY || ''

/**
 * Sync a newly created booking request to the WP database.
 * Called after a booking request is successfully inserted in the Node.js DB.
 *
 * @param {Object} bookingData - Full booking request fields
 */
export async function syncBookingToWP(bookingData) {
  if (!WP_SYNC_URL || !WP_SYNC_KEY) {
    console.log('[WP Sync] Skipped — WP_SYNC_URL or WP_SYNC_KEY not configured')
    return
  }

  try {
    const url = `${WP_SYNC_URL}/wp-json/pe-cp/v1/sync-booking`
    console.log(`[WP Sync] Syncing booking ${bookingData.request_awb} to WP...`)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Key': WP_SYNC_KEY
      },
      body: JSON.stringify(bookingData)
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('[WP Sync] Booking sync failed:', res.status, data)
    } else {
      console.log(`[WP Sync] Booking ${bookingData.request_awb} synced successfully`)
    }
  } catch (err) {
    console.error('[WP Sync] Booking sync error:', err.message)
  }
}

/**
 * Sync a status update (and optional timeline entries) to the WP database.
 * Called after an admin updates a booking request's status in the Node.js DB.
 *
 * @param {Object} statusData - { request_awb, status, admin_notes, shipment_id, tracking_number, updates[] }
 */
export async function syncStatusToWP(statusData) {
  if (!WP_SYNC_URL || !WP_SYNC_KEY) {
    console.log('[WP Sync] Skipped — WP_SYNC_URL or WP_SYNC_KEY not configured')
    return
  }

  try {
    const url = `${WP_SYNC_URL}/wp-json/pe-cp/v1/sync-status`
    console.log(`[WP Sync] Syncing status for ${statusData.request_awb} to WP...`)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Key': WP_SYNC_KEY
      },
      body: JSON.stringify(statusData)
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('[WP Sync] Status sync failed:', res.status, data)
    } else {
      console.log(`[WP Sync] Status for ${statusData.request_awb} synced successfully`)
    }
  } catch (err) {
    console.error('[WP Sync] Status sync error:', err.message)
  }
}

/**
 * Sync a direct shipment (AWB entry) to the WP database.
 * Called after a direct booking (shipment) is created.
 *
 * @param {Object} awbData - Shipment fields for AWBENTRY
 */
export async function syncAwbToWP(awbData) {
  if (!WP_SYNC_URL || !WP_SYNC_KEY) {
    console.log('[WP Sync] Skipped — WP_SYNC_URL or WP_SYNC_KEY not configured')
    return
  }

  try {
    const url = `${WP_SYNC_URL}/wp-json/pe-cp/v1/sync-awb`
    console.log(`[WP Sync] Syncing direct AWB ${awbData.awb_no} to WP...`)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Key': WP_SYNC_KEY
      },
      body: JSON.stringify(awbData)
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('[WP Sync] AWB sync failed:', res.status, data)
    } else {
      console.log(`[WP Sync] AWB ${awbData.awb_no} synced successfully`)
    }
  } catch (err) {
    console.error('[WP Sync] AWB sync error:', err.message)
  }
}
