import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'courier_admin',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Parse JSON columns automatically (works with both MySQL and MariaDB)
  // MySQL JSON_OBJECT → type 'JSON', MariaDB → type 245/253 (VAR_STRING)
  typeCast: function (field, next) {
    if (field.type === 'JSON') {
      const val = field.string()
      return val ? JSON.parse(val) : null
    }
    if (field.type === 'STRING' || field.type === 'VAR_STRING' || field.type === 'BLOB') {
      const val = field.string()
      if (val === null) return null
      if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
        try {
          return JSON.parse(val)
        } catch {
          return val
        }
      }
      return val
    }
    return next()
  }
})

/**
 * Execute a SELECT query with parameterized values.
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<Array>} Query result rows
 */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

/**
 * Execute an INSERT/UPDATE/DELETE query.
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<Object>} ResultSetHeader with insertId, affectedRows, etc.
 */
export async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params)
  return result
}

/**
 * Get a connection from the pool for transactions.
 * Remember to release it with connection.release()
 */
export async function getConnection() {
  return pool.getConnection()
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end()
  process.exit(0)
})

/**
 * Self-healing DB initialization.
 * Verifies that the shipments table has the vendor_code and product_code columns,
 * adding them dynamically if they are missing.
 */
export async function initializeDb() {
  console.log('--- RUNNING DB INITIALIZATION & MIGRATIONS ---')
  try {
    const shipmentsColumns = await query("SHOW COLUMNS FROM shipments")
    const columnNames = shipmentsColumns.map(col => col.Field || col.field)
    
    if (!columnNames.includes('vendor_code')) {
      console.log('Adding vendor_code column to shipments table...')
      await execute("ALTER TABLE shipments ADD COLUMN vendor_code VARCHAR(100) DEFAULT '' AFTER vendor_config_id")
      console.log('vendor_code column successfully added.')
    } else {
      console.log('vendor_code column already exists.')
    }
    
    if (!columnNames.includes('product_code')) {
      console.log('Adding product_code column to shipments table...')
      await execute("ALTER TABLE shipments ADD COLUMN product_code VARCHAR(100) DEFAULT '' AFTER service_code")
      console.log('product_code column successfully added.')
    } else {
      console.log('product_code column already exists.')
    }
    // ── Vendor API Configs: add available_vendor_codes & available_product_codes ──
    try {
      const vendorCols = await query("SHOW COLUMNS FROM vendor_api_configs")
      const vendorColNames = vendorCols.map(col => col.Field || col.field)

      if (!vendorColNames.includes('available_vendor_codes')) {
        console.log('Adding available_vendor_codes column to vendor_api_configs...')
        await execute("ALTER TABLE vendor_api_configs ADD COLUMN available_vendor_codes JSON DEFAULT NULL AFTER available_services")
        console.log('available_vendor_codes column successfully added.')
      } else {
        console.log('available_vendor_codes column already exists.')
      }

      if (!vendorColNames.includes('available_product_codes')) {
        console.log('Adding available_product_codes column to vendor_api_configs...')
        await execute("ALTER TABLE vendor_api_configs ADD COLUMN available_product_codes JSON DEFAULT NULL AFTER available_vendor_codes")
        console.log('available_product_codes column successfully added.')
      } else {
        console.log('available_product_codes column already exists.')
      }
    } catch (vendorMigErr) {
      console.error('Vendor API config migration failed:', vendorMigErr.message)
    }

    console.log('DB initialization successfully completed!')
  } catch (err) {
    console.error('DB Initialization/Migration Failed:', err)
  }
}

export default pool
