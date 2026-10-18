import api from './axios'

/**
 * Get all vendors available on the portal with rate sheet status
 */
export const getVendorsWithSheets = () =>
  api.get('/rates/vendors').then((res) => res.data)

/**
 * Import a new Excel rate sheet for a vendor available on the portal
 */
export const importVendorRateSheet = (vendorCode, file, vendorName = '') => {
  const formData = new FormData()
  formData.append('file', file)
  if (vendorName) formData.append('vendor_name', vendorName)
  return api.post(`/rates/vendors/${vendorCode}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((res) => res.data)
}

/**
 * Get rate sheet details, sheets list, and calculator structure for a vendor
 */
export const getVendorSheetDetails = (vendorCode = 'pacific') =>
  api.get(`/rates/vendors/${vendorCode}/details`).then((res) => res.data)

/**
 * Get destinations and services list for autocomplete
 */
export const getVendorDestinations = (vendorCode = 'pacific') =>
  api.get(`/rates/vendors/${vendorCode}/destinations`).then((res) => res.data)

/**
 * Calculate rate from Excel rate sheet:
 * Inputs: C4 (Country), C5 (Service Code), C6 (Weight), C7 (Postcode)
 * Fetches calculated rate from C10
 */
export const calculateVendorRate = (params) =>
  api.post('/rates/calculate', params).then((res) => res.data)

/**
 * Get download URL for a vendor's rate sheet
 */
export const getVendorSheetDownloadUrl = (vendorCode = 'pacific') =>
  `${api.defaults.baseURL || '/api'}/rates/vendors/${vendorCode}/download`
