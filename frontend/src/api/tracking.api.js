import api from './axios'

export const trackingApi = {
  search: (trackingNumber) =>
    api.get('/tracking/search', {
      params: { tracking_number: trackingNumber }
    })
}
