export const SHIPMENT_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'warning' },
  { value: 'booked', label: 'Booked', color: 'info' },
  { value: 'picked_up', label: 'Picked Up', color: 'info' },
  { value: 'in_transit', label: 'In Transit', color: 'info' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'warning' },
  { value: 'delivered', label: 'Delivered', color: 'success' },
  { value: 'failed', label: 'Failed', color: 'danger' },
  { value: 'cancelled', label: 'Cancelled', color: 'danger' }
]

export const PAYMENT_MODES = [
  { value: 'prepaid', label: 'Prepaid' },
  { value: 'cod', label: 'COD' },
  { value: 'to_pay', label: 'To Pay' }
]

export const PACKAGE_TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'parcel', label: 'Parcel' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'heavy', label: 'Heavy' }
]
