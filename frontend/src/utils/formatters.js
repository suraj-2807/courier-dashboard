export const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num)
}

export const formatDate = (dateString) => {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(dateString))
}

export const formatDateTime = (dateString) => {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateString))
}

export const formatTime = (dateString) => {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateString))
}

export const getStatusLabel = (status) => {
  const map = {
    draft: 'Draft',
    pending: 'Pending',
    requested: 'Requested',
    processing: 'Processing',
    booked: 'Booked',
    confirmed: 'Confirmed',
    picked_up: 'Picked Up',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    failed: 'Failed',
    cancelled: 'Cancelled',
    rejected: 'Rejected'
  }
  return map[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : '—')
}

export const getStatusColor = (status) => {
  const map = {
    draft: 'bg-slate-100 text-slate-700 border-slate-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    requested: 'bg-amber-50 text-amber-700 border-amber-200',
    processing: 'bg-blue-50 text-blue-700 border-blue-200',
    booked: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    picked_up: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    in_transit: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    out_for_delivery: 'bg-orange-50 text-orange-700 border-orange-200',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
    rejected: 'bg-red-50 text-red-700 border-red-200'
  }
  return map[status] || 'bg-gray-100 text-gray-600 border-gray-200'
}

export const truncate = (str, len = 20) => {
  if (!str) return '—'
  return str.length > len ? str.slice(0, len) + '...' : str
}
