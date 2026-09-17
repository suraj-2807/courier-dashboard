/**
 * Pacific Excel Rate Sheet Parser
 * 
 * Handles the multi-sheet Pacific workbook structure:
 * 1. Self Network — Destination/service/weight-based pricing
 * 2. Canada Zone — Postcode prefix to zone mapping
 * 3. Aus Zone — Australian postcode to zone mapping
 * 4. NZ Zone — New Zealand postcode/city to zone mapping
 * 5. Scotland Zip Code — UK Scottish postcode prefixes
 * 6. DPD REMOTE AREA — Remote area postcode/country database
 * 
 * Each worksheet has its own parser/normalizer.
 */
import * as XLSX from 'xlsx'

// ═══════════════════════════════════════════════════════════════
// REQUIRED SHEETS — matched case-insensitively
// ═══════════════════════════════════════════════════════════════
const REQUIRED_SHEETS = {
  selfNetwork: { patterns: ['self network', 'selfnetwork', 'self_network'], label: 'Self Network' },
  canadaZone:  { patterns: ['canada zone', 'canadazone', 'canada_zone', 'canada'], label: 'Canada Zone' },
  ausZone:     { patterns: ['aus zone', 'auszone', 'aus_zone', 'australia zone', 'aus'], label: 'Aus Zone' },
  nzZone:      { patterns: ['nz zone', 'nzzone', 'nz_zone', 'new zealand zone', 'nz'], label: 'NZ Zone' },
  scotlandZip: { patterns: ['scotland zip code', 'scotland zip', 'scotland zipcode', 'scotland_zip', 'scotland'], label: 'Scotland Zip Code' },
  dpdRemote:   { patterns: ['dpd remote area', 'dpd remote', 'dpd_remote', 'remote area', 'dpd'], label: 'DPD REMOTE AREA' }
}

// ═══════════════════════════════════════════════════════════════
// WEIGHT SLAB DEFINITIONS — maps Excel column headers to weight ranges
// These columns represent per-kg rates for the given weight tier.
// ═══════════════════════════════════════════════════════════════
const WEIGHT_SLAB_MAP = [
  // { pattern: regex to match header, min_weight, max_weight (null=unlimited), rate_type }
  { pattern: /^6\s*kg/i,  min: 6,  max: 10.999 },
  { pattern: /^11\s*kg/i, min: 11, max: 20.999 },
  { pattern: /^21\s*kg/i, min: 21, max: 30.999 },
  { pattern: /^31\s*kg/i, min: 31, max: 50.999 },
  { pattern: /^51\s*kg/i, min: 51, max: 70.999 },
  { pattern: /^71\s*kg/i, min: 71, max: null }
]

// ═══════════════════════════════════════════════════════════════
// MAIN PARSER — Entry point
// ═══════════════════════════════════════════════════════════════
export function parsePacificWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetNames = workbook.SheetNames
  
  const result = {
    success: true,
    sheets_found: sheetNames,
    sheets_matched: {},
    selfNetwork: { records: [], errors: [], warnings: [] },
    canadaZone:  { records: [], errors: [], warnings: [] },
    ausZone:     { records: [], errors: [], warnings: [] },
    nzZone:      { records: [], errors: [], warnings: [] },
    scotlandZip: { records: [], errors: [], warnings: [] },
    dpdRemote:   { records: [], errors: [], warnings: [] },
    summary: { total_errors: 0, total_warnings: 0, total_records: 0 },
    errors: [],
    warnings: []
  }

  // Match sheet names to required sheets
  for (const [key, config] of Object.entries(REQUIRED_SHEETS)) {
    const matched = sheetNames.find(sn => 
      config.patterns.some(p => sn.toLowerCase().trim().includes(p))
    )
    if (matched) {
      result.sheets_matched[key] = matched
    } else {
      result.errors.push(`Required worksheet "${config.label}" not found. Available sheets: ${sheetNames.join(', ')}`)
    }
  }

  // Parse each matched sheet
  if (result.sheets_matched.selfNetwork) {
    parseSelfNetwork(workbook.Sheets[result.sheets_matched.selfNetwork], result.selfNetwork)
  }
  if (result.sheets_matched.canadaZone) {
    parseZoneSheet(workbook.Sheets[result.sheets_matched.canadaZone], 'CA', result.canadaZone)
  }
  if (result.sheets_matched.ausZone) {
    parseZoneSheet(workbook.Sheets[result.sheets_matched.ausZone], 'AU', result.ausZone)
  }
  if (result.sheets_matched.nzZone) {
    parseZoneSheet(workbook.Sheets[result.sheets_matched.nzZone], 'NZ', result.nzZone)
  }
  if (result.sheets_matched.scotlandZip) {
    parseZoneSheet(workbook.Sheets[result.sheets_matched.scotlandZip], 'GB-SCT', result.scotlandZip)
  }
  if (result.sheets_matched.dpdRemote) {
    parseDpdRemoteArea(workbook.Sheets[result.sheets_matched.dpdRemote], result.dpdRemote)
  }

  // Calculate summary
  const allSections = [result.selfNetwork, result.canadaZone, result.ausZone, result.nzZone, result.scotlandZip, result.dpdRemote]
  result.summary.total_errors = result.errors.length + allSections.reduce((s, sec) => s + sec.errors.length, 0)
  result.summary.total_warnings = result.warnings.length + allSections.reduce((s, sec) => s + sec.warnings.length, 0)
  result.summary.total_records = allSections.reduce((s, sec) => s + sec.records.length, 0)
  result.success = result.summary.total_errors === 0

  return result
}

