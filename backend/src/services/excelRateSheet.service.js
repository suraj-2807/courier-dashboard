import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import xlsxCalc from 'xlsx-calc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Directories for sheets
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/vendor_rate_sheets')
const ASSETS_DIR = path.resolve(__dirname, '../assets')
const DEFAULT_PACIFIC_PATH = path.resolve(ASSETS_DIR, 'Pacific Rates.xlsx')
const REGISTRY_PATH = path.resolve(UPLOADS_DIR, 'registry.json')

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

// ═══════════════════════════════════════════════════════════════
// US STATES MAP & ABBREVIATIONS
// ═══════════════════════════════════════════════════════════════
const US_STATE_NAMES = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA',
  COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE', FLORIDA: 'FL', GEORGIA: 'GA',
  HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA',
  KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD',
  MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS', MISSOURI: 'MO',
  MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH',
  OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT',
  VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY',
  'DISTRICT OF COLUMBIA': 'DC', 'WASHINGTON DC': 'DC', 'WASHINGTON D.C.': 'DC'
}

// Country aliases for normalization
const COUNTRY_ALIASES = {
  'united arab emirates': ['u.a.e.', 'uae', 'are', 'dubai', 'abu dhabi'],
  'uae': ['u.a.e.', 'united arab emirates', 'are'],
  'u.a.e.': ['united arab emirates', 'uae', 'are'],
  'united kingdom': ['u.k.', 'uk', 'gbr', 'great britain', 'england'],
  'uk': ['u.k.', 'united kingdom', 'gbr', 'great britain'],
  'u.k.': ['united kingdom', 'uk', 'gbr', 'great britain'],
  'united states': ['u.s.a.', 'usa', 'united states of america', 'us'],
  'united states of america': ['u.s.a.', 'usa', 'united states', 'us'],
  'usa': ['u.s.a.', 'united states', 'united states of america', 'us'],
  'u.s.a.': ['united states', 'usa', 'united states of america', 'us'],
  'saudi arabia': ['ksa', 'saudi', 'sau', 'saudi arabia (resumed)'],
  'kuwait': ['kwt', 'kuwait (service temporarily suspended)'],
  'new zealand': ['nz', 'nzl'],
  'australia': ['aus'],
  'canada': ['can'],
  'singapore': ['sin', 'sgp'],
  'hong kong': ['hk', 'hkg'],
  'malaysia': ['mys', 'mas'],
  'south africa': ['zaf', 'south africa (ddp)'],
  'sri lanka': ['lka', 'srilanka', 'srilanka (duty paid)']
}

function normalizeStr(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function readRegistry() {
  try {
    if (fs.existsSync(REGISTRY_PATH)) {
      return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))
    }
  } catch (err) {
    console.error('Error reading rate sheet registry:', err.message)
  }
  return {}
}

function writeRegistry(registry) {
  try {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing rate sheet registry:', err.message)
  }
}

/**
 * Resolve workbook file path for a vendor code
 */
export function getWorkbookPathForVendor(vendorCode) {
  const code = (vendorCode || 'pacific').toLowerCase().trim()
  const customPath = path.resolve(UPLOADS_DIR, `${code}.xlsx`)

  if (fs.existsSync(customPath)) {
    return { path: customPath, isDefault: false, code }
  }

  if (code === 'pacific' || code === 'pc' || code === 'pxc' || code.includes('pacific')) {
    if (fs.existsSync(DEFAULT_PACIFIC_PATH)) {
      return { path: DEFAULT_PACIFIC_PATH, isDefault: true, code: 'pacific' }
    }
  }

  const registry = readRegistry()
  if (registry[code]?.filepath && fs.existsSync(registry[code].filepath)) {
    return { path: registry[code].filepath, isDefault: false, code }
  }

  if (fs.existsSync(DEFAULT_PACIFIC_PATH)) {
    return { path: DEFAULT_PACIFIC_PATH, isDefault: true, code: 'pacific' }
  }

  return null
}

/**
 * Extract US State to Zone map from rows 57-66 of Self Network
 */
export function getUSAStateToZoneMap(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  const stateMap = {}
  if (!rows || rows.length < 66) return stateMap

  const zoneHeaders = (rows[56] || []).slice(2, 9) // Zone 2 to Zone 8
  for (let r = 57; r <= 65; r++) {
    const row = rows[r] || []
    zoneHeaders.forEach((z, colIdx) => {
      const st = row[colIdx + 2]
      if (st && typeof st === 'string' && st.trim()) {
        const cleanState = st.trim().toUpperCase()
        const cleanZone = String(z).trim()
        stateMap[cleanState] = cleanZone
      }
    })
  }
  return stateMap
}

/**
 * Resolve a US state string (e.g. "CT", "California", "NY") to its Zone
 */
export function resolveUSStateToZone(stateInput, stateMap) {
  if (!stateInput || typeof stateInput !== 'string') return null
  let s = stateInput.trim().toUpperCase()

  // Direct 2-letter abbreviation
  if (stateMap[s]) {
    return { state_code: s, zone: stateMap[s] }
  }

  // Full name check
  const abbr = US_STATE_NAMES[s]
  if (abbr && stateMap[abbr]) {
    return { state_code: abbr, zone: stateMap[abbr] }
  }

  // Case-insensitive check
  for (const [k, v] of Object.entries(stateMap)) {
    if (k.toLowerCase() === stateInput.trim().toLowerCase()) {
      return { state_code: k, zone: v }
    }
  }

  return null
}

/**
 * Extract clean, valid destination list and their supported services
 * strictly excluding weight tiers, section headings, and notes.
 */
