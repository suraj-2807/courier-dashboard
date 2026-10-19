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
  'united kingdom': ['u.k.', 'uk', 'gbr', 'great britain', 'england', 'u.k. (dutypaid)', 'u.k. (express)'],
  'uk': ['u.k.', 'united kingdom', 'gbr', 'great britain'],
  'u.k.': ['united kingdom', 'uk', 'gbr', 'great britain'],
  'united states': ['u.s.a.', 'usa', 'united states of america', 'us', 'usa self ddp', 'usa self ddu'],
  'united states of america': ['u.s.a.', 'usa', 'united states', 'us'],
  'usa': ['u.s.a.', 'united states', 'united states of america', 'us'],
  'u.s.a.': ['united states', 'usa', 'united states of america', 'us'],
  'saudi arabia': ['ksa', 'saudi', 'sau', 'saudi arabia (resumed)'],
  'kuwait': ['kwt', 'kuwait (service temporarily suspended)'],
  'new zealand': ['nz', 'nzl', 'new zealand ddp'],
  'australia': ['aus', 'express australia - dtdc'],
  'canada': ['can'],
  'singapore': ['sin', 'sgp', 'singapore (foodstuff max 5kg)'],
  'hong kong': ['hk', 'hkg'],
  'malaysia': ['mys', 'mas'],
  'south africa': ['zaf', 'south africa (ddp)', 'south africa(duty paid)'],
  'sri lanka': ['lka', 'srilanka', 'srilanka (duty paid)'],
  'kenya': ['kenya(duty paid)', 'kenya ddu(no receipt)'],
  'tanzania': ['tanzania (duty paid)', 'tanzania(dar es salaam)', 'tanzania (other / rest)'],
  'uganda': ['uganda (dutypaid)', 'uganda(duty paid)'],
  'zimbabwe': ['zimbabwe (dutypaid)']
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
 * Create a clean blank starter workbook for vendors without an uploaded sheet
 */
export function createBlankVendorWorkbook(vendorCode, vendorName) {
  const calcRows = [
    ['RATE CALCULATOR', '', '', ''],
    ['Input Parameters', '', 'Values', ''],
    ['', '', '', ''],
    ['', 'Country / Destination', '', ''],
    ['', 'Service Code', '', ''],
    ['', 'Weight (kg)', '', ''],
    ['', 'Postcode / State', '', ''],
    ['', '', '', ''],
    ['', 'Matched Service', '', ''],
    ['', 'Calculated Vendor Rate (INR)', '', ''],
    ['', 'Rate Basis', '', '']
  ]
  const tariffRows = [
    ['Country', 'Service', 'Zone', '0.5 Kg', '1.0 Kg', 'Addl 0.5 Kg', 'Per Kg Rate'],
    ...Array.from({ length: 25 }, () => Array(7).fill(''))
  ]
  return [
    { name: 'Rate Calculator', rows: calcRows },
    { name: 'Tariff Rates', rows: tariffRows }
  ]
}

/**
 * Resolve workbook file path for a vendor code.
 * Searches:
 * 1. Uploaded rate sheet in uploads/vendor_rate_sheets/${code}.xlsx
 * 2. Registry path
 * 3. Matching file in src/assets/ (e.g. FlySwift_Rates_with_Pacific_Layout.xlsx, Pacific Rates.xlsx)
 * 4. Default Pacific fallback
 */
