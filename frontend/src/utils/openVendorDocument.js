import { bookingsApi } from '../api/bookings.api'
import toast from 'react-hot-toast'

/**
 * Detect mobile devices
 */
export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '')
}

/**
 * Universal helper to open or download a PDF Blob on both desktop and mobile.
 * Works seamlessly on iOS Safari, Android Chrome, and Desktop browsers.
 */
export function openPdfBlob(blobData, filename = 'document.pdf') {
  try {
    const blob = blobData instanceof Blob 
      ? blobData 
      : new Blob([blobData], { type: 'application/pdf' })

    const blobUrl = window.URL.createObjectURL(blob)
    const isMobile = isMobileDevice()

    if (isMobile) {
      // Mobile Safari / Chrome handles direct download or file trigger reliably
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link)
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 120000)
      }, 300)
      return true
    }

    // On Desktop: Open in a single new tab
    const newTab = window.open(blobUrl, '_blank')
    if (!newTab) {
      // Popup blocked: Fallback to direct download in current context (NO target="_blank")
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link)
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 120000)
      }, 300)
    } else {
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 120000)
    }
    return true
  } catch (err) {
    console.error('Failed to open PDF blob:', err)
    return false
  }
}

export async function openPdfRequest(request, filename = 'document.pdf') {
  const pdfTab = window.open('', '_blank')
  try {
    const response = await request
    const blob = response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: 'application/pdf' })
    const signature = await blob.slice(0, 5).text()
    if (signature !== '%PDF-') {
      throw new Error('The server response was not a PDF document')
    }

    if (!pdfTab) return openPdfBlob(blob, filename)

    const blobUrl = window.URL.createObjectURL(blob)
    pdfTab.location.replace(blobUrl)
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 120000)
    return true
  } catch (error) {
    if (pdfTab && !pdfTab.closed) pdfTab.close()
    throw error
  }
}

/**
 * Universal helper to open a PDF URL (HTTP/HTTPS or data URI)
 */
export function openPdfUrl(urlStr, filename = 'document.pdf') {
  if (!urlStr || typeof urlStr !== 'string') return false
  const cleanUrl = urlStr.trim()

  if (cleanUrl.startsWith('data:application/pdf;base64,') || (cleanUrl.startsWith('data:') && cleanUrl.includes('base64,'))) {
    const base64Data = cleanUrl.split('base64,')[1]
    return openBase64Pdf(base64Data, filename)
  }

  try {
    const isMobile = isMobileDevice()
    if (isMobile) {
      const link = document.createElement('a')
      link.href = cleanUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link)
      }, 300)
      return true
    }

    // On Desktop: Open cleanly in a single new tab (do not pass 3rd arg 'noopener' to prevent window.open returning null)
    const newTab = window.open(cleanUrl, '_blank')
    if (!newTab) {
      // Popup blocked: Fallback to direct download in current context (NO target="_blank")
      const link = document.createElement('a')
      link.href = cleanUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link)
      }, 300)
    }
    return true
  } catch (err) {
    console.error('Failed to open PDF URL:', err)
    return false
  }
}

/**
 * Universal helper to decode base64 string and display/download PDF
 */
export function openBase64Pdf(base64Str, filename = 'document.pdf') {
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
    return openPdfBlob(blob, filename)
  } catch (err) {
    console.warn('Failed to parse client-side base64 PDF:', err.message)
    return false
  }
}

function isManagedUploadUrl(url) {
  try {
    const parsedUrl = new URL(url, window.location.origin)
    return parsedUrl.origin === window.location.origin && parsedUrl.pathname.startsWith('/uploads/')
  } catch {
    return false
  }
}

