import supabase from '../../config/supabase.js'
import generateTracking from '../../utils/generateTracking.js'
import { pushShipmentToVendor } from '../../services/vendorApiPush.service.js'

export const createBooking = async (req, res) => {
  try {
    const {
      sender_id,
      receiver_id,
      courier_provider_id,
      vendor_config_id,
      service_code,
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
      cod_amount
    } = req.body

    const tracking_number = generateTracking()
    const order_id = `ORD-${Date.now()}`

    // ── Step 1: Upsert sender if inline fields provided ──
    let finalSenderId = sender_id
    if (!finalSenderId && sender_name) {
      const { data: senderData, error: senderError } = await supabase
        .from('senders')
        .insert([{
          name: sender_name,
          email: sender_email || '',
          phone: sender_phone || '',
          address: sender_address || '',
          city: sender_city || '',
          pincode: sender_pincode || '',
          state: sender_state || '',
          country: sender_country || 'INDIA'
        }])
        .select()

      if (senderError) throw senderError
      finalSenderId = senderData[0].id
    }

    // ── Step 2: Upsert receiver if inline fields provided ──
    let finalReceiverId = receiver_id
    if (!finalReceiverId && receiver_name) {
      const { data: receiverData, error: receiverError } = await supabase
        .from('receivers')
        .insert([{
          name: receiver_name,
          email: receiver_email || '',
          phone: receiver_phone || '',
          address: receiver_address || '',
          city: receiver_city || '',
          pincode: receiver_pincode || '',
          state: receiver_state || '',
          country: receiver_country || 'INDIA'
        }])
        .select()

      if (receiverError) throw receiverError
      finalReceiverId = receiverData[0].id
    }

    // ── Step 3: Create shipment record ──
    const shipmentInsert = {
      order_id,
      sender_id: finalSenderId,
      receiver_id: finalReceiverId,
      courier_provider_id: courier_provider_id || null,
      vendor_config_id: vendor_config_id || null,
      service_code: service_code || '',
      tracking_number,
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
      status: 'pending',
      vendor_push_status: vendor_config_id ? 'pending' : 'skipped'
    }

    const { data, error } = await supabase
      .from('shipments')
      .insert([shipmentInsert])
      .select()

    if (error) throw error

    const shipment = data[0]

    // ── Step 4: Create tracking event ──
    await supabase.from('tracking_events').insert([
      {
        shipment_id: shipment.id,
        status: 'Shipment Created',
        description: 'Shipment booked successfully',
        location: 'System'
      }
    ])

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
        service_code: service_code || '',
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
        receiver_country: receiver_country || 'INDIA'
      }

      vendorResult = await pushShipmentToVendor(
        vendor_config_id,
        shipment.id,
        shipmentDataForVendor
      )

      // Add tracking event for vendor push
      if (vendorResult.success) {
        await supabase.from('tracking_events').insert([{
          shipment_id: shipment.id,
          status: 'AWB Assigned',
          description: `Vendor AWB: ${vendorResult.awbNumber || 'N/A'}`,
          location: 'Vendor API'
        }])
      }
    }

    // ── Step 6: Refetch the shipment with updated vendor data ──
    const { data: finalShipment } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', shipment.id)
      .single()

    return res.status(201).json({
      success: true,
      booking: finalShipment || shipment,
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

    const offset = (page - 1) * limit

    let query = supabase
      .from('shipments')
      .select(
        `
        *,
        senders(*),
        receivers(*),
        courier_providers(*),
        vendor_api_configs(id, name, vendor_code)
      `,
        { count: 'exact' }
      )

    // Search by order_id or tracking_number
    if (search) {
      query = query.or(
        `order_id.ilike.%${search}%,tracking_number.ilike.%${search}%`
      )
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status)
    }

    // Sort
    query = query.order(sort_by, {
      ascending: sort_order === 'asc'
    })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    return res.json({
      success: true,
      bookings: data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
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

    const { data: booking, error } = await supabase
      .from('shipments')
      .select(
        `
        *,
        senders(*),
        receivers(*),
        courier_providers(*),
        vendor_api_configs(id, name, vendor_code, environment)
      `
      )
      .eq('id', id)
      .single()

    if (error) throw error

    // Get tracking events
    const { data: trackingEvents, error: trackingError } = await supabase
      .from('tracking_events')
      .select('*')
      .eq('shipment_id', id)
      .order('event_time', { ascending: false })

    if (trackingError) throw trackingError

    return res.json({
      success: true,
      booking: {
        ...booking,
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
    const { data, error } = await supabase
      .from('shipments')
      .update({ status })
      .eq('id', id)
      .select()

    if (error) throw error

    // Insert tracking event
    await supabase.from('tracking_events').insert([
      {
        shipment_id: id,
        status,
        description: description || `Status updated to ${status}`,
        location: location || 'System'
      }
    ])

    return res.json({
      success: true,
      booking: data[0]
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}