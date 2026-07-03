import { query } from './src/config/db.js'

async function test() {
  try {
    const config = await query('SELECT * FROM vendor_api_configs WHERE id = 2')
    console.log('FULL CONFIG:', JSON.stringify(config, null, 2))
  } catch (error) {
    console.log('ERROR:', error.message)
  }
  process.exit(0)
}

test()