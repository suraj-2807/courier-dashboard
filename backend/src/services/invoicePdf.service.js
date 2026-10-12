import PDFDocument from 'pdfkit'
import bwipjs from 'bwip-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Ensure uploads directory exists
const INVOICES_DIR = path.join(__dirname, '..', '..', 'uploads', 'invoices')
if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true })
}

// Logo path
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'PRINCE LOGO.png')

/**
 * Convert number to words (Indian format for INR)
 */
function numberToWords(num) {
  if (num === 0) return 'Zero'
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  
  function convertGroup(n) {
    if (n === 0) return ''
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertGroup(n % 100) : '')
  }
  
  const intPart = Math.floor(num)
  
  if (intPart >= 10000000) {
    const crore = Math.floor(intPart / 10000000)
    const rem = intPart % 10000000
    return convertGroup(crore) + ' Crore' + (rem > 0 ? ' ' + numberToWords(rem) : '')
  }
  if (intPart >= 100000) {
    const lakh = Math.floor(intPart / 100000)
    const rem = intPart % 100000
    return convertGroup(lakh) + ' Lakh' + (rem > 0 ? ' ' + numberToWords(rem) : '')
  }
  if (intPart >= 1000) {
    const thousand = Math.floor(intPart / 1000)
    const rem = intPart % 1000
    return convertGroup(thousand) + ' Thousand' + (rem > 0 ? ' ' + numberToWords(rem) : '')
  }
  return convertGroup(intPart)
}

/**
 * Generate barcode PNG buffer for the AWB number
 */
async function generateBarcode(awbNumber) {
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: String(awbNumber),
      scale: 3,
      height: 12,
      includetext: true,
      textxalign: 'center',
      textsize: 10
    })
    return png
  } catch (err) {
    console.error('Barcode generation failed:', err.message)
    return null
  }
}

/**
 * Generate an invoice PDF for a shipment.
 * Simple plain black-and-white bordered table format (no firm name, no colors).
 */
