import * as XLSX from 'xlsx'

/**
 * Export a list of shipments to an Excel (.xlsx) file with all booking form fields.
 * @param {Array} shipments - Array of shipment/booking objects from database
 * @param {string} fileName - Optional custom filename
 */
export function exportShipmentsToExcel(shipments = [], fileName = '') {
  if (!shipments || shipments.length === 0) {
    throw new Error('No shipments available to export.')
  }

  // Format rows with every single attribute from the booking form
  const formattedRows = shipments.map((s, index) => {
    // Parse sender/receiver objects safely
    let sender = s.senders || s.sender || {}
    if (typeof sender === 'string') {
      try { sender = JSON.parse(sender) } catch { sender = {} }
    }
    let receiver = s.receivers || s.receiver || {}
    if (typeof receiver === 'string') {
      try { receiver = JSON.parse(receiver) } catch { receiver = {} }
    }
    let vendorConfig = s.vendor_api_configs || s.vendor_config || {}
    if (typeof vendorConfig === 'string') {
      try { vendorConfig = JSON.parse(vendorConfig) } catch { vendorConfig = {} }
    }
    let courierProvider = s.courier_providers || s.courier_provider || {}
    if (typeof courierProvider === 'string') {
      try { courierProvider = JSON.parse(courierProvider) } catch { courierProvider = {} }
    }

    // Parse invoice items
    let invoiceItemsSummary = ''
    let invoiceItems = []
    if (s.invoice_items) {
      try {
        invoiceItems = typeof s.invoice_items === 'string' ? JSON.parse(s.invoice_items) : s.invoice_items
      } catch {}
    }
    if (Array.isArray(invoiceItems) && invoiceItems.length > 0) {
      invoiceItemsSummary = invoiceItems
        .map((it, i) => `${i + 1}. ${it.description || 'ITEM'} (Qty: ${it.quantity || 1} ${it.unit_type || 'PCS'}, Rate: ₹${it.unit_rates || 0}, Amt: ₹${it.amount || 0}, HSN: ${it.hs_code || '—'})`)
        .join(' | ')
    }

    return {
      'Sr. No': index + 1,
      'AWB / Tracking Number': s.tracking_number || s.order_id || '—',
      'Order Reference No': s.order_reference || '—',
      'Status': String(s.status || 'draft').toUpperCase(),
      'Vendor Push Status': s.vendor_push_status || '—',
      'Is Locked': s.is_locked ? 'YES' : 'NO',
      'Vendor / Carrier': vendorConfig.name || courierProvider.name || s.vendor_code || '—',
      'Vendor Code': s.vendor_code || vendorConfig.vendor_code || '—',
      'Service Code': s.service_code || '—',
      'Product Code': s.product_code || '—',
      'Forwarding / Vendor AWB': s.vendor_awb_number || s.vendor_result?.awbNumber || '—',

      // Shipper Details
      'Shipper Name': sender.name || s.s_name || s.sender_name || s.sender_company || '—',
      'Shipper Company': s.sender_company || sender.company || s.s_company || '—',
      'Shipper Phone': sender.phone || s.s_phone || s.sender_phone || '—',
      'Shipper Email': sender.email || s.s_email || s.sender_email || '—',
      'Shipper Address Line 1': sender.address || s.s_address || s.sender_address || '—',
      'Shipper Address Line 2': s.sender_address_2 || sender.address_2 || s.s_address_2 || '—',
      'Shipper City': sender.city || s.s_city || s.sender_city || '—',
      'Shipper State': sender.state || s.s_state || s.sender_state || '—',
      'Shipper Pincode': sender.pincode || s.s_pincode || s.sender_pincode || '—',
      'Shipper Country': sender.country || s.s_country || s.sender_country || 'INDIA',
      'Shipper ID/GST Type': s.sender_gstin_type || sender.gstin_type || '—',
      'Shipper ID/GST Number': s.sender_gstin_no || sender.gstin_no || '—',

      // Consignee Details
      'Consignee Name': receiver.name || s.r_name || s.receiver_name || s.receiver_company || '—',
      'Consignee Company': s.receiver_company || receiver.company || s.r_company || '—',
      'Consignee Phone': receiver.phone || s.r_phone || s.receiver_phone || '—',
      'Consignee Email': receiver.email || s.r_email || s.receiver_email || '—',
      'Consignee Address Line 1': receiver.address || s.r_address || s.receiver_address || '—',
      'Consignee Address Line 2': s.receiver_address_2 || receiver.address_2 || s.r_address_2 || '—',
      'Consignee City': receiver.city || s.r_city || s.receiver_city || '—',
      'Consignee State': receiver.state || s.r_state || s.receiver_state || '—',
      'Consignee Pincode': receiver.pincode || s.r_pincode || s.receiver_pincode || '—',
      'Consignee Country': receiver.country || s.r_country || s.receiver_country || '—',
      'Consignee ID/GST Type': s.receiver_gstin_type || receiver.gstin_type || '—',
      'Consignee ID/GST Number': s.receiver_gstin_no || receiver.gstin_no || '—',

      // Package & Dimensions
      'Package Type': String(s.package_type || 'parcel').toUpperCase(),
      'Pieces (Boxes)': parseInt(s.no_of_pieces) || 1,
      'Actual Weight (KG)': parseFloat(s.weight) || 0,
      'Length (CM)': parseFloat(s.length) || 0,
      'Breadth (CM)': parseFloat(s.breadth) || 0,
      'Height (CM)': parseFloat(s.height) || 0,
      'Volumetric Weight (KG)': parseFloat(s.volumetric_weight) || 0,
      'Chargeable Weight (KG)': parseFloat(s.chargeable_weight) || parseFloat(s.weight) || 0,
      'Content Description': s.content_description || '—',
      'Declared Value': parseFloat(s.declared_value) || 0,
      'Is Fragile': s.is_fragile ? 'YES' : 'NO',

      // Financial & Charges
      'Payment Mode': String(s.payment_mode || 'prepaid').toUpperCase(),
      'Shipping Charge (₹)': parseFloat(s.shipping_charge) || 0,
      'Total Amount (₹)': parseFloat(s.total_amount) || parseFloat(s.shipping_charge) || 0,
      'COD Amount (₹)': parseFloat(s.cod_amount) || 0,

      // Commercial Invoice & Export Details
      'Invoice Number': s.invoice_no || s.order_id || '—',
      'Invoice Date': s.invoice_date || (s.created_at ? s.created_at.split('T')[0] : '—'),
      'Invoice Currency': s.invoice_currency || 'INR',
      'Terms of Trade': s.terms_of_trade || 'CIF',
      'HS Code': s.hs_code || '—',
      'Export Reason': s.export_reason || 'COMMERCIAL',
      'Invoice Type': s.invoice_type || 'INVOICE',
      'Invoice Note / Instructions': s.invoice_note || s.remarks || '—',
      'Invoice Items Details': invoiceItemsSummary || '—',

      // Timestamps
      'Booking Date': s.booking_date || (s.created_at ? s.created_at.split('T')[0] : '—'),
      'Booking Time': s.booking_time || '—',
      'Created At': s.created_at ? new Date(s.created_at).toLocaleString() : '—'
    }
  })

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(formattedRows)

  // Auto-fit column widths
  const columnWidths = Object.keys(formattedRows[0] || {}).map(key => {
    let maxLen = key.length
    formattedRows.forEach(row => {
      const val = String(row[key] || '')
      if (val.length > maxLen) maxLen = Math.min(val.length, 60)
    })
    return { wch: Math.max(maxLen + 3, 12) }
  })
  worksheet['!cols'] = columnWidths

  // Create workbook
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Shipments')

  // Generate date stamp for file name
  const dateStr = new Date().toISOString().split('T')[0]
  const outName = fileName || `PrinceExp_Shipments_Export_${dateStr}.xlsx`

  // Download Excel file
  XLSX.writeFile(workbook, outName)
}
