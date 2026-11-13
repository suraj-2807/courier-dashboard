import https from 'https'
import http from 'http'
import { URL } from 'url'

export const RATES_API_KEY = process.env.RATES_API_KEY || '2cf1179d5ca5b71b3cc886d36cd6cc1219d51825c70e764c'
export const RATES_API_BASE_URL = process.env.RATES_API_BASE_URL || 'https://rates.princeexp.com'

/**
 * Universal HTTP/HTTPS request helper for Rates API
 */
function requestRatesApi(endpointPath, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const fullUrl = endpointPath.startsWith('http')
        ? endpointPath
        : `${RATES_API_BASE_URL}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`

      const parsedUrl = new URL(fullUrl)
      const isHttps = parsedUrl.protocol === 'https:'
      const client = isHttps ? https : http

      const headers = {
        'Accept': 'application/json',
        'X-API-Key': RATES_API_KEY,
        ...(options.headers || {})
      }

      const method = (options.method || 'GET').toUpperCase()

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method,
        headers,
        timeout: 15000
      }

      let bodyData = null
      if (options.body) {
        if (typeof options.body === 'object') {
          bodyData = JSON.stringify(options.body)
          if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json'
          }
        } else {
          bodyData = String(options.body)
        }
        headers['Content-Length'] = Buffer.byteLength(bodyData)
      }

      const req = client.request(reqOptions, (res) => {
        let responseBody = ''
        res.on('data', (chunk) => {
          responseBody += chunk
        })

        res.on('end', () => {
          let parsed = null
          try {
            parsed = JSON.parse(responseBody)
          } catch (e) {
            parsed = responseBody
          }

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed
          })
        })
      })

      req.on('timeout', () => {
        req.destroy(new Error('Rates API request timed out (15s)'))
      })

      req.on('error', (err) => {
        reject(err)
      })

      if (bodyData) {
        req.write(bodyData)
      }
      req.end()
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * 1. Calculate Shipping Rate via /api/calculate.php
 */
export async function calculateRate({
  vendor = 'pacific',
  country,
  service_code = '',
  serviceCode = '',
  service = '',
  weight = 1,
  postcode = '',
  state = ''
}) {
  const query = new URLSearchParams()
  query.set('vendor', vendor || 'pacific')
  if (country) query.set('country', String(country).trim())
  const resolvedService = service_code || serviceCode || service
  if (resolvedService) query.set('service_code', String(resolvedService).trim())
  query.set('weight_kg', String(weight || 1))
  if (postcode) query.set('postcode', String(postcode).trim())
  if (state) query.set('state', String(state).trim())

  const endpoint = `/api/calculate.php?${query.toString()}`
  const response = await requestRatesApi(endpoint, { method: 'GET' })

  const raw = response.data || {}

  if (response.statusCode >= 400 || (raw.success === false && raw.ok === false)) {
    return {
      success: false,
      ok: false,
      message: raw.error || raw.message || `Calculation error (Status ${response.statusCode})`,
      vendor: raw.vendor || vendor,
      country: raw.country || country,
      service: raw.service || service_code,
      actual_weight: raw.actual_weight || weight,
      raw
    }
  }

  const finalRate = raw.final_rate !== undefined ? parseFloat(raw.final_rate) : null
  const chargeableWeight = raw.chargeable_weight !== undefined ? parseFloat(raw.chargeable_weight) : parseFloat(weight)
  const baseRate = raw.calculation?.base_rate !== undefined
    ? parseFloat(raw.calculation.base_rate)
    : (finalRate && chargeableWeight ? (finalRate / chargeableWeight) : 0)

  return {
    success: true,
    ok: true,
    vendor_rate: finalRate,
    final_rate: finalRate,
    calculated_rate: finalRate,
    currency: raw.currency || 'INR',
    vendor: raw.vendor || vendor,
    service_code: raw.service || service_code,
    country: raw.country || country,
    actual_weight: raw.actual_weight !== undefined ? raw.actual_weight : weight,
    chargeable_weight: chargeableWeight,
    rate_per_kg: baseRate ? Number(baseRate.toFixed(2)) : null,
    rate_type: raw.rate_type || 'regular',
    sheet_name: raw.sheet_name || '',
    active_slab: raw.active_slab || raw.calculation?.selected_slab || '',
    transit_time: raw.transit_time || null,
    formula: raw.formula || '',
    calculation: raw.calculation || {},
    breakdown: raw.calculation?.breakdown || [],
    steps: raw.calculation?.steps || [],
    postcode: raw.postcode || postcode,
    zone: raw.zone || null,
    town_city: raw.town_city || null,
    remote_status: raw.remote_status || 'NONE',
    is_remote: raw.is_remote !== undefined ? raw.is_remote : (raw.remote_status === 'YES' || raw.remote_status === 'BOTH'),
    duty_paid: raw.duty_paid || null,
    raw
  }
}