// ═══════════════════════════════════════════════════════════════
// SELF NETWORK PARSER
// Extracts: service_code, destination, base_500g, addl_500g,
//           weight slabs (6kg++, 11kg++, etc.), service, transit_time
// ═══════════════════════════════════════════════════════════════
function parseSelfNetwork(sheet, output) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  if (rawRows.length === 0) {
    output.errors.push('Self Network sheet is empty')
    return
  }

  // Detect headers dynamically
  const headers = Object.keys(rawRows[0])
  
  // Map header columns
  const colMap = detectSelfNetworkColumns(headers)
  
  if (!colMap.destination) {
    output.errors.push('Self Network: Could not find "Destination" column. Headers found: ' + headers.join(', '))
    return
  }
  if (!colMap.base500g) {
    output.errors.push('Self Network: Could not find "500 Gms" / base rate column. Headers found: ' + headers.join(', '))
    return
  }

  const seenDestinations = new Set()

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]
    const rowNum = i + 2 // Excel is 1-indexed + header row

    const destination = String(row[colMap.destination] || '').trim()
    if (!destination) {
      // Skip blank rows silently
      continue
    }

    const serviceCode = String(row[colMap.serviceCode] || '').trim()
    const serviceName = String(row[colMap.serviceName] || '').trim()
    const transitTime = String(row[colMap.transitTime] || '').trim()
    
    const base500g = parseRate(row[colMap.base500g])
    const addl500g = colMap.addl500g ? parseRate(row[colMap.addl500g]) : 0

    if (base500g === null || isNaN(base500g)) {
      output.errors.push(`Self Network row ${rowNum}: Invalid base rate for "${destination}"`)
      continue
    }

    // Detect duplicate destination+serviceCode combos
    const dedupKey = `${destination}|${serviceCode}`.toUpperCase()
    if (seenDestinations.has(dedupKey)) {
      output.warnings.push(`Self Network row ${rowNum}: Duplicate destination "${destination}" with service "${serviceCode}"`)
    }
    seenDestinations.add(dedupKey)

    // Parse weight slabs
    const slabs = []
    for (const slabDef of WEIGHT_SLAB_MAP) {
      const matchedHeader = colMap.slabHeaders.find(h => slabDef.pattern.test(h.original))
      if (matchedHeader) {
        const ratePerKg = parseRate(row[matchedHeader.key])
        if (ratePerKg !== null && !isNaN(ratePerKg) && ratePerKg > 0) {
          slabs.push({
            min_weight: slabDef.min,
            max_weight: slabDef.max,
            rate_per_kg: ratePerKg,
            rate_type: 'per_kg'
          })
        }
      }
    }

    output.records.push({
      service_code: serviceCode || 'SELF',
      service_name: serviceName,
      destination_country: destination,
      transit_time: transitTime,
      base_500g: base500g,
      addl_500g: addl500g,
      slabs
    })
  }
}

/**
 * Detect Self Network column mappings from headers
 */
