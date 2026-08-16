import { useQuery } from '@tanstack/react-query'
import { trackingApi } from '../api/tracking.api'

export const useTrackingSearch = (trackingNumber) => {
  return useQuery({
    queryKey: ['tracking', trackingNumber],
    queryFn: () =>
      trackingApi.search(trackingNumber).then((res) => res.data),
    enabled: !!trackingNumber && trackingNumber.length >= 5,
    retry: false
  })
}

export const useLiveTracking = (awb, vendorCode) => {
  return useQuery({
    queryKey: ['live-tracking', awb, vendorCode],
    queryFn: () =>
      trackingApi.liveTrack(awb, vendorCode).then((res) => res.data),
    enabled: !!awb && awb.length >= 3,
    retry: false,
    staleTime: 60000 // Cache for 1 minute
  })
}
