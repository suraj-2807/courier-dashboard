import api from './axios'

export const sendersApi = {
  getAll: () => api.get('/senders'),
  search: (q) => api.get(`/senders/search?q=${encodeURIComponent(q)}`),
  getById: (id) => api.get(`/senders/${id}`),
  create: (data) => api.post('/senders', data),
  update: (id, data) => api.put(`/senders/${id}`, data),
  delete: (id) => api.delete(`/senders/${id}`),
  bulkImport: (senders) => api.post('/senders/bulk-import', { senders })
}
