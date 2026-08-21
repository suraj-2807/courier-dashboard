import BaseAdapter from './BaseAdapter.js'
import { decrypt } from '../utils/encryption.js'
import GenericAdapter from './GenericAdapter.js'
import fs from 'fs'
import path from 'path'

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

export function findAwbInObject(obj, depth = 0) {
  if (!obj || depth > 5) return ''

  if (typeof obj === 'string' || typeof obj === 'number') {
    const str = String(obj).trim()
    if (str.length >= 3 && !str.includes('{') && !str.includes('<') && str !== 'true' && str !== 'false' && str !== 'null' && str !== 'undefined') {
      return str
    }
    return ''
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findAwbInObject(item, depth + 1)
      if (found) return found
    }
    return ''
  }

  if (typeof obj === 'object') {
    // 1. Direct FlySwift / Trackmate keys
    if (obj.data && typeof obj.data === 'object') {
      const dataAwb = obj.data.awb_no || obj.data.entry_number || obj.data.forwording_no || obj.data.docket_id || obj.data.awb_number || obj.data.tracking_number || obj.data.docket_no
      if (dataAwb) return String(dataAwb).trim()
    }

    // 2. Direct priority keys on current object
    const priorityKeys = [
      'awb_no', 'awb_number', 'awbNumber', 'awb', 'tracking_number', 'tracking_no', 'trackingNumber',
      'entry_number', 'docket_no', 'docket_number', 'docketNo', 'docket_id', 'docket', 'forwording_no', 'forwarding_no',
      'waybill_no', 'waybill', 'airwaybill_no', 'tracking_id', 'reference_no', 'ref_no'
    ]

    for (const key of priorityKeys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        const val = findAwbInObject(obj[key], depth + 1)
        if (val) return val
      }
    }

    // 3. Known envelope objects like data, result, response, payload, shipment, etc.
    const envelopeKeys = ['data', 'result', 'response', 'payload', 'shipment', 'output', 'body', 'data_response']
    for (const envKey of envelopeKeys) {
      if (obj[envKey] && typeof obj[envKey] === 'object') {
        const val = findAwbInObject(obj[envKey], depth + 1)
        if (val) return val
      }
    }

    // 4. Any key matching tracking, docket, awb, waybill, or ref
    for (const [k, v] of Object.entries(obj)) {
      if (/tracking|docket|awb|waybill|forwarding|forwording/i.test(k) && v !== undefined && v !== null && v !== '') {
        const val = findAwbInObject(v, depth + 1)
        if (val) return val
      }
    }
  }

  return ''
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

  getShipmentUrl() {
    return this.config.shipment_api_url
  }

  getHttpMethod() {
    return this.config.shipment_api_method || 'POST'
  }

  buildHeaders(authContext) {
    const headers = {
      'Content-Type': 'application/json'
    }

    if (authContext && authContext.token) {
      headers['Authorization'] = `Bearer ${authContext.token}`
    }

    if (this.config.headers_template && Object.keys(this.config.headers_template).length > 0) {
      Object.assign(headers, this.config.headers_template)
    }

    return headers
  }

  buildPayload(shipmentData, authContext) {
    const bookingDate = shipmentData.booking_date || new Date().toISOString().split('T')[0]
    const bookingTime = shipmentData.booking_time || new Date().toTimeString().split(' ')[0]
    const pcs = String(parseInt(shipmentData.no_of_pieces) || 1)
    const weight = parseFloat(shipmentData.weight) || 0.5
    const declaredValue = parseFloat(shipmentData.declared_value) || parseFloat(shipmentData.total_amount) || 100
    const invoiceNo = shipmentData.invoice_no || shipmentData.order_id || ''
    const invoiceDate = shipmentData.invoice_date || bookingDate

    const originCode = shipmentData.origin_code || toIsoCountryCode(shipmentData.sender_country) || 'IN'
    const destCode = shipmentData.destination_code || toIsoCountryCode(shipmentData.receiver_country || shipmentData.buyer_country_code || shipmentData.buyer_destination_code) || ''

    // Parse parcels for multi-box dimensions
    let parcelsList = []
    if (shipmentData.parcels) {
      try {
        parcelsList = typeof shipmentData.parcels === 'string' ? JSON.parse(shipmentData.parcels) : shipmentData.parcels
      } catch {}
    }
    if (!Array.isArray(parcelsList)) parcelsList = []

    // Build docket_items array from shipment dimensions (or parcels if multi-box)
    const docketItems = []
    const numPieces = parseInt(shipmentData.no_of_pieces) || (parcelsList.length > 0 ? parcelsList.length : 1)
    const totalActualWeight = parcelsList.length > 0
      ? parcelsList.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0)
      : weight
    const perPieceWeight = String(numPieces > 0 ? (Math.round((totalActualWeight / numPieces) * 1000) / 1000) : totalActualWeight)

    if (parcelsList.length > 0) {
      parcelsList.forEach((p, idx) => {
        docketItems.push({
          actual_weight: String(parseFloat(p.weight) || perPieceWeight || 0.5),
          length: String(parseFloat(p.length || shipmentData.length) || 1),
          width: String(parseFloat(p.breadth || p.width || shipmentData.breadth) || 1),
          height: String(parseFloat(p.height || shipmentData.height) || 1),
          number_of_boxes: String(p.number_of_boxes || '1')
        })
      })
    } else {
      for (let i = 0; i < numPieces; i++) {
        docketItems.push({
          actual_weight: perPieceWeight,
          length: String(parseFloat(shipmentData.length) || 1),
          width: String(parseFloat(shipmentData.breadth) || 1),
          height: String(parseFloat(shipmentData.height) || 1),
          number_of_boxes: '1'
        })
      }
    }

    // Parse invoice items for free_form_line_items
    let invoiceItemsList = []
    if (shipmentData.invoice_items) {
      try {
        invoiceItemsList = typeof shipmentData.invoice_items === 'string' ? JSON.parse(shipmentData.invoice_items) : shipmentData.invoice_items
      } catch {}
    }
    if (!Array.isArray(invoiceItemsList)) invoiceItemsList = []

    const itemDescriptions = invoiceItemsList.map(item => item.description).filter(Boolean)
    const derivedContent = itemDescriptions.length > 0 ? itemDescriptions.join(', ') : ''
    
    // Resolve exact content description
    let contentDescription = ''
    if (shipmentData.content_description && !['general goods', 'items / goods inside', 'goods'].includes(shipmentData.content_description.trim().toLowerCase())) {
      contentDescription = shipmentData.content_description.trim()
    } else if (derivedContent) {
      contentDescription = derivedContent
    } else if (shipmentData.content_description) {
      contentDescription = shipmentData.content_description.trim()
    } else {
      contentDescription = 'Books'
    }

    // Build free_form_line_items (required by FlySwift for invoice)
    const perItemValue = numPieces > 0 ? (Math.round((declaredValue / numPieces) * 100) / 100).toFixed(2) : declaredValue.toFixed(2)
    const freeFormLineItems = []

    if (invoiceItemsList.length > 0) {
      invoiceItemsList.forEach((item, idx) => {
        const qty = String(parseFloat(item.quantity) || 1)
        const unitRate = parseFloat(item.unit_rates || item.cost || item.rate || 0) || 0
        const totalItemAmount = parseFloat(item.amount) || (parseFloat(qty) * unitRate) || 0
        const itemWeight = String(parseFloat(item.unit_weight) || 0)
        const boxNoClean = String(item.box_no || (idx + 1)).replace(/^box-?/i, '')

        freeFormLineItems.push({
          total: totalItemAmount > 0 ? totalItemAmount.toFixed(2) : (unitRate > 0 ? (unitRate * parseFloat(qty)).toFixed(2) : '0.00'),
          no_of_packages: qty,
          box_no: boxNoClean,
          rate: unitRate > 0 ? unitRate.toFixed(2) : (parseFloat(qty) > 0 && totalItemAmount > 0 ? (totalItemAmount / parseFloat(qty)).toFixed(2) : '0.00'),
          hscode: item.hs_code || item.hscode || shipmentData.hs_code || '',
          description: item.description || contentDescription || 'Books',
          unit_of_measurement: item.unit_type || item.unit_of_measurement || 'Pc',
          unit_weight: itemWeight,
          igst_amount: item.igst_amount ? String(item.igst_amount) : '0.00'
        })
      })
    } else {
      for (let i = 0; i < numPieces; i++) {
        freeFormLineItems.push({
          total: perItemValue,
          no_of_packages: '1',
          box_no: String(i + 1),
          rate: perItemValue,
          hscode: shipmentData.hs_code || '',
          description: contentDescription || 'Books',
          unit_of_measurement: 'Pc',
          unit_weight: perPieceWeight,
          igst_amount: '0.00'
        })
      }
    }

    // Default FlySwift / ACX / Bhabani create_docket payload structure
    const payload = {
      tracking_no: shipmentData.tracking_number || shipmentData.order_id || '',
      reference_name: shipmentData.sender_name || shipmentData.order_reference || '',
      origin_code: originCode,
      product_code: shipmentData.product_code || '',
      destination_code: destCode,
      booking_date: bookingDate,
      booking_time: bookingTime,
      pcs: pcs,
      shipment_value: String(declaredValue),
      shipment_value_currency: shipmentData.invoice_currency || 'INR',
      actual_weight: String(totalActualWeight),
      shipment_invoice_no: invoiceNo,
      shipment_invoice_date: invoiceDate,
      shipment_content: contentDescription,
      remark: shipmentData.remarks || '',
      new_docket_free_form_invoice: '1',
      free_form_currency: shipmentData.invoice_currency || 'INR',
      terms_of_trade: shipmentData.terms_of_trade || 'FOB',
      api_service_code: shipmentData.service_code || shipmentData.api_service_code || '',
      api_vendor_code: shipmentData.vendor_code || shipmentData.api_vendor_code || '',

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
      pickup_address_name: shipmentData.pickup_address_name || shipmentData.sender_name || '',
      pickup_address_code: shipmentData.pickup_address_code || shipmentData.sender_company || shipmentData.sender_name || '',
      pickup_address_contact_no: shipmentData.pickup_address_contact_no || shipmentData.sender_phone || '',
      pickup_address_email: shipmentData.pickup_address_email || shipmentData.sender_email || '',
      pickup_address_address_line_1: shipmentData.pickup_address_address_line_1 || shipmentData.sender_address || '',
      pickup_address_address_line_2: shipmentData.pickup_address_address_line_2 || shipmentData.sender_address_2 || '',
      pickup_address_address_line_3: shipmentData.pickup_address_address_line_3 || shipmentData.sender_address_3 || '',
      pickup_address_city: shipmentData.pickup_address_city || shipmentData.sender_city || '',
      pickup_address_state: shipmentData.pickup_address_state || shipmentData.sender_state || '',
      pickup_address_country: originCode,
      pickup_address_zip_code: shipmentData.pickup_address_zip_code || shipmentData.sender_pincode || '',
      pickup_address_gstin_type: shipmentData.pickup_address_gstin_type || shipmentData.sender_gstin_type || '',
      pickup_address_gstin_no: shipmentData.pickup_address_gstin_no || shipmentData.sender_gstin_no || '',

      // DHL-specific fields
      dhl_otp: shipmentData.otp || shipmentData.dhl_otp || '',
      dhl_service: shipmentData.dhl_service || shipmentData.terms_of_trade || 'DDP',

      // Nested arrays
      docket_items: docketItems,
      free_form_line_items: freeFormLineItems,
      kyc_details: (() => {
        if (Array.isArray(shipmentData.kyc_details) && shipmentData.kyc_details.length > 0) {
          return shipmentData.kyc_details
        }
        if (typeof shipmentData.kyc_details === 'string') {
          try {
            const parsed = JSON.parse(shipmentData.kyc_details)
            if (Array.isArray(parsed) && parsed.length > 0) return parsed
          } catch {}
        }
        const kycDocs = []
        const docType = shipmentData.sender_gstin_type || shipmentData.receiver_gstin_type || 'Aadhaar Number'
        const docNo = shipmentData.sender_gstin_no || shipmentData.receiver_gstin_no || ''
        if (docNo) {
          kycDocs.push({
            document_type: docType,
            document_no: docNo,
            document_sub_type: 'doc_1',
            document_name: '',
            file_path: shipmentData.kyc_file_1 || 'https://google.com/media//2024/02/2024-02-03-17-11-341.jpg'
          })
          kycDocs.push({
            document_type: docType,
            document_no: docNo,
            document_sub_type: 'doc_2',
            document_name: '',
            file_path: shipmentData.kyc_file_2 || 'https://google.com/media//2024/02/2024-02-03-17-11-342.jpg'
          })
        }
        return kycDocs
      })(),
      multiple_invoice: (() => {
        if (Array.isArray(shipmentData.multiple_invoice) && shipmentData.multiple_invoice.length > 0) {
          return shipmentData.multiple_invoice
        }
        if (typeof shipmentData.multiple_invoice === 'string') {
          try {
            const parsed = JSON.parse(shipmentData.multiple_invoice)
            if (Array.isArray(parsed) && parsed.length > 0) return parsed
          } catch {}
        }
        const invoices = []
        if (invoiceNo) {
          invoices.push({
            mul_invoice_date: invoiceDate,
            mul_invoice_no: invoiceNo,
            mul_order_no: shipmentData.order_reference || shipmentData.order_id || '',
            mul_currecny: shipmentData.invoice_currency || 'INR',
            mul_invoice_amount: declaredValue > 0 ? declaredValue.toFixed(2) : '0.00',
            mul_eway_bill: shipmentData.eawb_no || ''
          })
        }
        return invoices
      })()
    }

    if (authContext && authContext.customerId) {
      payload.customer_id = authContext.customerId
    }

    return payload
  }

  parseResponse(responseBody) {
    if (!responseBody || typeof responseBody !== 'object') {
      return {
        success: false,
        awbNumber: '',
        trackingUrl: '',
        labelUrl: '',
        errorMessage: 'Invalid or empty response from FlySwift'
      }
    }

    let success = false
    if (this.config.response_success_path) {
      const extracted = this.extractValueByPath(responseBody, this.config.response_success_path)
      if (this.config.response_success_value) {
        success = String(extracted) === String(this.config.response_success_value)
      } else {
        success = Boolean(extracted)
      }
    } else if (responseBody.success !== undefined) {
      success = Boolean(responseBody.success)
    } else if (responseBody.status === true || responseBody.status === 'success' || responseBody.code === 200) {
      success = true
    }

    let awbNumber = ''
    if (this.config.response_tracking_path) {
      awbNumber = this.extractValueByPath(responseBody, this.config.response_tracking_path) || ''
    }

    if (!awbNumber) {
      awbNumber = findAwbInObject(responseBody)
    }

    const trackingUrl = responseBody.data?.tracking_url || responseBody.tracking_url || ''
    let labelUrl = responseBody.data?.label_url || responseBody.label_url || ''

    // If labels array with base64 PDF is present, save the label to disk
    if (!labelUrl && Array.isArray(responseBody.labels) && responseBody.labels.length > 0) {
      const boxLabel = responseBody.labels.find(l => (l.filename && l.filename.includes('label')) || (l.filename && l.filename.includes('box'))) || responseBody.labels[0]
      if (boxLabel && boxLabel.label) {
        try {
          const uploadsDir = path.join(process.cwd(), 'uploads', 'vendor_labels')
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true })
          }
          const labelFileName = `vendor_label_${awbNumber || Date.now()}.pdf`
          const labelFilePath = path.join(uploadsDir, labelFileName)
          fs.writeFileSync(labelFilePath, Buffer.from(boxLabel.label, 'base64'))
          labelUrl = `/uploads/vendor_labels/${labelFileName}`
        } catch (labelErr) {
          console.error('Failed to save vendor label PDF:', labelErr.message)
        }
      }
    }

    const errorMessage = !success
      ? (responseBody.message || responseBody.error || (Array.isArray(responseBody.errors) ? responseBody.errors.join(', ') : 'FlySwift API Error'))
      : ''

    return {
      success,
      awbNumber: String(awbNumber).trim(),
      trackingUrl,
      labelUrl,
      errorMessage
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
