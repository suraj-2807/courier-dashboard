import { bookingsApi } from '../api/bookings.api'
import toast from 'react-hot-toast'

/**
 * Universal helper to open the vendor's label / invoice PDF in a new tab.
 * 
 * Supports:
 * 1. Base64 encoded PDF inside vendor_raw_response (labels array with filename discernment, or Pdfdownload, BoxLabel, etc.)
 * 2. Data URI inside vendor_label_url
 * 3. External HTTP / HTTPS links
 * 4. Fallback to /api/bookings/:id/vendor-document backend stream endpoint
 */
export async function openVendorDocument(booking, docType = 'document') {
  if (!booking) {
    toast.error('Shipment information not found')
    return false
  }

  const type = String(docType || 'document').toLowerCase().trim()

  // Helper to open base64 string directly in a new tab
  const openBase64 = (base64Str) => {
    try {
      if (!base64Str || typeof base64Str !== 'string') return false
      const clean = String(base64Str).replace(/^data:application\/pdf;base64,/, '').trim()
      if (clean.length < 50) return false
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

  // 1. Check vendor_raw_response in memory first with smart docType matching
  if (booking.vendor_raw_response) {
    let raw = booking.vendor_raw_response
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch {}
    }

    if (raw && typeof raw === 'object') {
      const resp = raw.Response || raw.response || raw.data || raw

      // Check labels array (e.g. ITD / FlySwift / Trackmate)
      const labelsArr = Array.isArray(raw.labels) ? raw.labels : (Array.isArray(raw.data?.labels) ? raw.data.labels : (Array.isArray(resp?.labels) ? resp.labels : null))
      
      if (labelsArr && labelsArr.length > 0) {
        let matchedItem = null

        if (type.includes('invoice')) {
          // 1. Vendor Invoice (e.g. freeform_invoice.pdf, invoice.pdf)
          matchedItem = labelsArr.find(l => {
            const fn = String(l?.filename || l?.file_name || l?.name || '').toLowerCase()
            return fn.includes('invoice') || fn.includes('freeform') || fn.includes('commercial') || l?.type === 'invoice' || l?.invoice
          })
        } else if (type.includes('shipper') || type.includes('bill') || type.includes('copy')) {
          // 2. Vendor Shipper Copy / Vendor Bill (e.g. vendor_shipper_copy.pdf)
          matchedItem = labelsArr.find(l => {
            const fn = String(l?.filename || l?.file_name || l?.name || '').toLowerCase()
            return fn.includes('shipper') || fn.includes('copy') || fn.includes('waybill') || fn.includes('bill')
          })
        } else if (type.includes('box') || type.includes('label')) {
          // 3. Vendor Box / Barcode Label (e.g. vendor_box_label.pdf)
          matchedItem = labelsArr.find(l => {
            const fn = String(l?.filename || l?.file_name || l?.name || '').toLowerCase()
            return fn.includes('box') || (fn.includes('label') && !fn.includes('shipper') && !fn.includes('invoice'))
          }) || labelsArr.find(l => {
            const fn = String(l?.filename || l?.file_name || l?.name || '').toLowerCase()
            return !fn.includes('invoice')
          })
        }

        // Fallback to first available in array if specific match not found
        if (!matchedItem) {
          matchedItem = labelsArr[0]
        }

        const b64 = matchedItem?.label || matchedItem?.pdf || matchedItem?.invoice || (typeof matchedItem === 'string' ? matchedItem : '')
        if (b64 && openBase64(b64)) return true
      }

      // Check Pacific Express / direct response properties
      if (type.includes('invoice')) {
        const invVal = resp.Pdfdownload || resp.pdfdownload || resp.PdfDownload || resp.Invoice || resp.invoice || resp.pdf || resp.Pdf ||
                       raw.Pdfdownload || raw.pdfdownload || raw.Invoice || raw.invoice
        if (invVal) {
          const valStr = String(invVal).trim()
          if (valStr.startsWith('http://') || valStr.startsWith('https://')) {
            window.open(valStr, '_blank')
            return true
          }
          if (openBase64(valStr)) return true
        }
      } else if (type.includes('shipper') || type.includes('bill') || type.includes('copy')) {
        const shipVal = resp.AuxLbl || resp.auxlbl || resp.Pdfdownload || resp.pdfdownload || resp.Pdf || resp.pdf ||
                        resp.BoxLabel || resp.boxlabel || resp.Label || resp.label ||
                        raw.AuxLbl || raw.auxlbl || raw.Pdfdownload || raw.pdfdownload
        if (shipVal) {
          const valStr = String(shipVal).trim()
          if (valStr.startsWith('http://') || valStr.startsWith('https://')) {
            window.open(valStr, '_blank')
            return true
          }
          if (openBase64(valStr)) return true
        }
      } else if (type.includes('box') || type.includes('label')) {
        const boxVal = resp.BoxLabel || resp.boxlabel || resp.Boxlabel || resp.box_label || resp.Label || resp.label ||
                       raw.BoxLabel || raw.boxlabel || raw.Label || raw.label
        if (boxVal) {
          const valStr = String(boxVal).trim()
          if (valStr.startsWith('http://') || valStr.startsWith('https://')) {
            window.open(valStr, '_blank')
            return true
          }
          if (openBase64(valStr)) return true
        }
      }
    }
  }

  // 2. Check vendor_label_url in memory
  if (booking.vendor_label_url && !type.includes('invoice')) {
    const vUrl = String(booking.vendor_label_url).trim()
    if (vUrl.startsWith('data:application/pdf;base64,') || (vUrl.length > 200 && !vUrl.startsWith('http') && !vUrl.startsWith('/'))) {
      if (openBase64(vUrl)) return true
    }
    if (vUrl.startsWith('http://') || vUrl.startsWith('https://')) {
      window.open(vUrl, '_blank')
      return true
    }
  }

  // 3. Fallback: Request via authenticated backend endpoint with docType query
  const toastId = toast.loading(`Loading vendor ${docType}...`)
  try {
    const res = await bookingsApi.getVendorDocument(booking.id, { type: docType })
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
