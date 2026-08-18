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
 * Insert or update a shipment in the remote AWBENTRY table.
 * 
 * Concurrency & Safety Guarantee:
 * - Uses standard atomic single-row parameterized queries.
 * - Never acquires table locks, never alters schemas, never interferes with other concurrent systems.
 * - AWBID auto-increment works independently for all systems.
 * - Wrapped in try-catch so it will never crash or halt the local application.
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

    // Extract fields
    const sender = shipment.senders || shipment.sender || {}
    const receiver = shipment.receivers || shipment.receiver || {}

    const senderName = shipment.s_name || sender.name || shipment.sender_name || shipment.sender_company || ''
    const senderAddress1 = shipment.s_address || sender.address || shipment.sender_address || ''
    const senderAddress2 = shipment.sender_address_2 || shipment.s_address_2 || ''
    const senderState = shipment.s_state || sender.state || shipment.sender_state || ''
    const senderCity = shipment.s_city || sender.city || shipment.sender_city || 'SURAT'
    const senderPincode = shipment.s_pincode || sender.pincode || shipment.sender_pincode || ''
    const senderPhone = shipment.s_phone || sender.phone || shipment.sender_phone || '0'
    const senderCountry = shipment.s_country || sender.country || shipment.sender_country || 'INDIA'

    const senderGstinType = shipment.sender_gstin_type || ''
    const senderGstinNo = shipment.sender_gstin_no || ''
    const aadharNo = /aadhaar|aadhar/i.test(senderGstinType) ? senderGstinNo.replace(/\D/g, '') : ''
    const gstNo = /gst/i.test(senderGstinType) ? senderGstinNo : ''

    const receiverName = shipment.r_name || receiver.name || shipment.receiver_name || shipment.receiver_company || ''
    const receiverAddress1 = shipment.r_address || receiver.address || shipment.receiver_address || ''
    const receiverAddress2 = shipment.receiver_address_2 || shipment.r_address_2 || ''
    const receiverAddress3 = shipment.r_state || receiver.state || shipment.receiver_state || ''
    const receiverCity = shipment.r_city || receiver.city || shipment.receiver_city || ''
    const receiverPincode = shipment.r_pincode || receiver.pincode || shipment.receiver_pincode || ''
    const receiverPhone = shipment.r_phone || receiver.phone || shipment.receiver_phone || ''
    const receiverCountry = shipment.r_country || receiver.country || shipment.receiver_country || ''
    const destCode = resolveCountryCode(receiverCountry)

    const weight = parseFloat(shipment.weight) || 0
    const chargeableWeight = parseFloat(shipment.chargeable_weight) || weight
    const shippingCharge = parseFloat(shipment.shipping_charge) || parseFloat(shipment.total_amount) || 0
    const totalAmount = parseFloat(shipment.total_amount) || shippingCharge
    const rate = weight > 0 && shippingCharge > 0 ? Math.round((shippingCharge / weight) * 100) / 100 : 0

    const paymentMode = String(shipment.payment_mode || 'prepaid').toLowerCase()
    const paymentType = paymentMode === 'cod' ? 1 : (paymentMode === 'credit' ? 2 : 0)
    const receiptAmount = paymentMode === 'prepaid' ? totalAmount : 0

    const bookingDate = shipment.booking_date || shipment.invoice_date || (shipment.created_at ? String(shipment.created_at).split('T')[0] : new Date().toISOString().split('T')[0])
    const pieces = parseInt(shipment.no_of_pieces) || 1

    const vendorAwb = shipment.vendor_awb_number || vendorResult.awbNumber || ''
    const vendorAwb2 = shipment.vendor_awb_number_2 || ''
    const vendorCode = shipment.vendor_code || 'PXC'
    const productCode = shipment.product_code || ''

    // Check if AWBNO already exists in remote AWBENTRY
    const [existingRows] = await pool.execute('SELECT AWBID, AWBNO FROM AWBENTRY WHERE AWBNO = ? LIMIT 1', [awbNo])

    if (existingRows.length > 0) {
      // Update existing record
      console.log(`[Remote AWBENTRY Sync] AWBNO ${awbNo} already exists in remote DB (AWBID: ${existingRows[0].AWBID}). Updating...`)
      await pool.execute(
        `UPDATE AWBENTRY SET
          AWBDATE = ?, CARTONS = ?, ORIGIN = ?, CUSTCODE = ?, CUSTNAME = ?,
          SNAME = ?, SADDRESS1 = ?, SADDRESS2 = ?, SADDRESS3 = ?, SCITY = ?, SPINCODE = ?, SPHONE1 = ?, SAADHARNO = ?,
          PRODCODE = ?, PRODNAME = ?, VENDCODE = ?, VENDNAME = ?, DESTCODE = ?, DESTNAME = ?,
          CNEENAME = ?, CNEEADDRESS1 = ?, CNEEADDRESS2 = ?, CNEEADDRESS3 = ?, CNEEADDRESS4 = ?,
          CNEEPINCODE = ?, CNEECITY = ?, CNEEPHONE1 = ?,
          PAYMENTTYPE = ?, ACTUALWEIGHT = ?, CHARGEWEIGHT = ?, RATE = ?, CHARGES = ?, TOTAL = ?, NETAMOUNT = ?,
          VENDORAWB1 = ?, VENDORAWB2 = ?, REMARKS = ?, RECEIPTAMOUNT = ?, GSTNO = ?
        WHERE AWBNO = ?`,
        [
          bookingDate,
          pieces,
          'SRT',
          'W001',
          'WALKING CUSTOMER',
          senderName,
          senderAddress1,
          senderAddress2,
          senderState,
          senderCity,
          senderPincode,
          senderPhone,
          aadharNo || null,
          productCode,
          productCode,
          vendorCode,
          vendorCode,
          destCode,
          receiverCountry,
          receiverName,
          receiverAddress1,
          receiverAddress2,
          receiverAddress3,
          receiverCity,
          receiverPincode,
          receiverCity,
          receiverPhone,
          paymentType,
          weight,
          chargeableWeight,
          rate,
          shippingCharge,
          totalAmount,
          totalAmount,
          vendorAwb || String(awbNo),
          vendorAwb2,
          shipment.content_description || shipment.remarks || '',
          receiptAmount,
          gstNo || null,
          awbNo
        ]
      )
      console.log(`[Remote AWBENTRY Sync] Successfully updated AWBNO ${awbNo} in remote DB.`)
      return { success: true, action: 'updated', awbNo }
    }

    // Insert new record into AWBENTRY
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
      0, // DESTINATIONTYPE (0: International)
      awbNo, // AWBNO
      bookingDate, // AWBDATE
      pieces, // CARTONS
      'SRT', // ORIGIN
      'W001', // CUSTCODE
      'WALKING CUSTOMER', // CUSTNAME
      senderName, // SNAME
      senderAddress1, // SADDRESS1
      senderAddress2, // SADDRESS2
      senderState, // SADDRESS3
      senderCity, // SCITY
      senderPincode, // SPINCODE
      senderPhone, // SPHONE1
      '', // SPHONE2
      aadharNo || null, // SAADHARNO
      productCode, // PRODCODE
      productCode, // PRODNAME
      vendorCode, // VENDCODE
      vendorCode, // VENDNAME
      destCode, // DESTCODE
      receiverCountry, // DESTNAME
      receiverName, // CNEENAME
      receiverAddress1, // CNEEADDRESS1
      receiverAddress2, // CNEEADDRESS2
      receiverAddress3, // CNEEADDRESS3
      receiverCity, // CNEEADDRESS4
      receiverPincode, // CNEEPINCODE
      receiverCity, // CNEECITY
      receiverPhone, // CNEEPHONE1
      '', // CNEEPHONE2
      paymentType, // PAYMENTTYPE
      weight, // ACTUALWEIGHT
      chargeableWeight, // CHARGEWEIGHT
      rate, // RATE
      shippingCharge, // CHARGES
      0.00, // SERVICECHARGE
      0.00, // COMMCHARGE
      totalAmount, // TOTAL
      0.00, // ADJUSTMENT
      0.00, // SURCHARGE
      0.00, // SERVICETAX
      totalAmount, // NETAMOUNT
      vendorAwb || String(awbNo), // VENDORAWB1
      vendorAwb2, // VENDORAWB2
      shipment.content_description || shipment.remarks || '', // REMARKS
      receiptAmount, // RECEIPTAMOUNT
      0.00, // SGST
      0.00, // CGST
      0.00, // IGST
      gstNo || null, // GSTNO
      0, // GSTTYPE
      0, // ENTRYTYPE
      0, // DOWNLOAD
      '', // BRANCHCODE
      'MTX', // ALIAS
      0, // TCCSLABEL
      0, // SERVICE
      2, // AUTOTRACK
      0, // PODTOWEB
      0, // SHOWFWD
      0, // BOOKINGMAIL
      'P0503', // TUSER
      'P0503@7199', // TPASS
      'P0503', // ACCODE
      '' // APIKEY
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

