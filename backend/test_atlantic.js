import assert from 'node:assert/strict'
import test from 'node:test'
import { createAdapter } from './src/courierAdapters/adapterRegistry.js'
import { encrypt } from './src/utils/encryption.js'

const shipment = { vendor_code: 'atlantic', service_code: ' UPS DUTY PAID ', product_code: 'SPX' }

test('Atlantic sends the portal vendor code and preserves the service and configured company code', () => {
  const credentials = encrypt(JSON.stringify({ company_code: ' ABCD ' }))

  for (const vendorCode of ['atlantic', 'atlanticcourier', 'atlantic_courier']) {
    const adapter = createAdapter({ vendor_code: vendorCode, auth_credentials: credentials })
    const payload = adapter.buildPayload(shipment, {})

    assert.equal(payload.VendorName, 'TC1')
    assert.equal(payload.ServiceName, 'UPS DUTY PAID')
    assert.equal(payload.CompanyCode, 'ABCD')
    assert.equal(payload.ProductCode, 'SPX')
  }
})

test('Atlantic rejects missing company and service settings before submission', () => {
  const unconfigured = createAdapter({ vendor_code: 'atlantic' })
  assert.throws(() => unconfigured.buildPayload(shipment, {}), /Atlantic Company Code/)

  const configured = createAdapter({ vendor_code: 'atlantic', auth_credentials: { CompanyCode: 'ABC' } })
  assert.throws(() => configured.buildPayload({ ...shipment, service_code: '' }, {}), /Select an Atlantic service/)
})

test('Pacific still uses its own vendor, service, and company mapping', () => {
  const adapter = createAdapter({ vendor_code: 'pacific' })
  const payload = adapter.buildPayload({ service_code: 'DHL-EXPRESS' }, {})

  assert.equal(payload.VendorName, 'DHL')
  assert.equal(payload.ServiceName, 'EXPRESS')
  assert.equal(payload.CompanyCode, 'DHL')
})
