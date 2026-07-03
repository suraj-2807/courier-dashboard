import { query } from './src/config/db.js'
import { decrypt } from './src/utils/encryption.js'

async function testFlySwift() {
  try {
    const configRows = await query('SELECT * FROM vendor_api_configs WHERE id = 2')
    if (configRows.length === 0) {
      console.log('No FlySwift config found')
      process.exit(0)
    }
    const config = configRows[0]

    // Decrypt credentials
    let credentials = {}
    try {
      credentials = JSON.parse(decrypt(config.auth_credentials))
    } catch (e) {
      console.log('Failed to decrypt credentials:', e.message)
      process.exit(1)
    }

    const companyIdRaw = credentials.company_code || credentials.company_id
    let companyId = null
    if (companyIdRaw !== undefined && companyIdRaw !== null && companyIdRaw !== '') {
      const parsed = parseInt(companyIdRaw, 10)
      companyId = isNaN(parsed) ? companyIdRaw : parsed
    }

    const authPayload = {
      company_id: companyId,
      email: credentials.username || credentials.user_id || credentials.email || '',
      password: credentials.password || ''
    }

    const authRes = await fetch(config.auth_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authPayload)
    })

    const authData = await authRes.json()
    const token = authData?.data?.token || authData?.token
    const customerId = authData?.data?.customer_id || authData?.customer_id || credentials.customer_id || ''

    if (!token) {
      console.log('No token returned')
      process.exit(1)
    }

    // List of potential fields to try
    const potentialFields = [
      { key: 'freight', value: 100 },
      { key: 'freight', value: '100.00' },
      { key: 'freight_amount', value: 100 },
      { key: 'freight_amount', value: '100.00' },
      { key: 'freight_charge', value: 100 },
      { key: 'freight_charge', value: '100.00' },
      { key: 'freight_charges', value: 100 },
      { key: 'freight_charges', value: '100.00' },
      { key: 'shipping_charge', value: 100 },
      { key: 'shipping_charge', value: '100.00' },
      { key: 'shipping_charges', value: 100 },
      { key: 'shipping_charges', value: '100.00' },
      { key: 'collect_amount', value: 100 },
      { key: 'collect_amount', value: '100.00' },
      { key: 'cod_amount', value: 100 },
      { key: 'cod_amount', value: '100.00' },
      { key: 'total_amount', value: 100 },
      { key: 'total_amount', value: '100.00' },
      { key: 'amount', value: 100 },
      { key: 'amount', value: '100.00' },
      { key: 'rate', value: 100 },
      { key: 'rate', value: '100.00' },
      { key: 'tariff', value: 100 },
      { key: 'tariff', value: '100.00' },
      { key: 'price', value: 100 },
      { key: 'price', value: '100.00' },
      { key: 'total_freight', value: 100 },
      { key: 'total_freight', value: '100.00' },
      { key: 'net_amount', value: 100 },
      { key: 'net_amount', value: '100.00' }
    ]

    // Base template using the format that is closest to Log 1 / Log 2
    const getBasePayload = (testFieldKey, testFieldValue) => {
      // We will merge the testing field into both flat level and docket_items / free_form_line_items
      const payload = {
        customer_id: String(customerId),
        service_code: 'S',
        order_number: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        consignee_name: 'Suraj Sabu',
        consignee_phone: '9645620022',
        consignee_email: 'surajsabu2807@gmail.com',
        consignee_address: '123 Test Street, Mumbai Hub',
        consignee_city: 'Mumbai',
        consignee_state: 'Maharashtra',
        consignee_pincode: '400001',
        consignee_country: 'INDIA',
        shipper_name: 'Aadil talati',
        shipper_phone: '8200076892',
        shipper_email: 'talatiaadil2003@gmail.com',
        shipper_address: '63, Rang Avdhoot Society V-2',
        shipper_city: 'Surat',
        shipper_state: 'Gujarat',
        shipper_pincode: '395005',
        shipper_country: 'INDIA',
        weight: 10,
        length: 50,
        breadth: 70,
        height: 15,
        pieces: 1,
        product_type: 'SPX',
        content_description: 'Clothes',
        declared_value: 100,
        payment_mode: 'PREPAID',
        cod_amount: 0,
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        remarks: ''
      }

      payload[testFieldKey] = testFieldValue
      return payload
    }

    for (const field of potentialFields) {
      const payload = getBasePayload(field.key, field.value)
      
      const res = await fetch(config.shipment_api_url, {
        method: config.shipment_api_method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const text = await res.text()
      let result = text
      try {
        const parsed = JSON.parse(text)
        if (parsed.success) {
          console.log(`SUCCESS! Field: ${field.key} = ${JSON.stringify(field.value)}. Response:`, parsed)
          process.exit(0)
        }
        result = parsed.errors ? parsed.errors.join('; ') : text
      } catch (e) {}

      console.log(`Field: ${field.key} = ${JSON.stringify(field.value)} -> Status: ${res.status}, Error: ${result}`)
    }

  } catch (error) {
    console.log('ERROR:', error)
  }
  process.exit(0)
}

testFlySwift()