export function getWorkbookPathForVendor(vendorCode) {
  const code = (vendorCode || 'pacific').toLowerCase().trim()
  const customPath = path.resolve(UPLOADS_DIR, `${code}.xlsx`)

  if (fs.existsSync(customPath)) {
    return { path: customPath, isDefault: false, code }
  }

  const registry = readRegistry()
  if (registry[code]?.filepath && fs.existsSync(registry[code].filepath)) {
    return { path: registry[code].filepath, isDefault: false, code }
  }

  // Scan ASSETS_DIR for matching vendor file
  if (fs.existsSync(ASSETS_DIR)) {
    const assetFiles = fs.readdirSync(ASSETS_DIR)
    const matched = assetFiles.find(f => {
      const fLower = f.toLowerCase()
      if (!fLower.endsWith('.xlsx')) return false
      const base = fLower.replace(/\.xlsx$/, '').replace(/[^a-z0-9]/g, '')
      const codeNorm = code.replace(/[^a-z0-9]/g, '')
      return base === codeNorm || base.startsWith(codeNorm) || base.includes(codeNorm) || codeNorm.includes(base)
    })
    if (matched) {
      return { path: path.resolve(ASSETS_DIR, matched), isDefault: code.includes('pacific'), code }
    }
  }

  // Fallback for Pacific
  if (code === 'pacific' || code === 'pc' || code === 'pxc' || code.includes('pacific')) {
    if (fs.existsSync(DEFAULT_PACIFIC_PATH)) {
      return { path: DEFAULT_PACIFIC_PATH, isDefault: true, code: 'pacific' }
    }
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
 * Map 3-digit US ZIP prefix to 2-letter state code covering all 50 US states and DC.
 */
export function resolveZipToState(zip) {
  if (!zip) return null
  const clean = String(zip).trim().replace(/\D/g, '')
  if (clean.length < 3) return null
  const p = parseInt(clean.slice(0, 3), 10)
  if (isNaN(p)) return null

  if (p >= 10 && p <= 27) return 'MA'
  if (p >= 28 && p <= 29) return 'RI'
  if (p >= 30 && p <= 38) return 'NH'
  if (p >= 39 && p <= 49) return 'ME'
  if (p >= 50 && p <= 59) return 'VT'
  if (p >= 60 && p <= 69) return 'CT'
  if (p >= 70 && p <= 89) return 'NJ'
  if (p >= 100 && p <= 149) return 'NY'
  if (p >= 150 && p <= 196) return 'PA'
  if (p >= 197 && p <= 199) return 'DE'
  if (p >= 200 && p <= 205) return 'DC'
  if (p >= 206 && p <= 219) return 'MD'
  if (p >= 220 && p <= 246) return 'VA'
  if (p >= 247 && p <= 268) return 'WV'
  if (p >= 270 && p <= 289) return 'NC'
  if (p >= 290 && p <= 299) return 'SC'
  if (p >= 300 && p <= 319) return 'GA'
  if (p >= 320 && p <= 349) return 'FL'
  if (p >= 350 && p <= 369) return 'AL'
  if (p >= 370 && p <= 385) return 'TN'
  if (p >= 386 && p <= 397) return 'MS'
  if (p >= 400 && p <= 427) return 'KY'
  if (p >= 430 && p <= 459) return 'OH'
  if (p >= 460 && p <= 479) return 'IN'
  if (p >= 480 && p <= 499) return 'MI'
  if (p >= 500 && p <= 528) return 'IA'
  if (p >= 530 && p <= 549) return 'WI'
  if (p >= 550 && p <= 567) return 'MN'
  if (p >= 570 && p <= 577) return 'SD'
  if (p >= 580 && p <= 588) return 'ND'
  if (p >= 590 && p <= 599) return 'MT'
  if (p >= 600 && p <= 629) return 'IL'
  if (p >= 630 && p <= 658) return 'MO'
  if (p >= 660 && p <= 679) return 'KS'
  if (p >= 680 && p <= 693) return 'NE'
  if (p >= 700 && p <= 714) return 'LA'
  if (p >= 716 && p <= 729) return 'AR'
  if (p >= 730 && p <= 749) return 'OK'
  if (p >= 750 && p <= 799) return 'TX'
  if (p >= 800 && p <= 816) return 'CO'
  if (p >= 820 && p <= 831) return 'WY'
  if (p >= 832 && p <= 838) return 'ID'
  if (p >= 840 && p <= 847) return 'UT'
  if (p >= 850 && p <= 865) return 'AZ'
  if (p >= 870 && p <= 884) return 'NM'
  if (p >= 889 && p <= 898) return 'NV'
  if (p >= 900 && p <= 961) return 'CA'
  if (p >= 967 && p <= 968) return 'HI'
  if (p >= 970 && p <= 979) return 'OR'
  if (p >= 980 && p <= 994) return 'WA'
  if (p >= 995 && p <= 999) return 'AK'

  return null
}

/**
 * Resolve a US state string (e.g. "CT", "California", "NY", "90210") to its Zone
 */
export function resolveUSStateToZone(stateInput, stateMap) {
  if (!stateInput || typeof stateInput !== 'string') return null
  let s = stateInput.trim().toUpperCase()

  // 1. Direct 2-letter abbreviation
  if (stateMap[s]) {
    return { state_code: s, zone: stateMap[s] }
  }

  // 2. Full name check
  const abbr = US_STATE_NAMES[s]
  if (abbr && stateMap[abbr]) {
    return { state_code: abbr, zone: stateMap[abbr] }
  }

  // 3. 5-digit Zip code resolution
  const cleanZip = s.replace(/\D/g, '')
  if (cleanZip.length >= 3) {
    const zipState = resolveZipToState(cleanZip)
    if (zipState && stateMap[zipState]) {
      return { state_code: zipState, zone: stateMap[zipState], zip: stateInput.trim() }
    }
  }

  // 4. Case-insensitive check
  for (const [k, v] of Object.entries(stateMap)) {
    if (k.toLowerCase() === stateInput.trim().toLowerCase()) {
      return { state_code: k, zone: v }
    }
  }

  return null
}

/**
 * Universal destination and service extractor.
 * Scans ANY vendor workbook (Pacific, FlySwift, DHL, FedEx, etc.) across:
 * - INDEX sheet (destinations, service codes, transit times)
 * - Main tariff sheets (Self Network, Self, Tariff Rates, Rates)
 * - Country-specific sheets (AUS DTDC, NZ Self, USA DDU, USA DDP, MUM YYZ DDP, etc.)
 * - Dropdown lists / data validation
 */
export function extractCleanDestinations(wbOrSheet) {
  // If a single worksheet is passed, wrap it in a mock workbook
  const wb = wbOrSheet && wbOrSheet.SheetNames
    ? wbOrSheet
    : { SheetNames: ['Sheet1'], Sheets: { Sheet1: wbOrSheet } }

  const destinationMap = new Map()
  const allServices = new Set()

  function normalizeCountryName(rawCountry) {
    let c = String(rawCountry || '').trim()
    if (!c) return ''
    const lower = c.toLowerCase()

    // Normalize known vendor destination strings
    if (lower.includes('australia') || lower === 'aus') return 'Australia'
    if (lower.includes('new zealand') || lower === 'nz') return 'New Zealand'
    if (lower.includes('united states') || lower === 'usa' || lower === 'u.s.a.' || lower.startsWith('usa ')) return 'United States'
    if (lower.includes('canada') || lower === 'can' || lower.includes('yyz') || lower.includes('yvr')) return 'Canada'
    if (lower.includes('united kingdom') || lower === 'uk' || lower === 'u.k.' || lower.startsWith('u.k.')) return 'United Kingdom'
    if (lower.includes('united arab emirates') || lower === 'uae' || lower === 'u.a.e.') return 'U.A.E.'
    if (lower.includes('saudi arabia')) return 'Saudi Arabia'
    if (lower.includes('south africa')) return 'South Africa'
    if (lower.includes('hong kong')) return 'Hong Kong'

    // Clean parentheses that contain notes or redundant service indicators
    if (c.includes('(')) {
      const base = c.split('(')[0].trim()
      if (base.length >= 3 && !/note|wef|rate|zone/i.test(base)) {
        return base
      }
    }

    return c
  }

  function addEntry(country, svc, meta = {}) {
    if (!country) return
    const cleanCountry = String(country).trim()
    if (cleanCountry.length < 2 || cleanCountry.length > 80) return

    const lower = cleanCountry.toLowerCase()
    // Skip labels, headers, weight intervals, notes
    if (
      lower === 'country' ||
      lower === 'destination' ||
      lower === 'destinations' ||
      lower === 'destination / country' ||
      lower === 'country / destination' ||
      lower === 'service_code' ||
      lower === 'service code' ||
      lower === 'service' ||
      lower === 'sr no' ||
      lower === 'sr no.' ||
      lower === 'sr. no.' ||
      lower === 'sl no' ||
      lower === 'notes' ||
      lower === 'note' ||
      lower === 'zone' ||
      lower === 'self' ||
      lower === 'self dutypaid' ||
      lower.startsWith('note') ||
      lower.includes('per box') ||
      lower.includes(':') ||
      lower.includes('extra') ||
      lower.includes('reconnection') ||
      lower.includes('rate calculator') ||
      lower.includes('zone chart') ||
      lower.includes('below rates') ||
      lower.includes('transit time') ||
      lower.includes('operation') ||
      lower.includes('charges') ||
      lower.includes('filing facility') ||
      lower.includes('foodstuff') ||
      lower.includes('wef ') ||
      /^\d/.test(cleanCountry) ||
      cleanCountry === '-'
    ) {
      return
    }

    const normCountry = normalizeCountryName(cleanCountry)
    if (!normCountry || normCountry.length < 2) return
    const normKey = normCountry.toLowerCase()

    if (!destinationMap.has(normKey)) {
      const isUSA = normKey.includes('united states') || normKey === 'usa'
      const isAus = normKey.includes('australia')
      const isNZ = normKey.includes('new zealand')
      const isCan = normKey.includes('canada')

      destinationMap.set(normKey, {
        country: normCountry,
        services: new Set(),
        requires_state: isUSA || meta.requires_state || false,
        requires_postcode: isAus || isNZ || isCan || meta.requires_postcode || false,
        transit_time: meta.transit_time || ''
      })
    }

    const rec = destinationMap.get(normKey)
    if (svc && String(svc).trim()) {
      const cleanSvc = String(svc).trim()
      const lowerSvc = cleanSvc.toLowerCase()
      if (
        lowerSvc !== 'service_code' &&
        lowerSvc !== 'service code' &&
        lowerSvc !== 'service' &&
        lowerSvc !== 'country' &&
        lowerSvc !== 'destination'
      ) {
        rec.services.add(cleanSvc)
        allServices.add(cleanSvc)
      }
    }
    if (meta.transit_time && !rec.transit_time) {
      rec.transit_time = meta.transit_time
    }
  }

  // 1. Scan INDEX sheet if present (FlySwift, etc.)
  if (wb.Sheets['INDEX']) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['INDEX'], { header: 1 })
    let headerRow = -1
    let destCol = -1
    let svcCol = -1
    let transitCol = -1

    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = rows[r] || []
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toUpperCase()
        if (val.includes('DESTINATION')) destCol = c
        if (val.includes('SERVICE CODE') || val.includes('SERVICE_CODE')) svcCol = c
        if (val.includes('TRANSIT TIME')) transitCol = c
      }
      if (destCol !== -1 && svcCol !== -1) {
        headerRow = r
        break
      }
    }

    if (headerRow !== -1) {
      for (let r = headerRow + 1; r < rows.length; r++) {
        const row = rows[r] || []
        const dest = row[destCol]
        const svc = row[svcCol]
        const transit = transitCol !== -1 ? row[transitCol] : ''
        if (dest && typeof dest === 'string' && !dest.toUpperCase().includes('NOTES')) {
          addEntry(dest, svc, { transit_time: transit && transit !== '-' ? String(transit).trim() : '' })
        }
      }
    }
  }

  // 2. Scan standard tariff sheets (Self Network, Self, Tariff Rates, Rates)
  const tariffSheetNames = ['Self Network', 'Self', 'Tariff Rates', 'Rates', 'Rate Sheet', 'Tariff']
  for (const tName of tariffSheetNames) {
    if (!wb.Sheets[tName]) continue
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[tName], { header: 1 })
    if (!rows || rows.length < 2) continue

    let headerIdx = -1
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const rowStr = JSON.stringify(rows[r] || '').toLowerCase()
      if (rowStr.includes('500') || rowStr.includes('kg') || rowStr.includes('destination')) {
        headerIdx = r
        break
      }
    }

    const startR = headerIdx >= 0 ? headerIdx + 1 : 1
    let currentSvc = ''

    for (let r = startR; r < rows.length; r++) {
      const row = rows[r] || []
      if (!row || row.length < 2) continue

      const colA = String(row[0] || '').trim()
      const colB = String(row[1] || '').trim()

      if (!colB || colB.length < 2) continue
      if (colA && colA.length >= 2 && !colA.toLowerCase().includes('note') && !colA.toLowerCase().includes('charge')) {
        currentSvc = colA
      }

      addEntry(colB, currentSvc)
    }
  }

  // 3. Scan country-specific sheets
  for (const sName of wb.SheetNames) {
    const lower = sName.toLowerCase()
    // Skip auxiliary and lookup sheets
    if (
      lower.includes('calc') ||
      lower.includes('index') ||
      lower.includes('zone') ||
      lower.includes('remote') ||
      lower.includes('guide') ||
      lower.includes('list') ||
      lower.includes('data')
    ) {
      continue
    }

    if (lower.includes('aus') || lower.includes('australia')) {
      addEntry('Australia', 'AUS_DTDC')
    } else if (lower.includes('nz') || lower.includes('new zealand')) {
      addEntry('New Zealand', 'NZ_SELF')
    } else if (lower.includes('usa') || lower.includes('us ')) {
      addEntry('United States', lower.includes('ddp') ? 'USA_GROUND' : 'USA_DDU')
    } else if (lower.includes('yyz') || lower.includes('yvr') || lower.includes('canada')) {
      addEntry('Canada', sName)
    }
  }

  // 4. Scan _CalcLists if present
  if (wb.Sheets['_CalcLists']) {
    const listRows = XLSX.utils.sheet_to_json(wb.Sheets['_CalcLists'], { header: 1 })
    for (const r of listRows) {
      const val = String(r[0] || '').trim()
      if (val && !val.includes('=')) {
        if (val.includes('_') || val.includes('-') || val === val.toUpperCase()) {
          allServices.add(val)
        }
      }
    }
  }

  // Convert destination map to sorted array
  const result = []
  destinationMap.forEach(val => {
    result.push({
      country: val.country,
      services: Array.from(val.services),
      requires_state: val.requires_state,
      requires_postcode: val.requires_postcode,
      transit_time: val.transit_time
    })
  })

  result.sort((a, b) => a.country.localeCompare(b.country))
  return result
}

