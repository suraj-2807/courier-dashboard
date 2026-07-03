import { decrypt } from '../utils/encryption.js'
import { createAdapter } from '../courierAdapters/adapterRegistry.js'
import { query, execute } from '../config/db.js'

/**
 * Vendor API Push Service
 * 
 * Handles:
 * 1. Adapter-based pipeline: authenticate → build payload → send → parse
 * 2. Legacy template-based functions (kept for backward compat)
 * 3. API logging
 * 4. Shipment record updates with vendor response data
 */

/**
 * Internal shipment field keys → human-readable labels
 * Used for field mapping suggestions in the frontend
 */
export const INTERNAL_FIELDS = [
  // Shipment
  { key: 'tracking_number', label: 'Tracking Number', group: 'Shipment' },
  { key: 'order_id', label: 'Order ID', group: 'Shipment' },
  { key: 'order_reference', label: 'Order Reference', group: 'Shipment' },
  { key: 'package_type', label: 'Package Type (DOX/SPX)', group: 'Shipment' },
  { key: 'weight', label: 'Weight (kg)', group: 'Shipment' },
  { key: 'length', label: 'Length (cm)', group: 'Shipment' },
  { key: 'breadth', label: 'Width (cm)', group: 'Shipment' },
  { key: 'height', label: 'Height (cm)', group: 'Shipment' },
  { key: 'no_of_pieces', label: 'No. of Pieces', group: 'Shipment' },
  { key: 'declared_value', label: 'Declared Value', group: 'Shipment' },
  { key: 'content_description', label: 'Content Description', group: 'Shipment' },
  { key: 'remarks', label: 'Remarks', group: 'Shipment' },
  { key: 'payment_mode', label: 'Payment Mode', group: 'Shipment' },
  { key: 'shipping_charge', label: 'Shipping Charge', group: 'Shipment' },
  { key: 'total_amount', label: 'Total Amount', group: 'Shipment' },
  { key: 'booking_date', label: 'Booking Date (YYYY-MM-DD)', group: 'Shipment' },
  { key: 'booking_time', label: 'Booking Time (HH:MM:SS)', group: 'Shipment' },
  { key: 'service_code', label: 'Service Code', group: 'Shipment' },

  // Sender
  { key: 'sender_name', label: 'Sender Name', group: 'Sender' },
  { key: 'sender_company', label: 'Sender Company', group: 'Sender' },
  { key: 'sender_email', label: 'Sender Email', group: 'Sender' },
  { key: 'sender_phone', label: 'Sender Phone', group: 'Sender' },
  { key: 'sender_address', label: 'Sender Address Line 1', group: 'Sender' },
  { key: 'sender_address_2', label: 'Sender Address Line 2', group: 'Sender' },
  { key: 'sender_address_3', label: 'Sender Address Line 3', group: 'Sender' },
  { key: 'sender_city', label: 'Sender City', group: 'Sender' },
  { key: 'sender_state', label: 'Sender State', group: 'Sender' },
  { key: 'sender_country', label: 'Sender Country Code', group: 'Sender' },
  { key: 'sender_pincode', label: 'Sender Pincode', group: 'Sender' },
  { key: 'sender_gstin_type', label: 'Sender GSTIN Type', group: 'Sender' },
  { key: 'sender_gstin_no', label: 'Sender GSTIN Number', group: 'Sender' },

  // Receiver
  { key: 'receiver_name', label: 'Receiver Name', group: 'Receiver' },
  { key: 'receiver_company', label: 'Receiver Company', group: 'Receiver' },
  { key: 'receiver_email', label: 'Receiver Email', group: 'Receiver' },
  { key: 'receiver_phone', label: 'Receiver Phone', group: 'Receiver' },
  { key: 'receiver_address', label: 'Receiver Address Line 1', group: 'Receiver' },
  { key: 'receiver_address_2', label: 'Receiver Address Line 2', group: 'Receiver' },
  { key: 'receiver_address_3', label: 'Receiver Address Line 3', group: 'Receiver' },
  { key: 'receiver_city', label: 'Receiver City', group: 'Receiver' },
  { key: 'receiver_state', label: 'Receiver State', group: 'Receiver' },
  { key: 'receiver_country', label: 'Receiver Country Code', group: 'Receiver' },
  { key: 'receiver_pincode', label: 'Receiver Pincode', group: 'Receiver' },
  { key: 'receiver_gstin_type', label: 'Receiver GSTIN Type', group: 'Receiver' },
  { key: 'receiver_gstin_no', label: 'Receiver GSTIN Number', group: 'Receiver' },

  // Invoice
  { key: 'invoice_no', label: 'Invoice Number', group: 'Invoice' },
  { key: 'invoice_date', label: 'Invoice Date', group: 'Invoice' },
  { key: 'invoice_currency', label: 'Invoice Currency', group: 'Invoice' },
  { key: 'invoice_amount', label: 'Invoice Amount', group: 'Invoice' },
  { key: 'hs_code', label: 'HS Code', group: 'Invoice' },
  { key: 'terms_of_trade', label: 'Terms of Trade', group: 'Invoice' },
  { key: 'export_reason', label: 'Export Reason', group: 'Invoice' },
]