export async function generateInvoicePdf(params) {
  const {
    awbNumber,
    sender = {},
    receiver = {},
    shipment = {},
    invoiceItems = [],
    invoiceMeta = {},
    parcelsData = []
  } = params

  const invoiceNo = awbNumber
  const invoiceDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const currency = invoiceMeta.currency || 'INR'
  const incoterms = invoiceMeta.incoterms || 'CIF'

  // Parse parcels data
  let parsedParcels = []
  if (parcelsData && parcelsData.length > 0) {
    parsedParcels = parcelsData
  } else if (shipment.parcels) {
    try {
      parsedParcels = typeof shipment.parcels === 'string' ? JSON.parse(shipment.parcels) : shipment.parcels
      if (!Array.isArray(parsedParcels)) parsedParcels = []
    } catch { parsedParcels = [] }
  }

  const totalPieces = parseInt(shipment.no_of_pieces) || (parsedParcels.length > 0 ? parsedParcels.length : 1)
  let actualWeight = parseFloat(shipment.weight) || 0
  if (actualWeight <= 0 && parsedParcels.length > 0) {
    actualWeight = Math.round(parsedParcels.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0) * 1000) / 1000
  }

  const l = parseFloat(shipment.length) || 0
  const b = parseFloat(shipment.breadth) || 0
  const h = parseFloat(shipment.height) || 0
  let volWeight = parseFloat(shipment.volumetric_weight) || 0
  if (volWeight <= 0 && parsedParcels.length > 0) {
    volWeight = Math.round(parsedParcels.reduce((sum, p) => {
      const pl = parseFloat(p.length) || 0
      const pb = parseFloat(p.breadth || p.width) || 0
      const ph = parseFloat(p.height) || 0
      const pVol = (pl > 0 && pb > 0 && ph > 0) ? ((pl * pb * ph) / 5000) : 0
      return sum + (parseFloat(p.volumetric_weight) || pVol)
    }, 0) * 100) / 100
  }
  if (volWeight <= 0 && l > 0 && b > 0 && h > 0) {
    volWeight = Math.round(((l * b * h) / 5000) * totalPieces * 100) / 100
  }

  const shippingChargeVal = parseFloat(shipment.shipping_charge || shipment.amount || 0) || 0
  const extraChargeVal = parseFloat(shipment.extra_charge || 0) || 0

  // Calculate total amount from items or shipment data
  let totalAmount = 0
  invoiceItems.forEach(item => {
    totalAmount += parseFloat(item.amount) || 0
  })
  if (parseFloat(shipment.total_amount) > 0) {
    totalAmount = parseFloat(shipment.total_amount)
  } else if (shippingChargeVal > 0) {
    totalAmount = shippingChargeVal + extraChargeVal
  } else if (totalAmount === 0) {
    totalAmount = parseFloat(invoiceMeta.total_amount) || 0
  }

  // Destination country
  const destCountry = (receiver.country || shipment.destination_country || '').toUpperCase()

  // Aadhar / ID info from sender
  const senderIdLabel = sender.gstin_type || ''
  const senderIdNo = sender.gstin_no || ''

  // Other reference
  const otherRef = shipment.order_reference || ''

  // Create PDF
  const fileName = `invoice_${awbNumber}_${Date.now()}.pdf`
  const filePath = path.join(INVOICES_DIR, fileName)
  const relativePath = `uploads/invoices/${fileName}`

  // All black for simple style
  const BLACK = '#000000'

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 20, bottom: 20, left: 25, right: 25 } })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    const pageWidth = doc.page.width - 50 // margins
    const leftMargin = 25
    const halfWidth = pageWidth / 2
    let y = 20
    const lineH = 14
    const borderW = 0.8

    // ─── ROW 1: Invoice Info (left) + AWB Info (right) ───
    const row1Height = 85
    doc.rect(leftMargin, y, halfWidth, row1Height).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.rect(leftMargin + halfWidth, y, halfWidth, row1Height).strokeColor(BLACK).lineWidth(borderW).stroke()

    // Left: Invoice details
    doc.fillColor(BLACK).fontSize(9).font('Helvetica-Bold')
    let lx = leftMargin + 6
    let ly = y + 8
    doc.text(`INVOICE NO.:  ${invoiceNo}`, lx, ly); ly += lineH
    doc.text(`INVOICE DATE. :  ${invoiceDate}`, lx, ly); ly += lineH
    doc.text(`TOTAL PIECES :  ${totalPieces}`, lx, ly); ly += lineH
    doc.text(`ACTUAL WEIGHT :  ${actualWeight.toFixed(2)}`, lx, ly); ly += lineH
    doc.text(`VOLUMETRIC WEIGHT :   ${volWeight.toFixed(2)}`, lx, ly)

    // Right: AWB + Other Ref + ID
    let rx = leftMargin + halfWidth + 6
    let ry = y + 8
    doc.font('Helvetica-Bold').text(`AWB NO. :  ${awbNumber}`, rx, ry); ry += lineH
    doc.text(`OTHER REFERENCE${otherRef ? ` :  ${otherRef}` : ''}`, rx, ry); ry += lineH
    if (senderIdNo) {
      const docLabel = (senderIdLabel && !/none/i.test(senderIdLabel)) ? senderIdLabel.toUpperCase() : 'AADHAR CARD'
      doc.text(`${docLabel} :  ${senderIdNo}`, rx, ry); ry += lineH
    }

    y += row1Height

    // ─── ROW 2: Shipper (left) + Consignee (right) ───
    const row2Height = 120

    // Shipper header
    doc.rect(leftMargin, y, halfWidth, 18).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.rect(leftMargin + halfWidth, y, halfWidth, 18).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.fontSize(9).font('Helvetica-Bold')
    doc.text('SHIPPER', leftMargin + 6, y + 4)
    doc.text('CONSIGNEE', leftMargin + halfWidth + 6, y + 4)
    y += 18

    // Shipper + Consignee details
    doc.rect(leftMargin, y, halfWidth, row2Height).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.rect(leftMargin + halfWidth, y, halfWidth, row2Height).strokeColor(BLACK).lineWidth(borderW).stroke()

    doc.fontSize(8.5).font('Helvetica-Bold')
    let sy = y + 6
    if (sender.name) { doc.text(`${sender.name.toUpperCase()}`, leftMargin + 6, sy); sy += lineH }
    doc.font('Helvetica')
    if (sender.company) { doc.font('Helvetica-Bold').text(`COMPANY NAME   ${sender.company.toUpperCase()}`, leftMargin + 6, sy); doc.font('Helvetica'); sy += lineH }
    const senderAddr = [sender.address, sender.address_2].filter(Boolean).join(', ')
    if (senderAddr) { doc.font('Helvetica-Bold').text(`ADDRESS :  `, leftMargin + 6, sy, { continued: true }).font('Helvetica').text(senderAddr.toUpperCase(), { width: halfWidth - 14 }); sy += (senderAddr.length > 45 ? 24 : lineH) }
    const senderCityLine = [sender.city, sender.state].filter(Boolean).join(', ')
    if (senderCityLine) { doc.text(senderCityLine.toUpperCase(), leftMargin + 6, sy); sy += lineH }
    if (sender.country) { doc.text(`${sender.country.toUpperCase()}, ${sender.pincode || ''}`, leftMargin + 6, sy); sy += lineH }
    if (sender.email) { doc.font('Helvetica-Bold').text('EMAIL', leftMargin + 6, sy); sy += lineH }
    if (sender.phone) { doc.font('Helvetica-Bold').text(`PHONE NUMBER :  ${sender.phone}`, leftMargin + 6, sy) }

    // Consignee details
    let ry2 = y + 6
    doc.font('Helvetica-Bold').fontSize(8.5)
    if (receiver.name) { doc.text(`${receiver.name.toUpperCase()}`, leftMargin + halfWidth + 6, ry2); ry2 += lineH }
    doc.font('Helvetica')
    if (receiver.company) { doc.font('Helvetica-Bold').text(`COMPANY NAME   ${receiver.company.toUpperCase()}`, leftMargin + halfWidth + 6, ry2); doc.font('Helvetica'); ry2 += lineH }
    const receiverAddr = [receiver.address, receiver.address_2].filter(Boolean).join(', ')
    if (receiverAddr) { doc.font('Helvetica-Bold').text(`ADDRESS :  `, leftMargin + halfWidth + 6, ry2, { continued: true }).font('Helvetica').text(receiverAddr.toUpperCase(), { width: halfWidth - 14 }); ry2 += (receiverAddr.length > 45 ? 24 : lineH) }
    const receiverCityLine = [receiver.city, receiver.state].filter(Boolean).join(', ')
    if (receiverCityLine) { doc.text(receiverCityLine.toUpperCase(), leftMargin + halfWidth + 6, ry2); ry2 += lineH }
    if (receiver.country) { doc.text(`${receiver.country.toUpperCase()}, ${receiver.pincode || ''}`, leftMargin + halfWidth + 6, ry2); ry2 += lineH }
    if (receiver.email) { doc.font('Helvetica-Bold').text(`EMAIL  ${receiver.email}`, leftMargin + halfWidth + 6, ry2); ry2 += lineH }
    if (receiver.phone) { doc.font('Helvetica-Bold').text(`PHONE NUMBER :  + ${receiver.phone}`, leftMargin + halfWidth + 6, ry2) }

    y += row2Height

    // ─── DESTINATION BAR ───
    doc.rect(leftMargin, y, pageWidth, 18).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.fontSize(9).font('Helvetica-Bold')
    doc.text(`DESTINATION: ${destCountry}`, leftMargin + 4, y + 4, { width: pageWidth - 8, align: 'center' })
    y += 18

    // ─── ITEMS TABLE HEADER ───
    const colWidths = {
      sr: 35, description: 140, hs: 65, cto: 35, unit: 45, unitWt: 50, qty: 55, rates: 55, amount: 60
    }
    const totalColWidth = Object.values(colWidths).reduce((a, b) => a + b, 0)
    // Scale columns to fit page width
    const scale = pageWidth / totalColWidth
    Object.keys(colWidths).forEach(k => { colWidths[k] = Math.round(colWidths[k] * scale) })

    // Table header row
    const headerH = 28
    doc.rect(leftMargin, y, pageWidth, headerH).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.fillColor(BLACK).fontSize(7.5).font('Helvetica-Bold')

    let cx = leftMargin
    const headers = [
      { text: 'SR\nNO.', w: colWidths.sr },
      { text: 'DESCRIPTION', w: colWidths.description },
      { text: 'HS\nCODE', w: colWidths.hs },
      { text: 'C/T/O', w: colWidths.cto },
      { text: 'UNIT\nTYPE', w: colWidths.unit },
      { text: 'UNIT\nWEIGHT', w: colWidths.unitWt },
      { text: 'QUANTITY', w: colWidths.qty },
      { text: 'UNIT\nRATES', w: colWidths.rates },
      { text: `AMOUNT\n(${incoterms || 'CIF'})`, w: colWidths.amount }
    ]
    headers.forEach(h => {
      doc.rect(cx, y, h.w, headerH).strokeColor(BLACK).lineWidth(0.5).stroke()
      doc.text(h.text, cx + 2, y + 4, { width: h.w - 4, align: 'center' })
      cx += h.w
    })
    y += headerH

    // ─── Build items grouped by box/parcel ───
    // If no parcels, create a single box from main shipment dimensions
    let boxesToRender = parsedParcels
    if (boxesToRender.length === 0) {
      boxesToRender = [{
        parcel_no: 1,
        weight: shipment.weight || 0,
        length: shipment.length || 0,
        breadth: shipment.breadth || 0,
        height: shipment.height || 0
      }]
    }

    // Distribute invoice items across boxes (all items go to box 1 if no box assignment)
    const items = invoiceItems.length > 0 ? invoiceItems : [{
      sr_no: 1,
      description: shipment.content_description || 'PARCEL GOODS',
      hs_code: '',
      c_t_o: 'IN',
      unit_type: 'PCS',
      unit_weight: '0.00',
      quantity: totalPieces,
      unit_rates: (totalAmount / totalPieces) || 0,
      amount: totalAmount
    }]

    boxesToRender.forEach((parcel, boxIdx) => {
      const boxNo = parcel.parcel_no || parcel.box_no || (boxIdx + 1)
      const pl = parseFloat(parcel.length) || l
      const pb = parseFloat(parcel.breadth || parcel.width) || b
      const ph = parseFloat(parcel.height) || h
      const pw = parseFloat(parcel.weight) || actualWeight

      // Box banner row
      const bannerText = `BOX NO: ${boxNo} , DIMENSIONS (CMS) ${pl.toFixed(2)} * ${pb.toFixed(2)} * ${ph.toFixed(2)} , ACTUAL WEIGHT - ${pw.toFixed(2)} KG`
      doc.rect(leftMargin, y, pageWidth, 16).strokeColor(BLACK).lineWidth(borderW).stroke()
      doc.fillColor(BLACK).fontSize(7.5).font('Helvetica-Bold')
         .text(bannerText, leftMargin + 4, y + 4, { width: pageWidth - 8, align: 'center' })
      y += 16

      // Items for this box (if only one box, show all items; otherwise filter by box_no)
      const boxItems = boxesToRender.length === 1
        ? items
        : items.filter(item => (parseInt(item.box_no) || 1) === (boxIdx + 1))

      // If no items for this box, show at least the box banner
      const displayItems = boxItems.length > 0 ? boxItems : items.filter((_, i) => boxIdx === 0 && boxesToRender.length > 1)

      displayItems.forEach((item, idx) => {
        const rowH = 18
        doc.rect(leftMargin, y, pageWidth, rowH).strokeColor(BLACK).lineWidth(0.3).stroke()
        doc.fillColor(BLACK).fontSize(7.5).font('Helvetica')

        const qty = parseFloat(item.quantity || 1)
        const amt = parseFloat(item.amount) || 0
        const rate = parseFloat(item.unit_rates) || (amt > 0 && qty > 0 ? amt / qty : 0)
        const unitWt = parseFloat(item.unit_weight) || 0

        cx = leftMargin
        // Draw cell borders
        headers.forEach(h => {
          doc.rect(cx, y, h.w, rowH).strokeColor(BLACK).lineWidth(0.3).stroke()
          cx += h.w
        })

        cx = leftMargin
        doc.text(String(item.sr_no || idx + 1), cx + 2, y + 4, { width: colWidths.sr - 4, align: 'center' }); cx += colWidths.sr
        doc.text(String(item.description || '').toUpperCase(), cx + 2, y + 4, { width: colWidths.description - 4, align: 'left' }); cx += colWidths.description
        doc.text(String(item.hs_code || ''), cx + 2, y + 4, { width: colWidths.hs - 4, align: 'center' }); cx += colWidths.hs
        doc.text(String(item.c_t_o || item.origin || 'IN'), cx + 2, y + 4, { width: colWidths.cto - 4, align: 'center' }); cx += colWidths.cto
        doc.text(String(item.unit_type || 'PCS'), cx + 2, y + 4, { width: colWidths.unit - 4, align: 'center' }); cx += colWidths.unit
        doc.text(unitWt.toFixed(2), cx + 2, y + 4, { width: colWidths.unitWt - 4, align: 'center' }); cx += colWidths.unitWt
        doc.text(String(qty), cx + 2, y + 4, { width: colWidths.qty - 4, align: 'center' }); cx += colWidths.qty
        doc.text(rate.toFixed(2), cx + 2, y + 4, { width: colWidths.rates - 4, align: 'right' }); cx += colWidths.rates
        doc.text(amt.toFixed(2), cx + 2, y + 4, { width: colWidths.amount - 4, align: 'right' })

        y += rowH
      })
    })

    // Empty rows to fill space
    const emptyRowsNeeded = Math.max(0, 3 - items.length)
    for (let i = 0; i < emptyRowsNeeded; i++) {
      doc.rect(leftMargin, y, pageWidth, 16).strokeColor(BLACK).lineWidth(0.3).stroke()
      headers.forEach(h => {
        doc.rect(leftMargin, y, h.w, 16).strokeColor(BLACK).lineWidth(0.3).stroke()
      })
      y += 16
    }

    // ─── TOTALS ROW ───
    y += 2
    doc.rect(leftMargin, y, pageWidth, 22).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.fillColor(BLACK).fontSize(9).font('Helvetica-Bold')
    doc.text('TOTAL AMOUNT', leftMargin + 4, y + 6, { width: pageWidth - colWidths.amount - 10, align: 'right' })
    doc.text(`${totalAmount.toFixed(2)}`, leftMargin + pageWidth - colWidths.amount - 4, y + 6, { width: colWidths.amount, align: 'right' })
    y += 26

    // ─── DECLARATION ───
    doc.rect(leftMargin, y, pageWidth, 36).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.fillColor(BLACK).fontSize(7).font('Helvetica')
       .text('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', leftMargin + 6, y + 6, { width: pageWidth - 14, lineGap: 1.5 })
    doc.fontSize(7).font('Helvetica-Bold')
       .text('Authorized Signatory', leftMargin + pageWidth - 140, y + 22, { width: 130, align: 'right' })

    // Finalize
    doc.end()

    stream.on('finish', () => {
      resolve(filePath)
    })
    stream.on('error', (err) => {
      reject(err)
    })
  })
}

