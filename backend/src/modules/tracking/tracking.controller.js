import { query } from '../../config/db.js'
import { decrypt } from '../../utils/encryption.js'

// ─── Helper: safely parse credentials (encrypted or plain JSON) ────
function parseCredentials(raw) {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null) return raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return {}
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { return JSON.parse(trimmed) } catch (e) {}
    }
    try {
      const decrypted = decrypt(trimmed)
      if (decrypted) {
        return typeof decrypted === 'object' ? decrypted : JSON.parse(decrypted)
      }
    } catch (e) {}
    try { return JSON.parse(trimmed) } catch (e) {}
  }
  return {}
}

// ─── Pacific Express Tracking ──────────────────────────────────────
async function trackPacific(awb, config) {
  const creds = parseCredentials(config.auth_credentials)
  const userId = creds.user_id || creds.username || creds.UserID || ''
  const password = creds.password || creds.Password || ''

  const trackingUrl = 'https://eship.pacificexp.net/api/v1/Tracking/Tracking'

  const response = await fetch(trackingUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      UserID: userId,
      Password: password,
      AWBNo: String(awb),
      Type: 'A'
    })
  })

  if (!response.ok) {
    throw new Error(`Pacific tracking API returned ${response.status}`)
  }

  const data = await response.json()

  if (data.ErrorCode !== '0' && data.ResponseCode !== 'RT01') {
    throw new Error(data.ErrorDisc || 'Pacific tracking failed')
  }

  const tracking = data.Tracking?.[0] || {}
  const events = (data.Events || []).map(ev => ({
    date: ev.EventDate1 || ev.EventDate || '',
    time: ev.EventTime1 || ev.EventTime || '',
    location: ev.Location || '',
    status: ev.Status || '',
    rawDate: ev.EventDate || '',
    rawTime: ev.EventTime || ''
  }))

  // Determine current status from latest event
  const latestEvent = events[0] || {}
  const statusLower = (latestEvent.status || '').toLowerCase()

  let currentStage = 'booked'
  if (statusLower.includes('delivered')) currentStage = 'delivered'
  else if (statusLower.includes('out for delivery')) currentStage = 'out_for_delivery'
  else if (statusLower.includes('departed') || statusLower.includes('arrived') || statusLower.includes('in transit') || statusLower.includes('import scan') || statusLower.includes('processing')) currentStage = 'in_transit'
  else if (statusLower.includes('origin scan') || statusLower.includes('received') || statusLower.includes('picked') || statusLower.includes('label')) currentStage = 'picked_up'

  return {
    vendor: 'Pacific Express',
    vendorCode: 'pacific',
    shipmentInfo: {
      awbNo: tracking.AWBNo || awb,
      vendorAwbNo: tracking.VendorAWBNo1 || tracking.VendorAWBNo2 || '',
      bookingDate: tracking.BookingDate1 || tracking.BookingDate || '',
      origin: tracking.Origin || '',
      originCountry: tracking.Origin_Country || '',
      destination: tracking.Destination || '',
      destinationCountry: tracking.Destination_Country || '',
      consignee: tracking.Consignee || '',
      shipperName: tracking.Shipper_Name || '',
      vendorName: tracking.VendorName || '',
      serviceName: tracking.ServiceName || '',
      weight: tracking.Weight || '',
      refNo: tracking.RefNo || '',
      deliveryDate: tracking.DeliveryDate1 || tracking.DeliveryDate || '',
      deliveryTime: tracking.DeliveryTime1 || tracking.DeliveryTime || '',
      receiverName: tracking.ReceiverName || '',
      expectedDeliveryDate: tracking.ExpectedDeliveryDate || '',
      podAvailable: tracking.PODImage === 'Yes',
      remark: tracking.Remark || ''
    },
    events,
    currentStatus: latestEvent.status || 'Unknown',
    currentStage
  }
}