// ─── 1. Primary Pipeline — Adapter-based ───

/**
 * Push a shipment to a vendor API using the adapter pipeline.
 * This is the primary function called during booking creation.
 * 
 * 1. Fetches vendor config from DB
 * 2. Creates the appropriate adapter
 * 3. Authenticates → builds payload → sends request → parses response
 * 4. Logs the attempt to vendor_api_push_logs
 * 5. Updates the shipment row with vendor response data
 * 
 * @param {string} vendorConfigId — ID of the vendor_api_configs row
 * @param {string} shipmentId — ID of the shipments row
 * @param {Object} shipmentData — Flat object of shipment field values
 * @returns {Object} { success, awbNumber, trackingUrl, labelUrl, error, ... }
 */
export async function pushShipmentToVendor(vendorConfigId, shipmentId, shipmentData) {
  let config = null
  let requestPayload = null
  let responseStatus = 0
  let responseBody = null

  try {
    // Step 1: Fetch vendor config
    const configRows = await query(
      'SELECT * FROM vendor_api_configs WHERE id = ?',
      [vendorConfigId]
    )

    if (configRows.length === 0) throw new Error('Vendor config not found')
    config = configRows[0]

    if (!config.is_active) {
      throw new Error('Vendor API is currently inactive')
    }

    // Step 2: Create adapter
    const adapter = createAdapter(config)

    // Step 3: Authenticate
    const authContext = await adapter.authenticate()

    // Step 4: Build payload
    requestPayload = adapter.buildPayload(shipmentData, authContext)

    // Step 5: Build headers
    const headers = adapter.buildHeaders(authContext)

    // Step 6: Send request
    const response = await fetch(adapter.getShipmentUrl(), {
      method: adapter.getHttpMethod(),
      headers,
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(30000)
    })

    responseStatus = response.status
    responseBody = await response.json().catch(() => ({}))

    // Step 7: Parse response
    const parsed = adapter.parseResponse(responseBody)

    // Step 8: Log the push attempt
    await _logPushAttempt({
      vendorConfigId,
      shipmentId,
      requestUrl: adapter.getShipmentUrl(),
      requestPayload,
      responseStatus,
      responseBody,
      trackingNumber: parsed.awbNumber,
      status: parsed.success ? 'success' : 'failed',
      errorMessage: parsed.errorMessage
    })

    // Step 9: Update shipment with vendor response
    await _updateShipmentVendorData(shipmentId, {
      vendor_awb_number: parsed.awbNumber,
      vendor_tracking_url: parsed.trackingUrl,
      vendor_label_url: parsed.labelUrl,
      vendor_push_status: parsed.success ? 'success' : 'failed',
      vendor_raw_response: JSON.stringify(responseBody)
    })

    // Step 10: Update vendor config last push info
    await execute(
      `UPDATE vendor_api_configs 
       SET last_push_status = ?, last_push_at = NOW(), last_push_response = ?
       WHERE id = ?`,
      [
        parsed.success ? 'success' : 'failed',
        JSON.stringify(responseBody),
        vendorConfigId
      ]
    )

    return {
      success: parsed.success,
      awbNumber: parsed.awbNumber,
      trackingUrl: parsed.trackingUrl,
      labelUrl: parsed.labelUrl,
      requestPayload,
      responseStatus,
      responseBody,
      error: parsed.errorMessage || null
    }

  } catch (error) {
    // Log failure
    await _logPushAttempt({
      vendorConfigId,
      shipmentId,
      requestUrl: config?.shipment_api_url || '',
      requestPayload,
      responseStatus,
      responseBody,
      trackingNumber: '',
      status: 'failed',
      errorMessage: error.message
    })

    // Update shipment push status
    if (shipmentId) {
      await _updateShipmentVendorData(shipmentId, {
        vendor_push_status: 'failed',
        vendor_raw_response: JSON.stringify({ error: error.message })
      })
    }

    return {
      success: false,
      awbNumber: '',
      trackingUrl: '',
      labelUrl: '',
      requestPayload,
      responseStatus,
      responseBody,
      error: error.message
    }
  }
}