export function extractCleanDestinations(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  const destinationMap = new Map()

  function isWeightOrHeadingLabel(text) {
    if (!text || typeof text !== 'string') return true
    const s = text.trim()
    if (!s) return true
    // Matches weight labels like "06 - 10 Kg", "1 Kg - PER KG", "10 Kg - PER KG", "11 TO 15", "6 Per Kg", etc.
    if (/^\d+(\.\d+)?\s*(kg|per kg|\+\+|to\s*\d+)?$/i.test(s)) return true
    if (/^\d+\s*-\s*\d+\s*(kg|per kg|\+\+)?$/i.test(s)) return true
    if (/^\d+\s*to\s*\d+(\s*per\s*kg)?$/i.test(s)) return true
    if (/^\d+\s*per\s*kg$/i.test(s)) return true
    if (/^(weight|zone|service code|transit time|destination)/i.test(s)) return true
    if (s.includes('STATE WISE') || s.includes('RATES EX') || s.includes('DUTY PAID') ||
        s.includes('HAWB Charges') || s.includes('STRICTLY') || s.includes('Compulsory') ||
        s.includes('Volume is') || s.includes('Zone 5') || s.includes('INR ') ||
        s.includes('Note:-') || s.includes('Subject to') || s.includes('All other') ||
        s.includes('Maximum Weight') || s.includes('Refer the next')) {
      return true
    }
    return false
  }

  function addEntry(dest, svc, meta = {}) {
    if (!dest || isWeightOrHeadingLabel(dest)) return
    const cleanDest = String(dest).trim()
    if (!destinationMap.has(cleanDest)) {
      destinationMap.set(cleanDest, {
        country: cleanDest,
        services: new Set(),
        requires_state: false,
        requires_postcode: false,
        notes: ''
      })
    }
    const record = destinationMap.get(cleanDest)
    if (svc) record.services.add(svc.trim())
    if (meta.requires_state) record.requires_state = true
    if (meta.requires_postcode) record.requires_postcode = true
    if (meta.notes) record.notes = meta.notes
  }

  // 1. Line 1-8: Middle East Self (PXC-SELF)
  for (let r = 1; r <= 7; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], 'PXC-SELF')
  }

  // 2. Line 13-20: UK Express & UK Others (PXC-EXPRESS, PXC-SELF)
  for (let r = 13; r <= 19; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], row[0] || 'PXC-SELF')
  }

  // 3. Line 23-25: Single Package
  addEntry('U.K.(Single Package)', 'PXC-SINGLE PC')
  addEntry('U.S.A.(Single Package)', 'PXC-SINGLE PC')
  addEntry('Canada(Single Package)', 'PXC-SINGLE PC')

  // 4. Line 28-68: USA Self (EX-NY) - DDP
  addEntry('United States', 'PXC-EX NY SELF', { requires_state: true })
  addEntry('United States', 'PXC-SINGLE PC')
  addEntry('USA', 'PXC-EX NY SELF', { requires_state: true })
  addEntry('USA', 'PXC-SINGLE PC')

  // 5. Line 75-96: Canada Self DDP
  addEntry('Canada', 'PXC-SELF-DDP', { requires_postcode: true })
  addEntry('Canada', 'PXC-SINGLE PC')

  // 6. Line 107-117: South Asia
  for (let r = 107; r <= 112; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], row[0] || 'PXC-SELF')
  }

  // 7. Line 121-132: East Asia / Southeast Asia
  for (let r = 121; r <= 127; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], row[0] || 'PXC-SELF')
  }

  // 8. Line 134-144: Ex-Singapore (PXC-SIN)
  for (let r = 135; r <= 143; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], 'PXC-SIN')
  }

  // 9. Line 146-165: Australia Self
  addEntry('Australia', 'PXC-SELF', { requires_postcode: true })

  // 10. Line 167-188: New Zealand Self
  addEntry('New Zealand', 'PXC-SELF', { requires_postcode: true })

  // 11. Line 190-220: Europe DDP (PXC-LHR-DDP)
  for (let r = 191; r <= 216; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], 'PXC-LHR-DDP')
  }

  // 12. Line 222-229: Europe DHL Non-DDP (PXC-LHR-DHL)
  for (let r = 222; r <= 225; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], 'PXC-LHR-DHL')
  }

  // 13. Line 231-260: UK & Europe DDP Import (PXC-IMPORT)
  for (let r = 232; r <= 258; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], 'PXC-IMPORT')
  }

  // 14. Line 261-275: East Europe / Mediterranean
  for (let r = 261; r <= 273; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], 'PXC-SELF')
  }

  // 15. Line 277-304: Africa Self
  for (let r = 277; r <= 301; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], row[0] || 'PXC-SELF')
  }

  // 16. Line 306-342: North/Central Africa
  for (let r = 306; r <= 341; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], 'PXC-SELF')
  }

  // 17. Line 344-385: Latin America & Caribbean
  for (let r = 344; r <= 384; r++) {
    const row = rows[r]
    if (row && row[1]) addEntry(row[1], 'PXC-SELF')
  }

  // 18. Line 387-389: Rest of World
  addEntry('Rest Of The World', 'PXC-ROTW')

  // Convert to formatted array
  const result = []
  destinationMap.forEach((val) => {
    result.push({
      country: val.country,
      services: Array.from(val.services),
      requires_state: val.requires_state,
      requires_postcode: val.requires_postcode,
      notes: val.notes
    })
  })

  result.sort((a, b) => a.country.localeCompare(b.country))
  return result
}

/**
 * Get sheet info, valid destinations, and US state options
 */
