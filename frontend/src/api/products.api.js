import api from './axios'

export const productsApi = {
  getAll: (params = {}) => api.get('/products', { params }),
  search: (q, country = '') => api.get('/products/search', { params: { q, country } }),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  bulkImport: (products) => api.post('/products/bulk-import', { products })
}
