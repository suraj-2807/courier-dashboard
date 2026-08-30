import { query } from '../config/db.js'
import { decrypt } from '../utils/encryption.js'
import { syncToRemoteAwbEntry } from './remoteAwbEntry.service.js'

// In-memory set to prevent duplicate concurrent syncs for the same shipment ID
const currentlySyncingIds = new Set()
// Rate-limiting timestamp cache to avoid syncing the same shipment more than once every 60 seconds
const lastSyncedTimestamps = new Map()

// ─── Safely parse credentials ────
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

function determineCurrentStageAndStatus(events = [], initialStatus = '') {
  let highestStage = 'booked'
  let highestWeight = 0
  let latestStatus = initialStatus || 'In Progress'

  const evaluateText = (txt) => {
    if (!txt) return
    const s = String(txt).toLowerCase().trim()
    if (/delivered|dlvd|signed by/i.test(s) && !/out for delivery/i.test(s)) {
      if (highestWeight < 4) { highestWeight = 4; highestStage = 'delivered'; latestStatus = txt }
    } else if (/out for delivery|ofd|with courier|out for del|today.*delivery|for delivery/i.test(s)) {
      if (highestWeight < 3) { highestWeight = 3; highestStage = 'out_for_delivery'; latestStatus = txt }
    } else if (/transit|depart|arriv|custom|hub|facility|tranship|clearance|flight|in-transit|scan|hold|processing/i.test(s)) {
      if (highestWeight < 2) { highestWeight = 2; highestStage = 'in_transit'; latestStatus = txt }
    } else if (/picked|pickup|received|origin scan|collected|manifest|booked|label/i.test(s)) {
      if (highestWeight < 1) { highestWeight = 1; highestStage = 'picked_up'; latestStatus = txt }
    }
  }

  evaluateText(initialStatus)
  if (Array.isArray(events) && events.length > 0) {
    for (const ev of events) {
      evaluateText(ev.status || ev.event_description || ev.event || '')
    }
  }

  const newestEventText = events.length > 0 ? (events[events.length - 1]?.status || events[0]?.status) : ''
  if (!latestStatus || latestStatus === 'In Progress') {
    latestStatus = newestEventText || initialStatus || 'In Progress'
  }

  return { currentStage: highestStage, currentStatus: latestStatus }
}

