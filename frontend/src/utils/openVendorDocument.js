import { bookingsApi } from '../api/bookings.api'
import toast from 'react-hot-toast'

/**
 * Universal helper to open the vendor's label / invoice PDF in a new tab.
 * 
 * Supports:
 * 1. Base64 encoded PDF inside vendor_raw_response (labels array or label property)
 * 2. Data URI inside vendor_label_url
 * 3. External HTTP / HTTPS links
 * 4. Fallback to /api/bookings/:id/vendor-document backend stream endpoint
 */
export async function openVendorDocument(booking, docType = 'document') {
  if (!booking) {
    toast.error('Shipment information not found')
    return false
  }

  // Helper to open base64 string directly in a new tab
  const openBase64 = (base64Str) => {
    try {
      const clean = String(base64Str).replace(/^data:application\/pdf;base64,/, '').trim()
      const byteChars = atob(clean)
      const byteNums = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNums)
      const blob = new Blob([byteArray], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
      return true
    } catch (err) {
      console.warn('Failed to parse client-side base64 PDF:', err.message)
      return false
    }
  }

  // 1. Check vendor_label_url in memory
  if (booking.vendor_label_url) {
    const vUrl = String(booking.vendor_label_url).trim()
    if (vUrl.startsWith('data:application/pdf;base64,') || (vUrl.length > 200 && !vUrl.startsWith('http') && !vUrl.startsWith('/'))) {
      if (openBase64(vUrl)) return true
    }
    if (vUrl.startsWith('http://') || vUrl.startsWith('https://')) {
      window.open(vUrl, '_blank')
      return true
    }
  }

  // 2. Check vendor_raw_response in memory
  if (booking.vendor_raw_response) {
    let raw = booking.vendor_raw_response
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch {}
    }

    if (raw && typeof raw === 'object') {
      // Check labels array
      if (Array.isArray(raw.labels) && raw.labels.length > 0) {
        const item = raw.labels.find(l => l && (l.label || l.pdf || l.invoice)) || raw.labels[0]
        const b64 = item?.label || item?.pdf || item?.invoice || (typeof item === 'string' ? item : '')
        if (b64 && openBase64(b64)) return true
      }
      if (raw.data && Array.isArray(raw.data.labels) && raw.data.labels.length > 0) {
        const item = raw.data.labels[0]
        const b64 = item?.label || item?.pdf || item?.invoice || (typeof item === 'string' ? item : '')
        if (b64 && openBase64(b64)) return true
      }

      // Check direct properties
      const directVal = raw.label || raw.Label || raw.AuxLbl || raw.invoice || raw.Invoice || raw.pdf ||
                        raw.data?.label || raw.data?.invoice || raw.data?.label_url || raw.data?.invoice_url ||
                        raw.Response?.Label || raw.Response?.Invoice
      if (directVal) {
        const val = String(directVal).trim()
        if (val.startsWith('http://') || val.startsWith('https://')) {
          window.open(val, '_blank')
          return true
        }
        if (openBase64(val)) return true
      }
    }
  }

  // 3. Fallback: Request via authenticated backend endpoint
  const toastId = toast.loading(`Loading vendor ${docType}...`)
  try {
    const res = await bookingsApi.getVendorDocument(booking.id)
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    toast.success(`Vendor ${docType} opened in new tab`, { id: toastId })
    return true
  } catch (err) {
    const msg = err?.response?.data?.message || `No vendor ${docType} available from carrier API for this shipment`
    toast.error(msg, { id: toastId })
    return false
  }
}