export function getVendorSheetDetails(vendorCode) {
  const wbInfo = getWorkbookPathForVendor(vendorCode)
  if (!wbInfo || !fs.existsSync(wbInfo.path)) {
    return {
      success: false,
      message: `No rate sheet available for vendor "${vendorCode}"`
    }
  }

  const wb = XLSX.readFile(wbInfo.path)
  const selfNet = wb.Sheets['Self Network'] || wb.Sheets[wb.SheetNames[0]]
  const stateMap = getUSAStateToZoneMap(selfNet)
  const destinations = extractCleanDestinations(selfNet)

  // Collect all unique services across destinations
  const allServices = new Set()
  destinations.forEach(d => d.services.forEach(s => allServices.add(s)))

  // Build state options for frontend dropdown
  const stateOptions = Object.entries(stateMap).map(([code, zone]) => {
    const fullName = Object.keys(US_STATE_NAMES).find(name => US_STATE_NAMES[name] === code) || code
    const formattedName = fullName.charAt(0) + fullName.slice(1).toLowerCase()
    return {
      code,
      name: formattedName,
      zone,
      label: `${code} - ${formattedName} (${zone})`
    }
  }).sort((a, b) => a.code.localeCompare(b.code))

  const firstSheet = wb.Sheets[wb.SheetNames[0]]
  const calculatorTemplate = {
    sheet_name: wb.SheetNames[0],
    b4_label: firstSheet['B4']?.v || 'Country / Destination',
    c4_default: firstSheet['C4']?.v || 'U.A.E.',
    b5_label: firstSheet['B5']?.v || 'Service Code',
    c5_default: firstSheet['C5']?.v || 'PXC-SELF',
    b6_label: firstSheet['B6']?.v || 'Weight (kg)',
    c6_default: firstSheet['C6']?.v || 1,
    b7_label: firstSheet['B7']?.v || 'Postcode / State (if required)',
    c7_default: firstSheet['C7']?.v || '',
    b9_label: firstSheet['B9']?.v || 'Matched Service',
    b10_label: firstSheet['B10']?.v || 'Calculated Vendor Rate (INR)',
    b11_label: firstSheet['B11']?.v || 'Rate Basis',
    b12_label: firstSheet['B12']?.v || 'Source Sheet Row'
  }

  return {
    success: true,
    vendor_code: wbInfo.code,
    filename: path.basename(wbInfo.path),
    is_default: wbInfo.isDefault,
    sheets: wb.SheetNames,
    calculator: calculatorTemplate,
    destinations,
    all_services: Array.from(allServices),
    state_options: stateOptions
  }
}

/**
 * Get all vendors available on the portal with rate sheet status
 */
export function getVendorsRateSheetStatus(portalVendors = []) {
  const registry = readRegistry()
  const defaultExists = fs.existsSync(DEFAULT_PACIFIC_PATH)

  if (!registry['pacific'] && defaultExists) {
    try {
      const wb = XLSX.readFile(DEFAULT_PACIFIC_PATH)
      const selfNet = wb.Sheets['Self Network']
      const dests = extractCleanDestinations(selfNet)

      registry['pacific'] = {
        vendor_code: 'pacific',
        vendor_name: 'Pacific Express',
        filename: 'Pacific Rates.xlsx',
        filepath: DEFAULT_PACIFIC_PATH,
        is_default: true,
        sheets: wb.SheetNames,
        destinations_count: dests.length,
        services_count: 11,
        uploaded_at: fs.statSync(DEFAULT_PACIFIC_PATH).mtime
      }
      writeRegistry(registry)
    } catch (e) {
      console.warn('Failed to register default Pacific sheet:', e.message)
    }
  }

  const resultVendors = []
  const seenCodes = new Set()

  for (const pv of portalVendors) {
    const code = (pv.vendor_code || pv.name || '').toLowerCase().trim()
    const reg = registry[code] || (code.includes('pacific') ? registry['pacific'] : null)
    seenCodes.add(code)

    resultVendors.push({
      id: pv.id || code,
      name: pv.name || pv.vendor_code,
      vendor_code: pv.vendor_code || code,
      has_sheet: !!reg,
      sheet_filename: reg?.filename || (code.includes('pacific') ? 'Pacific Rates.xlsx' : null),
      sheets: reg?.sheets || [],
      destinations_count: reg?.destinations_count || 0,
      services_count: reg?.services_count || 0,
      uploaded_at: reg?.uploaded_at || null,
      is_default: reg?.is_default || false,
      available_services: pv.available_services || []
    })
  }

  for (const [code, reg] of Object.entries(registry)) {
    if (!seenCodes.has(code)) {
      resultVendors.push({
        id: code,
        name: reg.vendor_name || code.toUpperCase(),
        vendor_code: reg.vendor_code || code,
        has_sheet: true,
        sheet_filename: reg.filename,
        sheets: reg.sheets || [],
        destinations_count: reg.destinations_count || 0,
        services_count: reg.services_count || 0,
        uploaded_at: reg.uploaded_at || null,
        is_default: reg.is_default || false,
        available_services: []
      })
      seenCodes.add(code)
    }
  }

  return resultVendors
}

/**
 * Save newly uploaded vendor rate sheet
 */
export function saveVendorRateSheet(vendorCode, vendorName, fileBuffer, originalName) {
  const code = (vendorCode || 'custom').toLowerCase().trim()
  const targetPath = path.resolve(UPLOADS_DIR, `${code}.xlsx`)

  fs.writeFileSync(targetPath, fileBuffer)

  const wb = XLSX.readFile(targetPath)
  const selfNet = wb.Sheets['Self Network'] || wb.Sheets[wb.SheetNames[0]]
  const destinations = extractCleanDestinations(selfNet)

  const registry = readRegistry()
  registry[code] = {
    vendor_code: code,
    vendor_name: vendorName || code.toUpperCase(),
    filename: originalName || `${code}.xlsx`,
    filepath: targetPath,
    is_default: false,
    first_tab: wb.SheetNames[0],
    sheets: wb.SheetNames,
    destinations_count: destinations.length,
    uploaded_at: new Date().toISOString()
  }
  writeRegistry(registry)

  return {
    success: true,
    vendor_code: code,
    vendor_name: vendorName,
    filename: originalName,
    sheets: wb.SheetNames,
    destinations_count: destinations.length
  }
}

/**
 * Resolve destination name against known aliases and list
 */
function resolveDestinationInput(destInput, destinationList) {
  if (!destInput) return null
  const raw = destInput.trim().toLowerCase()
  const norm = normalizeStr(raw)

  // 1. Exact match
  let match = destinationList.find(d => d.country.toLowerCase() === raw)
  if (match) return match

  // 2. Normalized match
  match = destinationList.find(d => normalizeStr(d.country) === norm)
  if (match) return match

  // 3. Known aliases check
  const candidates = [raw, ...(COUNTRY_ALIASES[raw] || [])]
  for (const cand of candidates) {
    const candNorm = normalizeStr(cand)
    match = destinationList.find(d => {
      const dNorm = normalizeStr(d.country)
      return dNorm === candNorm || dNorm.startsWith(candNorm) || candNorm.startsWith(dNorm)
    })
    if (match) return match
  }

  return null
}