// ── Pacific Express Tracking ──
async function trackPacific(awb, config) {
  const creds = parseCredentials(config.auth_credentials)
  const userId = creds.user_id || creds.username || creds.UserID || 'P0503'
  const password = creds.password || creds.Password || 'P0503@7199'

  let trackingUrl = config.tracking_api_url || 'https://eship.pacificexp.net/api/v1/Tracking/Tracking'
  if (trackingUrl && !trackingUrl.startsWith('http://') && !trackingUrl.startsWith('https://')) {
    trackingUrl = `https://${trackingUrl}`
  }

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

  const resObj = data.Response || data
  if (resObj.ErrorCode !== '0' && resObj.ResponseCode !== 'RT01' && String(resObj.ErrorDisc || '').toLowerCase() !== 'success') {
    throw new Error(resObj.ErrorDisc || 'Pacific tracking failed')
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

  const { currentStage, currentStatus } = determineCurrentStageAndStatus(events, tracking.Status || '')
  const secondaryAwb = tracking.VendorAWBNo2 || tracking.VendorAWBNo1 || tracking.VendorAWBNo || tracking.VendorAwbNo2 || tracking.VendorAwbNo1 || tracking.VendorAwbNo || ''
  let secondaryCarrier = tracking.VendorName2 || tracking.VendorName || tracking.Vendor_Code1 || tracking.Vendor_Code || ''

  if (secondaryAwb) {
    if (/^1Z/i.test(secondaryAwb)) secondaryCarrier = 'UPS'
    else if (/^[0-9]{12}$/.test(secondaryAwb)) secondaryCarrier = 'FEDEX'
    else if (/^[0-9]{10}$/.test(secondaryAwb)) secondaryCarrier = 'DHL'
  }

  return {
    vendor: 'Pacific Express',
    vendorCode: 'pacific',
    vendorAwbNo: secondaryAwb,
    secondaryCarrier,
    currentStatus,
    currentStage,
    events
  }
}

// ── FlySwift / ITDServices Platform Tracking ──
async function trackTrackmateVendor(awb, config, defaultVendorName = 'Courier Partner') {
  const creds = parseCredentials(config?.auth_credentials)
  const apiCompanyId = creds.api_company_id || creds.company_code || creds.company_id || creds.customer_code || creds.customer_id || '1032'
  const customerCode = creds.customer_code || creds.customer_id || creds.company_code || creds.api_company_id || '1032'

  let host = 'admin.flyswift.net'
  if (config?.auth_url) {
    try {
      const urlStr = config.auth_url.startsWith('http') ? config.auth_url : `https://${config.auth_url}`
      host = new URL(urlStr).host
    } catch {}
  } else if (config?.shipment_api_url) {
    try {
      const urlStr = config.shipment_api_url.startsWith('http') ? config.shipment_api_url : `https://${config.shipment_api_url}`
      host = new URL(urlStr).host
    } catch {}
  }

  const vendorDisplayName = config?.name || defaultVendorName || 'Courier Partner'
  const cleanAwb = String(awb).trim()

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

  const response = await fetch(trackingUrl, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })

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

  const infoMap = {}
  if (Array.isArray(trackingData.docket_info)) {
    trackingData.docket_info.forEach(row => {
      if (Array.isArray(row) && row.length >= 2) {
        infoMap[String(row[0]).trim()] = String(row[1]).trim()
      }
    })
  }

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

  let fwdFromInfoMap = ''
  let carrierFromInfoMap = ''
  for (const [k, v] of Object.entries(infoMap)) {
    const kLow = k.toLowerCase().trim()
    if (/forwarding.*no|forwarding.*awb|carrier.*no|fwd.*no|vendor.*awb.*2|secondary.*awb/i.test(kLow) && v) {
      fwdFromInfoMap = String(v).trim()
    }
    if (/forwarding.*carrier|forwarding.*vendor|carrier.*name|vendor.*name.*2|secondary.*carrier/i.test(kLow) && v) {
      carrierFromInfoMap = String(v).trim()
    }
  }

  let secondaryAwb = trackingData.forwarding_no || trackingData.forwording_no || trackingData.forwarding_awb || trackingData.secondary_awb || fwdFromInfoMap || shipment.vendor_awb_2 || shipment.awb_2 || shipment.secondary_awb || shipment.forwarding_no || ''
  secondaryAwb = String(secondaryAwb).trim()

  const primaryAwb = String(trackingData.tracking_no || shipment.tracking_no || shipment.docket_no || cleanAwb).trim()
  if (secondaryAwb === primaryAwb || secondaryAwb === cleanAwb || secondaryAwb === '0' || secondaryAwb === 'null' || secondaryAwb === 'undefined' || secondaryAwb === 'None' || secondaryAwb === '-' || secondaryAwb === '—') {
    secondaryAwb = ''
  }

  const serviceName = infoMap['Service Name'] || shipment.service_name || shipment.service_type || ''
  let secondaryCarrier = carrierFromInfoMap || trackingData.forwarding_carrier || trackingData.secondary_carrier || ''
  const serviceUpper = (serviceName + ' ' + (shipment.carrier || '')).toUpperCase()
  if (secondaryAwb.startsWith('1Z') || serviceUpper.includes('UPS')) {
    secondaryCarrier = 'UPS'
  } else if (/^[0-9]{12}$/.test(secondaryAwb) || serviceUpper.includes('FEDEX') || serviceUpper.includes('FDX')) {
    secondaryCarrier = 'FEDEX'
  } else if (/^[0-9]{10}$/.test(secondaryAwb) || serviceUpper.includes('DHL')) {
    secondaryCarrier = 'DHL'
  } else if (serviceUpper.includes('ARAMEX')) {
    secondaryCarrier = 'Aramex'
  } else if (!secondaryCarrier) {
    secondaryCarrier = shipment.secondary_carrier || shipment.carrier || (serviceName ? serviceName.split(' ')[0] : (secondaryAwb ? 'Forwarded Vendor' : ''))
  }

  const { currentStage, currentStatus } = determineCurrentStageAndStatus(events, infoMap['Status'] || shipment.status || '')

  return {
    vendor: vendorDisplayName,
    vendorCode: (config?.vendor_code || 'flyswift').toLowerCase(),
    vendorAwbNo: secondaryAwb,
    secondaryCarrier,
    currentStatus,
    currentStage,
    events
  }
}

