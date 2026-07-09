import BaseAdapter from './BaseAdapter.js'
import { decrypt } from '../utils/encryption.js'

/**
 * PacificAdapter — Adapter for Pacific Express courier API.
 * 
 * Flow:
 *   Inline authentication. Credentials (UserID, Password, CustomerCode) are sent
 *   directly inside the shipment request body (Awbentry).
 */
export default class PacificAdapter extends BaseAdapter {

  async authenticate() {
    // Inline authentication - credentials go in buildPayload, so return empty context
    return {}
  }

  buildPayload(shipmentData, authContext) {
    let credentials = {}
    try {
      if (this.config.auth_credentials) {
        credentials = JSON.parse(decrypt(this.config.auth_credentials))
      }
    } catch (e) {
      console.warn('Pacific: Failed to decrypt credentials, using defaults/empty.', e.message)
    }

    // Credentials — match Pacific API spec max lengths
    const userId = this._truncate(credentials.user_id || credentials.username || credentials.UserID || 'P0503', 10)
    const password = this._truncate(credentials.password || credentials.Password || 'P0503@7199', 10)
    const customerCode = this._truncate(credentials.customer_code || credentials.CustomerCode || userId, 10)

    // VendorName & ServiceName resolution
    // Priority: credentials > service_code parsing > defaults
    let vendorName = ''
    let serviceName = ''

    // 1. Start with credential overrides (highest priority)
    if (credentials.vendor_name && credentials.vendor_name.trim()) {
      vendorName = credentials.vendor_name.trim()
    } else if (credentials.VendorName && credentials.VendorName.trim()) {
      vendorName = credentials.VendorName.trim()
    }
    if (credentials.service_name && credentials.service_name.trim()) {
      serviceName = credentials.service_name.trim()
    } else if (credentials.ServiceName && credentials.ServiceName.trim()) {
      serviceName = credentials.ServiceName.trim()
    }

    // 2. service_code from booking can override (only if non-empty after parsing)
    if (shipmentData.service_code && shipmentData.service_code.trim()) {
      const sc = shipmentData.service_code.trim()
      if (sc.includes('-')) {
        const dashIdx = sc.indexOf('-')
        const parsedVendor = sc.substring(0, dashIdx).trim()
        const parsedService = sc.substring(dashIdx + 1).trim()
        if (parsedVendor) vendorName = parsedVendor
        if (parsedService) serviceName = parsedService
      } else {
        // Single value without dash — use as vendorName only if no credential override
        if (!vendorName) vendorName = sc
      }
    }

    // 3. Final fallbacks — NEVER send empty values (Pacific rejects them)
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

    // Build Dimensions array
    const dimensions = []
    for (let i = 0; i < numPieces; i++) {
      dimensions.push({
        ActualWeight: String(perPieceWeight),
        Vol_WeightL: String(length),
        Vol_WeightW: String(width),
        Vol_WeightH: String(height)
      })
    }

    // Build Performa array
    const declaredValue = parseFloat(shipmentData.declared_value || shipmentData.total_amount || 100)
    const perPieceValue = (declaredValue / numPieces).toFixed(2)
    const performa = []
    for (let i = 0; i < numPieces; i++) {
      performa.push({
        BoxNo: `Box-${i + 1}`,
        Description: this._truncate(shipmentData.content_description || 'Shipment Content', 50),
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

    const packageTypeUpper = String(shipmentData.package_type || 'SPX').toUpperCase()
    const isDoc = packageTypeUpper === 'DOCUMENT' || packageTypeUpper === 'DOX'
    const productCode = isDoc ? 'DOX' : 'SPX'

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
      Content: this._truncate(shipmentData.content_description || 'Shipment Content', 150),
      Currency: this._truncate(shipmentData.invoice_currency || 'INR', 3),
      ShipmentValue: String(declaredValue.toFixed(0)),
      CODAmount: shipmentData.payment_mode === 'cod' ? parseFloat(shipmentData.cod_amount || shipmentData.total_amount || 0).toFixed(2) : '0.00',
      CSBType: this._truncate(shipmentData.export_reason || 'COMMERCIAL', 15),
      TermofInvoice: this._truncate(shipmentData.terms_of_trade || 'CIF', 3),
      InvoiceNo: this._truncate(shipmentData.invoice_no || shipmentData.order_id || '', 15),
      InvoiceDate: this._formatDateDDMMYYYY(invoiceDateStr),
      CompanyCode: this._truncate(credentials.company_code || vendorName || 'PC', 3),
      IsCommercial: (shipmentData.export_reason === 'COMMERCIAL' || shipmentData.export_reason === 'commercial') ? 1 : 0,
      OTP: "123456",
      LSPType: "I",
      RequiredPerforma: "y",
      RequiredLable: "y",
      KYCDocumentType: docType,
      KYCImage: "",
      ImageType: "PDF",
      ExportReason: this._truncate(shipmentData.export_reason || 'FREE SAMPLE OF NO COMMERICAL VALUE', 150),
      KYCImage1: "",
      ImageType1: "PDF",
      EAWBNO: this._truncate(shipmentData.invoice_no || shipmentData.order_id || 'testeawb123', 15),
      EAWBDate: eAwbDate,
      EAWBExpDate: eAwbExpDate,
      Dimensions: dimensions,
      Performa: performa,
      additionalInfo: {
        discount: "0.00",
        Freight_Charges: parseFloat(shipmentData.shipping_charge || 0).toFixed(2),
        Insurance: "0.00",
        Other_charges: "0.00",
        SpecifyCharges: "0"
      },
      Buyerdetails: {
        DestinationCode: this._truncate(shipmentData.receiver_country || 'US', 30),
        Name: this._truncate(shipmentData.receiver_name || '', 40),
        Person: 'Individual',
        Address1: consigneeAdd1,
        Address2: consigneeAdd2,
        PinCode: this._truncate(shipmentData.receiver_pincode || '', 10),
        City: this._truncate(shipmentData.receiver_city || '', 30),
        State: this._truncate(shipmentData.receiver_state || '', 30),
        Telephone: this._truncate(shipmentData.receiver_phone || '', 40),
        Mobile: this._truncate(shipmentData.receiver_phone || '', 20),
        Email: this._truncate(shipmentData.receiver_email || '', 100),
        countryCode: this._truncate(shipmentData.receiver_country || 'US', 30),
        IECNo: ""
      },
      ManifestGstDetails: {
        GST_Invoice: "0",
        LUTIGST: "N",
        TotalIGST: "0.00",
        BankADCode: "",
        BankAccount: "",
        BankIFSC: "",
        LUTNumber: "",
        ExchangeRate: "0.00",
        Firm: "",
        NFEI: "1",
        PayofIGST: "0",
        ECommerce: "0",
        MEISScheme: "0",
        Format: "C2C",
        IECNo: docNumber,
        LUTIssueDate: "",
        LUTTillDate: ""
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
