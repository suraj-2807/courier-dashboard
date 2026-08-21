import api from './axios'

export const systemSettingsApi = {
  getAll: () => api.get('/system-settings').then((res) => res.data),
  update: (data) => api.post('/system-settings', data).then((res) => res.data)
}
