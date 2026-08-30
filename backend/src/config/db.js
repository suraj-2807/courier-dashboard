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
 * Execute a query with standard text protocol (supports DDL like SHOW, ALTER, CREATE, information_schema).
 */
export async function rawQuery(sql, params = []) {
  if (params && params.length > 0) {
    const [rows] = await pool.query(sql, params)
    return rows
  }
  const [rows] = await pool.query(sql)
  return rows
}

/**
 * Execute a SELECT query with parameterized values.
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<Array>} Query result rows
 */
export async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params)
    return rows
  } catch (err) {
    // If prepared statement protocol is unsupported (e.g. SHOW, ALTER, certain JSON functions), fallback to pool.query
    if (err.code === 'ER_UNSUPPORTED_PS' || err.code === 'ER_NOT_SUPPORTED_YET') {
      const [rows] = params && params.length > 0 ? await pool.query(sql, params) : await pool.query(sql)
      return rows
    }
    throw err
  }
}

/**
 * Execute an INSERT/UPDATE/DELETE/ALTER query.
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<Object>} ResultSetHeader with insertId, affectedRows, etc.
 */
export async function execute(sql, params = []) {
  try {
    const [result] = await pool.execute(sql, params)
    return result
  } catch (err) {
    if (err.code === 'ER_UNSUPPORTED_PS' || err.code === 'ER_NOT_SUPPORTED_YET') {
      const [result] = params && params.length > 0 ? await pool.query(sql, params) : await pool.query(sql)
      return result
    }
    throw err
  }
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
      { name: 'sender_name', type: "VARCHAR(255) DEFAULT ''" },
      { name: 'sender_company', type: "VARCHAR(255) DEFAULT ''" },
      { name: 'sender_phone', type: "VARCHAR(50) DEFAULT ''" },
      { name: 'sender_phone_2', type: "VARCHAR(50) DEFAULT ''" },
      { name: 'sender_email', type: "VARCHAR(255) DEFAULT ''" },
      { name: 'sender_address', type: "TEXT DEFAULT NULL" },
      { name: 'sender_address_2', type: "VARCHAR(500) DEFAULT ''" },
      { name: 'sender_city', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'sender_state', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'sender_pincode', type: "VARCHAR(20) DEFAULT ''" },
      { name: 'sender_country', type: "VARCHAR(100) DEFAULT 'INDIA'" },
      { name: 'sender_gstin_type', type: "VARCHAR(50) DEFAULT ''" },
      { name: 'sender_gstin_no', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'receiver_name', type: "VARCHAR(255) DEFAULT ''" },
      { name: 'receiver_company', type: "VARCHAR(255) DEFAULT ''" },
      { name: 'receiver_phone', type: "VARCHAR(50) DEFAULT ''" },
      { name: 'receiver_phone_2', type: "VARCHAR(50) DEFAULT ''" },
      { name: 'receiver_email', type: "VARCHAR(255) DEFAULT ''" },
      { name: 'receiver_address', type: "TEXT DEFAULT NULL" },
      { name: 'receiver_address_2', type: "VARCHAR(500) DEFAULT ''" },
      { name: 'receiver_city', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'receiver_state', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'receiver_pincode', type: "VARCHAR(20) DEFAULT ''" },
      { name: 'receiver_country', type: "VARCHAR(100) DEFAULT ''" },
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
      { name: 'parcels', type: "JSON DEFAULT NULL" },
      { name: 'chargeable_weight', type: "DECIMAL(10,2) DEFAULT 0" },
      { name: 'rate_per_kg', type: "DECIMAL(10,2) DEFAULT 0" },
      { name: 'extra_charge', type: "DECIMAL(10,2) DEFAULT 0" },
      { name: 'final_chargeable_weight', type: "DECIMAL(10,2) DEFAULT 0" },
      { name: 'invoice_pdf_path', type: "VARCHAR(500) DEFAULT ''" },
      { name: 'vendor_awb_number_2', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'forwarding_no', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'secondary_carrier', type: "VARCHAR(100) DEFAULT ''" },
      { name: 'order_reference', type: "VARCHAR(255) DEFAULT ''" },
      { name: 'is_locked', type: "BOOLEAN DEFAULT FALSE" },
      { name: 'is_trashed', type: "TINYINT(1) DEFAULT 0" },
      { name: 'trashed_at', type: "DATETIME DEFAULT NULL" }
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

    // ── Senders table column auto-migration ──
    try {
      const senderCols = await query("SHOW COLUMNS FROM senders")
      const senderColNames = senderCols.map(col => (col.Field || col.field).toLowerCase())
      const requiredSenderCols = [
        { name: 'company', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'phone_2', type: "VARCHAR(50) DEFAULT ''" },
        { name: 'email', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'address', type: "TEXT DEFAULT NULL" },
        { name: 'address_2', type: "VARCHAR(500) DEFAULT ''" },
        { name: 'city', type: "VARCHAR(100) DEFAULT ''" },
        { name: 'state', type: "VARCHAR(100) DEFAULT ''" },
        { name: 'pincode', type: "VARCHAR(20) DEFAULT ''" },
        { name: 'country', type: "VARCHAR(100) DEFAULT 'INDIA'" },
        { name: 'gstin_type', type: "VARCHAR(50) DEFAULT ''" },
        { name: 'gstin_no', type: "VARCHAR(100) DEFAULT ''" }
      ]
      for (const col of requiredSenderCols) {
        if (!senderColNames.includes(col.name.toLowerCase())) {
          try {
            await execute(`ALTER TABLE senders ADD COLUMN ${col.name} ${col.type}`)
          } catch (e) {}
        }
      }
    } catch (sndMigErr) {
      console.warn('Senders table column migration warning:', sndMigErr.message)
    }

    // ── Receivers table column auto-migration ──
    try {
      const receiverCols = await query("SHOW COLUMNS FROM receivers")
      const receiverColNames = receiverCols.map(col => (col.Field || col.field).toLowerCase())
      const requiredReceiverCols = [
        { name: 'company', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'phone_2', type: "VARCHAR(50) DEFAULT ''" },
        { name: 'email', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'address', type: "TEXT DEFAULT NULL" },
        { name: 'address_2', type: "VARCHAR(500) DEFAULT ''" },
        { name: 'city', type: "VARCHAR(100) DEFAULT ''" },
        { name: 'state', type: "VARCHAR(100) DEFAULT ''" },
        { name: 'pincode', type: "VARCHAR(20) DEFAULT ''" },
        { name: 'country', type: "VARCHAR(100) DEFAULT ''" },
        { name: 'gstin_type', type: "VARCHAR(50) DEFAULT ''" },
        { name: 'gstin_no', type: "VARCHAR(100) DEFAULT ''" }
      ]
      for (const col of requiredReceiverCols) {
        if (!receiverColNames.includes(col.name.toLowerCase())) {
          try {
            await execute(`ALTER TABLE receivers ADD COLUMN ${col.name} ${col.type}`)
          } catch (e) {}
        }
      }
    } catch (rcvMigErr) {
      console.warn('Receivers table column migration warning:', rcvMigErr.message)
    }

    // ── Auto-backfill sender/receiver snapshots for existing shipments ──
    try {
      await execute(`
        UPDATE shipments s
        JOIN senders snd ON s.sender_id = snd.id
        SET s.sender_name = IF(s.sender_name = '' OR s.sender_name IS NULL, snd.name, s.sender_name),
            s.sender_company = IF(s.sender_company = '' OR s.sender_company IS NULL, snd.company, s.sender_company),
            s.sender_phone = IF(s.sender_phone = '' OR s.sender_phone IS NULL, snd.phone, s.sender_phone),
            s.sender_email = IF(s.sender_email = '' OR s.sender_email IS NULL, snd.email, s.sender_email),
            s.sender_address = IF(s.sender_address = '' OR s.sender_address IS NULL, snd.address, s.sender_address),
            s.sender_address_2 = IF(s.sender_address_2 = '' OR s.sender_address_2 IS NULL, snd.address_2, s.sender_address_2),
            s.sender_city = IF(s.sender_city = '' OR s.sender_city IS NULL, snd.city, s.sender_city),
            s.sender_state = IF(s.sender_state = '' OR s.sender_state IS NULL, snd.state, s.sender_state),
            s.sender_pincode = IF(s.sender_pincode = '' OR s.sender_pincode IS NULL, snd.pincode, s.sender_pincode),
            s.sender_country = IF(s.sender_country = '' OR s.sender_country IS NULL, snd.country, s.sender_country),
            s.sender_gstin_type = IF(s.sender_gstin_type = '' OR s.sender_gstin_type IS NULL, snd.gstin_type, s.sender_gstin_type),
            s.sender_gstin_no = IF(s.sender_gstin_no = '' OR s.sender_gstin_no IS NULL, snd.gstin_no, s.sender_gstin_no)
      `)
      await execute(`
        UPDATE shipments s
        JOIN receivers rcv ON s.receiver_id = rcv.id
        SET s.receiver_name = IF(s.receiver_name = '' OR s.receiver_name IS NULL, rcv.name, s.receiver_name),
            s.receiver_company = IF(s.receiver_company = '' OR s.receiver_company IS NULL, rcv.company, s.receiver_company),
            s.receiver_phone = IF(s.receiver_phone = '' OR s.receiver_phone IS NULL, rcv.phone, s.receiver_phone),
            s.receiver_email = IF(s.receiver_email = '' OR s.receiver_email IS NULL, rcv.email, s.receiver_email),
            s.receiver_address = IF(s.receiver_address = '' OR s.receiver_address IS NULL, rcv.address, s.receiver_address),
            s.receiver_address_2 = IF(s.receiver_address_2 = '' OR s.receiver_address_2 IS NULL, rcv.address_2, s.receiver_address_2),
            s.receiver_city = IF(s.receiver_city = '' OR s.receiver_city IS NULL, rcv.city, s.receiver_city),
            s.receiver_state = IF(s.receiver_state = '' OR s.receiver_state IS NULL, rcv.state, s.receiver_state),
            s.receiver_pincode = IF(s.receiver_pincode = '' OR s.receiver_pincode IS NULL, rcv.pincode, s.receiver_pincode),
            s.receiver_country = IF(s.receiver_country = '' OR s.receiver_country IS NULL, rcv.country, s.receiver_country),
            s.receiver_gstin_type = IF(s.receiver_gstin_type = '' OR s.receiver_gstin_type IS NULL, rcv.gstin_type, s.receiver_gstin_type),
            s.receiver_gstin_no = IF(s.receiver_gstin_no = '' OR s.receiver_gstin_no IS NULL, rcv.gstin_no, s.receiver_gstin_no)
      `)
    } catch (backfillErr) {
      console.error('Shipment sender/receiver snapshot backfill warning:', backfillErr.message)
    }

    // ── Vendor API Configs table ──
    try {
      const vendorCols = await query("SHOW COLUMNS FROM vendor_api_configs")
      const vendorColNames = vendorCols.map(col => (col.Field || col.field).toLowerCase())

      if (!vendorColNames.includes('tracking_api_url')) {
        await execute("ALTER TABLE vendor_api_configs ADD COLUMN tracking_api_url VARCHAR(500) DEFAULT '' AFTER shipment_api_url")
      }
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
        { name: 'parcels', type: "JSON DEFAULT NULL" },
        { name: 'documents', type: "JSON DEFAULT NULL" },
        { name: 'sender_phone_2', type: "VARCHAR(50) DEFAULT ''" },
        { name: 'receiver_phone_2', type: "VARCHAR(50) DEFAULT ''" }
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

    // ── Auto-cleanup fake forwarding numbers that duplicate vendor AWB ──
    try {
      await execute(`
        UPDATE shipments 
        SET vendor_awb_number_2 = '', forwarding_no = '' 
        WHERE (vendor_awb_number_2 != '' AND (vendor_awb_number_2 = vendor_awb_number OR vendor_awb_number_2 = tracking_number))
           OR (forwarding_no != '' AND (forwarding_no = vendor_awb_number OR forwarding_no = tracking_number))
      `)
      console.log('Shipments forwarding number cleanup completed.')
    } catch (cleanFwdErr) {
      console.error('Forwarding number cleanup warning:', cleanFwdErr.message)
    }

    // ── Customer Addresses Table ──
    try {
      await execute(`CREATE TABLE IF NOT EXISTS customer_addresses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT DEFAULT NULL,
        customer_email VARCHAR(150) DEFAULT '',
        customer_phone VARCHAR(50) DEFAULT '',
        address_type ENUM('sender', 'receiver', 'both') DEFAULT 'both',
        name VARCHAR(100) NOT NULL,
        company VARCHAR(150) DEFAULT '',
        phone VARCHAR(50) NOT NULL,
        phone_2 VARCHAR(50) DEFAULT '',
        email VARCHAR(150) DEFAULT '',
        address TEXT NOT NULL,
        address_2 VARCHAR(255) DEFAULT '',
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) DEFAULT '',
        pincode VARCHAR(20) DEFAULT '',
        country VARCHAR(100) DEFAULT 'INDIA',
        gstin_type VARCHAR(50) DEFAULT '',
        gstin_no VARCHAR(50) DEFAULT '',
        is_default TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cust_id (customer_id),
        INDEX idx_cust_email (customer_email),
        INDEX idx_cust_phone (customer_phone),
        INDEX idx_addr_type (address_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
      console.log('customer_addresses table ready.')
    } catch (caErr) {
      if (caErr.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('customer_addresses table migration failed:', caErr.message)
      }
    }

    // ── Customer Documents Table ──
    try {
      await execute(`CREATE TABLE IF NOT EXISTS customer_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT DEFAULT NULL,
        customer_email VARCHAR(150) DEFAULT '',
        customer_phone VARCHAR(50) DEFAULT '',
        doc_type VARCHAR(100) NOT NULL,
        doc_name VARCHAR(255) DEFAULT '',
        doc_number VARCHAR(100) DEFAULT '',
        file_url VARCHAR(500) NOT NULL,
        file_name VARCHAR(255) DEFAULT '',
        file_size INT DEFAULT 0,
        file_type VARCHAR(50) DEFAULT '',
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_doc_cust_id (customer_id),
        INDEX idx_doc_cust_email (customer_email),
        INDEX idx_doc_cust_phone (customer_phone),
        INDEX idx_doc_type (doc_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
      console.log('customer_documents table ready.')
    } catch (cdErr) {
      if (cdErr.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('customer_documents table migration failed:', cdErr.message)
      }
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

    // ── System Settings Table ──
    try {
      await execute(`CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT,
        description VARCHAR(255) DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`)

      const defaultSettings = [
        [
          'allow_post_push_billing_edit',
          'true',
          'Allow editing Final Chargeable Weight, Rate/Kg, Shipping Charge, Extra Charge, and Final Shipping on locked/pushed shipments'
        ]
      ]
      for (const [key, val, desc] of defaultSettings) {
        await execute(
          'INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
          [key, val, desc]
        )
      }
      console.log('system_settings table ready and seeded.')
    } catch (sysErr) {
      if (sysErr.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('system_settings migration failed:', sysErr.message)
      }
    }

    // ── Senders table column auto-migration ──
    try {
      const senderCols = await query("SHOW COLUMNS FROM senders")
      const senderColNames = senderCols.map(col => (col.Field || col.field).toLowerCase())
      const requiredSenderCols = [
        { name: 'company', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'phone_2', type: "VARCHAR(50) DEFAULT ''" },
        { name: 'address_2', type: "TEXT DEFAULT NULL" },
        { name: 'country', type: "VARCHAR(50) DEFAULT 'INDIA'" },
        { name: 'gstin_type', type: "VARCHAR(50) DEFAULT ''" },
        { name: 'gstin_no', type: "VARCHAR(50) DEFAULT ''" }
      ]
      for (const col of requiredSenderCols) {
        if (!senderColNames.includes(col.name.toLowerCase())) {
          await execute(`ALTER TABLE senders ADD COLUMN ${col.name} ${col.type}`)
          console.log(`senders.${col.name} column added.`)
        }
      }
    } catch (sErr) {
      console.error('senders column migration failed:', sErr.message)
    }

    // ── Receivers table column auto-migration ──
    try {
      const receiverCols = await query("SHOW COLUMNS FROM receivers")
      const receiverColNames = receiverCols.map(col => (col.Field || col.field).toLowerCase())
      const requiredReceiverCols = [
        { name: 'company', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'phone_2', type: "VARCHAR(50) DEFAULT ''" },
        { name: 'address_2', type: "TEXT DEFAULT NULL" },
        { name: 'country', type: "VARCHAR(50) DEFAULT ''" },
        { name: 'gstin_type', type: "VARCHAR(50) DEFAULT ''" },
        { name: 'gstin_no', type: "VARCHAR(50) DEFAULT ''" }
      ]
      for (const col of requiredReceiverCols) {
        if (!receiverColNames.includes(col.name.toLowerCase())) {
          await execute(`ALTER TABLE receivers ADD COLUMN ${col.name} ${col.type}`)
          console.log(`receivers.${col.name} column added.`)
        }
      }
    } catch (rErr) {
      console.error('receivers column migration failed:', rErr.message)
    }

    // ── Auto-cleanup duplicates in senders and receivers ──
    try {
      // Remove duplicate senders keeping only the highest ID for each name
      await execute(`
        DELETE s1 FROM senders s1
        INNER JOIN senders s2
        WHERE s1.id < s2.id AND LOWER(TRIM(s1.name)) = LOWER(TRIM(s2.name))
      `)
      // Remove duplicate receivers keeping only the highest ID for each name
      await execute(`
        DELETE r1 FROM receivers r1
        INNER JOIN receivers r2
        WHERE r1.id < r2.id AND LOWER(TRIM(r1.name)) = LOWER(TRIM(r2.name))
      `)
      console.log('senders & receivers deduplication cleanup completed.')
    } catch (dedupErr) {
      console.error('deduplication cleanup warning:', dedupErr.message)
    }

    // ── Products & HSN Codes Table ──
    try {
      await execute(`CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        hs_code VARCHAR(50) NOT NULL,
        country VARCHAR(50) DEFAULT '',
        description TEXT DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_product_name (name),
        INDEX idx_hs_code (hs_code),
        INDEX idx_country (country)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
      console.log('products table ready.')
    } catch (prodErr) {
      if (prodErr.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('products table migration failed:', prodErr.message)
      }
    }

    console.log('DB initialization successfully completed!')
  } catch (err) {
    console.error('DB Initialization/Migration Failed:', err)
  }
}

export default pool
