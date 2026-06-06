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