/**
 * CALCULATION ENGINE
 * Calculates rates honoring all 5 tariff methods:
 * A. 500g incremental pricing
 * B. Per-kg pricing (from 1kg)
 * C. Fixed weight-band pricing (06-10 kg, 11-15 kg, etc.)
 * D. Weight-specific pricing (USA EX-NY, Canada breakpoints)
 * E. Service-specific weight tiers (UK Express, Import)
 */
export async function calculateRateFromExcelSheet({
  vendor_code,
  country,
  service_code,
  weight,
  state,
  postcode
}) {
  const weightNum = parseFloat(weight)
  if (isNaN(weightNum) || weightNum <= 0) {
    return {
      success: false,
      message: `Invalid shipment weight: "${weight}". Weight must be a positive number.`,
      reason: 'INVALID_WEIGHT'
    }
  }

  if (!country || !country.trim()) {
    return {
      success: false,
      message: 'Destination country is required for rate calculation.',
      reason: 'COUNTRY_REQUIRED'
    }
  }

  const wbInfo = getWorkbookPathForVendor(vendor_code)
  if (!wbInfo || !fs.existsSync(wbInfo.path)) {
    return {
      success: false,
      message: `Rate sheet not found for vendor "${vendor_code || 'default'}"`,
      reason: 'SHEET_NOT_FOUND'
    }
  }

  const wb = XLSX.readFile(wbInfo.path, { cellFormula: true, cellStyles: true })
  const selfNet = wb.Sheets['Self Network'] || wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(selfNet, { header: 1 })
  const cleanDests = extractCleanDestinations(selfNet)

  // 1. Resolve destination
  const matchedDestObj = resolveDestinationInput(country, cleanDests)
  if (!matchedDestObj) {
    return {
      success: false,
      message: `Destination "${country}" not found in vendor rate sheet.`,
      reason: 'DESTINATION_NOT_FOUND'
    }
  }

  const resolvedCountry = matchedDestObj.country
  const validServices = matchedDestObj.services || []

  // 2. Resolve service code
  let chosenService = (service_code || '').trim()
  if (!chosenService) {
    chosenService = validServices[0] || 'PXC-SELF'
  } else if (!validServices.some(s => s.toLowerCase() === chosenService.toLowerCase())) {
    return {
      success: false,
      message: `Service '${chosenService}' is not available for destination '${resolvedCountry}'. Valid services: ${validServices.join(', ')}`,
      reason: 'SERVICE_NOT_SUPPORTED',
      valid_services: validServices
    }
  } else {
    // Match exact case
    chosenService = validServices.find(s => s.toLowerCase() === chosenService.toLowerCase()) || chosenService
  }

  // 3. Route to dedicated pricing model

  // ═══════════════════════════════════════════════════════════════
  // MODEL 1: USA EX-NY SELF (PXC-EX NY SELF)
  // ═══════════════════════════════════════════════════════════════
  if (chosenService === 'PXC-EX NY SELF') {
    const stateMap = getUSAStateToZoneMap(selfNet)
    const stInput = (state || postcode || '').trim()
    const resolvedState = resolveUSStateToZone(stInput, stateMap)

    if (!resolvedState) {
      return {
        success: false,
        message: stInput
          ? `State "${stInput}" is not recognized. Valid states: ${Object.keys(stateMap).join(', ')}`
          : 'US state is required for PXC-EX NY SELF. Please select a valid state (e.g. CT, CA, NY).',
        reason: 'STATE_REQUIRED',
        valid_states: Object.keys(stateMap)
      }
    }

    if (weightNum > 21.5) {
      return {
        success: false,
        message: `Shipment weight (${weightNum} kg) exceeds maximum permissible weight of 21.5 kg for USA PXC-EX NY SELF.`,
        reason: 'MAX_WEIGHT_EXCEEDED'
      }
    }

    const zoneHeaders = rows[56].slice(2, 9) // Zone 2 to Zone 8
    const zoneCol = zoneHeaders.indexOf(resolvedState.zone) + 2

    let calculatedRate = 0
    let rateBasis = ''
    let pricingMethod = ''
    let matchedBand = ''
    let sourceRow = 0
    let ratePerKg = null

    if (weightNum <= 5) {
      pricingMethod = 'weight_specific'
      const bp = Math.ceil(weightNum * 2) / 2
      const rowIdx = 29 + Math.round((bp - 0.5) * 2)
      sourceRow = rowIdx + 1
      calculatedRate = Number(rows[rowIdx][zoneCol])
      matchedBand = `${bp} kg (${resolvedState.zone})`
      rateBasis = `${bp} kg flat rate for ${resolvedState.zone}: ₹${calculatedRate.toLocaleString('en-IN')}`
    } else {
      pricingMethod = 'per_kg'
      const ceilW = Math.min(22, Math.max(6, Math.ceil(weightNum)))
      const rowIdx = 39 + (ceilW - 6)
      sourceRow = rowIdx + 1
      ratePerKg = Number(rows[rowIdx][zoneCol])
      calculatedRate = Math.round(weightNum * ratePerKg * 100) / 100
      matchedBand = `${ceilW} Per Kg (${resolvedState.zone})`
      rateBasis = `${weightNum} kg @ ₹${ratePerKg}/kg for ${resolvedState.zone} = ₹${calculatedRate.toLocaleString('en-IN')}`
    }

    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService,
      weight: weightNum,
      state: resolvedState.state_code,
      zone: resolvedState.zone,
      pricing_method: pricingMethod,
      matched_band: matchedBand,
      vendor_rate: calculatedRate,
      rate_per_kg: ratePerKg,
      rate_basis: rateBasis,
      transit_time: '5-8 Days',
      source_sheet: 'Self Network',
      source_row: sourceRow
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // MODEL 2: AUSTRALIA SELF (PXC-SELF)
  // ═══════════════════════════════════════════════════════════════
  if (resolvedCountry.toLowerCase() === 'australia' && chosenService === 'PXC-SELF') {
    if (weightNum > 25) {
      return {
        success: false,
        message: `Shipment weight (${weightNum} kg) exceeds maximum permissible weight of 25 kg for Australia PXC-SELF.`,
        reason: 'MAX_WEIGHT_EXCEEDED'
      }
    }

    // Resolve zone from postcode if provided
    let resolvedZone = 'ZONE 1'
    if (postcode && wb.Sheets['Aus Zone']) {
      const azRows = XLSX.utils.sheet_to_json(wb.Sheets['Aus Zone'])
      const cleanPc = String(postcode).trim().padStart(4, '0')
      const m = azRows.find(r => String(r['Post code'] || '').padStart(4, '0') === cleanPc)
      if (m && m['Zones']) resolvedZone = String(m['Zones']).toUpperCase()
    }

    const ausHeaders = rows[146].slice(2, 11) // ZONE 1 to ZONE 9
    const zIdx = ausHeaders.findIndex(h => h.toUpperCase().replace(/\s+/g, '') === resolvedZone.replace(/\s+/g, ''))
    const col = zIdx >= 0 ? zIdx + 2 : 2
    const zName = ausHeaders[zIdx >= 0 ? zIdx : 0]

    let rate = 0
    let perKg = null
    let band = ''
    let method = ''
    let sourceRow = 148

    if (weightNum <= 0.5) {
      method = 'weight_specific'
      rate = Number(rows[147][col])
      band = '0.5 kg'
      sourceRow = 148
    } else if (weightNum <= 5) {
      method = 'per_kg_exact'
      const ceilW = Math.ceil(weightNum)
      const rIdx = 147 + ceilW
      sourceRow = rIdx + 1
      perKg = Number(rows[rIdx][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = `${ceilW} Kg - PER KG`
    } else if (weightNum <= 10) {
      method = 'weight_band'
      sourceRow = 154
      perKg = Number(rows[153][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '06 - 10 Kg'
    } else if (weightNum <= 15) {
      method = 'weight_band'
      sourceRow = 155
      perKg = Number(rows[154][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '11 - 15 Kg'
    } else if (weightNum <= 20) {
      method = 'weight_band'
      sourceRow = 156
      perKg = Number(rows[155][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '16 - 20 Kg'
    } else {
      method = 'weight_band'
      sourceRow = 157
      perKg = Number(rows[156][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '21 - 25 Kg'
    }

    const basis = perKg
      ? `${weightNum} kg in ${band} @ ₹${perKg}/kg (${zName}) = ₹${rate.toLocaleString('en-IN')}`
      : `0.5 kg base rate (${zName}): ₹${rate.toLocaleString('en-IN')}`

    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService,
      weight: weightNum,
      zone: zName,
      pricing_method: method,
      matched_band: band,
      vendor_rate: rate,
      rate_per_kg: perKg,
      rate_basis: basis,
      transit_time: '7-8 Days',
      source_sheet: 'Self Network',
      source_row: sourceRow
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // MODEL 3: NEW ZEALAND SELF (PXC-SELF)
  // ═══════════════════════════════════════════════════════════════
  if (resolvedCountry.toLowerCase() === 'new zealand' && chosenService === 'PXC-SELF') {
    if (weightNum > 25) {
      return {
        success: false,
        message: `Shipment weight (${weightNum} kg) exceeds maximum permissible weight of 25 kg for New Zealand PXC-SELF.`,
        reason: 'MAX_WEIGHT_EXCEEDED'
      }
    }

    let resolvedZone = 'Zone 1'
    if (postcode && wb.Sheets['NZ Zone']) {
      const nzRows = XLSX.utils.sheet_to_json(wb.Sheets['NZ Zone'])
      const m = nzRows.find(r => String(r['POSTCODE'] || '').trim() === String(postcode).trim())
      if (m && m['Zone']) resolvedZone = String(m['Zone'])
    }

    const nzHeaders = rows[167].slice(2, 6) // Zone 1, Zone 2, Zone 3/4, Zone 5
    let col = 2
    if (resolvedZone.includes('2')) col = 3
    else if (resolvedZone.includes('3') || resolvedZone.includes('4')) col = 4
    else if (resolvedZone.includes('5')) col = 5

    let rate = 0
    let perKg = null
    let band = ''
    let sourceRow = 169

    if (weightNum <= 10) {
      const ceilW = Math.max(1, Math.ceil(weightNum))
      const rIdx = 167 + ceilW
      sourceRow = rIdx + 1
      perKg = Number(rows[rIdx][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = `${ceilW} Kg - PER KG`
    } else if (weightNum <= 15) {
      sourceRow = 179
      perKg = Number(rows[178][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '11 - 15 Kg'
    } else if (weightNum <= 20) {
      sourceRow = 180
      perKg = Number(rows[179][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '16 - 20 Kg'
    } else if (weightNum <= 24) {
      sourceRow = 181
      perKg = Number(rows[180][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '21 - 24 Kg'
    } else {
      sourceRow = 182
      perKg = Number(rows[181][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '25 Kg'
    }

    const basis = `${weightNum} kg in ${band} @ ₹${perKg}/kg (${rows[167][col]}) = ₹${rate.toLocaleString('en-IN')}`

    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService,
      weight: weightNum,
      zone: rows[167][col],
      pricing_method: weightNum <= 10 ? 'per_kg_exact' : 'weight_band',
      matched_band: band,
      vendor_rate: rate,
      rate_per_kg: perKg,
      rate_basis: basis,
      transit_time: '7-8 Days',
      source_sheet: 'Self Network',
      source_row: sourceRow
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // MODEL 4: CANADA SELF DDP (PXC-SELF-DDP)
  // ═══════════════════════════════════════════════════════════════
  if (resolvedCountry.toLowerCase() === 'canada' && chosenService === 'PXC-SELF-DDP') {
    if (weightNum > 30) {
      return {
        success: false,
        message: `Shipment weight (${weightNum} kg) exceeds maximum permissible weight of 30 kg for Canada PXC-SELF-DDP.`,
        reason: 'MAX_WEIGHT_EXCEEDED'
      }
    }

    let resolvedZone = 'Zone 1'
    if (postcode && wb.Sheets['Canada Zone']) {
      const czRows = XLSX.utils.sheet_to_json(wb.Sheets['Canada Zone'])
      const cleanPrefix = String(postcode).trim().slice(0, 3).toUpperCase()
      const m = czRows.find(r => String(r['Zipcode'] || '').trim().toUpperCase() === cleanPrefix)
      if (m && m[' ZONE']) resolvedZone = `Zone ${m[' ZONE']}`
    }

    const zoneHeaders = rows[75].slice(3, 19) // Zone 1 to Zone 16
    const zIdx = zoneHeaders.findIndex(h => String(h).toUpperCase().replace(/\s+/g, '') === resolvedZone.toUpperCase().replace(/\s+/g, ''))
    const col = zIdx >= 0 ? zIdx + 3 : 3
    const zName = zoneHeaders[zIdx >= 0 ? zIdx : 0]

    let rate = 0
    let perKg = null
    let band = ''
    let method = ''
    let sourceRow = 77

    if (weightNum <= 5) {
      method = 'weight_specific'
      const bp = Math.ceil(weightNum * 2) / 2
      const rowIdx = 76 + Math.round((bp - 0.5) * 2)
      sourceRow = rowIdx + 1
      rate = Number(rows[rowIdx][col])
      band = `${bp} kg (${zName})`
    } else if (weightNum <= 10) {
      method = 'per_kg_exact'
      const ceilW = Math.ceil(weightNum)
      const rowIdx = 86 + (ceilW - 6)
      sourceRow = rowIdx + 1
      perKg = Number(rows[rowIdx][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = `${ceilW} Per kg`
    } else if (weightNum <= 15) {
      method = 'weight_band'
      sourceRow = 92
      perKg = Number(rows[91][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '11 TO 15 Per kg'
    } else if (weightNum <= 20) {
      method = 'weight_band'
      sourceRow = 93
      perKg = Number(rows[92][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '16 TO 20 Per kg'
    } else if (weightNum <= 25) {
      method = 'weight_band'
      sourceRow = 94
      perKg = Number(rows[93][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '21 TO 25 Per kg'
    } else {
      method = 'weight_band'
      sourceRow = 95
      perKg = Number(rows[94][col])
      rate = Math.round(weightNum * perKg * 100) / 100
      band = '26 TO 30 Per kg'
    }

    const basis = perKg
      ? `${weightNum} kg in ${band} @ ₹${perKg}/kg (${zName}) = ₹${rate.toLocaleString('en-IN')}`
      : `${band} flat rate: ₹${rate.toLocaleString('en-IN')}`

    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService,
      weight: weightNum,
      zone: zName,
      pricing_method: method,
      matched_band: band,
      vendor_rate: rate,
      rate_per_kg: perKg,
      rate_basis: basis,
      transit_time: '7-10 Days',
      source_sheet: 'Self Network',
      source_row: sourceRow
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // MODEL 5: DDP IMPORT RATE (PXC-IMPORT)
  // ═══════════════════════════════════════════════════════════════
  if (chosenService === 'PXC-IMPORT') {
    const cNorm = resolvedCountry.trim().toLowerCase()
    let matchRow = null
    let sourceRow = 0
    for (let r = 232; r <= 258; r++) {
      const row = rows[r]
      if (row && row[1] && (
        String(row[1]).trim().toLowerCase() === cNorm ||
        String(row[1]).trim().toLowerCase().includes(cNorm) ||
        cNorm.includes(String(row[1]).trim().toLowerCase())
      )) {
        matchRow = row
        sourceRow = r + 1
        break
      }
    }

    if (!matchRow) {
      return {
        success: false,
        message: `Destination "${resolvedCountry}" not found in DDP Import tariff.`,
        reason: 'DESTINATION_NOT_IN_IMPORT'
      }
    }

    const first5 = Number(matchRow[2])
    const sixPlus = Number(matchRow[3])

    if (weightNum <= 5) {
      return finalizeQuoteResponse(wb, {
        country: resolvedCountry,
        service_code: chosenService,
        weight: weightNum,
        pricing_method: 'base_first_5kg',
        matched_band: 'First 5 Kg',
        vendor_rate: first5,
        rate_per_kg: null,
        rate_basis: `First 5 Kg flat base rate: ₹${first5.toLocaleString('en-IN')}`,
        transit_time: String(matchRow[4] || '7-8 Days'),
        source_sheet: 'Self Network',
        source_row: sourceRow
      })
    } else {
      const rAmt = Math.round(weightNum * sixPlus * 100) / 100
      return finalizeQuoteResponse(wb, {
        country: resolvedCountry,
        service_code: chosenService,
        weight: weightNum,
        pricing_method: 'per_kg',
        matched_band: '6 Kg++',
        vendor_rate: rAmt,
        rate_per_kg: sixPlus,
        rate_basis: `${weightNum} kg @ ₹${sixPlus}/kg = ₹${rAmt.toLocaleString('en-IN')}`,
        transit_time: String(matchRow[4] || '7-8 Days'),
        source_sheet: 'Self Network',
        source_row: sourceRow
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MODEL 6: SINGLE PACKAGE (PXC-SINGLE PC)
  // ═══════════════════════════════════════════════════════════════
  if (chosenService === 'PXC-SINGLE PC') {
    let ratePerKg = 790
    let sourceRow = 23
    if (resolvedCountry.toLowerCase().includes('usa') || resolvedCountry.toLowerCase().includes('united states')) {
      ratePerKg = 1140
      sourceRow = 24
    } else if (resolvedCountry.toLowerCase().includes('canada')) {
      ratePerKg = 1190
      sourceRow = 25
    }
    const total = Math.round(weightNum * ratePerKg * 100) / 100
    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService,
      weight: weightNum,
      pricing_method: 'per_kg_flat',
      matched_band: 'Single PC Flat',
      vendor_rate: total,
      rate_per_kg: ratePerKg,
      rate_basis: `${weightNum} kg @ ₹${ratePerKg}/kg = ₹${total.toLocaleString('en-IN')} (Note: ₹7500 clearing charge applicable if not self-cleared)`,
      transit_time: '6-8 Days',
      source_sheet: 'Self Network',
      source_row: sourceRow
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // MODEL 7: UK EXPRESS (PXC-EXPRESS)
  // ═══════════════════════════════════════════════════════════════
  if (chosenService === 'PXC-EXPRESS') {
    const row = rows[13] // Row 14 in Excel
    const base500 = Number(row[2] || 675)
    const addl500 = Number(row[3] || 225)

    if (weightNum <= 0.5) {
      return finalizeQuoteResponse(wb, {
        country: resolvedCountry,
        service_code: chosenService,
        weight: weightNum,
        pricing_method: '500g_incremental',
        matched_band: 'First 500g',
        vendor_rate: base500,
        rate_per_kg: null,
        rate_basis: `First 500g flat rate: ₹${base500}`,
        transit_time: '48 Hours',
        source_sheet: 'Self Network',
        source_row: 14
      })
    } else if (weightNum < 6) {
      const units = Math.ceil((weightNum - 0.5) / 0.5)
      const total = base500 + units * addl500
      return finalizeQuoteResponse(wb, {
        country: resolvedCountry,
        service_code: chosenService,
        weight: weightNum,
        pricing_method: '500g_incremental',
        matched_band: `500g + ${units} addl`,
        vendor_rate: total,
        rate_per_kg: null,
        rate_basis: `First 500g (₹${base500}) + ${units} × Addl 500g (₹${addl500}) = ₹${total}`,
        transit_time: '48 Hours',
        source_sheet: 'Self Network',
        source_row: 14
      })
    } else {
      // UK Express tiers: 6, 8, 11, 16, 21, 26, 31, 50, 100 kg
      let tierRate = 500
      let band = '100Kg++'
      if (weightNum < 8) { tierRate = Number(row[4] || 575); band = '6kg++'; }
      else if (weightNum < 11) { tierRate = Number(row[5] || 555); band = '8kg++'; }
      else if (weightNum < 16) { tierRate = Number(row[6] || 525); band = '11 Kg++'; }
      else if (weightNum < 21) { tierRate = Number(row[7] || 505); band = '16Kg++'; }
      else if (weightNum < 26) { tierRate = Number(row[8] || 500); band = '21Kg++'; }
      else if (weightNum < 31) { tierRate = Number(row[9] || 500); band = '26Kg++'; }
      else if (weightNum < 50) { tierRate = Number(row[10] || 500); band = '31Kg++'; }
      else if (weightNum < 100) { tierRate = Number(row[11] || 500); band = '50Kg++'; }

      const total = Math.round(weightNum * tierRate * 100) / 100
      return finalizeQuoteResponse(wb, {
        country: resolvedCountry,
        service_code: chosenService,
        weight: weightNum,
        pricing_method: 'service_specific_tiers',
        matched_band: band,
        vendor_rate: total,
        rate_per_kg: tierRate,
        rate_basis: `${weightNum} kg in UK Express ${band} @ ₹${tierRate}/kg = ₹${total.toLocaleString('en-IN')}`,
        transit_time: '48 Hours',
        source_sheet: 'Self Network',
        source_row: 14
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MODEL 8: STANDARD TARIFF (Middle East, Europe, Africa, ROTW, etc.)
  // ═══════════════════════════════════════════════════════════════
  // Scan all rows in Self Network matching destination and service code
  let matchedTariffRow = null
  let matchedHeader = null
  let sourceRow = 0
  const normDest = normalizeStr(resolvedCountry)

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length < 3) continue
    const svcCell = String(row[0] || '').trim()
    const destCell = String(row[1] || '').trim()

    if (svcCell && svcCell.toLowerCase() === chosenService.toLowerCase()) {
      if (normalizeStr(destCell) === normDest || destCell.toLowerCase() === resolvedCountry.toLowerCase()) {
        matchedTariffRow = row
        sourceRow = r + 1
        // Find preceding header row
        for (let h = r - 1; h >= 0; h--) {
          if (rows[h] && String(rows[h][0] || '').trim() === 'SERVICE CODE') {
            matchedHeader = rows[h]
            break
          }
        }
        break
      }
    }
  }

  if (!matchedTariffRow) {
    return {
      success: false,
      message: `No tariff row found for destination '${resolvedCountry}' and service '${chosenService}'.`,
      reason: 'TARIFF_ROW_NOT_FOUND'
    }
  }

  // Check destination specific weight limits from original notes
  if (resolvedCountry.toLowerCase().includes('kuwait') && weightNum > 30) {
    return {
      success: false,
      message: `Shipment weight (${weightNum} kg) exceeds maximum permissible weight of 30 kg for Kuwait.`,
      reason: 'MAX_WEIGHT_EXCEEDED'
    }
  }
  if ((resolvedCountry.toLowerCase().includes('qatar') || resolvedCountry.toLowerCase().includes('saudi arabia')) && weightNum > 30) {
    return {
      success: false,
      message: `Shipment weight (${weightNum} kg) exceeds maximum permissible weight of 30 kg for ${resolvedCountry}.`,
      reason: 'MAX_WEIGHT_EXCEEDED'
    }
  }

  // Determine pricing columns
  const base500 = Number(matchedTariffRow[2] || 0)
  const addl500 = Number(matchedTariffRow[3] || 0)

  // Suspended check
  if (base500 === 0 && Number(matchedTariffRow[4] || 0) === 0) {
    return {
      success: false,
      message: `Service for destination '${resolvedCountry}' is currently suspended or rate unavailable.`,
      reason: 'SERVICE_SUSPENDED'
    }
  }

  // Handle East Europe 3 Kg++ base table (where column 2 is 3 Kg++)
  const col2Header = matchedHeader ? String(matchedHeader[2] || '') : ''
  if (col2Header.includes('3 Kg++')) {
    if (weightNum < 3) {
      return {
        success: false,
        message: `Minimum shipment weight for this tariff is 3.0 kg. (Entered: ${weightNum} kg)`,
        reason: 'MIN_WEIGHT_NOT_MET'
      }
    }
    // Match tier column
    let perKg = Number(matchedTariffRow[2])
    let band = '3 Kg++'
    const headers = matchedHeader || []
    for (let c = 2; c < headers.length; c++) {
      const hStr = String(headers[c] || '')
      const kgMatch = hStr.match(/(\d+)\s*Kg/i)
      if (kgMatch) {
        const threshold = Number(kgMatch[1])
        if (weightNum >= threshold && matchedTariffRow[c] !== '-' && Number(matchedTariffRow[c]) > 0) {
          perKg = Number(matchedTariffRow[c])
          band = hStr
        }
      }
    }
    const total = Math.round(weightNum * perKg * 100) / 100
    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService,
      weight: weightNum,
      pricing_method: 'per_kg_tiers',
      matched_band: band,
      vendor_rate: total,
      rate_per_kg: perKg,
      rate_basis: `${weightNum} kg @ ₹${perKg}/kg in ${band} = ₹${total.toLocaleString('en-IN')}`,
      transit_time: String(matchedTariffRow[matchedTariffRow.length - 1] || '6-8 Days'),
      source_sheet: 'Self Network',
      source_row: sourceRow
    })
  }

  // Standard 500g incremental pricing
  if (weightNum <= 0.5) {
    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService,
      weight: weightNum,
      pricing_method: '500g_incremental',
      matched_band: 'First 500g',
      vendor_rate: base500,
      rate_per_kg: null,
      rate_basis: `First 500g flat rate: ₹${base500.toFixed(2)}`,
      transit_time: String(matchedTariffRow[matchedTariffRow.length - 1] || '5-7 Days'),
      source_sheet: 'Self Network',
      source_row: sourceRow
    })
  } else if (weightNum < 6) {
    const units = Math.ceil((weightNum - 0.5) / 0.5)
    const total = base500 + units * addl500
    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService,
      weight: weightNum,
      pricing_method: '500g_incremental',
      matched_band: `500g + ${units} addl`,
      vendor_rate: total,
      rate_per_kg: null,
      rate_basis: `First 500g (₹${base500}) + ${units} × Addl 500g (₹${addl500}) = ₹${total.toFixed(2)}`,
      transit_time: String(matchedTariffRow[matchedTariffRow.length - 1] || '5-7 Days'),
      source_sheet: 'Self Network',
      source_row: sourceRow
    })
  } else {
    // 6kg and above: per-kg tiers
    let matchedTierRate = 0
    let matchedBand = '6kg++'
    const headers = matchedHeader || []

    for (let c = 4; c < headers.length; c++) {
      const hStr = String(headers[c] || '')
      const kgMatch = hStr.match(/(\d+)\s*Kg/i)
      if (kgMatch) {
        const threshold = Number(kgMatch[1])
        const val = matchedTariffRow[c]
        if (weightNum >= threshold && val !== '-' && val !== null && val !== undefined && Number(val) > 0) {
          matchedTierRate = Number(val)
          matchedBand = hStr
        }
      }
    }

    if (matchedTierRate === 0) {
      // Fallback to column 4
      const col4Val = matchedTariffRow[4]
      if (col4Val !== '-' && Number(col4Val) > 0) {
        matchedTierRate = Number(col4Val)
      } else {
        return {
          success: false,
          message: `Rate tier for ${weightNum} kg is not available for destination '${resolvedCountry}'.`,
          reason: 'TIER_UNAVAILABLE'
        }
      }
    }

    const total = Math.round(weightNum * matchedTierRate * 100) / 100
    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService,
      weight: weightNum,
      pricing_method: 'per_kg_tiers',
      matched_band: matchedBand,
      vendor_rate: total,
      rate_per_kg: matchedTierRate,
      rate_basis: `${weightNum} kg @ ₹${matchedTierRate}/kg in ${matchedBand} = ₹${total.toLocaleString('en-IN')}`,
      transit_time: String(matchedTariffRow[matchedTariffRow.length - 1] || '5-7 Days'),
      source_sheet: 'Self Network',
      source_row: sourceRow
    })
  }
}

/**
 * Finalize quote: updates Sheet 1 cells C4, C5, C6, C7 and writes C10, C9, C11, C12
 */
function finalizeQuoteResponse(wb, quote) {
  const firstSheet = wb.Sheets[wb.SheetNames[0]]
  if (firstSheet) {
    firstSheet['C4'] = { t: 's', v: quote.country, w: String(quote.country) }
    firstSheet['C5'] = { t: 's', v: quote.service_code, w: String(quote.service_code) }
    firstSheet['C6'] = { t: 'n', v: quote.weight, w: String(quote.weight) }
    firstSheet['C7'] = { t: 's', v: quote.state || quote.postcode || '', w: String(quote.state || quote.postcode || '') }
    firstSheet['C9'] = { t: 's', v: quote.service_code, w: String(quote.service_code) }
    firstSheet['C10'] = { t: 'n', v: quote.vendor_rate, w: String(quote.vendor_rate) }
    firstSheet['C11'] = { t: 's', v: quote.rate_basis, w: String(quote.rate_basis) }
    if (quote.source_row) {
      firstSheet['C12'] = { t: 'n', v: quote.source_row, w: String(quote.source_row) }
    }
  }

  return {
    success: true,
    country: quote.country,
    service_code: quote.service_code,
    weight: quote.weight,
    chargeable_weight: quote.weight,
    state: quote.state || null,
    zone: quote.zone || null,
    pricing_method: quote.pricing_method,
    matched_band: quote.matched_band,
    vendor_rate: quote.vendor_rate,
    shipping_charge: quote.vendor_rate,
    currency: 'INR',
    rate_per_kg: quote.rate_per_kg || null,
    rate_basis: quote.rate_basis,
    transit_time: quote.transit_time || '',
    source_sheet: quote.source_sheet || 'Self Network',
    source_row: quote.source_row || null
  }
}
