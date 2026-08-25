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

      curY += 16

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
      const totalHeaderHeight = 68
      const row2Height = 155
      const row3Height = 115
      const row4Height = 92
      const totalBoxHeight = totalHeaderHeight + row2Height + row3Height + row4Height

      // Draw Outer Frame
      drawBox(startX, outerStartY, contentWidth, totalBoxHeight, 1.25)

      // ── SECTION 1: HEADER BLOCK ──
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
          doc.image(LOGO_PATH, logoX, curY + 8, { fit: [52, 48] })
          textLeft = startX + 62
        } catch (e) {
          console.error('Failed to load logo in PDF:', e.message)
        }
      }

      doc.fillColor(NAVY).fontSize(10.5).font('Helvetica-Bold')
        .text('PRINCE INTERNATIONAL COURIER SER', textLeft, curY + 8, { width: col1Width - (textLeft - startX) - 4 })

      doc.fillColor(TEXT_DARK).fontSize(6.8).font('Helvetica')
        .text('SHOP NO. 4, AL MARHABA APT OPP. SAI BABA EYE HOSPITAL,', textLeft, curY + 24, { width: col1Width - (textLeft - startX) - 4, lineGap: 1.5 })
        .text('MACHHLIPITH B/H LALAGATE, SURAT-395003.', textLeft, curY + 34, { width: col1Width - (textLeft - startX) - 4 })
        .text('Ph: 9898787199', textLeft, curY + 47)
        .text('Website : http://www.princeexp.com', textLeft, curY + 57)

      // Header Col 2: AWB, Destination, Pieces
      const col2X = startX + col1Width + 6
      const labelCol2W = 58
      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold')
        .text('AWB No.', col2X, curY + 10)
        .text(':', col2X + labelCol2W, curY + 10)
        .text(String(awbNumber), col2X + labelCol2W + 8, curY + 10)

        .text('Destination', col2X, curY + 30)
        .text(':', col2X + labelCol2W, curY + 30)
        .text(String(receiver.country || shipment.destination_country || '').toUpperCase(), col2X + labelCol2W + 8, curY + 30)

        .text('Pieces', col2X, curY + 50)
        .text(':', col2X + labelCol2W, curY + 50)
        .text(String(shipment.no_of_pieces || parcels.length || 1), col2X + labelCol2W + 8, curY + 50)

      // Header Col 3: Date & Pay Status
      const col3X = startX + col1Width + col2Width + 6
      const bookingDate = shipment.created_at
        ? new Date(shipment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const payStatus = shipment.payment_status || 'Fully UnPaid'

      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold')
        .text('Date :', col3X, curY + 10)
        .font('Helvetica').text(bookingDate, col3X + 34, curY + 10)

        .font('Helvetica-Bold').text('Pay  :', col3X, curY + 30)
        .font('Helvetica').text(payStatus, col3X + 34, curY + 30)

      curY += totalHeaderHeight

      // ── SECTION 2: SHIPPER / CONSIGNEE / CHARGES ──
      const sColWidth = 220
      const cColWidth = 220
      const chgColWidth = 115

      // Vertical dividers for Row 2
      doc.moveTo(startX + sColWidth, curY).lineTo(startX + sColWidth, curY + row2Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()
      doc.moveTo(startX + sColWidth + cColWidth, curY).lineTo(startX + sColWidth + cColWidth, curY + row2Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()
      doc.moveTo(startX, curY + row2Height).lineTo(startX + contentWidth, curY + row2Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()

      // Shipper Block
      const sX = startX + 6
      doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold').text('Shipper :', sX, curY + 6)

      let sY = curY + 22
      const sName = (sender.name || sender.company || '').toUpperCase()
      if (sName) {
        doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text(sName, sX, sY, { width: sColWidth - 14 })
        sY += 14
      }
      const sAddress = [sender.address, sender.address_2, sender.city, sender.state, sender.pincode ? `SURAT-${sender.pincode}` : ''].filter(Boolean).join('\n').toUpperCase()
      if (sAddress) {
        doc.fillColor(TEXT_DARK).fontSize(7.8).font('Helvetica').text(sAddress, sX, sY, { width: sColWidth - 14, lineGap: 2 })
        sY += (sender.address ? 36 : 18)
      }
      const sPhone1 = sender.phone || ''
      const sPhone2 = sender.phone_2 || sender.phone2 || ''
      const sPhones = [sPhone1, sPhone2].filter(Boolean).join(' / ')
      if (sPhones) {
        doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text(`Ph : ${sPhones}`, sX, curY + row2Height - 18)
      }

      // Consignee Block
      const cX = startX + sColWidth + 6
      doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold').text('Consignee :', cX, curY + 6)

      let rY = curY + 22
      const rName = (receiver.name || receiver.company || '').toUpperCase()
      if (rName) {
        doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text(rName, cX, rY, { width: cColWidth - 14 })
        rY += 14
      }
      const rAddressParts = [receiver.address, receiver.address_2, receiver.city, receiver.state, receiver.pincode, receiver.country].filter(Boolean).join('\n').toUpperCase()
      if (rAddressParts) {
        doc.fillColor(TEXT_DARK).fontSize(7.8).font('Helvetica').text(rAddressParts, cX, rY, { width: cColWidth - 14, lineGap: 2 })
      }
      const rPhone1 = receiver.phone || ''
      const rPhone2 = receiver.phone_2 || receiver.phone2 || ''
      const rPhones = [rPhone1, rPhone2].filter(Boolean).join(' / ')
      if (rPhones) {
        doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text(`Ph : ${rPhones}`, cX, curY + row2Height - 18)
      }

      // ── Charges Breakdown Sub-Table (Right Col) ──
      const chgX = startX + sColWidth + cColWidth

      // Calculate weights properly - use final_chargeable_weight first
      const actWt = parseFloat(shipment.weight || 0)
      const volWt = parseFloat(shipment.volumetric_weight || 0)
      const finalChgWt = parseFloat(shipment.final_chargeable_weight) || parseFloat(shipment.chargeable_weight) || Math.max(actWt, volWt) || 0

      // Extract charge values from shipment data
      const ratePerKg = parseFloat(shipment.rate_per_kg || 0)
      const shippingCharge = parseFloat(shipment.shipping_charge || shipment.amount || 0)
      const extraCharge = parseFloat(shipment.extra_charge || 0)
      const totalAmount = parseFloat(shipment.total_amount) || (shippingCharge + extraCharge)

      // 5 sub-rows for charges breakdown
      const chargesRows = [
        { label: 'Weight (KG)', val: finalChgWt.toFixed(2) },
        { label: 'Rate/KG', val: ratePerKg > 0 ? ratePerKg.toFixed(2) : '-' },
        { label: 'Charges', val: shippingCharge.toFixed(2) },
        { label: 'Extra Chrg.', val: extraCharge.toFixed(2) },
        { label: 'Total', val: totalAmount.toFixed(2) }
      ]

      const chgRowH = row2Height / chargesRows.length

      chargesRows.forEach((row, rIdx) => {
        const ry = curY + (rIdx * chgRowH)
        if (rIdx > 0) {
          doc.moveTo(chgX, ry).lineTo(chgX + chgColWidth, ry).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke()
        }
        // Sub-divider inside Charges cell
        doc.moveTo(chgX + 65, ry).lineTo(chgX + 65, ry + chgRowH).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke()

        // Label
        const isTotal = rIdx === chargesRows.length - 1
        const labelFont = isTotal ? 'Helvetica-Bold' : 'Helvetica-Bold'
        const labelColor = isTotal ? RED : NAVY
        const valColor = isTotal ? RED : TEXT_DARK
        const valFont = isTotal ? 'Helvetica-Bold' : 'Helvetica-Bold'

        doc.fillColor(labelColor).fontSize(7.5).font(labelFont)
          .text(row.label, chgX + 3, ry + Math.floor((chgRowH - 9) / 2), { width: 60, align: 'center' })
        doc.fillColor(valColor).fontSize(8).font(valFont)
          .text(row.val, chgX + 67, ry + Math.floor((chgRowH - 9) / 2), { width: 44, align: 'right' })
      })

      curY += row2Height

      // ── SECTION 3: CONTENTS & TOTALS ──
      const contentsWidth = 440
      const totalsWidth = 115

      // Vertical & horizontal dividers for Row 3
      doc.moveTo(startX + contentsWidth, curY).lineTo(startX + contentsWidth, curY + row3Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()
      doc.moveTo(startX, curY + row3Height).lineTo(startX + contentWidth, curY + row3Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()

      // Contents Left Block
      const cntX = startX + 6
      doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold').text('Contents:', cntX, curY + 6)

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

      doc.fillColor(TEXT_DARK).fontSize(7.8).font('Helvetica').text(contentsStr, cntX, curY + 22, { width: contentsWidth - 14, lineGap: 2.5 })

      // ── Totals Right Block ──
      const totX = startX + contentsWidth
      const freightVal = shippingCharge.toFixed(2)
      const extraVal = extraCharge.toFixed(2)
      const subTotalVal = (shippingCharge + extraCharge).toFixed(2)
      const sgstVal = '0.00'
      const cgstVal = '0.00'
      const grandTotalVal = totalAmount.toFixed(2)
      const receivedVal = '0.00'
      const creditVal = totalAmount.toFixed(2)

      const totalsRows = [
        { label: 'Freight :', val: freightVal },
        { label: 'Extra Chrg :', val: extraVal },
        { label: 'Sub Total :', val: subTotalVal },
        { label: 'SGST :', val: sgstVal },
        { label: 'CGST :', val: cgstVal },
        { label: 'Grand Total :', val: grandTotalVal, isBold: true, isRed: true },
        { label: 'Received :', val: receivedVal, isBold: true },
        { label: 'Credit :', val: creditVal, isBold: true }
      ]

      const totRowH = (row3Height - 6) / totalsRows.length
      let totY = curY + 3

      totalsRows.forEach((tr, tIdx) => {
        if (tIdx === 5) {
          // Solid line before Grand Total
          doc.moveTo(totX, totY - 1).lineTo(totX + totalsWidth, totY - 1).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()
        }

        const fontName = tr.isBold ? 'Helvetica-Bold' : 'Helvetica'
        const fontColor = tr.isRed ? RED : NAVY

        doc.fillColor(fontColor).fontSize(7.5).font(fontName)
          .text(tr.label, totX + 4, totY + 1)
        doc.fillColor(fontColor).fontSize(7.5).font(fontName)
          .text(tr.val, totX + 52, totY + 1, { width: totalsWidth - 58, align: 'right' })

        totY += totRowH
      })

      curY += row3Height

      // ── SECTION 4: TERMS & CONDITIONS & SIGNATURE ──
      const termsWidth = 390
      const sigWidth = 165

      // Vertical divider for Row 4
      doc.moveTo(startX + termsWidth, curY).lineTo(startX + termsWidth, curY + row4Height).strokeColor(BORDER_COLOR).lineWidth(0.75).stroke()

      // Terms Left Block
      const tX = startX + 6
      doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text('TERMS & CONDITION:', tX, curY + 5)

      const termsList = [
        '1. Parcels will send on the complete risk and responsibility of customers.',
        '2. Customers are responsible for clearance of custom of courier shipment (parcels).',
        '3. Claming cannot be done by customer for any breakage or thieving.',
        '4. Customers are responsible for any changes in weight of parcel and are also responsible for payment of Service-Tax as well as changes in Service-Tax if any.',
        '5. No Guarantee for Duty Amount in Any Country.'
      ]

      let tLineY = curY + 18
      termsList.forEach(term => {
        doc.fillColor(TEXT_DARK).fontSize(6.5).font('Helvetica').text(term, tX, tLineY, { width: termsWidth - 14, lineGap: 1 })
        tLineY += (term.length > 80 ? 20 : 13)
      })

      // Receiver's Signature Right Block
      const sigX = startX + termsWidth + 6
      doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text("Receiver's Signature", sigX, curY + 5)

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
