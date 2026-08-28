import api from './axios'

export const customerApi = {
  // Addresses
  getAddresses: (params) => api.get('/customer/addresses', { params }),
  saveAddress: (data) => api.post('/customer/addresses', data),
  updateAddress: (id, data) => api.put(`/customer/addresses/${id}`, data),
  deleteAddress: (id) => api.delete(`/customer/addresses/${id}`),

  // Documents
  getDocuments: (params) => api.get('/customer/documents', { params }),
  saveDocument: (data) => api.post('/customer/documents', data),
  deleteDocument: (id) => api.delete(`/customer/documents/${id}`),
  uploadDocument: (formData) => api.post('/customer/upload-document', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  // Booking Requests
  submitBookingRequest: (data) => api.post('/customer/booking-requests', data),
  getMyRequests: (params) => api.get('/customer/my-requests', { params }),
  getRequestDetail: (requestAwb) => api.get(`/customer/my-requests/${requestAwb}`)
}
