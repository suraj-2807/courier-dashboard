/**
 * Comprehensive API Test Script
 * Tests all endpoints after Supabase → MySQL migration
 */

const BASE = 'http://localhost:5000/api'
let TOKEN = ''
let senderId = ''
let receiverId = ''
let bookingId = ''

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
    }
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  const data = await res.json()
  return { status: res.status, data }
}

function log(label, result) {
  const icon = result.data.success ? '✅' : '❌'
  console.log(`${icon} ${label} [${result.status}]`)
  if (!result.data.success) {
    console.log(`   Error: ${result.data.message}`)
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════')
  console.log('  Courier Admin API Tests (MySQL)')
  console.log('═══════════════════════════════════════════\n')

  // 1. Health Check
  const health = await request('GET', '/health')
  log('Health Check', health)

  // ── AUTH ──
  console.log('\n── Auth ──')

  const register = await request('POST', '/auth/register', {
    name: 'Test Admin',
    email: 'test@princeexp.com',
    password: 'test123',
    role: 'admin'
  })
  log('Register User', register)

  const login = await request('POST', '/auth/login', {
    email: 'test@princeexp.com',
    password: 'test123'
  })
  log('Login', login)
  TOKEN = login.data.token || ''

  const me = await request('GET', '/auth/me')
  log('Get Current User (me)', me)

  // ── SENDERS ──
  console.log('\n── Senders ──')

  const createSender = await request('POST', '/senders', {
    name: 'PrinceExp Office',
    phone: '9876543210',
    email: 'office@princeexp.com',
    address: '123 Main Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001'
  })
  log('Create Sender', createSender)
  senderId = createSender.data.sender?.id

  const getSenders = await request('GET', '/senders')
  log(`List Senders (${getSenders.data.senders?.length || 0} found)`, getSenders)

  const getSenderById = await request('GET', `/senders/${senderId}`)
  log('Get Sender By ID', getSenderById)

  const updateSender = await request('PUT', `/senders/${senderId}`, {
    phone: '9999999999'
  })
  log('Update Sender', updateSender)

  // ── RECEIVERS ──
  console.log('\n── Receivers ──')

  const createReceiver = await request('POST', '/receivers', {
    name: 'Test Customer',
    phone: '8765432109',
    email: 'customer@test.com',
    address: '456 Park Avenue',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001'
  })
  log('Create Receiver', createReceiver)
  receiverId = createReceiver.data.receiver?.id

  const getReceivers = await request('GET', '/receivers')
  log(`List Receivers (${getReceivers.data.receivers?.length || 0} found)`, getReceivers)

  const getReceiverById = await request('GET', `/receivers/${receiverId}`)
  log('Get Receiver By ID', getReceiverById)

  const updateReceiver = await request('PUT', `/receivers/${receiverId}`, {
    city: 'New Delhi'
  })
  log('Update Receiver', updateReceiver)

  // ── BOOKINGS ──
  console.log('\n── Bookings ──')

  const createBooking = await request('POST', '/bookings', {
    sender_id: senderId,
    receiver_id: receiverId,
    weight: 2.5,
    length: 30,
    breadth: 20,
    height: 15,
    payment_mode: 'prepaid',
    package_type: 'parcel',
    total_amount: 500,
    shipping_charge: 100,
    order_reference: 'TEST-001',
    remarks: 'Test booking after MySQL migration'
  })
  log('Create Booking', createBooking)
  bookingId = createBooking.data.booking?.id

  // Create a second booking with inline sender/receiver
  const createBooking2 = await request('POST', '/bookings', {
    sender_name: 'Inline Sender',
    sender_phone: '1234567890',
    sender_address: '789 Test Lane',
    sender_city: 'Pune',
    sender_pincode: '411001',
    sender_state: 'Maharashtra',
    receiver_name: 'Inline Receiver',
    receiver_phone: '0987654321',
    receiver_address: '321 Demo Road',
    receiver_city: 'Chennai',
    receiver_pincode: '600001',
    receiver_state: 'Tamil Nadu',
    weight: 1,
    length: 10,
    breadth: 10,
    height: 10,
    payment_mode: 'cod',
    package_type: 'parcel',
    total_amount: 250,
    shipping_charge: 50,
    order_reference: 'TEST-002',
    remarks: 'Inline sender/receiver test'
  })
  log('Create Booking (inline sender/receiver)', createBooking2)

  const getBookings = await request('GET', '/bookings?page=1&limit=10')
  log(`List Bookings (${getBookings.data.bookings?.length || 0} found, total: ${getBookings.data.pagination?.total})`, getBookings)

  if (bookingId) {
    const getBookingById = await request('GET', `/bookings/${bookingId}`)
    log('Get Booking By ID (with JOINs)', getBookingById)
    // Check that joined data exists
    const b = getBookingById.data.booking
    console.log(`   → Sender: ${b?.senders?.name || 'N/A'}, Receiver: ${b?.receivers?.name || 'N/A'}`)
    console.log(`   → Tracking Events: ${b?.tracking_events?.length || 0}`)

    const updateStatus = await request('PATCH', `/bookings/${bookingId}/status`, {
      status: 'in_transit',
      description: 'Package picked up',
      location: 'Mumbai Hub'
    })
    log('Update Booking Status', updateStatus)
  }

  // Test search
  const searchBookings = await request('GET', '/bookings?search=TEST')
  log(`Search Bookings (${searchBookings.data.bookings?.length || 0} results)`, searchBookings)

  // ── TRACKING ──
  console.log('\n── Tracking ──')

  if (createBooking.data.booking?.tracking_number) {
    const tracking = await request('GET', `/tracking/search?tracking_number=${createBooking.data.booking.tracking_number}`)
    log('Search Tracking', tracking)
    if (tracking.data.shipment) {
      console.log(`   → Tracking #: ${tracking.data.shipment.tracking_number}`)
      console.log(`   → Events: ${tracking.data.shipment.tracking_events?.length || 0}`)
    }
  }

  // ── DASHBOARD ──
  console.log('\n── Dashboard ──')

  const dashboard = await request('GET', '/dashboard/stats')
  log('Dashboard Stats', dashboard)
  if (dashboard.data.stats) {
    const s = dashboard.data.stats
    console.log(`   → Total Bookings: ${s.totalBookings}`)
    console.log(`   → Pending: ${s.pendingCount}, In Transit: ${s.inTransitCount}, Delivered: ${s.deliveredCount}`)
    console.log(`   → Revenue: ₹${s.totalRevenue}`)
    console.log(`   → Recent Bookings: ${s.recentBookings?.length || 0}`)
    console.log(`   → Status Breakdown: ${JSON.stringify(s.statusBreakdown)}`)
  }

  // ── API SETTINGS ──
  console.log('\n── API Settings ──')

  const createConfig = await request('POST', '/api-settings', {
    name: 'Test Vendor',
    vendor_code: 'test_vendor',
    auth_type: 'inline',
    shipment_api_url: 'https://api.example.com/shipment',
    environment: 'staging',
    available_services: [{ name: 'Standard', code: 'STD' }, { name: 'Express', code: 'EXP' }]
  })
  log('Create API Config', createConfig)
  const configId = createConfig.data.config?.id

  const getConfigs = await request('GET', '/api-settings')
  log(`List API Configs (${getConfigs.data.configs?.length || 0} found)`, getConfigs)

  if (configId) {
    const getConfig = await request('GET', `/api-settings/${configId}`)
    log('Get API Config By ID', getConfig)

    const updateConfig = await request('PUT', `/api-settings/${configId}`, {
      name: 'Test Vendor Updated',
      environment: 'production'
    })
    log('Update API Config', updateConfig)

    const toggleConfig = await request('PATCH', `/api-settings/${configId}/toggle`)
    log(`Toggle API Config (now: ${toggleConfig.data.config?.is_active ? 'active' : 'inactive'})`, toggleConfig)

    // Toggle back
    await request('PATCH', `/api-settings/${configId}/toggle`)

    const activeVendors = await request('GET', '/api-settings/active-vendors')
    log(`Active Vendors (${activeVendors.data.vendors?.length || 0} found)`, activeVendors)

    const internalFields = await request('GET', '/api-settings/internal-fields')
    log(`Internal Fields (${internalFields.data.fields?.length || 0} fields)`, internalFields)

    // Test push logs (should be empty)
    const pushLogs = await request('GET', `/api-settings/${configId}/push-logs`)
    log(`Push Logs (${pushLogs.data.logs?.length || 0} entries)`, pushLogs)

    // Cleanup: delete config
    const deleteConfig = await request('DELETE', `/api-settings/${configId}`)
    log('Delete API Config', deleteConfig)
  }

  // ── CLEANUP ──
  console.log('\n── Cleanup ──')

  const deleteReceiver = await request('DELETE', `/receivers/${receiverId}`)
  log('Delete Receiver', deleteReceiver)

  const deleteSender = await request('DELETE', `/senders/${senderId}`)
  log('Delete Sender', deleteSender)

  // ── SUMMARY ──
  console.log('\n═══════════════════════════════════════════')
  console.log('  All tests completed!')
  console.log('═══════════════════════════════════════════\n')

  process.exit(0)
}

runTests().catch(err => {
  console.error('Test error:', err.message)
  process.exit(1)
})
