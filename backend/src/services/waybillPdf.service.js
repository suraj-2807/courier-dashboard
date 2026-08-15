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

/**
 * Generate Code128 Barcode PNG buffer
 */
async function generateBarcode(text, height = 15, textsize = 10) {
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: String(text),
      scale: 3,
      height: height,
      includetext: true,
      textxalign: 'center',
      textsize: textsize
    })
    return png
  } catch (err) {
    console.error('Waybill barcode generation failed:', err.message)
    return null
  }
}

/**
 * Generate Shipping Bill / Waybill PDF matching Prince Courier branding
 */
export async function generateWaybillPdf(params) {
  const {
    awbNumber,
    sender = {},
    receiver = {},
    shipment = {},
    parcels = [],
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
      let curY = 20
      const contentWidth = 555

      // Generate Barcode for top right AWB
      const barcodeBuffer = await generateBarcode(awbNumber, 18, 9)

      // ── Outer Border Box ──
      doc.rect(startX, curY, contentWidth, 800).strokeColor('#0D2132').lineWidth(1.5).stroke()

      // ── Header Block (Height: 70) ──
      const headerHeight = 70
      doc.rect(startX, curY, contentWidth, headerHeight).strokeColor('#0D2132').lineWidth(1).stroke()

      // Left Logo & Brand Info (Width: 360)
      doc.fillColor('#BB0013').fontSize(16).font('Helvetica-Bold').text('PRINCE COURIER SERVICE', startX + 10, curY + 10)
      doc.fillColor('#0D2132').fontSize(8).font('Helvetica').text('International & Domestic Express Logistics', startX + 10, curY + 28)
      doc.fontSize(7.5).fillColor('#5F6B7A').text('Phone: +91 94261 07199  |  Email: info@princecourier.com  |  www.princecourier.com', startX + 10, curY + 42)

      // Right AWB Barcode Block (Width: 195)
      const rightX = startX + 360
      doc.moveTo(rightX, curY).lineTo(rightX, curY + headerHeight).strokeColor('#0D2132').stroke()
      
      doc.fillColor('#0D2132').fontSize(8).font('Helvetica-Bold').text('AWB NUMBER', rightX + 10, curY + 6, { width: 175, align: 'center' })
      if (barcodeBuffer) {
        doc.image(barcodeBuffer, rightX + 15, curY + 18, { width: 165, height: 42 })
      } else {
        doc.fillColor('#BB0013').fontSize(16).font('Helvetica-Bold').text(String(awbNumber), rightX + 10, curY + 25, { width: 175, align: 'center' })
      }

      curY += headerHeight

      // Helper for drawing boxed table rows
      const drawRow = (y, height, cols) => {
        doc.rect(startX, y, contentWidth, height).strokeColor('#0D2132').lineWidth(0.75).stroke()
        let currentX = startX
        cols.forEach((col, idx) => {
          if (idx > 0) {
            doc.moveTo(currentX, y).lineTo(currentX, y + height).strokeColor('#0D2132').stroke()
          }
          if (col.bg) {
            doc.rect(currentX + 0.5, y + 0.5, col.width - 1, height - 1).fillColor(col.bg).fill()
          }
          if (col.label) {
            doc.fillColor(col.labelColor || '#5F6B7A').fontSize(col.labelSize || 6.5).font('Helvetica-Bold')
              .text(col.label.toUpperCase(), currentX + 4, y + 4, { width: col.width - 8 })
          }
          if (col.value !== undefined) {
            doc.fillColor(col.valueColor || '#0D2132').fontSize(col.valueSize || 8.5).font(col.bold ? 'Helvetica-Bold' : 'Helvetica')
              .text(String(col.value), currentX + 4, y + (col.label ? 14 : 4), { width: col.width - 8, align: col.align || 'left' })
          }
          currentX += col.width
        })
      }

      // ── Row 1: Summary Metrics (Height: 32) ──
      const pcs = shipment.no_of_pieces || 1
      const actWt = parseFloat(shipment.weight || 0).toFixed(2)
      const volWt = parseFloat(shipment.volumetric_weight || 0).toFixed(2)
      const chgWt = parseFloat(shipment.chargeable_weight || Math.max(actWt, volWt)).toFixed(2)

      drawRow(curY, 32, [
        { width: 120, label: 'ACCOUNT NUMBER - NAME', value: `1032 - ${sender.name || 'CUSTOMER'}`, bold: true },
        { width: 55, label: 'ORIGIN', value: sender.country ? sender.country.slice(0, 3).toUpperCase() : 'IN', bold: true, align: 'center' },
        { width: 65, label: 'DESTINATION', value: receiver.country ? receiver.country.slice(0, 3).toUpperCase() : 'US', bold: true, align: 'center' },
        { width: 95, label: 'CHARGEABLE WT.', value: `${chgWt} kg`, bold: true, valueColor: '#BB0013', bg: '#FEF2F2', align: 'center' },
        { width: 75, label: 'ACT WT.', value: `${actWt} kg`, align: 'center' },
        { width: 50, label: 'PCS', value: String(pcs), bold: true, align: 'center' },
        { width: 95, label: 'VOLUMETRIC WT.', value: `${volWt} kg`, align: 'center' }
      ])
      curY += 32

      // ── Row 2: Sender & Receiver Names (Height: 28) ──
      drawRow(curY, 28, [
        { width: 277.5, label: "SENDER'S COMPANY & NAME", value: `${sender.company ? sender.company + ' — ' : ''}${sender.name || ''}`, bold: true },
        { width: 277.5, label: "RECIPIENT'S COMPANY & NAME", value: `${receiver.company ? receiver.company + ' — ' : ''}${receiver.name || ''}`, bold: true }
      ])
      curY += 28

      // ── Row 3: Addresses (Height: 36) ──
      const senderAdd = `${sender.address || ''} ${sender.address_2 || ''}`.trim()
      const receiverAdd = `${receiver.address || ''} ${receiver.address_2 || ''}`.trim()
      drawRow(curY, 36, [
        { width: 277.5, label: 'SENDER ADDRESS', value: senderAdd },
        { width: 277.5, label: 'RECIPIENT ADDRESS', value: receiverAdd }
      ])
      curY += 36

      // ── Row 4: City / State / Country (Height: 26) ──
      const senderLoc = `${sender.city || ''}, ${sender.state || ''}, ${sender.country || 'INDIA'}`.trim()
      const receiverLoc = `${receiver.city || ''}, ${receiver.state || ''}, ${receiver.country || ''}`.trim()
      drawRow(curY, 26, [
        { width: 277.5, label: 'CITY / STATE / COUNTRY', value: senderLoc, bold: true },
        { width: 277.5, label: 'CITY / STATE / COUNTRY', value: receiverLoc, bold: true }
      ])
      curY += 26

      // ── Row 5: PIN & Phone (Height: 26) ──
      drawRow(curY, 26, [
        { width: 138.75, label: 'PIN CODE', value: sender.pincode || '—' },
        { width: 138.75, label: 'TEL NO.', value: sender.phone || '—' },
        { width: 138.75, label: 'PIN / ZIP CODE', value: receiver.pincode || '—' },
        { width: 138.75, label: 'TEL NO.', value: receiver.phone || '—' }
      ])
      curY += 26

      // ── Row 6: Booking Date, Goods Description, Charges (Height: 110) ──
      const bookingDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const isDoc = shipment.package_type === 'document'
      const shipValue = parseFloat(shipment.declared_value || 0).toFixed(2)
      const freight = parseFloat(shipment.shipping_charge || 0)
      const gst = freight * 0.18
      const totalCharge = freight + gst

      // Draw Subtable for Row 6
      doc.rect(startX, curY, contentWidth, 110).strokeColor('#0D2132').lineWidth(0.75).stroke()

      // Column 1: Date & Shipper Sign (Width: 100)
      doc.moveTo(startX + 100, curY).lineTo(startX + 100, curY + 110).strokeColor('#0D2132').stroke()
      doc.fillColor('#5F6B7A').fontSize(6.5).font('Helvetica-Bold').text('BOOKING DATE', startX + 4, curY + 4)
      doc.fillColor('#0D2132').fontSize(8.5).font('Helvetica-Bold').text(bookingDate, startX + 4, curY + 14)
      
      doc.fillColor('#5F6B7A').fontSize(6).font('Helvetica').text('SHIPPER AGREEMENT\nShipper agrees to Prince Courier standard terms & conditions of carriage.', startX + 4, curY + 36, { width: 92 })
      doc.fillColor('#5F6B7A').fontSize(6.5).font('Helvetica-Bold').text("SHIPPER'S SIGN:", startX + 4, curY + 80)
      doc.moveTo(startX + 4, curY + 102).lineTo(startX + 92, curY + 102).strokeColor('#9CA3AF').stroke()

      // Column 2: Goods & Services (Width: 260)
      const col2X = startX + 100
      doc.moveTo(col2X + 260, curY).lineTo(col2X + 260, curY + 110).strokeColor('#0D2132').stroke()

      doc.fillColor('#5F6B7A').fontSize(6.5).font('Helvetica-Bold').text('DESCRIPTION OF GOODS', col2X + 4, curY + 4)
      doc.fillColor('#0D2132').fontSize(9).font('Helvetica-Bold').text(shipment.content_description || 'GENERAL GOODS / PARCEL', col2X + 4, curY + 14, { width: 250 })

      // Inner divider line
      doc.moveTo(col2X, curY + 50).lineTo(col2X + 260, curY + 50).strokeColor('#0D2132').stroke()
      
      // Service & Forwarding
      doc.rect(col2X, curY + 50, 130, 16).fillColor('#0D2132').fill()
      doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold').text('SERVICE', col2X + 4, curY + 54, { width: 120, align: 'center' })
      doc.rect(col2X + 130, curY + 50, 130, 16).fillColor('#0D2132').fill()
      doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold').text('FORWARDING NO.', col2X + 134, curY + 54, { width: 120, align: 'center' })

      doc.fillColor('#0D2132').fontSize(8.5).font('Helvetica-Bold').text(shipment.service_code || 'EXPRESS DUTYPAID', col2X + 4, curY + 72, { width: 120, align: 'center' })
      doc.fillColor('#0D2132').fontSize(8.5).font('Helvetica-Bold').text(shipment.vendor_awb_number || '—', col2X + 134, curY + 72, { width: 120, align: 'center' })

      // Column 3: Ship Value & Ref (Width: 95)
      const col3X = col2X + 260
      doc.moveTo(col3X + 95, curY).lineTo(col3X + 95, curY + 110).strokeColor('#0D2132').stroke()

      doc.fillColor('#5F6B7A').fontSize(6.5).font('Helvetica-Bold').text('SHIP VALUE', col3X + 4, curY + 4)
      doc.fillColor('#0D2132').fontSize(8.5).font('Helvetica').text(`₹${shipValue}`, col3X + 4, curY + 14)

      doc.fillColor('#5F6B7A').fontSize(6.5).font('Helvetica-Bold').text('MODE', col3X + 4, curY + 30)
      doc.fillColor('#BB0013').fontSize(8.5).font('Helvetica-Bold').text(isDoc ? 'DOCUMENT' : 'NON-DOX', col3X + 4, curY + 40)

      doc.fillColor('#5F6B7A').fontSize(6.5).font('Helvetica-Bold').text('INVOICE NO.', col3X + 4, curY + 58)
      doc.fillColor('#0D2132').fontSize(8).font('Helvetica-Bold').text(invoiceMeta.invoice_no || awbNumber, col3X + 4, curY + 68)

      doc.fillColor('#5F6B7A').fontSize(6.5).font('Helvetica-Bold').text('EWAY BILL NO.', col3X + 4, curY + 82)
      doc.fillColor('#0D2132').fontSize(8).font('Helvetica').text('—', col3X + 4, curY + 92)

      // Column 4: Financial Breakdown (Width: 100)
      const col4X = col3X + 95
      const chargeLines = [
        { label: 'Freight:', val: freight.toFixed(2) },
        { label: 'Other Charges:', val: '0.00' },
        { label: 'FSC:', val: '0.00' },
        { label: 'CGST @ 9%:', val: (gst / 2).toFixed(2) },
        { label: 'SGST @ 9%:', val: (gst / 2).toFixed(2) },
        { label: 'IGST @ 18%:', val: '0.00' },
        { label: 'TOTAL:', val: totalCharge.toFixed(2), bold: true, color: '#BB0013' }
      ]

      let cY = curY + 4
      chargeLines.forEach(line => {
        doc.fillColor(line.color || '#5F6B7A').fontSize(line.bold ? 7.5 : 6.5).font(line.bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(line.label, col4X + 4, cY)
        doc.fillColor(line.color || '#0D2132').fontSize(line.bold ? 8 : 7).font(line.bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(line.val, col4X + 4, cY, { width: 90, align: 'right' })
        cY += 14
      })

      curY += 110

      // ── Row 7: Per-Parcel Breakdown Table if Multi-box (Height: 85) ──
      if (parcels.length > 0) {
        doc.rect(startX, curY, contentWidth, 85).strokeColor('#0D2132').lineWidth(0.75).stroke()
        doc.rect(startX, curY, contentWidth, 14).fillColor('#0D2132').fill()
        doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold').text('PARCEL & BOX BREAKDOWN', startX + 10, curY + 3)

        const pCols = [30, 45, 80, 50, 50, 50, 80, 85]
        const pHeaders = ['Box', 'Box No', 'Actual Wt', 'L(cm)', 'B(cm)', 'H(cm)', 'Vol Wt', 'Chg Wt']
        
        let pY = curY + 15
        let px = startX
        pHeaders.forEach((h, idx) => {
          doc.fillColor('#5F6B7A').fontSize(6).font('Helvetica-Bold').text(h, px + 2, pY, { width: pCols[idx] - 4, align: idx >= 2 ? 'center' : 'left' })
          px += pCols[idx]
        })

        pY += 10
        parcels.slice(0, 4).forEach((p, idx) => {
          px = startX
          const pValues = [
            String(idx + 1),
            `Box ${p.box_no || idx + 1}`,
            `${parseFloat(p.weight || 0).toFixed(2)} kg`,
            String(p.length || 0),
            String(p.breadth || 0),
            String(p.height || 0),
            `${parseFloat(p.volumetric_weight || 0).toFixed(2)} kg`,
            `${parseFloat(p.chargeable_weight || 0).toFixed(2)} kg`
          ]
          pValues.forEach((val, cIdx) => {
            doc.fillColor('#0D2132').fontSize(6.5).font(cIdx === 7 ? 'Helvetica-Bold' : 'Helvetica')
              .text(val, px + 2, pY, { width: pCols[cIdx] - 4, align: cIdx >= 2 ? 'center' : 'left' })
            px += pCols[cIdx]
          })
          pY += 11
        })

        curY += 85
      }

      // Footer Terms Notice
      doc.fillColor('#9CA3AF').fontSize(6).font('Helvetica').text('This is a computer generated Shipping Waybill document issued by Prince Courier Service.', startX, 815, { width: contentWidth, align: 'center' })

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
