import { query, execute } from '../../config/db.js'
import generateTracking from '../../utils/generateTracking.js'
import { pushShipmentToVendor } from '../../services/vendorApiPush.service.js'
import { generateInvoicePdf } from '../../services/invoicePdf.service.js'
import { generateWaybillPdf } from '../../services/waybillPdf.service.js'
import { generateBoxLabelsPdf } from '../../services/boxLabelPdf.service.js'
import { syncToRemoteAwbEntry, syncToRemoteParcelHistory } from '../../services/remoteAwbEntry.service.js'
import { isSettingEnabled } from '../systemSettings/systemSettings.controller.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Extract all booking fields from request body.
 * Shared between saveBooking and createBooking.
 */
function extractBookingFields(body) {
  return {
    id: body.id,
    sender_id: body.sender_id,
    receiver_id: body.receiver_id,
    courier_provider_id: body.courier_provider_id,
    vendor_config_id: body.vendor_config_id,
    vendor_code: body.vendor_code,
    service_code: body.service_code,
    product_code: body.product_code,
    weight: body.weight,
    chargeable_weight: body.chargeable_weight,
    length: body.length,
    breadth: body.breadth,
    height: body.height,
    payment_mode: body.payment_mode,
    package_type: body.package_type,
    total_amount: body.total_amount,
    shipping_charge: body.shipping_charge,
    rate_per_kg: body.rate_per_kg,
    extra_charge: body.extra_charge,
    final_chargeable_weight: body.final_chargeable_weight,
    order_reference: body.order_reference,
    remarks: body.remarks,
    // Inline sender/receiver
    sender_name: body.sender_name,
    sender_email: body.sender_email,
    sender_phone: body.sender_phone,
    sender_phone_2: body.sender_phone_2 || body.sender_phone2 || '',
    sender_address: body.sender_address,
    sender_city: body.sender_city,
    sender_pincode: body.sender_pincode,
    sender_state: body.sender_state,
    sender_country: body.sender_country,
    receiver_name: body.receiver_name,
    receiver_email: body.receiver_email,
    receiver_phone: body.receiver_phone,
    receiver_phone_2: body.receiver_phone_2 || body.receiver_phone2 || '',
    receiver_address: body.receiver_address,
    receiver_city: body.receiver_city,
    receiver_pincode: body.receiver_pincode,
    receiver_state: body.receiver_state,
    receiver_country: body.receiver_country,
    // Additional
    no_of_pieces: body.no_of_pieces,
    content_description: body.content_description,
    declared_value: body.declared_value,
    cod_amount: body.cod_amount,
    // Extended
    sender_company: body.sender_company,
    sender_address_2: body.sender_address_2,
    sender_gstin_type: body.sender_gstin_type,
    sender_gstin_no: body.sender_gstin_no,
    receiver_company: body.receiver_company,
    receiver_address_2: body.receiver_address_2,
    receiver_gstin_type: body.receiver_gstin_type,
    receiver_gstin_no: body.receiver_gstin_no,
    invoice_no: body.invoice_no,
    invoice_date: body.invoice_date,
    invoice_currency: body.invoice_currency,
    hs_code: body.hs_code,
    export_reason: body.export_reason,
    terms_of_trade: body.terms_of_trade,
    // eAWB
    eawb_no: body.eawb_no,
    eawb_date: body.eawb_date,
    eawb_exp_date: body.eawb_exp_date,
    // Additional Charges
    additional_discount: body.additional_discount,
    additional_freight: body.additional_freight,
    additional_insurance: body.additional_insurance,
    additional_other_charges: body.additional_other_charges,
    additional_specify_charges: body.additional_specify_charges,
    // Buyer Details
    buyer_name: body.buyer_name,
    buyer_person_type: body.buyer_person_type,
    buyer_address1: body.buyer_address1,
    buyer_address2: body.buyer_address2,
    buyer_pincode: body.buyer_pincode,
    buyer_city: body.buyer_city,
    buyer_state: body.buyer_state,
    buyer_telephone: body.buyer_telephone,
    buyer_mobile: body.buyer_mobile,
    buyer_email: body.buyer_email,
    buyer_country_code: body.buyer_country_code,
    buyer_destination_code: body.buyer_destination_code,
    buyer_iec_no: body.buyer_iec_no,
    // GST & Manifest
    gst_invoice: body.gst_invoice,
    lut_igst: body.lut_igst,
    total_igst: body.total_igst,
    bank_ad_code: body.bank_ad_code,
    bank_account: body.bank_account,
    bank_ifsc: body.bank_ifsc,
    lut_number: body.lut_number,
    exchange_rate: body.exchange_rate,
    manifest_firm: body.manifest_firm,
    manifest_nfei: body.manifest_nfei,
    pay_of_igst: body.pay_of_igst,
    manifest_ecommerce: body.manifest_ecommerce,
    meis_scheme: body.meis_scheme,
    manifest_format: body.manifest_format,
    manifest_iec_no: body.manifest_iec_no,
    lut_issue_date: body.lut_issue_date,
    lut_till_date: body.lut_till_date,
    // Advanced Config
    company_code: body.company_code,
    is_commercial: body.is_commercial,
    csb_type: body.csb_type,
    otp: body.otp,
    lsp_type: body.lsp_type,
    required_performa: body.required_performa,
    required_label: body.required_label,
    // Parcels (JSON array of multi-box dimensions)
    parcels: body.parcels,
    // Invoice items (JSON array)
    invoice_items: body.invoice_items,
    invoice_type: body.invoice_type,
    invoice_note: body.invoice_note
  }
}

/**
 * Resolve full snapshot fields for sender and receiver so that deleting a contact from
 * the address book never causes shipment booking details to disappear.
 */
async function prepareSnapshotFields(fields, finalSenderId, finalReceiverId) {
  let sender_name = fields.sender_name || ''
  let sender_company = fields.sender_company || ''
  let sender_phone = fields.sender_phone || ''
  let sender_phone_2 = fields.sender_phone_2 || ''
  let sender_email = fields.sender_email || ''
  let sender_address = fields.sender_address || ''
  let sender_address_2 = fields.sender_address_2 || ''
  let sender_city = fields.sender_city || ''
  let sender_state = fields.sender_state || ''
  let sender_pincode = fields.sender_pincode || ''
  let sender_country = fields.sender_country || 'INDIA'
  let sender_gstin_type = fields.sender_gstin_type || ''
  let sender_gstin_no = fields.sender_gstin_no || ''

  if (finalSenderId && (!sender_name || !sender_city)) {
    try {
      const sRows = await query('SELECT * FROM senders WHERE id = ?', [finalSenderId])
      if (sRows.length > 0) {
        const s = sRows[0]
        sender_name = sender_name || s.name || ''
        sender_company = sender_company || s.company || ''
        sender_phone = sender_phone || s.phone || ''
        sender_phone_2 = sender_phone_2 || s.phone_2 || ''
        sender_email = sender_email || s.email || ''
        sender_address = sender_address || s.address || ''
        sender_address_2 = sender_address_2 || s.address_2 || ''
        sender_city = sender_city || s.city || ''
        sender_state = sender_state || s.state || ''
        sender_pincode = sender_pincode || s.pincode || ''
        sender_country = sender_country || s.country || 'INDIA'
        sender_gstin_type = sender_gstin_type || s.gstin_type || ''
        sender_gstin_no = sender_gstin_no || s.gstin_no || ''
      }
    } catch { }
  }

  let receiver_name = fields.receiver_name || ''
  let receiver_company = fields.receiver_company || ''
  let receiver_phone = fields.receiver_phone || ''
  let receiver_phone_2 = fields.receiver_phone_2 || ''
  let receiver_email = fields.receiver_email || ''
  let receiver_address = fields.receiver_address || ''
  let receiver_address_2 = fields.receiver_address_2 || ''
  let receiver_city = fields.receiver_city || ''
  let receiver_state = fields.receiver_state || ''
  let receiver_pincode = fields.receiver_pincode || ''
  let receiver_country = fields.receiver_country || ''
  let receiver_gstin_type = fields.receiver_gstin_type || ''
  let receiver_gstin_no = fields.receiver_gstin_no || ''

  if (finalReceiverId && (!receiver_name || !receiver_city)) {
    try {
      const rRows = await query('SELECT * FROM receivers WHERE id = ?', [finalReceiverId])
      if (rRows.length > 0) {
        const r = rRows[0]
        receiver_name = receiver_name || r.name || ''
        receiver_company = receiver_company || r.company || ''
        receiver_phone = receiver_phone || r.phone || ''
        receiver_phone_2 = receiver_phone_2 || r.phone_2 || ''
        receiver_email = receiver_email || r.email || ''
        receiver_address = receiver_address || r.address || ''
        receiver_address_2 = receiver_address_2 || r.address_2 || ''
        receiver_city = receiver_city || r.city || ''
        receiver_state = receiver_state || r.state || ''
        receiver_pincode = receiver_pincode || r.pincode || ''
        receiver_country = receiver_country || r.country || ''
        receiver_gstin_type = receiver_gstin_type || r.gstin_type || ''
        receiver_gstin_no = receiver_gstin_no || r.gstin_no || ''
      }
    } catch { }
  }

  return {
    sender_name, sender_company, sender_phone, sender_phone_2, sender_email, sender_address, sender_address_2,
    sender_city, sender_state, sender_pincode, sender_country, sender_gstin_type, sender_gstin_no,
    receiver_name, receiver_company, receiver_phone, receiver_phone_2, receiver_email, receiver_address, receiver_address_2,
    receiver_city, receiver_state, receiver_pincode, receiver_country, receiver_gstin_type, receiver_gstin_no
  }
}

/**
 * Upsert sender if inline fields provided (deduplicates by name)
 */
async function upsertSender(fields) {
  if (fields.sender_id) {
    if (fields.sender_name) {
      await execute(
        `UPDATE senders SET name = ?, company = ?, email = ?, phone = ?, phone_2 = ?, address = ?, address_2 = ?, city = ?, pincode = ?, state = ?, country = ?, gstin_type = ?, gstin_no = ? WHERE id = ?`,
        [
          fields.sender_name,
          fields.sender_company || '',
          fields.sender_email || '',
          fields.sender_phone || '',
          fields.sender_phone_2 || '',
          fields.sender_address || '',
          fields.sender_address_2 || '',
          fields.sender_city || '',
          fields.sender_pincode || '',
          fields.sender_state || '',
          fields.sender_country || 'INDIA',
          fields.sender_gstin_type || '',
          fields.sender_gstin_no || '',
          fields.sender_id
        ]
      )
    }
    return fields.sender_id
  }
  if (!fields.sender_name) return null

  // Check if sender already exists with same name to prevent duplicates
  const existing = await query(
    `SELECT id FROM senders WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
    [fields.sender_name]
  )
  if (existing && existing.length > 0) {
    await execute(
      `UPDATE senders SET company = ?, email = ?, phone = ?, phone_2 = ?, address = ?, address_2 = ?, city = ?, pincode = ?, state = ?, country = ?, gstin_type = ?, gstin_no = ? WHERE id = ?`,
      [
        fields.sender_company || '',
        fields.sender_email || '',
        fields.sender_phone || '',
        fields.sender_phone_2 || '',
        fields.sender_address || '',
        fields.sender_address_2 || '',
        fields.sender_city || '',
        fields.sender_pincode || '',
        fields.sender_state || '',
        fields.sender_country || 'INDIA',
        fields.sender_gstin_type || '',
        fields.sender_gstin_no || '',
        existing[0].id
      ]
    )
    return existing[0].id
  }

  const result = await execute(
    `INSERT INTO senders (name, company, email, phone, phone_2, address, address_2, city, pincode, state, country, gstin_type, gstin_no)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fields.sender_name,
      fields.sender_company || '',
      fields.sender_email || '',
      fields.sender_phone || '',
      fields.sender_phone_2 || '',
      fields.sender_address || '',
      fields.sender_address_2 || '',
      fields.sender_city || '',
      fields.sender_pincode || '',
      fields.sender_state || '',
      fields.sender_country || 'INDIA',
      fields.sender_gstin_type || '',
      fields.sender_gstin_no || ''
    ]
  )
  return result.insertId
}

/**
 * Upsert receiver if inline fields provided (deduplicates by name)
 */
