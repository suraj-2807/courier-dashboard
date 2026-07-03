import api from './axios'

/**
 * Get all vendor API configurations
 */
export const getApiSettings = () =>
  api.get('/api-settings').then((res) => res.data)

/**
 * Get active vendors (for booking dropdown)
 */
export const getActiveVendors = () =>
  api.get('/api-settings/active-vendors').then((res) => res.data)

/**
 * Get a single vendor API configuration
 */
export const getApiSettingById = (id) =>
  api.get(`/api-settings/${id}`).then((res) => res.data)

/**
 * Create a new vendor API configuration
 */
export const createApiSetting = (data) =>
  api.post('/api-settings', data).then((res) => res.data)

/**
 * Update a vendor API configuration
 */
export const updateApiSetting = (id, data) =>
  api.put(`/api-settings/${id}`, data).then((res) => res.data)

/**
 * Delete a vendor API configuration
 */
export const deleteApiSetting = (id) =>
  api.delete(`/api-settings/${id}`).then((res) => res.data)

/**
 * Test connection to a vendor API
 */
export const testApiConnection = (id) =>
  api.post(`/api-settings/${id}/test`).then((res) => res.data)

/**
 * Toggle active status
 */
export const toggleApiSetting = (id) =>
  api.patch(`/api-settings/${id}/toggle`).then((res) => res.data)

/**
 * Save auth token & customer_id after successful test
 */
export const saveAuthToken = (id, tokenData) =>
  api.post(`/api-settings/${id}/save-auth-token`, tokenData).then((res) => res.data)

/**
 * Push test data to a vendor API
 */
export const pushTestData = (id, sampleData) =>
  api.post(`/api-settings/${id}/push-test`, { sample_data: sampleData }).then((res) => res.data)

/**
 * Get push logs for a vendor
 */
export const getPushLogs = (id) =>
  api.get(`/api-settings/${id}/push-logs`).then((res) => res.data)

/**
 * Get available internal fields for mapping
 */
export const getInternalFields = () =>
  api.get('/api-settings/internal-fields').then((res) => res.data)

/**
 * Extract field paths from a JSON template
 */
export const extractTemplatePaths = (template) =>
  api.post('/api-settings/extract-template-paths', { template }).then((res) => res.data)
