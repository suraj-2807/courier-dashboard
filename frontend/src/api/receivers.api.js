import api from './axios'

export const receiversApi = {
  getAll: () => api.get('/receivers'),
  search: (q) => api.get(`/receivers/search?q=${encodeURIComponent(q)}`),
  getById: (id) => api.get(`/receivers/${id}`),
  create: (data) => api.post('/receivers', data),
  update: (id, data) => api.put(`/receivers/${id}`, data),
  delete: (id) => api.delete(`/receivers/${id}`),
  bulkImport: (receivers) => api.post('/receivers/bulk-import', { receivers })
}
