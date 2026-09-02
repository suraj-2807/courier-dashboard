import { query, execute } from '../../config/db.js'
import { syncBookingToWP, syncStatusToWP } from '../../utils/wpSync.js'
import { syncBookingRequestStatusToRemoteDb, syncBookingRequestToRemoteDb } from '../../services/remoteAwbEntry.service.js'

/**
 * Generate a 7-digit random AWB number for booking requests.
 * Checks uniqueness in the booking_requests table.
 */
async function generateRequestAwb() {
  let awb
  let exists = true
  while (exists) {
    awb = String(Math.floor(1000000 + Math.random() * 9000000)) // 7 digits
    const rows = await query('SELECT id FROM booking_requests WHERE request_awb = ?', [awb])
    exists = rows.length > 0
  }
  return awb
}

// ═══════════════════════════════════════════════
//  PUBLIC: Customer submits booking request
// ═══════════════════════════════════════════════

export const createBookingRequest = async (req, res) => {
  try {
    const {
      customer_id,
      customer_name, customer_email, customer_phone, customer_company,
      sender_name, sender_company, sender_email, sender_phone, sender_phone_2,
      sender_address, sender_address_2, sender_city, sender_pincode,
      sender_state, sender_country,
      sender_gstin_type, sender_gstin_no,
      receiver_name, receiver_company, receiver_email, receiver_phone, receiver_phone_2,
      receiver_address, receiver_address_2, receiver_city, receiver_pincode,
      receiver_state, receiver_country,
      receiver_gstin_type, receiver_gstin_no,
      package_type, weight, length, breadth, height, no_of_pieces,
      content_description, declared_value, is_fragile,
      remarks, order_reference, payment_mode, shipping_charge,
      invoice_type, invoice_currency, hs_code, export_reason, terms_of_trade, invoice_note,
      invoice_items, parcels, documents,
      save_sender_address, save_receiver_address, save_documents
    } = req.body

    // Basic validation
    if (!sender_name || !sender_phone) {
      return res.status(400).json({ success: false, message: 'Sender name and phone are required' })
    }
    if (!receiver_name || !receiver_phone) {
      return res.status(400).json({ success: false, message: 'Receiver name and phone are required' })
    }

    if (sender_gstin_type && /aadhaar|aadhar/i.test(sender_gstin_type)) {
      const clean = (sender_gstin_no || '').toString().replace(/\D/g, '')
      if (clean.length !== 12) {
        return res.status(400).json({ success: false, message: 'Aadhaar number must be exactly 12 digits' })
      }
    }
    if (receiver_gstin_type && /aadhaar|aadhar/i.test(receiver_gstin_type)) {
      const clean = (receiver_gstin_no || '').toString().replace(/\D/g, '')
      if (clean.length !== 12) {
        return res.status(400).json({ success: false, message: 'Receiver Aadhaar number must be exactly 12 digits' })
      }
    }

    const request_awb = await generateRequestAwb()

    const resolvedCustomerId = customer_id ? parseInt(customer_id) : null

    const docsJson = Array.isArray(documents) && documents.length > 0 ? JSON.stringify(documents) : null
    const parcelsJson = Array.isArray(parcels) && parcels.length > 0 ? JSON.stringify(parcels) : null
    const invItemsJson = Array.isArray(invoice_items) && invoice_items.length > 0 ? JSON.stringify(invoice_items) : null

    const insertResult = await execute(
      `INSERT INTO booking_requests (
        request_awb, customer_id, customer_name, customer_email, customer_phone, customer_company,
        sender_name, sender_company, sender_email, sender_phone, sender_phone_2,
        sender_address, sender_address_2, sender_city, sender_pincode,
        sender_state, sender_country, sender_gstin_type, sender_gstin_no,
        receiver_name, receiver_email, receiver_phone, receiver_phone_2,
        receiver_address, receiver_address_2, receiver_city, receiver_pincode,
        receiver_state, receiver_country, receiver_gstin_type, receiver_gstin_no,
        package_type, weight, \`length\`, breadth, height, no_of_pieces,
        content_description, declared_value, is_fragile, remarks,
        order_reference, payment_mode, shipping_charge,
        invoice_type, invoice_currency, hs_code, export_reason, terms_of_trade, invoice_note,
        invoice_items, parcels, documents, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request_awb,
        resolvedCustomerId,
        customer_name || sender_name || '',
        customer_email || sender_email || '',
        customer_phone || sender_phone || '',
        customer_company || sender_company || '',
        sender_name || '', sender_company || '',
        sender_email || '', sender_phone || '', sender_phone_2 || '',
        sender_address || '', sender_address_2 || '',
        sender_city || '', sender_pincode || '',
        sender_state || '', sender_country || 'INDIA',
        sender_gstin_type || '', sender_gstin_no || '',
        receiver_name || '', receiver_email || '',
        receiver_phone || '', receiver_phone_2 || '',
        receiver_address || '', receiver_address_2 || '',
        receiver_city || '', receiver_pincode || '',
        receiver_state || '', receiver_country || '',
        receiver_gstin_type || '', receiver_gstin_no || '',
        package_type || 'parcel',
        parseFloat(weight) || 0,
        parseFloat(length) || 0,
        parseFloat(breadth) || 0,
        parseFloat(height) || 0,
        parseInt(no_of_pieces) || 1,
        content_description || '',
        parseFloat(declared_value) || 0,
        is_fragile ? 1 : 0,
        remarks || '',
        order_reference || '',
        payment_mode || 'prepaid',
        parseFloat(shipping_charge) || 0,
        invoice_type || 'INVOICE',
        invoice_currency || 'INR',
        hs_code || '',
        export_reason || '',
        terms_of_trade || 'CIF',
        invoice_note || '',
        invItemsJson,
        parcelsJson,
        docsJson,
        'pending'
      ]
    )

    // Optionally auto-save sender address to Address Book
    if (save_sender_address && (sender_name && sender_address && sender_city)) {
      try {
        await execute(
          `INSERT INTO customer_addresses (
            customer_id, customer_email, customer_phone, address_type,
            name, company, phone, phone_2, email,
            address, address_2, city, state, pincode, country,
            gstin_type, gstin_no, is_default
          ) VALUES (?, ?, ?, 'sender', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
          ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
          [
            resolvedCustomerId,
            customer_email || sender_email || '',
            customer_phone || sender_phone || '',
            sender_name, sender_company || '', sender_phone, sender_phone_2 || '', sender_email || '',
            sender_address, sender_address_2 || '', sender_city, sender_state || '', sender_pincode || '', sender_country || 'INDIA',
            sender_gstin_type || '', sender_gstin_no || ''
          ]
        )
      } catch (saveSenderErr) {
        console.warn('Auto-save sender address warning:', saveSenderErr.message)
      }
    }

    // Optionally auto-save receiver address to Address Book
    if (save_receiver_address && (receiver_name && receiver_address && receiver_city)) {
      try {
        await execute(
          `INSERT INTO customer_addresses (
            customer_id, customer_email, customer_phone, address_type,
            name, company, phone, phone_2, email,
            address, address_2, city, state, pincode, country,
            gstin_type, gstin_no, is_default
          ) VALUES (?, ?, ?, 'receiver', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
          ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
          [
            resolvedCustomerId,
            customer_email || sender_email || '',
            customer_phone || sender_phone || '',
            receiver_name, receiver_company || '', receiver_phone, receiver_phone_2 || '', receiver_email || '',
            receiver_address, receiver_address_2 || '', receiver_city, receiver_state || '', receiver_pincode || '', receiver_country || '',
            receiver_gstin_type || '', receiver_gstin_no || ''
          ]
        )
      } catch (saveRcvErr) {
        console.warn('Auto-save receiver address warning:', saveRcvErr.message)
      }
    }

    // Optionally save attached documents to customer_documents
    if (save_documents && Array.isArray(documents) && documents.length > 0) {
      for (const d of documents) {
        if (d.file_url) {
          try {
            await execute(
              `INSERT INTO customer_documents (
                customer_id, customer_email, customer_phone,
                doc_type, doc_name, doc_number, file_url, file_name, file_size, file_type
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                resolvedCustomerId,
                customer_email || sender_email || '',
                customer_phone || sender_phone || '',
                d.doc_type || 'Other',
                d.doc_name || d.file_name || 'Document',
                d.doc_number || '',
                d.file_url,
                d.file_name || '',
                d.file_size || 0,
                d.file_type || ''
              ]
            )
          } catch (docSaveErr) {
            console.warn('Auto-save document warning:', docSaveErr.message)
          }
        }
      }
    }

    // Insert initial request_updates timeline record
    if (insertResult && insertResult.insertId) {
      await execute(
        `INSERT INTO request_updates (request_id, update_type, title, description) VALUES (?, ?, ?, ?)`,
        [
          insertResult.insertId,
          'info',
          'Request Submitted',
          'Your booking request has been submitted successfully and is awaiting review.'
        ]
      )
    }

    // ── Dual Sync to Remote DB and WordPress DB ──
    const bookingSyncPayload = {
      request_awb,
      customer_id: resolvedCustomerId,
      customer_name: customer_name || sender_name || '',
      customer_email: customer_email || sender_email || '',
      customer_phone: customer_phone || sender_phone || '',
      customer_company: customer_company || sender_company || '',
      sender_name: sender_name || '', sender_company: sender_company || '',
      sender_email: sender_email || '', sender_phone: sender_phone || '',
      sender_address: sender_address || '', sender_address_2: sender_address_2 || '',
      sender_city: sender_city || '', sender_pincode: sender_pincode || '',
      sender_state: sender_state || '', sender_country: sender_country || 'INDIA',
      sender_gstin_type: sender_gstin_type || '', sender_gstin_no: sender_gstin_no || '',
      receiver_name: receiver_name || '', receiver_email: receiver_email || '',
      receiver_phone: receiver_phone || '',
      receiver_address: receiver_address || '', receiver_address_2: receiver_address_2 || '',
      receiver_city: receiver_city || '', receiver_pincode: receiver_pincode || '',
      receiver_state: receiver_state || '', receiver_country: receiver_country || '',
      receiver_gstin_type: receiver_gstin_type || '', receiver_gstin_no: receiver_gstin_no || '',
      package_type: package_type || 'parcel',
      weight: parseFloat(weight) || 0,
      length: parseFloat(length) || 0,
      length_cm: parseFloat(length) || 0,
      breadth: parseFloat(breadth) || 0,
      height: parseFloat(height) || 0,
      no_of_pieces: parseInt(no_of_pieces) || 1,
      content_description: content_description || '',
      declared_value: parseFloat(declared_value) || 0,
      is_fragile: is_fragile ? 1 : 0,
      remarks: remarks || '',
      parcels: parcelsJson || null,
      invoice_items: invItemsJson || null,
      documents: docsJson || null,
      order_reference: order_reference || '',
      payment_mode: payment_mode || 'prepaid',
      shipping_charge: parseFloat(shipping_charge) || 0,
      invoice_type: invoice_type || 'INVOICE',
      invoice_currency: invoice_currency || 'INR',
      hs_code: hs_code || '',
      export_reason: export_reason || '',
      terms_of_trade: terms_of_trade || 'CIF',
      invoice_note: invoice_note || '',
      status: 'pending'
    }

    syncBookingRequestToRemoteDb(bookingSyncPayload).catch(() => {})
    syncBookingToWP(bookingSyncPayload).catch(() => {})

    return res.status(201).json({
      success: true,
      message: 'Booking request submitted successfully!',
      request_awb
    })
  } catch (error) {
    console.error('createBookingRequest error:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════
//  ADMIN: List all booking requests
// ═══════════════════════════════════════════════

export const getBookingRequests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      status = '',
      search = '',
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const offset = (pageNum - 1) * limitNum

    const allowedSortColumns = ['created_at', 'request_awb', 'status', 'customer_name']
    const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at'
    const safeSortOrder = sort_order === 'asc' ? 'ASC' : 'DESC'

    let whereClauses = []
    const params = []

    if (status) {
      whereClauses.push('status = ?')
      params.push(status)
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      const searchFields = [
        'request_awb',
        'customer_name',
        'customer_email',
        'customer_phone',
        'customer_company',
        'sender_name',
        'sender_company',
        'sender_phone',
        'sender_city',
        'sender_pincode',
        'receiver_name',
        'receiver_company',
        'receiver_phone',
        'receiver_city',
        'receiver_country',
        'receiver_pincode',
        'order_reference',
        'content_description'
      ]
      const sqlParts = searchFields.map(f => `\`${f}\` LIKE ?`)
      sqlParts.push("DATE_FORMAT(created_at, '%d/%m/%Y') LIKE ?")
      sqlParts.push("DATE_FORMAT(created_at, '%Y-%m-%d') LIKE ?")
      whereClauses.push(`(${sqlParts.join(' OR ')})`)
      for (let i = 0; i < sqlParts.length; i++) {
        params.push(term)
      }
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''

    const countRows = await query(
      `SELECT COUNT(*) as total FROM booking_requests ${whereStr}`,
      params
    )
    const total = countRows[0].total

    // Status counts
    const countPending = (await query(`SELECT COUNT(*) as c FROM booking_requests WHERE status = 'pending'`))[0].c
    const countProcessing = (await query(`SELECT COUNT(*) as c FROM booking_requests WHERE status = 'processing'`))[0].c
    const countConfirmed = (await query(`SELECT COUNT(*) as c FROM booking_requests WHERE status = 'confirmed'`))[0].c
    const countRejected = (await query(`SELECT COUNT(*) as c FROM booking_requests WHERE status = 'rejected'`))[0].c

    const rows = await query(
      `SELECT * FROM booking_requests ${whereStr} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ${limitNum} OFFSET ${offset}`,
      params
    )

    const jsonFields = ['parcels', 'invoice_items', 'documents']
    rows.forEach(r => {
      jsonFields.forEach(field => {
        if (r[field] && typeof r[field] === 'string') {
          try {
            r[field] = JSON.parse(r[field])
          } catch (e) {
            r[field] = null
          }
        }
      })
    })

    return res.json({
      success: true,
      requests: rows,
      counts: {
        all: total,
        pending: countPending,
        processing: countProcessing,
        confirmed: countConfirmed,
        rejected: countRejected
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════
//  ADMIN: Get single booking request
// ═══════════════════════════════════════════════

export const getBookingRequestById = async (req, res) => {
  try {
    const { id } = req.params
    const rows = await query('SELECT * FROM booking_requests WHERE id = ?', [id])

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking request not found' })
    }

    const request = rows[0]

    // Parse JSON fields so frontend receives arrays, not raw strings
    const jsonFields = ['parcels', 'invoice_items', 'documents']
    jsonFields.forEach(field => {
      if (request[field] && typeof request[field] === 'string') {
        try {
          request[field] = JSON.parse(request[field])
        } catch (e) {
          request[field] = null
        }
      }
    })

    return res.json({ success: true, request })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════
//  ADMIN: Update booking request status
// ═══════════════════════════════════════════════

export const updateBookingRequestStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, admin_notes, shipment_id } = req.body

    const validStatuses = ['pending', 'processing', 'confirmed', 'rejected']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' })
    }

    const existingRows = await query('SELECT * FROM booking_requests WHERE id = ?', [id])
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking request not found' })
    }
    const oldRequest = existingRows[0]

    const updates = ['status = ?']
    const params = [status]

    if (admin_notes !== undefined) {
      updates.push('admin_notes = ?')
      params.push(admin_notes)
    }

    let resolvedTrackingNumber = null
    if (shipment_id !== undefined) {
      updates.push('shipment_id = ?')
      params.push(shipment_id)

      if (shipment_id) {
        // Fetch tracking number from shipments
        const shipmentRows = await query('SELECT tracking_number FROM shipments WHERE id = ?', [shipment_id])
        if (shipmentRows.length > 0) {
          resolvedTrackingNumber = shipmentRows[0].tracking_number
          updates.push('tracking_number = ?')
          params.push(resolvedTrackingNumber)
        }
      }
    }

    params.push(id)
    await execute(`UPDATE booking_requests SET ${updates.join(', ')} WHERE id = ?`, params)

    const rows = await query('SELECT * FROM booking_requests WHERE id = ?', [id])
    const newRequest = rows[0]

    // Collect timeline updates to sync to WP
    const wpUpdates = []

    // Log status change update
    if (oldRequest.status !== status) {
      const title = `Status updated to ${status.charAt(0).toUpperCase() + status.slice(1)}`
      const description = `Booking request status was changed from "${oldRequest.status}" to "${status}".`
      await execute(
        `INSERT INTO request_updates (request_id, update_type, title, description, metadata) VALUES (?, ?, ?, ?, ?)`,
        [id, 'status_change', title, description, JSON.stringify({ old_status: oldRequest.status, new_status: status })]
      )
      wpUpdates.push({ type: 'status_change', title, description, metadata: JSON.stringify({ old_status: oldRequest.status, new_status: status }) })
    }

    // Log shipment created update
    if (shipment_id && !oldRequest.shipment_id) {
      const trNum = resolvedTrackingNumber || newRequest.tracking_number || ''
      const title = 'Shipment Created'
      const description = `Your shipment has been confirmed and booked. Tracking Number: ${trNum}`
      await execute(
        `INSERT INTO request_updates (request_id, update_type, title, description, metadata) VALUES (?, ?, ?, ?, ?)`,
        [id, 'shipment_created', title, description, JSON.stringify({ shipment_id, tracking_number: trNum })]
      )
      wpUpdates.push({ type: 'shipment_created', title, description, metadata: JSON.stringify({ shipment_id, tracking_number: trNum }) })
    }

    // Log admin note update
    if (admin_notes !== undefined && admin_notes !== null && admin_notes !== '' && oldRequest.admin_notes !== admin_notes) {
      await execute(
        `INSERT INTO request_updates (request_id, update_type, title, description) VALUES (?, ?, ?, ?)`,
        [id, 'admin_note', 'Admin Note Added', admin_notes]
      )
      wpUpdates.push({ type: 'admin_note', title: 'Admin Note Added', description: admin_notes })
    }

    // ── Direct sync to remote Hostinger DB ──
    syncBookingRequestStatusToRemoteDb({
      requestAwb: newRequest.request_awb,
      requestId: newRequest.id,
      status: newRequest.status,
      shipmentId: newRequest.shipment_id,
      trackingNumber: newRequest.tracking_number,
      adminNotes: newRequest.admin_notes
    }).catch(() => {})

    // ── Fire-and-forget sync to WordPress DB ──
    syncStatusToWP({
      request_awb: newRequest.request_awb,
      status: newRequest.status,
      admin_notes: newRequest.admin_notes,
      shipment_id: newRequest.shipment_id,
      tracking_number: newRequest.tracking_number,
      updates: wpUpdates
    }).catch(() => {}) // never throw

    return res.json({ success: true, request: newRequest })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ═══════════════════════════════════════════════
//  PUBLIC: Customer view request details and timeline
// ═══════════════════════════════════════════════

export const getCustomerRequest = async (req, res) => {
  try {
    const { request_awb } = req.params
    const rows = await query('SELECT * FROM booking_requests WHERE request_awb = ?', [request_awb])

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking request not found' })
    }

    const request = rows[0]

    // Fetch request updates timeline
    const updates = await query(
      'SELECT * FROM request_updates WHERE request_id = ? ORDER BY created_at DESC',
      [request.id]
    )

    // Fetch shipment tracking if confirmed
    let tracking_events = []
    if (request.shipment_id) {
      tracking_events = await query(
        'SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY event_time DESC',
        [request.shipment_id]
      )
    }

    return res.json({
      success: true,
      request,
      updates,
      tracking_events
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const getCustomerRequests = async (req, res) => {
  try {
    const { email, phone } = req.query

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer email or phone is required to fetch requests'
      })
    }

    let whereClauses = []
    const params = []

    if (email) {
      whereClauses.push('customer_email = ? OR sender_email = ?')
      params.push(email, email)
    }
    if (phone) {
      whereClauses.push('customer_phone = ? OR sender_phone = ?')
      params.push(phone, phone)
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE (' + whereClauses.join(') OR (') + ')' : ''

    const requests = await query(
      `SELECT * FROM booking_requests ${whereStr} ORDER BY created_at DESC`,
      params
    )

    return res.json({
      success: true,
      requests
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}
