import * as XLSX from 'xlsx'

/**
 * Standardized headers expected in each service tab.
 * Matching is case-insensitive and trims whitespace.
 */
const REQUIRED_HEADERS = [
  'record_type',
  'service_code',
  'destination',
  'zone',
  'weight_bracket',
  'rate_inr',
  'service',
  'transit_time',
  'postcode_prefix',
  'locality',
  'source_sheet',
  'source_row',
  'notes'
]

/**
 * Normalize a header string for matching:
 * lowercase, trim, collapse internal whitespace to underscore.
 */
function normalizeHeader(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw.trim().toLowerCase().replace(/\s+/g, '_')
}

/**
 * Check if a column is entirely empty / blank / whitespace-only.
 */
function isEmptyColumn(rows, colKey) {
  return rows.every(row => {
    const val = row[colKey]
    return val === undefined || val === null || String(val).trim() === ''
  })
}

/**
 * Parse a single worksheet using header-name matching.
 * Returns { records: [], errors: [], warnings: [], sheetName }
 */
function parseSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  const result = { sheetName, records: [], errors: [], warnings: [] }

  if (!sheet) {
    result.errors.push(`Sheet "${sheetName}" is empty or unreadable`)
    return result
  }

  // Read raw JSON rows with headers
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
  if (rawRows.length === 0) {
    result.warnings.push(`Sheet "${sheetName}" has no data rows`)
    return result
  }

  // Get the actual Excel headers from the first row
  const rawHeaders = Object.keys(rawRows[0])

  // Build a mapping: normalized_header → actual Excel column key
  const headerMap = {}
  const matchedHeaders = []
  for (const rawKey of rawHeaders) {
    const normalized = normalizeHeader(rawKey)
    // Only map if it matches one of our known headers AND the column is not entirely empty
    if (REQUIRED_HEADERS.includes(normalized) && !isEmptyColumn(rawRows, rawKey)) {
      headerMap[normalized] = rawKey
      matchedHeaders.push(normalized)
    }
  }

  // Check which required headers are present
  const missingHeaders = REQUIRED_HEADERS.filter(h => !matchedHeaders.includes(h))
  // Critical headers that MUST be present for a valid import
  const criticalHeaders = ['rate_inr']
  const missingCritical = criticalHeaders.filter(h => missingHeaders.includes(h))

  if (missingCritical.length > 0) {
    result.errors.push(`Sheet "${sheetName}" is missing critical header(s): ${missingCritical.join(', ')}`)
    return result
  }

  if (missingHeaders.length > 0) {
    result.warnings.push(`Sheet "${sheetName}" is missing optional header(s): ${missingHeaders.join(', ')}`)
  }

  // Extract rows
  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i]
    const excelRowNum = i + 2 // +1 for 0-index, +1 for header row

    // Helper to get a value by normalized header name
    const get = (headerName) => {
      const colKey = headerMap[headerName]
      if (!colKey) return ''
      const val = rawRow[colKey]
      return val !== undefined && val !== null ? String(val).trim() : ''
    }

    // Skip completely empty rows
    const allEmpty = REQUIRED_HEADERS.every(h => get(h) === '')
    if (allEmpty) continue

    // Parse rate_inr as number
    const rateInrRaw = get('rate_inr')
    let rateInr = 0
    if (rateInrRaw !== '') {
      const parsed = parseFloat(rateInrRaw.replace(/,/g, ''))
      rateInr = isNaN(parsed) ? 0 : parsed
    }

    // Derive source_sheet and source_row if empty
    const sourceSheet = get('source_sheet') || sheetName
    const sourceRowRaw = get('source_row')
    const sourceRow = sourceRowRaw !== '' ? parseInt(sourceRowRaw, 10) || excelRowNum : excelRowNum

    const record = {
      record_type: get('record_type'),
      service_code: get('service_code'),
      destination: get('destination'),
      zone: get('zone'),
      weight_bracket: get('weight_bracket'),
      rate_inr: rateInr,
      service: get('service'),
      transit_time: get('transit_time'),
      postcode_prefix: get('postcode_prefix'),
      locality: get('locality'),
      source_sheet: sourceSheet,
      source_row: sourceRow,
      notes: get('notes'),
      sheet_name: sheetName // Always capture actual Excel tab name
    }

    result.records.push(record)
  }

  return result
}

/**
 * Parse an entire vendor rate workbook.
 * Dynamically discovers and processes ALL worksheets.
 *
 * @param {Buffer} buffer - Excel file buffer
 * @returns {Object} { success, sheets: [], summary, errors }
 */
export function parseVendorRateWorkbook(buffer) {
  const result = {
    success: true,
    sheets: [],
    summary: {
      total_sheets: 0,
      total_records: 0,
      total_errors: 0,
      total_warnings: 0,
      sheets_processed: []
    },
    errors: []
  }

  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch (err) {
    result.success = false
    result.errors.push(`Failed to read Excel file: ${err.message}`)
    return result
  }

  const sheetNames = workbook.SheetNames
  if (!sheetNames || sheetNames.length === 0) {
    result.success = false
    result.errors.push('Workbook contains no worksheets')
    return result
  }

  result.summary.total_sheets = sheetNames.length

  // Process ALL sheets dynamically — no hardcoded sheet names
  for (const sheetName of sheetNames) {
    const sheetResult = parseSheet(workbook, sheetName)
    result.sheets.push(sheetResult)
    result.summary.sheets_processed.push({
      name: sheetName,
      records: sheetResult.records.length,
      errors: sheetResult.errors.length,
      warnings: sheetResult.warnings.length
    })
    result.summary.total_records += sheetResult.records.length
    result.summary.total_errors += sheetResult.errors.length
    result.summary.total_warnings += sheetResult.warnings.length
  }

  // Mark failure if there were critical errors
  if (result.summary.total_errors > 0) {
    result.success = false
  }

  // Also fail if zero records were extracted
  if (result.summary.total_records === 0) {
    result.success = false
    result.errors.push('No valid records found in any worksheet')
  }

  return result
}
