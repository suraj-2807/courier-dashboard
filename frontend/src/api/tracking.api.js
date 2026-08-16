import api from './axios'

export const trackingApi = {
  search: (trackingNumber) =>
    api.get('/tracking/search', {
      params: { tracking_number: trackingNumber }
    }),

  liveTrack: (awb, vendorCode) =>
    api.get('/tracking/live', {
      params: {
        awb,
        ...(vendorCode ? { vendor_code: vendorCode } : {})
      }
    })
}
