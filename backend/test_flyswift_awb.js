import { query } from './src/config/db.js'
import { createAdapter } from './src/courierAdapters/adapterRegistry.js'

async function runTest() {
  try {
    const configs = await query("SELECT * FROM vendor_api_configs WHERE vendor_code LIKE '%fly%' OR vendor_code LIKE '%swift%' OR id = 2")
    if (configs.length === 0) {
      console.log('No FlySwift vendor config found in DB')
      process.exit(1)
    }

    const config = configs[0]
    console.log('Using Vendor Config ID:', config.id, 'Vendor Code:', config.vendor_code)
    console.log('Auth URL:', config.auth_url)
    console.log('Shipment URL:', config.shipment_api_url)

    const adapter = createAdapter(config)
    const authContext = await adapter.authenticate()
    console.log('Auth Context:', authContext)

    const sampleShipment = {
      order_id: 'TEST-' + Date.now(),
      tracking_number: 'TEST-' + Date.now(),
      order_reference: 'REF-12345',
      weight: 1.5,
      length: 10,
      breadth: 10,
      height: 10,
      no_of_pieces: 1,
      package_type: 'parcel',
      payment_mode: 'prepaid',
      shipping_charge: 150,
      total_amount: 150,
      declared_value: 500,
      content_description: 'Test Apparel',
      vendor_code: (config.available_vendor_codes && config.available_vendor_codes[0]?.code) || 'FLY',
      service_code: (config.available_services && config.available_services[0]?.code) || 'EXPRESS',
      product_code: (config.available_product_codes && config.available_product_codes[0]?.code) || 'SPX',
      sender_name: 'Prince Express',
      sender_email: 'info@princeexpress.in',
      sender_phone: '9876543210',
      sender_address: '123 Main St',
      sender_city: 'Surat',
      sender_state: 'Gujarat',
      sender_pincode: '395003',
      sender_country: 'IN',
      receiver_name: 'John Doe',
      receiver_email: 'john@example.com',
      receiver_phone: '1234567890',
      receiver_address: '456 Market St',
      receiver_city: 'Dubai',
      receiver_state: 'Dubai',
      receiver_pincode: '00000',
      receiver_country: 'AE',
      invoice_no: 'INV-1001',
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_currency: 'USD',
      hs_code: '610910',
      export_reason: 'Commercial Sale',
      terms_of_trade: 'FOB'
    }

    const payload = adapter.buildPayload(sampleShipment, authContext)
    const headers = adapter.buildHeaders(authContext)
    console.log('\n--- REQUEST PAYLOAD ---')
    console.log(JSON.stringify(payload, null, 2))

    console.log('\n--- SENDING REQUEST TO FLYSWIFT ---')
    const response = await fetch(adapter.getShipmentUrl(), {
      method: adapter.getHttpMethod(),
      headers,
      body: JSON.stringify(payload)
    })

    const text = await response.text()
    console.log('Status Code:', response.status)
    console.log('Raw Response Text:', text)

    let json = {}
    try {
      json = JSON.parse(text)
    } catch {}

    const parsed = adapter.parseResponse(json)
    console.log('\n--- PARSED RESPONSE ---')
    console.log(parsed)

    process.exit(0)
  } catch (err) {
    console.error('Test Failed:', err)
    process.exit(1)
  }
}

runTest()
