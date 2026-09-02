import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

let remotePool = null

/**
 * Get or initialize the MySQL connection pool to the remote Hostinger database.
 * Uses strict timeouts and small pool size to guarantee non-blocking operations.
 */
function getRemotePool() {
  if (!remotePool) {
    const isEnabled = process.env.REMOTE_DB_ENABLED !== 'false'
    if (!isEnabled) {
      return null
    }

    const host = process.env.REMOTE_DB_HOST || 'srv1874.hstgr.io'
    const port = parseInt(process.env.REMOTE_DB_PORT) || 3306
    const user = process.env.REMOTE_DB_USER || 'u364134727_wH76a'
    const password = process.env.REMOTE_DB_PASSWORD || 'OjM8oc93hH'
    const database = process.env.REMOTE_DB_NAME || 'u364134727_nwNLR'

    remotePool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 8000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    })
  }
  return remotePool
}

/**
 * Helper to resolve 2-letter country code
 */
function resolveCountryCode(country) {
  if (!country) return 'IN'
  const c = String(country).trim().toUpperCase()
  if (c === 'INDIA' || c === 'IND' || c === 'IN') return 'IN'
  if (c === 'UNITED ARAB EMIRATES' || c === 'UAE' || c === 'AE') return 'AE'
  if (c === 'UNITED STATES' || c === 'USA' || c === 'US' || c === 'UNITED STATES OF AMERICA') return 'US'
  if (c === 'UNITED KINGDOM' || c === 'UK' || c === 'GB' || c === 'GREAT BRITAIN') return 'GB'
  if (c === 'CANADA' || c === 'CA') return 'CA'
  if (c === 'AUSTRALIA' || c === 'AU') return 'AU'
  if (c === 'FRANCE' || c === 'FR') return 'FR'
  if (c === 'GERMANY' || c === 'DE') return 'DE'
  if (c.length === 2) return c
  return c.slice(0, 10)
}

/**
 * Resolve full country name for DESTNAME display in remote ERP.
 * Maps both 2-letter ISO codes and full names to the canonical display name.
 */
function resolveCountryName(country) {
  if (!country) return 'INDIA'
  const c = String(country).trim().toUpperCase()

  const COUNTRY_MAP = {
    'IN': 'INDIA', 'IND': 'INDIA', 'INDIA': 'INDIA',
    'US': 'UNITED STATES', 'USA': 'UNITED STATES', 'UNITED STATES': 'UNITED STATES', 'UNITED STATES OF AMERICA': 'UNITED STATES',
    'AE': 'UNITED ARAB EMIRATES', 'UAE': 'UNITED ARAB EMIRATES', 'UNITED ARAB EMIRATES': 'UNITED ARAB EMIRATES',
    'GB': 'UNITED KINGDOM', 'UK': 'UNITED KINGDOM', 'UNITED KINGDOM': 'UNITED KINGDOM', 'GREAT BRITAIN': 'UNITED KINGDOM',
    'CA': 'CANADA', 'CANADA': 'CANADA',
    'AU': 'AUSTRALIA', 'AUSTRALIA': 'AUSTRALIA',
    'FR': 'FRANCE', 'FRANCE': 'FRANCE',
    'DE': 'GERMANY', 'GERMANY': 'GERMANY',
    'SA': 'SAUDI ARABIA', 'SAUDI ARABIA': 'SAUDI ARABIA',
    'SG': 'SINGAPORE', 'SINGAPORE': 'SINGAPORE',
    'MY': 'MALAYSIA', 'MALAYSIA': 'MALAYSIA',
    'NP': 'NEPAL', 'NEPAL': 'NEPAL',
    'BD': 'BANGLADESH', 'BANGLADESH': 'BANGLADESH',
    'LK': 'SRI LANKA', 'SRI LANKA': 'SRI LANKA',
    'CN': 'CHINA', 'CHINA': 'CHINA',
    'JP': 'JAPAN', 'JAPAN': 'JAPAN',
    'KR': 'SOUTH KOREA', 'SOUTH KOREA': 'SOUTH KOREA',
    'NZ': 'NEW ZEALAND', 'NEW ZEALAND': 'NEW ZEALAND',
    'ZA': 'SOUTH AFRICA', 'SOUTH AFRICA': 'SOUTH AFRICA',
    'NG': 'NIGERIA', 'NIGERIA': 'NIGERIA',
    'KE': 'KENYA', 'KENYA': 'KENYA',
    'QA': 'QATAR', 'QATAR': 'QATAR',
    'BH': 'BAHRAIN', 'BAHRAIN': 'BAHRAIN',
    'KW': 'KUWAIT', 'KUWAIT': 'KUWAIT',
    'OM': 'OMAN', 'OMAN': 'OMAN',
    'HK': 'HONG KONG', 'HONG KONG': 'HONG KONG',
    'TH': 'THAILAND', 'THAILAND': 'THAILAND',
    'PH': 'PHILIPPINES', 'PHILIPPINES': 'PHILIPPINES',
    'ID': 'INDONESIA', 'INDONESIA': 'INDONESIA',
    'IT': 'ITALY', 'ITALY': 'ITALY',
    'ES': 'SPAIN', 'SPAIN': 'SPAIN',
    'NL': 'NETHERLANDS', 'NETHERLANDS': 'NETHERLANDS',
    'SE': 'SWEDEN', 'SWEDEN': 'SWEDEN',
    'CH': 'SWITZERLAND', 'SWITZERLAND': 'SWITZERLAND',
    'BE': 'BELGIUM', 'BELGIUM': 'BELGIUM',
    'AT': 'AUSTRIA', 'AUSTRIA': 'AUSTRIA'
  }

  return COUNTRY_MAP[c] || c
}