/**
 * Universal helper to open the vendor's label / invoice PDF.
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
  const awb = booking.tracking_number || booking.order_id || booking.id
  const fileName = `${type}_${awb}.pdf`

  // 0. Check explicit stored URLs first
  if (type.includes('invoice') && booking.vendor_invoice_url) {
    const vUrl = String(booking.vendor_invoice_url).trim()
    if (vUrl.startsWith('data:application/pdf;base64,') || (vUrl.length > 200 && !vUrl.startsWith('http') && !vUrl.startsWith('/'))) {
      if (openBase64Pdf(vUrl, fileName)) return true
    }
    if ((vUrl.startsWith('http://') || vUrl.startsWith('https://') || vUrl.startsWith('/')) && !isManagedUploadUrl(vUrl)) {
      return openPdfUrl(vUrl, fileName)
    }
  }

  if ((type.includes('shipper') || type.includes('bill') || type.includes('copy')) && booking.vendor_shipper_copy_url) {
    const vUrl = String(booking.vendor_shipper_copy_url).trim()
    if ((vUrl.startsWith('http://') || vUrl.startsWith('https://') || vUrl.startsWith('/')) && !isManagedUploadUrl(vUrl)) {
      return openPdfUrl(vUrl, fileName)
    }
  }

  if ((type.includes('box') || type.includes('label')) && booking.vendor_box_label_url) {
    const vUrl = String(booking.vendor_box_label_url).trim()
    if ((vUrl.startsWith('http://') || vUrl.startsWith('https://') || vUrl.startsWith('/')) && !isManagedUploadUrl(vUrl)) {
      return openPdfUrl(vUrl, fileName)
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
        if (b64 && openBase64Pdf(b64, fileName)) return true
      }

      // Check Pacific Express / direct response properties
      if (type.includes('invoice')) {
        // Detect Pacific-style response
        const isPacificResponse = !!(
          /pacific/i.test(booking.vendor_code || '') ||
          /pacific/i.test(booking.vac_vendor_code || '') ||
          /pacific/i.test(booking.vendor_name || '') ||
          String(resp?.ResponseCode || '').toLowerCase() === 'rt01' ||
          (resp?.AWBNo && resp?.RefNo) ||
          resp?.Performa !== undefined ||
          raw?.Response?.Performa !== undefined
        )

        if (isPacificResponse) {
          // Pacific: Use ONLY Performa for vendor invoice (Label/AuxLbl/Pdfdownload are shipping labels, not invoices)
          const performaVal = resp?.Performa || resp?.performa || raw?.Response?.Performa || ''
          if (performaVal) {
            const valStr = String(performaVal).trim()
            if (valStr.length > 50) {
              if (valStr.startsWith('http://') || valStr.startsWith('https://')) {
                return openPdfUrl(valStr, fileName)
              }
              if (openBase64Pdf(valStr, fileName)) return true
            }
          }
          // Pacific Performa not available — do NOT fall through to Label/Pdfdownload (those are shipping labels)
        } else {
          // Non-Pacific vendors: use existing fallback chain
          const invVal = resp.Pdfdownload || resp.pdfdownload || resp.PdfDownload || resp.Invoice || resp.invoice || resp.pdf || resp.Pdf ||
                         raw.Pdfdownload || raw.pdfdownload || raw.Invoice || raw.invoice
          if (invVal) {
            const valStr = String(invVal).trim()
            if (valStr.startsWith('http://') || valStr.startsWith('https://')) {
              return openPdfUrl(valStr, fileName)
            }
            if (openBase64Pdf(valStr, fileName)) return true
          }
        }
      } else if (type.includes('shipper') || type.includes('bill') || type.includes('copy')) {
        const shipVal = resp.AuxLbl || resp.auxlbl || resp.Pdfdownload || resp.pdfdownload || resp.Pdf || resp.pdf ||
                        resp.BoxLabel || resp.boxlabel || resp.Label || resp.label ||
                        raw.AuxLbl || raw.auxlbl || raw.Pdfdownload || raw.pdfdownload
        if (shipVal) {
          const valStr = String(shipVal).trim()
          if (valStr.startsWith('http://') || valStr.startsWith('https://')) {
            return openPdfUrl(valStr, fileName)
          }
          if (openBase64Pdf(valStr, fileName)) return true
        }
      } else if (type.includes('box') || type.includes('label')) {
        const boxVal = resp.BoxLabel || resp.boxlabel || resp.Boxlabel || resp.box_label || resp.Label || resp.label ||
                       raw.BoxLabel || raw.boxlabel || raw.Label || raw.label
        if (boxVal) {
          const valStr = String(boxVal).trim()
          if (valStr.startsWith('http://') || valStr.startsWith('https://')) {
            return openPdfUrl(valStr, fileName)
          }
          if (openBase64Pdf(valStr, fileName)) return true
        }
      }
    }
  }

  // 2. Check vendor_label_url in memory
  if (booking.vendor_label_url && !type.includes('invoice')) {
    const vUrl = String(booking.vendor_label_url).trim()
    if (vUrl.startsWith('data:application/pdf;base64,') || (vUrl.length > 200 && !vUrl.startsWith('http') && !vUrl.startsWith('/'))) {
      if (openBase64Pdf(vUrl, fileName)) return true
    }
    if ((vUrl.startsWith('http://') || vUrl.startsWith('https://')) && !isManagedUploadUrl(vUrl)) {
      return openPdfUrl(vUrl, fileName)
    }
  }

  // 3. Fallback: Request via authenticated backend endpoint with docType query
  const toastId = toast.loading(`Loading vendor ${docType}...`)
  try {
    await openPdfRequest(bookingsApi.getVendorDocument(booking.id, { type: docType }), fileName)
    toast.success(`Vendor ${docType} loaded successfully`, { id: toastId })
    return true
  } catch (err) {
    if (type.includes('invoice')) {
      // Fallback: Draft shipments or vendors without custom invoice can open Our Prince Invoice
      try {
        const invRes = await bookingsApi.downloadInvoice(booking.id)
        openPdfBlob(invRes.data, `PrinceInvoice_${awb}.pdf`)
        toast.success('Opened Prince Official Invoice', { id: toastId })
        return true
      } catch (invErr) {
        console.warn('Prince invoice fallback error:', invErr)
      }
    }
    const msg = err?.response?.data?.message || `No vendor ${docType} available from carrier API for this shipment`
    toast.error(msg, { id: toastId })
    return false
  }
}