function resolveTracker(config, vendorCode = '') {
  const code = (vendorCode || config?.vendor_code || '').toLowerCase().trim()
  const name = (config?.name || '').toLowerCase()
  const trackingUrl = (config?.tracking_api_url || '').toLowerCase()
  const authUrl = (config?.auth_url || '').toLowerCase()

  if (code.includes('pacific') || name.includes('pacific') || trackingUrl.includes('pacificexp') || authUrl.includes('pacificexp')) {
    return trackPacific
  }
  return trackTrackmateVendor
}

/**
 * Synchronizes live tracking and secondary forwarding numbers for a single shipment.
 * @param {Object|number|string} shipmentOrId 
 * @returns {Promise<{success: boolean, shipmentId: number, vendorAwb2: string, secondaryCarrier: string, status: string, error?: string}>}
 */
export async function syncShipmentTracking(shipmentOrId) {
  let shipment = null

  if (typeof shipmentOrId === 'object' && shipmentOrId !== null && shipmentOrId.id) {
    shipment = shipmentOrId
  } else {
    const id = parseInt(shipmentOrId)
    if (!id) return { success: false, error: 'Invalid shipment ID' }
    const rows = await query(`
      SELECT s.*, 
             vac.vendor_code as vac_vendor_code, vac.id as vac_config_id, vac.auth_credentials as vac_credentials
      FROM shipments s
      LEFT JOIN vendor_api_configs vac ON s.vendor_config_id = vac.id
      WHERE s.id = ? LIMIT 1
    `, [id])
    if (rows.length === 0) return { success: false, error: 'Shipment not found' }
    shipment = rows[0]
  }

  const shipmentId = shipment.id
  if (currentlySyncingIds.has(shipmentId)) {
    return { success: false, shipmentId, error: 'Sync already in progress' }
  }

  currentlySyncingIds.add(shipmentId)

  try {
    const awbToTrack = (shipment.vendor_awb_number && shipment.vendor_awb_number.trim() !== '')
      ? shipment.vendor_awb_number.trim()
      : (shipment.tracking_number || '')

    if (!awbToTrack) {
      return { success: false, shipmentId, error: 'No AWB number available to track' }
    }

    // Resolve config
    let config = null
    if (shipment.vendor_config_id) {
      const cfgRows = await query('SELECT * FROM vendor_api_configs WHERE id = ? AND is_active = TRUE LIMIT 1', [shipment.vendor_config_id])
      if (cfgRows.length > 0) config = cfgRows[0]
    }

    if (!config && (shipment.vendor_code || shipment.vac_vendor_code)) {
      const code = (shipment.vendor_code || shipment.vac_vendor_code).toLowerCase()
      const cfgRows = await query('SELECT * FROM vendor_api_configs WHERE LOWER(vendor_code) = ? AND is_active = TRUE LIMIT 1', [code])
      if (cfgRows.length > 0) config = cfgRows[0]
    }

    // If still no config, load all active configs to attempt tracking
    let trackResult = null
    if (config) {
      const tracker = resolveTracker(config)
      try {
        trackResult = await tracker(awbToTrack, config)
      } catch (err) {
        // Tracker failed for primary config, will fallback below
      }
    }

    if (!trackResult || (!trackResult.vendorAwbNo && (!trackResult.events || trackResult.events.length === 0))) {
      const allConfigs = await query('SELECT * FROM vendor_api_configs WHERE is_active = TRUE ORDER BY created_at DESC')
      for (const cfg of allConfigs) {
        if (config && cfg.id === config.id) continue
        const tracker = resolveTracker(cfg)
        try {
          const res = await tracker(awbToTrack, cfg)
          if (res && (res.vendorAwbNo || (res.events && res.events.length > 0))) {
            trackResult = res
            break
          }
        } catch {}
      }
    }

    if (!trackResult) {
      lastSyncedTimestamps.set(shipmentId, Date.now())
      return { success: false, shipmentId, error: 'No tracking data found from vendor APIs' }
    }

    // Persist updates to DB
    const updates = []
    const vals = []
    const vAwb = String(trackResult.vendorAwbNo || '').trim()

    if (vAwb && vAwb !== '0' && vAwb !== 'null' && vAwb !== 'undefined' && vAwb !== '0.00' && vAwb !== 'None' && vAwb !== '-' && vAwb !== '—') {
      if (!shipment.vendor_awb_number || shipment.vendor_awb_number === shipment.tracking_number) {
        updates.push('vendor_awb_number = ?')
        vals.push(vAwb)
      } else if (vAwb !== shipment.vendor_awb_number && vAwb !== shipment.tracking_number) {
        updates.push('vendor_awb_number_2 = ?, forwarding_no = ?')
        vals.push(vAwb, vAwb)
      }
    }

    if (trackResult.secondaryCarrier && trackResult.secondaryCarrier !== 'Carrier' && trackResult.secondaryCarrier !== 'Forwarded Vendor') {
      updates.push('secondary_carrier = ?')
      vals.push(trackResult.secondaryCarrier)
    }

    if (trackResult.currentStage === 'delivered' && shipment.status !== 'delivered') {
      updates.push('status = ?')
      vals.push('delivered')
    } else if (trackResult.currentStage === 'in_transit' && shipment.status === 'draft') {
      updates.push('status = ?')
      vals.push('in_transit')
    }

    if (updates.length > 0) {
      vals.push(shipmentId)
      await query(`UPDATE shipments SET ${updates.join(', ')} WHERE id = ?`, vals)
    }

    // Sync events into tracking_events
    if (Array.isArray(trackResult.events) && trackResult.events.length > 0) {
      for (const ev of trackResult.events) {
        const evStatus = ev.status || 'Event recorded'
        const evLocation = ev.location || ''
        const evDate = ev.rawDate || ev.date || new Date().toISOString().split('T')[0]
        const evTime = ev.rawTime || ev.time || '00:00:00'
        const combinedTime = `${evDate} ${evTime}`.trim()

        const existing = await query(
          `SELECT id FROM tracking_events WHERE shipment_id = ? AND status = ? AND location = ? LIMIT 1`,
          [shipmentId, evStatus, evLocation]
        )
        if (existing.length === 0) {
          await query(
            `INSERT INTO tracking_events (shipment_id, status, location, event_time, description) VALUES (?, ?, ?, ?, ?)`,
            [shipmentId, evStatus, evLocation, combinedTime, evStatus]
          )
        }
      }
    }

    // Also sync to remote AWBENTRY if vendorAwbNo was updated
    if (vAwb && (vAwb !== shipment.vendor_awb_number_2 || vAwb !== shipment.forwarding_no)) {
      try {
        const updatedRows = await query(`
          SELECT s.*, 
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
          WHERE s.id = ? LIMIT 1
        `, [shipmentId])
        if (updatedRows.length > 0) {
          await syncToRemoteAwbEntry(updatedRows[0])
        }
      } catch (remoteErr) {
        console.warn(`[TrackingSync] Remote AWBENTRY sync warning for shipment #${shipmentId}:`, remoteErr.message)
      }
    }

    lastSyncedTimestamps.set(shipmentId, Date.now())

    return {
      success: true,
      shipmentId,
      vendorAwb2: vAwb,
      secondaryCarrier: trackResult.secondaryCarrier || '',
      status: trackResult.currentStatus || shipment.status
    }
  } catch (err) {
    console.error(`[TrackingSync] Error syncing shipment #${shipmentId}:`, err.message)
    return { success: false, shipmentId, error: err.message }
  } finally {
    currentlySyncingIds.delete(shipmentId)
  }
}