import { query } from '../config/db.js'

/**
 * Helper to resolve vendor code, name, service id, and auth details for remote ERP.
 * Matches vendor codes, names, or service codes (e.g. 1007, 1019, 1020, 1021, 1022, 1001, 1008).
 */
export function resolveVendorDetails(vendorCode, vendorName, serviceCode = null, authCredentials = null) {
  const code = (vendorCode || '').toLowerCase().trim()
  const name = (vendorName || '').toLowerCase().trim()
  const svcStr = (serviceCode !== undefined && serviceCode !== null) ? String(serviceCode).toLowerCase().trim() : ''
  const svcInt = parseInt(svcStr) || 0

  // Parse authCredentials if provided (string or object)
  let creds = {}
  if (authCredentials) {
    if (typeof authCredentials === 'string') {
      try { creds = JSON.parse(authCredentials) } catch {}
    } else if (typeof authCredentials === 'object') {
      creds = authCredentials
    }
  }

  // Helper to extract credentials by various key names
  const getCred = (...keys) => {
    for (const k of keys) {
      if (creds && creds[k]) return String(creds[k]).trim()
    }
    return ''
  }

  // 1. Pacific Courier / Pace
  if (
    code === 'pc' || code.includes('pacific') || code.includes('pacifc') ||
    name.includes('pacific') || name.includes('pacifc') ||
    svcInt === 1007 || svcInt === 1008 ||
    svcStr.includes('pacific') || svcStr.includes('pace')
  ) {
    const isPace = code.includes('pace') || name.includes('pace') || svcInt === 1008
    return {
      vendCode: isPace ? 'PACE' : 'PACIFIC',
      vendName: isPace ? 'PACE GROUP' : 'PACIFIC',
      service: svcInt > 0 ? svcInt : (isPace ? 1008 : 1007),
      autotrack: 1,
      accode: getCred('accode', 'customer_code', 'acc_code', 'userId', 'UserID') || 'P0503',
      tuser: getCred('tuser', 'username', 'user', 'UserID', 'userId') || 'P0503',
      tpass: getCred('tpass', 'password', 'Password') || 'P0503@7199',
      apikey: getCred('apikey', 'api_key', 'apiKey') || ''
    }
  }

  // 2. Bhabani Express
  if (
    code.includes('bhabani') || code.includes('bhavani') ||
    name.includes('bhabani') || name.includes('bhavani') ||
    svcInt === 1021 || svcStr.includes('bhabani') || svcStr.includes('bhavani')
  ) {
    return {
      vendCode: 'BHABANI',
      vendName: 'BHABANI',
      service: svcInt > 0 ? svcInt : 1021,
      autotrack: 1,
      accode: getCred('accode', 'customer_code', 'acc_code') || 'T001',
      tuser: getCred('tuser', 'username') || '',
      tpass: getCred('tpass', 'password') || '',
      apikey: getCred('apikey', 'api_key') || ''
    }
  }

  // 3. ACX International
  if (
    code === 'acx' || code.includes('acx') ||
    name.includes('acx') ||
    svcInt === 1020 || svcStr.includes('acx')
  ) {
    return {
      vendCode: 'ACX',
      vendName: 'ACX',
      service: svcInt > 0 ? svcInt : 1020,
      autotrack: 1,
      accode: getCred('accode', 'customer_code', 'acc_code') || 'A0872',
      tuser: getCred('tuser', 'username') || '',
      tpass: getCred('tpass', 'password') || '',
      apikey: getCred('apikey', 'api_key') || ''
    }
  }

  // 4. FlySwift / TrackMate
  if (
    code === 'fm' || code.includes('flyswift') || code.includes('trackmate') || code.includes('fly') ||
    name.includes('flyswift') || name.includes('trackmate') || name.includes('fly') ||
    svcInt === 1019 || svcStr.includes('flyswift') || svcStr.includes('trackmate')
  ) {
    return {
      vendCode: 'FLYSWIFT',
      vendName: 'FLYSWIFT',
      service: svcInt > 0 ? svcInt : 1019,
      autotrack: 1,
      accode: getCred('accode', 'customer_code', 'acc_code') || '1032',
      tuser: getCred('tuser', 'username') || '',
      tpass: getCred('tpass', 'password') || '',
      apikey: getCred('apikey', 'api_key') || ''
    }
  }

  // 5. Sairaj International
  if (
    code.includes('sairaj') || name.includes('sairaj') ||
    svcInt === 1022 || svcInt === 1009 || svcStr.includes('sairaj')
  ) {
    return {
      vendCode: 'SAIRAJ',
      vendName: 'SAIRAJ',
      service: svcInt > 0 ? svcInt : 1022,
      autotrack: 1,
      accode: getCred('accode', 'customer_code', 'acc_code') || '44',
      tuser: getCred('tuser', 'username') || '',
      tpass: getCred('tpass', 'password') || '',
      apikey: getCred('apikey', 'api_key') || ''
    }
  }

  // 6. Sain Express
  if (
    code.includes('sain') || name.includes('sain') ||
    svcInt === 1001 || svcStr.includes('sain')
  ) {
    return {
      vendCode: 'SAIN',
      vendName: 'SAIN',
      service: svcInt > 0 ? svcInt : 1001,
      autotrack: 1,
      accode: getCred('accode', 'customer_code', 'acc_code') || '',
      tuser: getCred('tuser', 'username') || '',
      tpass: getCred('tpass', 'password') || '',
      apikey: getCred('apikey', 'api_key') || ''
    }
  }

  // Fallback / custom service resolution
  const finalSvc = svcInt > 0 ? svcInt : 0
  const finalCode = (vendorCode || 'PXC').toUpperCase()
  const finalName = (vendorName || vendorCode || 'PXC').toUpperCase()

  return {
    vendCode: finalCode,
    vendName: finalName,
    service: finalSvc,
    autotrack: 1,
    accode: getCred('accode', 'customer_code', 'acc_code') || '',
    tuser: getCred('tuser', 'username') || '',
    tpass: getCred('tpass', 'password') || '',
    apikey: getCred('apikey', 'api_key') || ''
  }
}

