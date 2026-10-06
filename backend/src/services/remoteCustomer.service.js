import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

let remotePool = null

/**
 * Get or initialize the MySQL connection pool to the remote Hostinger database (u364134727_nwNLR).
 */
function getRemotePool() {
  if (!remotePool) {
    const isEnabled = process.env.REMOTE_DB_ENABLED !== 'false'
    if (!isEnabled) {
      return null
    }

    const host = process.env.REMOTE_DB_HOST || 'srv1874.hstgr.io'
    const port = parseInt(process.env.REMOTE_DB_PORT) || 3306
    const user = process.env.REMOTE_DB_USER || 'u364134727_wH76a'
    const password = process.env.REMOTE_DB_PASSWORD || 'OjM8oc93hH'
    const database = process.env.REMOTE_DB_NAME || 'u364134727_nwNLR'

    remotePool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 8000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    })
  }
  return remotePool
}

/**
 * Execute a query on the remote Hostinger database.
 */
export async function queryRemote(sql, params = []) {
  const pool = getRemotePool()
  if (!pool) return []
  try {
    const [rows] = await pool.query(sql, params)
    return rows
  } catch (err) {
    console.error('[Remote DB Customer Query Error]:', err.message)
    throw err
  }
}

/**
 * Insert or update a customer directly in the remote Hostinger database (tbl_customers).
 */
export async function syncCustomerToRemoteDb(customerData) {
  const pool = getRemotePool()
  if (!pool) return false

  try {
    const {
      id,
      name,
      email,
      phone = '',
      company = '',
      password,
      credit_limit,
      current_balance,
      status = 'active'
    } = customerData

    const cleanEmail = email.trim().toLowerCase()
    const cleanPhone = (phone || '').trim().slice(0, 20)
    const cleanName = (name || '').trim().slice(0, 100)
    const cleanCompany = (company || '').trim().slice(0, 150)
    const cleanStatus = status === 'inactive' ? 'inactive' : 'active'

    // Check if customer exists in remote DB
    const [existing] = await pool.query(
      'SELECT id FROM tbl_customers WHERE LOWER(TRIM(email)) = ? LIMIT 1',
      [cleanEmail]
    )

    if (existing && existing.length > 0) {
      const existingId = existing[0].id
      let updateFields = ['name = ?', 'phone = ?', 'company = ?', 'status = ?']
      let updateParams = [cleanName, cleanPhone, cleanCompany, cleanStatus]

      if (password) {
        updateFields.push('password = ?')
        updateParams.push(password)
      }
      if (credit_limit !== undefined) {
        updateFields.push('credit_limit = ?')
        updateParams.push(parseFloat(credit_limit) || 0)
      }
      if (current_balance !== undefined) {
        updateFields.push('current_balance = ?')
        updateParams.push(parseFloat(current_balance) || 0)
      }

      updateParams.push(existingId)
      await pool.query(
        `UPDATE tbl_customers SET ${updateFields.join(', ')} WHERE id = ?`,
        updateParams
      )

      // If an explicit ID was provided and differs, update it
      if (id && parseInt(id) > 0 && existingId !== parseInt(id)) {
        try {
          await pool.query('UPDATE tbl_customers SET id = ? WHERE id = ?', [parseInt(id), existingId])
          console.log(`[Remote DB] Customer ${cleanEmail} ID updated from ${existingId} to ${id}`)
          return parseInt(id)
        } catch (idErr) {
          console.warn(`[Remote DB] Could not reassign customer ID to ${id}:`, idErr.message)
        }
      }

      console.log(`[Remote DB] Customer ${cleanEmail} updated in remote Hostinger DB (id: ${existingId})`)
      return existingId
    } else {
      if (id && parseInt(id) > 0) {
        await pool.query(
          `INSERT INTO tbl_customers (id, name, email, phone, company, password, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), company = VALUES(company), status = VALUES(status)`,
          [parseInt(id), cleanName, cleanEmail, cleanPhone, cleanCompany, password, cleanStatus]
        )
        console.log(`[Remote DB] Customer ${cleanEmail} inserted into remote Hostinger DB with id ${id}`)
        return parseInt(id)
      } else {
        const [result] = await pool.query(
          `INSERT INTO tbl_customers (name, email, phone, company, password, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [cleanName, cleanEmail, cleanPhone, cleanCompany, password, cleanStatus]
        )
        console.log(`[Remote DB] Customer ${cleanEmail} inserted into remote Hostinger DB (insertId: ${result.insertId})`)
        return result.insertId
      }
    }
  } catch (err) {
    console.error('[Remote DB Customer Sync Error]:', err.message)
    return false
  }
}

/**
 * Delete a customer from the remote Hostinger database.
 */
export async function deleteCustomerFromRemoteDb(email, id = null) {
  const pool = getRemotePool()
  if (!pool || (!email && !id)) return false

  try {
    const cleanEmail = email ? email.trim().toLowerCase() : ''
    const numId = id ? parseInt(id) : null

    if (cleanEmail) {
      await pool.query('DELETE FROM tbl_customers WHERE LOWER(TRIM(email)) = ?', [cleanEmail])
      try {
        await pool.query('DELETE FROM customer_addresses WHERE LOWER(TRIM(customer_email)) = ?', [cleanEmail])
        await pool.query('DELETE FROM customer_documents WHERE LOWER(TRIM(customer_email)) = ?', [cleanEmail])
      } catch {}
    }
    if (numId && numId > 0) {
      await pool.query('DELETE FROM tbl_customers WHERE id = ?', [numId])
      try {
        await pool.query('DELETE FROM customer_addresses WHERE customer_id = ?', [numId])
        await pool.query('DELETE FROM customer_documents WHERE customer_id = ?', [numId])
      } catch {}
    }
    console.log(`[Remote DB] Customer ${cleanEmail || numId} deleted from remote Hostinger DB`)
    return true
  } catch (err) {
    console.error('[Remote DB Customer Delete Error]:', err.message)
    return false
  }
}

/**
 * Sync all customers from local database to remote Hostinger database.
 */
export async function syncAllCustomersToRemote(localCustomers) {
  if (!localCustomers || !localCustomers.length) return
  for (const c of localCustomers) {
    if (c.email && c.password) {
      await syncCustomerToRemoteDb({
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        password: c.password,
        status: c.status
      })
    }
  }
}
