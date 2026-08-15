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
    // ── Shipments table column auto-migration ──
    const shipmentsCols = await query("SHOW COLUMNS FROM shipments")
    const shipColNames = shipmentsCols.map(col => (col.Field || col.field).toLowerCase())

    const requiredShipmentCols = [
      { name: 'vendor_code', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'product_code', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'no_of_pieces', type: "INT DEFAULT 1" },
      { name: 'content_description', type: "VARCHAR(500) DEFAULT ''" },
      { name: 'declared_value', type: "DECIMAL(12,2) DEFAULT 0" },
      { name: 'cod_amount', type: "DECIMAL(12,2) DEFAULT 0" },
      { name: 'sender_company', type: "VARCHAR(255) DEFAULT ''" },
      { name: 'sender_address_2', type: "VARCHAR(500) DEFAULT ''" },
      { name: 'sender_gstin_type', type: "VARCHAR(50) DEFAULT ''" },
      { name: 'sender_gstin_no', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'receiver_address_2', type: "VARCHAR(500) DEFAULT ''" },
      { name: 'receiver_gstin_type', type: "VARCHAR(50) DEFAULT ''" },
      { name: 'receiver_gstin_no', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'invoice_no', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'invoice_date', type: "VARCHAR(50) DEFAULT ''" },
      { name: 'invoice_currency', type: "VARCHAR(10) DEFAULT 'INR'" },
      { name: 'hs_code', type: "VARCHAR(50) DEFAULT ''" },
      { name: 'export_reason', type: "VARCHAR(255) DEFAULT ''" },
      { name: 'terms_of_trade', type: "VARCHAR(10) DEFAULT 'CIF'" },
      { name: 'invoice_type', type: "VARCHAR(50) DEFAULT 'INVOICE'" },
      { name: 'invoice_note', type: "TEXT DEFAULT NULL" },
      { name: 'invoice_items', type: "JSON DEFAULT NULL" },
      { name: 'invoice_pdf_path', type: "VARCHAR(500) DEFAULT ''" },
      { name: 'is_locked', type: "BOOLEAN DEFAULT FALSE" }
    ]

    for (const col of requiredShipmentCols) {
      if (!shipColNames.includes(col.name.toLowerCase())) {
        console.log(`Adding ${col.name} column to shipments table...`)
        try {
          await execute(`ALTER TABLE shipments ADD COLUMN ${col.name} ${col.type}`)
          console.log(`shipments.${col.name} column added.`)
        } catch (colErr) {
          console.error(`Failed to add shipments.${col.name}:`, colErr.message)
        }
      }
    }

    // ── Vendor API Configs table ──
    try {
      const vendorCols = await query("SHOW COLUMNS FROM vendor_api_configs")
      const vendorColNames = vendorCols.map(col => (col.Field || col.field).toLowerCase())

      if (!vendorColNames.includes('available_vendor_codes')) {
        await execute("ALTER TABLE vendor_api_configs ADD COLUMN available_vendor_codes JSON DEFAULT NULL AFTER available_services")
      }
      if (!vendorColNames.includes('available_product_codes')) {
        await execute("ALTER TABLE vendor_api_configs ADD COLUMN available_product_codes JSON DEFAULT NULL AFTER available_vendor_codes")
      }
      if (!vendorColNames.includes('required_fields')) {
        await execute("ALTER TABLE vendor_api_configs ADD COLUMN required_fields JSON DEFAULT NULL AFTER available_product_codes")
      }
      if (!vendorColNames.includes('product_code_restrictions')) {
        await execute("ALTER TABLE vendor_api_configs ADD COLUMN product_code_restrictions JSON DEFAULT NULL AFTER required_fields")
      }
    } catch (vendorMigErr) {
      console.error('Vendor API config migration failed:', vendorMigErr.message)
    }

    // ── Booking Requests table (customer → admin approval flow) ──
    try {
      await execute(`CREATE TABLE IF NOT EXISTS booking_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_awb VARCHAR(20) NOT NULL,
        customer_id INT DEFAULT NULL,
        customer_name VARCHAR(100) DEFAULT '',
        customer_email VARCHAR(150) DEFAULT '',
        customer_phone VARCHAR(20) DEFAULT '',
        customer_company VARCHAR(150) DEFAULT '',
        sender_name VARCHAR(100) DEFAULT '',
        sender_company VARCHAR(150) DEFAULT '',
        sender_email VARCHAR(150) DEFAULT '',
        sender_phone VARCHAR(20) DEFAULT '',
        sender_address VARCHAR(255) DEFAULT '',
        sender_address_2 VARCHAR(255) DEFAULT '',
        sender_city VARCHAR(100) DEFAULT '',
        sender_pincode VARCHAR(20) DEFAULT '',
        sender_state VARCHAR(100) DEFAULT '',
        sender_country VARCHAR(100) DEFAULT 'INDIA',
        sender_gstin_type VARCHAR(50) DEFAULT '',
        sender_gstin_no VARCHAR(50) DEFAULT '',
        receiver_name VARCHAR(100) DEFAULT '',
        receiver_email VARCHAR(150) DEFAULT '',
        receiver_phone VARCHAR(20) DEFAULT '',
        receiver_address VARCHAR(255) DEFAULT '',
        receiver_address_2 VARCHAR(255) DEFAULT '',
        receiver_city VARCHAR(100) DEFAULT '',
        receiver_pincode VARCHAR(20) DEFAULT '',
        receiver_state VARCHAR(100) DEFAULT '',
        receiver_country VARCHAR(100) DEFAULT '',
        receiver_gstin_type VARCHAR(50) DEFAULT '',
        receiver_gstin_no VARCHAR(50) DEFAULT '',
        package_type VARCHAR(50) DEFAULT 'parcel',
        weight DECIMAL(10,2) DEFAULT 0,
        \`length\` DECIMAL(10,2) DEFAULT 0,
        breadth DECIMAL(10,2) DEFAULT 0,
        height DECIMAL(10,2) DEFAULT 0,
        no_of_pieces INT DEFAULT 1,
        content_description TEXT,
        declared_value DECIMAL(10,2) DEFAULT 0,
        is_fragile TINYINT DEFAULT 0,
        remarks TEXT,
        status ENUM('pending','processing','confirmed','rejected') DEFAULT 'pending',
        admin_notes TEXT,
        shipment_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_request_awb (request_awb)
      )`)
      console.log('booking_requests table ready.')
    } catch (brErr) {
      if (brErr.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('booking_requests table already exists.')
      } else {
        console.error('booking_requests migration failed:', brErr.message)
      }
    }

    // ── Booking Requests column auto-migration ──
    try {
      const brCols = await query("SHOW COLUMNS FROM booking_requests")
      const brColNames = brCols.map(col => (col.Field || col.field).toLowerCase())

      const requiredBrCols = [
        { name: 'no_of_pieces', type: "INT DEFAULT 1" },
        { name: 'content_description', type: "TEXT DEFAULT NULL" },
        { name: 'declared_value', type: "DECIMAL(10,2) DEFAULT 0" },
        { name: 'is_fragile', type: "TINYINT DEFAULT 0" },
        { name: 'tracking_number', type: "VARCHAR(50) DEFAULT NULL" },
        { name: 'order_reference', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'payment_mode', type: "VARCHAR(50) DEFAULT 'prepaid'" },
        { name: 'shipping_charge', type: "DECIMAL(10,2) DEFAULT 0" },
        { name: 'invoice_type', type: "VARCHAR(50) DEFAULT 'INVOICE'" },
        { name: 'invoice_currency', type: "VARCHAR(10) DEFAULT 'INR'" },
        { name: 'hs_code', type: "VARCHAR(50) DEFAULT ''" },
        { name: 'export_reason', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'terms_of_trade', type: "VARCHAR(10) DEFAULT 'CIF'" },
        { name: 'invoice_note', type: "TEXT DEFAULT NULL" },
        { name: 'invoice_items', type: "JSON DEFAULT NULL" },
        { name: 'parcels', type: "JSON DEFAULT NULL" }
      ]

      for (const col of requiredBrCols) {
        if (!brColNames.includes(col.name.toLowerCase())) {
          console.log(`Adding ${col.name} column to booking_requests table...`)
          try {
            await execute(`ALTER TABLE booking_requests ADD COLUMN ${col.name} ${col.type}`)
            console.log(`booking_requests.${col.name} column added.`)
          } catch (colErr) {
            console.error(`Failed to add booking_requests.${col.name}:`, colErr.message)
          }
        }
      }
    } catch (brColErr) {
      console.error('booking_requests column migration failed:', brColErr.message)
    }

    // ── Request Updates table ──
    try {
      await execute(`CREATE TABLE IF NOT EXISTS request_updates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        update_type ENUM('status_change','shipment_created','tracking_update','admin_note','info') DEFAULT 'info',
        title VARCHAR(255) NOT NULL,
        description TEXT,
        metadata JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_request_id (request_id)
      )`)
    } catch (ruErr) {
      if (ruErr.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('request_updates migration failed:', ruErr.message)
      }
    }

    // ── Country Codes Table ──
    try {
      await execute(`CREATE TABLE IF NOT EXISTS country_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        country_name VARCHAR(255) NOT NULL,
        country_code VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY idx_country_name (country_name)
      )`)
      
      const countRes = await query('SELECT COUNT(*) as total FROM country_codes')
      if (countRes[0].total === 0) {
        const defaultSeeds = [
          ['UNITED STATES', 'US'], ['USA', 'US'], ['UNITED STATES OF AMERICA', 'US'],
          ['INDIA', 'IN'], ['IND', 'IN'],
          ['UNITED KINGDOM', 'GB'], ['UK', 'GB'], ['GREAT BRITAIN', 'GB'],
          ['CANADA', 'CA'], ['CAN', 'CA'],
          ['AUSTRALIA', 'AU'], ['AUS', 'AU'],
          ['UNITED ARAB EMIRATES', 'AE'], ['UAE', 'AE'], ['DUBAI', 'AE'],
          ['GERMANY', 'DE'], ['DEU', 'DE'],
          ['FRANCE', 'FR'], ['FRA', 'FR'],
          ['JAPAN', 'JP'], ['JPN', 'JP'],
          ['SINGAPORE', 'SG'], ['SGP', 'SG'],
          ['NEW ZEALAND', 'NZ'], ['NLD', 'NL'], ['NETHERLANDS', 'NL']
        ]
        for (const [name, code] of defaultSeeds) {
          await execute(
            'INSERT IGNORE INTO country_codes (country_name, country_code) VALUES (?, ?)',
            [name, code]
          )
        }
        console.log('country_codes seeded with default mappings.')
      }
    } catch (ccErr) {
      if (ccErr.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('country_codes migration failed:', ccErr.message)
      }
    }

    console.log('DB initialization successfully completed!')
  } catch (err) {
    console.error('DB Initialization/Migration Failed:', err)
  }
}

export default pool
