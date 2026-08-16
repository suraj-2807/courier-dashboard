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
    throw new Error(`Pacific tracking API returned status ${response.status}`)
  }

  const data = await response.json()

  if (data.ErrorCode !== '0' && data.ResponseCode !== 'RT01') {
    throw new Error(data.ErrorDisc || 'Pacific tracking failed: invalid response')
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

  // Determine current status from latest event or tracking object
  const latestEvent = events[0] || {}
  const statusString = latestEvent.status || tracking.Status || 'In Progress'
  const statusLower = statusString.toLowerCase()

  let currentStage = 'booked'
  if (statusLower.includes('delivered')) currentStage = 'delivered'
  else if (statusLower.includes('out for delivery')) currentStage = 'out_for_delivery'
  else if (statusLower.includes('departed') || statusLower.includes('arrived') || statusLower.includes('in transit') || statusLower.includes('import scan') || statusLower.includes('processing')) currentStage = 'in_transit'
  else if (statusLower.includes('origin scan') || statusLower.includes('received') || statusLower.includes('picked') || statusLower.includes('label')) currentStage = 'picked_up'

  // Extract secondary AWB (FedEx / UPS AWB)
  const secondaryAwb = tracking.VendorAWBNo1 || tracking.VendorAWBNo2 || ''

  return {
    vendor: 'Pacific Express',
    vendorCode: 'pacific',
    shipmentInfo: {
      awbNo: tracking.AWBNo || awb,
      vendorAwbNo: secondaryAwb,
      secondaryCarrier: tracking.VendorName || tracking.VendorName2 || '',
      bookingDate: tracking.BookingDate1 || tracking.BookingDate || '',
      origin: tracking.Origin || '',
      originCountry: tracking.Origin_Country || '',
      destination: tracking.Destination || '',
      destinationCountry: tracking.Destination_Country || '',
      consignee: tracking.Consignee || '',
      shipperName: tracking.Shipper_Name || '',
      vendorName: tracking.VendorName || 'Pacific Express',
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
    currentStatus: statusString,
    currentStage
  }
}

// ─── FlySwift Tracking ─────────────────────────────────────────────
async function trackTrackmateVendor(awb, config, defaultVendorName = 'FlySwift') {
  const creds = parseCredentials(config.auth_credentials)
  const apiCompanyId = creds.api_company_id || creds.company_id || creds.company_code || '5'
  const customerCode = creds.customer_code || creds.customer_id || ''

  // Determine host dynamically from config auth_url or shipment_api_url
  let host = 'admin.flyswift.net'
  if (config.auth_url) {
    try {
      const parsedUrl = new URL(config.auth_url)
      host = parsedUrl.host
    } catch {}
  } else if (config.shipment_api_url) {
    try {
      const parsedUrl = new URL(config.shipment_api_url)
      host = parsedUrl.host
    } catch {}
  }

  const vendorDisplayName = config.name || defaultVendorName || 'Courier Partner'
  const trackingUrl = `https://${host}/api/tracking_api/get_tracking_data?api_company_id=${apiCompanyId}&customer_code=${customerCode}&tracking_no=${awb}`

  const response = await fetch(trackingUrl, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`${vendorDisplayName} tracking API returned status ${response.status}`)
  }

  const data = await response.json()

  const trackingData = data.data || data
  const shipment = trackingData.shipment || trackingData.docket || trackingData || {}

  const rawEvents = trackingData.tracking_history || trackingData.events || trackingData.tracking || shipment.tracking_history || []
  const events = (Array.isArray(rawEvents) ? rawEvents : []).map(ev => ({
    date: ev.date || ev.event_date || ev.created_at || '',
    time: ev.time || ev.event_time || '',
    location: ev.location || ev.city || ev.hub || '',
    status: ev.status || ev.event || ev.description || '',
    rawDate: ev.date || ev.event_date || '',
    rawTime: ev.time || ev.event_time || ''
  }))

  const latestEvent = events[0] || {}
  const statusString = shipment.status || latestEvent.status || 'In Progress'
  const statusLower = statusString.toLowerCase()

  let currentStage = 'booked'
  if (statusLower.includes('delivered') || statusLower.includes('dlvd')) currentStage = 'delivered'
  else if (statusLower.includes('out for delivery') || statusLower.includes('ofd')) currentStage = 'out_for_delivery'
  else if (statusLower.includes('transit') || statusLower.includes('departed') || statusLower.includes('arrived') || statusLower.includes('hub')) currentStage = 'in_transit'
  else if (statusLower.includes('picked') || statusLower.includes('booked') || statusLower.includes('manifest')) currentStage = 'picked_up'

  return {
    vendor: vendorDisplayName,
    vendorCode: (config.vendor_code || 'acx').toLowerCase(),
    shipmentInfo: {
      awbNo: shipment.tracking_no || shipment.docket_no || String(awb),
      vendorAwbNo: shipment.vendor_awb || shipment.ref_no || '',
      secondaryCarrier: shipment.carrier || '',
      bookingDate: shipment.booking_date || shipment.created_at || '',
      origin: shipment.origin || shipment.origin_city || '',
      originCountry: shipment.origin_country || 'INDIA',
      destination: shipment.destination || shipment.destination_city || '',
      destinationCountry: shipment.destination_country || '',
      consignee: shipment.consignee_name || shipment.receiver_name || '',
      shipperName: shipment.shipper_name || shipment.sender_name || '',
      vendorName: shipment.vendor_name || vendorDisplayName,
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
    currentStatus: statusString,
    currentStage
  }
}

// ─── Vendor Dispatcher ─────────────────────────────────────────────
const VENDOR_TRACKERS = {
  pacific: trackPacific,
  pacifc: trackPacific,
  flyswift: trackTrackmateVendor,
  trackmate: trackTrackmateVendor,
  acx: trackTrackmateVendor,
  acxintl: trackTrackmateVendor,
  acx_international: trackTrackmateVendor
}

// ═══════════════════════════════════════════════════════════════════
// Existing searchTracking (DB-only lookup)
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
          OR s.vendor_awb_number = ? 
          OR s.order_id = ? 
          OR s.invoice_no = ?
       LIMIT 1`,
      [tracking_number, tracking_number, tracking_number, tracking_number]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      })
    }

    const { senders, receivers, courier_providers, ...shipment } = rows[0]

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

    const searchStr = String(awb).trim()
    let vendorAwbToTrack = searchStr
    let matchedShipment = null
    let vendorCode = vendor_code || ''
    let config = null

    // ── 1. Search database for matching shipment by our AWB, Order ID, Invoice, or Vendor AWB ──
    const shipments = await query(
      `SELECT s.*, 
              cp.code as provider_code, cp.name as provider_name,
              vac.vendor_code as vac_vendor_code, vac.id as vac_config_id,
              vac.auth_credentials as vac_credentials
       FROM shipments s
       LEFT JOIN courier_providers cp ON s.courier_provider_id = cp.id
       LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
       WHERE s.tracking_number = ? 
          OR s.vendor_awb_number = ? 
          OR s.order_id = ? 
          OR s.order_reference = ?
          OR s.invoice_no = ?
       LIMIT 1`,
      [searchStr, searchStr, searchStr, searchStr, searchStr]
    )

    if (shipments.length > 0) {
      matchedShipment = shipments[0]
      // Use vendor_awb_number if available; fallback to tracking_number or user searchStr
      vendorAwbToTrack = matchedShipment.vendor_awb_number && matchedShipment.vendor_awb_number.trim() !== ''
        ? matchedShipment.vendor_awb_number.trim()
        : (matchedShipment.tracking_number || searchStr)

      // Resolve vendor code from shipment
      if (!vendorCode) {
        vendorCode = matchedShipment.vac_vendor_code || matchedShipment.vendor_code || matchedShipment.provider_code || ''
      }

      // If vendor_config_id is directly linked
      if (matchedShipment.vendor_config_id) {
        const configRows = await query(
          `SELECT * FROM vendor_api_configs WHERE id = ? AND is_active = TRUE LIMIT 1`,
          [matchedShipment.vendor_config_id]
        )
        if (configRows.length > 0) {
          config = configRows[0]
        }
      }
    }

    // ── 2. If no shipment found yet, check booking_requests ──
    if (!matchedShipment) {
      const requests = await query(
        `SELECT br.*, s.vendor_awb_number as ship_vendor_awb, s.vendor_config_id, s.vendor_code as ship_vendor_code
         FROM booking_requests br
         LEFT JOIN shipments s ON br.shipment_id = s.id
         WHERE br.request_awb = ? OR br.tracking_number = ?
         LIMIT 1`,
        [searchStr, searchStr]
      )

      if (requests.length > 0) {
        const reqRow = requests[0]
        vendorAwbToTrack = reqRow.ship_vendor_awb || reqRow.tracking_number || searchStr
        if (!vendorCode && reqRow.ship_vendor_code) {
          vendorCode = reqRow.ship_vendor_code
        }
        if (reqRow.vendor_config_id) {
          const configRows = await query(
            `SELECT * FROM vendor_api_configs WHERE id = ? AND is_active = TRUE LIMIT 1`,
            [reqRow.vendor_config_id]
          )
          if (configRows.length > 0) config = configRows[0]
        }
      }
    }

    // ── 3. If explicit vendorCode is known but config not loaded ──
    if (!config && vendorCode) {
      const configs = await query(
        `SELECT * FROM vendor_api_configs WHERE LOWER(vendor_code) = ? AND is_active = TRUE LIMIT 1`,
        [vendorCode.toLowerCase()]
      )
      if (configs.length > 0) {
        config = configs[0]
      }
    }

    // ── 4. Try tracking with matched config ──
    if (config) {
      const normalizedCode = (config.vendor_code || vendorCode || '').toLowerCase()
      const tracker = VENDOR_TRACKERS[normalizedCode]

      if (tracker) {
        try {
          const result = await tracker(vendorAwbToTrack, config)
          if (matchedShipment) {
            result.internalShipment = {
              id: matchedShipment.id,
              ourAwb: matchedShipment.tracking_number,
              orderId: matchedShipment.order_id,
              invoiceNo: matchedShipment.invoice_no,
              vendorAwbNumber: matchedShipment.vendor_awb_number
            }
          }
          return res.json({ success: true, tracking: result })
        } catch (trackErr) {
          console.warn(`Direct tracker ${normalizedCode} failed for AWB ${vendorAwbToTrack}:`, trackErr.message)
        }
      }
    }

    // ── 5. Fallback: Iterate across all active vendor configs ──
    const allConfigs = await query(
      `SELECT * FROM vendor_api_configs WHERE is_active = TRUE ORDER BY created_at DESC`
    )

    for (const cfg of allConfigs) {
      const code = (cfg.vendor_code || '').toLowerCase()
      const tracker = VENDOR_TRACKERS[code]
      if (!tracker) continue

      // Try tracking with vendorAwbToTrack first, and searchStr as fallback
      const awbsToAttempt = [vendorAwbToTrack]
      if (searchStr !== vendorAwbToTrack) awbsToAttempt.push(searchStr)

      for (const targetAwb of awbsToAttempt) {
        try {
          const result = await tracker(targetAwb, cfg)
          if (result && (result.events?.length > 0 || result.shipmentInfo?.awbNo)) {
            if (matchedShipment) {
              result.internalShipment = {
                id: matchedShipment.id,
                ourAwb: matchedShipment.tracking_number,
                orderId: matchedShipment.order_id,
                invoiceNo: matchedShipment.invoice_no,
                vendorAwbNumber: matchedShipment.vendor_awb_number
              }
            }
            return res.json({ success: true, tracking: result })
          }
        } catch (err) {
          // Continue to next
        }
      }
    }

    return res.status(404).json({
      success: false,
      message: `No live tracking information found for AWB "${searchStr}".`
    })

  } catch (error) {
    console.error('Live tracking error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Tracking lookup failed'
    })
  }
}