/**
 * Insert or update a shipment in the remote AWBENTRY table.
 * 
 * IMPORTANT: Column-to-parameter alignment is CRITICAL. Every column in the SQL
 * must map 1:1 to its corresponding parameter value in the exact same position.
 * 
 * AWBENTRY field mapping (receiver section):
 *   CNEENAME      → receiverName
 *   CNEEADDRESS1  → receiverAddress1 (main address line)
 *   CNEEADDRESS2  → receiverAddress2 (address line 2)
 *   CNEEADDRESS3  → receiverState
 *   CNEEADDRESS4  → receiverCountry (destination country name)
 *   CNEEPINCODE   → receiverPincode
 *   CNEECITY      → receiverCity
 *   CNEEPHONE1    → receiverPhone
 *   CNEEPHONE2    → (empty)
 *
 * @param {Object} shipment - Full shipment object with sender/receiver fields
 * @param {Object} vendorResult - Vendor API push result (awbNumber, etc.)
 */
export async function syncToRemoteAwbEntry(shipment, vendorResult = {}) {
  try {
    const pool = getRemotePool()
    if (!pool) {
      console.log('[Remote AWBENTRY Sync] Skipped — Remote DB is disabled.')
      return { success: false, message: 'Remote DB disabled' }
    }

    const trackingNumber = shipment.tracking_number || shipment.order_id || ''
    const awbNo = parseInt(String(trackingNumber).replace(/\D/g, '')) || 0
    if (!awbNo) {
      console.warn('[Remote AWBENTRY Sync] Skipped — Invalid tracking number for AWBNO:', trackingNumber)
      return { success: false, message: 'Invalid AWBNO' }
    }

    // ── Extract Sender Fields ──
    const sender = shipment.senders || shipment.sender || {}

    const senderName = shipment.s_name || sender.name || shipment.sender_name || shipment.sender_company || ''
    const senderAddress1 = shipment.s_address || sender.address || shipment.sender_address || ''
    const senderAddress2 = shipment.sender_address_2 || shipment.s_address_2 || ''
    const senderState = shipment.s_state || sender.state || shipment.sender_state || ''
    const senderCity = shipment.s_city || sender.city || shipment.sender_city || 'SURAT'
    const senderPincode = shipment.s_pincode || sender.pincode || shipment.sender_pincode || ''
    const senderPhone = shipment.s_phone || sender.phone || shipment.sender_phone || '0'
    const senderCountry = shipment.s_country || sender.country || shipment.sender_country || 'INDIA'

    // GSTIN / Aadhar detection
    const senderGstinType = (shipment.sender_gstin_type || '').trim()
    const senderGstinNo = (shipment.sender_gstin_no || '').trim()
    // Match any variant: Aadhaar, Aadhar, AADHAR, aadhaar, etc.
    const isAadhar = /aadh/i.test(senderGstinType)
    const aadharNo = isAadhar ? senderGstinNo.replace(/\D/g, '') : ''
    const gstNo = /gst/i.test(senderGstinType) ? senderGstinNo : ''

    // ── Extract Receiver Fields ──
    const receiver = shipment.receivers || shipment.receiver || {}

    const receiverName = shipment.r_name || receiver.name || shipment.receiver_name || shipment.receiver_company || ''
    const receiverAddress1 = shipment.r_address || receiver.address || shipment.receiver_address || ''
    const receiverAddress2 = shipment.receiver_address_2 || shipment.r_address_2 || ''
    const receiverState = shipment.r_state || receiver.state || shipment.receiver_state || ''
    const receiverCity = shipment.r_city || receiver.city || shipment.receiver_city || ''
    const receiverPincode = shipment.r_pincode || receiver.pincode || shipment.receiver_pincode || ''
    const receiverPhone = shipment.r_phone || receiver.phone || shipment.receiver_phone || ''
    const receiverCountry = shipment.r_country || receiver.country || shipment.receiver_country || ''

    const destCode = resolveCountryCode(receiverCountry)
    const destName = resolveCountryName(receiverCountry)

    // ── Financial / Weight Fields ──
    const weight = parseFloat(shipment.weight) || 0
    const finalChgWt = parseFloat(shipment.final_chargeable_weight) || parseFloat(shipment.chargeable_weight) || (weight > 0 ? weight : 0)
    const chargeableWeight = finalChgWt > 0 ? Math.ceil(finalChgWt) : 0
    const shippingCharge = parseFloat(shipment.shipping_charge) || 0
    const extraCharge = parseFloat(shipment.extra_charge) || 0
    const totalAmount = parseFloat(shipment.total_amount) || (shippingCharge + extraCharge)
    const rate = parseFloat(shipment.rate_per_kg) || (chargeableWeight > 0 && shippingCharge > 0 ? Math.round((shippingCharge / chargeableWeight) * 100) / 100 : 0)

    const paymentMode = String(shipment.payment_mode || 'prepaid').toLowerCase()
    const paymentType = paymentMode === 'cod' ? 1 : (paymentMode === 'credit' ? 2 : 0)
    const receiptAmount = paymentMode === 'prepaid' ? totalAmount : 0

    const bookingDate = shipment.booking_date || shipment.invoice_date || (shipment.created_at ? String(shipment.created_at).split('T')[0] : new Date().toISOString().split('T')[0])
    const pieces = parseInt(shipment.no_of_pieces) || 1

    // ── Resolve Vendor & Service Details ──
    let vendorName = shipment.vendor_name || ''
    let vendorCode = shipment.vendor_code || shipment.vac_vendor_code || ''
    let serviceCode = shipment.service_code || ''
    let authCredentials = shipment.vac_auth_credentials || null

    if (shipment.vendor_config_id && (!vendorName || !vendorCode || !serviceCode)) {
      try {
        const configRows = await query(
          'SELECT name, vendor_code, available_services, auth_credentials FROM vendor_api_configs WHERE id = ? LIMIT 1',
          [shipment.vendor_config_id]
        )
        if (configRows && configRows.length > 0) {
          const cfg = configRows[0]
          if (!vendorName) vendorName = cfg.name || ''
          if (!vendorCode) vendorCode = cfg.vendor_code || ''
          if (!authCredentials) authCredentials = cfg.auth_credentials
          if (!serviceCode && cfg.available_services) {
            let svcs = cfg.available_services
            if (typeof svcs === 'string') {
              try { svcs = JSON.parse(svcs) } catch {}
            }
            if (Array.isArray(svcs) && svcs.length > 0) {
              serviceCode = svcs[0].code || svcs[0].id || svcs[0].service || ''
            }
          }
        }
      } catch (err) {
        console.warn('[Remote AWBENTRY Sync] Failed to fetch vendor_api_configs from local DB:', err.message)
      }
    }

    const vendorAwb = shipment.vendor_awb_number || vendorResult.awbNumber || ''
    const vendorAwb2 = shipment.vendor_awb_number_2 || ''
    const vendorDetails = resolveVendorDetails(vendorCode, vendorName, serviceCode, authCredentials)
    const productCode = shipment.product_code || 'SPX'

    // ── Debug log to verify mappings ──
    console.log(`[Remote AWBENTRY Sync] Mapping for AWBNO ${awbNo}:`, JSON.stringify({
      VENDCODE: vendorDetails.vendCode,
      VENDNAME: vendorDetails.vendName,
      SERVICE: vendorDetails.service,
      ACCODE: vendorDetails.accode,
      VENDORAWB1: vendorAwb,
      DESTCODE: destCode,
      DESTNAME: destName,
      CNEECITY: receiverCity,
      CNEEPINCODE: receiverPincode,
      CNEEPHONE1: receiverPhone,
      CNEEADDRESS4: destName,
      CHARGEWEIGHT: chargeableWeight,
      RATE: rate,
      CHARGES: shippingCharge,
      ADJUSTMENT: extraCharge,
      TOTAL: totalAmount,
      vendor_code_raw: vendorCode,
      service_code_raw: serviceCode
    }))

    // Resolve customer code (ID) and customer name
    let custCode = 'W001'
    let custName = 'WALKING CUSTOMER'

    const isWalkin = shipment.customer_type === 'walkin' || (!shipment.customer_id && !shipment.customer_name)

    if (!isWalkin && shipment.customer_id) {
      custCode = String(shipment.customer_id)
      custName = (shipment.customer_name || shipment.sender_name || shipment.sender_company || 'CUSTOMER').toUpperCase()
    } else if (!isWalkin && shipment.customer_name && shipment.customer_name !== 'Walk-in Customer') {
      custName = shipment.customer_name.toUpperCase()
    } else if (!isWalkin && (shipment.sender_email || shipment.sender_phone)) {
      try {
        const [custRows] = await pool.query(
          'SELECT id, name, company FROM tbl_customers WHERE (email != "" AND email IS NOT NULL AND LOWER(TRIM(email)) = ?) OR (phone != "" AND phone IS NOT NULL AND TRIM(phone) = ?) LIMIT 1',
          [(shipment.sender_email || '').trim().toLowerCase(), (shipment.sender_phone || '').trim()]
        )
        if (custRows && custRows.length > 0) {
          custCode = String(custRows[0].id)
          custName = (custRows[0].name || custRows[0].company || shipment.sender_name || 'CUSTOMER').toUpperCase()
        }
      } catch (custErr) {
        console.warn('[Remote AWBENTRY] Customer resolution notice:', custErr.message)
      }
    }

    // Check if AWBNO already exists in remote AWBENTRY
    const [existingRows] = await pool.execute('SELECT AWBID, AWBNO, VENDORAWB1 FROM AWBENTRY WHERE AWBNO = ? LIMIT 1', [awbNo])

    if (existingRows.length > 0) {
      // ── UPDATE existing record ──
      const finalVendorAwb = vendorAwb || existingRows[0].VENDORAWB1 || String(awbNo)
      console.log(`[Remote AWBENTRY Sync] AWBNO ${awbNo} already exists (AWBID: ${existingRows[0].AWBID}). Updating...`)

      await pool.execute(
        `UPDATE AWBENTRY SET
          AWBDATE = ?, CARTONS = ?, ORIGIN = ?, CUSTCODE = ?, CUSTNAME = ?,
          SNAME = ?, SADDRESS1 = ?, SADDRESS2 = ?, SADDRESS3 = ?,
          SCITY = ?, SPINCODE = ?, SPHONE1 = ?, SPHONE2 = ?, SAADHARNO = ?,
          PRODCODE = ?, PRODNAME = ?, VENDCODE = ?, VENDNAME = ?, DESTCODE = ?, DESTNAME = ?,
          CNEENAME = ?, CNEEADDRESS1 = ?, CNEEADDRESS2 = ?, CNEEADDRESS3 = ?,
          CNEEADDRESS4 = ?, CNEEPINCODE = ?, CNEECITY = ?, CNEEPHONE1 = ?, CNEEPHONE2 = ?,
          PAYMENTTYPE = ?, ACTUALWEIGHT = ?, CHARGEWEIGHT = ?, RATE = ?, CHARGES = ?,
          ADJUSTMENT = ?, TOTAL = ?, NETAMOUNT = ?,
          VENDORAWB1 = ?, VENDORAWB2 = ?, REMARKS = ?, RECEIPTAMOUNT = ?,
          GSTNO = ?, GSTTYPE = ?,
          SERVICE = ?, AUTOTRACK = ?, TUSER = ?, TPASS = ?, ACCODE = ?, APIKEY = ?
        WHERE AWBNO = ?`,
        [
          // Row 1: Date, pieces, origin, customer
          bookingDate,              // AWBDATE
          pieces,                   // CARTONS
          'SRT',                    // ORIGIN
          custCode,                 // CUSTCODE
          custName,                 // CUSTNAME

          // Row 2: Sender details
          senderName,               // SNAME
          senderAddress1,           // SADDRESS1
          senderAddress2,           // SADDRESS2
          senderState,              // SADDRESS3
          senderCity,               // SCITY
          senderPincode,            // SPINCODE
          senderPhone,              // SPHONE1
          '',                       // SPHONE2  (always empty)
          aadharNo || null,         // SAADHARNO

          // Row 3: Product & Vendor
          productCode,              // PRODCODE
          productCode,              // PRODNAME
          vendorDetails.vendCode,   // VENDCODE
          vendorDetails.vendName,   // VENDNAME
          destCode,                 // DESTCODE  (2-letter code: US, GB, AE, etc.)
          destName,                 // DESTNAME  (full name: UNITED STATES, etc.)

          // Row 4: Consignee / Receiver
          receiverName,             // CNEENAME
          receiverAddress1,         // CNEEADDRESS1
          receiverAddress2,         // CNEEADDRESS2
          receiverState,            // CNEEADDRESS3  (state)
          destName,                 // CNEEADDRESS4  (country name for display)
          receiverPincode,          // CNEEPINCODE
          receiverCity,             // CNEECITY
          receiverPhone,            // CNEEPHONE1
          '',                       // CNEEPHONE2

          // Row 5: Payment & Weight
          paymentType,              // PAYMENTTYPE
          weight,                   // ACTUALWEIGHT
          chargeableWeight,         // CHARGEWEIGHT (ceiled)
          rate,                     // RATE
          shippingCharge,           // CHARGES

          // Row 6: Amounts
          extraCharge,              // ADJUSTMENT
          totalAmount,              // TOTAL
          totalAmount,              // NETAMOUNT

          // Row 7: AWBs, remarks
          finalVendorAwb,           // VENDORAWB1
          vendorAwb2,               // VENDORAWB2
          shipment.content_description || shipment.remarks || '',  // REMARKS
          receiptAmount,            // RECEIPTAMOUNT

          // Row 8: GST
          gstNo || null,            // GSTNO
          /gst/i.test(senderGstinType) ? 1 : 0,  // GSTTYPE

          // Row 9: Vendor tracking config
          vendorDetails.service,    // SERVICE
          vendorDetails.autotrack,  // AUTOTRACK
          vendorDetails.tuser,      // TUSER
          vendorDetails.tpass,      // TPASS
          vendorDetails.accode,     // ACCODE
          vendorDetails.apikey,     // APIKEY

          // WHERE clause
          awbNo                     // WHERE AWBNO = ?
        ]
      )
      console.log(`[Remote AWBENTRY Sync] Successfully updated AWBNO ${awbNo} in remote DB.`)
      return { success: true, action: 'updated', awbNo }
    }

    // ── INSERT new record into AWBENTRY ──
    console.log(`[Remote AWBENTRY Sync] Inserting new AWBNO ${awbNo} into remote AWBENTRY...`)
    const insertSql = `
      INSERT INTO AWBENTRY (
        DESTINATIONTYPE, AWBNO, AWBDATE, CARTONS, ORIGIN, CUSTCODE, CUSTNAME,
        SNAME, SADDRESS1, SADDRESS2, SADDRESS3, SCITY, SPINCODE, SPHONE1, SPHONE2, SAADHARNO,
        PRODCODE, PRODNAME, VENDCODE, VENDNAME, DESTCODE, DESTNAME,
        CNEENAME, CNEEADDRESS1, CNEEADDRESS2, CNEEADDRESS3, CNEEADDRESS4,
        CNEEPINCODE, CNEECITY, CNEEPHONE1, CNEEPHONE2,
        PAYMENTTYPE, ACTUALWEIGHT, CHARGEWEIGHT, RATE, CHARGES,
        SERVICECHARGE, COMMCHARGE, TOTAL, ADJUSTMENT, SURCHARGE, SERVICETAX, NETAMOUNT,
        VENDORAWB1, VENDORAWB2, REMARKS, RECEIPTAMOUNT,
        SGST, CGST, IGST, GSTNO, GSTTYPE,
        ENTRYTYPE, DOWNLOAD, BRANCHCODE, ALIAS, TCCSLABEL, SERVICE, AUTOTRACK, PODTOWEB, SHOWFWD, BOOKINGMAIL,
        TUSER, TPASS, ACCODE, APIKEY
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `

    const params = [
      // Row 1: Header info (7 values)
      0,                          // DESTINATIONTYPE (0 = International)
      awbNo,                      // AWBNO
      bookingDate,                // AWBDATE
      pieces,                     // CARTONS
      'SRT',                      // ORIGIN
      custCode,                   // CUSTCODE
      custName,                   // CUSTNAME

      // Row 2: Sender details (9 values)
      senderName,                 // SNAME
      senderAddress1,             // SADDRESS1
      senderAddress2,             // SADDRESS2
      senderState,                // SADDRESS3
      senderCity,                 // SCITY
      senderPincode,              // SPINCODE
      senderPhone,                // SPHONE1
      '',                         // SPHONE2  (always empty)
      aadharNo || null,           // SAADHARNO

      // Row 3: Product & Vendor (6 values)
      productCode,                // PRODCODE
      productCode,                // PRODNAME
      vendorDetails.vendCode,     // VENDCODE
      vendorDetails.vendName,     // VENDNAME
      destCode,                   // DESTCODE  (2-letter: US, GB, AE, etc.)
      destName,                   // DESTNAME  (full: UNITED STATES, etc.)

      // Row 4: Receiver / Consignee (9 values)
      receiverName,               // CNEENAME
      receiverAddress1,           // CNEEADDRESS1
      receiverAddress2,           // CNEEADDRESS2
      receiverState,              // CNEEADDRESS3  (receiver state)
      destName,                   // CNEEADDRESS4  (receiver country name)
      receiverPincode,            // CNEEPINCODE
      receiverCity,               // CNEECITY
      receiverPhone,              // CNEEPHONE1
      '',                         // CNEEPHONE2  (empty)

      // Row 5: Payment & Weight (5 values)
      paymentType,                // PAYMENTTYPE
      weight,                     // ACTUALWEIGHT (exact decimal)
      chargeableWeight,           // CHARGEWEIGHT (ceiled integer)
      rate,                       // RATE
      shippingCharge,             // CHARGES

      // Row 6: Service charges & totals (7 values)
      0.00,                       // SERVICECHARGE
      0.00,                       // COMMCHARGE
      totalAmount,                // TOTAL
      extraCharge,                // ADJUSTMENT
      0.00,                       // SURCHARGE
      0.00,                       // SERVICETAX
      totalAmount,                // NETAMOUNT

      // Row 7: Vendor AWB & Remarks (4 values)
      vendorAwb || String(awbNo), // VENDORAWB1
      vendorAwb2,                 // VENDORAWB2
      shipment.content_description || shipment.remarks || '',  // REMARKS
      receiptAmount,              // RECEIPTAMOUNT

      // Row 8: GST (5 values)
      0.00,                       // SGST
      0.00,                       // CGST
      0.00,                       // IGST
      gstNo || null,              // GSTNO
      /gst/i.test(senderGstinType) ? 1 : 0,  // GSTTYPE

      // Row 9: System fields (10 values)
      0,                          // ENTRYTYPE
      0,                          // DOWNLOAD
      '',                         // BRANCHCODE
      'MTX',                      // ALIAS
      0,                          // TCCSLABEL
      vendorDetails.service,      // SERVICE  (e.g. 1007 for Pacific)
      vendorDetails.autotrack,    // AUTOTRACK
      0,                          // PODTOWEB
      0,                          // SHOWFWD
      0,                          // BOOKINGMAIL

      // Row 10: Auth details (4 values)
      vendorDetails.tuser,        // TUSER
      vendorDetails.tpass,        // TPASS
      vendorDetails.accode,       // ACCODE
      vendorDetails.apikey        // APIKEY
    ]

    const [result] = await pool.execute(insertSql, params)
    console.log(`[Remote AWBENTRY Sync] Successfully inserted AWBNO ${awbNo} (AWBID: ${result.insertId}) into remote DB.`)

    return { success: true, action: 'inserted', awbId: result.insertId, awbNo }
  } catch (err) {
    console.error('[Remote AWBENTRY Sync] Error syncing to AWBENTRY:', err.message)
    // Non-blocking: return error info without crashing
    return { success: false, error: err.message }
  }
}

