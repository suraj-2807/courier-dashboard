import api from './axios'

export const countryCodesApi = {
  getAll: () => api.get('/country-codes'),
  import: (rows) => api.post('/country-codes/import', { rows }),
  add: (data) => api.post('/country-codes', data),
  delete: (id) => api.delete(`/country-codes/${id}`)
}
