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
 * 
 * @param {Object} params
 * @param {string} params.awbNumber — Our 7-digit AWB number (also used as invoice number)
 * @param {Object} params.sender — { name, company, address, address_2, city, state, country, pincode, phone, email, gstin_type, gstin_no }
 * @param {Object} params.receiver — { name, company, address, address_2, city, state, country, pincode, phone, email }
 * @param {Object} params.shipment — { weight, length, breadth, height, no_of_pieces, chargeable_weight, package_type }
 * @param {Array} params.invoiceItems — [{ sr_no, description, hs_code, unit_type, quantity, unit_weight, cost, unit_rates, amount }]
 * @param {Object} params.invoiceMeta — { invoice_type, currency, incoterms, note, total_amount }
 * @returns {Promise<string>} — File path of the generated PDF
 */
export async function generateInvoicePdf(params) {
  const {
    awbNumber,
    sender = {},
    receiver = {},
    shipment = {},
    invoiceItems = [],
    invoiceMeta = {}
  } = params

  const invoiceNo = awbNumber
  const invoiceDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const currency = invoiceMeta.currency || 'INR'
  const incoterms = invoiceMeta.incoterms || 'CIF'
  const invoiceType = invoiceMeta.invoice_type || 'INVOICE'
  const note = invoiceMeta.note || ''

  const totalPieces = shipment.no_of_pieces || 1
  const actualWeight = parseFloat(shipment.weight) || 0
  const l = parseFloat(shipment.length) || 0
  const b = parseFloat(shipment.breadth) || 0
  const h = parseFloat(shipment.height) || 0
  const volWeight = (l > 0 && b > 0 && h > 0) ? Math.round(((l * b * h) / 5000) * totalPieces * 100) / 100 : 0
  const chargeableWeight = Math.max(actualWeight, volWeight)

  // Calculate total amount from items
  let totalAmount = 0
  invoiceItems.forEach(item => {
    totalAmount += parseFloat(item.amount) || 0
  })
  if (totalAmount === 0) totalAmount = parseFloat(invoiceMeta.total_amount) || 0

  const amountInWords = numberToWords(Math.round(totalAmount))
  const currencyWord = currency === 'INR' ? 'Rupees' : currency === 'USD' ? 'Dollars' : currency === 'EUR' ? 'Euros' : currency === 'GBP' ? 'Pounds' : currency

  // Generate barcode
  const barcodePng = await generateBarcode(awbNumber)

  // Create PDF
  const fileName = `invoice_${awbNumber}_${Date.now()}.pdf`
  const filePath = path.join(INVOICES_DIR, fileName)
  const relativePath = `uploads/invoices/${fileName}`

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    const pageWidth = doc.page.width - 60 // margins
    const leftMargin = 30
    let y = 30

    // ─── HEADER: INVOICE TITLE ───
    doc.rect(leftMargin, y, pageWidth, 24).fillAndStroke('#1a237e', '#1a237e')
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
       .text(invoiceType, leftMargin, y + 5, { width: pageWidth, align: 'center' })
    y += 30

    // ─── ROW 2: Invoice Info + Barcode ───
    doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold')
    
    const infoBlockWidth = pageWidth / 2
    const barcodeBlockWidth = pageWidth / 2

    // Left side: Invoice details
    const infoX = leftMargin + 4
    doc.rect(leftMargin, y, infoBlockWidth, 80).stroke('#333333')
    doc.text(`INVOICE NO.: ${invoiceNo}`, infoX, y + 5)
    doc.text(`INVOICE DATE.: ${invoiceDate}`, infoX, y + 17)
    doc.text(`TOTAL PIECES : ${totalPieces}`, infoX, y + 29)
    doc.text(`CHARGEABLE WEIGHT: ${chargeableWeight.toFixed(2)}`, infoX, y + 41)

    // Right side: Barcode + Other Reference
    const barcodeX = leftMargin + infoBlockWidth
    doc.rect(barcodeX, y, barcodeBlockWidth, 80).stroke('#333333')

    if (barcodePng) {
      try {
        doc.image(barcodePng, barcodeX + 30, y + 5, { width: barcodeBlockWidth - 60, height: 40 })
      } catch (e) {
        doc.text(`AWB: ${awbNumber}`, barcodeX + 10, y + 15)
      }
    } else {
      doc.fontSize(12).text(awbNumber, barcodeX + 10, y + 15, { width: barcodeBlockWidth - 20, align: 'center' })
    }

    doc.fontSize(8).font('Helvetica')
    doc.text('OTHER REFERENCE', barcodeX + 10, y + 50)
    if (sender.gstin_type && sender.gstin_no) {
      doc.font('Helvetica-Bold').text(`${sender.gstin_type}: ${sender.gstin_no}`, barcodeX + 10, y + 62)
    }

    y += 86

    // ─── ROW 3: Shipper & Consignee ───
    const halfWidth = pageWidth / 2
    
    // Shipper
    doc.rect(leftMargin, y, halfWidth, 130).stroke('#333333')
    doc.fillColor('#1a237e').fontSize(9).font('Helvetica-Bold')
       .text('SHIPPER', leftMargin + 4, y + 4)
    doc.fillColor('#000000').fontSize(8).font('Helvetica')
    
    let sy = y + 18
    if (sender.name) { doc.font('Helvetica-Bold').text(`${sender.name}`, leftMargin + 4, sy); sy += 12 }
    if (sender.company) { doc.font('Helvetica').text(`COMPANY NAME   ${sender.company}`, leftMargin + 4, sy); sy += 12 }
    
    const senderAddr = [sender.address, sender.address_2].filter(Boolean).join(', ')
    if (senderAddr) { doc.text(`ADDRESS : ${senderAddr}`, leftMargin + 4, sy, { width: halfWidth - 10 }); sy += (senderAddr.length > 40 ? 22 : 12) }
    
    const senderCityLine = [sender.city, sender.state].filter(Boolean).join(', ')
    if (senderCityLine) { doc.text(senderCityLine, leftMargin + 4, sy); sy += 12 }
    if (sender.country) { doc.text(`${sender.country}, ${sender.pincode || ''}`, leftMargin + 4, sy); sy += 12 }
    if (sender.email) { doc.text(`EMAIL`, leftMargin + 4, sy); sy += 12 }
    if (sender.phone) { doc.text(`PHONE NUMBER : ${sender.phone}`, leftMargin + 4, sy); sy += 12 }

    // Consignee
    doc.rect(leftMargin + halfWidth, y, halfWidth, 130).stroke('#333333')
    doc.fillColor('#1a237e').fontSize(9).font('Helvetica-Bold')
       .text('CONSIGNEE', leftMargin + halfWidth + 4, y + 4)
    doc.fillColor('#000000').fontSize(8).font('Helvetica')
    
    let ry = y + 18
    if (receiver.name) { doc.font('Helvetica-Bold').text(`${receiver.name}`, leftMargin + halfWidth + 4, ry); ry += 12 }
    if (receiver.company) { doc.font('Helvetica').text(`COMPANY NAME   ${receiver.company}`, leftMargin + halfWidth + 4, ry); ry += 12 }
    
    const receiverAddr = [receiver.address, receiver.address_2].filter(Boolean).join(', ')
    if (receiverAddr) { doc.text(`ADDRESS : ${receiverAddr}`, leftMargin + halfWidth + 4, ry, { width: halfWidth - 10 }); ry += (receiverAddr.length > 40 ? 22 : 12) }
    
    const receiverCityLine = [receiver.city, receiver.state].filter(Boolean).join(', ')
    if (receiverCityLine) { doc.text(receiverCityLine, leftMargin + halfWidth + 4, ry); ry += 12 }
    if (receiver.country) { doc.text(`${receiver.country}, ${receiver.pincode || ''}`, leftMargin + halfWidth + 4, ry); ry += 12 }
    if (receiver.email) { doc.text(`EMAIL`, leftMargin + halfWidth + 4, ry); ry += 12 }
    if (receiver.phone) { doc.text(`PHONE NUMBER : ${receiver.phone}`, leftMargin + halfWidth + 4, ry); ry += 12 }

    y += 136

    // ─── ITEMS TABLE HEADER ───
    const colWidths = {
      sr: 30, description: 160, hs: 60, unit: 45, qty: 55, rates: 60, amount: 65
    }
    
    // Table header row
    doc.rect(leftMargin, y, pageWidth, 26).fillAndStroke('#1a237e', '#1a237e')
    doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold')
    
    let cx = leftMargin
    doc.text('SR\nNO.', cx + 2, y + 4, { width: colWidths.sr, align: 'center' }); cx += colWidths.sr
    doc.text('DESCRIPTION', cx + 2, y + 8, { width: colWidths.description, align: 'center' }); cx += colWidths.description
    doc.text('HS\nCODE', cx + 2, y + 4, { width: colWidths.hs, align: 'center' }); cx += colWidths.hs
    doc.text('UNIT\nTYPE', cx + 2, y + 4, { width: colWidths.unit, align: 'center' }); cx += colWidths.unit
    doc.text('QUANTITY', cx + 2, y + 8, { width: colWidths.qty, align: 'center' }); cx += colWidths.qty
    doc.text('UNIT\nRATES', cx + 2, y + 4, { width: colWidths.rates, align: 'center' }); cx += colWidths.rates
    doc.text('AMOUNT\n(FOB)', cx + 2, y + 4, { width: colWidths.amount, align: 'center' })
    
    y += 28

    // ─── BOX Details Banner ───
    const boxLine = `BOX NO: 1 , DIMENSIONS (CMS) ${l.toFixed(2)} * ${b.toFixed(2)} * ${h.toFixed(2)} , ACTUAL WEIGHT - ${actualWeight.toFixed(2)} KG`
    doc.rect(leftMargin, y, pageWidth, 16).fillAndStroke('#e8eaf6', '#333333')
    doc.fillColor('#1a237e').fontSize(7).font('Helvetica-Bold')
       .text(boxLine, leftMargin + 4, y + 4, { width: pageWidth - 8, align: 'center' })
    y += 18

    // ─── ITEMS ROWS ───
    const items = invoiceItems.length > 0 ? invoiceItems : [{ sr_no: 1, description: '-', hs_code: '', unit_type: 'PCS', quantity: totalPieces, unit_rates: 0, amount: 0 }]
    
    items.forEach((item, idx) => {
      const rowH = 18
      doc.rect(leftMargin, y, pageWidth, rowH).stroke('#cccccc')
      doc.fillColor('#000000').fontSize(7).font('Helvetica')
      
      cx = leftMargin
      doc.text(String(item.sr_no || idx + 1), cx + 2, y + 5, { width: colWidths.sr, align: 'center' }); cx += colWidths.sr
      doc.text(String(item.description || ''), cx + 2, y + 5, { width: colWidths.description, align: 'left' }); cx += colWidths.description
      doc.text(String(item.hs_code || ''), cx + 2, y + 5, { width: colWidths.hs, align: 'center' }); cx += colWidths.hs
      doc.text(String(item.unit_type || 'PCS'), cx + 2, y + 5, { width: colWidths.unit, align: 'center' }); cx += colWidths.unit
      doc.text(String(item.quantity || ''), cx + 2, y + 5, { width: colWidths.qty, align: 'center' }); cx += colWidths.qty
      doc.text(parseFloat(item.unit_rates || 0).toFixed(2), cx + 2, y + 5, { width: colWidths.rates, align: 'right' }); cx += colWidths.rates
      doc.text(parseFloat(item.amount || 0).toFixed(2), cx + 2, y + 5, { width: colWidths.amount, align: 'right' })
      
      y += rowH
    })

    // Empty rows to fill space (like the reference)
    const emptyRowsNeeded = Math.max(0, 8 - items.length)
    for (let i = 0; i < emptyRowsNeeded; i++) {
      doc.rect(leftMargin, y, pageWidth, 16).stroke('#cccccc')
      y += 16
    }

    // ─── TOTALS ROW ───
    y += 4
    doc.rect(leftMargin, y, pageWidth, 22).stroke('#333333')
    doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold')
    doc.text('TOTAL AMOUNT', leftMargin + 4, y + 6, { width: pageWidth - colWidths.amount - 10, align: 'right' })
    doc.text(`${totalAmount.toFixed(2)}`, leftMargin + pageWidth - colWidths.amount - 4, y + 6, { width: colWidths.amount, align: 'right' })
    y += 26

    // ─── AMOUNT CHARGEABLE IN WORDS ───
    doc.rect(leftMargin, y, pageWidth, 30).stroke('#333333')
    doc.fillColor('#1a237e').fontSize(7).font('Helvetica-Bold')
       .text('AMOUNT CHARGEABLE', leftMargin + 4, y + 4)
    doc.fillColor('#000000').fontSize(8).font('Helvetica')
       .text(`${amountInWords} ${currencyWord} Only`, leftMargin + 120, y + 4, { width: pageWidth / 2 })
    doc.font('Helvetica-Bold').fontSize(9)
       .text(`TOTAL: ${totalAmount.toFixed(2)} ${currency}`, leftMargin + pageWidth - 180, y + 8, { width: 170, align: 'right' })
    y += 34

    // ─── NOTES & SIGNATURE ───
    doc.rect(leftMargin, y, pageWidth / 2, 50).stroke('#333333')
    doc.rect(leftMargin + pageWidth / 2, y, pageWidth / 2, 50).stroke('#333333')
    
    doc.fillColor('#1a237e').fontSize(8).font('Helvetica-Bold')
       .text('NOTES', leftMargin + 4, y + 4)
    if (note) {
      doc.fillColor('#000000').fontSize(7).font('Helvetica')
         .text(note, leftMargin + 4, y + 16, { width: pageWidth / 2 - 10 })
    }
    
    doc.fillColor('#1a237e').fontSize(8).font('Helvetica-Bold')
       .text('SIGNATURE / STAMP', leftMargin + pageWidth / 2 + 4, y + 4)

    // Finalize
    doc.end()

    stream.on('finish', () => {
      resolve(relativePath)
    })
    stream.on('error', (err) => {
      reject(err)
    })
  })
}