/**
 * Insert an entry into the remote parcel_history table (Hostinger DB).
 * 
 * Schema:
 * - HISTORYID (int(11) AUTO_INCREMENT)
 * - AWBNO (int(11))
 * - date (date)
 * - time (time)
 * - activity (varchar(30))
 * - location (varchar(30))
 * 
 * @param {Object} shipment - Shipment or booking object
 * @param {string} activity - Status/activity text e.g. 'SHIPMENT BOOKED' (max 30 chars)
 * @param {string} location - Location string e.g. 'SURAT' (max 30 chars)
 */
export async function syncToRemoteParcelHistory(shipment, activity = 'SHIPMENT BOOKED', location = '') {
  try {
    const pool = getRemotePool()
    if (!pool) {
      console.log('[Remote parcel_history Sync] Skipped — Remote DB is disabled.')
      return { success: false, message: 'Remote DB disabled' }
    }

    const trackingNumber = shipment.tracking_number || shipment.order_id || ''
    const awbNo = parseInt(String(trackingNumber).replace(/\D/g, '')) || 0
    if (!awbNo) {
      console.warn('[Remote parcel_history Sync] Skipped — Invalid tracking number for AWBNO:', trackingNumber)
      return { success: false, message: 'Invalid AWBNO' }
    }

    const bookingDate = shipment.booking_date || shipment.invoice_date || (shipment.created_at ? String(shipment.created_at).split('T')[0] : new Date().toISOString().split('T')[0])
    const now = new Date()
    const currentTime = now.toTimeString().split(' ')[0] // HH:MM:SS
    const loc = (location || shipment.s_city || shipment.sender_city || 'SURAT').toUpperCase().slice(0, 30)
    const act = (activity || 'SHIPMENT BOOKED').toUpperCase().slice(0, 30)

    // Check if entry with identical AWBNO and activity already exists to avoid redundant rows
    const [existing] = await pool.execute(
      'SELECT HISTORYID FROM parcel_history WHERE AWBNO = ? AND activity = ? LIMIT 1',
      [awbNo, act]
    )

    if (existing.length > 0) {
      console.log(`[Remote parcel_history Sync] Entry for AWBNO ${awbNo} with activity '${act}' already exists (HISTORYID: ${existing[0].HISTORYID}).`)
      return { success: true, action: 'already_exists', historyId: existing[0].HISTORYID }
    }

    console.log(`[Remote parcel_history Sync] Inserting '${act}' into parcel_history for AWBNO ${awbNo}...`)
    const [result] = await pool.execute(
      'INSERT INTO parcel_history (AWBNO, `date`, `time`, activity, location) VALUES (?, ?, ?, ?, ?)',
      [awbNo, bookingDate, currentTime, act, loc]
    )

    console.log(`[Remote parcel_history Sync] Successfully inserted into parcel_history for AWBNO ${awbNo} (HISTORYID: ${result.insertId}).`)
    return { success: true, action: 'inserted', historyId: result.insertId, awbNo }
  } catch (err) {
    console.error('[Remote parcel_history Sync] Error syncing to parcel_history:', err.message)
    // Non-blocking
    return { success: false, error: err.message }
  }
}

