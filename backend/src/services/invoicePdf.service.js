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

/**
 * Convert number to words (Indian format for INR / standard currency)
 */
function numberToWords(num, currency = 'INR') {
  if (!num || isNaN(num) || num === 0) return 'Zero Rupees Only'

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convertGroup(n) {
    if (n === 0) return ''
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertGroup(n % 100) : '')
  }

  function numberToWordsHelper(n) {
    if (n >= 10000000) {
      const crore = Math.floor(n / 10000000)
      const rem = n % 10000000
      return convertGroup(crore) + ' Crore' + (rem > 0 ? ' ' + numberToWordsHelper(rem) : '')
    }
    if (n >= 100000) {
      const lakh = Math.floor(n / 100000)
      const rem = n % 100000
      return convertGroup(lakh) + ' Lakh' + (rem > 0 ? ' ' + numberToWordsHelper(rem) : '')
    }
    if (n >= 1000) {
      const thousand = Math.floor(n / 1000)
      const rem = n % 1000
      return convertGroup(thousand) + ' Thousand' + (rem > 0 ? ' ' + numberToWordsHelper(rem) : '')
    }
    return convertGroup(n)
  }

  const intPart = Math.floor(Math.abs(num))
  const words = numberToWordsHelper(intPart).trim()
  const currLabel = (currency === 'INR' || currency === '₹') ? 'Rupees' : (currency || 'Rupees')
  return `${words} ${currLabel} Only`
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
      height: 10,
      includetext: true,
      textxalign: 'center',
      textsize: 8
    })
    return png
  } catch (err) {
    console.error('Barcode generation failed:', err.message)
    return null
  }
}

