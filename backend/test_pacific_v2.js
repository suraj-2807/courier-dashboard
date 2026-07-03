import { query } from './src/config/db.js'
import { createAdapter } from './src/courierAdapters/adapterRegistry.js'

async function run() {
  try {
    const configs = await query("SELECT * FROM vendor_api_configs WHERE vendor_code = 'pacific'")
    if (configs.length === 0) {
      console.error('Test Failed: Pacific config not found')
      process.exit(1)
    }

    const adapter = createAdapter(configs[0])

    const testShipment = {
      order_id: 'ORD-12345678901234567890', // 20 chars
      sender_address: 'OFFICE NO. 7, AVON APARTMENT, SHIVAJI ROAD, MUMBAI DISTRICT', // 60 chars long address
      sender_address_2: '',
      receiver_address: '39 WEST 39 WEST 39 WEST 39 WEST STREET', // 38 chars long address
      receiver_address_2: '',
      sender_gstin_no: '', // empty to test Aadhaar fallback
      service_code: 'DHL-EXPRESS', // to test dynamic splitting
      no_of_pieces: '1',
      weight: '1.200',
      content_description: 'Clothes',
      declared_value: '500'
    }

    const payload = adapter.buildPayload(testShipment, {})

    console.log('--- GENERATED PAYLOAD (V2) ---')
    console.log(JSON.stringify(payload, null, 2))

    // 1. Vendor & Service Assertions
    if (payload.VendorName !== 'DHL') throw new Error(`VendorName mapping failed: expected DHL, got ${payload.VendorName}`)
    if (payload.ServiceName !== 'EXPRESS') throw new Error(`ServiceName mapping failed: expected EXPRESS, got ${payload.ServiceName}`)

    // 2. Address splitting assertions
    if (payload.ShipperAdd1 !== 'OFFICE NO. 7, AVON APARTMENT,') throw new Error(`ShipperAdd1 split failed, got: ${payload.ShipperAdd1}`)
    if (payload.ShipperAdd2 !== 'SHIVAJI ROAD, MUMBAI DISTRICT') throw new Error(`ShipperAdd2 split failed, got: ${payload.ShipperAdd2}`)

    if (payload.ConsigneeAdd1 !== '39 WEST 39 WEST 39 WEST 39 WES') throw new Error(`ConsigneeAdd1 split failed, got: ${payload.ConsigneeAdd1}`)
    if (payload.ConsigneeAdd2 !== 'T STREET') throw new Error(`ConsigneeAdd2 split failed, got: ${payload.ConsigneeAdd2}`)

    // 3. Document / KYC assertions
    if (payload.DocumentNumber !== '123456789012') throw new Error(`DocumentNumber fallback failed: expected 123456789012, got ${payload.DocumentNumber}`)

    console.log('\nPayload validations: ALL PASSED!')

    // 4. Test Response parser with the error response provided by the user
    const errorResponseBody = {
      "Response": {
        "ResponseCode": "TD01",
        "Status": "Fail",
        "ErrorCode": "1",
        "APIStatus": "",
        "APIError": "",
        "ForwardingNo": "",
        "ForwardingNo1": "",
        "Label": "",
        "Performa": "",
        "AuxLbl": "",
        "LabelFileType": "",
        "Error": [
          {
            "Description": "Invalid Vendor Code/Name..!"
          },
          {
            "Description": "Invalid Service Name..!"
          },
          {
            "Description": "Document No. cant be empty..!"
          },
          {
            "Description": "Rate not found for Product : INTL. SPX, Vendor :  & Service : SELF recheck the combination and try again."
          },
          {
            "Description": "Shipper address 2 cant be empty..!"
          }
        ],
        "boxlbl": false,
        "isoda": false,
        "RefNoExists": false,
        "BSShipping_LSPType": "I"
      }
    }

    const parsedError = adapter.parseResponse(errorResponseBody)
    console.log('\n--- PARSED ERROR RESPONSE ---')
    console.log(parsedError)

    if (parsedError.success) throw new Error('Response success flag should be false')
    if (parsedError.awbNumber !== '') throw new Error('AWB should be empty')
    if (!parsedError.errorMessage.includes('Invalid Vendor Code/Name..!')) throw new Error('Missing specific error in description')
    if (!parsedError.errorMessage.includes('Shipper address 2 cant be empty..!')) throw new Error('Missing specific error in description')

    // 5. Test Response parser with success response
    const successResponseBody = {
      "Response": {
        "ResponseCode": "00",
        "Status": "Success",
        "ErrorCode": "0",
        "ForwardingNo": "PAC123456",
        "Label": "JVBERi0xLjQKJ..." // Base64 PDF data
      }
    }
    const parsedSuccess = adapter.parseResponse(successResponseBody)
    console.log('\n--- PARSED SUCCESS RESPONSE ---')
    console.log(parsedSuccess)

    if (!parsedSuccess.success) throw new Error('Response success flag should be true')
    if (parsedSuccess.awbNumber !== 'PAC123456') throw new Error('AWB number extraction failed')
    if (!parsedSuccess.labelUrl.startsWith('data:application/pdf;base64,')) throw new Error('Base64 label prefix conversion failed')

    console.log('\nResponse parsing validations: ALL PASSED!')
    console.log('\nAll tests completed successfully!')

  } catch (err) {
    console.error('\nTest Failed with error:', err.message)
    process.exit(1)
  }
  process.exit(0)
}

run()