/**
 * Direct sync of booking request status update to remote Hostinger database (booking_requests table).
 * Ensures customer portal immediately reflects 'confirmed'/'processing'/'rejected' status & tracking number.
 */
export async function syncBookingRequestStatusToRemoteDb({ requestAwb, requestId, status, shipmentId, trackingNumber, adminNotes }) {
  try {
    const pool = getRemotePool()
    if (!pool) return false

    const updates = []
    const params = []

    if (status) {
      updates.push('status = ?')
      params.push(status)
    }
    if (shipmentId !== undefined) {
      updates.push('shipment_id = ?')
      params.push(shipmentId)
    }
    if (trackingNumber !== undefined) {
      updates.push('tracking_number = ?')
      params.push(trackingNumber)
    }
    if (adminNotes !== undefined) {
      updates.push('admin_notes = ?')
      params.push(adminNotes)
    }

    if (updates.length === 0) return false

    let whereClause = ''
    if (requestAwb) {
      whereClause = 'request_awb = ?'
      params.push(requestAwb)
    } else if (requestId) {
      whereClause = 'id = ?'
      params.push(requestId)
    } else {
      return false
    }

    await pool.execute(
      `UPDATE booking_requests SET ${updates.join(', ')} WHERE ${whereClause}`,
      params
    )
    console.log(`[Remote DB Booking Request Sync] Status updated for ${requestAwb || requestId} -> ${status}`)
    return true
  } catch (err) {
    console.warn('[Remote DB Booking Request Sync Warning]:', err.message)
    return false
  }
}

