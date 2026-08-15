import BaseAdapter from './BaseAdapter.js'
import { decrypt } from '../utils/encryption.js'
import GenericAdapter from './GenericAdapter.js'

/**
 * FlySwiftAdapter — Adapter for FlySwift / Trackmate+ courier API.
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

function toIsoCountryCode(val) {
  if (!val) return ''
  const clean = String(val).trim().toUpperCase()
  if (clean.length === 2) return clean
  if (clean === 'USA' || clean === 'UNITED STATES' || clean === 'UNITED STATES OF AMERICA') return 'US'
  if (clean === 'INDIA' || clean === 'IND') return 'IN'
  if (clean === 'UNITED KINGDOM' || clean === 'UK' || clean === 'GREAT BRITAIN') return 'GB'
  if (clean === 'CANADA' || clean === 'CAN') return 'CA'
  if (clean === 'AUSTRALIA' || clean === 'AUS') return 'AU'
  if (clean === 'UNITED ARAB EMIRATES' || clean === 'UAE' || clean === 'DUBAI') return 'AE'
  if (clean === 'GERMANY' || clean === 'DEU') return 'DE'
  if (clean === 'FRANCE' || clean === 'FRA') return 'FR'
  if (clean === 'JAPAN' || clean === 'JPN') return 'JP'
  if (clean === 'SINGAPORE' || clean === 'SGP') return 'SG'
  return clean.slice(0, 2)
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

    const headers = {
      'Content-Type': 'application/json'
    }

    if (this.config.headers_template && Object.keys(this.config.headers_template).length > 0) {
      Object.assign(headers, this.config.headers_template)
    }

    const response = await fetch(this.config.auth_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(authPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`FlySwift Auth failed (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const token = data?.data?.token || data?.token || data?.jwt
    const customerId = data?.data?.customer_id || data?.customer_id || credentials.customer_id

    if (!token) {
      throw new Error(`FlySwift Auth failed: No token returned in response (${JSON.stringify(data)})`)
    }

    return {
      token,
      customerId,
      rawAuthResponse: data
    }
  }

  buildPayload(shipmentData, authContext) {
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

    const originCode = toIsoCountryCode(shipmentData.sender_country) || 'IN'
    const destCode = toIsoCountryCode(shipmentData.receiver_country || shipmentData.buyer_country_code || shipmentData.buyer_destination_code) || ''

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
      origin_code: originCode,
      origin: originCode,
      product_code: shipmentData.product_code || '',
      destination_code: destCode,
      destination: destCode,
      destination_country: destCode,
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
      shipper_country: originCode,
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
      consignee_country: destCode,
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
      pickup_address_country: originCode,
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

  async pushShipment(shipmentData, authContext) {
    if (!this.config.shipment_api_url) {
      throw new Error('FlySwift: Shipment API URL (create_docket endpoint) is required')
    }

    const payload = this.buildPayload(shipmentData, authContext)

    if (authContext.customerId) {
      payload.customer_id = authContext.customerId
    }

    const method = this.config.shipment_api_method || 'POST'
    const headers = {
      'Content-Type': 'application/json'
    }

    if (authContext.token) {
      headers['Authorization'] = `Bearer ${authContext.token}`
    }

    if (this.config.headers_template && Object.keys(this.config.headers_template).length > 0) {
      Object.assign(headers, this.config.headers_template)
    }

    const response = await fetch(this.config.shipment_api_url, {
      method,
      headers,
      body: JSON.stringify(payload)
    })

    const responseText = await response.text()
    let responseData = {}
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = { raw: responseText }
    }

    let success = response.ok
    if (this.config.response_success_path) {
      const extracted = this.extractValueByPath(responseData, this.config.response_success_path)
      if (this.config.response_success_value) {
        success = String(extracted) === String(this.config.response_success_value)
      } else {
        success = Boolean(extracted)
      }
    } else if (responseData.success !== undefined) {
      success = Boolean(responseData.success)
    }

    let vendorTrackingNumber = ''
    if (this.config.response_tracking_path) {
      vendorTrackingNumber = this.extractValueByPath(responseData, this.config.response_tracking_path) || ''
    } else {
      vendorTrackingNumber =
        responseData.data?.tracking_number ||
        responseData.data?.tracking_no ||
        responseData.data?.awb_number ||
        responseData.data?.docket_no ||
        responseData.data?.id ||
        responseData.tracking_number ||
        responseData.docket_no ||
        ''
    }

    return {
      success,
      statusCode: response.status,
      vendorTrackingNumber: String(vendorTrackingNumber),
      rawResponse: responseData,
      rawRequestPayload: payload
    }
  }

  extractValueByPath(obj, pathStr) {
    if (!obj || !pathStr) return undefined
    const keys = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.')
    let current = obj
    for (const key of keys) {
      if (current === null || current === undefined) return undefined
      current = current[key]
    }
    return current
  }
}
