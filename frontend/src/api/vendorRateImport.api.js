import api from './axios'

/**
 * Validate vendor rate workbook without importing (dry-run / preview)
 */
export const validateVendorWorkbook = (file, vendorName) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('vendor_name', vendorName)
  return api.post('/vendor-rate-imports/validate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((res) => res.data)
}

/**
 * Import vendor rate workbook (validate + commit to DB)
 */
export const importVendorWorkbook = (file, vendorName) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('vendor_name', vendorName)
  return api.post('/vendor-rate-imports/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((res) => res.data)
}

/**
 * Get all import batches with optional vendor filter
 */
export const getImportBatches = (params = {}) =>
  api.get('/vendor-rate-imports/batches', { params }).then((res) => res.data)

/**
 * Get detailed batch info and paginated records
 */
export const getBatchDetail = (batchId, params = {}) =>
  api.get(`/vendor-rate-imports/batches/${batchId}`, { params }).then((res) => res.data)

/**
 * Delete an import batch and all its records
 */
export const deleteImportBatch = (batchId) =>
  api.delete(`/vendor-rate-imports/batches/${batchId}`).then((res) => res.data)

/**
 * Get distinct imported vendor names
 */
export const getImportVendors = () =>
  api.get('/vendor-rate-imports/vendors').then((res) => res.data)