/**
 * Concurrently sync a batch of shipments (with limit to avoid overwhelming APIs).
 * @param {Array<number|Object>} shipmentIdsOrObjects 
 * @param {Object} options 
 * @returns {Promise<{total: number, synced: number, updatedForwarding: number, errors: number}>}
 */
export async function syncShipmentsBatch(shipmentIdsOrObjects, options = {}) {
  const { concurrency = 4, force = false } = options
  const list = Array.isArray(shipmentIdsOrObjects) ? shipmentIdsOrObjects : []
  if (list.length === 0) {
    return { total: 0, synced: 0, updatedForwarding: 0, errors: 0 }
  }

  // Filter items that were synced very recently unless force = true
  const now = Date.now()
  const toProcess = list.filter(item => {
    const id = typeof item === 'object' ? item.id : item
    if (!force) {
      const lastSync = lastSyncedTimestamps.get(id)
      if (lastSync && (now - lastSync) < 60000) return false // synced within last 60 seconds
    }
    return true
  })

  let synced = 0
  let updatedForwarding = 0
  let errors = 0

  // Process in chunks with concurrency limit
  for (let i = 0; i < toProcess.length; i += concurrency) {
    const chunk = toProcess.slice(i, i + concurrency)
    const results = await Promise.allSettled(chunk.map(item => syncShipmentTracking(item)))
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value?.success) {
        synced++
        if (res.value?.vendorAwb2) updatedForwarding++
      } else {
        errors++
      }
    }
  }

  return {
    total: toProcess.length,
    synced,
    updatedForwarding,
    errors
  }
}

