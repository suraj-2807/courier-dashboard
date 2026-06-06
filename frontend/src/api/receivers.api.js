import api from './axios'

export const receiversApi = {
  getAll: () => api.get('/receivers'),
  getById: (id) => api.get(`/receivers/${id}`),
  create: (data) => api.post('/receivers', data),
  update: (id, data) => api.put(`/receivers/${id}`, data),
  delete: (id) => api.delete(`/receivers/${id}`)
}
