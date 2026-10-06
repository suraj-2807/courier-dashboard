import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '../api/customers.api'

export const useCustomers = (params) => {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => customersApi.getAll(params).then((res) => res.data),
    keepPreviousData: true
  })
}

export const useCustomerById = (id) => {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.getById(id).then((res) => res.data),
    enabled: !!id
  })
}

export const useCreateCustomer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => customersApi.create(data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    }
  })
}

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => customersApi.update(id, data).then((res) => res.data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] })
    }
  })
}

export const useToggleCustomerStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) => customersApi.toggleStatus(id, status).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    }
  })
}

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => customersApi.delete(id).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    }
  })
}

export const useCustomerLedger = (id) => {
  return useQuery({
    queryKey: ['customer-ledger', id],
    queryFn: () => customersApi.getLedger(id).then((res) => res.data),
    enabled: !!id
  })
}

export const useCreateLedgerEntry = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => customersApi.createLedgerEntry(id, data).then((res) => res.data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['customer-ledger', variables.id] })
    }
  })
}

export const useDeleteLedgerEntry = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entryId }) => customersApi.deleteLedgerEntry(id, entryId).then((res) => res.data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['customer-ledger', variables.id] })
    }
  })
}