function detectSelfNetworkColumns(headers) {
  const colMap = {
    serviceCode: null,
    destination: null,
    base500g: null,
    addl500g: null,
    serviceName: null,
    transitTime: null,
    slabHeaders: []
  }

  for (const h of headers) {
    const lower = h.toLowerCase().trim()
    
    if (!colMap.serviceCode && (lower.includes('service code') || lower === 'service_code' || lower === 'servicecode')) {
      colMap.serviceCode = h
    }
    else if (!colMap.destination && (lower.includes('destination') || lower === 'country' || lower === 'dest')) {
      colMap.destination = h
    }
    else if (!colMap.base500g && (lower.includes('500 gms') || lower.includes('500g') || lower.includes('500 g') || lower === '0.5 kg' || lower.includes('first 500'))) {
      colMap.base500g = h
    }
    else if (!colMap.addl500g && (lower.includes('addl 500') || lower.includes('additional 500') || lower.includes('addl500') || lower.includes('add 500'))) {
      colMap.addl500g = h
    }
    else if (!colMap.transitTime && (lower.includes('transit') || lower.includes('tat') || lower.includes('delivery time'))) {
      colMap.transitTime = h
    }
    else if (!colMap.serviceName && lower === 'service') {
      colMap.serviceName = h
    }
    
    // Check for weight slab headers (6kg++, 11 Kg++, etc.)
    if (/^\d+\s*kg/i.test(lower) || /^\d+\s*Kg\s*\+\+/i.test(h)) {
      colMap.slabHeaders.push({ key: h, original: h })
    }
  }

  return colMap
}

// ═══════════════════════════════════════════════════════════════
// ZONE SHEET PARSER (Generic for Canada, Aus, NZ, Scotland)
// Extracts: postcode, city, state/province, zone, remote flag
// ═══════════════════════════════════════════════════════════════
function parseZoneSheet(sheet, countryCode, output) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  if (rawRows.length === 0) {
    output.errors.push(`${countryCode} zone sheet is empty`)
    return
  }

  const headers = Object.keys(rawRows[0])
  const colMap = detectZoneColumns(headers)

  if (!colMap.postcode) {
    output.errors.push(`${countryCode} zone sheet: Could not find postcode column. Headers: ${headers.join(', ')}`)
    return
  }
  if (!colMap.zone) {
    output.errors.push(`${countryCode} zone sheet: Could not find zone column. Headers: ${headers.join(', ')}`)
    return
  }

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]
    const rowNum = i + 2

    let postcode = String(row[colMap.postcode] || '').trim()
    if (!postcode) continue

    // Keep postcode as string — pad with leading zeros if numeric and country requires it
    if (countryCode === 'AU' && /^\d+$/.test(postcode)) {
      postcode = postcode.padStart(4, '0')
    }

    const city = colMap.city ? String(row[colMap.city] || '').trim() : ''
    const state = colMap.state ? String(row[colMap.state] || '').trim() : ''
    const zone = String(row[colMap.zone] || '').trim()
    
    if (!zone) {
      output.warnings.push(`${countryCode} zone row ${rowNum}: Missing zone for postcode "${postcode}"`)
      continue
    }

    // Detect remote from explicit column or zone name containing "remote"
    let isRemote = false
    let remoteRemarks = ''
    if (colMap.remote) {
      const remoteVal = String(row[colMap.remote] || '').trim().toLowerCase()
      isRemote = remoteVal === 'yes' || remoteVal === 'y' || remoteVal === 'true' || remoteVal === '1' || remoteVal === 'remote'
      remoteRemarks = isRemote ? String(row[colMap.remote] || '').trim() : ''
    }
    if (!isRemote && zone.toLowerCase().includes('remote')) {
      isRemote = true
    }

    // Extract prefix (first part before dash or space for range-style postcodes)
    let postcodePrefix = ''
    if (/^[A-Z]/i.test(postcode)) {
      // Alphanumeric (e.g. CA: M5V, UK: IV1-IV63)
      const match = postcode.match(/^([A-Z]+\d*)/i)
      if (match) postcodePrefix = match[1].toUpperCase()
    } else {
      // Numeric (e.g. AU: 0800, NZ: 0110)
      postcodePrefix = postcode.substring(0, Math.min(postcode.length, 3))
    }

    output.records.push({
      country_code: countryCode,
      postcode: postcode.toUpperCase(),
      postcode_prefix: postcodePrefix,
      city,
      state_province: state,
      zone,
      is_remote: isRemote,
      remote_remarks: remoteRemarks
    })
  }
}

/**
 * Detect zone sheet column mappings
 */
function detectZoneColumns(headers) {
  const colMap = { postcode: null, city: null, state: null, zone: null, remote: null }

  for (const h of headers) {
    const lower = h.toLowerCase().trim()

    if (!colMap.postcode && (
      lower.includes('postcode') || lower.includes('post code') || lower.includes('zip') || 
      lower.includes('pincode') || lower.includes('postal') || lower === 'code' || lower === 'pc'
    )) {
      colMap.postcode = h
    }
    else if (!colMap.city && (lower.includes('city') || lower.includes('suburb') || lower.includes('town') || lower.includes('area') || lower.includes('location'))) {
      colMap.city = h
    }
    else if (!colMap.state && (lower.includes('state') || lower.includes('province') || lower.includes('territory') || lower.includes('region'))) {
      colMap.state = h
    }
    else if (!colMap.zone && (lower.includes('zone') || lower === 'zones')) {
      colMap.zone = h
    }
    else if (!colMap.remote && (lower.includes('remote') || lower.includes('rural') || lower.includes('oda'))) {
      colMap.remote = h
    }
  }

  return colMap
}