/**
 * Dynamically detect the Rate Calculator layout, sheet name, and exact cell coordinates.
 * Handles ANY vendor Excel sheet (Pacific, FlySwift, DHL, custom vendor uploads) without hardcoded rows.
 */
export function detectCalculatorLayout(wb) {
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) return null

  // 1. Locate Rate Calculator sheet
  let targetSheetName = wb.SheetNames.find(s => {
    const l = s.toLowerCase()
    return l.includes('rate calc') || l.includes('calculator') || l.includes('pricing') || l.includes('quote')
  })

  if (!targetSheetName) targetSheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[targetSheetName]
  if (!sheet) return null

  // Default baseline mapping
  const mapping = {
    sheet_name: targetSheetName,
    dest_label_cell: 'B4',
    dest_input_cell: 'C4',
    dest_label: 'Country / Destination',
    c4_default: '',

    service_label_cell: 'B5',
    service_input_cell: 'C5',
    service_label: 'Service Code',
    c5_default: '',

    weight_label_cell: 'B6',
    weight_input_cell: 'C6',
    weight_label: 'Weight (kg)',
    c6_default: 1,

    postcode_label_cell: 'B7',
    postcode_input_cell: 'C7',
    postcode_label: 'Postcode / State (if required)',
    c7_default: '',

    matched_svc_label_cell: 'B9',
    matched_svc_output_cell: 'C9',
    matched_svc_label: 'Matched Service',

    rate_label_cell: 'B10',
    rate_output_cell: 'C10',
    rate_label: 'Calculated Vendor Rate (INR)',

    rate_basis_label_cell: 'B11',
    rate_basis_cell: 'C11',
    rate_basis_label: 'Rate Basis',

    source_row_label_cell: 'B12',
    source_row_cell: 'C12',
    source_row_label: 'Source Sheet Row'
  }

  const colLetters = ['A', 'B', 'C', 'D']
  let foundDest = false
  let foundService = false
  let foundWeight = false
  let foundPostcode = false
  let foundRate = false

  // Scan rows 1 through 30 for dynamic field placements
  for (let r = 1; r <= 30; r++) {
    for (let cIdx = 0; cIdx < colLetters.length; cIdx++) {
      const col = colLetters[cIdx]
      const nextCol = colLetters[cIdx + 1] || 'C'
      const cellRef = `${col}${r}`
      const val = sheet[cellRef]?.v
      if (!val || typeof val !== 'string') continue
      const str = val.trim()
      const lower = str.toLowerCase()

      if (lower.includes('rate calculator') || lower.includes('choose destination') || lower.includes('select the')) continue

      // Destination / Country check
      if (!foundDest && (lower.includes('country') || lower.includes('destination') || lower === 'dest') && !lower.includes('rate') && !lower.includes('valid')) {
        mapping.dest_label_cell = cellRef
        mapping.dest_input_cell = `${nextCol}${r}`
        mapping.dest_label = str
        const defaultVal = sheet[`${nextCol}${r}`]?.v
        if (defaultVal) mapping.c4_default = String(defaultVal).trim()
        foundDest = true
        continue
      }

      // Service Code check
      if (!foundService && (lower.includes('service') || lower.includes('service code') || lower.includes('service_code') || lower === 'svc') && !lower.includes('charge') && !lower.includes('matched')) {
        mapping.service_label_cell = cellRef
        mapping.service_input_cell = `${nextCol}${r}`
        mapping.service_label = str
        const defaultVal = sheet[`${nextCol}${r}`]?.v
        if (defaultVal) mapping.c5_default = String(defaultVal).trim()
        foundService = true
        continue
      }

      // Weight check
      if (!foundWeight && (lower.includes('weight') || lower.includes('(kg)') || lower.includes('kgs')) && !lower.includes('basis') && !lower.includes('matched')) {
        mapping.weight_label_cell = cellRef
        mapping.weight_input_cell = `${nextCol}${r}`
        mapping.weight_label = str
        const defaultVal = sheet[`${nextCol}${r}`]?.v
        if (defaultVal !== undefined) mapping.c6_default = defaultVal
        foundWeight = true
        continue
      }

      // Postcode / State / Zone check
      if (!foundPostcode && (lower.includes('postcode') || lower.includes('state') || lower.includes('zip') || lower.includes('zone')) && !lower.includes('chart') && !lower.includes('list')) {
        mapping.postcode_label_cell = cellRef
        mapping.postcode_input_cell = `${nextCol}${r}`
        mapping.postcode_label = str
        const defaultVal = sheet[`${nextCol}${r}`]?.v
        if (defaultVal) mapping.c7_default = String(defaultVal).trim()
        foundPostcode = true
        continue
      }

      // Calculated Rate Output check
      if (!foundRate && (lower.includes('calculated vendor rate') || lower.includes('vendor rate') || lower.includes('calculated rate') || lower.includes('final rate') || lower.includes('total rate') || lower === 'rate (inr)')) {
        mapping.rate_label_cell = cellRef
        mapping.rate_output_cell = `${nextCol}${r}`
        mapping.rate_label = str
        foundRate = true
        continue
      }

      if (lower.includes('matched service')) {
        mapping.matched_svc_label_cell = cellRef
        mapping.matched_svc_output_cell = `${nextCol}${r}`
        mapping.matched_svc_label = str
      }

      if (lower.includes('rate basis')) {
        mapping.rate_basis_label_cell = cellRef
        mapping.rate_basis_cell = `${nextCol}${r}`
        mapping.rate_basis_label = str
      }
    }
  }

  // Backward-compatible keys for frontend
  mapping.b4_label = mapping.dest_label
  mapping.b5_label = mapping.service_label
  mapping.b6_label = mapping.weight_label
  mapping.b7_label = mapping.postcode_label
  mapping.b9_label = mapping.matched_svc_label
  mapping.b10_label = mapping.rate_label
  mapping.b11_label = mapping.rate_basis_label
  mapping.b12_label = mapping.source_row_label

  return mapping
}

