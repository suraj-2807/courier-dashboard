import BaseAdapter from './BaseAdapter.js'
import { decrypt } from '../utils/encryption.js'

/**
 * PacificAdapter — Adapter for Pacific Express courier API.
 * 
 * Flow:
 *   Inline authentication. Credentials (UserID, Password, CustomerCode) are sent
 *   directly inside the shipment request body (Awbentry).
 */
function parseCredentials(raw) {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null) return raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return {}
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed)
      } catch (e) {}
    }
    try {
      const decrypted = decrypt(trimmed)
      if (decrypted) {
        return typeof decrypted === 'object' ? decrypted : JSON.parse(decrypted)
      }
    } catch (e) {}
    try {
      return JSON.parse(trimmed)
    } catch (e) {}
  }
  return {}
}

export default class PacificAdapter extends BaseAdapter {

  async authenticate() {
    // Inline authentication - credentials go in buildPayload, so return empty context
    return {}
  }

  buildPayload(shipmentData, authContext) {
    const credentials = parseCredentials(this.config.auth_credentials)

    // Credentials — match Pacific API spec max lengths
    const userId = this._truncate(credentials.user_id || credentials.username || credentials.UserID || 'P0503', 10)
    const password = this._truncate(credentials.password || credentials.Password || 'P0503@7199', 10)
    const customerCode = this._truncate(credentials.customer_code || credentials.CustomerCode || userId, 10)

    // VendorName & ServiceName resolution
    let vendorName = ''
    let serviceName = ''

    // 1. Explicitly selected vendor_code from shipment data (highest priority)
    if (shipmentData.vendor_code && shipmentData.vendor_code.trim()) {
      vendorName = shipmentData.vendor_code.trim()
      serviceName = (shipmentData.service_code || '').trim()
    }

    // 2. Parse service_code from booking for legacy/fallback (e.g. 'DHL-EXPRESS')
    if (!vendorName && !serviceName && shipmentData.service_code && shipmentData.service_code.trim()) {
      const sc = shipmentData.service_code.trim()
      if (sc.includes('-')) {
        const dashIdx = sc.indexOf('-')
        const parsedVendor = sc.substring(0, dashIdx).trim()
        const parsedService = sc.substring(dashIdx + 1).trim()
        vendorName = parsedVendor
        serviceName = parsedService
      } else {
        // Single value without dash — use as serviceName
        serviceName = sc
      }
    }

    // 3. Fallback to credentials override if still not set
    if (!vendorName) {
      if (credentials.vendor_name && credentials.vendor_name.trim()) {
        vendorName = credentials.vendor_name.trim()
      } else if (credentials.VendorName && credentials.VendorName.trim()) {
        vendorName = credentials.VendorName.trim()
      }
    }
    if (!serviceName) {
      if (credentials.service_name && credentials.service_name.trim()) {
        serviceName = credentials.service_name.trim()
      } else if (credentials.ServiceName && credentials.ServiceName.trim()) {
        serviceName = credentials.ServiceName.trim()
      }
    }

    // 4. Final fallbacks — NEVER send empty values (Pacific rejects them)
    if (!vendorName) vendorName = 'PC'
    if (!serviceName) serviceName = 'SELF'

    vendorName = this._truncate(vendorName, 4) || 'PC'
    serviceName = this._truncate(serviceName, 50) || 'SELF'

    console.log('Pacific payload debug:', { userId, customerCode, vendorName, serviceName })

    // Address splitting (30 char limit per line, and Add2 cannot be empty)
    let shipperAdd1 = this._truncate(shipmentData.sender_address, 30)
    let shipperAdd2 = this._truncate(shipmentData.sender_address_2, 30)
    if (!shipperAdd2 && shipmentData.sender_address && shipmentData.sender_address.length > 30) {
      shipperAdd1 = shipmentData.sender_address.slice(0, 30).trim()
      shipperAdd2 = this._truncate(shipmentData.sender_address.slice(30, 60), 30)
    }
    if (!shipperAdd1) shipperAdd1 = 'Address Line 1'
    if (!shipperAdd2) shipperAdd2 = '.'

    let consigneeAdd1 = this._truncate(shipmentData.receiver_address, 30)
    let consigneeAdd2 = this._truncate(shipmentData.receiver_address_2, 30)
    if (!consigneeAdd2 && shipmentData.receiver_address && shipmentData.receiver_address.length > 30) {
      consigneeAdd1 = shipmentData.receiver_address.slice(0, 30).trim()
      consigneeAdd2 = this._truncate(shipmentData.receiver_address.slice(30, 60), 30)
    }
    if (!consigneeAdd1) consigneeAdd1 = 'Address Line 1'
    if (!consigneeAdd2) consigneeAdd2 = '.'

    // Document / KYC mappings
    const docType = this._truncate(shipmentData.sender_gstin_type || credentials.default_document_type || 'Aadhaar Number', 50)
    const docNumber = this._truncate(shipmentData.sender_gstin_no || credentials.default_document_number || '123456789012', 15)
    const consigneeDocType = this._truncate(shipmentData.receiver_gstin_type || 'Pan Number', 50)
    const consigneeDocNumber = this._truncate(shipmentData.receiver_gstin_no || '1234567890', 15)

    // Numbers and Specs
    const numPieces = parseInt(shipmentData.no_of_pieces) || 1
    const totalWeight = parseFloat(shipmentData.weight) || 1.0
    const perPieceWeight = (totalWeight / numPieces).toFixed(3)
    const length = parseFloat(shipmentData.length || 10).toFixed(3)
    const width = parseFloat(shipmentData.breadth || 10).toFixed(3)
    const height = parseFloat(shipmentData.height || 10).toFixed(3)

    const bookingDateStr = shipmentData.booking_date || new Date().toISOString().split('T')[0]
    const invoiceDateStr = shipmentData.invoice_date || bookingDateStr

    // Date calculations
    const eAwbDate = this._formatDateDDMMYYYY(invoiceDateStr)
    const eAwbExpDate = this._formatDateDDMMYYYY(
      new Date(new Date(bookingDateStr).getTime() + 10 * 24 * 60 * 60 * 1000)
    )

    // Parse parcels for multi-box dimensions
    let parcelsList = []
    if (shipmentData.parcels) {
      try {
        parcelsList = typeof shipmentData.parcels === 'string' ? JSON.parse(shipmentData.parcels) : shipmentData.parcels
      } catch {}
    }

    // Build Dimensions array (using individual box dimensions if provided)
    const dimensions = []
    if (Array.isArray(parcelsList) && parcelsList.length > 0) {
      parcelsList.forEach((p, idx) => {
        const pWeight = parseFloat(p.weight) || parseFloat(perPieceWeight) || 1.0
        const pLength = parseFloat(p.length) || parseFloat(length) || 10.0
        const pWidth = parseFloat(p.breadth || p.width) || parseFloat(width) || 10.0
        const pHeight = parseFloat(p.height) || parseFloat(height) || 10.0
        dimensions.push({
          ActualWeight: String(pWeight.toFixed(3)),
          Vol_WeightL: String(pLength.toFixed(3)),
          Vol_WeightW: String(pWidth.toFixed(3)),
          Vol_WeightH: String(pHeight.toFixed(3))
        })
      })
    } else {
      for (let i = 0; i < numPieces; i++) {
        dimensions.push({
          ActualWeight: String(perPieceWeight),
          Vol_WeightL: String(length),
          Vol_WeightW: String(width),
          Vol_WeightH: String(height)
        })
      }
    }

    // Build Performa array from invoice_items if provided, or fallback to per-piece breakdown
    let invoiceItemsList = []
    if (shipmentData.invoice_items) {
      try {
        invoiceItemsList = typeof shipmentData.invoice_items === 'string' ? JSON.parse(shipmentData.invoice_items) : shipmentData.invoice_items
      } catch {}
    }

    const itemDescriptions = Array.isArray(invoiceItemsList) ? invoiceItemsList.map(item => item.description).filter(Boolean) : []
    const derivedContent = itemDescriptions.length > 0 ? itemDescriptions.join(', ') : ''
    const contentDescription = (shipmentData.content_description && shipmentData.content_description !== 'General Goods' && shipmentData.content_description !== 'ITEMS / GOODS INSIDE')
      ? shipmentData.content_description
      : (derivedContent || shipmentData.content_description || 'Shipment Content')

    const declaredValue = parseFloat(shipmentData.total_amount || shipmentData.shipping_charge || shipmentData.declared_value || 100)
    const performa = []

    if (Array.isArray(invoiceItemsList) && invoiceItemsList.length > 0) {
      invoiceItemsList.forEach((item, idx) => {
        const qty = String(parseFloat(item.quantity) || 1)
        const unitRate = parseFloat(item.unit_rates || item.cost || item.rate || (parseFloat(item.amount) / (parseFloat(qty) || 1)) || 0)
        const totalItemAmount = parseFloat(item.amount) || (parseFloat(qty) * unitRate) || 0
        const itemWeight = parseFloat(item.unit_weight) || (parseFloat(totalWeight) / invoiceItemsList.length) || parseFloat(perPieceWeight) || 0.5
        const boxNoClean = String(item.box_no || (idx + 1)).replace(/^box-?/i, '')

        performa.push({
          BoxNo: `Box-${boxNoClean}`,
          Description: this._truncate(item.description || contentDescription || 'Shipment Content', 50),
          HSNCode: this._truncate(item.hs_code || shipmentData.hs_code || '123456', 10),
          Quantity: qty,
          Unit: item.unit_type || item.unit || 'PCS',
          Rate: unitRate.toFixed(2),
          Amount: totalItemAmount.toFixed(2),
          Weight: itemWeight.toFixed(3),
          PerformaIGST: "0",
          PerformaIGSTAmount: "0"
        })
      })
    } else {
      const perPieceValue = (declaredValue / numPieces).toFixed(2)
      for (let i = 0; i < numPieces; i++) {
        performa.push({
          BoxNo: `Box-${i + 1}`,
          Description: this._truncate(contentDescription || 'Shipment Content', 50),
          HSNCode: this._truncate(shipmentData.hs_code || '123456', 10),
          Quantity: '1',
          Unit: 'PCS',
          Rate: String(perPieceValue),
          Amount: String(perPieceValue),
          Weight: String(perPieceWeight),
          PerformaIGST: "0",
          PerformaIGSTAmount: "0"
        })
      }
    }

    let productCode = ''
    if (shipmentData.product_code && shipmentData.product_code.trim()) {
      productCode = shipmentData.product_code.trim()
    } else {
      const packageTypeUpper = String(shipmentData.package_type || 'SPX').toUpperCase()
      const isDoc = packageTypeUpper === 'DOCUMENT' || packageTypeUpper === 'DOX'
      productCode = isDoc ? 'DOX' : 'SPX'
    }

    // Return the exact structure matching the Pacific API Awbentry spec
    return {
      UserID: userId,
      Password: password,
      CustomerCode: customerCode,
      CustomerRefNo: this._truncate(shipmentData.order_id || shipmentData.tracking_number || '', 30),
      OriginName: this._truncate(shipmentData.sender_city || 'AMD', 30),
      DestinationName: this._truncate(shipmentData.receiver_country || 'US', 30),
      ShipperName: this._truncate(shipmentData.sender_company || shipmentData.sender_name || '', 40),
      ShipperContact: this._truncate(shipmentData.sender_name || '', 40),
      ShipperAdd1: shipperAdd1,
      ShipperAdd2: shipperAdd2,
      ShipperCity: this._truncate(shipmentData.sender_city || '', 30),
      ShipperState: this._truncate(shipmentData.sender_state || shipmentData.sender_city || 'NA', 30),
      ShipperPin: this._truncate(shipmentData.sender_pincode || '', 7),
      ShipperTelno: this._truncate(shipmentData.sender_phone || '9999999999', 40),
      ShipperMobile: this._truncate(shipmentData.sender_phone || '9999999999', 20),
      ShipperEmail: this._truncate(shipmentData.sender_email || '', 50),
      DocumentType: docType,
      DocumentNumber: docNumber,
      ConsigneeName: this._truncate(shipmentData.receiver_company || shipmentData.receiver_name || '', 40),
      ConsigneeContact: this._truncate(shipmentData.receiver_name || '', 40),
      ConsigneeAdd1: consigneeAdd1,
      ConsigneeAdd2: consigneeAdd2,
      ConsigneeCity: this._truncate(shipmentData.receiver_city || '', 30),
      ConsigneeState: this._truncate(shipmentData.receiver_state || '', 30),
      ConsigneePin: this._truncate(shipmentData.receiver_pincode || '', 10),
      ConsigneeTelno: this._truncate(shipmentData.receiver_phone || '9999999999', 40),
      ConsigneeMobile: this._truncate(shipmentData.receiver_phone || '9999999999', 20),
      ConsigneeEmail: this._truncate(shipmentData.receiver_email || '', 100),
      ConsigneeDocumentType: consigneeDocType,
      ConsigneeDocumentNumber: consigneeDocNumber,
      Instruction: this._truncate(shipmentData.remarks || 'Testing', 200),
      VendorName: vendorName,
      ServiceName: serviceName,
      ProductCode: productCode,
      Dox_Spx: productCode,
      Pieces: String(numPieces),
      Weight: totalWeight.toFixed(3),
      Content: this._truncate(contentDescription, 150),
      Currency: this._truncate(shipmentData.invoice_currency || 'INR', 3),
      ShipmentValue: String(declaredValue.toFixed(0)),
      CODAmount: shipmentData.payment_mode === 'cod' ? parseFloat(shipmentData.cod_amount || shipmentData.total_amount || 0).toFixed(2) : '0.00',
      CSBType: this._truncate(shipmentData.csb_type || shipmentData.export_reason || 'COMMERCIAL', 15),
      TermofInvoice: this._truncate(shipmentData.terms_of_trade || 'CIF', 3),
      InvoiceNo: this._truncate(shipmentData.invoice_no || shipmentData.order_id || '', 15),
      InvoiceDate: this._formatDateDDMMYYYY(invoiceDateStr),
      CompanyCode: this._truncate(shipmentData.company_code || credentials.company_code || vendorName || 'PC', 3),
      IsCommercial: shipmentData.is_commercial !== '' && shipmentData.is_commercial !== undefined ? (parseInt(shipmentData.is_commercial) || 0) : ((shipmentData.export_reason === 'COMMERCIAL' || shipmentData.export_reason === 'commercial') ? 1 : 0),
      OTP: shipmentData.otp || "123456",
      LSPType: shipmentData.lsp_type || "I",
      RequiredPerforma: shipmentData.required_performa || "y",
      RequiredLable: shipmentData.required_label || "y",
      KYCDocumentType: docType,
      KYCImage: "",
      ImageType: "PDF",
      ExportReason: this._truncate(shipmentData.export_reason || 'FREE SAMPLE OF NO COMMERICAL VALUE', 150),
      KYCImage1: "",
      ImageType1: "PDF",
      EAWBNO: this._truncate(shipmentData.eawb_no || shipmentData.invoice_no || shipmentData.order_id || 'testeawb123', 15),
      EAWBDate: shipmentData.eawb_date ? this._formatDateDDMMYYYY(shipmentData.eawb_date) : eAwbDate,
      EAWBExpDate: shipmentData.eawb_exp_date ? this._formatDateDDMMYYYY(shipmentData.eawb_exp_date) : eAwbExpDate,
      Dimensions: dimensions,
      Performa: performa,
      additionalInfo: {
        discount: shipmentData.additional_discount || "0.00",
        Freight_Charges: shipmentData.additional_freight || parseFloat(shipmentData.shipping_charge || 0).toFixed(2),
        Insurance: shipmentData.additional_insurance || "0.00",
        Other_charges: shipmentData.additional_other_charges || "0.00",
        SpecifyCharges: shipmentData.additional_specify_charges || "0"
      },
      Buyerdetails: {
        DestinationCode: this._truncate(shipmentData.buyer_destination_code || shipmentData.receiver_country || 'US', 30),
        Name: this._truncate(shipmentData.buyer_name || shipmentData.receiver_name || '', 40),
        Person: shipmentData.buyer_person_type || 'Individual',
        Address1: this._truncate(shipmentData.buyer_address1 || '', 30) || consigneeAdd1,
        Address2: this._truncate(shipmentData.buyer_address2 || '', 30) || consigneeAdd2,
        PinCode: this._truncate(shipmentData.buyer_pincode || shipmentData.receiver_pincode || '', 10),
        City: this._truncate(shipmentData.buyer_city || shipmentData.receiver_city || '', 30),
        State: this._truncate(shipmentData.buyer_state || shipmentData.receiver_state || '', 30),
        Telephone: this._truncate(shipmentData.buyer_telephone || shipmentData.receiver_phone || '', 40),
        Mobile: this._truncate(shipmentData.buyer_mobile || shipmentData.receiver_phone || '', 20),
        Email: this._truncate(shipmentData.buyer_email || shipmentData.receiver_email || '', 100),
        countryCode: this._truncate(shipmentData.buyer_country_code || shipmentData.receiver_country || 'US', 30),
        IECNo: shipmentData.buyer_iec_no || ""
      },
      ManifestGstDetails: {
        GST_Invoice: shipmentData.gst_invoice || "0",
        LUTIGST: shipmentData.lut_igst || "N",
        TotalIGST: shipmentData.total_igst || "0.00",
        BankADCode: shipmentData.bank_ad_code || "",
        BankAccount: shipmentData.bank_account || "",
        BankIFSC: shipmentData.bank_ifsc || "",
        LUTNumber: shipmentData.lut_number || "",
        ExchangeRate: shipmentData.exchange_rate || "0.00",
        Firm: shipmentData.manifest_firm || "",
        NFEI: shipmentData.manifest_nfei || "1",
        PayofIGST: shipmentData.pay_of_igst || "0",
        ECommerce: shipmentData.manifest_ecommerce || "0",
        MEISScheme: shipmentData.meis_scheme || "0",
        Format: shipmentData.manifest_format || "C2C",
        IECNo: shipmentData.manifest_iec_no || docNumber,
        LUTIssueDate: shipmentData.lut_issue_date || "",
        LUTTillDate: shipmentData.lut_till_date || ""
      },
      fedexSpecial: {
        chkDangerousgd: "",
        Dangergd: "",
        chkDryIce: "",
        Totalwt: "",
        chkSatdelv: "0",
        satddil: "",
        chkAlcohol: "0",
        AlcoholPck: "",
        AlcoholCnt: "",
        FdxBillShipmentTo: "",
        ShipmentChargesAccountNo: "",
        fdxPaidBy: "",
        DutiesPaymentAccountNo: "",
        bsobroker: {
          chkBSOBroker: "0",
          bsobrokername: "",
          bsocontactname: "",
          country_code: "",
          bso_address1: "",
          bso_statecode: "",
          bso_city: "",
          bso_postalcode: "",
          bso_phoneno: ""
        }
      },
      upsSpecial: {
        chkInsuCvrg: "",
        Insurance_value: "",
        UPSBillShipmentTo: "",
        UPSShipmentChargesAccountNo: "",
        UPSPostalCode: "",
        UPSCountryCode: ""
      }
    }
  }

