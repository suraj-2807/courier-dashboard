import BaseAdapter from './BaseAdapter.js'
import { decrypt } from '../utils/encryption.js'

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
export default class FlySwiftAdapter extends BaseAdapter {

  async authenticate() {
    if (!this.config.auth_url) {
      throw new Error('FlySwift: Auth URL (get_token endpoint) is required')
    }

    let credentials = {}
    try {
      credentials = JSON.parse(decrypt(this.config.auth_credentials))
    } catch {
      throw new Error('FlySwift: Failed to decrypt credentials')
    }

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
      // Use template-based approach (same as GenericAdapter)
      return this._buildFromTemplate(shipmentData, authContext)
    }

    // Default FlySwift payload structure
    return {
      customer_id: authContext?.customerId || '',
      service_code: shipmentData.service_code || 'S',
      order_number: shipmentData.order_id || shipmentData.order_reference || '',
      consignee_name: shipmentData.receiver_name || '',
      consignee_phone: shipmentData.receiver_phone || '',
      consignee_email: shipmentData.receiver_email || '',
      consignee_address: [
        shipmentData.receiver_address,
        shipmentData.receiver_address_2,
        shipmentData.receiver_address_3
      ].filter(Boolean).join(', '),
      consignee_city: shipmentData.receiver_city || '',
      consignee_state: shipmentData.receiver_state || '',
      consignee_pincode: shipmentData.receiver_pincode || '',
      consignee_country: shipmentData.receiver_country || 'IN',
      shipper_name: shipmentData.sender_name || '',
      shipper_phone: shipmentData.sender_phone || '',
      shipper_email: shipmentData.sender_email || '',
      shipper_address: [
        shipmentData.sender_address,
        shipmentData.sender_address_2,
        shipmentData.sender_address_3
      ].filter(Boolean).join(', '),
      shipper_city: shipmentData.sender_city || '',
      shipper_state: shipmentData.sender_state || '',
      shipper_pincode: shipmentData.sender_pincode || '',
      shipper_country: shipmentData.sender_country || 'IN',
      weight: parseFloat(shipmentData.weight) || 0.5,
      length: parseFloat(shipmentData.length) || 1,
      breadth: parseFloat(shipmentData.breadth) || 1,
      height: parseFloat(shipmentData.height) || 1,
      pieces: parseInt(shipmentData.no_of_pieces) || 1,
      product_type: shipmentData.package_type === 'document' ? 'DOX' : 'SPX',
      content_description: shipmentData.content_description || 'Shipment',
      declared_value: parseFloat(shipmentData.declared_value) || 0,
      payment_mode: (shipmentData.payment_mode || 'prepaid').toUpperCase(),
      cod_amount: shipmentData.payment_mode === 'cod' ? parseFloat(shipmentData.cod_amount || 0) : 0,
      invoice_number: shipmentData.invoice_no || '',
      invoice_date: shipmentData.invoice_date || new Date().toISOString().split('T')[0],
      remarks: shipmentData.remarks || ''
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

    // Error message
    const errorMessage = success ? '' : (
      responseBody?.message || responseBody?.error || responseBody?.msg
      || data?.message || data?.error
      || 'FlySwift API returned failure'
    )

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
