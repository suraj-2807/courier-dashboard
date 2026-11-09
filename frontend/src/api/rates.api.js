import api from './axios'

export const RATES_API_KEY = '2cf1179d5ca5b71b3cc886d36cd6cc1219d51825c70e764c'
export const RATES_API_BASE_URL = 'https://rates.princeexp.com'

/**
 * 1. Get all vendors with live rate API status
 */
export const getVendors = () =>
  api.get('/rates/vendors').then((res) => res.data)

export const getVendorsWithSheets = getVendors // Alias

/**
 * 2. Get available destination countries for a vendor
 */
export const getVendorCountries = (vendor = 'pacific') =>
  api.get('/rates/countries', { params: { vendor } }).then((res) => res.data)

/**
 * 3. Get available services (optionally filtered by country)
 */
export const getVendorServices = (vendor = 'pacific', country = '') =>
  api.get('/rates/services', { params: { vendor, country } }).then((res) => res.data)

/**
 * 4. Resolve destination postcode / state to shipping zone and town/city
 */
export const resolveVendorZone = (vendor = 'pacific', country = '', postcode = '', state = '') =>
  api.get('/rates/zones', { params: { vendor, country, postcode, state } }).then((res) => res.data)

/**
 * 5. Get detected worksheets & metadata
 */
export const getWorksheets = (vendor = 'pacific') =>
  api.get('/rates/sheets', { params: { vendor } }).then((res) => res.data)

/**
 * 6. Query rate tariff records
 */
export const queryRateRecords = (params = {}) =>
  api.get('/rates/query', { params }).then((res) => res.data)

/**
 * Update rate record / price in live Rates API
 */
export const updateRateRecord = (id, data = {}) =>
  api.patch(`/rates/records/${id}`, data).then((res) => res.data)

/**
 * 7. Primary Rate Calculation Engine
 * Calls /rates/calculate which queries Prince Express Rates API (/api/calculate.php)
 */
export const calculateVendorRate = (params) =>
  api.post('/rates/calculate', params).then((res) => res.data)

/**
 * 8. Execute Sandbox Query (via backend proxy or direct)
 */
export const executeSandboxQuery = ({ method = 'GET', url, headers = {}, body = null }) =>
  api.post('/rates/proxy', { method, url, headers, body }).then((res) => res.data)

/**
 * Backwards compatibility methods
 */
export const getVendorSheetDetails = (vendorCode = 'pacific') =>
  api.get(`/rates/vendors/${vendorCode}/details`).then((res) => res.data)

export const getVendorDestinations = (vendorCode = 'pacific') =>
  api.get(`/rates/vendors/${vendorCode}/destinations`).then((res) => res.data)

export const importVendorRateSheet = (vendorCode, file, vendorName = '') => {
  const formData = new FormData()
  if (file) formData.append('file', file)
  if (vendorName) formData.append('vendor_name', vendorName)
  return api.post(`/rates/vendors/${vendorCode}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((res) => res.data)
}

export const getVendorSheetDownloadUrl = (vendorCode = 'pacific') =>
  `${api.defaults.baseURL || '/api'}/rates/vendors/${vendorCode}/download`

export const getVendorWorkbookData = (vendorCode = 'pacific') =>
  api.get(`/rates/vendors/${vendorCode}/sheet-data`).then((res) => res.data)

export const saveVendorWorkbookData = (vendorCode, sheets, vendorName = '') =>
  api.post(`/rates/vendors/${vendorCode}/save-sheet-data`, { sheets, vendor_name: vendorName }).then((res) => res.data)