/**
 * 2. Get available services for vendor and optional country
 */
export async function getServices({ vendor = 'pacific', country = '' } = {}) {
  const query = new URLSearchParams()
  query.set('vendor', vendor || 'pacific')
  if (country) query.set('country', String(country).trim())

  const endpoint = `/api/services.php?${query.toString()}`
  const response = await requestRatesApi(endpoint)
  return response.data
}

/**
 * 3. Get available destination countries for vendor
 */
export async function getCountries({ vendor = 'pacific' } = {}) {
  const query = new URLSearchParams()
  query.set('vendor', vendor || 'pacific')

  const endpoint = `/api/countries.php?${query.toString()}`
  const response = await requestRatesApi(endpoint)
  return response.data
}

/**
 * 4. Resolve postcode / state to shipping zone and city
 */
export async function resolveZone({ vendor = 'pacific', country, postcode = '', state = '' }) {
  const query = new URLSearchParams()
  query.set('vendor', vendor || 'pacific')
  if (country) query.set('country', String(country).trim())
  if (postcode) query.set('postcode', String(postcode).trim())
  if (state) query.set('state', String(state).trim())

  const endpoint = `/api/zones.php?${query.toString()}`
  const response = await requestRatesApi(endpoint)
  return response.data
}

/**
 * 5. Get active vendors from Rates API
 */
export async function getVendors() {
  const endpoint = '/api/vendors.php'
  const response = await requestRatesApi(endpoint)
  return response.data
}

/**
 * 6. Get detected worksheets & metadata
 */
export async function getWorksheets({ vendor = 'pacific' } = {}) {
  const query = new URLSearchParams()
  query.set('vendor', vendor || 'pacific')

  const endpoint = `/api/sheets.php?${query.toString()}`
  const response = await requestRatesApi(endpoint)
  return response.data
}

/**
 * 7. Query rate records
 */
export async function queryRates(params = {}) {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      query.set(key, String(val).trim())
    }
  }
  if (!query.has('vendor')) {
    query.set('vendor', 'pacific')
  }

  const endpoint = `/api/rates.php?${query.toString()}`
  const response = await requestRatesApi(endpoint)
  return response.data
}

/**
 * 8. Update rate record in Rates API
 */
export async function updateRateRecord(id, data = {}) {
  const query = new URLSearchParams()
  const recordId = id || data.id
  if (recordId) query.set('id', String(recordId))
  if (data.table) query.set('table', String(data.table))

  const endpoint = `/api/rates.php?${query.toString()}`
  const response = await requestRatesApi(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: data
  })
  return response.data
}

/**
 * 9. Execute arbitrary sandbox query through backend proxy
 */
export async function executeSandboxQuery({
  method = 'GET',
  url,
  headers = {},
  body = null
}) {
  const startTime = Date.now()
  const response = await requestRatesApi(url, {
    method,
    headers,
    body
  })
  const latencyMs = Date.now() - startTime

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    data: response.data,
    latencyMs
  }
}
