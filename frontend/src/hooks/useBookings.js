import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bookingsApi } from '../api/bookings.api'

export const useBookings = (params) => {
  return useQuery({
    queryKey: ['bookings', params],
    queryFn: () => bookingsApi.getAll(params).then((res) => res.data),
    keepPreviousData: true
  })
}

export const useBookingById = (id) => {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.getById(id).then((res) => res.data),
    enabled: !!id
  })
}

export const useCreateBooking = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => bookingsApi.create(data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }
  })
}

export const useSaveBooking = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => bookingsApi.save(data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }
  })
}

export const usePushBookingToApi = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (param) => {
      const id = typeof param === 'object' && param !== null ? param.id : param
      const payload = typeof param === 'object' && param !== null ? param.payload : undefined
      return bookingsApi.pushToApi(id, payload).then((res) => res.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['booking'] })
    }
  })
}

export const useUpdateBookingStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) =>
      bookingsApi.updateStatus(id, data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['booking'] })
    }
  })
}
