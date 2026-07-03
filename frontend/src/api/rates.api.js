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