// ─── 2. Authentication (standalone) ───

/**
 * Authenticate with a vendor API (used for test connection).
 * Uses the adapter pipeline.
 */
export async function authenticateVendor(config) {
  const adapter = createAdapter(config)
  const authContext = await adapter.authenticate()
  return authContext?.token || null
}


// ─── 3. Legacy Template Functions (backward compat for pushTestData) ───

/**
 * Full pipeline using direct template engine (legacy).
 * Kept for the pushTestData endpoint which doesn't have a shipment ID.
 */
export async function pushToVendorApi(config, shipmentData) {
  try {
    const adapter = createAdapter(config)

    // Authenticate
    const authContext = await adapter.authenticate()

    // Build payload
    const payload = adapter.buildPayload(shipmentData, authContext)

    // Build headers
    const headers = adapter.buildHeaders(authContext)

    // Send request
    const response = await fetch(adapter.getShipmentUrl(), {
      method: adapter.getHttpMethod(),
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    })

    const responseBody = await response.json().catch(() => ({}))

    // Parse response
    const parsed = adapter.parseResponse(responseBody)

    return {
      success: parsed.success,
      trackingNumber: parsed.awbNumber,
      requestPayload: payload,
      responseStatus: response.status,
      responseBody,
      error: parsed.errorMessage || null
    }
  } catch (error) {
    return {
      success: false,
      trackingNumber: '',
      requestPayload: null,
      responseStatus: 0,
      responseBody: null,
      error: error.message
    }
  }
}


// ─── 4. Utility Functions ───

/**
 * Extract all field paths from a JSON object (for the field mapping UI).
 * Returns flat paths like ["ShipperName", "Dimensions[].ActualWeight", etc.]
 */
export function extractFieldPaths(obj, prefix = '') {
  const paths = []

  for (const [key, value] of Object.entries(obj || {})) {
    const currentPath = prefix ? `${prefix}.${key}` : key

    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object') {
        const childPaths = extractFieldPaths(value[0], `${currentPath}[]`)
        paths.push(...childPaths)
      } else {
        paths.push(currentPath)
      }
    } else if (value !== null && typeof value === 'object') {
      const childPaths = extractFieldPaths(value, currentPath)
      paths.push(...childPaths)
    } else {
      paths.push(currentPath)
    }
  }

  return paths
}


// ─── Private Helpers ───

async function _logPushAttempt({ vendorConfigId, shipmentId, requestUrl, requestPayload, responseStatus, responseBody, trackingNumber, status, errorMessage }) {
  try {
    await execute(
      `INSERT INTO vendor_api_push_logs 
       (vendor_config_id, shipment_id, request_url, request_payload, response_status, response_body, tracking_number_received, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendorConfigId || null,
        shipmentId || null,
        requestUrl || '',
        JSON.stringify(requestPayload || {}),
        responseStatus || 0,
        JSON.stringify(responseBody || {}),
        trackingNumber || '',
        status || 'failed',
        errorMessage || ''
      ]
    )
  } catch (logError) {
    console.error('Failed to log push attempt:', logError.message)
  }
}

async function _updateShipmentVendorData(shipmentId, updateData) {
  try {
    if (!shipmentId) return

    const setClauses = []
    const values = []

    for (const [key, value] of Object.entries(updateData)) {
      setClauses.push(`${key} = ?`)
      values.push(value)
    }

    values.push(shipmentId)

    await execute(
      `UPDATE shipments SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    )
  } catch (updateError) {
    console.error('Failed to update shipment vendor data:', updateError.message)
  }
}