// ─── FlySwift Tracking ─────────────────────────────────────────────
async function trackFlySwift(awb, config) {
  const creds = parseCredentials(config.auth_credentials)
  const apiCompanyId = creds.api_company_id || creds.company_id || creds.company_code || ''
  const customerCode = creds.customer_code || creds.customer_id || ''

  const trackingUrl = `https://admin.flyswift.net/api/tracking_api/get_tracking_data?api_company_id=${apiCompanyId}&customer_code=${customerCode}&tracking_no=${awb}`

  const response = await fetch(trackingUrl, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`FlySwift tracking API returned ${response.status}`)
  }

  const data = await response.json()

  // FlySwift returns data in various possible structures
  const trackingData = data.data || data
  const shipment = trackingData.shipment || trackingData.docket || trackingData || {}

  // Extract events from FlySwift response
  const rawEvents = trackingData.tracking_history || trackingData.events || trackingData.tracking || shipment.tracking_history || []
  const events = rawEvents.map(ev => ({
    date: ev.date || ev.event_date || ev.created_at || '',
    time: ev.time || ev.event_time || '',
    location: ev.location || ev.city || ev.hub || '',
    status: ev.status || ev.event || ev.description || '',
    rawDate: ev.date || ev.event_date || '',
    rawTime: ev.time || ev.event_time || ''
  }))

  // Try to determine current stage
  const latestEvent = events[0] || {}
  const statusLower = (shipment.status || latestEvent.status || '').toLowerCase()

  let currentStage = 'booked'
  if (statusLower.includes('delivered') || statusLower.includes('dlvd')) currentStage = 'delivered'
  else if (statusLower.includes('out for delivery') || statusLower.includes('ofd')) currentStage = 'out_for_delivery'
  else if (statusLower.includes('transit') || statusLower.includes('departed') || statusLower.includes('arrived') || statusLower.includes('hub')) currentStage = 'in_transit'
  else if (statusLower.includes('picked') || statusLower.includes('booked') || statusLower.includes('manifest')) currentStage = 'picked_up'

  return {
    vendor: 'FlySwift',
    vendorCode: 'flyswift',
    shipmentInfo: {
      awbNo: shipment.tracking_no || shipment.docket_no || String(awb),
      vendorAwbNo: shipment.vendor_awb || shipment.ref_no || '',
      bookingDate: shipment.booking_date || shipment.created_at || '',
      origin: shipment.origin || shipment.origin_city || '',
      originCountry: shipment.origin_country || 'INDIA',
      destination: shipment.destination || shipment.destination_city || '',
      destinationCountry: shipment.destination_country || '',
      consignee: shipment.consignee_name || shipment.receiver_name || '',
      shipperName: shipment.shipper_name || shipment.sender_name || '',
      vendorName: shipment.vendor_name || shipment.carrier || '',
      serviceName: shipment.service_name || shipment.service_type || '',
      weight: shipment.weight || shipment.actual_weight || '',
      refNo: shipment.reference_no || shipment.ref_no || '',
      deliveryDate: shipment.delivery_date || '',
      deliveryTime: shipment.delivery_time || '',
      receiverName: shipment.receiver_name || '',
      expectedDeliveryDate: shipment.expected_delivery_date || shipment.edd || '',
      podAvailable: false,
      remark: shipment.remark || ''
    },
    events,
    currentStatus: shipment.status || latestEvent.status || 'Unknown',
    currentStage
  }
}

// ─── Vendor Dispatcher ─────────────────────────────────────────────
const VENDOR_TRACKERS = {
  pacific: trackPacific,
  pacifc: trackPacific,  // typo alias
  flyswift: trackFlySwift,
  trackmate: trackFlySwift // alias
}