/**
 * Get sheet info, valid destinations, and US state options.
 * Dynamically adapts to ANY vendor's Excel sheet.
 */
export function getVendorSheetDetails(vendorCode) {
  const wbInfo = getWorkbookPathForVendor(vendorCode)
  if (!wbInfo || !fs.existsSync(wbInfo.path)) {
    const code = (vendorCode || '').toLowerCase().trim()
    return {
      success: true,
      has_sheet: false,
      is_blank: true,
      vendor_code: code,
      filename: null,
      is_default: false,
      sheets: [],
      destinations: [],
      all_services: [],
      state_options: [],
      calculator: null
    }
  }

  const wb = XLSX.readFile(wbInfo.path)
  const firstSheetName = wb.SheetNames[0]
  const firstSheet = wb.Sheets[firstSheetName]

  // Extract destinations dynamically from the workbook
  const destinations = extractCleanDestinations(wb)

  // Collect all unique services
  const allServices = new Set()
  destinations.forEach(d => d.services.forEach(s => allServices.add(s)))

  // Also check _CalcLists
  if (wb.Sheets['_CalcLists']) {
    const cRows = XLSX.utils.sheet_to_json(wb.Sheets['_CalcLists'], { header: 1 })
    cRows.forEach(r => {
      const val = String(r[0] || '').trim()
      if (val && !val.includes('=')) allServices.add(val)
    })
  }

  // Extract USA state to zone map if available
  const stateSheet = wb.Sheets['Self Network'] || wb.Sheets['USA DDU'] || firstSheet
  const stateMap = getUSAStateToZoneMap(stateSheet)

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

  // Template defaults from Rate Calculator tab dynamically detected
  const calculatorTemplate = detectCalculatorLayout(wb)

  return {
    success: true,
    has_sheet: true,
    is_blank: false,
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
 * Get all vendors available on the portal with rate sheet status.
 * Automatically scans ASSETS_DIR and UPLOADS_DIR to detect all vendor sheets.
 */
export function getVendorsRateSheetStatus(portalVendors = []) {
  const registry = readRegistry()

  // 1. Auto-discover known sheets in ASSETS_DIR and UPLOADS_DIR
  if (fs.existsSync(ASSETS_DIR)) {
    const assetFiles = fs.readdirSync(ASSETS_DIR)
    for (const af of assetFiles) {
      if (!af.toLowerCase().endsWith('.xlsx')) continue
      const afPath = path.resolve(ASSETS_DIR, af)
      let vCode = 'pacific'
      let vName = 'Pacific Express'

      if (af.toLowerCase().includes('flyswift')) {
        vCode = 'flyswift'
        vName = 'FlySwift'
      } else if (af.toLowerCase().includes('pacific')) {
        vCode = 'pacific'
        vName = 'Pacific Express'
      } else {
        vCode = af.toLowerCase().replace(/\.xlsx$/, '').replace(/[^a-z0-9]/g, '')
        vName = vCode.toUpperCase()
      }

      if (!registry[vCode]) {
        try {
          const wb = XLSX.readFile(afPath)
          const dests = extractCleanDestinations(wb)
          registry[vCode] = {
            vendor_code: vCode,
            vendor_name: vName,
            filename: af,
            filepath: afPath,
            is_default: vCode === 'pacific',
            sheets: wb.SheetNames,
            destinations_count: dests.length,
            services_count: 10,
            uploaded_at: fs.statSync(afPath).mtime
          }
        } catch (e) {
          console.warn(`Failed reading asset sheet ${af}:`, e.message)
        }
      }
    }
  }

  // 2. Scan UPLOADS_DIR
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploadFiles = fs.readdirSync(UPLOADS_DIR)
    for (const uf of uploadFiles) {
      if (!uf.toLowerCase().endsWith('.xlsx')) continue
      const uCode = uf.toLowerCase().replace(/\.xlsx$/, '')
      if (!registry[uCode]) {
        try {
          const uPath = path.resolve(UPLOADS_DIR, uf)
          const wb = XLSX.readFile(uPath)
          const dests = extractCleanDestinations(wb)
          registry[uCode] = {
            vendor_code: uCode,
            vendor_name: uCode.toUpperCase(),
            filename: uf,
            filepath: uPath,
            is_default: false,
            sheets: wb.SheetNames,
            destinations_count: dests.length,
            services_count: 5,
            uploaded_at: fs.statSync(uPath).mtime
          }
        } catch (e) {
          console.warn(`Failed reading uploaded sheet ${uf}:`, e.message)
        }
      }
    }
  }

  writeRegistry(registry)

  const resultVendors = []
  const seenCodes = new Set()

  // Match portal vendors
  for (const pv of portalVendors) {
    const code = (pv.vendor_code || pv.name || '').toLowerCase().trim()
    const reg = registry[code] || (code.includes('pacific') ? registry['pacific'] : null) || (code.includes('flyswift') ? registry['flyswift'] : null)
    seenCodes.add(code)

    resultVendors.push({
      id: pv.id || code,
      name: pv.name || pv.vendor_code,
      vendor_code: pv.vendor_code || code,
      has_sheet: !!reg,
      sheet_filename: reg?.filename || null,
      sheets: reg?.sheets || [],
      destinations_count: reg?.destinations_count || 0,
      services_count: reg?.services_count || 0,
      uploaded_at: reg?.uploaded_at || null,
      is_default: reg?.is_default || false,
      available_services: pv.available_services || []
    })
  }

  // Include any registered vendors not yet in portalVendors
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

  // Parse uploaded file
  let wb
  try {
    wb = XLSX.read(fileBuffer, { type: 'buffer', cellFormula: true, cellStyles: true })
  } catch (err) {
    fs.writeFileSync(targetPath, fileBuffer)
    wb = XLSX.readFile(targetPath)
  }

  // Check if workbook contains a dedicated Rate Calculator sheet
  const hasCalc = wb.SheetNames.some(s => {
    const l = s.toLowerCase()
    return l.includes('rate calc') || l.includes('calculator') || l.includes('pricing') || l.includes('quote')
  })

  // If no dedicated calculator tab exists (e.g. pure tariff rate sheet), prepend a standardized Rate Calculator sheet
  if (!hasCalc) {
    const destinations = extractCleanDestinations(wb)
    const defaultCountry = destinations[0]?.country || 'United States'
    const defaultService = destinations[0]?.services?.[0] || 'STANDARD'

    const calcRows = [
      ['RATE CALCULATOR', '', '', ''],
      ['Choose destination, service and weight. Evaluated live from the vendor tariff.', '', '', ''],
      ['', '', '', ''],
      ['', 'Country / Destination', defaultCountry, ''],
      ['', 'Service Code', defaultService, ''],
      ['', 'Weight (kg)', 1, ''],
      ['', 'Postcode / State (if required)', '', ''],
      ['', '', '', ''],
      ['', 'Matched Service', defaultService, ''],
      ['', 'Calculated Vendor Rate (INR)', '', ''],
      ['', 'Rate Basis', '', ''],
      ['', 'Source Sheet Row', '', '']
    ]

    const calcSheet = XLSX.utils.aoa_to_sheet(calcRows)
    wb.SheetNames.unshift('Rate Calculator')
    wb.Sheets['Rate Calculator'] = calcSheet

    const outBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    fs.writeFileSync(targetPath, outBuffer)
  } else {
    fs.writeFileSync(targetPath, fileBuffer)
  }

  const destinations = extractCleanDestinations(wb)

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
 * Get complete workbook data (all sheets, rows, and cells) for browser viewing and editing
 */
export function getVendorWorkbookData(vendorCode) {
  const wbInfo = getWorkbookPathForVendor(vendorCode)
  if (!wbInfo || !fs.existsSync(wbInfo.path)) {
    const code = (vendorCode || '').toLowerCase().trim()
    const registry = readRegistry()
    const vName = registry[code]?.vendor_name || code.toUpperCase()
    return {
      success: true,
      has_sheet: false,
      is_blank: true,
      vendor_code: code,
      vendor_name: vName,
      filename: null,
      sheets: createBlankVendorWorkbook(code, vName)
    }
  }

  const wb = XLSX.readFile(wbInfo.path, { cellFormula: true, cellStyles: true })

  const sheets = wb.SheetNames.map(sheetName => {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    for (const cellRef of Object.keys(ws)) {
      if (cellRef[0] === '!') continue
      const cell = ws[cellRef]
      if (cell && cell.f) {
        const decoded = XLSX.utils.decode_cell(cellRef)
        if (rows[decoded.r] && rows[decoded.r][decoded.c] !== undefined) {
          rows[decoded.r][decoded.c] = `=${cell.f}`
        }
      }
    }

    let maxCols = 0
    rows.forEach(r => {
      if (Array.isArray(r) && r.length > maxCols) maxCols = r.length
    })

    return {
      name: sheetName,
      rows: rows.length > 0 ? rows : [['']],
      rowCount: rows.length,
      colCount: maxCols
    }
  })

  return {
    success: true,
    has_sheet: true,
    is_blank: false,
    vendor_code: wbInfo.code,
    filename: path.basename(wbInfo.path),
    is_default: wbInfo.isDefault,
    sheets
  }
}

/**
 * Save updated workbook sheets and cells from the browser editor directly to server
 */
export function saveVendorWorkbookData(vendorCode, sheetsData, vendorName = '') {
  const code = (vendorCode || 'pacific').toLowerCase().trim()
  const customPath = path.resolve(UPLOADS_DIR, `${code}.xlsx`)

  if (!sheetsData || !Array.isArray(sheetsData) || sheetsData.length === 0) {
    return {
      success: false,
      message: 'No sheets data provided for saving'
    }
  }

  const wb = XLSX.utils.book_new()

  for (const s of sheetsData) {
    const rawRows = (s.rows || [[]]).map(row => {
      if (!Array.isArray(row)) return []
      return row.map(cell => {
        if (cell === null || cell === undefined) return ''
        const str = String(cell).trim()
        if (str.startsWith('=')) return str
        if (str !== '' && !isNaN(Number(str)) && !str.startsWith('+') && !str.includes(':')) {
          return Number(str)
        }
        return cell
      })
    })

    const ws = XLSX.utils.aoa_to_sheet(rawRows)

    for (const cellRef of Object.keys(ws)) {
      if (cellRef[0] === '!') continue
      const cell = ws[cellRef]
      if (cell && typeof cell.v === 'string' && cell.v.startsWith('=')) {
        cell.f = cell.v.slice(1)
        cell.t = 'n'
        delete cell.v
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, s.name || 'Sheet')
  }

  XLSX.writeFile(wb, customPath)

  const destinations = extractCleanDestinations(wb)
  const registry = readRegistry()
  registry[code] = {
    vendor_code: code,
    vendor_name: vendorName || (registry[code]?.vendor_name || code.toUpperCase()),
    filename: `${code}.xlsx`,
    filepath: customPath,
    is_default: false,
    first_tab: wb.SheetNames[0],
    sheets: wb.SheetNames,
    destinations_count: destinations.length,
    uploaded_at: new Date().toISOString()
  }
  writeRegistry(registry)

  return {
    success: true,
    message: `Rate sheet for ${vendorName || code.toUpperCase()} successfully saved to server!`,
    vendor_code: code,
    filename: `${code}.xlsx`,
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
      return dNorm === candNorm || dNorm.startsWith(candNorm) || candNorm.startsWith(dNorm) || dNorm.includes(candNorm) || candNorm.includes(dNorm)
    })
    if (match) return match
  }

  return null
}

/**
 * Search all tariff sheets for a matching row for country and service
 */
function findTariffRowInWorkbook(wb, resolvedCountry, chosenService) {
  const normCountry = normalizeStr(resolvedCountry)
  const normSvc = normalizeStr(chosenService)

  // Candidate sheet names: tariff sheets first
  const sheetOrder = [
    'Self Network', 'Self', 'Tariff Rates', 'Rates', 'Rate Sheet', 'Tariff',
    ...wb.SheetNames.filter(s => !['Rate Calculator', '_CalcLists', 'INDEX'].includes(s))
  ]

  for (const sName of sheetOrder) {
    const ws = wb.Sheets[sName]
    if (!ws) continue

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
    if (!rows || rows.length < 2) continue

    let headerRow = -1
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const rStr = JSON.stringify(rows[r] || '').toLowerCase()
      if (rStr.includes('500') || rStr.includes('kg') || rStr.includes('addl')) {
        headerRow = r
        break
      }
    }

    const startR = headerRow >= 0 ? headerRow + 1 : 1
    const headers = headerRow >= 0 ? rows[headerRow] : rows[0]

    for (let r = startR; r < rows.length; r++) {
      const row = rows[r] || []
      if (!row || row.length < 3) continue

      // Skip title rows or rows where rate columns are not valid numbers
      const rateColVal = parseFloat(String(row[2] || '').replace(/[^0-9.]/g, ''))
      if (isNaN(rateColVal) || rateColVal <= 0) continue

      const colA = String(row[0] || '').trim()
      const colB = String(row[1] || '').trim()

      const matchCountry = normalizeStr(colB) === normCountry ||
        normalizeStr(colB).includes(normCountry) ||
        normCountry.includes(normalizeStr(colB))

      if (matchCountry) {
        if (normSvc) {
          const matchSvc = colA && (
            normalizeStr(colA) === normSvc ||
            normalizeStr(colA).includes(normSvc) ||
            normSvc.includes(normalizeStr(colA))
          )
          if (matchSvc) {
            return { sheetName: sName, rowIdx: r, row, headers }
          }
        } else {
          return { sheetName: sName, rowIdx: r, row, headers }
        }
      }
    }
  }

  return null
}

