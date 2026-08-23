import api from './axios'

export const bookingsApi = {
  getAll: (params) => api.get('/bookings', { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  create: (data) => api.post('/bookings', data),
  save: (data) => api.post('/bookings/save', data),
  pushToApi: (id, data) => api.post(`/bookings/${id}/push`, data),
  downloadInvoice: (id) => api.get(`/bookings/${id}/invoice-pdf`, { responseType: 'blob' }),
  downloadWaybill: (id) => api.get(`/bookings/${id}/bill-pdf`, { responseType: 'blob' }),
  downloadBoxLabels: (id) => api.get(`/bookings/${id}/labels-pdf`, { responseType: 'blob' }),
  updateStatus: (id, data) => api.patch(`/bookings/${id}/status`, data),
  updateBilling: (id, data) => api.patch(`/bookings/${id}/billing`, data)
}
