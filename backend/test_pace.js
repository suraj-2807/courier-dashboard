import assert from 'node:assert/strict'
import test from 'node:test'
import { createAdapter } from './src/courierAdapters/adapterRegistry.js'
import { getPaceTrackingSettings } from './src/courierAdapters/PaceAdapter.js'
import { resolveVendorDetails } from './src/services/remoteAwbEntry.service.js'
import { encrypt } from './src/utils/encryption.js'

const credentials = encrypt({ user_id: 'pace-test', password: 'fake-password', customer_code: 'ABC', company_code: 'XYZ' })
const config = { vendor_code: 'pace', auth_credentials: credentials }
const shipment = {
  vendor_code: 'TEST',
  service_code: 'Express',
  product_code: 'INTL',
  package_type: 'Document',
  parcels: [{ weight: 1 }, { weight: 2 }]
}

test('Pace maps inline credentials, service, document type and each box', () => {
  const payload = createAdapter(config).buildPayload(shipment, {})
  assert.equal(payload.UserID, 'pace-test')
  assert.equal(payload.Password, 'fake-password')
  assert.equal(payload.CustomerCode, 'ABC')
  assert.equal(payload.CompanyCode, 'XYZ')
  assert.equal(payload.VendorName, 'TEST')
  assert.equal(payload.ServiceName, 'Express')
  assert.equal(payload.ProductCode, 'INTL')
  assert.equal(payload.Dox_Spx, 'DOX')
  assert.equal(payload.Weight, '3.000')
  assert.deepEqual(payload.Dimensions.map(box => box.ActualWeight), ['1.000', '2.000'])
})

test('Pace rejects missing credentials, service or a response without an AWB', () => {
  assert.throws(() => createAdapter({ vendor_code: 'pace' }).buildPayload(shipment, {}), /User ID and Password/)
  const adapter = createAdapter(config)
  assert.throws(() => adapter.buildPayload({ ...shipment, service_code: '' }, {}), /vendor and service codes/)
  assert.equal(adapter.parseResponse({ Status: 'Success' }).success, false)
  assert.equal(adapter.parseResponse({ Status: 'Failed', AWBNo: '10001', APIStatus: 'Invalid service' }).errorMessage, 'Invalid service')
  const result = adapter.parseResponse({ Status: 'Success', AWBNo: '10001', ForwardingNo: '1ZTEST' })
  assert.equal(result.awbNumber, '10001')
  assert.equal(result.forwardingNumber, '1ZTEST')
})

test('Pace tracking and AWB reporting use the saved Pace account', () => {
  const settings = getPaceTrackingSettings(config)
  assert.equal(settings.userId, 'pace-test')
  assert.equal(settings.trackingUrl, 'https://cloud.pacegroupintl.com/api/v1/Tracking/Tracking')
  assert.deepEqual(resolveVendorDetails('TEST', 'Pace Group International', 'Express', credentials), {
    vendCode: 'PACE',
    vendName: 'PACE GROUP',
    service: 1008,
    autotrack: 1,
    accode: 'ABC',
    tuser: 'pace-test',
    tpass: 'fake-password',
    apikey: ''
  })
})
