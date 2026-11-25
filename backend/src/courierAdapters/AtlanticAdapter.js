import PacificAdapter, { parseCredentials } from './PacificAdapter.js'

export default class AtlanticAdapter extends PacificAdapter {
  buildPayload(shipmentData, authContext) {
    const credentials = parseCredentials(this.config.auth_credentials)
    const companyCode = [credentials.company_code, credentials.CompanyCode]
      .map(value => String(value ?? '').trim())
      .find(Boolean)
    if (!companyCode) {
      throw new Error('Set the Atlantic Company Code in API Settings before pushing this shipment.')
    }

    const serviceName = [shipmentData.service_code, credentials.service_name, credentials.ServiceName]
      .map(value => String(value ?? '').trim())
      .find(Boolean)
    if (!serviceName) {
      throw new Error('Select an Atlantic service for this shipment before pushing it.')
    }

    return {
      ...super.buildPayload({ ...shipmentData, vendor_code: 'TC1', service_code: serviceName }, authContext),
      ServiceName: serviceName,
      CompanyCode: companyCode
    }
  }
}
