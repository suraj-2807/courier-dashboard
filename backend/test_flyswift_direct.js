async function testLiveFlyswift() {
  try {
    const res = await fetch('https://purple-raccoon-753399.hostingersite.com/api/customer/active-vendors')
    const json = await res.json()
    console.log('Active Vendors from Live Server:', JSON.stringify(json, null, 2))
  } catch (err) {
    console.error('Error fetching live vendors:', err)
  }
}

testLiveFlyswift()
