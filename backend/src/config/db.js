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

export default pool
