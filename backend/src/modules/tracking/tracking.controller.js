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
  const userId = creds.user_id || creds.username || creds.UserID || 'P0503'
  const password = creds.password || creds.Password || 'P0503@7199'

  let trackingUrl = config.tracking_api_url || 'https://eship.pacificexp.net/api/v1/Tracking/Tracking'
  if (trackingUrl && !trackingUrl.startsWith('http://') && !trackingUrl.startsWith('https://')) {
    trackingUrl = `https://${trackingUrl}`
  }

  const startTime = Date.now()
  const response = await fetch(trackingUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      UserID: userId,
      Password: password,
      AWBNo: String(awb).trim(),
      Type: 'A'
    })
  })

  const latencyMs = Date.now() - startTime

  if (!response.ok) {
    throw new Error(`Pacific tracking API returned status ${response.status}`)
  }

  const rawText = await response.text()
  let data = {}
  try {
    data = JSON.parse(rawText)
  } catch (e) {
    throw new Error('Pacific tracking returned non-JSON response')
  }

  // Support both flat ResponseCode and nested data.Response
  const resObj = data.Response || data

  if (resObj.ErrorCode !== '0' && resObj.ResponseCode !== 'RT01' && String(resObj.ErrorDisc || '').toLowerCase() !== 'success') {
    throw new Error(resObj.ErrorDisc || 'Pacific tracking failed: invalid response')
  }

  const tracking = (Array.isArray(resObj.Tracking) ? resObj.Tracking[0] : resObj.Tracking) || {}
  const events = (Array.isArray(resObj.Events) ? resObj.Events : []).map(ev => ({
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
  else if (statusLower.includes('out for delivery') || statusLower.includes('today')) currentStage = 'out_for_delivery'
  else if (statusLower.includes('departed') || statusLower.includes('arrived') || statusLower.includes('in transit') || statusLower.includes('import scan') || statusLower.includes('processing') || statusLower.includes('facility') || statusLower.includes('scan')) currentStage = 'in_transit'
  else if (statusLower.includes('origin scan') || statusLower.includes('received') || statusLower.includes('picked') || statusLower.includes('label')) currentStage = 'picked_up'

  // Extract secondary AWB (FedEx / UPS / DHL AWB 2)
  const secondaryAwb = tracking.VendorAWBNo2 || tracking.VendorAWBNo1 || tracking.VendorAWBNo || tracking.VendorAwbNo2 || tracking.VendorAwbNo1 || tracking.VendorAwbNo || ''
  const secondaryCarrier = tracking.VendorName2 || tracking.VendorName || tracking.Vendor_Code1 || tracking.Vendor_Code || ''

  return {
    vendor: 'Pacific Express',
    vendorCode: 'pacific',
    shipmentInfo: {
      awbNo: tracking.AWBNo || awb,
      vendorAwbNo: secondaryAwb,
      secondaryCarrier: secondaryCarrier,
      bookingDate: tracking.BookingDate1 || tracking.BookingDate || '',
      origin: tracking.Origin || '',
      originCountry: tracking.Origin_Country || 'INDIA',
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
    dimensions: Array.isArray(resObj.Dimensions) ? resObj.Dimensions : [],
    performa: Array.isArray(resObj.Performa) ? resObj.Performa : [],
    currentStatus: statusString,
    currentStage,
    apiLog: {
      success: true,
      vendorName: 'Pacific Express',
      vendorCode: 'pacific',
      endpoint: trackingUrl,
      httpStatus: response.status,
      latencyMs,
      timestamp: new Date().toISOString(),
      awb: String(awb).trim(),
      eventsCount: events.length,
      status: statusString,
      message: `Live tracking synced from Pacific Express API (${events.length} events, ${latencyMs}ms)`
    }
  }
}

// ─── FlySwift / Trackmate / Bhabani / ACX (ITDServices Platform) ────
async function trackTrackmateVendor(awb, config, defaultVendorName = 'Courier Partner') {
  const creds = parseCredentials(config?.auth_credentials)
  const apiCompanyId = creds.api_company_id || creds.company_code || creds.company_id || creds.customer_code || creds.customer_id || '1032'
  const customerCode = creds.customer_code || creds.customer_id || creds.company_code || creds.api_company_id || '1032'

  // Determine host dynamically from config auth_url or shipment_api_url
  let host = 'admin.flyswift.net'
  if (config?.auth_url) {
    try {
      const urlStr = config.auth_url.startsWith('http') ? config.auth_url : `https://${config.auth_url}`
      const parsedUrl = new URL(urlStr)
      host = parsedUrl.host
    } catch {}
  } else if (config?.shipment_api_url) {
    try {
      const urlStr = config.shipment_api_url.startsWith('http') ? config.shipment_api_url : `https://${config.shipment_api_url}`
      const parsedUrl = new URL(urlStr)
      host = parsedUrl.host
    } catch {}
  }

  const vendorDisplayName = config?.name || defaultVendorName || 'Courier Partner'
  const cleanAwb = String(awb).trim()

  // Use explicit tracking_api_url if configured, otherwise construct from host
  let trackingUrl
  if (config?.tracking_api_url && config.tracking_api_url.trim() !== '') {
    let configuredUrl = config.tracking_api_url.trim()
    if (!configuredUrl.startsWith('http://') && !configuredUrl.startsWith('https://')) {
      configuredUrl = `https://${configuredUrl}`
    }

    if (configuredUrl.includes('{tracking_no}') || configuredUrl.includes('{awb}')) {
      trackingUrl = configuredUrl
        .replace('{tracking_no}', encodeURIComponent(cleanAwb))
        .replace('{awb}', encodeURIComponent(cleanAwb))
        .replace('{api_company_id}', encodeURIComponent(apiCompanyId))
        .replace('{customer_code}', encodeURIComponent(customerCode))
    } else if (configuredUrl.includes('api_company_id') || configuredUrl.includes('tracking_no')) {
      // Already has some query params, append tracking_no if missing
      if (!configuredUrl.includes('tracking_no=')) {
        const sep = configuredUrl.includes('?') ? '&' : '?'
        trackingUrl = `${configuredUrl}${sep}tracking_no=${encodeURIComponent(cleanAwb)}`
      } else {
        trackingUrl = configuredUrl
      }
    } else {
      const sep = configuredUrl.includes('?') ? '&' : '?'
      trackingUrl = `${configuredUrl}${sep}api_company_id=${apiCompanyId}&customer_code=${customerCode}&tracking_no=${encodeURIComponent(cleanAwb)}`
    }
  } else {
    trackingUrl = `https://${host}/api/tracking_api/get_tracking_data?api_company_id=${apiCompanyId}&customer_code=${customerCode}&tracking_no=${encodeURIComponent(cleanAwb)}`
  }

  const startTime = Date.now()
  const response = await fetch(trackingUrl, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })

  const latencyMs = Date.now() - startTime

  if (!response.ok) {
    throw new Error(`${vendorDisplayName} tracking API returned status ${response.status}`)
  }

  let rawText = await response.text()
  rawText = rawText.trim()
  if (rawText.startsWith('"') && rawText.endsWith('"')) {
    rawText = rawText.slice(1, -1)
  }

  let data = {}
  try {
    data = JSON.parse(rawText)
  } catch (e) {
    throw new Error(`${vendorDisplayName} tracking returned invalid JSON response`)
  }

  if (Array.isArray(data)) {
    data = data[0] || {}
  }

  const trackingData = data.data || data
  const shipment = trackingData.shipment || trackingData.docket || trackingData || {}

  // Parse docket_info array into key-value map
  const infoMap = {}
  if (Array.isArray(trackingData.docket_info)) {
    trackingData.docket_info.forEach(row => {
      if (Array.isArray(row) && row.length >= 2) {
        const k = String(row[0]).trim()
        const v = String(row[1]).trim()
        infoMap[k] = v
      }
    })
  }

  // Parse events (docket_events or tracking_history)
  let rawEvents = trackingData.docket_events || trackingData.tracking_history || trackingData.events || trackingData.tracking || shipment.tracking_history || []
  if (!Array.isArray(rawEvents) && typeof rawEvents === 'object' && rawEvents !== null) {
    rawEvents = Object.values(rawEvents)
  }

  const events = (Array.isArray(rawEvents) ? rawEvents : []).map(ev => {
    let evDate = ''
    let evTime = ''
    if (ev.event_at) {
      const parts = ev.event_at.split(' ')
      evDate = parts[0] || ''
      evTime = parts[1] || ''
    } else {
      evDate = ev.date || ev.event_date || ev.created_at || ''
      evTime = ev.time || ev.event_time || ''
    }
    const location = ev.event_location || ev.add_city || ev.add_state_or_province_code || ev.add_country_code || (infoMap['Origin Hub'] ? `${infoMap['Origin Hub']} Hub` : '') || ''
    return {
      date: evDate,
      time: evTime,
      location: location,
      status: ev.event_description || ev.status || ev.event || ev.event_state || 'Event Recorded',
      rawDate: ev.event_at || evDate,
      rawTime: evTime
    }
  })

  // Extract forwarding_no (Carrier AWB 2 e.g. UPS / FedEx / DHL)
  const secondaryAwb = trackingData.forwarding_no || infoMap['Forwarding No.'] || shipment.vendor_awb_2 || shipment.awb_2 || shipment.vendor_awb || shipment.vendor_awb_no || shipment.ref_no || ''
  const serviceName = infoMap['Service Name'] || shipment.service_name || shipment.service_type || ''

  // Determine secondary carrier
  let secondaryCarrier = ''
  const serviceUpper = serviceName.toUpperCase()
  if (serviceUpper.includes('UPS') || secondaryAwb.startsWith('1Z')) {
    secondaryCarrier = 'UPS'
  } else if (serviceUpper.includes('FEDEX') || serviceUpper.includes('FDX')) {
    secondaryCarrier = 'FEDEX'
  } else if (serviceUpper.includes('DHL')) {
    secondaryCarrier = 'DHL'
  } else if (serviceUpper.includes('ARAMEX')) {
    secondaryCarrier = 'Aramex'
  } else {
    secondaryCarrier = shipment.carrier || (serviceName ? serviceName.split(' ')[0] : 'Carrier')
  }

  const latestEvent = events[0] || {}
  const statusString = infoMap['Status'] || latestEvent.status || shipment.status || 'In Progress'
  const statusLower = statusString.toLowerCase()

  let currentStage = 'booked'
  if (statusLower.includes('delivered') || statusLower.includes('dlvd')) currentStage = 'delivered'
  else if (statusLower.includes('out for delivery') || statusLower.includes('ofd')) currentStage = 'out_for_delivery'
  else if (statusLower.includes('transit') || statusLower.includes('departed') || statusLower.includes('arrived') || statusLower.includes('hub') || statusLower.includes('facility') || statusLower.includes('customs')) currentStage = 'in_transit'
  else if (statusLower.includes('picked') || statusLower.includes('label') || statusLower.includes('entry') || statusLower.includes('booked') || statusLower.includes('manifest')) currentStage = 'picked_up'

  const originCity = infoMap['Shipper City'] || (infoMap['Origin Hub'] ? `${infoMap['Origin Hub']} Hub` : '') || infoMap['Origin'] || shipment.origin || ''
  const destCity = infoMap['Consignee City'] ? `${infoMap['Consignee City']}${infoMap['Consignee State'] ? ', ' + infoMap['Consignee State'] : ''}` : (infoMap['Destination'] || shipment.destination || '')

  return {
    vendor: vendorDisplayName,
    vendorCode: (config?.vendor_code || 'flyswift').toLowerCase(),
    shipmentInfo: {
      awbNo: trackingData.tracking_no || shipment.tracking_no || shipment.docket_no || cleanAwb,
      vendorAwbNo: secondaryAwb,
      secondaryCarrier: secondaryCarrier,
      bookingDate: infoMap['Booking Date'] || shipment.booking_date || shipment.created_at || '',
      origin: originCity,
      originCountry: infoMap['Shipper Country'] || infoMap['Origin'] || 'INDIA',
      destination: destCity,
      destinationCountry: infoMap['Consignee Country'] || infoMap['Destination'] || '',
      consignee: infoMap['Consignee Name'] || infoMap['Consignee Company'] || shipment.consignee_name || shipment.receiver_name || '',
      shipperName: infoMap['Shipper Name'] || infoMap['Shipper Company'] || shipment.shipper_name || shipment.sender_name || '',
      vendorName: vendorDisplayName,
      serviceName: serviceName,
      weight: trackingData.chargeable_weight || shipment.weight || shipment.actual_weight || '',
      refNo: trackingData.reference_no || shipment.reference_no || shipment.ref_no || '',
      deliveryDate: infoMap['Delivery Date and Time'] || shipment.delivery_date || '',
      deliveryTime: shipment.delivery_time || '',
      receiverName: infoMap['Receiver Name'] || shipment.receiver_name || '',
      expectedDeliveryDate: trackingData.expected_datetime || shipment.expected_delivery_date || shipment.edd || '',
      podAvailable: Boolean(trackingData.pod_image || trackingData.pod_signature),
      remark: infoMap['Delivery Remark'] || infoMap['Reason For Status'] || shipment.remark || ''
    },
    events,
    dimensions: Array.isArray(trackingData.dimensions) ? trackingData.dimensions : (Array.isArray(shipment.dimensions) ? shipment.dimensions : []),
    currentStatus: statusString,
    currentStage,
    apiLog: {
      success: true,
      vendorName: vendorDisplayName,
      vendorCode: (config?.vendor_code || '').toLowerCase(),
      endpoint: trackingUrl,
      httpStatus: response.status,
      latencyMs,
      timestamp: new Date().toISOString(),
      awb: cleanAwb,
      eventsCount: events.length,
      status: statusString,
      message: `Live tracking synced from ${vendorDisplayName} API (${events.length} events, ${latencyMs}ms)`
    }
  }
}

// ─── Dynamic Tracker Resolver ───────────────────────────────────────
function resolveTracker(config, vendorCode = '') {
  const code = (vendorCode || config?.vendor_code || '').toLowerCase().trim()
  const name = (config?.name || '').toLowerCase()
  const trackingUrl = (config?.tracking_api_url || '').toLowerCase()
  const authUrl = (config?.auth_url || '').toLowerCase()

  // Pacific Express
  if (code.includes('pacific') || name.includes('pacific') || trackingUrl.includes('pacificexp') || authUrl.includes('pacificexp')) {
    return trackPacific
  }

  // All ITDServices / FlySwift / Trackmate / ACX / Bhabani / Bhavani / etc.
  return trackTrackmateVendor
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

    // Helper to persist updated vendor AWB 2, status, and events back to DB
    const persistShipmentTrackingUpdates = async (trackResult) => {
      if (!matchedShipment) return
      try {
        const updates = []
        const vals = []
        const vAwb = String(trackResult.shipmentInfo?.vendorAwbNo || '').trim()
        if (vAwb && vAwb !== '0' && vAwb !== 'null' && vAwb !== 'undefined' && vAwb !== '0.00' && vAwb !== 'None') {
          if (!matchedShipment.vendor_awb_number || matchedShipment.vendor_awb_number === matchedShipment.tracking_number) {
            updates.push('vendor_awb_number = ?')
            vals.push(vAwb)
          } else if (vAwb !== matchedShipment.vendor_awb_number) {
            updates.push('vendor_awb_number_2 = ?, forwarding_no = ?')
            vals.push(vAwb, vAwb)
          }
        }
        if (trackResult.shipmentInfo?.secondaryCarrier) {
          updates.push('secondary_carrier = ?')
          vals.push(trackResult.shipmentInfo.secondaryCarrier)
        }
        if (trackResult.currentStage === 'delivered' && matchedShipment.status !== 'delivered') {
          updates.push('status = ?')
          vals.push('delivered')
        } else if (trackResult.currentStage === 'in_transit' && matchedShipment.status === 'draft') {
          updates.push('status = ?')
          vals.push('in_transit')
        }
        if (updates.length > 0) {
          vals.push(matchedShipment.id)
          await query(`UPDATE shipments SET ${updates.join(', ')} WHERE id = ?`, vals)
        }

        // Sync live events into tracking_events table if events exist
        if (Array.isArray(trackResult.events) && trackResult.events.length > 0) {
          for (const ev of trackResult.events) {
            const evStatus = ev.status || 'Event recorded'
            const evLocation = ev.location || ''
            const evDate = ev.rawDate || ev.date || new Date().toISOString().split('T')[0]
            const evTime = ev.rawTime || ev.time || '00:00:00'
            const combinedTime = `${evDate} ${evTime}`.trim()

            const existing = await query(
              `SELECT id FROM tracking_events WHERE shipment_id = ? AND status = ? AND location = ? LIMIT 1`,
              [matchedShipment.id, evStatus, evLocation]
            )
            if (existing.length === 0) {
              await query(
                `INSERT INTO tracking_events (shipment_id, status, location, event_time, description) VALUES (?, ?, ?, ?, ?)`,
                [matchedShipment.id, evStatus, evLocation, combinedTime, evStatus]
              )
            }
          }
        }
      } catch (err) {
        console.error('Failed to sync live tracking updates to DB:', err.message)
      }
    }

    // ── 4. Try tracking with matched config ──
    if (config) {
      const tracker = resolveTracker(config, vendorCode)
      try {
        const result = await tracker(vendorAwbToTrack, config)
        if (result && (result.events?.length > 0 || result.shipmentInfo?.awbNo)) {
          console.log(`[LIVE TRACK] Synced AWB "${vendorAwbToTrack}" via ${result.vendor} API (Status: ${result.currentStatus}, Events: ${result.events?.length || 0})`)
          if (matchedShipment) {
            await persistShipmentTrackingUpdates(result)
            result.internalShipment = {
              id: matchedShipment.id,
              ourAwb: matchedShipment.tracking_number,
              orderId: matchedShipment.order_id,
              invoiceNo: matchedShipment.invoice_no,
              vendorAwbNumber: result.shipmentInfo?.vendorAwbNo || matchedShipment.vendor_awb_number
            }
          }
          return res.json({ success: true, tracking: result })
        }
      } catch (trackErr) {
        console.warn(`Direct tracker failed for AWB ${vendorAwbToTrack} on config ${config.name}:`, trackErr.message)
      }
    }

    // ── 5. Fallback: Iterate across all active vendor configs ──
    const allConfigs = await query(
      `SELECT * FROM vendor_api_configs WHERE is_active = TRUE ORDER BY created_at DESC`
    )

    for (const cfg of allConfigs) {
      const tracker = resolveTracker(cfg)

      // Try tracking with vendorAwbToTrack first, and searchStr as fallback
      const awbsToAttempt = [vendorAwbToTrack]
      if (searchStr !== vendorAwbToTrack) awbsToAttempt.push(searchStr)

      for (const targetAwb of awbsToAttempt) {
        try {
          const result = await tracker(targetAwb, cfg)
          if (result && (result.events?.length > 0 || result.shipmentInfo?.awbNo)) {
            console.log(`[LIVE TRACK] Fallback synced AWB "${targetAwb}" via ${result.vendor} API (Status: ${result.currentStatus}, Events: ${result.events?.length || 0})`)
            if (matchedShipment) {
              await persistShipmentTrackingUpdates(result)
              result.internalShipment = {
                id: matchedShipment.id,
                ourAwb: matchedShipment.tracking_number,
                orderId: matchedShipment.order_id,
                invoiceNo: matchedShipment.invoice_no,
                vendorAwbNumber: result.shipmentInfo?.vendorAwbNo || matchedShipment.vendor_awb_number
              }
            }
            return res.json({ success: true, tracking: result })
          }
        } catch (err) {
          // Continue to next config
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