/**
 * UNIVERSAL RATE CALCULATION ENGINE
 * 
 * Works for ALL vendors (Pacific, FlySwift, and newly uploaded sheets):
 * 1. Writes inputs into C4 (Country), C5 (Service), C6 (Weight), C7 (Postcode/State) on the Rate Calculator tab
 * 2. If C10 has an active Excel formula, evaluates it using xlsx-calc
 * 3. If no formula or rate is 0, uses multi-sheet tariff calculation matching country + service:
 *    - 500g flat + additional 500g increments (<6kg)
 *    - Per-kg tiers (>=6kg)
 *    - Zone-based weight grid lookup (USA, Australia, NZ, Canada)
 * 4. Writes calculated outputs to C10 (rate), C9 (matched service), C11 (basis), C12 (source row)
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

  // Read workbook preserving formulas
  const wb = XLSX.readFile(wbInfo.path, { cellFormula: true, cellStyles: true })
  const layout = detectCalculatorLayout(wb)
  const calcSheetName = layout?.sheet_name || wb.SheetNames[0]
  const calcSheet = wb.Sheets[calcSheetName]

  const cleanDests = extractCleanDestinations(wb)
  const matchedDestObj = resolveDestinationInput(country, cleanDests)
  const registry = readRegistry()
  const vendorDisplayName = registry[wbInfo.code]?.vendor_name || wbInfo.code.toUpperCase()

  if (!matchedDestObj) {
    return {
      success: false,
      message: `Destination "${country}" is not serviced by vendor "${vendorDisplayName}". Please select a supported destination.`,
      reason: 'DESTINATION_NOT_SERVICED',
      vendor: vendorDisplayName,
      country
    }
  }

  const resolvedCountry = matchedDestObj.country
  const validServices = matchedDestObj.services || []

  // Strict validation: Country-wise and vendor-wise service matching
  let chosenService = (service_code || '').trim()
  if (!chosenService && validServices.length > 0) {
    chosenService = validServices[0]
  } else if (chosenService && validServices.length > 0) {
    const exact = validServices.find(s => s.toLowerCase() === chosenService.toLowerCase())
    if (exact) {
      chosenService = exact
    } else {
      return {
        success: false,
        message: `Service "${service_code}" is not valid for "${resolvedCountry}" under vendor "${vendorDisplayName}". Valid service(s) for ${resolvedCountry}: ${validServices.join(', ')}.`,
        reason: 'INVALID_SERVICE_COMBINATION',
        vendor: vendorDisplayName,
        country: resolvedCountry,
        invalid_service: service_code,
        supported_services: validServices
      }
    }
  }

  const c7Value = state || postcode || ''

  // STEP 1: Write inputs into mapped cells of Rate Calculator
  if (calcSheet && layout) {
    calcSheet[layout.dest_input_cell] = { t: 's', v: resolvedCountry, w: resolvedCountry }
    calcSheet[layout.service_input_cell] = { t: 's', v: chosenService, w: chosenService }
    calcSheet[layout.weight_input_cell] = { t: 'n', v: weightNum, w: String(weightNum) }
    calcSheet[layout.postcode_input_cell] = { t: 's', v: String(c7Value).trim(), w: String(c7Value).trim() }
  }

  // STEP 2: If rate output cell has an active Excel formula, evaluate via xlsx-calc
  if (calcSheet && layout && calcSheet[layout.rate_output_cell]?.f) {
    try {
      xlsxCalc(wb)
      const rateCell = calcSheet[layout.rate_output_cell]
      let evalRate = 0
      if (typeof rateCell?.v === 'number') {
        evalRate = rateCell.v
      } else if (rateCell?.v !== undefined && rateCell?.v !== null) {
        const p = parseFloat(String(rateCell.v).replace(/[^0-9.\-]/g, ''))
        if (!isNaN(p)) evalRate = p
      }

      if (evalRate > 0) {
        evalRate = Math.round(evalRate * 100) / 100
        const matchedSvc = calcSheet[layout.matched_svc_output_cell]?.v ? String(calcSheet[layout.matched_svc_output_cell].v).trim() : chosenService
        const rateBasis = calcSheet[layout.rate_basis_cell]?.v ? String(calcSheet[layout.rate_basis_cell].v).trim() : `Excel formula evaluated from ${calcSheetName}`
        const sourceRow = calcSheet[layout.source_row_cell]?.v ? Number(calcSheet[layout.source_row_cell].v) : null

        return finalizeQuoteResponse(wb, {
          country: resolvedCountry,
          service_code: matchedSvc,
          weight: weightNum,
          state: state || null,
          pricing_method: 'excel_formula',
          vendor_rate: evalRate,
          rate_per_kg: weightNum > 0 ? Math.round((evalRate / weightNum) * 100) / 100 : null,
          rate_basis: rateBasis,
          source_sheet: calcSheetName,
          source_row: sourceRow
        }, layout)
      }
    } catch (calcErr) {
      console.warn('xlsx-calc failed, falling back to tariff sheet lookup:', calcErr.message)
    }
  }

  // STEP 3: Multi-Sheet Tariff Calculation

  // ── SPECIAL DESTINATION 1: USA (USA Ground, DDU, DDP, PXC-EX NY SELF) ──
  const isUSA = resolvedCountry.toLowerCase().includes('united states') ||
    resolvedCountry.toLowerCase() === 'usa' ||
    resolvedCountry.toLowerCase() === 'u.s.a.' ||
    chosenService.toLowerCase().includes('usa')

  if (isUSA) {
    // Check if vendor has USA DDU or USA DDP sheet (FlySwift)
    const usaSheetName = chosenService.toUpperCase().includes('DDP') ? 'USA DDP' : (wb.Sheets['USA DDU'] ? 'USA DDU' : 'USA DDP')
    if (wb.Sheets[usaSheetName]) {
      const uRows = XLSX.utils.sheet_to_json(wb.Sheets[usaSheetName], { header: 1 })
      // Zone chart lookup from zip
      let zoneCol = 2 // default Zone 3
      let matchedZone = 'Zone 3'
      if (postcode) {
        const cleanZip = String(postcode).trim().slice(0, 3)
        // Find zip in zone chart columns (Dest ZIP / Zone pairs)
        // Header is row 1, data starts row 2
        for (let r = 2; r < Math.min(uRows.length, 50); r++) {
          const row = uRows[r] || []
          for (const zipColIdx of [8, 10, 12, 14, 16, 18]) {
            const zipVal = String(row[zipColIdx] || '').trim()
            if (zipVal === cleanZip || (zipVal.includes('-') && cleanZip >= zipVal.split('-')[0] && cleanZip <= zipVal.split('-')[1])) {
              const zVal = row[zipColIdx + 1]
              if (zVal && zVal !== 'NA') {
                matchedZone = `Zone ${zVal}`
                zoneCol = Number(zVal) - 1 // Zone 2 is col 1, Zone 3 is col 2, etc.
                break
              }
            }
          }
        }
      }

      // Weight row lookup
      let rate = 0
      for (let r = 2; r < uRows.length; r++) {
        const wVal = parseFloat(uRows[r][0])
        if (!isNaN(wVal) && weightNum <= wVal) {
          rate = Number(uRows[r][zoneCol] || uRows[r][1])
          break
        }
      }
      if (rate === 0 && uRows.length > 2) {
        const lastRow = uRows[uRows.length - 1]
        rate = Number(lastRow[zoneCol] || lastRow[1])
      }

      const total = Math.round(rate * (weightNum > 1 ? weightNum : 1) * 100) / 100
      return finalizeQuoteResponse(wb, {
        country: resolvedCountry,
        service_code: chosenService || usaSheetName,
        weight: weightNum,
        zone: matchedZone,
        state: state || null,
        pricing_method: 'zone_weight_grid',
        vendor_rate: total,
        rate_per_kg: weightNum > 0 ? Math.round((total / weightNum) * 100) / 100 : null,
        rate_basis: `${weightNum} kg in ${matchedZone} (${usaSheetName}) = ₹${total.toLocaleString('en-IN')}`,
        transit_time: '5-10 Days',
        source_sheet: usaSheetName
      })
    }

    // Check if Pacific USA Ground in Self Network
    if (wb.Sheets['Self Network']) {
      const snSheet = wb.Sheets['Self Network']
      const snRows = XLSX.utils.sheet_to_json(snSheet, { header: 1 })
      const stateMap = getUSAStateToZoneMap(snSheet)
      const stInput = (state || postcode || '').trim()
      const resolvedState = resolveUSStateToZone(stInput, stateMap)

      if (!resolvedState) {
        return {
          success: false,
          message: `US Destination State code or 5-digit ZIP code is required for United States (${chosenService || 'PXC-EX NY SELF'}) under vendor "${vendorDisplayName}". Please provide a valid US State code (e.g. NY, CA, TX, FL) or 5-digit ZIP code (e.g. 10001, 90210) to determine the delivery zone (Zone 2–8).`,
          reason: 'STATE_OR_ZIP_REQUIRED',
          vendor: vendorDisplayName,
          country: resolvedCountry,
          supported_zones: ['Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6', 'Zone 7', 'Zone 8']
        }
      }

      if (weightNum > 21.5) {
        return {
          success: false,
          message: `Shipment weight (${weightNum} kg) exceeds maximum permissible weight limit of 21.5 kg for United States (${chosenService || 'PXC-EX NY SELF'}) under vendor "${vendorDisplayName}".`,
          reason: 'WEIGHT_LIMIT_EXCEEDED',
          vendor: vendorDisplayName,
          country: resolvedCountry,
          max_weight_kg: 21.5,
          requested_weight_kg: weightNum
        }
      }

      if (snRows.length > 65) {
        const zoneHeaders = (snRows[56] || []).slice(2, 9)
        const zCol = zoneHeaders.indexOf(resolvedState.zone) + 2

        let calculatedRate = 0
        let ratePerKg = null
        let band = ''

        if (weightNum <= 5) {
          const bp = Math.ceil(weightNum * 2) / 2
          const rowIdx = 29 + Math.round((bp - 0.5) * 2)
          calculatedRate = Number(snRows[rowIdx][zCol])
          band = `${bp} kg (${resolvedState.zone})`
        } else {
          const ceilW = Math.min(22, Math.max(6, Math.ceil(weightNum)))
          const rowIdx = 39 + (ceilW - 6)
          ratePerKg = Number(snRows[rowIdx][zCol])
          calculatedRate = Math.round(weightNum * ratePerKg * 100) / 100
          band = `${ceilW} Per Kg (${resolvedState.zone})`
        }

        return finalizeQuoteResponse(wb, {
          country: resolvedCountry,
          service_code: chosenService || 'PXC-EX NY SELF',
          weight: weightNum,
          state: resolvedState.state_code,
          zone: resolvedState.zone,
          pricing_method: weightNum <= 5 ? 'weight_specific' : 'per_kg',
          matched_band: band,
          vendor_rate: calculatedRate,
          rate_per_kg: ratePerKg,
          rate_basis: `${weightNum} kg for ${resolvedState.zone} = ₹${calculatedRate.toLocaleString('en-IN')}`,
          transit_time: '5-8 Days',
          source_sheet: 'Self Network'
        })
      }
    }
  }

  // ── SPECIAL DESTINATION 2: AUSTRALIA (AUS DTDC, PXC-SELF) ──
  const isAus = resolvedCountry.toLowerCase().includes('australia') ||
    resolvedCountry.toLowerCase() === 'aus' ||
    chosenService.toUpperCase().includes('AUS')

  if (isAus) {
    if (wb.Sheets['AUS DTDC']) {
      const ausRows = XLSX.utils.sheet_to_json(wb.Sheets['AUS DTDC'], { header: 1 })
      let zoneCol = 1 // default Zone 1
      let matchedZone = 'Zone 1'

      if (postcode && wb.Sheets['DTDC Zone AUS']) {
        const dtdcRows = XLSX.utils.sheet_to_json(wb.Sheets['DTDC Zone AUS'])
        const cleanPc = String(postcode).trim()
        const m = dtdcRows.find(r => String(r['PostCode'] || '').trim() === cleanPc)
        if (m && m['ZONES']) {
          matchedZone = String(m['ZONES'])
          const num = parseInt(matchedZone.replace(/\D/g, ''))
          if (!isNaN(num) && num >= 1 && num <= 10) zoneCol = num
        } else {
          return {
            success: false,
            message: `Australian postal code "${cleanPc}" is not recognized or serviced under vendor "${vendorDisplayName}" (AUS DTDC). Please provide a valid 4-digit Australian postcode (e.g. 2000 for Sydney, 3000 for Melbourne, 4000 for Brisbane).`,
            reason: 'INVALID_POSTCODE',
            vendor: vendorDisplayName,
            country: resolvedCountry,
            invalid_postcode: cleanPc
          }
        }
      } else if (!postcode && wb.Sheets['DTDC Zone AUS']) {
        return {
          success: false,
          message: `Australian postal code is required for Australia (${chosenService || 'AUS_DTDC'}) under vendor "${vendorDisplayName}" to determine the delivery zone (Zone 1–10). Please enter a 4-digit Australian postcode (e.g. 2000 for Sydney, 3000 for Melbourne).`,
          reason: 'POSTCODE_REQUIRED',
          vendor: vendorDisplayName,
          country: resolvedCountry
        }
      }

      let rate = 0
      for (let r = 2; r < ausRows.length; r++) {
        const wStr = String(ausRows[r][0] || '')
        const wVal = parseFloat(wStr.replace(/[^0-9.]/g, ''))
        if (!isNaN(wVal) && weightNum <= wVal) {
          rate = Number(ausRows[r][zoneCol] || ausRows[r][1])
          break
        }
      }
      if (rate === 0 && ausRows.length > 2) {
        rate = Number(ausRows[ausRows.length - 1][zoneCol] || ausRows[ausRows.length - 1][1])
      }

      const total = Math.round(rate * 100) / 100
      return finalizeQuoteResponse(wb, {
        country: resolvedCountry,
        service_code: chosenService || 'AUS_DTDC',
        weight: weightNum,
        zone: matchedZone,
        pricing_method: 'weight_band',
        vendor_rate: total,
        rate_per_kg: weightNum > 0 ? Math.round((total / weightNum) * 100) / 100 : null,
        rate_basis: `${weightNum} kg in ${matchedZone} (AUS DTDC) = ₹${total.toLocaleString('en-IN')}`,
        transit_time: '5-15 Days',
        source_sheet: 'AUS DTDC'
      })
    }
  }

  // ── SPECIAL DESTINATION 3: NEW ZEALAND (NZ Self, NZ_SELF) ──
  const isNZ = resolvedCountry.toLowerCase().includes('new zealand') ||
    resolvedCountry.toLowerCase() === 'nz' ||
    chosenService.toUpperCase().includes('NZ')

  if (isNZ) {
    if (wb.Sheets['NZ Self']) {
      const nzRows = XLSX.utils.sheet_to_json(wb.Sheets['NZ Self'], { header: 1 })
      let zoneCol = 1 // default Zone 1
      let matchedZone = 'Zone 1'

      if (postcode && wb.Sheets['NZ Zonelist']) {
        const listRows = XLSX.utils.sheet_to_json(wb.Sheets['NZ Zonelist'])
        const cleanPc = String(postcode).trim()
        const m = listRows.find(r => String(r['POSTCODE'] || '').trim() === cleanPc)
        if (m && m['Zone']) {
          matchedZone = String(m['Zone'])
          const num = parseInt(matchedZone.replace(/\D/g, ''))
          if (!isNaN(num) && num >= 1 && num <= 4) zoneCol = num
        }
      }

      let ratePerKg = 0
      for (let r = 2; r < nzRows.length; r++) {
        const wVal = parseFloat(nzRows[r][0])
        if (!isNaN(wVal) && weightNum <= wVal) {
          ratePerKg = Number(nzRows[r][zoneCol] || nzRows[r][1])
          break
        }
      }
      if (ratePerKg === 0 && nzRows.length > 2) {
        ratePerKg = Number(nzRows[nzRows.length - 1][zoneCol] || nzRows[nzRows.length - 1][1])
      }

      const total = Math.round(weightNum * ratePerKg * 100) / 100
      return finalizeQuoteResponse(wb, {
        country: resolvedCountry,
        service_code: chosenService || 'NZ_SELF',
        weight: weightNum,
        zone: matchedZone,
        pricing_method: 'per_kg_tiers',
        vendor_rate: total,
        rate_per_kg: ratePerKg,
        rate_basis: `${weightNum} kg @ ₹${ratePerKg}/kg in ${matchedZone} = ₹${total.toLocaleString('en-IN')}`,
        transit_time: '5-15 Days',
        source_sheet: 'NZ Self'
      })
    }
  }

  // ── SPECIAL DESTINATION 4: CANADA (MUM YYZ DDP, MUM YVR DDP) ──
  const isCan = resolvedCountry.toLowerCase().includes('canada') ||
    resolvedCountry.toLowerCase() === 'can' ||
    chosenService.toUpperCase().includes('YYZ') ||
    chosenService.toUpperCase().includes('YVR')

  if (isCan) {
    const canSheetName = chosenService.toUpperCase().includes('YVR') ? 'MUM YVR DDP' : (wb.Sheets['MUM YYZ DDP'] ? 'MUM YYZ DDP' : 'MUM YVR DDP')
    if (wb.Sheets[canSheetName]) {
      const canRows = XLSX.utils.sheet_to_json(wb.Sheets[canSheetName], { header: 1 })
      let zoneCol = 2 // default D01
      let matchedZone = 'D01'

      if (postcode) {
        const fsa = String(postcode).trim().slice(0, 3).toUpperCase()
        for (let r = 3; r < canRows.length; r++) {
          if (String(canRows[r][20] || '').trim().toUpperCase() === fsa) {
            matchedZone = String(canRows[r][22] || 'D01').trim()
            break
          }
        }
        const dHeaders = canRows[2] || []
        const idx = dHeaders.indexOf(matchedZone)
        if (idx !== -1) zoneCol = idx
      }

      let ratePerKg = 0
      for (let r = 3; r < canRows.length; r++) {
        const wVal = parseFloat(canRows[r][1])
        if (!isNaN(wVal) && weightNum <= wVal) {
          ratePerKg = Number(canRows[r][zoneCol] || canRows[r][2])
          break
        }
      }
      if (ratePerKg === 0 && canRows.length > 3) {
        ratePerKg = Number(canRows[canRows.length - 1][zoneCol] || canRows[canRows.length - 1][2])
      }

      const total = Math.round(weightNum * ratePerKg * 100) / 100
      return finalizeQuoteResponse(wb, {
        country: resolvedCountry,
        service_code: chosenService || canSheetName,
        weight: weightNum,
        zone: matchedZone,
        pricing_method: 'per_kg_tiers',
        vendor_rate: total,
        rate_per_kg: ratePerKg,
        rate_basis: `${weightNum} kg @ ₹${ratePerKg}/kg in ${matchedZone} (${canSheetName}) = ₹${total.toLocaleString('en-IN')}`,
        transit_time: '10-20 Days',
        source_sheet: canSheetName
      })
    }
  }

  // ── GENERAL DESTINATION: Search Tariff Sheets (Self Network, Self, Tariff Rates) ──
  const tariffMatch = findTariffRowInWorkbook(wb, resolvedCountry, chosenService)

  if (!tariffMatch) {
    return {
      success: false,
      message: `Destination "${resolvedCountry}" with service "${chosenService || 'default'}" not found in rate sheets for vendor "${wbInfo.code}".`,
      reason: 'TARIFF_NOT_FOUND'
    }
  }

  const { sheetName, rowIdx, row, headers } = tariffMatch
  const base500 = Number(row[2])
  const addl500 = Number(row[3])
  const transitTime = String(row[row.length - 1] || '5-7 Days')

  if (isNaN(base500) || base500 <= 0) {
    return {
      success: false,
      message: `Invalid rate configuration for destination "${resolvedCountry}" in sheet "${sheetName}".`,
      reason: 'INVALID_RATE_ROW'
    }
  }

  // Weight Calculation:
  // Under 6kg: 500g base + additional 500g increments
  if (weightNum <= 0.5) {
    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService || String(row[0] || ''),
      weight: weightNum,
      pricing_method: '500g_incremental',
      matched_band: 'First 500g',
      vendor_rate: base500,
      rate_per_kg: null,
      rate_basis: `First 500g flat rate: ₹${base500.toFixed(2)}`,
      transit_time: transitTime,
      source_sheet: sheetName,
      source_row: rowIdx + 1
    })
  } else if (weightNum < 6) {
    const units = Math.ceil((weightNum - 0.5) / 0.5)
    const total = base500 + units * addl500
    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService || String(row[0] || ''),
      weight: weightNum,
      pricing_method: '500g_incremental',
      matched_band: `500g + ${units} addl`,
      vendor_rate: total,
      rate_per_kg: null,
      rate_basis: `First 500g (₹${base500}) + ${units} × Addl 500g (₹${addl500}) = ₹${total.toFixed(2)}`,
      transit_time: transitTime,
      source_sheet: sheetName,
      source_row: rowIdx + 1
    })
  } else {
    // 6kg and above: per-kg tier
    let matchedTierRate = 0
    let matchedBand = '6kg++'

    for (let c = 4; c < headers.length; c++) {
      const hStr = String(headers[c] || '')
      const kgMatch = hStr.match(/(\d+)\s*Kg/i)
      if (kgMatch) {
        const threshold = Number(kgMatch[1])
        const val = row[c]
        if (weightNum >= threshold && val !== '-' && val !== null && val !== undefined && Number(val) > 0) {
          matchedTierRate = Number(val)
          matchedBand = hStr
        }
      }
    }

    if (matchedTierRate === 0) {
      const col4Val = row[4]
      if (col4Val !== '-' && Number(col4Val) > 0) {
        matchedTierRate = Number(col4Val)
      } else {
        matchedTierRate = addl500 * 2
      }
    }

    const total = Math.round(weightNum * matchedTierRate * 100) / 100
    return finalizeQuoteResponse(wb, {
      country: resolvedCountry,
      service_code: chosenService || String(row[0] || ''),
      weight: weightNum,
      pricing_method: 'per_kg_tiers',
      matched_band: matchedBand,
      vendor_rate: total,
      rate_per_kg: matchedTierRate,
      rate_basis: `${weightNum} kg @ ₹${matchedTierRate}/kg in ${matchedBand} = ₹${total.toLocaleString('en-IN')}`,
      transit_time: transitTime,
      source_sheet: sheetName,
      source_row: rowIdx + 1
    })
  }
}

/**
 * Finalize quote response and update Rate Calculator tab cells based on dynamic layout
 */
