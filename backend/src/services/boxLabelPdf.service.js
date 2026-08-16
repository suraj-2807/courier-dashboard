import PDFDocument from 'pdfkit'
import bwipjs from 'bwip-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Ensure uploads directory exists
const LABELS_DIR = path.join(__dirname, '..', '..', 'uploads', 'labels')
if (!fs.existsSync(LABELS_DIR)) {
  fs.mkdirSync(LABELS_DIR, { recursive: true })
}

// Logo path
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'PRINCE LOGO.png')

/**
 * Generate Code128 Barcode PNG buffer
 */
async function generateBarcode(text, height = 25, includetext = false) {
  try {
    const bwipOptions = {
      bcid: 'code128',
      text: String(text),
      scale: 3,
      height: height,
      includetext: includetext
    }
    if (includetext) {
      bwipOptions.textxalign = 'center'
      bwipOptions.textsize = 10
    }
    const png = await bwipjs.toBuffer(bwipOptions)
    return png
  } catch (err) {
    console.error('Box Label barcode generation failed:', err.message)
    return null
  }
}

/**
 * Generate Box Shipping Labels PDF (4" x 6" size, 1 page per box)
 */
export async function generateBoxLabelsPdf(params) {
  const {
    awbNumber,
    sender = {},
    receiver = {},
    shipment = {},
    parcels = []
  } = params

  const totalBoxes = parseInt(shipment.no_of_pieces) || (parcels.length > 0 ? parcels.length : 1)
  const pdfPath = path.join(LABELS_DIR, `BoxLabels_${awbNumber}.pdf`)

  const NAVY = '#0D2132'
  const RED = '#BB0013'

  return new Promise(async (resolve, reject) => {
    try {
      // Standard 4" x 6" label dimensions in points (288 x 432 pt)
      const labelWidth = 288
      const labelHeight = 432

      const doc = new PDFDocument({
        size: [labelWidth, labelHeight],
        margin: 8,
        autoFirstPage: false
      })

      const writeStream = fs.createWriteStream(pdfPath)
      doc.pipe(writeStream)

      const formattedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const isDoc = shipment.package_type === 'document'

      // Generate Barcode PNG buffers
      const barcodeBuffer = await generateBarcode(awbNumber, 30, 0)
      const vertBarcodeBuffer = await generateBarcode(awbNumber, 20, 0)

      for (let i = 1; i <= totalBoxes; i++) {
        doc.addPage({ size: [labelWidth, labelHeight], margin: 8 })

        const startX = 8
        const startY = 8
        const w = labelWidth - 16
        const h = labelHeight - 16

        // ── Outer Label Border Box ──
        doc.rect(startX, startY, w, h).strokeColor(NAVY).lineWidth(1.5).stroke()

        // ── Top Header Section (Height: 38 pt) ──
        doc.rect(startX, startY, w, 38).strokeColor(NAVY).lineWidth(1).stroke()
        
        // Logo or Company Brand Header
        if (fs.existsSync(LOGO_PATH)) {
          try {
            doc.image(LOGO_PATH, startX + 4, startY + 4, { fit: [35, 30] })
          } catch (e) {}
        }
        
        doc.fillColor(NAVY).fontSize(9.5).font('Helvetica-Bold').text('PRINCE EXPRESS', startX + 42, startY + 6)
        doc.fillColor('#4B5563').fontSize(7.5).font('Helvetica').text(formattedDate, startX + 42, startY + 20)

        // Vertical divider 1
        doc.moveTo(startX + 140, startY).lineTo(startX + 140, startY + 38).strokeColor(NAVY).stroke()

        // Mode (NONDOX / DOX)
        doc.fillColor(NAVY).fontSize(11).font('Helvetica-Bold').text(isDoc ? 'DOX' : 'NONDOX', startX + 142, startY + 12, { width: 60, align: 'center' })

        // Vertical divider 2
        doc.moveTo(startX + 205, startY).lineTo(startX + 205, startY + 38).strokeColor(NAVY).stroke()

        // Box Counter (e.g. 1/3)
        doc.fillColor(RED).fontSize(14).font('Helvetica-Bold').text(`${i}/${totalBoxes}`, startX + 208, startY + 10, { width: 60, align: 'center' })

        // ── Middle Section ──
        const midY = startY + 38
        const midHeight = 278

        // Right Vertical Barcode Strip (Width: 55 pt)
        const rightStripX = startX + w - 55
        doc.moveTo(rightStripX, midY).lineTo(rightStripX, midY + midHeight).strokeColor(NAVY).stroke()

        // Draw rotated vertical barcode in right strip
        if (vertBarcodeBuffer) {
          doc.save()
          doc.translate(rightStripX + 35, midY + 15)
          doc.rotate(90)
          doc.image(vertBarcodeBuffer, 0, 0, { width: 230, height: 26 })
          doc.restore()
        }

        // Vertical AWB Text
        doc.save()
        doc.translate(rightStripX + 12, midY + 240)
        doc.rotate(-90)
        doc.fillColor(NAVY).fontSize(9.5).font('Helvetica-Bold').text(`AWB: ${awbNumber}`, 0, 0)
        doc.restore()

        // Left Content Section (Width: w - 55 pt = 217 pt)
        const leftW = w - 55

        // 1. CONSIGNEE Box (Height: 125 pt)
        const cY = midY + 4
        doc.fillColor(NAVY).fontSize(9.5).font('Helvetica-Bold').text('CONSIGNEE', startX + 6, cY)
        if (receiver.phone) {
          doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text(receiver.phone, startX + 6, cY, { width: leftW - 12, align: 'right' })
        }

        let rY = cY + 14
        if (receiver.name) {
          doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold').text(receiver.name.toUpperCase(), startX + 6, rY, { width: leftW - 12 })
          rY += 12
        }
        if (receiver.company) {
          doc.fillColor(NAVY).fontSize(8).font('Helvetica-Bold').text(receiver.company.toUpperCase(), startX + 6, rY, { width: leftW - 12 })
          rY += 11
        }

        const rAddress = `${receiver.address || ''} ${receiver.address_2 || ''}`.trim()
        if (rAddress) {
          doc.fillColor('#374151').fontSize(7.5).font('Helvetica').text(rAddress.toUpperCase(), startX + 6, rY, { width: leftW - 12 })
          rY += 22
        }

        const rCityLine = `${receiver.city || ''}, ${receiver.state || ''} ${receiver.pincode || ''}`.trim()
        if (rCityLine) {
          doc.fillColor(NAVY).fontSize(8).font('Helvetica-Bold').text(rCityLine.toUpperCase(), startX + 6, rY, { width: leftW - 12 })
          rY += 11
        }
        if (receiver.country) {
          doc.fillColor(NAVY).fontSize(8).font('Helvetica-Bold').text(receiver.country.toUpperCase(), startX + 6, rY, { width: leftW - 12 })
        }

        // Divider line between Consignee & Shipper
        doc.moveTo(startX, midY + 128).lineTo(rightStripX, midY + 128).strokeColor(NAVY).lineWidth(0.75).stroke()

        // 2. SHIPPER Box (Height: 115 pt)
        const sY = midY + 132
        doc.fillColor(NAVY).fontSize(9.5).font('Helvetica-Bold').text('SHIPPER', startX + 6, sY)
        if (sender.phone) {
          doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text(sender.phone, startX + 6, sY, { width: leftW - 12, align: 'right' })
        }

        let sCurY = sY + 14
        if (sender.name) {
          doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold').text(sender.name.toUpperCase(), startX + 6, sCurY, { width: leftW - 12 })
          sCurY += 12
        }
        if (sender.company) {
          doc.fillColor(NAVY).fontSize(8).font('Helvetica-Bold').text(sender.company.toUpperCase(), startX + 6, sCurY, { width: leftW - 12 })
          sCurY += 11
        }

        const sAddress = `${sender.address || ''} ${sender.address_2 || ''}`.trim()
        if (sAddress) {
          doc.fillColor('#374151').fontSize(7.5).font('Helvetica').text(sAddress.toUpperCase(), startX + 6, sCurY, { width: leftW - 12 })
          sCurY += 22
        }

        const sCityLine = `${sender.city || ''}, ${sender.state || ''} ${sender.pincode || ''}`.trim()
        if (sCityLine) {
          doc.fillColor(NAVY).fontSize(8).font('Helvetica-Bold').text(sCityLine.toUpperCase(), startX + 6, sCurY, { width: leftW - 12 })
          sCurY += 11
        }
        if (sender.country) {
          doc.fillColor(NAVY).fontSize(8).font('Helvetica-Bold').text(sender.country.toUpperCase(), startX + 6, sCurY, { width: leftW - 12 })
        }

        // Divider line above Weight
        doc.moveTo(startX, midY + 246).lineTo(rightStripX, midY + 246).strokeColor(NAVY).lineWidth(0.75).stroke()

        // 3. Actual Box Weight
        const parcelObj = parcels[i - 1] || {}
        const boxWeight = parcelObj.weight ? parseFloat(parcelObj.weight).toFixed(2) : (parseFloat(shipment.weight || 0) / totalBoxes).toFixed(2)

        doc.fillColor(NAVY).fontSize(9.5).font('Helvetica-Bold').text(`Actual Box Weight : ${boxWeight} kg`, startX + 6, midY + 254)

        // ── Bottom Banner & Barcode Section (Height: 100 pt) ──
        const botY = midY + midHeight
        doc.moveTo(startX, botY).lineTo(startX + w, botY).strokeColor(NAVY).lineWidth(1).stroke()

        // Routing banner (e.g. SURAT  ->  ZAMBIA)
        const originCode = sender.city ? sender.city.toUpperCase() : 'SURAT'
        const destCode = (receiver.country || shipment.destination_country || 'DEST').toUpperCase()
        doc.fillColor(NAVY).fontSize(11).font('Helvetica-Bold').text(`${originCode}  ->  ${destCode}  (EXPRESS)`, startX, botY + 8, { width: w, align: 'center' })

        doc.fillColor('#6B7280').fontSize(7.5).font('Helvetica-Bold').text('TRACKING AWB BARCODE', startX, botY + 24, { width: w, align: 'center' })

        // Horizontal Barcode
        if (barcodeBuffer) {
          doc.image(barcodeBuffer, startX + (w - 210) / 2, botY + 36, { width: 210, height: 32 })
        }

        // Box Label Text (e.g. 1177111 / BOX 01)
        const boxNumberStr = `${awbNumber} / BOX ${String(i).padStart(2, '0')}`
        doc.fillColor(RED).fontSize(11).font('Helvetica-Bold').text(boxNumberStr, startX, botY + 74, { width: w, align: 'center' })
      }

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

