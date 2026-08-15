import BaseAdapter from './BaseAdapter.js'
import { decrypt } from '../utils/encryption.js'
import GenericAdapter from './GenericAdapter.js'

/**
 * FlySwiftAdapter — Adapter for FlySwift / Trackmate+ courier API.
 * 
 * Auth flow:
 *   1. POST to auth_url (get_token) with { username, password }
 *   2. Response contains { token, customer_id }
 *   3. Use bearer token + customer_id for create_docket
 * 
 * Shipment flow:
 *   POST to shipment_api_url (create_docket) with bearer token in header,
 *   customer_id and shipment data in body.
 */
function parseCredentials(raw) {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null) return raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return {}
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed)
      } catch (e) {}
    }
    try {
      const decrypted = decrypt(trimmed)
      if (decrypted) {
        return typeof decrypted === 'object' ? decrypted : JSON.parse(decrypted)
      }
    } catch (e) {}
    try {
      return JSON.parse(trimmed)
    } catch (e) {}
  }
  return {}
}

export default class FlySwiftAdapter extends BaseAdapter {

  async authenticate() {
    if (!this.config.auth_url) {
      throw new Error('FlySwift: Auth URL (get_token endpoint) is required')
    }

    const credentials = parseCredentials(this.config.auth_credentials)

    const companyIdRaw = credentials.company_code || credentials.company_id
    let companyId = null
    if (companyIdRaw !== undefined && companyIdRaw !== null && companyIdRaw !== '') {
      const parsed = parseInt(companyIdRaw, 10)
      companyId = isNaN(parsed) ? companyIdRaw : parsed
    }

    const authPayload = {
      company_id: companyId,
      email: credentials.username || credentials.user_id || credentials.email || '',
      password: credentials.password || ''
    }

    const response = await fetch(this.config.auth_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authPayload),
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(`FlySwift auth failed: HTTP ${response.status} - ${errorBody}`)
    }

    const data = await response.json()

    // Extract token — try multiple common paths
    const token = data?.data?.token
      || data?.token
      || data?.access_token
      || this._getNestedValue(data, this.config.auth_token_path)

    if (!token) {
      throw new Error('FlySwift: Could not extract token from auth response')
    }

    // Extract customer_id — FlySwift returns this alongside the token
    const customerId = data?.data?.customer_id
      || data?.customer_id
      || credentials.customer_id
      || ''