/**
 * Generate an invoice PDF for a shipment.
 * Full-page bordered table layout matching official format.
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

  const invoiceNo = invoiceMeta.invoice_no || awbNumber
  const invoiceDate = invoiceMeta.invoice_date || shipment.invoice_date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
  const currency = invoiceMeta.currency || shipment.invoice_currency || 'INR'
  const incoterms = invoiceMeta.incoterms || shipment.terms_of_trade || 'CIF'

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
    actualWeight = Math.round(parsedParcels.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0) * 100) / 100
  }

  const l = parseFloat(shipment.length) || 0
  const b = parseFloat(shipment.breadth || shipment.width) || 0
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

  const chargeableWeight = parseFloat(shipment.chargeable_weight || shipment.final_chargeable_weight) || Math.max(actualWeight, volWeight)

  // Calculate total amount from items or shipment data
  let totalAmount = 0
  if (invoiceItems && invoiceItems.length > 0) {
    invoiceItems.forEach(item => {
      totalAmount += parseFloat(item.amount) || (parseFloat(item.quantity || 1) * parseFloat(item.unit_rates || item.rate || 0)) || 0
    })
  }
  if (totalAmount <= 0) {
    if (parseFloat(shipment.total_amount) > 0) {
      totalAmount = parseFloat(shipment.total_amount)
    } else if (parseFloat(shipment.declared_value) > 0) {
      totalAmount = parseFloat(shipment.declared_value)
    } else if (parseFloat(invoiceMeta.total_amount) > 0) {
      totalAmount = parseFloat(invoiceMeta.total_amount)
    }
  }

  // Aadhar / ID info from sender
  const senderIdLabel = (sender.gstin_type && !/none/i.test(sender.gstin_type)) ? sender.gstin_type.toUpperCase() : 'AADHAR CARD'
  const senderIdNo = sender.gstin_no || sender.aadhar_no || shipment.sender_gstin_no || ''

  // Other reference
  const otherRef = shipment.order_reference || shipment.reference_name || ''

  // Generate barcode buffer
  const barcodeBuffer = await generateBarcode(awbNumber)

  // Create PDF
  const fileName = `invoice_${awbNumber}_${Date.now()}.pdf`
  const filePath = path.join(INVOICES_DIR, fileName)
  const BLACK = '#000000'

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 20, bottom: 20, left: 25, right: 25 } })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    const pageWidth = doc.page.width - 50 // 545.28 pt
    const leftMargin = 25
    const halfWidth = pageWidth / 2
    let y = 20
    const borderW = 0.6

    // ─── TOP HEADER: INVOICE ───
    const topHeaderH = 22
    doc.rect(leftMargin, y, pageWidth, topHeaderH).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.fillColor(BLACK).fontSize(13).font('Helvetica-Bold')
       .text('INVOICE', leftMargin, y + 5, { width: pageWidth, align: 'center' })
    y += topHeaderH

    // ─── ROW 1: INVOICE DETAILS (Left) + BARCODE & REFERENCE (Right) ───
    const row1Height = 72
    doc.rect(leftMargin, y, halfWidth, row1Height).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.rect(leftMargin + halfWidth, y, halfWidth, row1Height).strokeColor(BLACK).lineWidth(borderW).stroke()

    // Left box details
    doc.fillColor(BLACK).fontSize(8.5).font('Helvetica-Bold')
    let lx = leftMargin + 6
    let ly = y + 8
    const lineH = 13.5
    doc.text(`INVOICE NO.:  ${invoiceNo}`, lx, ly); ly += lineH
    doc.text(`INVOICE DATE. :  ${invoiceDate}`, lx, ly); ly += lineH
    doc.text(`TOTAL PIECES :  ${totalPieces}`, lx, ly); ly += lineH
    doc.text(`CHARGEABLE WEIGHT :  ${chargeableWeight.toFixed(2)}`, lx, ly)

    // Right box: Barcode image + Other reference
    let rx = leftMargin + halfWidth
    let ry = y + 5
    if (barcodeBuffer) {
      try {
        const barcodeW = 140
        doc.image(barcodeBuffer, rx + (halfWidth - barcodeW) / 2, ry, { width: barcodeW, height: 28 })
      } catch (e) {
        doc.fontSize(8.5).font('Helvetica-Bold').text(`AWB: ${awbNumber}`, rx + 6, ry + 8)
      }
    } else {
      doc.fontSize(8.5).font('Helvetica-Bold').text(`AWB: ${awbNumber}`, rx + 6, ry + 8)
    }

    let rTextY = y + 36
    doc.fillColor(BLACK).fontSize(8.5).font('Helvetica-Bold')
    doc.text(`OTHER REFERENCE${otherRef ? ` :  ${otherRef}` : ''}`, rx + 6, rTextY); rTextY += lineH
    if (senderIdNo) {
      doc.text(`${senderIdLabel} :  ${senderIdNo}`, rx + 6, rTextY)
    }

    y += row1Height

    // ─── ROW 2: SHIPPER / CONSIGNEE HEADERS ───
    const headerBarH = 17
    doc.rect(leftMargin, y, halfWidth, headerBarH).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.rect(leftMargin + halfWidth, y, halfWidth, headerBarH).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.fontSize(8.5).font('Helvetica-Bold')
    doc.text('SHIPPER', leftMargin + 6, y + 4)
    doc.text('CONSIGNEE', leftMargin + halfWidth + 6, y + 4)
    y += headerBarH

    // ─── ROW 3: SHIPPER / CONSIGNEE DETAILS ───
    const addressRowH = 100
    doc.rect(leftMargin, y, halfWidth, addressRowH).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.rect(leftMargin + halfWidth, y, halfWidth, addressRowH).strokeColor(BLACK).lineWidth(borderW).stroke()

    // Shipper details
    let sy = y + 6
    doc.fontSize(8).font('Helvetica-Bold')
    const sName = (sender.name || shipment.sender_name || '').toUpperCase()
    if (sName) { doc.text(sName, leftMargin + 6, sy); sy += 12 }

    const sComp = (sender.company || shipment.sender_company || sName).toUpperCase()
    doc.font('Helvetica-Bold').text('COMPANY NAME  ', leftMargin + 6, sy, { continued: true })
       .font('Helvetica').text(sComp); sy += 12

    const sAddr1 = (sender.address || sender.address_1 || shipment.sender_address || '').toUpperCase()
    const sAddr2 = (sender.address_2 || shipment.sender_address_2 || '').toUpperCase()
    doc.font('Helvetica-Bold').text('ADDRESS :  ', leftMargin + 6, sy, { continued: true })
       .font('Helvetica').text(sAddr1, { width: halfWidth - 60 }); sy += (sAddr1.length > 35 ? 18 : 12)
    if (sAddr2) { doc.font('Helvetica').text(sAddr2, leftMargin + 55, sy, { width: halfWidth - 65 }); sy += 12 }

    const sCityState = [sender.city || shipment.sender_city, sender.state || shipment.sender_state].filter(Boolean).join(', ').toUpperCase()
    if (sCityState) { doc.font('Helvetica').text(sCityState, leftMargin + 6, sy); sy += 12 }

    const sCountryPin = [sender.country || shipment.sender_country || 'INDIA', sender.pincode || sender.zip_code || shipment.sender_pincode || ''].filter(Boolean).join(', ').toUpperCase()
    if (sCountryPin) { doc.font('Helvetica').text(sCountryPin, leftMargin + 6, sy); sy += 12 }

    const sEmail = (sender.email || shipment.sender_email || '').trim()
    doc.font('Helvetica-Bold').text('EMAIL  ', leftMargin + 6, sy, { continued: true })
       .font('Helvetica').text(sEmail || ''); sy += 12

    const sPhone = sender.phone || sender.contact_no || shipment.sender_phone || ''
    doc.font('Helvetica-Bold').text('PHONE NUMBER :  ', leftMargin + 6, sy, { continued: true })
       .font('Helvetica').text(sPhone || '')

    // Consignee details
    let cy = y + 6
    doc.fontSize(8).font('Helvetica-Bold')
    const cName = (receiver.name || shipment.receiver_name || '').toUpperCase()
    if (cName) { doc.text(cName, leftMargin + halfWidth + 6, cy); cy += 12 }

    const cComp = (receiver.company || shipment.receiver_company || cName).toUpperCase()
    doc.font('Helvetica-Bold').text('COMPANY NAME  ', leftMargin + halfWidth + 6, cy, { continued: true })
       .font('Helvetica').text(cComp); cy += 12

    const cAddr1 = (receiver.address || receiver.address_1 || shipment.receiver_address || '').toUpperCase()
    const cAddr2 = (receiver.address_2 || shipment.receiver_address_2 || '').toUpperCase()
    doc.font('Helvetica-Bold').text('ADDRESS :  ', leftMargin + halfWidth + 6, cy, { continued: true })
       .font('Helvetica').text(cAddr1, { width: halfWidth - 60 }); cy += (cAddr1.length > 35 ? 18 : 12)
    if (cAddr2) { doc.font('Helvetica').text(cAddr2, leftMargin + halfWidth + 55, cy, { width: halfWidth - 65 }); cy += 12 }

    const cCityState = [receiver.city || shipment.receiver_city, receiver.state || shipment.receiver_state].filter(Boolean).join(', ').toUpperCase()
    if (cCityState) { doc.font('Helvetica').text(cCityState, leftMargin + halfWidth + 6, cy); cy += 12 }

    const cCountryPin = [receiver.country || shipment.receiver_country || shipment.destination_country || '', receiver.pincode || receiver.zip_code || shipment.receiver_pincode || '0000'].filter(Boolean).join(', ').toUpperCase()
    if (cCountryPin) { doc.font('Helvetica').text(cCountryPin, leftMargin + halfWidth + 6, cy); cy += 12 }

    const cEmail = (receiver.email || shipment.receiver_email || '').trim()
    doc.font('Helvetica-Bold').text('EMAIL  ', leftMargin + halfWidth + 6, cy, { continued: true })
       .font('Helvetica').text(cEmail || ''); cy += 12

    const cPhone = receiver.phone || receiver.contact_no || shipment.receiver_phone || ''
    doc.font('Helvetica-Bold').text('PHONE NUMBER :  ', leftMargin + halfWidth + 6, cy, { continued: true })
       .font('Helvetica').text(cPhone || '')

    y += addressRowH

    // ─── ROW 4: 7-COLUMN TABLE HEADER ───
    // Columns: SR NO. (32), DESCRIPTION (200), HS CODE (65), UNIT TYPE (50), QUANTITY (55), UNIT RATES (65), AMOUNT (CIF) (78.28)
    const colWidths = {
      sr: 32,
      desc: 200,
      hs: 65,
      unitType: 50,
      qty: 55,
      rates: 65,
      amount: pageWidth - (32 + 200 + 65 + 50 + 55 + 65) // 78.28
    }

    const tableHeaderH = 25
    doc.rect(leftMargin, y, pageWidth, tableHeaderH).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.fillColor(BLACK).fontSize(7.5).font('Helvetica-Bold')

    const cols = [
      { key: 'sr', label: 'SR\nNO.', w: colWidths.sr, align: 'center' },
      { key: 'desc', label: 'DESCRIPTION', w: colWidths.desc, align: 'center', topOffset: 8 },
      { key: 'hs', label: 'HS\nCODE', w: colWidths.hs, align: 'center' },
      { key: 'unitType', label: 'UNIT\nTYPE', w: colWidths.unitType, align: 'center' },
      { key: 'qty', label: 'QUANTITY', w: colWidths.qty, align: 'center', topOffset: 8 },
      { key: 'rates', label: 'UNIT\nRATES', w: colWidths.rates, align: 'center' },
      { key: 'amount', label: `AMOUNT\n(${incoterms})`, w: colWidths.amount, align: 'center' }
    ]

    let colX = leftMargin
    cols.forEach(c => {
      doc.rect(colX, y, c.w, tableHeaderH).strokeColor(BLACK).lineWidth(0.5).stroke()
      doc.text(c.label, colX + 2, y + (c.topOffset || 4), { width: c.w - 4, align: c.align })
      colX += c.w
    })
    y += tableHeaderH

    // ─── BOXES AND LINE ITEMS ───
    let boxesToRender = parsedParcels
    if (boxesToRender.length === 0) {
      boxesToRender = [{
        parcel_no: 1,
        weight: actualWeight || shipment.weight || 0,
        length: l,
        breadth: b,
        height: h
      }]
    }

    const items = invoiceItems && invoiceItems.length > 0 ? invoiceItems : [{
      sr_no: 1,
      description: shipment.content_description || shipment.description || 'GOODS',
      hs_code: shipment.hs_code || '',
      unit_type: 'PCS',
      quantity: totalPieces,
      unit_rates: (totalAmount / totalPieces) || 0,
      amount: totalAmount
    }]

    const rowH = 17
    const bottomStartY = 735 // Fixed position for totals row so table fills full page

    boxesToRender.forEach((parcel, boxIdx) => {
      const boxNo = parcel.parcel_no || parcel.box_no || (boxIdx + 1)
      const pl = parseFloat(parcel.length) || l
      const pb = parseFloat(parcel.breadth || parcel.width) || b
      const ph = parseFloat(parcel.height) || h
      const pw = parseFloat(parcel.weight) || (actualWeight / (boxesToRender.length || 1))

      // Box banner row
      const bannerText = `BOX NO: ${boxNo} , DIMENSIONS (CMS) ${pl.toFixed(2)} * ${pb.toFixed(2)} * ${ph.toFixed(2)} , ACTUAL WEIGHT - ${pw.toFixed(2)} KG`
      doc.rect(leftMargin, y, pageWidth, 16).strokeColor(BLACK).lineWidth(borderW).stroke()
      doc.fillColor(BLACK).fontSize(7.5).font('Helvetica-Bold')
         .text(bannerText, leftMargin + 4, y + 4, { width: pageWidth - 8, align: 'center' })
      y += 16

      // Items for this box
      const boxItems = boxesToRender.length === 1
        ? items
        : items.filter(item => (parseInt(item.box_no) || 1) === (boxIdx + 1))

      const displayItems = boxItems.length > 0 ? boxItems : (boxIdx === 0 ? items : [])

      displayItems.forEach((item, idx) => {
        if (y + rowH > bottomStartY) return // Prevent overflow

        const qty = parseFloat(item.quantity || 1)
        const amt = parseFloat(item.amount) || 0
        const rate = parseFloat(item.unit_rates || item.rate) || (amt > 0 && qty > 0 ? amt / qty : 0)

        // Draw cells
        let cx = leftMargin
        cols.forEach(c => {
          doc.rect(cx, y, c.w, rowH).strokeColor(BLACK).lineWidth(0.4).stroke()
          cx += c.w
        })

        cx = leftMargin
        doc.fillColor(BLACK).fontSize(7.5).font('Helvetica')

        // SR NO
        doc.text(String(item.sr_no || idx + 1), cx + 2, y + 4.5, { width: colWidths.sr - 4, align: 'center' })
        cx += colWidths.sr

        // DESCRIPTION
        doc.text(String(item.description || '').toUpperCase(), cx + 4, y + 4.5, { width: colWidths.desc - 8, align: 'left' })
        cx += colWidths.desc

        // HS CODE
        doc.text(String(item.hs_code || ''), cx + 2, y + 4.5, { width: colWidths.hs - 4, align: 'center' })
        cx += colWidths.hs

        // UNIT TYPE
        doc.text(String(item.unit_type || 'PCS').toUpperCase(), cx + 2, y + 4.5, { width: colWidths.unitType - 4, align: 'center' })
        cx += colWidths.unitType

        // QUANTITY
        doc.text(String(qty), cx + 2, y + 4.5, { width: colWidths.qty - 4, align: 'center' })
        cx += colWidths.qty

        // UNIT RATES
        doc.text(rate.toFixed(2), cx + 2, y + 4.5, { width: colWidths.rates - 6, align: 'right' })
        cx += colWidths.rates

        // AMOUNT
        doc.text(amt.toFixed(2), cx + 2, y + 4.5, { width: colWidths.amount - 6, align: 'right' })

        y += rowH
      })
    })

    // ─── EMPTY GRID ROWS TO FILL DOWN TO BOTTOM ───
    while (y + rowH <= bottomStartY) {
      let cx = leftMargin
      cols.forEach(c => {
        doc.rect(cx, y, c.w, rowH).strokeColor(BLACK).lineWidth(0.4).stroke()
        cx += c.w
      })
      y += rowH
    }

    // ─── TOTAL ROW ───
    const totalRowH = 20
    const wordsWidth = pageWidth - (colWidths.rates + colWidths.amount)
    const totalNumWidth = colWidths.rates + colWidths.amount

    doc.rect(leftMargin, y, wordsWidth, totalRowH).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.rect(leftMargin + wordsWidth, y, totalNumWidth, totalRowH).strokeColor(BLACK).lineWidth(borderW).stroke()

    // Words
    const amountInWords = numberToWords(totalAmount, currency)
    doc.fillColor(BLACK).fontSize(7.5).font('Helvetica-Bold')
       .text('AMOUNT CHARGEABLE', leftMargin + 6, y + 6)
    doc.font('Helvetica')
       .text(amountInWords, leftMargin + 130, y + 6, { width: wordsWidth - 136, align: 'left' })

    // Total Amount
    doc.font('Helvetica-Bold').fontSize(8.5)
       .text(`TOTAL: ${totalAmount.toFixed(2)} ${currency}`, leftMargin + wordsWidth + 4, y + 5.5, { width: totalNumWidth - 8, align: 'center' })

    y += totalRowH

    // ─── NOTES & SIGNATURE / STAMP ROW ───
    const notesRowH = 48
    doc.rect(leftMargin, y, halfWidth, notesRowH).strokeColor(BLACK).lineWidth(borderW).stroke()
    doc.rect(leftMargin + halfWidth, y, halfWidth, notesRowH).strokeColor(BLACK).lineWidth(borderW).stroke()

    // Left: NOTES
    doc.fillColor(BLACK).fontSize(7.5).font('Helvetica-Bold')
       .text('NOTES', leftMargin + 6, y + 5)
    const noteText = invoiceMeta.note || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'
    doc.font('Helvetica').fontSize(6.5)
       .text(noteText, leftMargin + 6, y + 16, { width: halfWidth - 12, lineGap: 1 })

    // Right: SIGNATURE / STAMP
    doc.font('Helvetica-Bold').fontSize(7.5)
       .text('SIGNATURE / STAMP', leftMargin + halfWidth + 6, y + 5)

    y += notesRowH

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
