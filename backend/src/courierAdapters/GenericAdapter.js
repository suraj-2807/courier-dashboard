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

    // Parse parcels and invoice items if provided as strings
    let parsedShipmentData = { ...shipmentData }
    if (typeof parsedShipmentData.parcels === 'string') {
      try {
        parsedShipmentData.parcels = JSON.parse(parsedShipmentData.parcels)
      } catch {}
    }
    if (typeof parsedShipmentData.invoice_items === 'string') {
      try {
        parsedShipmentData.invoice_items = JSON.parse(parsedShipmentData.invoice_items)
      } catch {}
    }

    const initializedArrays = new Set()
    const numPieces = parseInt(shipmentData.no_of_pieces) || (Array.isArray(parsedShipmentData.parcels) && parsedShipmentData.parcels.length > 0 ? parsedShipmentData.parcels.length : 1)

    // First, initialize/duplicate any arrays mapped with dynamic indexing
    for (const [vendorFieldPath] of Object.entries(mapping)) {
      if (vendorFieldPath.includes('[]')) {
        const arrayPart = vendorFieldPath.split('[]')[0]
        if (arrayPart && !initializedArrays.has(arrayPart)) {
          initializedArrays.add(arrayPart)
          let templateArray = this._getNestedValue(template, arrayPart)
          if (!Array.isArray(templateArray)) {
            templateArray = []
          }
          const templateItem = templateArray.length > 0 ? templateArray[0] : {}
          const newArray = []
          for (let i = 0; i < numPieces; i++) {
            newArray.push(JSON.parse(JSON.stringify(templateItem)))
          }
          this._setNestedValue(payload, arrayPart, newArray)
        }
      }
    }

    // Apply field mappings
    for (const [vendorFieldPath, mappingConfig] of Object.entries(mapping)) {
      if (vendorFieldPath.includes('[]')) {
        // Map elements for each index of the array
        for (let i = 0; i < numPieces; i++) {
          let value

          if (mappingConfig.type === 'static') {
            value = mappingConfig.value
          } else if (mappingConfig.type === 'mapped') {
            value = this._getNestedValue(parsedShipmentData, mappingConfig.source, i)
            if (mappingConfig.transform) {
              value = this._applyTransform(value, mappingConfig.transform, i, numPieces, parsedShipmentData)
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
            this._setNestedValue(payload, vendorFieldPath, value, i)
          }
        }
      } else {
        // Standard mapping
        let value

        if (mappingConfig.type === 'static') {
          value = mappingConfig.value
        } else if (mappingConfig.type === 'mapped') {
          value = this._getNestedValue(parsedShipmentData, mappingConfig.source)
          if (mappingConfig.transform) {
            value = this._applyTransform(value, mappingConfig.transform, 0, 1, parsedShipmentData)
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

    let labelUrl = this._getNestedValue(responseBody, 'data.label_url')
      || this._getNestedValue(responseBody, 'labelUrl')
      || this._getNestedValue(responseBody, 'label_url')
      || this._getNestedValue(responseBody, 'data.pdf_url')
      || ''

    if (!labelUrl && Array.isArray(responseBody?.labels) && responseBody.labels.length > 0) {
      const rawLbl = responseBody.labels[0]?.label || ''
      if (rawLbl) {
        labelUrl = rawLbl.startsWith('http') || rawLbl.startsWith('data:') ? rawLbl : `data:application/pdf;base64,${rawLbl}`
      }
    }

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

  _getNestedValue(obj, path, index = null) {
    if (!path || !obj) return undefined
    const parts = path.split('.')
    let current = obj
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i]
      if (current === null || current === undefined) return undefined
      if (part.endsWith('[]')) {
        part = part.slice(0, -2)
        const arrayIdx = index !== null ? index : 0
        current = Array.isArray(current[part]) ? current[part][arrayIdx] : undefined
      } else if (part.includes('[') && part.endsWith(']')) {
        const openBracket = part.indexOf('[')
        const indexStr = part.slice(openBracket + 1, -1)
        part = part.slice(0, openBracket)
        const arrayIdx = indexStr === '' && index !== null ? index : (parseInt(indexStr) || 0)
        current = Array.isArray(current[part]) ? current[part][arrayIdx] : undefined
      } else {
        current = current[part]
      }
    }
    return current
  }

  _setNestedValue(obj, path, value, index = null) {
    if (!path) return
    const parts = path.split('.')
    let current = obj
    for (let i = 0; i < parts.length - 1; i++) {
      let part = parts[i]
      let isArray = false
      let arrayIdx = 0

      if (part.endsWith('[]')) {
        part = part.slice(0, -2)
        isArray = true
        arrayIdx = index !== null ? index : 0
      } else if (part.includes('[') && part.endsWith(']')) {
        const openBracket = part.indexOf('[')
        const indexStr = part.slice(openBracket + 1, -1)
        part = part.slice(0, openBracket)
        isArray = true
        arrayIdx = indexStr === '' && index !== null ? index : parseInt(indexStr) || 0
      }

      if (isArray) {
        if (!Array.isArray(current[part])) {
          current[part] = []
        }
        if (!current[part][arrayIdx]) {
          current[part][arrayIdx] = {}
        }
        current = current[part][arrayIdx]
      } else {
        if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
          current[part] = {}
        }
        current = current[part]
      }
    }

    let lastPart = parts[parts.length - 1]
    let isArray = false
    let arrayIdx = 0

    if (lastPart.endsWith('[]')) {
      lastPart = lastPart.slice(0, -2)
      isArray = true
      arrayIdx = index !== null ? index : 0
    } else if (lastPart.includes('[') && lastPart.endsWith(']')) {
      const openBracket = lastPart.indexOf('[')
      const indexStr = lastPart.slice(openBracket + 1, -1)
      lastPart = lastPart.slice(0, openBracket)
      isArray = true
      arrayIdx = indexStr === '' && index !== null ? index : parseInt(indexStr) || 0
    }

    if (isArray) {
      if (!Array.isArray(current[lastPart])) {
        current[lastPart] = []
      }
      current[lastPart][arrayIdx] = value
    } else {
      current[lastPart] = value
    }
  }

  _applyTransform(value, transform, index = 0, total = 1, shipmentData = {}) {
    const numPieces = total
    const weight = parseFloat(shipmentData.weight) || 0
    const declaredValue = parseFloat(shipmentData.declared_value) || parseFloat(shipmentData.total_amount) || 0

    let parcelsList = []
    if (shipmentData.parcels) {
      try {
        parcelsList = typeof shipmentData.parcels === 'string' ? JSON.parse(shipmentData.parcels) : shipmentData.parcels
      } catch {}
    }
    const currentParcel = Array.isArray(parcelsList) ? (parcelsList[index] || {}) : {}

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
      case 'weight_per_piece': {
        return String(parseFloat(currentParcel.weight) || Math.round((weight / numPieces) * 100) / 100)
      }
      case 'declared_value_per_piece': {
        return String(Math.round((declaredValue / numPieces) * 100) / 100)
      }
      case 'parcel_weight': {
        return String(parseFloat(currentParcel.weight) || Math.round((weight / numPieces) * 100) / 100)
      }
      case 'parcel_length': {
        const val = (currentParcel && currentParcel.length !== undefined && currentParcel.length !== null && currentParcel.length !== '') ? currentParcel.length : shipmentData.length
        return String(val !== undefined && val !== null && val !== '' ? (parseFloat(val) || 0) : 0)
      }
      case 'parcel_width':
      case 'parcel_breadth': {
        const val = (currentParcel && (currentParcel.breadth !== undefined || currentParcel.width !== undefined)) ? (currentParcel.breadth ?? currentParcel.width) : shipmentData.breadth
        return String(val !== undefined && val !== null && val !== '' ? (parseFloat(val) || 0) : 0)
      }
      case 'parcel_height': {
        const val = (currentParcel && currentParcel.height !== undefined && currentParcel.height !== null && currentParcel.height !== '') ? currentParcel.height : shipmentData.height
        return String(val !== undefined && val !== null && val !== '' ? (parseFloat(val) || 0) : 0)
      }
      case 'parcel_volumetric_weight': {
        return String(currentParcel.volumetric_weight || '')
      }
      case 'parcel_chargeable_weight': {
        return String(currentParcel.chargeable_weight || '')
      }
      case 'index_1_based': {
        return String(index + 1)
      }
      case 'index_0_based': {
        return String(index)
      }
      default: return value
    }
  }
}