  parseResponse(responseBody) {
    // Support both flat response and nested Response wrapper
    const response = responseBody?.Response || responseBody || {}
    
    const status = String(response.Status || response.status || '').toLowerCase()
    const code = String(response.ResponseCode || response.responseCode || '')
    
    // Success if Status is 'success', ResponseCode is '00', or a ForwardingNo is returned
    const success = status === 'success'
      || status === 'true'
      || code === '00'
      || (response.ForwardingNo && String(response.ForwardingNo).trim() !== '')

    // Extract AWB / tracking number
    const awbNumber = String(
      response.ForwardingNo || response.ForwardingNo1 || response.AwbNo || response.awbNo || response.AWBNo || ''
    ).trim()

    // Extract Label URL / Base64 pdf data
    let labelUrl = response.Label || response.AuxLbl || response.label || ''
    if (labelUrl && !labelUrl.startsWith('http') && !labelUrl.startsWith('data:')) {
      // If it's raw base64 data, convert to data URI
      labelUrl = `data:application/pdf;base64,${labelUrl}`
    }
    
    // Fallback tracking url
    const trackingUrl = String(response.TrackingUrl || response.trackingUrl || '')

    let errorMessage = ''
    if (!success) {
      if (Array.isArray(response.Error)) {
        errorMessage = response.Error.map(err => err.Description || err.Description || err.error || '').filter(Boolean).join('; ')
      } else if (Array.isArray(response.errors)) {
        errorMessage = response.errors.join('; ')
      } else {
        errorMessage = response.APIError || response.APIStatus || response.message || response.Message || response.error || 'Pacific API returned failure'
      }
    }

    return { success, awbNumber, trackingUrl, labelUrl, errorMessage }
  }

  // ─── Private helpers ───

  _truncate(str, length, fallback = '') {
    if (str === null || str === undefined) return fallback
    return String(str).slice(0, length).trim()
  }

  _formatDateDDMMYYYY(dateString) {
    if (!dateString) {
      const d = new Date()
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    }

    // If it's already DD/MM/YYYY, return it
    if (typeof dateString === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
      return dateString
    }

    try {
      const d = new Date(dateString)
      if (isNaN(d.getTime())) {
        return dateString
      }
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    } catch {
      return dateString
    }
  }
}
