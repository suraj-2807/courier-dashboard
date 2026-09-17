import { getConnection } from './src/config/db.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function run() {
  const conn = await getConnection()
  try {
    const sqlPath = path.resolve(__dirname, 'migrations/vendor_rates_versioning_schema.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')

    // Split statements by semicolon (ignoring comments and empty lines)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`Executing ${statements.length} SQL statements...`)

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      try {
        await conn.query(stmt)
        console.log(`[${i + 1}/${statements.length}] OK`)
      } catch (err) {
        // If index already exists or table exists, print warning but continue
        if (err.code === 'ER_DUP_KEYNAME') {
          console.log(`[${i + 1}/${statements.length}] Index already exists, continuing`)
        } else {
          console.error(`[${i + 1}/${statements.length}] Error:`, err.message)
        }
      }
    }

    console.log('Migration completed!')
  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    conn.release()
    process.exit(0)
  }
}

run()