async function upsertReceiver(fields) {
  if (fields.receiver_id) {
    if (fields.receiver_name) {
      await execute(
        `UPDATE receivers SET name = ?, company = ?, email = ?, phone = ?, phone_2 = ?, address = ?, address_2 = ?, city = ?, pincode = ?, state = ?, country = ?, gstin_type = ?, gstin_no = ? WHERE id = ?`,
        [
          fields.receiver_name,
          fields.receiver_company || '',
          fields.receiver_email || '',
          fields.receiver_phone || '',
          fields.receiver_phone_2 || '',
          fields.receiver_address || '',
          fields.receiver_address_2 || '',
          fields.receiver_city || '',
          fields.receiver_pincode || '',
          fields.receiver_state || '',
          fields.receiver_country || '',
          fields.receiver_gstin_type || '',
          fields.receiver_gstin_no || '',
          fields.receiver_id
        ]
      )
    }
    return fields.receiver_id
  }
  if (!fields.receiver_name) return null

  // Check if receiver already exists with same name to prevent duplicates
  const existing = await query(
    `SELECT id FROM receivers WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
    [fields.receiver_name]
  )
  if (existing && existing.length > 0) {
    await execute(
      `UPDATE receivers SET company = ?, email = ?, phone = ?, phone_2 = ?, address = ?, address_2 = ?, city = ?, pincode = ?, state = ?, country = ?, gstin_type = ?, gstin_no = ? WHERE id = ?`,
      [
        fields.receiver_company || '',
        fields.receiver_email || '',
        fields.receiver_phone || '',
        fields.receiver_phone_2 || '',
        fields.receiver_address || '',
        fields.receiver_address_2 || '',
        fields.receiver_city || '',
        fields.receiver_pincode || '',
        fields.receiver_state || '',
        fields.receiver_country || '',
        fields.receiver_gstin_type || '',
        fields.receiver_gstin_no || '',
        existing[0].id
      ]
    )
    return existing[0].id
  }

  const result = await execute(
    `INSERT INTO receivers (name, company, email, phone, phone_2, address, address_2, city, pincode, state, country, gstin_type, gstin_no)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fields.receiver_name,
      fields.receiver_company || '',
      fields.receiver_email || '',
      fields.receiver_phone || '',
      fields.receiver_phone_2 || '',
      fields.receiver_address || '',
      fields.receiver_address_2 || '',
      fields.receiver_city || '',
      fields.receiver_pincode || '',
      fields.receiver_state || '',
      fields.receiver_country || '',
      fields.receiver_gstin_type || '',
      fields.receiver_gstin_no || ''
    ]
  )
  return result.insertId
}

/**
 * Generate invoice PDF for a booking.
 */
async function generateInvoiceForBooking(trackingNumber, fields, senderId, receiverId) {
  const invoiceItems = Array.isArray(fields.invoice_items)
    ? fields.invoice_items
    : (typeof fields.invoice_items === 'string' ? JSON.parse(fields.invoice_items || '[]') : [])

  // Fetch sender/receiver details if we have IDs
  let senderData = {}
  let receiverData = {}

  if (senderId) {
    const sRows = await query('SELECT * FROM senders WHERE id = ?', [senderId])
    if (sRows.length > 0) {
      senderData = {
        name: sRows[0].name,
        phone: sRows[0].phone,
        email: sRows[0].email,
        address: sRows[0].address,
        city: sRows[0].city,
        state: sRows[0].state,
        pincode: sRows[0].pincode,
        country: sRows[0].country
      }
    }
  }
  // Override with inline fields
  senderData = {
    ...senderData,
    name: fields.sender_name || senderData.name || '',
    company: fields.sender_company || '',
    phone: fields.sender_phone || senderData.phone || '',
    email: fields.sender_email || senderData.email || '',
    address: fields.sender_address || senderData.address || '',
    address_2: fields.sender_address_2 || '',
    city: fields.sender_city || senderData.city || '',
    state: fields.sender_state || senderData.state || '',
    pincode: fields.sender_pincode || senderData.pincode || '',
    country: fields.sender_country || senderData.country || 'INDIA',
    gstin_type: fields.sender_gstin_type || '',
    gstin_no: fields.sender_gstin_no || ''
  }

  if (receiverId) {
    const rRows = await query('SELECT * FROM receivers WHERE id = ?', [receiverId])
    if (rRows.length > 0) {
      receiverData = {
        name: rRows[0].name,
        phone: rRows[0].phone,
        email: rRows[0].email,
        address: rRows[0].address,
        city: rRows[0].city,
        state: rRows[0].state,
        pincode: rRows[0].pincode,
        country: rRows[0].country
      }
    }
  }
  receiverData = {
    ...receiverData,
    name: fields.receiver_name || receiverData.name || '',
    company: fields.receiver_company || '',
    phone: fields.receiver_phone || receiverData.phone || '',
    email: fields.receiver_email || receiverData.email || '',
    address: fields.receiver_address || receiverData.address || '',
    address_2: fields.receiver_address_2 || '',
    city: fields.receiver_city || receiverData.city || '',
    state: fields.receiver_state || receiverData.state || '',
    pincode: fields.receiver_pincode || receiverData.pincode || '',
    country: fields.receiver_country || receiverData.country || ''
  }

  const pdfPath = await generateInvoicePdf({
    awbNumber: trackingNumber,
    sender: senderData,
    receiver: receiverData,
    shipment: {
      weight: fields.weight,
      length: fields.length,
      breadth: fields.breadth,
      height: fields.height,
      no_of_pieces: fields.no_of_pieces,
      package_type: fields.package_type
    },
    invoiceItems,
    invoiceMeta: {
      invoice_type: fields.invoice_type || 'INVOICE',
      currency: fields.invoice_currency || 'INR',
      incoterms: fields.terms_of_trade || 'CIF',
      note: fields.invoice_note || fields.export_reason || '',
      total_amount: fields.total_amount || fields.declared_value || 0
    }
  })

  return pdfPath
}

/**
 * Build flat shipment data object for the vendor adapter
 */
function buildVendorShipmentData(fields, orderId, trackingNumber) {
  const currentDate = new Date().toISOString().split('T')[0]
  const currentTime = new Date().toTimeString().split(' ')[0]

  let invoiceItemsList = []
  if (fields.invoice_items) {
    try {
      invoiceItemsList = typeof fields.invoice_items === 'string' ? JSON.parse(fields.invoice_items) : fields.invoice_items
    } catch { }
  }
  if (!Array.isArray(invoiceItemsList)) invoiceItemsList = []

  const itemDescriptions = invoiceItemsList.map(i => i.description).filter(Boolean)
  const derivedContent = itemDescriptions.length > 0 ? itemDescriptions.join(', ') : ''

  let contentDescription = ''
  if (fields.content_description && !['general goods', 'items / goods inside', 'goods'].includes(fields.content_description.trim().toLowerCase())) {
    contentDescription = fields.content_description.trim()
  } else if (derivedContent) {
    contentDescription = derivedContent
  } else if (fields.content_description) {
    contentDescription = fields.content_description.trim()
  } else {
    contentDescription = 'Books'
  }

  let parcelsList = []
  if (fields.parcels) {
    try {
      parcelsList = typeof fields.parcels === 'string' ? JSON.parse(fields.parcels) : fields.parcels
    } catch { }
  }
  if (!Array.isArray(parcelsList)) parcelsList = []

  let totalWeight = parseFloat(fields.weight) || 0
  let totalLength = parseFloat(fields.length) || 0
  let totalBreadth = parseFloat(fields.breadth) || 0
  let totalHeight = parseFloat(fields.height) || 0
  let noOfPieces = parseInt(fields.no_of_pieces) || 1

  if (parcelsList.length > 0) {
    const sumPWeight = parcelsList.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0)
    if (sumPWeight > 0) totalWeight = Math.round(sumPWeight * 1000) / 1000
    if (parcelsList.length > noOfPieces) noOfPieces = parcelsList.length
    if (totalLength <= 0 && parcelsList[0]?.length) totalLength = parseFloat(parcelsList[0].length) || 0
    if (totalBreadth <= 0 && (parcelsList[0]?.breadth || parcelsList[0]?.width)) totalBreadth = parseFloat(parcelsList[0].breadth || parcelsList[0].width) || 0
    if (totalHeight <= 0 && parcelsList[0]?.height) totalHeight = parseFloat(parcelsList[0].height) || 0
  }

  // Chargeable weight rounded off / ceiled
  let chargeableWeight = parseFloat(fields.final_chargeable_weight) || parseFloat(fields.chargeable_weight) || 0
  if (!chargeableWeight) {
    if (parcelsList.length > 0) {
      chargeableWeight = parcelsList.reduce((sum, p) => {
        const act = parseFloat(p.weight) || 0
        const l = parseFloat(p.length) || 0
        const b = parseFloat(p.breadth || p.width) || 0
        const h = parseFloat(p.height) || 0
        const vol = (l > 0 && b > 0 && h > 0) ? (l * b * h) / 5000 : 0
        return sum + Math.ceil(parseFloat(p.chargeable_weight) || Math.max(act, vol))
      }, 0)
    } else {
      let vol = 0
      if (totalLength > 0 && totalBreadth > 0 && totalHeight > 0) {
        vol = (totalLength * totalBreadth * totalHeight) / 5000
      }
      chargeableWeight = Math.ceil(Math.max(totalWeight, vol))
    }
  }

  return {
    order_id: orderId,
    tracking_number: trackingNumber,
    reference_number: trackingNumber, // Our AWB as reference number
    order_reference: fields.order_reference || '',
    weight: totalWeight,
    length: totalLength,
    breadth: totalBreadth,
    height: totalHeight,
    no_of_pieces: noOfPieces,
    package_type: fields.package_type || 'parcel',
    payment_mode: fields.payment_mode || 'prepaid',
    shipping_charge: parseFloat(fields.shipping_charge) || parseFloat(fields.total_amount) || parseFloat(fields.declared_value) || 0,
    total_amount: parseFloat(fields.total_amount) || parseFloat(fields.shipping_charge) || parseFloat(fields.declared_value) || 0,
    declared_value: parseFloat(fields.declared_value) || 0,
    content_description: contentDescription,
    cod_amount: parseFloat(fields.cod_amount) || 0,
    remarks: fields.remarks || '',
    vendor_code: fields.vendor_code || '',
    service_code: fields.service_code || '',
    product_code: fields.product_code || '',
    booking_date: currentDate,
    booking_time: currentTime,
    // Sender
    sender_name: fields.sender_name || '',
    sender_email: fields.sender_email || '',
    sender_phone: fields.sender_phone || '',
    sender_address: fields.sender_address || '',
    sender_city: fields.sender_city || '',
    sender_state: fields.sender_state || '',
    sender_pincode: fields.sender_pincode || '',
    sender_country: fields.sender_country || 'INDIA',
    sender_company: fields.sender_company || '',
    sender_address_2: fields.sender_address_2 || '',
    sender_address_3: fields.sender_address_3 || '',
    sender_gstin_type: fields.sender_gstin_type || '',
    sender_gstin_no: fields.sender_gstin_no || '',
    // Receiver
    receiver_name: fields.receiver_name || '',
    receiver_email: fields.receiver_email || '',
    receiver_phone: fields.receiver_phone || '',
    receiver_address: fields.receiver_address || '',
    receiver_city: fields.receiver_city || '',
    receiver_state: fields.receiver_state || '',
    receiver_pincode: fields.receiver_pincode || '',
    receiver_country: fields.receiver_country || 'INDIA',
    receiver_company: fields.receiver_company || '',
    receiver_address_2: fields.receiver_address_2 || '',
    receiver_address_3: fields.receiver_address_3 || '',
    receiver_gstin_type: fields.receiver_gstin_type || '',
    receiver_gstin_no: fields.receiver_gstin_no || '',
    // Invoice
    invoice_no: fields.invoice_no || '',
    invoice_date: fields.invoice_date || '',
    invoice_currency: fields.invoice_currency || 'INR',
    hs_code: fields.hs_code || '',
    export_reason: fields.export_reason || '',
    terms_of_trade: fields.terms_of_trade || 'FOB',
    // eAWB
    eawb_no: fields.eawb_no || '',
    eawb_date: fields.eawb_date || '',
    eawb_exp_date: fields.eawb_exp_date || '',
    // Additional Charges
    additional_discount: fields.additional_discount || '',
    additional_freight: fields.additional_freight || '',
    additional_insurance: fields.additional_insurance || '',
    additional_other_charges: fields.additional_other_charges || '',
    additional_specify_charges: fields.additional_specify_charges || '',
    // Buyer Details
    buyer_name: fields.buyer_name || '',
    buyer_person_type: fields.buyer_person_type || '',
    buyer_address1: fields.buyer_address1 || '',
    buyer_address2: fields.buyer_address2 || '',
    buyer_pincode: fields.buyer_pincode || '',
    buyer_city: fields.buyer_city || '',
    buyer_state: fields.buyer_state || '',
    buyer_telephone: fields.buyer_telephone || '',
    buyer_mobile: fields.buyer_mobile || '',
    buyer_email: fields.buyer_email || '',
    buyer_country_code: fields.buyer_country_code || '',
    buyer_destination_code: fields.buyer_destination_code || '',
    buyer_iec_no: fields.buyer_iec_no || '',
    // GST & Manifest
    gst_invoice: fields.gst_invoice || '',
    lut_igst: fields.lut_igst || '',
    total_igst: fields.total_igst || '',
    bank_ad_code: fields.bank_ad_code || '',
    bank_account: fields.bank_account || '',
    bank_ifsc: fields.bank_ifsc || '',
    lut_number: fields.lut_number || '',
    exchange_rate: fields.exchange_rate || '',
    manifest_firm: fields.manifest_firm || '',
    manifest_nfei: fields.manifest_nfei || '',
    pay_of_igst: fields.pay_of_igst || '',
    manifest_ecommerce: fields.manifest_ecommerce || '',
    meis_scheme: fields.meis_scheme || '',
    manifest_format: fields.manifest_format || '',
    manifest_iec_no: fields.manifest_iec_no || '',
    lut_issue_date: fields.lut_issue_date || '',
    lut_till_date: fields.lut_till_date || '',
    // Advanced
    company_code: fields.company_code || '',
    is_commercial: fields.is_commercial ?? '',
    csb_type: fields.csb_type || '',
    otp: fields.otp || '',
    lsp_type: fields.lsp_type || '',
    required_performa: fields.required_performa || '',
    required_label: fields.required_label || '',
    // Parcels & Invoice Items
    parcels: parcelsList,
    invoice_items: invoiceItemsList,
    kyc_details: fields.kyc_details,
    multiple_invoice: fields.multiple_invoice,
    chargeable_weight: chargeableWeight,
    final_chargeable_weight: chargeableWeight
  }
}


