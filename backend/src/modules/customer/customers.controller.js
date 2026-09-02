import bcrypt from 'bcryptjs'
import { query, execute } from '../../config/db.js'
import { syncCustomerToWP, deleteCustomerFromWP } from '../../utils/wpSync.js'
import { syncCustomerToRemoteDb, deleteCustomerFromRemoteDb } from '../../services/remoteCustomer.service.js'

/**
 * GET /api/customers
 * List customers with pagination, search, status filters, and aggregated stats
 */
export const getCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = ''
    } = req.query

    const pageNum = parseInt(page) || 1
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 10))
    const offset = (pageNum - 1) * limitNum

    let whereConditions = []
    const params = []

    if (status && status !== 'all') {
      whereConditions.push('c.status = ?')
      params.push(status)
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      whereConditions.push(`(
        c.name LIKE ? OR 
        c.email LIKE ? OR 
        c.phone LIKE ? OR 
        c.company LIKE ? OR 
        c.city LIKE ? OR 
        c.gstin_no LIKE ?
      )`)
      params.push(term, term, term, term, term, term)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Total count query
    const countRows = await query(
      `SELECT COUNT(*) as total FROM tbl_customers c ${whereClause}`,
      params
    )
    const total = countRows[0]?.total || 0

    // Fetch customers with accurate matching
    const rows = await query(
      `SELECT 
        c.id, c.name, c.email, c.phone, c.company,
        c.address, c.city, c.state, c.pincode, c.country, c.gstin_no,
        c.credit_limit, c.current_balance, c.status, c.last_login,
        c.created_at, c.updated_at,
        (
          SELECT COUNT(*) 
          FROM shipments s 
          WHERE (
            (c.email IS NOT NULL AND c.email != '' AND LOWER(TRIM(s.sender_email)) = LOWER(TRIM(c.email))) OR
            (c.phone IS NOT NULL AND c.phone != '' AND TRIM(s.sender_phone) = TRIM(c.phone))
          )
          AND (s.is_trashed = 0 OR s.is_trashed IS NULL)
        ) as total_shipments,
        (
          SELECT COALESCE(SUM(s.total_amount), 0)
          FROM shipments s
          WHERE (
            (c.email IS NOT NULL AND c.email != '' AND LOWER(TRIM(s.sender_email)) = LOWER(TRIM(c.email))) OR
            (c.phone IS NOT NULL AND c.phone != '' AND TRIM(s.sender_phone) = TRIM(c.phone))
          )
          AND (s.is_trashed = 0 OR s.is_trashed IS NULL)
        ) as total_spent,
        (
          SELECT COUNT(*)
          FROM booking_requests br
          WHERE (
            br.customer_id = c.id OR 
            (c.email IS NOT NULL AND c.email != '' AND (LOWER(TRIM(br.customer_email)) = LOWER(TRIM(c.email)) OR LOWER(TRIM(br.sender_email)) = LOWER(TRIM(c.email)))) OR
            (c.phone IS NOT NULL AND c.phone != '' AND (TRIM(br.customer_phone) = TRIM(c.phone) OR TRIM(br.sender_phone) = TRIM(c.phone)))
          )
        ) as total_requests
       FROM tbl_customers c
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    )

    // Summary statistics
    const statsRows = await query(`
      SELECT 
        COUNT(*) as total_customers,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_customers,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_customers,
        COALESCE(SUM(current_balance), 0) as total_balance,
        COALESCE(SUM(credit_limit), 0) as total_credit_limit
      FROM tbl_customers
    `)
    const stats = statsRows[0] || {
      total_customers: 0,
      active_customers: 0,
      inactive_customers: 0,
      total_balance: 0,
      total_credit_limit: 0
    }

    return res.json({
      success: true,
      customers: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      },
      stats
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * GET /api/customers/:id
 * Get single customer details with their recent shipments and requests
 */
export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params
    const rows = await query('SELECT * FROM tbl_customers WHERE id = ?', [id])

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' })
    }

    const customer = rows[0]
    delete customer.password // Don't leak hashed password

    // Build precise conditions for matching customer shipments
    const matchConditions = []
    const matchParams = []

    if (customer.email && customer.email.trim()) {
      matchConditions.push('LOWER(TRIM(sender_email)) = ?')
      matchParams.push(customer.email.trim().toLowerCase())
    }
    if (customer.phone && customer.phone.trim()) {
      matchConditions.push('TRIM(sender_phone) = ?')
      matchParams.push(customer.phone.trim())
    }

    let shipments = []
    if (matchConditions.length > 0) {
      shipments = await query(
        `SELECT id, order_id, tracking_number, vendor_awb_number, status, total_amount, 
                receiver_name, receiver_city, receiver_country, created_at
         FROM shipments
         WHERE (${matchConditions.join(' OR ')})
           AND (is_trashed = 0 OR is_trashed IS NULL)
         ORDER BY created_at DESC
         LIMIT 20`,
        matchParams
      )
    }

    // Saved Addresses count
    let addressCount = 0
    const addrConditions = ['customer_id = ?']
    const addrParams = [customer.id]
    if (customer.email && customer.email.trim()) {
      addrConditions.push('LOWER(TRIM(customer_email)) = ?')
      addrParams.push(customer.email.trim().toLowerCase())
    }
    if (customer.phone && customer.phone.trim()) {
      addrConditions.push('TRIM(customer_phone) = ?')
      addrParams.push(customer.phone.trim())
    }

    const addrRows = await query(
      `SELECT COUNT(*) as cnt FROM customer_addresses 
       WHERE (${addrConditions.join(' OR ')})`,
      addrParams
    )
    addressCount = addrRows[0]?.cnt || 0

    return res.json({
      success: true,
      customer,
      recent_shipments: shipments,
      address_count: addressCount
    })
  } catch (error) {
    console.error('Error fetching customer detail:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * POST /api/customers
 * Create a new customer user (with bcrypt password for PHP portal login)
 */
export const createCustomer = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      company,
      password,
      address,
      city,
      state,
      pincode,
      country,
      gstin_no,
      credit_limit,
      current_balance,
      status
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' })
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Customer email is required' })
    }
    if (!password || password.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' })
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanPhone = (phone || '').trim()

    // Check if email is already registered
    const existing = await query('SELECT id FROM tbl_customers WHERE email = ?', [cleanEmail])
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'A customer with this email already exists' })
    }

    // Hash password with bcrypt (compatible with PHP password_verify)
    const hashedPassword = await bcrypt.hash(password.trim(), 10)

    const result = await execute(
      `INSERT INTO tbl_customers (
        name, email, phone, company, password,
        address, city, state, pincode, country, gstin_no,
        credit_limit, current_balance, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        cleanEmail,
        cleanPhone,
        (company || '').trim(),
        hashedPassword,
        (address || '').trim(),
        (city || '').trim(),
        (state || '').trim(),
        (pincode || '').trim(),
        (country || 'INDIA').trim(),
        (gstin_no || '').trim(),
        parseFloat(credit_limit) || 0.00,
        parseFloat(current_balance) || 0.00,
        status === 'inactive' ? 'inactive' : 'active'
      ]
    )

    const newId = result.insertId
    const createdRows = await query('SELECT * FROM tbl_customers WHERE id = ?', [newId])
    const created = createdRows[0]
    delete created.password

    // Sync directly to remote Hostinger DB (u364134727_nwNLR) & WP
    syncCustomerToRemoteDb({
      id: newId,
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      company: (company || '').trim(),
      password: hashedPassword,
      status: status === 'inactive' ? 'inactive' : 'active'
    }).catch((err) => console.error('[Remote DB Customer Sync Error]:', err.message))

    syncCustomerToWP({
      id: newId,
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      company: (company || '').trim(),
      password: hashedPassword,
      address: (address || '').trim(),
      city: (city || '').trim(),
      state: (state || '').trim(),
      pincode: (pincode || '').trim(),
      country: (country || 'INDIA').trim(),
      gstin_no: (gstin_no || '').trim(),
      credit_limit: parseFloat(credit_limit) || 0.00,
      current_balance: parseFloat(current_balance) || 0.00,
      status: status === 'inactive' ? 'inactive' : 'active'
    }).catch((err) => console.error('[WP Customer Sync Error]:', err.message))

    return res.status(201).json({
      success: true,
      message: 'Customer account created successfully',
      customer: created
    })
  } catch (error) {
    console.error('Error creating customer:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * PUT /api/customers/:id
 * Update customer details and optionally reset password
 */
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      email,
      phone,
      company,
      password,
      address,
      city,
      state,
      pincode,
      country,
      gstin_no,
      credit_limit,
      current_balance,
      status
    } = req.body

    const existing = await query('SELECT * FROM tbl_customers WHERE id = ?', [id])
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' })
    }

    const cleanEmail = email ? email.trim().toLowerCase() : existing[0].email

    // If changing email, check uniqueness
    if (cleanEmail !== existing[0].email) {
      const dup = await query('SELECT id FROM tbl_customers WHERE email = ? AND id != ?', [cleanEmail, id])
      if (dup.length > 0) {
        return res.status(400).json({ success: false, message: 'Another customer with this email already exists' })
      }
    }

    let queryParts = [
      'name = ?',
      'email = ?',
      'phone = ?',
      'company = ?',
      'address = ?',
      'city = ?',
      'state = ?',
      'pincode = ?',
      'country = ?',
      'gstin_no = ?',
      'credit_limit = ?',
      'current_balance = ?',
      'status = ?'
    ]

    const params = [
      name ? name.trim() : existing[0].name,
      cleanEmail,
      phone !== undefined ? phone.trim() : existing[0].phone,
      company !== undefined ? company.trim() : existing[0].company,
      address !== undefined ? address.trim() : existing[0].address,
      city !== undefined ? city.trim() : existing[0].city,
      state !== undefined ? state.trim() : existing[0].state,
      pincode !== undefined ? pincode.trim() : existing[0].pincode,
      country !== undefined ? country.trim() : existing[0].country,
      gstin_no !== undefined ? gstin_no.trim() : existing[0].gstin_no,
      credit_limit !== undefined ? (parseFloat(credit_limit) || 0) : existing[0].credit_limit,
      current_balance !== undefined ? (parseFloat(current_balance) || 0) : existing[0].current_balance,
      status || existing[0].status
    ]

    // If new password provided, hash it
    let hashedPassword = null
    if (password && password.trim().length >= 6) {
      hashedPassword = await bcrypt.hash(password.trim(), 10)
      queryParts.push('password = ?')
      params.push(hashedPassword)
    }

    params.push(id)

    await execute(
      `UPDATE tbl_customers SET ${queryParts.join(', ')} WHERE id = ?`,
      params
    )

    const updatedRows = await query('SELECT * FROM tbl_customers WHERE id = ?', [id])
    const updated = updatedRows[0]
    delete updated.password

    // Sync to remote Hostinger DB & WP
    syncCustomerToRemoteDb({
      name: name ? name.trim() : existing[0].name,
      email: cleanEmail,
      phone: phone !== undefined ? phone.trim() : existing[0].phone,
      company: company !== undefined ? company.trim() : existing[0].company,
      password: hashedPassword || undefined,
      status: status || existing[0].status
    }).catch((err) => console.error('[Remote DB Customer Sync Error]:', err.message))

    syncCustomerToWP({
      id,
      name: name ? name.trim() : existing[0].name,
      email: cleanEmail,
      phone: phone !== undefined ? phone.trim() : existing[0].phone,
      company: company !== undefined ? company.trim() : existing[0].company,
      address: address !== undefined ? address.trim() : existing[0].address,
      city: city !== undefined ? city.trim() : existing[0].city,
      state: state !== undefined ? state.trim() : existing[0].state,
      pincode: pincode !== undefined ? pincode.trim() : existing[0].pincode,
      country: country !== undefined ? country.trim() : existing[0].country,
      gstin_no: gstin_no !== undefined ? gstin_no.trim() : existing[0].gstin_no,
      credit_limit: credit_limit !== undefined ? (parseFloat(credit_limit) || 0) : existing[0].credit_limit,
      current_balance: current_balance !== undefined ? (parseFloat(current_balance) || 0) : existing[0].current_balance,
      status: status || existing[0].status,
      ...(hashedPassword ? { password: hashedPassword } : {})
    }).catch((err) => console.error('[WP Customer Update Sync Error]:', err.message))

    return res.json({
      success: true,
      message: 'Customer updated successfully',
      customer: updated
    })
  } catch (error) {
    console.error('Error updating customer:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * PATCH /api/customers/:id/status
 * Toggle customer active/inactive status
 */
export const toggleCustomerStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const existing = await query('SELECT status, email, name, phone, company FROM tbl_customers WHERE id = ?', [id])
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' })
    }

    const nextStatus = status || (existing[0].status === 'active' ? 'inactive' : 'active')
    await execute('UPDATE tbl_customers SET status = ? WHERE id = ?', [nextStatus, id])

    syncCustomerToRemoteDb({
      email: existing[0].email,
      name: existing[0].name,
      phone: existing[0].phone,
      company: existing[0].company,
      status: nextStatus
    }).catch((err) => console.error('[Remote DB Customer Status Sync Error]:', err.message))

    syncCustomerToWP({
      id,
      email: existing[0].email,
      status: nextStatus
    }).catch((err) => console.error('[WP Customer Status Sync Error]:', err.message))

    return res.json({
      success: true,
      message: `Customer status updated to ${nextStatus}`,
      status: nextStatus
    })
  } catch (error) {
    console.error('Error toggling customer status:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * DELETE /api/customers/:id
 * Delete a customer account
 */
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params
    const existing = await query('SELECT id, name, email FROM tbl_customers WHERE id = ?', [id])
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' })
    }

    await execute('DELETE FROM tbl_customers WHERE id = ?', [id])

    deleteCustomerFromRemoteDb(existing[0].email).catch((err) =>
      console.error('[Remote DB Customer Delete Error]:', err.message)
    )

    deleteCustomerFromWP(id, existing[0].email).catch((err) =>
      console.error('[WP Customer Delete Sync Error]:', err.message)
    )

    return res.json({
      success: true,
      message: `Customer ${existing[0].name} deleted successfully`
    })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}