    return { token, customerId }
  }

  buildPayload(shipmentData, authContext) {
    // FlySwift create_docket expects a specific structure.
    // If a request_template is configured, use it with field_mapping.
    // Otherwise, build the default FlySwift payload structure.

    if (this.config.request_template && Object.keys(this.config.request_template).length > 0) {
      const generic = new GenericAdapter(this.config)
      return generic.buildPayload(shipmentData, authContext)
    }

    const bookingDate = shipmentData.booking_date || new Date().toISOString().split('T')[0]
    const bookingTime = shipmentData.booking_time || new Date().toTimeString().split(' ')[0]
    const pcs = String(parseInt(shipmentData.no_of_pieces) || 1)
    const weight = parseFloat(shipmentData.weight) || 0.5
    const declaredValue = parseFloat(shipmentData.declared_value) || parseFloat(shipmentData.total_amount) || 100
    const invoiceNo = shipmentData.invoice_no || shipmentData.order_id || ''
    const invoiceDate = shipmentData.invoice_date || bookingDate

    // Build docket_items array from shipment dimensions
    const docketItems = []
    const numPieces = parseInt(shipmentData.no_of_pieces) || 1
    const perPieceWeight = String(Math.round((weight / numPieces) * 100) / 100)
    for (let i = 0; i < numPieces; i++) {
      docketItems.push({
        actual_weight: perPieceWeight,
        length: String(parseFloat(shipmentData.length) || 1),
        width: String(parseFloat(shipmentData.breadth) || 1),
        height: String(parseFloat(shipmentData.height) || 1),
        number_of_boxes: '1'
      })
    }

    // Build free_form_line_items (required by FlySwift for invoice)
    const perItemValue = String(Math.round((declaredValue / numPieces) * 100) / 100)
    const freeFormLineItems = []
    for (let i = 0; i < numPieces; i++) {
      freeFormLineItems.push({
        total: perItemValue,
        no_of_packages: '1',
        box_no: String(i + 1),
        rate: perItemValue,
        hscode: shipmentData.hs_code || '999999',
        description: shipmentData.content_description || 'Shipment',
        unit_of_measurement: 'Pc',
        unit_weight: perPieceWeight,
        igst_amount: '0.00'
      })
    }

    // Default FlySwift create_docket payload structure
    return {
      tracking_no: shipmentData.tracking_number || shipmentData.order_id || '',
      reference_name: shipmentData.sender_name || shipmentData.order_reference || '',
      origin_code: '',
      product_code: shipmentData.product_code || '',
      destination_code: '',
      booking_date: bookingDate,
      booking_time: bookingTime,
      pcs: pcs,
      shipment_value: String(declaredValue),
      shipment_value_currency: shipmentData.invoice_currency || 'INR',
      actual_weight: String(weight),
      shipment_invoice_no: invoiceNo,
      shipment_invoice_date: invoiceDate,
      shipment_content: shipmentData.content_description || 'Shipment',
      remark: shipmentData.remarks || '',
      new_docket_free_form_invoice: '1',
      free_form_currency: shipmentData.invoice_currency || 'INR',
      terms_of_trade: shipmentData.terms_of_trade || 'FOB',
      api_service_code: shipmentData.service_code || '',
      api_vendor_code: shipmentData.vendor_code || '',

      // Shipper (Sender)
      shipper_name: shipmentData.sender_name || '',
      shipper_company_name: shipmentData.sender_company || shipmentData.sender_name || '',
      shipper_contact_no: shipmentData.sender_phone || '',
      shipper_email: shipmentData.sender_email || '',
      shipper_address_line_1: shipmentData.sender_address || '',
      shipper_address_line_2: shipmentData.sender_address_2 || '',
      shipper_address_line_3: shipmentData.sender_address_3 || '',
      shipper_city: shipmentData.sender_city || '',
      shipper_state: shipmentData.sender_state || '',
      shipper_country: shipmentData.sender_country || 'IN',
      shipper_zip_code: shipmentData.sender_pincode || '',
      shipper_gstin_type: shipmentData.sender_gstin_type || '',
      shipper_gstin_no: shipmentData.sender_gstin_no || '',

      // Consignee (Receiver)
      consignee_name: shipmentData.receiver_name || '',
      consignee_company_name: shipmentData.receiver_company || shipmentData.receiver_name || '',
      consignee_contact_no: shipmentData.receiver_phone || '',
      consignee_email: shipmentData.receiver_email || '',
      consignee_address_line_1: shipmentData.receiver_address || '',
      consignee_address_line_2: shipmentData.receiver_address_2 || '',
      consignee_address_line_3: shipmentData.receiver_address_3 || '',
      consignee_city: shipmentData.receiver_city || '',
      consignee_state: shipmentData.receiver_state || '',
      consignee_country: shipmentData.receiver_country || 'IN',
      consignee_zip_code: shipmentData.receiver_pincode || '',
      consignee_gstin_type: shipmentData.receiver_gstin_type || '',
      consignee_gstin_no: shipmentData.receiver_gstin_no || '',

      // Pickup Address (same as sender by default)
      pickup_address_name: shipmentData.sender_name || '',
      pickup_address_code: shipmentData.sender_company || shipmentData.sender_name || '',
      pickup_address_contact_no: shipmentData.sender_phone || '',
      pickup_address_email: shipmentData.sender_email || '',
      pickup_address_address_line_1: shipmentData.sender_address || '',
      pickup_address_address_line_2: shipmentData.sender_address_2 || '',
      pickup_address_address_line_3: shipmentData.sender_address_3 || '',
      pickup_address_city: shipmentData.sender_city || '',
      pickup_address_state: shipmentData.sender_state || '',
      pickup_address_country: shipmentData.sender_country || 'IN',
      pickup_address_zip_code: shipmentData.sender_pincode || '',
      pickup_address_gstin_type: shipmentData.sender_gstin_type || '',
      pickup_address_gstin_no: shipmentData.sender_gstin_no || '',

      // Nested arrays
      docket_items: docketItems,
      free_form_line_items: freeFormLineItems,
      kyc_details: [],
      multiple_invoice: []
    }
  }

  buildHeaders(authContext) {
    const headers = { 'Content-Type': 'application/json' }

    if (authContext?.token) {
      headers['Authorization'] = `Bearer ${authContext.token}`
    }

    // Also apply any custom headers from config
    const customHeaders = this.config.headers_template || {}
    for (const [key, value] of Object.entries(customHeaders)) {
      if (typeof value === 'string') {
        headers[key] = value
          .replace(/\{\{token\}\}/g, authContext?.token || '')
          .replace(/\{\{customer_id\}\}/g, authContext?.customerId || '')
      } else {
        headers[key] = value
      }
    }

    return headers
  }

  parseResponse(responseBody) {
    // FlySwift response format — try multiple common structures
    const data = responseBody?.data || responseBody

    // Check success
    const success = responseBody?.success === true
      || responseBody?.status === 'success'
      || responseBody?.status === true
      || (responseBody?.data?.awb_number && true)
      || false

    // Extract AWB number
    const awbNumber = String(
      data?.awb_number || data?.awb || data?.tracking_number
      || data?.docket_number || data?.waybill_number
      || this._getNestedValue(responseBody, this.config.response_tracking_path)
      || ''
    )

    // Extract URLs
    const trackingUrl = String(data?.tracking_url || data?.track_url || '')
    const labelUrl = String(data?.label_url || data?.pdf_url || data?.label || '')

    // Error message — FlySwift returns errors as an array
    let errorMessage = ''
    if (!success) {
      if (Array.isArray(responseBody?.errors) && responseBody.errors.length > 0) {
        errorMessage = responseBody.errors.join('; ')
      } else if (Array.isArray(data?.errors) && data.errors.length > 0) {
        errorMessage = data.errors.join('; ')
      } else {
        errorMessage = responseBody?.message || responseBody?.error || responseBody?.msg
          || data?.message || data?.error
          || 'FlySwift API returned failure'
      }
    }

    return { success, awbNumber, trackingUrl, labelUrl, errorMessage }
  }

  // ─── Private helpers ───

  _buildFromTemplate(shipmentData, authContext) {
    const template = this.config.request_template || {}
    const mapping = this.config.field_mapping || {}
    let payload = JSON.parse(JSON.stringify(template))

    for (const [vendorFieldPath, mappingConfig] of Object.entries(mapping)) {
      let value

      if (mappingConfig.type === 'static') {
        value = mappingConfig.value
      } else if (mappingConfig.type === 'mapped') {
        value = this._getNestedValue(shipmentData, mappingConfig.source)
      } else if (mappingConfig.type === 'credential') {
        try {
          const credentials = JSON.parse(decrypt(this.config.auth_credentials))
          value = credentials[mappingConfig.source]
        } catch {
          value = ''
        }
      }

      if (value !== undefined) {
        this._setNestedValue(payload, vendorFieldPath, value)
      }
    }

    // Inject customer_id from auth context
    if (authContext?.customerId && !payload.customer_id) {
      payload.customer_id = authContext.customerId
    }

    return payload
  }

  _getNestedValue(obj, path) {
    if (!path || !obj) return undefined
    const parts = path.split('.')
    let current = obj
    for (const part of parts) {
      if (current === null || current === undefined) return undefined
      current = current[part]
    }
    return current
  }

  _setNestedValue(obj, path, value) {
    if (!path) return
    const parts = path.split('.')
    let current = obj
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {}
      }
      current = current[part]
    }
    current[parts[parts.length - 1]] = value
  }
}
