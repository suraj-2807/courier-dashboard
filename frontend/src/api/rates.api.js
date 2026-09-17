import api from './axios'

/**
 * Upload Excel file with rate data
 * Filename format: "ServiceName CompanyName.xlsx"
 */
export const uploadRatesExcel = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/rates/upload-excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((res) => res.data)
}

/**
 * Get all companies
 */
export const getCompanies = () =>
  api.get('/rates/companies').then((res) => res.data)

/**
 * Get services for a company
 */
export const getCompanyServices = (companyId) =>
  api.get(`/rates/companies/${companyId}/services`).then((res) => res.data)

/**
 * Get rate entries for a service
 */
export const getServiceRates = (serviceId) =>
  api.get(`/rates/services/${serviceId}/rates`).then((res) => res.data)

/**
 * Get postcode-zone mappings for a service (paginated + search)
 */
export const getServiceZones = (serviceId, params = {}) =>
  api.get(`/rates/services/${serviceId}/zones`, { params }).then((res) => res.data)

/**
 * Update a rate entry (inline edit)
 */
export const updateRateEntry = (id, data) =>
  api.put(`/rates/rates/${id}`, data).then((res) => res.data)

/**
 * Update a postcode-zone entry (inline edit)
 */
export const updateZoneEntry = (id, data) =>
  api.put(`/rates/zones/${id}`, data).then((res) => res.data)

/**
 * Delete a service and all its data
 */
export const deleteService = (serviceId) =>
  api.delete(`/rates/services/${serviceId}`).then((res) => res.data)

/**
 * Delete a company and all its services
 */
export const deleteCompany = (companyId) =>
  api.delete(`/rates/companies/${companyId}`).then((res) => res.data)

// ═══════════════════════════════════════════════════════════════════════
// VENDOR RATE SHEETS (Multi-Sheet Tariff & Versioning — Pacific, etc.)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Upload vendor rate workbook (Pacific Excel)
 */
export const uploadVendorRateSheet = (vendorCode, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/rates/vendors/${vendorCode}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((res) => res.data)
}

/**
 * Get all versions for a vendor
 */
export const getVendorVersions = (vendorCode = 'pacific') =>
  api.get(`/rates/vendors/${vendorCode}/versions`).then((res) => res.data)

/**
 * Get detailed view of a specific vendor rate version
 */
export const getVendorVersionDetail = (vendorCode, versionId) =>
  api.get(`/rates/vendors/${vendorCode}/versions/${versionId}`).then((res) => res.data)

/**
 * Activate a validated vendor rate version (archives previous active)
 */
export const activateVendorVersion = (vendorCode, versionId) =>
  api.put(`/rates/vendors/${vendorCode}/versions/${versionId}/activate`).then((res) => res.data)

/**
 * Get diff comparison between a version and current active
 */
export const getVendorVersionDiff = (vendorCode, versionId) =>
  api.get(`/rates/vendors/${vendorCode}/versions/${versionId}/diff`).then((res) => res.data)

/**
 * Delete a draft/failed vendor rate version
 */
export const deleteVendorVersion = (vendorCode, versionId) =>
  api.delete(`/rates/vendors/${vendorCode}/versions/${versionId}`).then((res) => res.data)

/**
 * Get destinations list for a vendor (from active rate sheet)
 */
export const getVendorDestinations = (vendorCode = 'pacific') =>
  api.get(`/rates/vendors/${vendorCode}/destinations`).then((res) => res.data)

/**
 * Test rate calculation against active vendor rates
 * @param {Object} params - { vendor_code, country, postcode, weight, service_code }
 */
export const calculateVendorRate = (params) =>
  api.post('/rates/calculate', params).then((res) => res.data)