/**
 * Direct sync of a new booking request to the remote Hostinger database (booking_requests table).
 * Guarantees that requests submitted by customers appear immediately in the customer portal.
 */
export async function syncBookingRequestToRemoteDb(reqData) {
  try {
    const pool = getRemotePool()
    if (!pool) return false

    const awb = reqData.request_awb
    if (!awb) return false

    const [existing] = await pool.query('SELECT id FROM booking_requests WHERE request_awb = ? LIMIT 1', [awb])
    if (existing && existing.length > 0) return true

    const parcelsJson = typeof reqData.parcels === 'string' ? reqData.parcels : (Array.isArray(reqData.parcels) ? JSON.stringify(reqData.parcels) : null)
    const invItemsJson = typeof reqData.invoice_items === 'string' ? reqData.invoice_items : (Array.isArray(reqData.invoice_items) ? JSON.stringify(reqData.invoice_items) : null)
    const docsJson = typeof reqData.documents === 'string' ? reqData.documents : (Array.isArray(reqData.documents) ? JSON.stringify(reqData.documents) : null)

    await pool.query(
      `INSERT INTO booking_requests (
        request_awb, customer_id, customer_name, customer_email, customer_phone, customer_company,
        sender_name, sender_company, sender_email, sender_phone,
        sender_address, sender_address_2, sender_city, sender_pincode,
        sender_state, sender_country, sender_gstin_type, sender_gstin_no,
        receiver_name, receiver_email, receiver_phone,
        receiver_address, receiver_address_2, receiver_city, receiver_pincode,
        receiver_state, receiver_country, receiver_gstin_type, receiver_gstin_no,
        package_type, weight, \`length\`, length_cm, breadth, height, no_of_pieces,
        content_description, declared_value, is_fragile, remarks,
        order_reference, payment_mode, shipping_charge,
        invoice_type, invoice_currency, hs_code, export_reason, terms_of_trade, invoice_note,
        invoice_items, parcels, documents, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        awb,
        reqData.customer_id || null,
        reqData.customer_name || '',
        reqData.customer_email || '',
        reqData.customer_phone || '',
        reqData.customer_company || '',
        reqData.sender_name || '', reqData.sender_company || '',
        reqData.sender_email || '', reqData.sender_phone || '',
        reqData.sender_address || '', reqData.sender_address_2 || '',
        reqData.sender_city || '', reqData.sender_pincode || '',
        reqData.sender_state || '', reqData.sender_country || 'INDIA',
        reqData.sender_gstin_type || '', reqData.sender_gstin_no || '',
        reqData.receiver_name || '', reqData.receiver_email || '', reqData.receiver_phone || '',
        reqData.receiver_address || '', reqData.receiver_address_2 || '',
        reqData.receiver_city || '', reqData.receiver_pincode || '',
        reqData.receiver_state || '', reqData.receiver_country || '',
        reqData.receiver_gstin_type || '', reqData.receiver_gstin_no || '',
        reqData.package_type || 'parcel',
        parseFloat(reqData.weight) || 0,
        parseFloat(reqData.length || reqData.length_cm) || 0,
        parseFloat(reqData.length || reqData.length_cm) || 0,
        parseFloat(reqData.breadth) || 0,
        parseFloat(reqData.height) || 0,
        parseInt(reqData.no_of_pieces) || 1,
        reqData.content_description || '',
        parseFloat(reqData.declared_value) || 0,
        reqData.is_fragile ? 1 : 0,
        reqData.remarks || '',
        reqData.order_reference || '',
        reqData.payment_mode || 'prepaid',
        parseFloat(reqData.shipping_charge) || 0,
        reqData.invoice_type || 'INVOICE',
        reqData.invoice_currency || 'INR',
        reqData.hs_code || '',
        reqData.export_reason || '',
        reqData.terms_of_trade || 'CIF',
        reqData.invoice_note || '',
        invItemsJson,
        parcelsJson,
        docsJson,
        reqData.status || 'pending'
      ]
    )
    console.log(`[Remote DB Booking Request Sync] New request inserted: ${awb}`)
    return true
  } catch (err) {
    console.warn('[Remote DB Booking Request Insert Warning]:', err.message)
    return false
  }
}


