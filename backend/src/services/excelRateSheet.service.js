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
// REGISTRY HELPERS (File-based, no DB needed)
// ═══════════════════════════════════════════════════════════════
function readRegistry() {
  try {
    if (fs.existsSync(REGISTRY_PATH)) {
      const data = fs.readFileSync(REGISTRY_PATH, 'utf8')
      return JSON.parse(data)
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

// Country aliases for flexible matching
const COUNTRY_ALIASES = {
  'united arab emirates': ['u.a.e.', 'uae', 'are', 'dubai', 'abu dhabi'],
  'uae': ['u.a.e.', 'united arab emirates', 'are'],
  'u.a.e.': ['united arab emirates', 'uae', 'are'],
  'united kingdom': ['u.k.', 'uk', 'gbr', 'great britain', 'england', 'scotland', 'wales'],
  'uk': ['u.k.', 'united kingdom', 'gbr', 'great britain'],
  'u.k.': ['united kingdom', 'uk', 'gbr', 'great britain'],
  'united states': ['u.s.a.', 'usa', 'united states of america', 'us'],
  'united states of america': ['u.s.a.', 'usa', 'united states', 'us'],
  'usa': ['u.s.a.', 'united states', 'united states of america', 'us'],
  'u.s.a.': ['united states', 'usa', 'united states of america', 'us'],
  'saudi arabia': ['ksa', 'saudi', 'sau', 'saudi arabia (resumed)'],
  'kuwait': ['kwt', 'kuwait (service temporarily suspended)'],
  'new zealand': ['nz', 'nzl'],
  'australia': ['aus', 'australia zone'],
  'canada': ['can', 'canada zone', 'canada(single package)'],
  'singapore': ['sin', 'sgp'],
  'hong kong': ['hk', 'hkg'],
  'malaysia': ['mys', 'mas'],
  'south africa': ['zaf', 'south africa (ddp)'],
  'sri lanka': ['lka', 'srilanka', 'srilanka (duty paid)']
}

function normalizeStr(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Resolve workbook file path for a vendor code.
 * Defaults to Pacific Rates.xlsx if vendor is Pacific or not found.
 */
export function getWorkbookPathForVendor(vendorCode) {
  const code = (vendorCode || 'pacific').toLowerCase().trim()
  const customPath = path.resolve(UPLOADS_DIR, `${code}.xlsx`)

  if (fs.existsSync(customPath)) {
    return { path: customPath, isDefault: false, code }
  }

  // Check aliases for Pacific
  if (code === 'pacific' || code === 'pc' || code === 'pxc' || code.includes('pacific')) {
    if (fs.existsSync(DEFAULT_PACIFIC_PATH)) {
      return { path: DEFAULT_PACIFIC_PATH, isDefault: true, code: 'pacific' }
    }
  }

  // If specific vendor sheet doesn't exist, check registry
  const registry = readRegistry()
  if (registry[code]?.filepath && fs.existsSync(registry[code].filepath)) {
    return { path: registry[code].filepath, isDefault: false, code }
  }

  // Fallback to Pacific default
  if (fs.existsSync(DEFAULT_PACIFIC_PATH)) {
    return { path: DEFAULT_PACIFIC_PATH, isDefault: true, code: 'pacific' }
  }

  return null
}

/**
 * Read and cache workbook structure
 */
export function loadWorkbook(vendorCode) {
  const wbInfo = getWorkbookPathForVendor(vendorCode)
  if (!wbInfo || !fs.existsSync(wbInfo.path)) {
    throw new Error(`Rate sheet not found for vendor "${vendorCode || 'default'}"`)
  }

  const workbook = XLSX.readFile(wbInfo.path, { cellFormula: true, cellStyles: true })
  return { workbook, ...wbInfo }
}

/**
 * Get all vendors available on the portal with rate sheet info.
 * Can accept a list of vendor configs from DB or use registry.
 */
export function getVendorsRateSheetStatus(portalVendors = []) {
  const registry = readRegistry()
  const defaultExists = fs.existsSync(DEFAULT_PACIFIC_PATH)

  // Ensure Pacific exists in registry
  if (!registry['pacific'] && defaultExists) {
    try {
      const wb = XLSX.readFile(DEFAULT_PACIFIC_PATH)
      const firstSheet = wb.Sheets[wb.SheetNames[0]]
      const tariffSheet = wb.Sheets['_RateData'] || wb.Sheets['Self Network']
      const rows = tariffSheet ? XLSX.utils.sheet_to_json(tariffSheet) : []
      const destinations = new Set(rows.map(r => r['Country / Destination'] || r['Destination']).filter(Boolean))

      registry['pacific'] = {
        vendor_code: 'pacific',
        vendor_name: 'Pacific Express',
        filename: 'Pacific Rates.xlsx',
        filepath: DEFAULT_PACIFIC_PATH,
        is_default: true,
        sheets: wb.SheetNames,
        destinations_count: destinations.size || 248,
        services_count: 11,
        uploaded_at: fs.statSync(DEFAULT_PACIFIC_PATH).mtime
      }
      writeRegistry(registry)
    } catch (e) {
      console.warn('Failed to register default Pacific sheet:', e.message)
    }
  }

  // Build unified list of portal vendors
  const resultVendors = []
  const seenCodes = new Set()

  // First, map portal vendors provided
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

  // Add any vendors from registry not in portal list (e.g. Pacific if not yet in portal vendors)
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

  // Write file to disk
  fs.writeFileSync(targetPath, fileBuffer)

  // Parse workbook to inspect structure
  const wb = XLSX.readFile(targetPath, { cellFormula: true })
  const sheetNames = wb.SheetNames
  if (sheetNames.length === 0) {
    throw new Error('Excel workbook contains no sheets')
  }

  const firstSheetName = sheetNames[0]
  const firstSheet = wb.Sheets[firstSheetName]

  // Inspect first tab labels: B4, B5, B6, B7, B10
  const b4 = firstSheet['B4']?.v || ''
  const b5 = firstSheet['B5']?.v || ''
  const b6 = firstSheet['B6']?.v || ''
  const b7 = firstSheet['B7']?.v || ''
  const b10 = firstSheet['B10']?.v || ''

  // Look for tariff sheet to count destinations & services
  const tariffSheet = wb.Sheets['_RateData'] || wb.Sheets['Self Network'] || wb.Sheets['Rates'] || wb.Sheets[sheetNames[1]] || firstSheet
  const rows = tariffSheet ? XLSX.utils.sheet_to_json(tariffSheet) : []

  const destinations = new Set()
  const services = new Set()

  rows.forEach(r => {
    const dest = r['Country / Destination'] || r['Destination'] || r['Country'] || r['destination']
    const svc = r['Service Code'] || r['SERVICE CODE'] || r['Service'] || r['service_code']
    if (dest) destinations.add(String(dest).trim())
    if (svc) services.add(String(svc).trim())
  })

  // Update registry
  const registry = readRegistry()
  registry[code] = {
    vendor_code: code,
    vendor_name: vendorName || code.toUpperCase(),
    filename: originalName || `${code}.xlsx`,
    filepath: targetPath,
    is_default: false,
    first_tab: firstSheetName,
    labels: { b4, b5, b6, b7, b10 },
    sheets: sheetNames,
    destinations_count: destinations.size || rows.length,
    services_count: services.size,
    uploaded_at: new Date().toISOString()
  }
  writeRegistry(registry)

  return {
    success: true,
    vendor_code: code,
    vendor_name: vendorName,
    filename: originalName,
    sheets: sheetNames,
    first_tab: firstSheetName,
    destinations_count: destinations.size || rows.length,
    services_count: services.size,
    labels: { b4, b5, b6, b7, b10 }
  }
}

/**
 * Get sheet info, tabs, and destinations for a vendor
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
  const sheetNames = wb.SheetNames
  const firstSheetName = sheetNames[0]
  const firstSheet = wb.Sheets[firstSheetName]

  // Extract cell inputs/labels from first tab (Rate Calculator)
  const calculatorTemplate = {
    sheet_name: firstSheetName,
    b4_label: firstSheet['B4']?.v || 'Country / Destination',
    c4_default: firstSheet['C4']?.v || '',
    b5_label: firstSheet['B5']?.v || 'Service Code',
    c5_default: firstSheet['C5']?.v || '',
    b6_label: firstSheet['B6']?.v || 'Weight (kg)',
    c6_default: firstSheet['C6']?.v || 1,
    b7_label: firstSheet['B7']?.v || 'Postcode',
    c7_default: firstSheet['C7']?.v || '',
    b9_label: firstSheet['B9']?.v || 'Matched Service',
    b10_label: firstSheet['B10']?.v || 'Calculated Vendor Rate (INR)',
    b11_label: firstSheet['B11']?.v || 'Rate Basis',
    b12_label: firstSheet['B12']?.v || 'Source Sheet Row'
  }

  // Find destinations and services from tariff sheet or list columns
  const destinationsList = []
  const servicesList = new Set()
  const tariffSheet = wb.Sheets['_RateData'] || wb.Sheets['Self Network'] || wb.Sheets['Rates'] || wb.Sheets[sheetNames[1]]

  if (tariffSheet) {
    const rawRows = XLSX.utils.sheet_to_json(tariffSheet)
    const map = new Map()

    rawRows.forEach(r => {
      const dest = r['Country / Destination'] || r['Destination'] || r['Country'] || ''
      const svc = r['Service Code'] || r['SERVICE CODE'] || r['Service'] || ''
      if (dest) {
        const trimmedDest = String(dest).trim()
        if (!map.has(trimmedDest)) {
          map.set(trimmedDest, new Set())
        }
        if (svc) {
          map.get(trimmedDest).add(String(svc).trim())
          servicesList.add(String(svc).trim())
        }
      }
    })

    map.forEach((servicesSet, country) => {
      destinationsList.push({
        country,
        services: Array.from(servicesSet)
      })
    })
  } else {
    // If no tariff sheet, look at column H in first sheet (Rate Calculator destinations list)
    const destCells = Object.keys(firstSheet)
      .filter(k => /^H\d+$/.test(k) && Number(k.slice(1)) >= 38)
      .map(k => firstSheet[k]?.v)
      .filter(Boolean)

    destCells.forEach(c => {
      destinationsList.push({
        country: String(c).trim(),
        services: []
      })
    })
  }

  destinationsList.sort((a, b) => a.country.localeCompare(b.country))

  return {
    success: true,
    vendor_code: wbInfo.code,
    filename: path.basename(wbInfo.path),
    is_default: wbInfo.isDefault,
    sheets: sheetNames,
    calculator: calculatorTemplate,
    destinations: destinationsList,
    all_services: Array.from(servicesList)
  }
}

/**
 * Match a user-entered destination string to the sheet's destination
 */
function resolveDestinationMatch(inputCountry, records) {
  if (!inputCountry || !records || records.length === 0) return null

  const raw = inputCountry.trim().toLowerCase()
  const norm = normalizeStr(raw)

  // 1. Direct exact match
  let found = records.find(r => {
    const dest = (r['Country / Destination'] || r['Destination'] || r['Country'] || '').toLowerCase().trim()
    return dest === raw
  })
  if (found) return found

  // 2. Normalized match (alphanumeric only)
  found = records.find(r => {
    const dest = normalizeStr(r['Country / Destination'] || r['Destination'] || r['Country'] || '')
    return dest === norm
  })
  if (found) return found

  // 3. Alias dictionary check
  const aliasCandidates = [raw, ...(COUNTRY_ALIASES[raw] || [])]
  for (const alias of aliasCandidates) {
    const aliasNorm = normalizeStr(alias)
    found = records.find(r => {
      const dest = (r['Country / Destination'] || r['Destination'] || r['Country'] || '').toLowerCase()
      const destNorm = normalizeStr(dest)
      return destNorm === aliasNorm || destNorm.startsWith(aliasNorm) || aliasNorm.startsWith(destNorm)
    })
    if (found) return found
  }

  // 4. Substring / startsWith match
  found = records.find(r => {
    const dest = normalizeStr(r['Country / Destination'] || r['Destination'] || r['Country'] || '')
    return dest.includes(norm) || norm.includes(dest)
  })

  return found || null
}

/**
 * CALCULATE RATE FROM EXCEL RATE SHEET
 * Sets inputs in C4 (Country), C5 (Service Code), C6 (Weight), C7 (Postcode)
 * and retrieves the calculated vendor rate from C10.
 */
export async function calculateRateFromExcelSheet({
  vendor_code,
  country,
  service_code,
  weight,
  postcode
}) {
  const weightNum = parseFloat(weight)
  if (isNaN(weightNum) || weightNum <= 0) {
    return {
      success: false,
      message: `Invalid shipment weight: "${weight}". Weight must be a positive number.`
    }
  }

  if (!country || !country.trim()) {
    return {
      success: false,
      message: 'Destination country is required for rate calculation.'
    }
  }

  // 1. Load the Excel workbook
  const wbInfo = getWorkbookPathForVendor(vendor_code)
  if (!wbInfo || !fs.existsSync(wbInfo.path)) {
    return {
      success: false,
      message: `Rate sheet not found for vendor "${vendor_code || 'default'}"`
    }
  }

  const wb = XLSX.readFile(wbInfo.path, { cellFormula: true, cellStyles: true })
  const firstSheetName = wb.SheetNames[0]
  const ws = wb.Sheets[firstSheetName]

  // 2. Find matching destination & service in tariff records
  const tariffSheet = wb.Sheets['_RateData'] || wb.Sheets['Self Network'] || wb.Sheets['Rates'] || wb.Sheets[wb.SheetNames[1]] || ws
  const records = XLSX.utils.sheet_to_json(tariffSheet)

  // Filter records by service if provided
  let filteredRecords = records
  if (service_code && service_code.trim()) {
    const svcClean = service_code.trim().toLowerCase()
    const svcMatches = records.filter(r => {
      const s = (r['Service Code'] || r['SERVICE CODE'] || r['Service'] || '').toLowerCase().trim()
      return s === svcClean || s.includes(svcClean) || svcClean.includes(s)
    })
    if (svcMatches.length > 0) {
      filteredRecords = svcMatches
    }
  }

  const matchedRow = resolveDestinationMatch(country, filteredRecords) || resolveDestinationMatch(country, records)

  const matchedCountry = matchedRow
    ? (matchedRow['Country / Destination'] || matchedRow['Destination'] || matchedRow['Country'])
    : country.trim()

  const matchedService = matchedRow
    ? (matchedRow['Service Code'] || matchedRow['SERVICE CODE'] || matchedRow['Service'] || service_code || 'PXC-SELF')
    : (service_code || 'PXC-SELF')

  // 3. Put inputs into cells C4, C5, C6, C7 of the first sheet (Rate Calculator)
  ws['C4'] = { t: 's', v: matchedCountry, w: String(matchedCountry) }
  ws['C5'] = { t: 's', v: matchedService, w: String(matchedService) }
  ws['C6'] = { t: 'n', v: weightNum, w: String(weightNum) }
  ws['C7'] = { t: 's', v: (postcode || '').trim(), w: String(postcode || '') }

  let calculatedRate = null
  let rateBasis = ''
  let ratePerKg = 0
  let sourceRow = matchedRow ? (matchedRow['Source Sheet Row'] || null) : null
  let transitTime = matchedRow ? (matchedRow['Transit Time Ex-BOM'] || matchedRow['Transit Time'] || '') : ''

  // 4. If C10 has an Excel formula, evaluate using xlsx-calc
  if (ws['C10']?.f) {
    try {
      xlsxCalc(wb)
      if (typeof ws['C10'].v === 'number' && !isNaN(ws['C10'].v) && ws['C10'].v > 0) {
        calculatedRate = ws['C10'].v
        rateBasis = ws['C11']?.v || `Excel formula evaluated: ${ws['C10'].f}`
      }
    } catch (calcErr) {
      console.warn('xlsxCalc formula evaluation notice:', calcErr.message)
    }
  }

  // 5. If C10 was not computed by formula (like in Pacific Rates.xlsx), calculate via tariff sheet logic
  if (calculatedRate === null || calculatedRate === undefined || isNaN(calculatedRate)) {
    if (matchedRow) {
      const first500 = Number(matchedRow['First 500g'] || matchedRow['500 Gms'] || matchedRow['Base Rate'] || 0)
      const addl500 = Number(matchedRow['Additional 500g'] || matchedRow['Addl 500 Gms'] || matchedRow['Addl 500g'] || 0)

      if (weightNum <= 0.5) {
        calculatedRate = first500
        rateBasis = `First 500g: ₹${first500.toFixed(2)}`
      } else if (weightNum < 6) {
        const addlUnits = Math.ceil((weightNum - 0.5) / 0.5)
        calculatedRate = first500 + (addlUnits * addl500)
        rateBasis = `First 500g (₹${first500}) + ${addlUnits} × Addl 500g (₹${addl500}) = ₹${calculatedRate.toFixed(2)}`
      } else {
        // 6kg and above: per kg tariff tier
        let slabRate = Number(matchedRow['Rate 71kg+'] || matchedRow['71 Kg++'] || 0)

        if (weightNum < 11) {
          slabRate = Number(matchedRow['Rate 6kg+'] || matchedRow['6kg++'] || slabRate)
        } else if (weightNum < 21) {
          slabRate = Number(matchedRow['Rate 11kg+'] || matchedRow['11 Kg++'] || slabRate)
        } else if (weightNum < 31) {
          slabRate = Number(matchedRow['Rate 21kg+'] || matchedRow['21 Kg++'] || slabRate)
        } else if (weightNum < 51) {
          slabRate = Number(matchedRow['Rate 31kg+'] || matchedRow['31 Kg++'] || slabRate)
        } else if (weightNum < 71) {
          slabRate = Number(matchedRow['Rate 51kg+'] || matchedRow['51 Kg++'] || slabRate)
        }

        if (slabRate > 0) {
          ratePerKg = slabRate
          calculatedRate = Math.round(slabRate * weightNum * 100) / 100
          rateBasis = `${weightNum} kg @ ₹${slabRate}/kg = ₹${calculatedRate.toFixed(2)}`
        } else {
          // Fallback if no slab rate
          calculatedRate = first500 + Math.ceil((weightNum - 0.5) / 0.5) * addl500
          rateBasis = `Base tier fallback: ₹${calculatedRate.toFixed(2)}`
        }
      }
    } else {
      return {
        success: false,
        message: `Destination "${country}" not found in vendor rate sheet (${path.basename(wbInfo.path)})`
      }
    }
  }

  // 6. Write final computed rate to cell C10 (and helper cells C9, C11, C12)
  ws['C9'] = { t: 's', v: String(matchedService), w: String(matchedService) }
  ws['C10'] = { t: 'n', v: Number(calculatedRate), w: String(calculatedRate) }
  ws['C11'] = { t: 's', v: String(rateBasis), w: String(rateBasis) }
  if (sourceRow) {
    ws['C12'] = { t: 'n', v: Number(sourceRow), w: String(sourceRow) }
  }

  return {
    success: true,
    vendor_code: wbInfo.code,
    sheet_filename: path.basename(wbInfo.path),
    first_tab: firstSheetName,
    inputs: {
      c4_country: ws['C4'].v,
      c5_service_code: ws['C5'].v,
      c6_weight: ws['C6'].v,
      c7_postcode: ws['C7'].v
    },
    output: {
      c10_calculated_vendor_rate: Number(ws['C10'].v),
      c9_matched_service: ws['C9']?.v || matchedService,
      c11_rate_basis: ws['C11']?.v || rateBasis,
      c12_source_row: ws['C12']?.v || sourceRow
    },
    vendor_rate: Number(ws['C10'].v),
    shipping_charge: Number(ws['C10'].v),
    rate_per_kg: ratePerKg > 0 ? ratePerKg : null,
    matched_country: ws['C4'].v,
    matched_service: ws['C9']?.v || matchedService,
    rate_basis: ws['C11']?.v || rateBasis,
    transit_time: transitTime,
    currency: 'INR'
  }
}
