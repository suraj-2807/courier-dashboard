import PacificAdapter, { parseCredentials } from './PacificAdapter.js'

const PACE_TRACKING_URL = 'https://cloud.pacegroupintl.com/api/v1/Tracking/Tracking'

export function isPaceVendor(config, vendorCode = '') {
  return [vendorCode, config?.vendor_code].some(code => String(code || '').trim().toLowerCase() === 'pace')
    || (config?.tracking_api_url || '').startsWith('https://cloud.pacegroupintl.com/')
}

export function getPaceTrackingSettings(config) {
  const credentials = parseCredentials(config.auth_credentials)
  const userId = String(credentials.user_id || credentials.username || credentials.UserID || '').trim()
  const password = credentials.password || credentials.Password || ''
  if (!userId || !password) {
    throw new Error('Set the Pace API User ID and Password in API Settings.')
  }

  return { userId, password, trackingUrl: config.tracking_api_url || PACE_TRACKING_URL }
}

export default class PaceAdapter extends PacificAdapter {
  buildPayload(shipmentData, authContext) {
    const { userId, password } = getPaceTrackingSettings(this.config)
    const credentials = parseCredentials(this.config.auth_credentials)
    const customerCode = String(credentials.customer_code || credentials.CustomerCode || '').trim()
    if (!customerCode) {
      throw new Error('Set the Pace Customer Code in API Settings before pushing this shipment.')
    }

    const vendorCode = String(shipmentData.vendor_code || '').trim()
    const serviceCode = String(shipmentData.service_code || '').trim()
    if (!vendorCode || vendorCode.toLowerCase() === 'pace' || !serviceCode) {
      throw new Error('Select the Pace vendor and service codes for this shipment before pushing it.')
    }

    const payload = super.buildPayload({ ...shipmentData, vendor_code: vendorCode, service_code: serviceCode }, authContext)
    const companyCode = String(credentials.company_code || credentials.CompanyCode || '').trim()
    const isDocument = ['DOX', 'DOCUMENT', 'DOCUMENTS'].includes(
      String(shipmentData.package_type || payload.ProductCode).trim().toUpperCase()
    )

    return {
      ...payload,
      UserID: userId,
      Password: password,
      CustomerCode: customerCode,
      CompanyCode: companyCode || undefined,
      Dox_Spx: isDocument ? 'DOX' : 'SPX'
    }
  }

  parseResponse(responseBody) {
    const response = responseBody?.Response || responseBody || {}
    const awbNumber = String(response.AWBNo || '').trim()
    if (String(response.Status || '').toLowerCase() !== 'success' || !awbNumber) {
      const details = Array.isArray(response.Error)
        ? response.Error.map(error => error.Description || error.error).filter(Boolean).join('; ')
        : ''
      const errorMessage = details || response.APIError || response.APIStatus || response.ErrorDisc || response.Message
      return {
        success: false,
        awbNumber: '',
        errorMessage: errorMessage || 'Pace API did not return a successful AWB.'
      }
    }

    return super.parseResponse(responseBody)
  }
}