function finalizeQuoteResponse(wb, quote, layout = null) {
  const activeLayout = layout || detectCalculatorLayout(wb)
  const targetSheetName = activeLayout?.sheet_name || wb.SheetNames[0]
  const firstSheet = wb.Sheets[targetSheetName]

  if (firstSheet && activeLayout) {
    firstSheet[activeLayout.dest_input_cell] = { t: 's', v: quote.country, w: String(quote.country) }
    firstSheet[activeLayout.service_input_cell] = { t: 's', v: quote.service_code, w: String(quote.service_code) }
    firstSheet[activeLayout.weight_input_cell] = { t: 'n', v: quote.weight, w: String(quote.weight) }
    firstSheet[activeLayout.postcode_input_cell] = { t: 's', v: quote.state || quote.postcode || '', w: String(quote.state || quote.postcode || '') }
    if (activeLayout.matched_svc_output_cell) {
      firstSheet[activeLayout.matched_svc_output_cell] = { t: 's', v: quote.service_code, w: String(quote.service_code) }
    }
    if (activeLayout.rate_output_cell) {
      firstSheet[activeLayout.rate_output_cell] = { t: 'n', v: quote.vendor_rate, w: String(quote.vendor_rate) }
    }
    if (activeLayout.rate_basis_cell) {
      firstSheet[activeLayout.rate_basis_cell] = { t: 's', v: quote.rate_basis, w: String(quote.rate_basis) }
    }
    if (quote.source_row && activeLayout.source_row_cell) {
      firstSheet[activeLayout.source_row_cell] = { t: 'n', v: quote.source_row, w: String(quote.source_row) }
    }
  }

  const steps = [
    `Destination: ${quote.country}${quote.state ? ` (${quote.state})` : ''}`,
    quote.zone ? `Zone: ${quote.zone}` : null,
    `Service: ${quote.service_code}`,
    `Weight: ${quote.weight} kg`,
    `Tariff Sheet: ${quote.source_sheet || targetSheetName}${quote.source_row ? ` (Row #${quote.source_row})` : ''}`,
    quote.matched_band ? `Pricing Slab: ${quote.matched_band}` : null,
    quote.rate_per_kg ? `Rate / Kg: ₹${quote.rate_per_kg}` : null,
    `Formula: ${quote.rate_basis}`,
    `Calculated Rate: ₹${quote.vendor_rate.toLocaleString('en-IN')}`
  ].filter(Boolean)

  return {
    success: true,
    country: quote.country,
    service_code: quote.service_code,
    matched_service: quote.service_code,
    weight: quote.weight,
    chargeable_weight: quote.weight,
    state: quote.state || null,
    zone: quote.zone || null,
    pricing_method: quote.pricing_method || 'excel_formula',
    matched_band: quote.matched_band || null,
    vendor_rate: quote.vendor_rate,
    shipping_charge: quote.vendor_rate,
    currency: 'INR',
    rate_per_kg: quote.rate_per_kg || (quote.weight > 0 ? Math.round((quote.vendor_rate / quote.weight) * 100) / 100 : null),
    rate_basis: quote.rate_basis,
    transit_time: quote.transit_time || '',
    source_sheet: quote.source_sheet || firstSheetName,
    source_row: quote.source_row || null,
    calculation_breakdown: {
      destination: quote.country + (quote.state ? ` (${quote.state})` : ''),
      service: quote.service_code,
      weight: quote.weight,
      zone: quote.zone || null,
      source_sheet: quote.source_sheet || firstSheetName,
      source_row: quote.source_row || null,
      pricing_method: quote.pricing_method || 'excel_formula',
      matched_band: quote.matched_band || null,
      rate_per_kg: quote.rate_per_kg || null,
      formula: quote.rate_basis,
      vendor_rate: quote.vendor_rate,
      steps
    }
  }
}
