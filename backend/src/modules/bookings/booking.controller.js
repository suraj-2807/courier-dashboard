import { query, execute } from '../../config/db.js'
import generateTracking from '../../utils/generateTracking.js'
import { pushShipmentToVendor } from '../../services/vendorApiPush.service.js'

export const createBooking = async (req, res) => {
  try {
    const {
      sender_id,
      receiver_id,
      courier_provider_id,
      vendor_config_id,
      vendor_code,
      service_code,
      product_code,
      weight,
      length,
      breadth,
      height,
      payment_mode,
      package_type,
      total_amount,
      shipping_charge,
      order_reference,
      remarks,
      // Inline sender/receiver fields (when no sender_id/receiver_id)
      sender_name,
      sender_email,
      sender_phone,
      sender_address,
      sender_city,
      sender_pincode,
      sender_state,
      sender_country,
      receiver_name,
      receiver_email,
      receiver_phone,
      receiver_address,
      receiver_city,
      receiver_pincode,
      receiver_state,
      receiver_country,
      // Additional fields
      no_of_pieces,
      content_description,
      declared_value,
      cod_amount,
      // Pacific-specific fields
      sender_company,
      sender_address_2,
      sender_gstin_type,
      sender_gstin_no,
      receiver_address_2,
      receiver_gstin_type,
      receiver_gstin_no,
      invoice_no,
      invoice_date,
      invoice_currency,
      hs_code,
      export_reason,
      terms_of_trade,
      // eAWB Details
      eawb_no,
      eawb_date,
      eawb_exp_date,
      // Additional Charges
      additional_discount,
      additional_freight,
      additional_insurance,
      additional_other_charges,
      additional_specify_charges,
      // Buyer Details
      buyer_name,
      buyer_person_type,
      buyer_address1,
      buyer_address2,
      buyer_pincode,
      buyer_city,
      buyer_state,
      buyer_telephone,
      buyer_mobile,
      buyer_email,
      buyer_country_code,
      buyer_destination_code,
      buyer_iec_no,
      // GST & Manifest
      gst_invoice,
      lut_igst,
      total_igst,
      bank_ad_code,
      bank_account,
      bank_ifsc,
      lut_number,
      exchange_rate,
      manifest_firm,
      manifest_nfei,
      pay_of_igst,
      manifest_ecommerce,
      meis_scheme,
      manifest_format,
      manifest_iec_no,
      lut_issue_date,
      lut_till_date,
      // Advanced Config
      company_code,
      is_commercial,
      csb_type,
      otp,
      lsp_type,
      required_performa,
      required_label
    } = req.body

    const tracking_number = generateTracking()
    const order_id = `ORD-${Date.now()}`

    // ── Step 1: Upsert sender if inline fields provided ──
    let finalSenderId = sender_id
    if (!finalSenderId && sender_name) {
      const senderResult = await execute(
        `INSERT INTO senders (name, email, phone, address, city, pincode, state, country)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sender_name,
          sender_email || '',
          sender_phone || '',
          sender_address || '',
          sender_city || '',
          sender_pincode || '',
          sender_state || '',
          sender_country || 'INDIA'
        ]
      )
      finalSenderId = senderResult.insertId
    }

    // ── Step 2: Upsert receiver if inline fields provided ──
    let finalReceiverId = receiver_id
    if (!finalReceiverId && receiver_name) {
      const receiverResult = await execute(
        `INSERT INTO receivers (name, email, phone, address, city, pincode, state, country)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          receiver_name,
          receiver_email || '',
          receiver_phone || '',
          receiver_address || '',
          receiver_city || '',
          receiver_pincode || '',
          receiver_state || '',
          receiver_country || 'INDIA'
        ]
      )
      finalReceiverId = receiverResult.insertId
    }

    // ── Step 3: Create shipment record ──
    const shipmentResult = await execute(
      `INSERT INTO shipments (
        order_id, sender_id, receiver_id, courier_provider_id, vendor_config_id,
        vendor_code, service_code, product_code, tracking_number, weight, \`length\`, breadth, height,
        payment_mode, package_type, total_amount, shipping_charge,
        order_reference, remarks, status, vendor_push_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_id,
        finalSenderId || null,
        finalReceiverId || null,
        courier_provider_id || null,
        vendor_config_id || null,
        vendor_code || '',
        service_code || '',
        product_code || '',
        tracking_number,
        weight || 0,
        length || 0,
        breadth || 0,
        height || 0,
        payment_mode || 'prepaid',
        package_type || 'parcel',
        total_amount || 0,
        shipping_charge || 0,
        order_reference || '',
        remarks || '',
        'pending',
        vendor_config_id ? 'pending' : 'skipped'
      ]
    )

    const shipmentId = shipmentResult.insertId

    // ── Step 4: Create tracking event ──
    await execute(
      `INSERT INTO tracking_events (shipment_id, status, description, location)
       VALUES (?, ?, ?, ?)`,
      [shipmentId, 'Shipment Created', 'Shipment booked successfully', 'System']
    )

    // ── Step 5: Push to vendor API if vendor selected ──
    let vendorResult = null
    if (vendor_config_id) {
      // Build flat shipment data for the adapter
      const shipmentDataForVendor = {
        order_id,
        tracking_number,
        order_reference: order_reference || '',
        weight: parseFloat(weight) || 0,
        length: parseFloat(length) || 0,
        breadth: parseFloat(breadth) || 0,
        height: parseFloat(height) || 0,
        no_of_pieces: parseInt(no_of_pieces) || 1,
        package_type: package_type || 'parcel',
        payment_mode: payment_mode || 'prepaid',
        shipping_charge: parseFloat(shipping_charge) || 0,
        total_amount: parseFloat(total_amount) || 0,
        declared_value: parseFloat(declared_value) || 0,
        content_description: content_description || '',
        cod_amount: parseFloat(cod_amount) || 0,
        remarks: remarks || '',
        vendor_code: vendor_code || '',
        service_code: service_code || '',
        product_code: product_code || '',
        booking_date: new Date().toISOString().split('T')[0],
        booking_time: new Date().toTimeString().split(' ')[0],
        // Sender info
        sender_name: sender_name || '',
        sender_email: sender_email || '',
        sender_phone: sender_phone || '',
        sender_address: sender_address || '',
        sender_city: sender_city || '',
        sender_state: sender_state || '',
        sender_pincode: sender_pincode || '',
        sender_country: sender_country || 'INDIA',
        // Receiver info
        receiver_name: receiver_name || '',
        receiver_email: receiver_email || '',
        receiver_phone: receiver_phone || '',
        receiver_address: receiver_address || '',
        receiver_city: receiver_city || '',
        receiver_state: receiver_state || '',
        receiver_pincode: receiver_pincode || '',
        receiver_country: receiver_country || 'INDIA',
        // Pacific-specific fields
        sender_company: sender_company || '',
        sender_address_2: sender_address_2 || '',
        sender_gstin_type: sender_gstin_type || '',
        sender_gstin_no: sender_gstin_no || '',
        receiver_address_2: receiver_address_2 || '',
        receiver_gstin_type: receiver_gstin_type || '',
        receiver_gstin_no: receiver_gstin_no || '',
        invoice_no: invoice_no || '',
        invoice_date: invoice_date || '',
        invoice_currency: invoice_currency || 'INR',
        hs_code: hs_code || '',
        export_reason: export_reason || '',
        terms_of_trade: terms_of_trade || '',
        // eAWB Details (pass-through)
        eawb_no: eawb_no || '',
        eawb_date: eawb_date || '',
        eawb_exp_date: eawb_exp_date || '',
        // Additional Charges (pass-through)
        additional_discount: additional_discount || '',
        additional_freight: additional_freight || '',
        additional_insurance: additional_insurance || '',
        additional_other_charges: additional_other_charges || '',
        additional_specify_charges: additional_specify_charges || '',
        // Buyer Details (pass-through)
        buyer_name: buyer_name || '',
        buyer_person_type: buyer_person_type || '',
        buyer_address1: buyer_address1 || '',
        buyer_address2: buyer_address2 || '',
        buyer_pincode: buyer_pincode || '',
        buyer_city: buyer_city || '',
        buyer_state: buyer_state || '',
        buyer_telephone: buyer_telephone || '',
        buyer_mobile: buyer_mobile || '',
        buyer_email: buyer_email || '',
        buyer_country_code: buyer_country_code || '',
        buyer_destination_code: buyer_destination_code || '',
        buyer_iec_no: buyer_iec_no || '',
        // GST & Manifest (pass-through)
        gst_invoice: gst_invoice || '',
        lut_igst: lut_igst || '',
        total_igst: total_igst || '',
        bank_ad_code: bank_ad_code || '',
        bank_account: bank_account || '',
        bank_ifsc: bank_ifsc || '',
        lut_number: lut_number || '',
        exchange_rate: exchange_rate || '',
        manifest_firm: manifest_firm || '',
        manifest_nfei: manifest_nfei || '',
        pay_of_igst: pay_of_igst || '',
        manifest_ecommerce: manifest_ecommerce || '',
        meis_scheme: meis_scheme || '',
        manifest_format: manifest_format || '',
        manifest_iec_no: manifest_iec_no || '',
        lut_issue_date: lut_issue_date || '',
        lut_till_date: lut_till_date || '',
        // Advanced Config (pass-through)
        company_code: company_code || '',
        is_commercial: is_commercial ?? '',
        csb_type: csb_type || '',
        otp: otp || '',
        lsp_type: lsp_type || '',
        required_performa: required_performa || '',
        required_label: required_label || ''
      }

      vendorResult = await pushShipmentToVendor(
        vendor_config_id,
        shipmentId,
        shipmentDataForVendor
      )

      // Add tracking event for vendor push
      if (vendorResult.success) {
        await execute(
          `INSERT INTO tracking_events (shipment_id, status, description, location)
           VALUES (?, ?, ?, ?)`,
          [
            shipmentId,
            'AWB Assigned',
            `Vendor AWB: ${vendorResult.awbNumber || 'N/A'}`,
            'Vendor API'
          ]
        )
      } else {
        // Delete the shipment row from the DB since vendor push failed
        await execute('DELETE FROM shipments WHERE id = ?', [shipmentId])
        return res.status(400).json({
          success: false,
          message: `Vendor API Push Failed: ${vendorResult.error || 'Unknown error'}`
        })
      }
    }

    // ── Step 6: Refetch the shipment with updated vendor data ──
    const shipmentRows = await query(
      'SELECT * FROM shipments WHERE id = ?',
      [shipmentId]
    )

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

    // Whitelist allowed sort columns to prevent SQL injection
    const allowedSortColumns = ['created_at', 'order_id', 'tracking_number', 'status', 'total_amount']
    const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at'
    const safeSortOrder = sort_order === 'asc' ? 'ASC' : 'DESC'

    let whereClause = ''
    const params = []

    if (search) {
      whereClause += ' WHERE (s.order_id LIKE ? OR s.tracking_number LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    if (status) {
      whereClause += whereClause ? ' AND s.status = ?' : ' WHERE s.status = ?'
      params.push(status)
    }

    // Count query
    const countRows = await query(
      `SELECT COUNT(*) as total FROM shipments s${whereClause}`,
      params
    )
    const total = countRows[0].total

    // Main query with JOINs
    const dataRows = await query(
      `SELECT s.*,
        JSON_OBJECT(
          'id', snd.id, 'name', snd.name, 'phone', snd.phone, 'email', snd.email,
          'address', snd.address, 'city', snd.city, 'state', snd.state, 'pincode', snd.pincode
        ) as senders,
        JSON_OBJECT(
          'id', rcv.id, 'name', rcv.name, 'phone', rcv.phone, 'email', rcv.email,
          'address', rcv.address, 'city', rcv.city, 'state', rcv.state, 'pincode', rcv.pincode
        ) as receivers,
        JSON_OBJECT(
          'id', cp.id, 'name', cp.name, 'code', cp.code, 'tracking_url', cp.tracking_url
        ) as courier_providers,
        JSON_OBJECT(
          'id', vac.id, 'name', vac.name, 'vendor_code', vac.vendor_code
        ) as vendor_api_configs
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

    // Parse JSON objects and handle null JOINs
    const bookings = dataRows.map(row => {
      const { senders, receivers, courier_providers, vendor_api_configs, ...shipment } = row
      return {
        ...shipment,
        senders: senders?.id ? senders : null,
        receivers: receivers?.id ? receivers : null,
        courier_providers: courier_providers?.id ? courier_providers : null,
        vendor_api_configs: vendor_api_configs?.id ? vendor_api_configs : null
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

    // Fetch shipment with JOINs
    const rows = await query(
      `SELECT s.*,
        JSON_OBJECT(
          'id', snd.id, 'name', snd.name, 'phone', snd.phone, 'email', snd.email,
          'address', snd.address, 'city', snd.city, 'state', snd.state, 'pincode', snd.pincode
        ) as senders,
        JSON_OBJECT(
          'id', rcv.id, 'name', rcv.name, 'phone', rcv.phone, 'email', rcv.email,
          'address', rcv.address, 'city', rcv.city, 'state', rcv.state, 'pincode', rcv.pincode
        ) as receivers,
        JSON_OBJECT(
          'id', cp.id, 'name', cp.name, 'code', cp.code, 'tracking_url', cp.tracking_url
        ) as courier_providers,
        JSON_OBJECT(
          'id', vac.id, 'name', vac.name, 'vendor_code', vac.vendor_code,
          'environment', vac.environment
        ) as vendor_api_configs
       FROM shipments s
       LEFT JOIN senders snd ON s.sender_id = snd.id
       LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
       LEFT JOIN courier_providers cp ON s.courier_provider_id = cp.id
       LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
       WHERE s.id = ?`,
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      })
    }

    const { senders, receivers, courier_providers, vendor_api_configs, ...shipment } = rows[0]

    // Get tracking events
    const trackingEvents = await query(
      'SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY event_time DESC',
      [id]
    )

    return res.json({
      success: true,
      booking: {
        ...shipment,
        senders: senders?.id ? senders : null,
        receivers: receivers?.id ? receivers : null,
        courier_providers: courier_providers?.id ? courier_providers : null,
        vendor_api_configs: vendor_api_configs?.id ? vendor_api_configs : null,
        tracking_events: trackingEvents
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, description, location } = req.body

    // Update shipment status
    await execute(
      'UPDATE shipments SET status = ? WHERE id = ?',
      [status, id]
    )

    // Insert tracking event
    await execute(
      `INSERT INTO tracking_events (shipment_id, status, description, location)
       VALUES (?, ?, ?, ?)`,
      [id, status, description || `Status updated to ${status}`, location || 'System']
    )

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