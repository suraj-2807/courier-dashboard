import PDFDocument from 'pdfkit'
import bwipjs from 'bwip-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Ensure uploads directory exists
const BILLS_DIR = path.join(__dirname, '..', '..', 'uploads', 'bills')
if (!fs.existsSync(BILLS_DIR)) {
  fs.mkdirSync(BILLS_DIR, { recursive: true })
}

// Logo path
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'PRINCE LOGO.png')

/**
 * Generate Shipping Bill / Waybill PDF matching exact user layout & Prince Courier branding
 */
export async function generateWaybillPdf(params) {
  const {
    awbNumber,
    sender = {},
    receiver = {},
    shipment = {},
    parcels = [],
    invoiceItems = [],
    invoiceMeta = {}
  } = params

  const pdfPath = path.join(BILLS_DIR, `Waybill_${awbNumber}.pdf`)

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 20
      })

      const writeStream = fs.createWriteStream(pdfPath)
      doc.pipe(writeStream)

      const startX = 20
      let curY = 15
      const contentWidth = 555

      // ── Top Header Text (Outside Box) ──
      doc.fillColor('#0D2132').fontSize(7.5).font('Helvetica')
        .text('Subject to Surat Jurisdiction', startX, curY)
      doc.fillColor('#0D2132').fontSize(8.5).font('Helvetica-Bold')
        .text('Customer Copy', startX, curY, { width: contentWidth, align: 'right' })

      curY += 14

      // Color System
      const NAVY = '#0D2132'
      const RED = '#BB0013'
      const TEXT_DARK = '#111827'
      const BORDER_COLOR = '#0D2132'

      // Helper for drawing cell borders
      const drawBox = (x, y, w, h, lineWidth = 0.75) => {
        doc.rect(x, y, w, h).strokeColor(BORDER_COLOR).lineWidth(lineWidth).stroke()
      }

      // ── Outer Main Container ──
      const outerStartY = curY
      const totalHeaderHeight = 65
      const row2Height = 145
      const row3Height = 105
      const row4Height = 90
      const totalBoxHeight = totalHeaderHeight + row2Height + row3Height + row4Height

      // Draw Outer Frame
      drawBox(startX, outerStartY, contentWidth, totalBoxHeight, 1.25)

      // ── SECTION 1: HEADER BLOCK (Height: 65) ──
      const col1Width = 310
      const col2Width = 135
      const col3Width = 110

      // Header vertical dividers
      doc.moveTo(startX + col1Width, curY).lineTo(startX + col1Width, curY + totalHeaderHeight).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()
      doc.moveTo(startX + col1Width + col2Width, curY).lineTo(startX + col1Width + col2Width, curY + totalHeaderHeight).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()
      doc.moveTo(startX, curY + totalHeaderHeight).lineTo(startX + contentWidth, curY + totalHeaderHeight).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()

      // Header Col 1: Logo & Company Address
      let logoX = startX + 5
      let textLeft = startX + 6
      if (fs.existsSync(LOGO_PATH)) {
        try {
          doc.image(LOGO_PATH, logoX, curY + 6, { fit: [50, 45] })
          textLeft = startX + 58
        } catch (e) {
          console.error('Failed to load logo in PDF:', e.message)
        }
      }

      doc.fillColor(NAVY).fontSize(10.5).font('Helvetica-Bold')
        .text('PRINCE INTERNATIONAL COURIER SER', textLeft, curY + 6, { width: col1Width - (textLeft - startX) - 4 })

      doc.fillColor(TEXT_DARK).fontSize(6.5).font('Helvetica')
        .text('SHOP NO. 4, AL MARHABA APT OPP. SAI BABA EYE HOSPITAL, MACHHLIPITH B/H LALAGATE, SURAT-395003.', textLeft, curY + 22, { width: col1Width - (textLeft - startX) - 4 })
        .text('Ph: 9898787199,', textLeft, curY + 41)
        .text('Website : http://www.princeexp.com', textLeft, curY + 50)

      // Header Col 2: AWB, Destination, Pieces
      const col2X = startX + col1Width + 6
      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold')
        .text('AWB No.', col2X, curY + 8)
        .text(':', col2X + 55, curY + 8)
        .text(String(awbNumber), col2X + 65, curY + 8)

        .text('Destination', col2X, curY + 26)
        .text(':', col2X + 55, curY + 26)
        .text(String(receiver.country || shipment.destination_country || '').toUpperCase(), col2X + 65, curY + 26)

        .text('Pieces', col2X, curY + 44)
        .text(':', col2X + 55, curY + 44)
        .text(String(shipment.no_of_pieces || parcels.length || 1), col2X + 65, curY + 44)

      // Header Col 3: Date & Pay Status
      const col3X = startX + col1Width + col2Width + 6
      const bookingDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const payStatus = shipment.payment_status || 'Fully UnPaid'

      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold')
        .text('Date :', col3X, curY + 8)
        .font('Helvetica').text(bookingDate, col3X + 32, curY + 8)

        .font('Helvetica-Bold').text('Pay  :', col3X, curY + 26)
        .font('Helvetica').text(payStatus, col3X + 32, curY + 26)

      curY += totalHeaderHeight

      // ── SECTION 2: SHIPPER / CONSIGNEE / CHARGES (Height: 145) ──
      const sColWidth = 220
      const cColWidth = 220
      const chgColWidth = 115

      // Vertical dividers for Row 2
      doc.moveTo(startX + sColWidth, curY).lineTo(startX + sColWidth, curY + row2Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()
      doc.moveTo(startX + sColWidth + cColWidth, curY).lineTo(startX + sColWidth + cColWidth, curY + row2Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()
      doc.moveTo(startX, curY + row2Height).lineTo(startX + contentWidth, curY + row2Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()

      // Shipper Block
      const sX = startX + 6
      doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text('Shipper :', sX, curY + 5)

      let sY = curY + 18
      const sName = (sender.name || sender.company || '').toUpperCase()
      if (sName) {
        doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text(sName, sX, sY, { width: sColWidth - 12 })
        sY += 12
      }
      const sAddress = [sender.address, sender.address_2, sender.city, sender.state, sender.pincode ? `SURAT-${sender.pincode}` : ''].filter(Boolean).join('\n').toUpperCase()
      if (sAddress) {
        doc.fillColor(TEXT_DARK).fontSize(7.5).font('Helvetica').text(sAddress, sX, sY, { width: sColWidth - 12 })
        sY += (sender.address ? 32 : 16)
      }
      const sPhone = sender.phone || '0123456789'
      doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text(`Ph : ${sPhone}`, sX, curY + row2Height - 16)

      // Consignee Block
      const cX = startX + sColWidth + 6
      doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text('Consignee :', cX, curY + 5)

      let rY = curY + 18
      const rName = (receiver.name || receiver.company || '').toUpperCase()
      if (rName) {
        doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text(rName, cX, rY, { width: cColWidth - 12 })
        rY += 12
      }
      const rAddressParts = [receiver.address, receiver.address_2, receiver.city, receiver.state, receiver.pincode, receiver.country].filter(Boolean).join('\n').toUpperCase()
      if (rAddressParts) {
        doc.fillColor(TEXT_DARK).fontSize(7.5).font('Helvetica').text(rAddressParts, cX, rY, { width: cColWidth - 12 })
      }
      const rPhone = receiver.phone || ''
      if (rPhone) {
        doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text(`Ph : ${rPhone}`, cX, curY + row2Height - 16)
      }

      // Charges Breakdown Sub-Table (Right Col, 5 Sub-Rows)
      const chgX = startX + sColWidth + cColWidth
      const chgRowH = row2Height / 5
      const actWt = parseFloat(shipment.weight || 0)
      const volWt = parseFloat(shipment.volumetric_weight || 0)
      const chgWt = parseFloat(shipment.chargeable_weight || Math.max(actWt, volWt)).toFixed(3)
      const shippingCharge = parseFloat(shipment.shipping_charge || shipment.amount || 0).toFixed(2)

      const chargesRows = [
        { label: 'Weight', val: chgWt },
        { label: 'Charges', val: shippingCharge },
        { label: 'Surcharge', val: '0.00' },
        { label: 'Service Chrg.', val: '0.00' },
        { label: 'Comm. Chrg.', val: '0.00' }
      ]

      chargesRows.forEach((row, rIdx) => {
        const ry = curY + (rIdx * chgRowH)
        if (rIdx > 0) {
          doc.moveTo(chgX, ry).lineTo(chgX + chgColWidth, ry).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke()
        }
        // Sub-divider inside Charges cell
        doc.moveTo(chgX + 62, ry).lineTo(chgX + 62, ry + chgRowH).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke()

        doc.fillColor(NAVY).fontSize(7.5).font('Helvetica-Bold').text(row.label, chgX + 4, ry + 8, { width: 56, align: 'center' })
        doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text(row.val, chgX + 64, ry + 8, { width: 48, align: 'right' })
      })

      curY += row2Height

      // ── SECTION 3: CONTENTS & TOTALS (Height: 105) ──
      const contentsWidth = 440
      const totalsWidth = 115

      // Vertical & horizontal dividers for Row 3
      doc.moveTo(startX + contentsWidth, curY).lineTo(startX + contentsWidth, curY + row3Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()
      doc.moveTo(startX, curY + row3Height).lineTo(startX + contentWidth, curY + row3Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()

      // Contents Left Block
      const cntX = startX + 6
      doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text('Contents:', cntX, curY + 5)

      // Build contents string from invoice items or content description
      let contentsStr = ''
      if (invoiceItems && invoiceItems.length > 0) {
        contentsStr = invoiceItems.map(item => {
          const name = (item.description || item.name || 'ITEM').toUpperCase()
          const qty = parseFloat(item.quantity || item.qty || 1).toFixed(2)
          const unit = (item.unit_type || item.unit || 'PCS').toUpperCase()
          return `${name}-${qty}(${unit})`
        }).join(',') + '.'
      } else if (shipment.content_description) {
        contentsStr = shipment.content_description.toUpperCase()
      } else {
        contentsStr = 'PARCEL / GENERAL GOODS.'
      }

      doc.fillColor(TEXT_DARK).fontSize(7.5).font('Helvetica').text(contentsStr, cntX, curY + 18, { width: contentsWidth - 12, lineGap: 2 })

      // Totals Right Block (7 rows)
      const totX = startX + contentsWidth
      const freightVal = '0.00'
      const totalVal = shippingCharge
      const sgstVal = '0.00'
      const cgstVal = '0.00'
      const grandTotalVal = shippingCharge
      const receivedVal = '0.00'
      const creditVal = shippingCharge

      const totalsRows = [
        { label: 'Freight :', val: freightVal },
        { label: 'Total :', val: totalVal },
        { label: 'SGST :', val: sgstVal },
        { label: 'CGST :', val: cgstVal },
        { label: 'Grand Total :', val: grandTotalVal, isBold: true, isRed: true },
        { label: 'Received :', val: receivedVal, isBold: true },
        { label: 'Credit :', val: creditVal, isBold: true }
      ]

      let totY = curY + 3
      totalsRows.forEach((tr, tIdx) => {
        if (tIdx === 4) {
          // Solid line before Grand Total
          doc.moveTo(totX, totY - 1).lineTo(totX + totalsWidth, totY - 1).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()
        }

        const fontName = tr.isBold ? 'Helvetica-Bold' : 'Helvetica'
        const fontColor = tr.isRed ? RED : NAVY

        doc.fillColor(fontColor).fontSize(7.5).font(fontName).text(tr.label, totX + 4, totY)
        doc.fillColor(fontColor).fontSize(7.5).font(fontName).text(tr.val, totX + 50, totY, { width: totalsWidth - 54, align: 'right' })

        totY += 14
      })

      curY += row3Height

      // ── SECTION 4: TERMS & CONDITIONS & SIGNATURE (Height: 90) ──
      const termsWidth = 390
      const sigWidth = 165

      // Vertical divider for Row 4
      doc.moveTo(startX + termsWidth, curY).lineTo(startX + termsWidth, curY + row4Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()

      // Terms Left Block
      const tX = startX + 6
      doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text('TERMS & CONDITION:', tX, curY + 4)

      const termsList = [
        '1. Parcels will send on the complete risk and responsibility of customers.',
        '2. Customers are responsible for clearance of custom of courier shipment (parcels).',
        '3. Claming cannot be done by customer for any breakage or thieving.',
        '4. Customers are responsible for any changes in weight of parcel and are also responsible for payment of Service-Tax as well as changes in Service-Tax if any.',
        '5. No Guarantee for Duty Amount in Any Country.'
      ]

      let tLineY = curY + 16
      termsList.forEach(term => {
        doc.fillColor(TEXT_DARK).fontSize(6.5).font('Helvetica').text(term, tX, tLineY, { width: termsWidth - 12 })
        tLineY += (term.length > 80 ? 18 : 12)
      })

      // Receiver's Signature Right Block
      const sigX = startX + termsWidth + 6
      doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text("Receiver's Signature", sigX, curY + 4)

      doc.end()

      writeStream.on('finish', () => {
        resolve(pdfPath)
      })

      writeStream.on('error', (err) => {
        reject(err)
      })
    } catch (err) {
      reject(err)
    }
  })
}