// ═══════════════════════════════════════════════════════════════
//  SAVE BOOKING (Draft — no vendor API push)
// ═══════════════════════════════════════════════════════════════

function validateAadhaarDoc(type, number) {
  if (type && /aadhaar|aadhar/i.test(type)) {
    const clean = (number || '').toString().replace(/\D/g, '')
    if (clean.length !== 12) {
      return false
    }
  }
  return true
}

export const saveBooking = async (req, res) => {
  try {
    const fields = extractBookingFields(req.body)

    if (!validateAadhaarDoc(fields.sender_gstin_type, fields.sender_gstin_no)) {
      return res.status(400).json({ success: false, message: 'Aadhaar number must be exactly 12 digits' })
    }
    if (!validateAadhaarDoc(fields.receiver_gstin_type, fields.receiver_gstin_no)) {
      return res.status(400).json({ success: false, message: 'Receiver Aadhaar number must be exactly 12 digits' })
    }

    const existingId = req.body.id || req.body.shipment_id

    // Upsert sender/receiver
    const finalSenderId = await upsertSender(fields)
    const finalReceiverId = await upsertReceiver(fields)

    // Parse invoice items and parcels
    const invoiceItemsJson = Array.isArray(fields.invoice_items)
      ? JSON.stringify(fields.invoice_items)
      : (fields.invoice_items || '[]')

    const parsedInvoiceItems = Array.isArray(fields.invoice_items)
      ? fields.invoice_items
      : (typeof fields.invoice_items === 'string' ? (JSON.parse(fields.invoice_items || '[]') || []) : [])
    const itemDescriptions = Array.isArray(parsedInvoiceItems) ? parsedInvoiceItems.map(i => i.description).filter(Boolean) : []
    const derivedContent = itemDescriptions.length > 0 ? itemDescriptions.join(', ') : ''
    let contentDescription = ''
    if (fields.content_description && !['general goods', 'items / goods inside', 'goods'].includes(fields.content_description.trim().toLowerCase())) {
      contentDescription = fields.content_description.trim()
    } else if (derivedContent) {
      contentDescription = derivedContent
    } else if (fields.content_description) {
      contentDescription = fields.content_description.trim()
    } else {
      contentDescription = 'Books'
    }

    const parcelsJson = Array.isArray(fields.parcels)
      ? JSON.stringify(fields.parcels)
      : (typeof fields.parcels === 'string' ? fields.parcels : null)

    const parsedParcelsList = Array.isArray(fields.parcels)
      ? fields.parcels
      : (typeof fields.parcels === 'string' ? (JSON.parse(fields.parcels || '[]') || []) : [])

    let finalWeight = parseFloat(fields.weight) || 0
    let finalLength = parseFloat(fields.length) || 0
    let finalBreadth = parseFloat(fields.breadth) || 0
    let finalHeight = parseFloat(fields.height) || 0
    let finalPieces = parseInt(fields.no_of_pieces) || 1

    if (parsedParcelsList.length > 0) {
      const sumPWeight = parsedParcelsList.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0)
      if (sumPWeight > 0) finalWeight = Math.round(sumPWeight * 1000) / 1000
      if (parsedParcelsList.length > finalPieces) finalPieces = parsedParcelsList.length
      if (finalLength <= 0 && parsedParcelsList[0]?.length) finalLength = parseFloat(parsedParcelsList[0].length) || 0
      if (finalBreadth <= 0 && (parsedParcelsList[0]?.breadth || parsedParcelsList[0]?.width)) finalBreadth = parseFloat(parsedParcelsList[0].breadth || parsedParcelsList[0].width) || 0
      if (finalHeight <= 0 && parsedParcelsList[0]?.height) finalHeight = parseFloat(parsedParcelsList[0].height) || 0
    }

    const finalChgWeight = parsedParcelsList.length > 1
      ? parsedParcelsList.reduce((sum, p) => {
        const act = parseFloat(p.weight) || 0
        const l = parseFloat(p.length) || 0
        const b = parseFloat(p.breadth || p.width) || 0
        const h = parseFloat(p.height) || 0
        const vol = (l > 0 && b > 0 && h > 0) ? (l * b * h) / 5000 : 0
        return sum + Math.ceil(parseFloat(p.chargeable_weight) || Math.max(act, vol))
      }, 0)
      : (parseFloat(fields.chargeable_weight) ? Math.ceil(parseFloat(fields.chargeable_weight)) : Math.ceil(finalWeight) || 0)

    const snap = await prepareSnapshotFields(fields, finalSenderId, finalReceiverId)

    let shipmentId
    let tracking_number

    if (existingId) {
      // Check if existing shipment is locked
      const existing = await query('SELECT * FROM shipments WHERE id = ?', [existingId])
      if (existing.length === 0) {
        return res.status(404).json({ success: false, message: 'Shipment not found' })
      }
      if (existing[0].is_locked) {
        const allowed = await isSettingEnabled('allow_post_push_billing_edit', true)
        if (!allowed) {
          return res.status(400).json({ success: false, message: 'This shipment is locked and cannot be edited.' })
        }

        // Post-push billing edit mode: Update only the billing fields & remote AWBENTRY
        const finalChgWt = parseFloat(fields.final_chargeable_weight) || parseFloat(fields.chargeable_weight) || 0
        const ratePerKg = parseFloat(fields.rate_per_kg) || 0
        const shippingCharge = parseFloat(fields.shipping_charge) || 0
        const extraCharge = parseFloat(fields.extra_charge) || 0
        const totalAmount = parseFloat(fields.total_amount) || (shippingCharge + extraCharge)

        await execute(
          `UPDATE shipments SET
            final_chargeable_weight = ?,
            chargeable_weight = ?,
            rate_per_kg = ?,
            shipping_charge = ?,
            extra_charge = ?,
            total_amount = ?
           WHERE id = ?`,
          [
            finalChgWt,
            finalChgWt > 0 ? Math.ceil(finalChgWt) : 0,
            ratePerKg,
            shippingCharge,
            extraCharge,
            totalAmount,
            existingId
          ]
        )

        const updatedRows = await query(
          `SELECT s.*, 
            snd.name as s_name, snd.email as s_email, snd.phone as s_phone, 
            snd.address as s_address, snd.city as s_city, snd.state as s_state,
            snd.pincode as s_pincode, snd.country as s_country,
            rcv.name as r_name, rcv.email as r_email, rcv.phone as r_phone,
            rcv.address as r_address, rcv.city as r_city, rcv.state as r_state,
            rcv.pincode as r_pincode, rcv.country as r_country,
            vac.name as vendor_name, vac.vendor_code as vac_vendor_code,
            vac.auth_credentials as vac_auth_credentials, vac.available_services as vac_services
           FROM shipments s
           LEFT JOIN senders snd ON s.sender_id = snd.id
           LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
           LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
           WHERE s.id = ?`,
          [existingId]
        )
        const updatedShipment = updatedRows[0] || {}
        try {
          await syncToRemoteAwbEntry(updatedShipment)
        } catch (syncErr) {
          console.error('[Remote AWBENTRY Sync Error]:', syncErr.message)
        }
        return res.json({
          success: true,
          message: 'Billing charges updated and synced to remote AWBENTRY (Shipment details remain locked)',
          booking: updatedShipment,
          awb_number: updatedShipment.tracking_number
        })
      }

      shipmentId = existing[0].id
      tracking_number = existing[0].tracking_number

      await execute(
        `UPDATE shipments SET
          sender_id = ?, receiver_id = ?, courier_provider_id = ?, vendor_config_id = ?,
          vendor_code = ?, service_code = ?, product_code = ?, weight = ?, chargeable_weight = ?, \`length\` = ?, breadth = ?, height = ?,
          no_of_pieces = ?, content_description = ?, declared_value = ?, cod_amount = ?,
          payment_mode = ?, package_type = ?, total_amount = ?, shipping_charge = ?,
          rate_per_kg = ?, extra_charge = ?, final_chargeable_weight = ?,
          order_reference = ?, remarks = ?,
          sender_name = ?, sender_company = ?, sender_phone = ?, sender_phone_2 = ?, sender_email = ?,
          sender_address = ?, sender_address_2 = ?, sender_city = ?, sender_state = ?,
          sender_pincode = ?, sender_country = ?, sender_gstin_type = ?, sender_gstin_no = ?,
          receiver_name = ?, receiver_company = ?, receiver_phone = ?, receiver_phone_2 = ?, receiver_email = ?,
          receiver_address = ?, receiver_address_2 = ?, receiver_city = ?, receiver_state = ?,
          receiver_pincode = ?, receiver_country = ?, receiver_gstin_type = ?, receiver_gstin_no = ?,
          invoice_currency = ?, hs_code = ?, export_reason = ?, terms_of_trade = ?,
          invoice_type = ?, invoice_note = ?, invoice_items = ?, parcels = ?
        WHERE id = ?`,
        [
          finalSenderId || null,
          finalReceiverId || null,
          fields.courier_provider_id || null,
          fields.vendor_config_id || null,
          fields.vendor_code || '',
          fields.service_code || '',
          fields.product_code || '',
          finalWeight,
          finalChgWeight,
          finalLength,
          finalBreadth,
          finalHeight,
          finalPieces,
          contentDescription,
          parseFloat(fields.declared_value) || 0,
          parseFloat(fields.cod_amount) || 0,
          fields.payment_mode || 'prepaid',
          fields.package_type || 'parcel',
          parseFloat(fields.total_amount) || parseFloat(fields.shipping_charge) || 0,
          parseFloat(fields.shipping_charge) || 0,
          parseFloat(fields.rate_per_kg) || 0,
          parseFloat(fields.extra_charge) || 0,
          parseFloat(fields.final_chargeable_weight) || finalChgWeight || 0,
          fields.order_reference || '',
          fields.remarks || '',
          snap.sender_name,
          snap.sender_company,
          snap.sender_phone,
          snap.sender_phone_2,
          snap.sender_email,
          snap.sender_address,
          snap.sender_address_2,
          snap.sender_city,
          snap.sender_state,
          snap.sender_pincode,
          snap.sender_country,
          snap.sender_gstin_type,
          snap.sender_gstin_no,
          snap.receiver_name,
          snap.receiver_company,
          snap.receiver_phone,
          snap.receiver_phone_2,
          snap.receiver_email,
          snap.receiver_address,
          snap.receiver_address_2,
          snap.receiver_city,
          snap.receiver_state,
          snap.receiver_pincode,
          snap.receiver_country,
          snap.receiver_gstin_type,
          snap.receiver_gstin_no,
          fields.invoice_currency || 'INR',
          fields.hs_code || '',
          fields.export_reason || '',
          fields.terms_of_trade || 'CIF',
          fields.invoice_type || 'INVOICE',
          fields.invoice_note || '',
          invoiceItemsJson,
          parcelsJson,
          shipmentId
        ]
      )
    } else {
      // New shipment insertion
      tracking_number = await generateTracking()
      const order_id = tracking_number

      const shipmentResult = await execute(
        `INSERT INTO shipments (
          order_id, sender_id, receiver_id, courier_provider_id, vendor_config_id,
          vendor_code, service_code, product_code, tracking_number, weight, chargeable_weight, \`length\`, breadth, height,
          no_of_pieces, content_description, declared_value, cod_amount,
          payment_mode, package_type, total_amount, shipping_charge,
          rate_per_kg, extra_charge, final_chargeable_weight,
          order_reference, remarks, status, vendor_push_status, is_locked,
          sender_name, sender_company, sender_phone, sender_phone_2, sender_email,
          sender_address, sender_address_2, sender_city, sender_state,
          sender_pincode, sender_country, sender_gstin_type, sender_gstin_no,
          receiver_name, receiver_company, receiver_phone, receiver_phone_2, receiver_email,
          receiver_address, receiver_address_2, receiver_city, receiver_state,
          receiver_pincode, receiver_country, receiver_gstin_type, receiver_gstin_no,
          invoice_no, invoice_date, invoice_currency, hs_code, export_reason, terms_of_trade,
          invoice_type, invoice_note, invoice_items, parcels
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order_id,
          finalSenderId || null,
          finalReceiverId || null,
          fields.courier_provider_id || null,
          fields.vendor_config_id || null,
          fields.vendor_code || '',
          fields.service_code || '',
          fields.product_code || '',
          tracking_number,
          finalWeight,
          finalChgWeight,
          finalLength,
          finalBreadth,
          finalHeight,
          finalPieces,
          contentDescription,
          parseFloat(fields.declared_value) || 0,
          parseFloat(fields.cod_amount) || 0,
          fields.payment_mode || 'prepaid',
          fields.package_type || 'parcel',
          parseFloat(fields.total_amount) || parseFloat(fields.shipping_charge) || 0,
          parseFloat(fields.shipping_charge) || 0,
          parseFloat(fields.rate_per_kg) || 0,
          parseFloat(fields.extra_charge) || 0,
          parseFloat(fields.final_chargeable_weight) || finalChgWeight || 0,
          fields.order_reference || '',
          fields.remarks || '',
          'draft',
          'skipped',
          false,
          snap.sender_name,
          snap.sender_company,
          snap.sender_phone,
          snap.sender_phone_2,
          snap.sender_email,
          snap.sender_address,
          snap.sender_address_2,
          snap.sender_city,
          snap.sender_state,
          snap.sender_pincode,
          snap.sender_country,
          snap.sender_gstin_type,
          snap.sender_gstin_no,
          snap.receiver_name,
          snap.receiver_company,
          snap.receiver_phone,
          snap.receiver_phone_2,
          snap.receiver_email,
          snap.receiver_address,
          snap.receiver_address_2,
          snap.receiver_city,
          snap.receiver_state,
          snap.receiver_pincode,
          snap.receiver_country,
          snap.receiver_gstin_type,
          snap.receiver_gstin_no,
          tracking_number,
          fields.invoice_date || new Date().toISOString().split('T')[0],
          fields.invoice_currency || 'INR',
          fields.hs_code || '',
          fields.export_reason || '',
          fields.terms_of_trade || 'CIF',
          fields.invoice_type || 'INVOICE',
          fields.invoice_note || '',
          invoiceItemsJson,
          parcelsJson
        ]
      )
      shipmentId = shipmentResult.insertId
    }

    // Generate invoice PDF
    let invoicePdfPath = ''
    try {
      invoicePdfPath = await generateInvoiceForBooking(tracking_number, fields, finalSenderId, finalReceiverId)
      await execute('UPDATE shipments SET invoice_pdf_path = ? WHERE id = ?', [invoicePdfPath, shipmentId])
    } catch (pdfErr) {
      console.error('Invoice PDF generation failed:', pdfErr.message)
    }

    // Refetch the saved shipment with sender, receiver & vendor config details
    const updatedRows = await query(
      `SELECT s.*, 
        snd.name as s_name, snd.email as s_email, snd.phone as s_phone, 
        snd.address as s_address, snd.city as s_city, snd.state as s_state,
        snd.pincode as s_pincode, snd.country as s_country,
        rcv.name as r_name, rcv.email as r_email, rcv.phone as r_phone,
        rcv.address as r_address, rcv.city as r_city, rcv.state as r_state,
        rcv.pincode as r_pincode, rcv.country as r_country,
        vac.name as vendor_name, vac.vendor_code as vac_vendor_code,
        vac.auth_credentials as vac_auth_credentials, vac.available_services as vac_services
       FROM shipments s
       LEFT JOIN senders snd ON s.sender_id = snd.id
       LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
       LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
       WHERE s.id = ?`,
      [shipmentId]
    )

    const updatedShipment = updatedRows[0] || {}

    // Sync draft booking to remote Hostinger operations DB (AWBENTRY and parcel_history)
    try {
      await syncToRemoteAwbEntry(updatedShipment)
    } catch (syncErr) {
      console.error('[Remote AWBENTRY Draft Sync Error]:', syncErr.message)
    }

    try {
      await syncToRemoteParcelHistory(
        updatedShipment,
        'SHIPMENT BOOKED',
        updatedShipment.s_city || updatedShipment.sender_city || 'SURAT'
      )
    } catch (syncErr) {
      console.error('[Remote parcel_history Draft Sync Error]:', syncErr.message)
    }

    return res.status(201).json({
      success: true,
      message: existingId ? 'Booking updated successfully' : 'Booking saved as draft',
      booking: updatedShipment,
      awb_number: tracking_number
    })
  } catch (err) {
    console.error('Save booking error:', err)
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while saving booking'
    })
  }
}


// ═══════════════════════════════════════════════════════════════
//  PUSH BOOKING TO API (Takes existing saved booking → pushes)
// ═══════════════════════════════════════════════════════════════

export const pushBookingToApi = async (req, res) => {
  try {
    const { id } = req.params
    const { vendor_config_id, vendor_code, service_code, product_code } = req.body || {}

    // Fetch the existing booking with vendor details
    const rows = await query(
      `SELECT s.*, 
        snd.name as s_name, snd.email as s_email, snd.phone as s_phone, 
        snd.address as s_address, snd.city as s_city, snd.state as s_state,
        snd.pincode as s_pincode, snd.country as s_country,
        rcv.name as r_name, rcv.email as r_email, rcv.phone as r_phone,
        rcv.address as r_address, rcv.city as r_city, rcv.state as r_state,
        rcv.pincode as r_pincode, rcv.country as r_country,
        vac.name as vendor_name, vac.vendor_code as vac_vendor_code,
        vac.auth_credentials as vac_auth_credentials, vac.available_services as vac_services
       FROM shipments s
       LEFT JOIN senders snd ON s.sender_id = snd.id
       LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
       LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
       WHERE s.id = ?`,
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    let booking = rows[0]

    if (booking.is_locked) {
      return res.status(400).json({ success: false, message: 'This booking is already locked (pushed to API). No changes can be made.' })
    }

    const targetVendorConfigId = vendor_config_id || booking.vendor_config_id
    let targetVendorCode = vendor_code || booking.vendor_code || booking.vac_vendor_code || ''
    let targetServiceCode = service_code || booking.service_code || ''
    let targetProductCode = product_code || booking.product_code || ''

    if (targetVendorConfigId) {
      const vacRows = await query('SELECT * FROM vendor_api_configs WHERE id = ?', [targetVendorConfigId])
      if (vacRows.length > 0) {
        const vac = vacRows[0]
        if (!targetVendorCode) targetVendorCode = vac.vendor_code || ''
        if (!targetServiceCode && vac.available_services) {
          let svcs = vac.available_services
          if (typeof svcs === 'string') {
            try { svcs = JSON.parse(svcs) } catch { }
          }
          if (Array.isArray(svcs) && svcs.length > 0) {
            targetServiceCode = svcs[0].code || svcs[0].id || svcs[0].service || ''
          }
        }
      }
      await execute('UPDATE shipments SET vendor_config_id = ?, vendor_code = ?, service_code = ?, product_code = ? WHERE id = ?',
        [targetVendorConfigId, targetVendorCode, targetServiceCode, targetProductCode, id])
      booking.vendor_config_id = targetVendorConfigId
      booking.vendor_code = targetVendorCode
      booking.service_code = targetServiceCode
      booking.product_code = targetProductCode
    }

    if (!booking.vendor_config_id) {
      return res.status(400).json({ success: false, message: 'No vendor API selected for this booking. Please select a vendor first.' })
    }

    // Build vendor data
    const shipmentDataForVendor = buildVendorShipmentData({
      ...booking,
      sender_name: booking.s_name || '',
      sender_email: booking.s_email || '',
      sender_phone: booking.s_phone || '',
      sender_address: booking.s_address || '',
      sender_city: booking.s_city || '',
      sender_state: booking.s_state || '',
      sender_pincode: booking.s_pincode || '',
      sender_country: booking.s_country || 'INDIA',
      receiver_name: booking.r_name || '',
      receiver_email: booking.r_email || '',
      receiver_phone: booking.r_phone || '',
      receiver_address: booking.r_address || '',
      receiver_city: booking.r_city || '',
      receiver_state: booking.r_state || '',
      receiver_pincode: booking.r_pincode || '',
      receiver_country: booking.r_country || 'INDIA',
      sender_company: booking.sender_company || '',
      sender_address_2: booking.sender_address_2 || '',
      sender_gstin_type: booking.sender_gstin_type || '',
      sender_gstin_no: booking.sender_gstin_no || '',
      receiver_address_2: booking.receiver_address_2 || '',
      receiver_gstin_type: booking.receiver_gstin_type || '',
      receiver_gstin_no: booking.receiver_gstin_no || ''
    }, booking.order_id, booking.tracking_number)

    // Push to vendor API
    const vendorResult = await pushShipmentToVendor(
      booking.vendor_config_id,
      booking.id,
      shipmentDataForVendor
    )

    if (vendorResult.success) {
      // Success → update status to booked, lock the booking
      await execute(
        `UPDATE shipments SET status = 'booked', is_locked = TRUE, vendor_push_status = 'success', vendor_code = ?, service_code = ?, product_code = ? WHERE id = ?`,
        [targetVendorCode, targetServiceCode, targetProductCode, id]
      )

      await execute(
        `INSERT INTO tracking_events (shipment_id, status, description, location)
         VALUES (?, ?, ?, ?)`,
        [id, 'AWB Assigned', `Pushed to vendor API. Vendor AWB: ${vendorResult.awbNumber || 'N/A'}`, 'Vendor API']
      )

      // Refetch with sender/receiver & vendor details
      const updatedRows = await query(
        `SELECT s.*, 
          snd.name as s_name, snd.email as s_email, snd.phone as s_phone, 
          snd.address as s_address, snd.city as s_city, snd.state as s_state,
          snd.pincode as s_pincode, snd.country as s_country,
          rcv.name as r_name, rcv.email as r_email, rcv.phone as r_phone,
          rcv.address as r_address, rcv.city as r_city, rcv.state as r_state,
          rcv.pincode as r_pincode, rcv.country as r_country,
          vac.name as vendor_name, vac.vendor_code as vac_vendor_code,
          vac.auth_credentials as vac_auth_credentials, vac.available_services as vac_services
         FROM shipments s
         LEFT JOIN senders snd ON s.sender_id = snd.id
         LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
         LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
         WHERE s.id = ?`,
        [id]
      )

      const updated = updatedRows[0] || booking

      // Sync to Remote Operations AWBENTRY and parcel_history (Hostinger DB)
      try {
        await syncToRemoteAwbEntry(updated, vendorResult)
      } catch (syncErr) {
        console.error('[Remote AWBENTRY Sync Error]:', syncErr.message)
      }

      try {
        await syncToRemoteParcelHistory(
          updated,
          'SHIPMENT BOOKED',
          updated.s_city || updated.sender_city || 'SURAT'
        )
      } catch (syncErr) {
        console.error('[Remote parcel_history Sync Error]:', syncErr.message)
      }

      return res.json({
        success: true,
        booking: updated,
        vendor_result: vendorResult,
        message: `Booking pushed to vendor API! Vendor AWB: ${vendorResult.awbNumber || 'N/A'}`
      })
    } else {
      return res.status(400).json({
        success: false,
        message: `Vendor API Push Failed: ${vendorResult.error || 'Unknown error'}`,
        vendor_result: vendorResult
      })
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}


// ═══════════════════════════════════════════════════════════════
//  CREATE BOOKING (Legacy — saves and pushes in one step)
// ═══════════════════════════════════════════════════════════════

export const createBooking = async (req, res) => {
  try {
    const fields = extractBookingFields(req.body)
    const existingId = fields.id || req.body.id

    if (!validateAadhaarDoc(fields.sender_gstin_type, fields.sender_gstin_no)) {
      return res.status(400).json({ success: false, message: 'Aadhaar number must be exactly 12 digits' })
    }
    if (!validateAadhaarDoc(fields.receiver_gstin_type, fields.receiver_gstin_no)) {
      return res.status(400).json({ success: false, message: 'Receiver Aadhaar number must be exactly 12 digits' })
    }

    // Upsert sender/receiver
    const finalSenderId = await upsertSender(fields)
    const finalReceiverId = await upsertReceiver(fields)

    // Parse invoice items and parcels
    const invoiceItemsJson = Array.isArray(fields.invoice_items)
      ? JSON.stringify(fields.invoice_items)
      : (fields.invoice_items || '[]')

    const parsedInvoiceItems = Array.isArray(fields.invoice_items)
      ? fields.invoice_items
      : (typeof fields.invoice_items === 'string' ? (JSON.parse(fields.invoice_items || '[]') || []) : [])
    const itemDescriptions = Array.isArray(parsedInvoiceItems) ? parsedInvoiceItems.map(i => i.description).filter(Boolean) : []
    const derivedContent = itemDescriptions.length > 0 ? itemDescriptions.join(', ') : ''
    let contentDescription = ''
    if (fields.content_description && !['general goods', 'items / goods inside', 'goods'].includes(fields.content_description.trim().toLowerCase())) {
      contentDescription = fields.content_description.trim()
    } else if (derivedContent) {
      contentDescription = derivedContent
    } else if (fields.content_description) {
      contentDescription = fields.content_description.trim()
    } else {
      contentDescription = 'Books'
    }

    const parcelsJson = Array.isArray(fields.parcels)
      ? JSON.stringify(fields.parcels)
      : (typeof fields.parcels === 'string' ? fields.parcels : null)

    const parsedParcelsList = Array.isArray(fields.parcels)
      ? fields.parcels
      : (typeof fields.parcels === 'string' ? (JSON.parse(fields.parcels || '[]') || []) : [])

    let finalWeight = parseFloat(fields.weight) || 0
    let finalLength = parseFloat(fields.length) || 0
    let finalBreadth = parseFloat(fields.breadth) || 0
    let finalHeight = parseFloat(fields.height) || 0
    let finalPieces = parseInt(fields.no_of_pieces) || 1

    if (parsedParcelsList.length > 0) {
      const sumPWeight = parsedParcelsList.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0)
      if (sumPWeight > 0) finalWeight = Math.round(sumPWeight * 1000) / 1000
      if (parsedParcelsList.length > finalPieces) finalPieces = parsedParcelsList.length
      if (finalLength <= 0 && parsedParcelsList[0]?.length) finalLength = parseFloat(parsedParcelsList[0].length) || 0
      if (finalBreadth <= 0 && (parsedParcelsList[0]?.breadth || parsedParcelsList[0]?.width)) finalBreadth = parseFloat(parsedParcelsList[0].breadth || parsedParcelsList[0].width) || 0
      if (finalHeight <= 0 && parsedParcelsList[0]?.height) finalHeight = parseFloat(parsedParcelsList[0].height) || 0
    }

    const finalChgWeight = parsedParcelsList.length > 1
      ? parsedParcelsList.reduce((sum, p) => {
        const act = parseFloat(p.weight) || 0
        const l = parseFloat(p.length) || 0
        const b = parseFloat(p.breadth || p.width) || 0
        const h = parseFloat(p.height) || 0
        const vol = (l > 0 && b > 0 && h > 0) ? (l * b * h) / 5000 : 0
        return sum + Math.ceil(parseFloat(p.chargeable_weight) || Math.max(act, vol))
      }, 0)
      : (parseFloat(fields.chargeable_weight) ? Math.ceil(parseFloat(fields.chargeable_weight)) : Math.ceil(finalWeight) || 0)

    const snap = await prepareSnapshotFields(fields, finalSenderId, finalReceiverId)

    let shipmentId
    let tracking_number
    let order_id
    let isExisting = false

    if (existingId) {
      const existing = await query('SELECT * FROM shipments WHERE id = ?', [existingId])
      if (existing.length === 0) {
        return res.status(404).json({ success: false, message: 'Shipment not found' })
      }
      if (existing[0].is_locked) {
        return res.status(400).json({ success: false, message: 'This shipment is already locked/dispatched and cannot be pushed again.' })
      }
      isExisting = true
      shipmentId = existing[0].id
      tracking_number = existing[0].tracking_number
      order_id = existing[0].order_id || tracking_number

      // Update existing shipment in place (KEEP THE SAME AWB!)
      await execute(
        `UPDATE shipments SET
          sender_id = ?, receiver_id = ?, courier_provider_id = ?, vendor_config_id = ?,
          vendor_code = ?, service_code = ?, product_code = ?, weight = ?, chargeable_weight = ?, \`length\` = ?, breadth = ?, height = ?,
          no_of_pieces = ?, content_description = ?, declared_value = ?, cod_amount = ?,
          payment_mode = ?, package_type = ?, total_amount = ?, shipping_charge = ?,
          rate_per_kg = ?, extra_charge = ?, final_chargeable_weight = ?,
          order_reference = ?, remarks = ?, status = ?, vendor_push_status = ?,
          sender_name = ?, sender_company = ?, sender_phone = ?, sender_phone_2 = ?, sender_email = ?,
          sender_address = ?, sender_address_2 = ?, sender_city = ?, sender_state = ?,
          sender_pincode = ?, sender_country = ?, sender_gstin_type = ?, sender_gstin_no = ?,
          receiver_name = ?, receiver_company = ?, receiver_phone = ?, receiver_phone_2 = ?, receiver_email = ?,
          receiver_address = ?, receiver_address_2 = ?, receiver_city = ?, receiver_state = ?,
          receiver_pincode = ?, receiver_country = ?, receiver_gstin_type = ?, receiver_gstin_no = ?,
          invoice_no = ?, invoice_date = ?, invoice_currency = ?, hs_code = ?, export_reason = ?, terms_of_trade = ?,
          invoice_type = ?, invoice_note = ?, invoice_items = ?, parcels = ?
        WHERE id = ?`,
        [
          finalSenderId || null,
          finalReceiverId || null,
          fields.courier_provider_id || null,
          fields.vendor_config_id || null,
          fields.vendor_code || '',
          fields.service_code || '',
          fields.product_code || '',
          finalWeight,
          finalChgWeight,
          finalLength,
          finalBreadth,
          finalHeight,
          finalPieces,
          contentDescription,
          parseFloat(fields.declared_value) || 0,
          parseFloat(fields.cod_amount) || 0,
          fields.payment_mode || 'prepaid',
          fields.package_type || 'parcel',
          parseFloat(fields.total_amount) || parseFloat(fields.shipping_charge) || 0,
          parseFloat(fields.shipping_charge) || 0,
          parseFloat(fields.rate_per_kg) || 0,
          parseFloat(fields.extra_charge) || 0,
          parseFloat(fields.final_chargeable_weight) || finalChgWeight || 0,
          fields.order_reference || '',
          fields.remarks || '',
          fields.vendor_config_id ? 'processing' : 'booked',
          fields.vendor_config_id ? 'pending' : 'skipped',
          snap.sender_name,
          snap.sender_company,
          snap.sender_phone,
          snap.sender_phone_2,
          snap.sender_email,
          snap.sender_address,
          snap.sender_address_2,
          snap.sender_city,
          snap.sender_state,
          snap.sender_pincode,
          snap.sender_country,
          snap.sender_gstin_type,
          snap.sender_gstin_no,
          snap.receiver_name,
          snap.receiver_company,
          snap.receiver_phone,
          snap.receiver_phone_2,
          snap.receiver_email,
          snap.receiver_address,
          snap.receiver_address_2,
          snap.receiver_city,
          snap.receiver_state,
          snap.receiver_pincode,
          snap.receiver_country,
          snap.receiver_gstin_type,
          snap.receiver_gstin_no,
          tracking_number,
          fields.invoice_date || new Date().toISOString().split('T')[0],
          fields.invoice_currency || 'INR',
          fields.hs_code || '',
          fields.export_reason || '',
          fields.terms_of_trade || 'CIF',
          fields.invoice_type || 'INVOICE',
          fields.invoice_note || '',
          invoiceItemsJson,
          parcelsJson,
          shipmentId
        ]
      )
    } else {
      // New shipment insertion
      tracking_number = await generateTracking()
      order_id = tracking_number

      const shipmentResult = await execute(
        `INSERT INTO shipments (
          order_id, sender_id, receiver_id, courier_provider_id, vendor_config_id,
          vendor_code, service_code, product_code, tracking_number, weight, chargeable_weight, \`length\`, breadth, height,
          no_of_pieces, content_description, declared_value, cod_amount,
          payment_mode, package_type, total_amount, shipping_charge,
          rate_per_kg, extra_charge, final_chargeable_weight,
          order_reference, remarks, status, vendor_push_status, is_locked,
          sender_name, sender_company, sender_phone, sender_phone_2, sender_email,
          sender_address, sender_address_2, sender_city, sender_state,
          sender_pincode, sender_country, sender_gstin_type, sender_gstin_no,
          receiver_name, receiver_company, receiver_phone, receiver_phone_2, receiver_email,
          receiver_address, receiver_address_2, receiver_city, receiver_state,
          receiver_pincode, receiver_country, receiver_gstin_type, receiver_gstin_no,
          invoice_no, invoice_date, invoice_currency, hs_code, export_reason, terms_of_trade,
          invoice_type, invoice_note, invoice_items, parcels
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order_id,
          finalSenderId || null,
          finalReceiverId || null,
          fields.courier_provider_id || null,
          fields.vendor_config_id || null,
          fields.vendor_code || '',
          fields.service_code || '',
          fields.product_code || '',
          tracking_number,
          finalWeight,
          finalChgWeight,
          finalLength,
          finalBreadth,
          finalHeight,
          finalPieces,
          contentDescription,
          parseFloat(fields.declared_value) || 0,
          parseFloat(fields.cod_amount) || 0,
          fields.payment_mode || 'prepaid',
          fields.package_type || 'parcel',
          parseFloat(fields.total_amount) || parseFloat(fields.shipping_charge) || 0,
          parseFloat(fields.shipping_charge) || 0,
          parseFloat(fields.rate_per_kg) || 0,
          parseFloat(fields.extra_charge) || 0,
          parseFloat(fields.final_chargeable_weight) || finalChgWeight || 0,
          fields.order_reference || '',
          fields.remarks || '',
          fields.vendor_config_id ? 'processing' : 'booked',
          fields.vendor_config_id ? 'pending' : 'skipped',
          false,
          snap.sender_name,
          snap.sender_company,
          snap.sender_phone,
          snap.sender_phone_2,
          snap.sender_email,
          snap.sender_address,
          snap.sender_address_2,
          snap.sender_city,
          snap.sender_state,
          snap.sender_pincode,
          snap.sender_country,
          snap.sender_gstin_type,
          snap.sender_gstin_no,
          snap.receiver_name,
          snap.receiver_company,
          snap.receiver_phone,
          snap.receiver_phone_2,
          snap.receiver_email,
          snap.receiver_address,
          snap.receiver_address_2,
          snap.receiver_city,
          snap.receiver_state,
          snap.receiver_pincode,
          snap.receiver_country,
          snap.receiver_gstin_type,
          snap.receiver_gstin_no,
          tracking_number,
          fields.invoice_date || new Date().toISOString().split('T')[0],
          fields.invoice_currency || 'INR',
          fields.hs_code || '',
          fields.export_reason || '',
          fields.terms_of_trade || 'CIF',
          fields.invoice_type || 'INVOICE',
          fields.invoice_note || '',
          invoiceItemsJson,
          parcelsJson
        ]
      )

      shipmentId = shipmentResult.insertId
    }

    // Generate invoice PDF
    let invoicePdfPath = ''
    try {
      invoicePdfPath = await generateInvoiceForBooking(tracking_number, fields, finalSenderId, finalReceiverId)
      await execute('UPDATE shipments SET invoice_pdf_path = ? WHERE id = ?', [invoicePdfPath, shipmentId])
    } catch (pdfErr) {
      console.error('Invoice PDF generation failed:', pdfErr.message)
    }

    // Create tracking event if new
    if (!isExisting) {
      await execute(
        `INSERT INTO tracking_events (shipment_id, status, description, location)
         VALUES (?, ?, ?, ?)`,
        [shipmentId, 'Shipment Created', 'Shipment booked successfully', 'System']
      )
    }

    // Push to vendor API if vendor selected
    let vendorResult = null
    if (fields.vendor_config_id) {
      const shipmentDataForVendor = buildVendorShipmentData(fields, order_id, tracking_number)

      vendorResult = await pushShipmentToVendor(
        fields.vendor_config_id,
        shipmentId,
        shipmentDataForVendor
      )

      if (vendorResult.success) {
        await execute('UPDATE shipments SET status = ?, is_locked = TRUE WHERE id = ?', ['booked', shipmentId])

        await execute(
          `INSERT INTO tracking_events (shipment_id, status, description, location)
           VALUES (?, ?, ?, ?)`,
          [shipmentId, 'AWB Assigned', `Vendor AWB: ${vendorResult.awbNumber || 'N/A'}`, 'Vendor API']
        )

        // Sync to Remote Operations AWBENTRY and parcel_history table (Hostinger DB)
        try {
          const fullShipmentRows = await query(
            `SELECT s.*, 
              snd.name as s_name, snd.email as s_email, snd.phone as s_phone, 
              snd.address as s_address, snd.city as s_city, snd.state as s_state,
              snd.pincode as s_pincode, snd.country as s_country,
              rcv.name as r_name, rcv.email as r_email, rcv.phone as r_phone,
              rcv.address as r_address, rcv.city as r_city, rcv.state as r_state,
              rcv.pincode as r_pincode, rcv.country as r_country,
              vac.name as vendor_name, vac.vendor_code as vac_vendor_code,
              vac.auth_credentials as vac_auth_credentials, vac.available_services as vac_services
             FROM shipments s
             LEFT JOIN senders snd ON s.sender_id = snd.id
             LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
             LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
             WHERE s.id = ?`,
            [shipmentId]
          )
          const syncShipment = fullShipmentRows[0] || {
            ...fields,
            id: shipmentId,
            tracking_number,
            order_id,
            vendor_awb_number: vendorResult.awbNumber || fields.vendor_code || ''
          }
          await syncToRemoteAwbEntry(syncShipment, vendorResult)
        } catch (syncErr) {
          console.error('[Remote AWBENTRY Sync Error]:', syncErr.message)
        }

        try {
          await syncToRemoteParcelHistory(
            {
              ...fields,
              tracking_number,
              order_id
            },
            'SHIPMENT BOOKED',
            fields.sender_city || 'SURAT'
          )
        } catch (syncErr) {
          console.error('[Remote parcel_history Sync Error]:', syncErr.message)
        }
      } else {
        if (!isExisting) {
          await execute('DELETE FROM shipments WHERE id = ?', [shipmentId])
        } else {
          await execute('UPDATE shipments SET vendor_push_status = ? WHERE id = ?', ['failed', shipmentId])
        }
        return res.status(400).json({
          success: false,
          message: `Vendor API Push Failed: ${vendorResult.error || 'Unknown error'}`
        })
      }
    }

    // Link booking request if applicable
    const fromRequestId = req.body.from_request || req.body.booking_request_id
    const requestAwb = req.body.request_awb

    if (fromRequestId || requestAwb) {
      try {
        let reqRow = null
        if (fromRequestId) {
          const reqRows = await query('SELECT * FROM booking_requests WHERE id = ?', [fromRequestId])
          if (reqRows.length > 0) reqRow = reqRows[0]
        }
        if (!reqRow && requestAwb) {
          const reqRows = await query('SELECT * FROM booking_requests WHERE request_awb = ?', [requestAwb])
          if (reqRows.length > 0) reqRow = reqRows[0]
        }

        if (reqRow) {
          const effectiveTracking = vendorResult?.awbNumber || tracking_number
          await execute(
            `UPDATE booking_requests SET status = 'confirmed', shipment_id = ?, tracking_number = ? WHERE id = ?`,
            [shipmentId, effectiveTracking, reqRow.id]
          )

          await execute(
            `INSERT INTO request_updates (request_id, update_type, title, description, metadata) VALUES (?, ?, ?, ?, ?)`,
            [reqRow.id, 'shipment_created', 'Shipment Confirmed', `Booking confirmed. Tracking: ${effectiveTracking}`, JSON.stringify({ shipment_id: shipmentId, tracking_number: effectiveTracking })]
          )
        }
      } catch (reqSyncErr) {
        console.error('Failed to update booking request:', reqSyncErr.message)
      }
    }

    const shipmentRows = await query('SELECT * FROM shipments WHERE id = ?', [shipmentId])

    return res.status(201).json({
      success: true,
      booking: shipmentRows[0],
      vendor_result: vendorResult
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}


// ═══════════════════════════════════════════════════════════════
//  EXISTING CRUD (unchanged logic)
// ═══════════════════════════════════════════════════════════════

export const getBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const offset = (pageNum - 1) * limitNum

    const allowedSortColumns = ['created_at', 'order_id', 'tracking_number', 'status', 'total_amount']
    const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at'
    const safeSortOrder = sort_order === 'asc' ? 'ASC' : 'DESC'

    let whereConditions = []
    const params = []

    if (status === 'trashed') {
      whereConditions.push('s.is_trashed = 1')
    } else {
      whereConditions.push('(s.is_trashed = 0 OR s.is_trashed IS NULL)')
      if (status) {
        whereConditions.push('s.status = ?')
        params.push(status)
      }
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      whereConditions.push(`(
        s.order_id LIKE ? OR
        s.tracking_number LIKE ? OR
        s.vendor_awb_number LIKE ? OR
        s.vendor_awb_number_2 LIKE ? OR
        s.forwarding_no LIKE ? OR
        s.order_reference LIKE ? OR
        s.sender_name LIKE ? OR
        snd.name LIKE ? OR
        snd.phone LIKE ? OR
        snd.phone_2 LIKE ? OR
        s.sender_phone LIKE ? OR
        s.sender_phone_2 LIKE ? OR
        s.receiver_name LIKE ? OR
        rcv.name LIKE ? OR
        rcv.phone LIKE ? OR
        rcv.phone_2 LIKE ? OR
        s.receiver_phone LIKE ? OR
        s.receiver_phone_2 LIKE ? OR
        s.receiver_country LIKE ? OR
        rcv.country LIKE ? OR
        s.receiver_city LIKE ? OR
        rcv.city LIKE ? OR
        DATE_FORMAT(s.created_at, '%d/%m/%Y') LIKE ? OR
        DATE_FORMAT(s.created_at, '%Y-%m-%d') LIKE ?
      )`)
      params.push(
        term, term, term, term, term, term,
        term, term, term, term, term, term,
        term, term, term, term, term, term,
        term, term, term, term,
        term, term
      )
    }

    const whereClause = whereConditions.length > 0 ? ` WHERE ${whereConditions.join(' AND ')}` : ''

    const countRows = await query(
      `SELECT COUNT(*) as total
       FROM shipments s
       LEFT JOIN senders snd ON s.sender_id = snd.id
       LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
       LEFT JOIN courier_providers cp ON s.courier_provider_id = cp.id
       LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
       ${whereClause}`,
      params
    )
    const total = countRows[0].total

    const dataRows = await query(
      `SELECT s.*,
        snd.id as s_id, snd.name as s_name, snd.phone as s_phone, snd.phone_2 as s_phone_2, snd.email as s_email,
        snd.address as s_address, snd.city as s_city, snd.state as s_state, snd.pincode as s_pincode, snd.country as s_country,
        rcv.id as r_id, rcv.name as r_name, rcv.phone as r_phone, rcv.phone_2 as r_phone_2, rcv.email as r_email,
        rcv.address as r_address, rcv.city as r_city, rcv.state as r_state, rcv.pincode as r_pincode, rcv.country as r_country,
        cp.id as cp_id, cp.name as cp_name, cp.code as cp_code, cp.tracking_url as cp_tracking_url,
        vac.id as vac_id, vac.name as vac_name, vac.vendor_code as vac_vendor_code, vac.environment as vac_environment
       FROM shipments s
       LEFT JOIN senders snd ON s.sender_id = snd.id
       LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
       LEFT JOIN courier_providers cp ON s.courier_provider_id = cp.id
       LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
       ${whereClause}
       ORDER BY s.${safeSortBy} ${safeSortOrder}
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    )

    const bookings = dataRows.map(row => {
      const senders = (row.s_id || row.s_name || row.sender_name) ? {
        id: row.s_id || null,
        name: row.s_name || row.sender_name || '',
        company: row.s_company || row.sender_company || '',
        phone: row.s_phone || row.sender_phone || '',
        phone_2: row.s_phone_2 || row.sender_phone_2 || '',
        email: row.s_email || row.sender_email || '',
        address: row.s_address || row.sender_address || '',
        address_2: row.s_address_2 || row.sender_address_2 || '',
        city: row.s_city || row.sender_city || '',
        state: row.s_state || row.sender_state || '',
        pincode: row.s_pincode || row.sender_pincode || '',
        country: row.s_country || row.sender_country || 'INDIA',
        gstin_type: row.s_gstin_type || row.sender_gstin_type || '',
        gstin_no: row.s_gstin_no || row.sender_gstin_no || ''
      } : null

      const receivers = (row.r_id || row.r_name || row.receiver_name) ? {
        id: row.r_id || null,
        name: row.r_name || row.receiver_name || '',
        company: row.r_company || row.receiver_company || '',
        phone: row.r_phone || row.receiver_phone || '',
        phone_2: row.r_phone_2 || row.receiver_phone_2 || '',
        email: row.r_email || row.receiver_email || '',
        address: row.r_address || row.receiver_address || '',
        address_2: row.r_address_2 || row.receiver_address_2 || '',
        city: row.r_city || row.receiver_city || '',
        state: row.r_state || row.receiver_state || '',
        pincode: row.r_pincode || row.receiver_pincode || '',
        country: row.r_country || row.receiver_country || '',
        gstin_type: row.r_gstin_type || row.receiver_gstin_type || '',
        gstin_no: row.r_gstin_no || row.receiver_gstin_no || ''
      } : null

      const courier_providers = row.cp_id ? {
        id: row.cp_id,
        name: row.cp_name,
        code: row.cp_code,
        tracking_url: row.cp_tracking_url
      } : null

      const vendor_api_configs = row.vac_id ? {
        id: row.vac_id,
        name: row.vac_name,
        vendor_code: row.vac_vendor_code,
        environment: row.vac_environment
      } : null

      let parsedParcels = []
      if (row.parcels) {
        try {
          parsedParcels = typeof row.parcels === 'string' ? JSON.parse(row.parcels) : row.parcels
        } catch { }
      }

      let parsedInvoiceItems = []
      if (row.invoice_items) {
        try {
          parsedInvoiceItems = typeof row.invoice_items === 'string' ? JSON.parse(row.invoice_items) : row.invoice_items
        } catch { }
      }

      return {
        ...row,
        parcels: parsedParcels,
        invoice_items: parsedInvoiceItems,
        senders,
        receivers,
        courier_providers,
        vendor_api_configs
      }
    })

    return res.json({
      success: true,
      bookings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const getBookingById = async (req, res) => {
  try {
    const { id } = req.params

    const rows = await query(
      `SELECT s.*,
        snd.id as s_id, snd.name as s_name, snd.phone as s_phone, snd.phone_2 as s_phone_2, snd.email as s_email,
        snd.address as s_address, snd.city as s_city, snd.state as s_state, snd.pincode as s_pincode, snd.country as s_country,
        rcv.id as r_id, rcv.name as r_name, rcv.phone as r_phone, rcv.phone_2 as r_phone_2, rcv.email as r_email,
        rcv.address as r_address, rcv.city as r_city, rcv.state as r_state, rcv.pincode as r_pincode, rcv.country as r_country,
        cp.id as cp_id, cp.name as cp_name, cp.code as cp_code, cp.tracking_url as cp_tracking_url,
        vac.id as vac_id, vac.name as vac_name, vac.vendor_code as vac_vendor_code, vac.environment as vac_environment
       FROM shipments s
       LEFT JOIN senders snd ON s.sender_id = snd.id
       LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
       LEFT JOIN courier_providers cp ON s.courier_provider_id = cp.id
       LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
       WHERE s.id = ? OR s.tracking_number = ? OR s.order_id = ? OR s.vendor_awb_number = ?`,
      [id, id, id, id]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      })
    }

    const b = rows[0]

    const senders = (b.s_id || b.s_name || b.sender_name) ? {
      id: b.s_id || null,
      name: b.s_name || b.sender_name || '',
      company: b.s_company || b.sender_company || '',
      phone: b.s_phone || b.sender_phone || '',
      phone_2: b.s_phone_2 || b.sender_phone_2 || '',
      email: b.s_email || b.sender_email || '',
      address: b.s_address || b.sender_address || '',
      address_2: b.s_address_2 || b.sender_address_2 || '',
      city: b.s_city || b.sender_city || '',
      state: b.s_state || b.sender_state || '',
      pincode: b.s_pincode || b.sender_pincode || '',
      country: b.s_country || b.sender_country || 'INDIA',
      gstin_type: b.s_gstin_type || b.sender_gstin_type || '',
      gstin_no: b.s_gstin_no || b.sender_gstin_no || ''
    } : null

    const receivers = (b.r_id || b.r_name || b.receiver_name) ? {
      id: b.r_id || null,
      name: b.r_name || b.receiver_name || '',
      company: b.r_company || b.receiver_company || '',
      phone: b.r_phone || b.receiver_phone || '',
      phone_2: b.r_phone_2 || b.receiver_phone_2 || '',
      email: b.r_email || b.receiver_email || '',
      address: b.r_address || b.receiver_address || '',
      address_2: b.r_address_2 || b.receiver_address_2 || '',
      city: b.r_city || b.receiver_city || '',
      state: b.r_state || b.receiver_state || '',
      pincode: b.r_pincode || b.receiver_pincode || '',
      country: b.r_country || b.receiver_country || '',
      gstin_type: b.r_gstin_type || b.receiver_gstin_type || '',
      gstin_no: b.r_gstin_no || b.receiver_gstin_no || ''
    } : null

    const courier_providers = b.cp_id ? {
      id: b.cp_id,
      name: b.cp_name,
      code: b.cp_code,
      tracking_url: b.cp_tracking_url
    } : null

    const vendor_api_configs = b.vac_id ? {
      id: b.vac_id,
      name: b.vac_name,
      vendor_code: b.vac_vendor_code,
      environment: b.vac_environment
    } : null

    let parsedParcels = []
    if (b.parcels) {
      try {
        parsedParcels = typeof b.parcels === 'string' ? JSON.parse(b.parcels) : b.parcels
      } catch { }
    }

    let parsedInvoiceItems = []
    if (b.invoice_items) {
      try {
        parsedInvoiceItems = typeof b.invoice_items === 'string' ? JSON.parse(b.invoice_items) : b.invoice_items
      } catch { }
    }

    let trackingEvents = []
    try {
      trackingEvents = await query(
        'SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY event_time DESC, id DESC',
        [b.id]
      )
    } catch { }

    // Fetch adjacent active bookings (prev and next by id)
    let adjacent = { prev_id: null, next_id: null, prev_tracking: null, next_tracking: null, prev_order: null, next_order: null }
    try {
      const currentNumericId = parseInt(b.id) || b.id

      let prevRows = []
      try {
        prevRows = await query(
          `SELECT id, tracking_number, order_id FROM shipments 
           WHERE id < ? AND (is_trashed = 0 OR is_trashed IS NULL) 
           ORDER BY id DESC LIMIT 1`,
          [currentNumericId]
        )
      } catch {
        prevRows = await query(
          `SELECT id, tracking_number, order_id FROM shipments 
           WHERE id < ? 
           ORDER BY id DESC LIMIT 1`,
          [currentNumericId]
        )
      }

      if (prevRows && prevRows.length > 0) {
        adjacent.prev_id = prevRows[0].id
        adjacent.prev_tracking = prevRows[0].tracking_number
        adjacent.prev_order = prevRows[0].order_id
      }

      let nextRows = []
      try {
        nextRows = await query(
          `SELECT id, tracking_number, order_id FROM shipments 
           WHERE id > ? AND (is_trashed = 0 OR is_trashed IS NULL) 
           ORDER BY id ASC LIMIT 1`,
          [currentNumericId]
        )
      } catch {
        nextRows = await query(
          `SELECT id, tracking_number, order_id FROM shipments 
           WHERE id > ? 
           ORDER BY id ASC LIMIT 1`,
          [currentNumericId]
        )
      }

      if (nextRows && nextRows.length > 0) {
        adjacent.next_id = nextRows[0].id
        adjacent.next_tracking = nextRows[0].tracking_number
        adjacent.next_order = nextRows[0].order_id
      }
    } catch (adjErr) {
      console.error('Error fetching adjacent bookings:', adjErr.message)
    }

    return res.json({
      success: true,
      booking: {
        ...b,
        parcels: parsedParcels,
        invoice_items: parsedInvoiceItems,
        senders,
        receivers,
        courier_providers,
        vendor_api_configs,
        tracking_events: trackingEvents,
        adjacent
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Move selected booking(s) to Trash
 */
export const trashBookings = async (req, res) => {
  try {
    let ids = req.body.ids || []
    if (req.body.id) ids = [req.body.id]
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No shipment IDs provided' })
    }

    const placeholders = ids.map(() => '?').join(',')
    await execute(
      `UPDATE shipments SET is_trashed = 1, trashed_at = NOW() WHERE id IN (${placeholders})`,
      ids
    )

    return res.json({
      success: true,
      message: `Moved ${ids.length} shipment(s) to Trash`
    })
  } catch (error) {
    console.error('Error trashing bookings:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Restore selected booking(s) from Trash
 */
export const restoreBookings = async (req, res) => {
  try {
    let ids = req.body.ids || []
    if (req.body.id) ids = [req.body.id]
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No shipment IDs provided' })
    }

    const placeholders = ids.map(() => '?').join(',')
    await execute(
      `UPDATE shipments SET is_trashed = 0, trashed_at = NULL WHERE id IN (${placeholders})`,
      ids
    )

    return res.json({
      success: true,
      message: `Restored ${ids.length} shipment(s) from Trash`
    })
  } catch (error) {
    console.error('Error restoring bookings:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Permanently Delete selected booking(s)
 */
export const deletePermanentBookings = async (req, res) => {
  try {
    let ids = req.body.ids || []
    if (req.body.id) ids = [req.body.id]
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No shipment IDs provided' })
    }

    const placeholders = ids.map(() => '?').join(',')
    try {
      await execute(`DELETE FROM tracking_events WHERE shipment_id IN (${placeholders})`, ids)
    } catch { }

    await execute(
      `DELETE FROM shipments WHERE id IN (${placeholders})`,
      ids
    )

    return res.json({
      success: true,
      message: `Permanently deleted ${ids.length} shipment(s)`
    })
  } catch (error) {
    console.error('Error deleting bookings permanently:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, description, location } = req.body

    await execute(
      'UPDATE shipments SET status = ? WHERE id = ?',
      [status, id]
    )

    if (description) {
      await execute(
        `INSERT INTO tracking_events (shipment_id, status, description, location)
         VALUES (?, ?, ?, ?)`,
        [id, status, description, location || '']
      )
    }

    const rows = await query(
      'SELECT * FROM shipments WHERE id = ?',
      [id]
    )

    return res.json({
      success: true,
      booking: rows[0]
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

// Helper to fetch complete shipment details with sender & receiver for PDF generation
async function getFullShipmentContext(shipmentId) {
  const rows = await query(
    `SELECT s.*,
      snd.id as s_id, snd.name as s_name, snd.phone as s_phone, snd.phone_2 as s_phone_2, snd.email as s_email,
      snd.address as s_address, snd.city as s_city, snd.state as s_state, snd.pincode as s_pincode, snd.country as s_country,
      rcv.id as r_id, rcv.name as r_name, rcv.phone as r_phone, rcv.phone_2 as r_phone_2, rcv.email as r_email,
      rcv.address as r_address, rcv.city as r_city, rcv.state as r_state, rcv.pincode as r_pincode, rcv.country as r_country
     FROM shipments s
     LEFT JOIN senders snd ON s.sender_id = snd.id
     LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
     WHERE s.id = ? OR s.tracking_number = ? OR s.order_id = ? OR s.vendor_awb_number = ?`,
    [shipmentId, shipmentId, shipmentId, shipmentId]
  )
  if (!rows || rows.length === 0) return null
  const b = rows[0]

  const sender = {
    name: b.s_name || b.sender_name || '',
    company: b.sender_company || '',
    phone: b.s_phone || b.sender_phone || '',
    phone_2: b.s_phone_2 || b.sender_phone_2 || '',
    email: b.s_email || b.sender_email || '',
    address: b.s_address || b.sender_address || '',
    address_2: b.sender_address_2 || '',
    city: b.s_city || b.sender_city || '',
    state: b.s_state || b.sender_state || '',
    pincode: b.s_pincode || b.sender_pincode || '',
    country: b.s_country || b.sender_country || 'INDIA',
    gstin_type: b.sender_gstin_type || '',
    gstin_no: b.sender_gstin_no || ''
  }

  const receiver = {
    name: b.r_name || b.receiver_name || '',
    company: b.receiver_company || '',
    phone: b.r_phone || b.receiver_phone || '',
    phone_2: b.r_phone_2 || b.receiver_phone_2 || '',
    email: b.r_email || b.receiver_email || '',
    address: b.r_address || b.receiver_address || '',
    address_2: b.receiver_address_2 || '',
    city: b.r_city || b.receiver_city || '',
    state: b.r_state || b.receiver_state || '',
    pincode: b.r_pincode || b.receiver_pincode || '',
    country: b.r_country || b.receiver_country || '',
    gstin_type: b.receiver_gstin_type || '',
    gstin_no: b.receiver_gstin_no || ''
  }

  let parcels = []
  if (b.parcels) {
    try {
      parcels = typeof b.parcels === 'string' ? JSON.parse(b.parcels) : b.parcels
    } catch { }
  }

  let invoiceItems = []
  if (b.invoice_items) {
    try {
      invoiceItems = typeof b.invoice_items === 'string' ? JSON.parse(b.invoice_items) : b.invoice_items
    } catch { }
  }

  return { b, sender, receiver, parcels, invoiceItems }
}

export const getInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params
    const ctx = await getFullShipmentContext(id)
    if (!ctx) return res.status(404).json({ success: false, message: 'Shipment not found' })

    const pdfPath = await generateInvoicePdf({
      awbNumber: ctx.b.tracking_number,
      sender: ctx.sender,
      receiver: ctx.receiver,
      shipment: ctx.b,
      invoiceItems: ctx.invoiceItems,
      invoiceMeta: {
        invoice_no: ctx.b.invoice_no || ctx.b.tracking_number,
        invoice_type: ctx.b.invoice_type || 'INVOICE',
        currency: ctx.b.invoice_currency || 'INR',
        incoterms: ctx.b.terms_of_trade || 'CIF',
        note: ctx.b.invoice_note || '',
        total_amount: ctx.b.total_amount || ctx.b.declared_value || 0
      }
    })
    return res.download(pdfPath, `Invoice_${ctx.b.tracking_number}.pdf`)
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const getWaybillPdf = async (req, res) => {
  try {
    const { id } = req.params
    const ctx = await getFullShipmentContext(id)
    if (!ctx) return res.status(404).json({ success: false, message: 'Shipment not found' })

    const pdfPath = await generateWaybillPdf({
      awbNumber: ctx.b.tracking_number,
      sender: ctx.sender,
      receiver: ctx.receiver,
      shipment: ctx.b,
      parcels: ctx.parcels,
      invoiceItems: ctx.invoiceItems,
      invoiceMeta: {
        invoice_no: ctx.b.invoice_no || ctx.b.tracking_number
      }
    })
    return res.download(pdfPath, `Waybill_${ctx.b.tracking_number}.pdf`)
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const getBoxLabelsPdf = async (req, res) => {
  try {
    const { id } = req.params
    const ctx = await getFullShipmentContext(id)
    if (!ctx) return res.status(404).json({ success: false, message: 'Shipment not found' })

    const pdfPath = await generateBoxLabelsPdf({
      awbNumber: ctx.b.tracking_number,
      sender: ctx.sender,
      receiver: ctx.receiver,
      shipment: ctx.b,
      parcels: ctx.parcels
    })
    return res.download(pdfPath, `BoxLabels_${ctx.b.tracking_number}.pdf`)
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Stream/Open Vendor Label or Invoice PDF in browser tab.
 * Extracts base64 or file path from vendor response / DB and sends inline PDF.
 */
export const getVendorDocument = async (req, res) => {
  try {
    const { id } = req.params
    const reqType = String(req.query.type || req.query.docType || 'document').toLowerCase().trim()

    const rows = await query(
      'SELECT * FROM shipments WHERE id = ? OR tracking_number = ? OR order_id = ? OR vendor_awb_number = ?',
      [id, id, id, id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shipment not found' })
    }

    const b = rows[0]

    const serveBase64Pdf = (base64Str, filename) => {
      let clean = String(base64Str).replace(/^data:application\/pdf;base64,/, '').trim()
      const buffer = Buffer.from(clean, 'base64')
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="${filename || 'vendor_document.pdf'}"`)
      return res.send(buffer)
    }

    // 1. Check vendor_raw_response first for exact document matching
    if (b.vendor_raw_response) {
      let raw = b.vendor_raw_response
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw) } catch { }
      }

      if (raw && typeof raw === 'object') {
        const resp = raw.Response || raw.response || raw.data || raw

        // Check labels array (e.g. ITD / FlySwift / Trackmate)
        const labelsArr = Array.isArray(raw.labels) ? raw.labels : (Array.isArray(raw.data?.labels) ? raw.data.labels : (Array.isArray(resp?.labels) ? resp.labels : null))

        if (labelsArr && labelsArr.length > 0) {
          let matchedItem = null

          if (reqType.includes('invoice')) {
            matchedItem = labelsArr.find(l => {
              const fn = String(l?.filename || l?.file_name || l?.name || '').toLowerCase()
              return fn.includes('invoice') || l?.type === 'invoice' || l?.invoice
            })
          } else if (reqType.includes('box')) {
            matchedItem = labelsArr.find(l => {
              const fn = String(l?.filename || l?.file_name || l?.name || '').toLowerCase()
              return fn.includes('box') || fn.includes('label')
            })
          } else if (reqType.includes('label') || reqType.includes('shipper')) {
            matchedItem = labelsArr.find(l => {
              const fn = String(l?.filename || l?.file_name || l?.name || '').toLowerCase()
              return (fn.includes('shipper') || fn.includes('copy') || fn.includes('label') || fn.includes('waybill') || fn.includes('awb')) && !fn.includes('invoice')
            }) || labelsArr.find(l => {
              const fn = String(l?.filename || l?.file_name || l?.name || '').toLowerCase()
              return !fn.includes('invoice')
            })
          }

          if (!matchedItem) {
            matchedItem = labelsArr[0]
          }

          const b64 = matchedItem?.label || matchedItem?.pdf || matchedItem?.invoice || (typeof matchedItem === 'string' ? matchedItem : '')
          if (b64) return serveBase64Pdf(b64, `${reqType}_${b.tracking_number || b.id}.pdf`)
        }

        // Check Pacific Express / direct response properties
        if (reqType.includes('invoice')) {
          const invVal = resp.Pdfdownload || resp.pdfdownload || resp.PdfDownload || resp.Invoice || resp.invoice || resp.pdf || resp.Pdf ||
                         raw.Pdfdownload || raw.pdfdownload || raw.Invoice || raw.invoice
          if (invVal) {
            const valStr = String(invVal).trim()
            if (valStr.startsWith('http://') || valStr.startsWith('https://')) {
              return res.redirect(valStr)
            }
            return serveBase64Pdf(valStr, `Invoice_${b.tracking_number || b.id}.pdf`)
          }
        } else if (reqType.includes('box')) {
          const boxVal = resp.BoxLabel || resp.boxlabel || resp.Boxlabel || resp.box_label || resp.Label || resp.label ||
                         raw.BoxLabel || raw.boxlabel || raw.Label || raw.label
          if (boxVal) {
            const valStr = String(boxVal).trim()
            if (valStr.startsWith('http://') || valStr.startsWith('https://')) {
              return res.redirect(valStr)
            }
            return serveBase64Pdf(valStr, `BoxLabel_${b.tracking_number || b.id}.pdf`)
          }
        } else {
          // Label / document / shipper copy
          const lblVal = resp.BoxLabel || resp.boxlabel || resp.Label || resp.label || resp.AuxLbl || resp.auxlbl ||
                         resp.Pdfdownload || resp.pdfdownload || resp.Pdf || resp.pdf ||
                         raw.BoxLabel || raw.boxlabel || raw.Label || raw.label || raw.Pdfdownload || raw.pdfdownload
          if (lblVal) {
            const valStr = String(lblVal).trim()
            if (valStr.startsWith('http://') || valStr.startsWith('https://')) {
              return res.redirect(valStr)
            }
            return serveBase64Pdf(valStr, `Label_${b.tracking_number || b.id}.pdf`)
          }
        }
      }
    }

    // 2. Check vendor_label_url
    if (b.vendor_label_url && !reqType.includes('invoice')) {
      const vUrl = String(b.vendor_label_url).trim()
      if (vUrl.startsWith('data:application/pdf;base64,') || (vUrl.length > 200 && !vUrl.startsWith('http') && !vUrl.startsWith('/'))) {
        return serveBase64Pdf(vUrl, `VendorDoc_${b.tracking_number || b.id}.pdf`)
      }
      if (vUrl.startsWith('http://') || vUrl.startsWith('https://')) {
        return res.redirect(vUrl)
      }
      // Local file check
      const localPath = path.resolve(process.cwd(), vUrl.replace(/^\//, ''))
      if (fs.existsSync(localPath)) {
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `inline; filename="VendorDoc_${b.tracking_number || b.id}.pdf"`)
        return res.sendFile(localPath)
      }
      const backendLocalPath = path.resolve(__dirname, '..', '..', vUrl.replace(/^\//, ''))
      if (fs.existsSync(backendLocalPath)) {
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `inline; filename="VendorDoc_${b.tracking_number || b.id}.pdf"`)
        return res.sendFile(backendLocalPath)
      }
    }

    return res.status(404).json({
      success: false,
      message: `No vendor ${reqType} document returned by carrier API for this shipment.`
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Update billing and rate details on a shipment.
 * Works even after vendor push/lock if `allow_post_push_billing_edit` setting is enabled.
 * Also synchronizes the new financial figures immediately to the remote Hostinger AWBENTRY table.
 */
export const updateBookingBilling = async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body || {}

    // Find existing shipment
    const rows = await query(
      `SELECT s.*, 
        snd.name as s_name, snd.email as s_email, snd.phone as s_phone, 
        snd.address as s_address, snd.city as s_city, snd.state as s_state,
        snd.pincode as s_pincode, snd.country as s_country,
        rcv.name as r_name, rcv.email as r_email, rcv.phone as r_phone,
        rcv.address as r_address, rcv.city as r_city, rcv.state as r_state,
        rcv.pincode as r_pincode, rcv.country as r_country
       FROM shipments s
       LEFT JOIN senders snd ON s.sender_id = snd.id
       LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
       WHERE s.id = ?`,
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shipment not found' })
    }

    const current = rows[0]

    // If shipment is locked, verify if post-push billing edit feature is turned on in settings
    if (current.is_locked) {
      const allowed = await isSettingEnabled('allow_post_push_billing_edit', true)
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'Post-push billing editing is currently disabled in Settings. Turn on "Allow Post-Push Billing Edit" in Settings to modify locked shipments.'
        })
      }
    }

    // Extract updated billing parameters
    const finalChgWt = body.final_chargeable_weight !== undefined
      ? parseFloat(body.final_chargeable_weight) || 0
      : (parseFloat(current.final_chargeable_weight) || parseFloat(current.chargeable_weight) || 0)

    const ratePerKg = body.rate_per_kg !== undefined
      ? parseFloat(body.rate_per_kg) || 0
      : (parseFloat(current.rate_per_kg) || 0)

    const shippingCharge = body.shipping_charge !== undefined
      ? parseFloat(body.shipping_charge) || 0
      : (parseFloat(current.shipping_charge) || 0)

    const extraCharge = body.extra_charge !== undefined
      ? parseFloat(body.extra_charge) || 0
      : (parseFloat(current.extra_charge) || 0)

    const totalAmount = body.total_amount !== undefined
      ? parseFloat(body.total_amount) || 0
      : (parseFloat(current.total_amount) || (shippingCharge + extraCharge))

    // Update the local shipments table
    await execute(
      `UPDATE shipments SET
        final_chargeable_weight = ?,
        chargeable_weight = ?,
        rate_per_kg = ?,
        shipping_charge = ?,
        extra_charge = ?,
        total_amount = ?
       WHERE id = ?`,
      [
        finalChgWt,
        finalChgWt > 0 ? Math.ceil(finalChgWt) : 0,
        ratePerKg,
        shippingCharge,
        extraCharge,
        totalAmount,
        id
      ]
    )

    // Fetch updated shipment object
    const updatedRows = await query(
      `SELECT s.*, 
        snd.name as s_name, snd.email as s_email, snd.phone as s_phone, 
        snd.address as s_address, snd.city as s_city, snd.state as s_state,
        snd.pincode as s_pincode, snd.country as s_country,
        rcv.name as r_name, rcv.email as r_email, rcv.phone as r_phone,
        rcv.address as r_address, rcv.city as r_city, rcv.state as r_state,
        rcv.pincode as r_pincode, rcv.country as r_country,
        vac.name as vendor_name, vac.vendor_code as vac_vendor_code,
        vac.auth_credentials as vac_auth_credentials, vac.available_services as vac_services
       FROM shipments s
       LEFT JOIN senders snd ON s.sender_id = snd.id
       LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
       LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
       WHERE s.id = ?`,
      [id]
    )

    const updatedShipment = updatedRows[0] || {}

    // Synchronize the updated billing immediately to remote Hostinger AWBENTRY
    let remoteSyncSuccess = false
    try {
      const syncResult = await syncToRemoteAwbEntry(updatedShipment)
      remoteSyncSuccess = syncResult?.success ?? true
    } catch (syncErr) {
      console.error('[Remote AWBENTRY Billing Sync Error]:', syncErr.message)
    }

    return res.json({
      success: true,
      message: 'Billing details updated successfully' + (remoteSyncSuccess ? ' and synced to remote AWBENTRY' : ''),
      booking: updatedShipment
    })
  } catch (err) {
    console.error('Error updating booking billing:', err)
    return res.status(500).json({ success: false, message: 'Failed to update billing details' })
  }
}