// ═══════════════════════════════════════════════════════════════════
// Existing searchTracking (DB-only lookup — unchanged)
// ═══════════════════════════════════════════════════════════════════
export const searchTracking = async (req, res) => {
  try {
    const { tracking_number } = req.query

    if (!tracking_number) {
      return res.status(400).json({
        success: false,
        message: 'Tracking number is required'
      })
    }

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
        ) as courier_providers
       FROM shipments s
       LEFT JOIN senders snd ON s.sender_id = snd.id
       LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
       LEFT JOIN courier_providers cp ON s.courier_provider_id = cp.id
       WHERE s.tracking_number = ?
       LIMIT 1`,
      [tracking_number]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      })
    }

    const { senders, receivers, courier_providers, ...shipment } = rows[0]

    // Get tracking events
    const events = await query(
      'SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY event_time DESC',
      [shipment.id]
    )

    return res.json({
      success: true,
      shipment: {
        ...shipment,
        senders: senders?.id ? senders : null,
        receivers: receivers?.id ? receivers : null,
        courier_providers: courier_providers?.id ? courier_providers : null,
        tracking_events: events
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

// ═══════════════════════════════════════════════════════════════════
// NEW: Live tracking via vendor APIs
// ═══════════════════════════════════════════════════════════════════
export const liveTrack = async (req, res) => {
  try {
    const { awb, vendor_code } = req.query

    if (!awb) {
      return res.status(400).json({
        success: false,
        message: 'AWB number is required'
      })
    }

    let vendorCode = vendor_code || ''
    let config = null

    // ── Strategy 1: Explicit vendor_code provided → find its config ──
    if (vendorCode) {
      const configs = await query(
        `SELECT * FROM vendor_api_configs WHERE LOWER(vendor_code) = ? AND is_active = TRUE LIMIT 1`,
        [vendorCode.toLowerCase()]
      )
      if (configs.length > 0) config = configs[0]
    }

    // ── Strategy 2: Look up shipment in DB to find its vendor ──
    if (!config) {
      const shipments = await query(
        `SELECT s.courier_provider_id, s.vendor_code as shipment_vendor_code,
                cp.code as provider_code, cp.name as provider_name
         FROM shipments s
         LEFT JOIN courier_providers cp ON s.courier_provider_id = cp.id
         WHERE s.tracking_number = ? OR s.awb_number = ?
         LIMIT 1`,
        [awb, awb]
      )

      if (shipments.length > 0) {
        const ship = shipments[0]
        const lookupCode = ship.shipment_vendor_code || ship.provider_code || ''

        if (lookupCode) {
          const configs = await query(
            `SELECT * FROM vendor_api_configs WHERE LOWER(vendor_code) = ? AND is_active = TRUE LIMIT 1`,
            [lookupCode.toLowerCase()]
          )
          if (configs.length > 0) {
            config = configs[0]
            vendorCode = lookupCode.toLowerCase()
          }
        }
      }
    }

    // ── Strategy 3: Try all active vendors one by one ──
    if (!config) {
      const allConfigs = await query(
        `SELECT * FROM vendor_api_configs WHERE is_active = TRUE ORDER BY created_at DESC`
      )

      // Try each vendor's tracking API
      for (const cfg of allConfigs) {
        const code = (cfg.vendor_code || '').toLowerCase()
        const tracker = VENDOR_TRACKERS[code]
        if (!tracker) continue

        try {
          const result = await tracker(awb, cfg)
          if (result && result.events && result.events.length > 0) {
            return res.json({ success: true, tracking: result })
          }
        } catch (err) {
          // This vendor didn't have the AWB, try next
          console.log(`Tracking attempt with ${code} failed: ${err.message}`)
        }
      }

      return res.status(404).json({
        success: false,
        message: 'No tracking data found for this AWB across any vendor'
      })
    }

    // ── Execute tracking with found config ──
    const normalizedCode = (vendorCode || config.vendor_code || '').toLowerCase()
    const tracker = VENDOR_TRACKERS[normalizedCode]

    if (!tracker) {
      return res.status(400).json({
        success: false,
        message: `No tracking support for vendor "${config.vendor_code || vendorCode}". Supported: ${Object.keys(VENDOR_TRACKERS).join(', ')}`
      })
    }

    const result = await tracker(awb, config)
    return res.json({ success: true, tracking: result })

  } catch (error) {
    console.error('Live tracking error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Tracking failed'
    })
  }
}