// ═══════════════════════════════════════════════════════════════
// DPD REMOTE AREA PARSER
// Extracts: country, postcode ranges, city, carrier network
// ═══════════════════════════════════════════════════════════════
function parseDpdRemoteArea(sheet, output) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  if (rawRows.length === 0) {
    output.errors.push('DPD Remote Area sheet is empty')
    return
  }

  const headers = Object.keys(rawRows[0])
  const colMap = detectRemoteAreaColumns(headers)

  if (!colMap.country) {
    output.errors.push(`DPD Remote Area: Could not find country column. Headers: ${headers.join(', ')}`)
    return
  }

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]
    const rowNum = i + 2

    const countryName = String(row[colMap.country] || '').trim()
    if (!countryName) continue

    const postcodeFrom = colMap.postcodeFrom ? String(row[colMap.postcodeFrom] || '').trim() : ''
    const postcodeTo = colMap.postcodeTo ? String(row[colMap.postcodeTo] || '').trim() : ''
    const postcodeExact = colMap.postcodeExact ? String(row[colMap.postcodeExact] || '').trim() : ''
    const city = colMap.city ? String(row[colMap.city] || '').trim() : ''
    const carrier = colMap.carrier ? String(row[colMap.carrier] || '').trim() : 'DPD'

    // If only one postcode column found, use it as exact
    let finalExact = postcodeExact
    let finalFrom = postcodeFrom
    let finalTo = postcodeTo

    if (!finalExact && !finalFrom && !finalTo) {
      // Try to find any postcode-like column value
      const anyPostcode = colMap.anyPostcode ? String(row[colMap.anyPostcode] || '').trim() : ''
      if (anyPostcode) {
        // Check if it's a range (e.g. "1000-1999")
        const rangeMatch = anyPostcode.match(/^(.+?)\s*[-–—]\s*(.+)$/)
        if (rangeMatch) {
          finalFrom = rangeMatch[1].trim()
          finalTo = rangeMatch[2].trim()
        } else {
          finalExact = anyPostcode
        }
      }
    }

    output.records.push({
      country_name: countryName,
      country_code: '',
      postcode_from: finalFrom,
      postcode_to: finalTo,
      postcode_exact: finalExact,
      city,
      carrier_network: carrier
    })
  }
}

/**
 * Detect DPD Remote Area column mappings
 */
function detectRemoteAreaColumns(headers) {
  const colMap = { country: null, postcodeFrom: null, postcodeTo: null, postcodeExact: null, city: null, carrier: null, anyPostcode: null }

  for (const h of headers) {
    const lower = h.toLowerCase().trim()

    if (!colMap.country && (lower.includes('country') || lower.includes('nation') || lower === 'destination')) {
      colMap.country = h
    }
    else if (!colMap.postcodeFrom && (lower.includes('from') || lower.includes('start') || lower.includes('zip from') || lower.includes('postcode from'))) {
      colMap.postcodeFrom = h
    }
    else if (!colMap.postcodeTo && (lower.includes(' to') || lower.includes('end') || lower.includes('zip to') || lower.includes('postcode to'))) {
      colMap.postcodeTo = h
    }
    else if (!colMap.postcodeExact && (lower.includes('postcode') || lower.includes('zip') || lower.includes('pincode') || lower.includes('postal'))) {
      colMap.postcodeExact = h
      if (!colMap.anyPostcode) colMap.anyPostcode = h
    }
    else if (!colMap.city && (lower.includes('city') || lower.includes('area') || lower.includes('town') || lower.includes('location'))) {
      colMap.city = h
    }
    else if (!colMap.carrier && (lower.includes('carrier') || lower.includes('network') || lower.includes('agent'))) {
      colMap.carrier = h
    }

    // Fallback: any column with "postcode" or "zip"
    if (!colMap.anyPostcode && (lower.includes('postcode') || lower.includes('zip') || lower.includes('postal') || lower.includes('code'))) {
      colMap.anyPostcode = h
    }
  }

  return colMap
}

// ═══════════════════════════════════════════════════════════════
// UTILITY — parse rate value from cell
// ═══════════════════════════════════════════════════════════════
function parseRate(val) {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return val
  const cleaned = String(val).replace(/[₹$€,\s]/g, '').trim()
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'na' || cleaned.toLowerCase() === 'n/a') return null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}
