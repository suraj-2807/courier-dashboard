import api from './axios'

export const customersApi = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  toggleStatus: (id, status) => api.patch(`/customers/${id}/status`, { status }),
  delete: (id) => api.delete(`/customers/${id}`)
}