/**
 * Periodic background tracking sync cron.
 * Runs every few minutes to update active shipments missing forwarding numbers.
 */
let syncCronInterval = null

export function startBackgroundTrackingSyncCron(intervalMs = 300000) { // Default 5 minutes
  if (syncCronInterval) return

  const runSync = async () => {
    try {
      // Find active shipments from the last 14 days that have a vendor AWB or tracking number but missing vendor_awb_number_2/forwarding_no
      const pendingRows = await query(`
        SELECT s.id, s.tracking_number, s.vendor_awb_number, s.vendor_awb_number_2, s.forwarding_no, s.vendor_config_id, s.vendor_code
        FROM shipments s
        WHERE (s.is_trashed = 0 OR s.is_trashed IS NULL)
          AND s.status NOT IN ('delivered', 'cancelled')
          AND (s.vendor_awb_number != '' OR s.tracking_number != '')
          AND (s.vendor_awb_number_2 = '' OR s.vendor_awb_number_2 IS NULL OR s.forwarding_no = '' OR s.forwarding_no IS NULL)
          AND s.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
        ORDER BY s.created_at DESC
        LIMIT 25
      `)

      if (pendingRows.length > 0) {
        console.log(`[AutoTrackingCron] Found ${pendingRows.length} active shipments missing forwarding numbers. Syncing...`)
        const summary = await syncShipmentsBatch(pendingRows, { concurrency: 3 })
        console.log(`[AutoTrackingCron] Sync finished: ${summary.synced} synced, ${summary.updatedForwarding} new forwarding nos found.`)
      }
    } catch (err) {
      console.warn('[AutoTrackingCron] Scheduled sync error:', err.message)
    }
  }

  // Initial delay of 20 seconds after server startup before first background sync
  setTimeout(runSync, 20000)
  syncCronInterval = setInterval(runSync, intervalMs)
  console.log(`[TrackingSync] Background sync cron started (every ${intervalMs / 1000}s).`)
}
