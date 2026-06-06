import BaseAdapter from './BaseAdapter.js'
import { decrypt } from '../utils/encryption.js'

/**
 * GenericAdapter — Template-driven adapter for any vendor.
 * 
 * Uses the existing config-driven template engine:
 * - auth_payload_template + auth_credentials for authentication
 * - request_template + field_mapping for payload building
 * - headers_template for custom headers
 * - response_tracking_path / response_success_path for response parsing
 * 
 * This is the DEFAULT adapter used when no vendor-specific adapter exists.
 * It handles all 3 auth types: 'token', 'inline', 'api_key'.
 */
export default class GenericAdapter extends BaseAdapter {

  /**
   * Authenticate based on auth_type:
   * - 'token': POST to auth_url with credentials → extract token from response
   * - 'inline': No pre-auth (credentials go in the shipment payload)
   * - 'api_key': No pre-auth (API key goes in headers)
   */
  async authenticate() {
    const { auth_type } = this.config

    if (auth_type === 'token') {
      const token = await this._getToken()
      return { token }
    }

    // For 'inline' and 'api_key', no pre-auth needed
    return {}
  }

  /**
   * Build payload from request_template + field_mapping.
   */
  buildPayload(shipmentData, authContext) {
    const template = this.config.request_template || {}
    const mapping = this.config.field_mapping || {}

    // Deep clone the template
    let payload = JSON.parse(JSON.stringify(template))

    // Apply field mappings
    for (const [vendorFieldPath, mappingConfig] of Object.entries(mapping)) {
      let value

      if (mappingConfig.type === 'static') {
        value = mappingConfig.value
      } else if (mappingConfig.type === 'mapped') {
        value = this._getNestedValue(shipmentData, mappingConfig.source)
        if (mappingConfig.transform) {
          value = this._applyTransform(value, mappingConfig.transform)
        }
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

    // For inline auth, inject credentials into the payload
    if (this.config.auth_type === 'inline') {
      try {
        const credentials = JSON.parse(decrypt(this.config.auth_credentials))
        const authFields = this.config.auth_payload_template || {}
        for (const [key] of Object.entries(authFields)) {
          if (credentials[key] && !payload[key]) {
            payload[key] = credentials[key]
          }
        }
      } catch {
        // Credentials already mapped via field_mapping
      }
    }

    return payload
  }

  /**
   * Build headers from headers_template, replacing {{token}} placeholders.
   */
  buildHeaders(authContext) {
    const headersTemplate = this.config.headers_template || {}
    const headers = { 'Content-Type': 'application/json' }
    const token = authContext?.token || ''

    for (const [key, value] of Object.entries(headersTemplate)) {
      if (typeof value === 'string') {
        headers[key] = value.replace(/\{\{token\}\}/g, token)
      } else {
        headers[key] = value
      }
    }

    return headers
  }

  /**
   * Parse response using configured paths.
   */
  parseResponse(responseBody) {
    const config = this.config

    // Check success
    let success = true
    if (config.response_success_path) {
      const successValue = this._getNestedValue(responseBody, config.response_success_path)
      if (config.response_success_value) {
        success = String(successValue) === String(config.response_success_value)
      } else {
        success = !!successValue
      }
    }

    // Extract AWB/tracking number
    let awbNumber = ''
    if (config.response_tracking_path && success) {
      awbNumber = String(this._getNestedValue(responseBody, config.response_tracking_path) || '')
    }

    // Try common paths for tracking URL and label URL
    const trackingUrl = this._getNestedValue(responseBody, 'data.tracking_url')
      || this._getNestedValue(responseBody, 'trackingUrl')
      || this._getNestedValue(responseBody, 'tracking_url')
      || ''

    const labelUrl = this._getNestedValue(responseBody, 'data.label_url')
      || this._getNestedValue(responseBody, 'labelUrl')
      || this._getNestedValue(responseBody, 'label_url')
      || this._getNestedValue(responseBody, 'data.pdf_url')
      || ''

    return {
      success,
      awbNumber,
      trackingUrl: String(trackingUrl),
      labelUrl: String(labelUrl),
      errorMessage: success ? '' : (
        responseBody?.message || responseBody?.error || responseBody?.msg || 'Vendor API returned failure'
      )
    }
  }

  // ─── Private helpers ───

  async _getToken() {
    if (!this.config.auth_url) {
      throw new Error('Auth URL is required for token-based authentication')
    }

    let credentials = {}
    try {
      credentials = JSON.parse(decrypt(this.config.auth_credentials))
    } catch {
      throw new Error('Failed to decrypt vendor credentials')
    }

    // Build auth payload from template, replacing values with actual credentials
    const authPayload = {}
    for (const [key, defaultVal] of Object.entries(this.config.auth_payload_template || {})) {
      authPayload[key] = credentials[key] !== undefined ? credentials[key] : defaultVal
    }

    const response = await fetch(this.config.auth_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authPayload),
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(`Auth failed: HTTP ${response.status} - ${errorBody}`)
    }

    const data = await response.json()
    const token = this._getNestedValue(data, this.config.auth_token_path)

    if (!token) {
      throw new Error(`Could not extract token from response using path: ${this.config.auth_token_path}`)
    }

    return token
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

  _applyTransform(value, transform) {
    switch (transform) {
      case 'uppercase': return String(value || '').toUpperCase()
      case 'lowercase': return String(value || '').toLowerCase()
      case 'string': return String(value || '')
      case 'number': return Number(value) || 0
      case 'date_yyyy_mm_dd': return new Date().toISOString().split('T')[0]
      case 'time_hh_mm_ss': return new Date().toTimeString().split(' ')[0]
      case 'date_dd_mm_yyyy': {
        const d = new Date()
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
      }
      default: return value
    }
  }
}
