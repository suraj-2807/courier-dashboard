import { query, execute } from '../config/db.js'

export const DEFAULT_MASTER_ACCOUNTS = [
  // ASSETS (1000)
  { account_code: '1111', account_name: 'Counter Cash Register (Drawer)', account_type: 'asset', group_category: 'Cash in Hand', linked_entity_type: 'cash' },
  { account_code: '1112', account_name: 'Delivery Cash (COD In-Transit)', account_type: 'asset', group_category: 'Cash in Hand', linked_entity_type: 'cash' },
  { account_code: '1121', account_name: 'Operating Bank Account (Current A/c)', account_type: 'asset', group_category: 'Bank & Digital Accounts', linked_entity_type: 'bank' },
  { account_code: '1122', account_name: 'UPI & Payment Gateway Clearing', account_type: 'asset', group_category: 'Bank & Digital Accounts', linked_entity_type: 'bank' },
  { account_code: '1130', account_name: 'Accounts Receivable (Customer Debtors)', account_type: 'asset', group_category: 'Accounts Receivable', linked_entity_type: 'customer' },
  { account_code: '1139', account_name: 'Retail / Walk-in Cash Customers', account_type: 'asset', group_category: 'Accounts Receivable', linked_entity_type: 'customer' },
  { account_code: '1141', account_name: 'Carrier & Vendor Prepaid Advances', account_type: 'asset', group_category: 'Advances & Deposits', linked_entity_type: 'vendor' },

  // LIABILITIES (2000)
  { account_code: '2110', account_name: 'Accounts Payable (Carrier & Vendors)', account_type: 'liability', group_category: 'Accounts Payable', linked_entity_type: 'vendor' },
  { account_code: '2119', account_name: 'Co-Loader & Linehaul Payables', account_type: 'liability', group_category: 'Accounts Payable', linked_entity_type: 'vendor' },
  { account_code: '2121', account_name: 'Output CGST Payable (9%)', account_type: 'liability', group_category: 'Duties & Taxes', linked_entity_type: 'tax' },
  { account_code: '2122', account_name: 'Output SGST Payable (9%)', account_type: 'liability', group_category: 'Duties & Taxes', linked_entity_type: 'tax' },
  { account_code: '2123', account_name: 'Output IGST Payable (18%)', account_type: 'liability', group_category: 'Duties & Taxes', linked_entity_type: 'tax' },
  { account_code: '2130', account_name: 'Customer Advance & Deposit Wallets', account_type: 'liability', group_category: 'Customer Advances', linked_entity_type: 'customer' },

  // EQUITY (3000)
  { account_code: '3100', account_name: 'Owner Capital Account', account_type: 'equity', group_category: 'Capital', linked_entity_type: 'none' },
  { account_code: '3200', account_name: 'Retained Earnings', account_type: 'equity', group_category: 'Reserves & Surplus', linked_entity_type: 'none' },

  // REVENUE (4000)
  { account_code: '4110', account_name: 'Domestic Courier Freight Revenue', account_type: 'revenue', group_category: 'Direct Courier Revenue', linked_entity_type: 'none' },
  { account_code: '4120', account_name: 'International Courier Freight Revenue', account_type: 'revenue', group_category: 'Direct Courier Revenue', linked_entity_type: 'none' },
  { account_code: '4130', account_name: 'Packing, Box & Handling Fees', account_type: 'revenue', group_category: 'Direct Courier Revenue', linked_entity_type: 'none' },
  { account_code: '4140', account_name: 'Remote Area & Extended Delivery Surcharge', account_type: 'revenue', group_category: 'Direct Courier Revenue', linked_entity_type: 'none' },
  { account_code: '4150', account_name: 'Fuel & Security Surcharges', account_type: 'revenue', group_category: 'Direct Courier Revenue', linked_entity_type: 'none' },
  { account_code: '4200', account_name: 'Other Operating Income', account_type: 'revenue', group_category: 'Other Income', linked_entity_type: 'none' },

  // EXPENSES (5000)
  { account_code: '5110', account_name: 'Carrier Linehaul Freight Expense', account_type: 'expense', group_category: 'Direct Operating Costs', linked_entity_type: 'vendor' },
  { account_code: '5120', account_name: 'Air Freight & Customs Linehaul', account_type: 'expense', group_category: 'Direct Operating Costs', linked_entity_type: 'none' },
  { account_code: '5130', account_name: 'Packaging Materials & Cartons', account_type: 'expense', group_category: 'Direct Operating Costs', linked_entity_type: 'none' },
  { account_code: '5210', account_name: 'Office Rent, Hub & Electricity', account_type: 'expense', group_category: 'Administrative Expenses', linked_entity_type: 'none' },
  { account_code: '5220', account_name: 'Staff Salaries & Delivery Commissions', account_type: 'expense', group_category: 'Administrative Expenses', linked_entity_type: 'none' },
  { account_code: '5230', account_name: 'Printing, Barcode Rolls & Stationery', account_type: 'expense', group_category: 'Administrative Expenses', linked_entity_type: 'none' },
  { account_code: '5240', account_name: 'Payment Gateway & Bank Processing Fees', account_type: 'expense', group_category: 'Administrative Expenses', linked_entity_type: 'none' },
  { account_code: '5250', account_name: 'Cash Shortage & Tally Discrepancy', account_type: 'expense', group_category: 'Administrative Expenses', linked_entity_type: 'none' }
]

/**
 * Ensures accounting tables exist and default chart of accounts is seeded.
 */
export async function ensureAccountingTables() {
  try {
    // 1. accounting_master_accounts
    await execute(`CREATE TABLE IF NOT EXISTS accounting_master_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      account_code VARCHAR(20) NOT NULL UNIQUE,
      account_name VARCHAR(150) NOT NULL,
      account_type ENUM('asset', 'liability', 'equity', 'revenue', 'expense') NOT NULL,
      group_category VARCHAR(100) NOT NULL,
      parent_id INT DEFAULT NULL,
      is_subledger TINYINT(1) DEFAULT 0,
      linked_entity_type ENUM('customer', 'vendor', 'bank', 'cash', 'tax', 'none') DEFAULT 'none',
      linked_entity_id INT DEFAULT NULL,
      current_balance DECIMAL(15,2) DEFAULT 0.00,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_acct_type (account_type),
      INDEX idx_linked (linked_entity_type, linked_entity_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

    // Seed master accounts if empty
    const countRes = await query('SELECT COUNT(*) as total FROM accounting_master_accounts')
    if (countRes && countRes[0]?.total === 0) {
      for (const acc of DEFAULT_MASTER_ACCOUNTS) {
        await execute(
          `INSERT IGNORE INTO accounting_master_accounts 
          (account_code, account_name, account_type, group_category, linked_entity_type)
          VALUES (?, ?, ?, ?, ?)`,
          [acc.account_code, acc.account_name, acc.account_type, acc.group_category, acc.linked_entity_type]
        )
      }
      console.log('accounting_master_accounts seeded successfully.')
    }

    // 2. accounting_vouchers
    await execute(`CREATE TABLE IF NOT EXISTS accounting_vouchers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      voucher_no VARCHAR(50) NOT NULL UNIQUE,
      voucher_type ENUM('receipt', 'payment', 'journal', 'sales_invoice', 'purchase_bill', 'contra', 'credit_note', 'debit_note') NOT NULL,
      voucher_date DATE NOT NULL,
      reference_no VARCHAR(100) DEFAULT '',
      shipment_id INT DEFAULT NULL,
      customer_id INT DEFAULT NULL,
      vendor_id INT DEFAULT NULL,
      total_debit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      total_credit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      is_tallied TINYINT(1) NOT NULL DEFAULT 1,
      narration TEXT,
      created_by VARCHAR(100) DEFAULT 'Admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_v_date (voucher_date),
      INDEX idx_v_type (voucher_type),
      INDEX idx_v_cust (customer_id),
      INDEX idx_v_vendor (vendor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

    // 3. accounting_voucher_items
    await execute(`CREATE TABLE IF NOT EXISTS accounting_voucher_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      voucher_id INT NOT NULL,
      account_id INT NOT NULL,
      debit_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      credit_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      particulars VARCHAR(255) DEFAULT '',
      INDEX idx_vi_voucher (voucher_id),
      INDEX idx_vi_acct (account_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

    return true
  } catch (err) {
    console.error('Error ensuring accounting tables:', err)
    throw err
  }
}

/**
 * Get Chart of Accounts list.
 */
export async function getChartOfAccounts(filters = {}) {
  await ensureAccountingTables()
  let sql = 'SELECT * FROM accounting_master_accounts WHERE 1=1'
  const params = []

  if (filters.account_type) {
    sql += ' AND account_type = ?'
    params.push(filters.account_type)
  }

  if (filters.is_active !== undefined) {
    sql += ' AND is_active = ?'
    params.push(filters.is_active ? 1 : 0)
  }

  if (filters.linked_entity_type) {
    sql += ' AND linked_entity_type = ?'
    params.push(filters.linked_entity_type)
  }

  sql += ' ORDER BY account_code ASC'
  return await query(sql, params)
}

/**
 * Create a new master account.
 */
export async function createMasterAccount(data) {
  await ensureAccountingTables()
  const {
    account_code,
    account_name,
    account_type,
    group_category,
    parent_id = null,
    is_subledger = 0,
    linked_entity_type = 'none',
    linked_entity_id = null,
    current_balance = 0.00
  } = data

  if (!account_code || !account_name || !account_type || !group_category) {
    throw new Error('account_code, account_name, account_type, and group_category are required')
  }

  const validTypes = ['asset', 'liability', 'equity', 'revenue', 'expense']
  if (!validTypes.includes(account_type)) {
    throw new Error(`account_type must be one of: ${validTypes.join(', ')}`)
  }

  const res = await execute(
    `INSERT INTO accounting_master_accounts 
    (account_code, account_name, account_type, group_category, parent_id, is_subledger, linked_entity_type, linked_entity_id, current_balance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [account_code.trim(), account_name.trim(), account_type, group_category.trim(), parent_id, is_subledger ? 1 : 0, linked_entity_type, linked_entity_id, parseFloat(current_balance) || 0.00]
  )

  const [row] = await query('SELECT * FROM accounting_master_accounts WHERE id = ?', [res.insertId])
  return row
}

/**
 * Update an existing master account.
 */
export async function updateMasterAccount(id, data) {
  await ensureAccountingTables()
  const [existing] = await query('SELECT * FROM accounting_master_accounts WHERE id = ?', [id])
  if (!existing) {
    throw new Error('Master account not found')
  }

  const fields = []
  const params = []

  if (data.account_name !== undefined) {
    fields.push('account_name = ?')
    params.push(data.account_name.trim())
  }
  if (data.group_category !== undefined) {
    fields.push('group_category = ?')
    params.push(data.group_category.trim())
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?')
    params.push(data.is_active ? 1 : 0)
  }
  if (data.linked_entity_type !== undefined) {
    fields.push('linked_entity_type = ?')
    params.push(data.linked_entity_type)
  }
  if (data.linked_entity_id !== undefined) {
    fields.push('linked_entity_id = ?')
    params.push(data.linked_entity_id)
  }

  if (fields.length === 0) return existing

  params.push(id)
  await execute(`UPDATE accounting_master_accounts SET ${fields.join(', ')} WHERE id = ?`, params)
  const [updated] = await query('SELECT * FROM accounting_master_accounts WHERE id = ?', [id])
  return updated
}

/**
 * Delete a master account (only if no voucher transactions exist).
 */
export async function deleteMasterAccount(id) {
  await ensureAccountingTables()
  const check = await query('SELECT COUNT(*) as cnt FROM accounting_voucher_items WHERE account_id = ?', [id])
  if (check[0]?.cnt > 0) {
    throw new Error(`Cannot delete account with existing voucher entries (${check[0].cnt} transactions recorded)`)
  }

  await execute('DELETE FROM accounting_master_accounts WHERE id = ?', [id])
  return { success: true }
}

/**
 * Generate sequential voucher number (e.g. RV-202611-0001)
 */
async function generateVoucherNumber(voucher_type) {
  const prefixMap = {
    receipt: 'RV',
    payment: 'PV',
    journal: 'JV',
    sales_invoice: 'SV',
    purchase_bill: 'PB',
    contra: 'CV',
    credit_note: 'CN',
    debit_note: 'DN'
  }
  const prefix = prefixMap[voucher_type] || 'JV'
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')

  const [row] = await query(
    `SELECT voucher_no FROM accounting_vouchers 
     WHERE voucher_no LIKE ? 
     ORDER BY id DESC LIMIT 1`,
    [`${prefix}-${yyyymm}-%`]
  )

  let nextSeq = 1
  if (row?.voucher_no) {
    const parts = row.voucher_no.split('-')
    const lastNum = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastNum)) nextSeq = lastNum + 1
  }

  return `${prefix}-${yyyymm}-${String(nextSeq).padStart(4, '0')}`
}

/**
 * Create a balanced double-entry voucher with validation and balance impact.
 */
export async function createVoucher(data, creatorName = 'Admin') {
  await ensureAccountingTables()

  const {
    voucher_type,
    voucher_date = new Date().toISOString().slice(0, 10),
    reference_no = '',
    shipment_id = null,
    customer_id = null,
    vendor_id = null,
    narration = '',
    items = []
  } = data

  if (!voucher_type) {
    throw new Error('voucher_type is required')
  }

  if (!Array.isArray(items) || items.length < 2) {
    throw new Error('A double-entry voucher requires at least two line items (one debit and one credit)')
  }

  // Calculate sum of debits and sum of credits
  let sumDebit = 0
  let sumCredit = 0

  const cleanedItems = items.map((it, idx) => {
    const d = Math.round((parseFloat(it.debit_amount) || 0) * 100) / 100
    const c = Math.round((parseFloat(it.credit_amount) || 0) * 100) / 100
    if (!it.account_id) {
      throw new Error(`Item at row ${idx + 1} is missing account_id`)
    }
    if (d < 0 || c < 0) {
      throw new Error(`Item at row ${idx + 1} has negative debit or credit amount`)
    }
    if (d === 0 && c === 0) {
      throw new Error(`Item at row ${idx + 1} must have either a debit or credit amount`)
    }
    sumDebit = Math.round((sumDebit + d) * 100) / 100
    sumCredit = Math.round((sumCredit + c) * 100) / 100
    return {
      account_id: parseInt(it.account_id, 10),
      debit_amount: d,
      credit_amount: c,
      particulars: (it.particulars || '').trim()
    }
  })

  // THE GOLDEN RULE OF DOUBLE ENTRY: sum(debit) MUST equal sum(credit)
  const variance = Math.abs(Math.round((sumDebit - sumCredit) * 100) / 100)
  if (variance > 0.01) {
    throw new Error(
      `Double-Entry Tally Violation: Total Debit (₹${sumDebit.toFixed(2)}) does not equal Total Credit (₹${sumCredit.toFixed(2)}). Variance: ₹${variance.toFixed(2)}`
    )
  }

  const voucher_no = data.voucher_no || await generateVoucherNumber(voucher_type)

  // Insert voucher header
  const vRes = await execute(
    `INSERT INTO accounting_vouchers 
    (voucher_no, voucher_type, voucher_date, reference_no, shipment_id, customer_id, vendor_id, total_debit, total_credit, is_tallied, narration, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      voucher_no,
      voucher_type,
      voucher_date,
      reference_no.trim(),
      shipment_id || null,
      customer_id || null,
      vendor_id || null,
      sumDebit,
      sumCredit,
      narration.trim(),
      creatorName
    ]
  )
  const voucherId = vRes.insertId

  // Insert line items & update account balances
  for (const item of cleanedItems) {
    await execute(
      `INSERT INTO accounting_voucher_items 
      (voucher_id, account_id, debit_amount, credit_amount, particulars)
      VALUES (?, ?, ?, ?, ?)`,
      [voucherId, item.account_id, item.debit_amount, item.credit_amount, item.particulars]
    )

    // Fetch account type to adjust balance correctly
    const [acc] = await query('SELECT id, account_type, current_balance FROM accounting_master_accounts WHERE id = ?', [item.account_id])
    if (acc) {
      let delta = 0
      // Assets and Expenses increase with Debit, decrease with Credit
      if (acc.account_type === 'asset' || acc.account_type === 'expense') {
        delta = item.debit_amount - item.credit_amount
      } else {
        // Liabilities, Equity, and Revenue increase with Credit, decrease with Debit
        delta = item.credit_amount - item.debit_amount
      }
      const newBal = Math.round((parseFloat(acc.current_balance) + delta) * 100) / 100
      await execute('UPDATE accounting_master_accounts SET current_balance = ? WHERE id = ?', [newBal, item.account_id])
    }
  }

  return await getVoucherById(voucherId)
}

/**
 * Get single voucher with its line items.
 */
export async function getVoucherById(id) {
  await ensureAccountingTables()
  const [voucher] = await query(
    `SELECT v.*, 
            c.name as customer_name, c.company as customer_company, c.email as customer_email,
            s.tracking_number as shipment_tracking
     FROM accounting_vouchers v
     LEFT JOIN tbl_customers c ON v.customer_id = c.id
     LEFT JOIN shipments s ON v.shipment_id = s.id
     WHERE v.id = ?`,
    [id]
  )

  if (!voucher) return null

  const items = await query(
    `SELECT vi.*, a.account_code, a.account_name, a.account_type, a.group_category
     FROM accounting_voucher_items vi
     JOIN accounting_master_accounts a ON vi.account_id = a.id
     WHERE vi.voucher_id = ?
     ORDER BY vi.id ASC`,
    [id]
  )

  return { ...voucher, items }
}

/**
 * List vouchers with filters.
 */
export async function getVouchers(filters = {}) {
  await ensureAccountingTables()
  let sql = `
    SELECT v.*, 
           c.name as customer_name, c.company as customer_company,
           s.tracking_number as shipment_tracking,
           (SELECT COUNT(*) FROM accounting_voucher_items vi WHERE vi.voucher_id = v.id) as item_count
    FROM accounting_vouchers v
    LEFT JOIN tbl_customers c ON v.customer_id = c.id
    LEFT JOIN shipments s ON v.shipment_id = s.id
    WHERE 1=1
  `
  const params = []

  if (filters.voucher_type) {
    sql += ' AND v.voucher_type = ?'
    params.push(filters.voucher_type)
  }

  if (filters.customer_id) {
    sql += ' AND v.customer_id = ?'
    params.push(filters.customer_id)
  }

  if (filters.from_date) {
    sql += ' AND v.voucher_date >= ?'
    params.push(filters.from_date)
  }

  if (filters.to_date) {
    sql += ' AND v.voucher_date <= ?'
    params.push(filters.to_date)
  }

  if (filters.search) {
    sql += ' AND (v.voucher_no LIKE ? OR v.reference_no LIKE ? OR v.narration LIKE ?)'
    const term = `%${filters.search.trim()}%`
    params.push(term, term, term)
  }

  sql += ' ORDER BY v.voucher_date DESC, v.id DESC'

  const limit = Math.min(parseInt(filters.limit, 10) || 50, 200)
  const offset = parseInt(filters.offset, 10) || 0
  sql += ' LIMIT ? OFFSET ?'
  params.push(limit, offset)

  return await query(sql, params)
}

/**
 * Delete a voucher and reverse its impact on account balances.
 */
export async function deleteVoucher(id) {
  await ensureAccountingTables()
  const voucher = await getVoucherById(id)
  if (!voucher) {
    throw new Error('Voucher not found')
  }

  // Reverse balance updates
  for (const item of voucher.items) {
    const [acc] = await query('SELECT id, account_type, current_balance FROM accounting_master_accounts WHERE id = ?', [item.account_id])
    if (acc) {
      let delta = 0
      if (acc.account_type === 'asset' || acc.account_type === 'expense') {
        delta = item.debit_amount - item.credit_amount
      } else {
        delta = item.credit_amount - item.debit_amount
      }
      // Reverse: subtract the previously added delta
      const reversedBal = Math.round((parseFloat(acc.current_balance) - delta) * 100) / 100
      await execute('UPDATE accounting_master_accounts SET current_balance = ? WHERE id = ?', [reversedBal, item.account_id])
    }
  }

  await execute('DELETE FROM accounting_voucher_items WHERE voucher_id = ?', [id])
  await execute('DELETE FROM accounting_vouchers WHERE id = ?', [id])

  return { success: true, message: `Voucher ${voucher.voucher_no} deleted and balances reversed` }
}

/**
 * Get Account Ledger (individual account transactions & running balance).
 */
export async function getAccountLedger(accountId, filters = {}) {
  await ensureAccountingTables()
  const [account] = await query('SELECT * FROM accounting_master_accounts WHERE id = ?', [accountId])
  if (!account) {
    throw new Error('Master account not found')
  }

  let sql = `
    SELECT vi.id as item_id, vi.debit_amount, vi.credit_amount, vi.particulars,
           v.id as voucher_id, v.voucher_no, v.voucher_type, v.voucher_date, v.reference_no, v.narration, v.created_by
    FROM accounting_voucher_items vi
    JOIN accounting_vouchers v ON vi.voucher_id = v.id
    WHERE vi.account_id = ?
  `
  const params = [accountId]

  if (filters.from_date) {
    sql += ' AND v.voucher_date >= ?'
    params.push(filters.from_date)
  }
  if (filters.to_date) {
    sql += ' AND v.voucher_date <= ?'
    params.push(filters.to_date)
  }

  sql += ' ORDER BY v.voucher_date ASC, v.id ASC'
  const entries = await query(sql, params)

  // Compute running balance
  let running = 0
  const isDebitNormal = account.account_type === 'asset' || account.account_type === 'expense'

  const ledger = entries.map(entry => {
    const d = parseFloat(entry.debit_amount) || 0
    const c = parseFloat(entry.credit_amount) || 0
    if (isDebitNormal) {
      running = Math.round((running + d - c) * 100) / 100
    } else {
      running = Math.round((running + c - d) * 100) / 100
    }
    return {
      ...entry,
      running_balance: running
    }
  })

  return {
    account,
    total_debit: ledger.reduce((sum, e) => sum + parseFloat(e.debit_amount), 0),
    total_credit: ledger.reduce((sum, e) => sum + parseFloat(e.credit_amount), 0),
    closing_balance: running,
    entries: ledger
  }
}

/**
 * Get Trial Balance Report (sums all debits and credits, verifies tally).
 */
export async function getTrialBalance() {
  await ensureAccountingTables()

  const sql = `
    SELECT 
      a.id, a.account_code, a.account_name, a.account_type, a.group_category, a.current_balance,
      COALESCE(SUM(vi.debit_amount), 0.00) as total_debit,
      COALESCE(SUM(vi.credit_amount), 0.00) as total_credit
    FROM accounting_master_accounts a
    LEFT JOIN accounting_voucher_items vi ON a.id = vi.account_id
    GROUP BY a.id
    ORDER BY a.account_code ASC
  `
  const rows = await query(sql)

  let grandTotalDebit = 0
  let grandTotalCredit = 0

  const accounts = rows.map(r => {
    const d = parseFloat(r.total_debit) || 0
    const c = parseFloat(r.total_credit) || 0
    grandTotalDebit = Math.round((grandTotalDebit + d) * 100) / 100
    grandTotalCredit = Math.round((grandTotalCredit + c) * 100) / 100

    let debitBal = 0
    let creditBal = 0

    if (r.account_type === 'asset' || r.account_type === 'expense') {
      const net = d - c
      if (net >= 0) debitBal = net
      else creditBal = Math.abs(net)
    } else {
      const net = c - d
      if (net >= 0) creditBal = net
      else debitBal = Math.abs(net)
    }

    return {
      ...r,
      total_debit: d,
      total_credit: c,
      debit_balance: debitBal,
      credit_balance: creditBal
    }
  })

  const variance = Math.abs(Math.round((grandTotalDebit - grandTotalCredit) * 100) / 100)

  return {
    accounts,
    grand_total_debit: grandTotalDebit,
    grand_total_credit: grandTotalCredit,
    variance,
    is_tallied: variance < 0.01
  }
}

/**
 * Get Day Book & Cash Drawer Tally for a specific date.
 */
export async function getDayBook(date = new Date().toISOString().slice(0, 10)) {
  await ensureAccountingTables()

  // Get cash register account (1111)
  const [cashAcc] = await query("SELECT * FROM accounting_master_accounts WHERE account_code = '1111' LIMIT 1")

  // Vouchers on this date
  const vouchers = await query(
    `SELECT v.*, 
            c.name as customer_name, c.company as customer_company
     FROM accounting_vouchers v
     LEFT JOIN tbl_customers c ON v.customer_id = c.id
     WHERE v.voucher_date = ?
     ORDER BY v.id ASC`,
    [date]
  )

  // Cash in & cash out for this day
  let cashIn = 0
  let cashOut = 0

  if (cashAcc) {
    const cashItems = await query(
      `SELECT vi.debit_amount, vi.credit_amount
       FROM accounting_voucher_items vi
       JOIN accounting_vouchers v ON vi.voucher_id = v.id
       WHERE vi.account_id = ? AND v.voucher_date = ?`,
      [cashAcc.id, date]
    )
    for (const it of cashItems) {
      cashIn += parseFloat(it.debit_amount) || 0
      cashOut += parseFloat(it.credit_amount) || 0
    }
  }

  return {
    date,
    cash_account: cashAcc || null,
    day_cash_in: cashIn,
    day_cash_out: cashOut,
    net_cash_flow: cashIn - cashOut,
    vouchers_count: vouchers.length,
    vouchers
  }
}


/**
 * ═══════════════════════════════════════════════════════════════════════
 * SIMPLIFIED ACCOUNTING: 5 BALANCE SHEETS & DIRECT ENTRIES
 * ═══════════════════════════════════════════════════════════════════════
 */

export async function ensureAccountingEntriesTable() {
  await ensureAccountingTables()
  await execute(`CREATE TABLE IF NOT EXISTS accounting_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_number VARCHAR(50) NOT NULL UNIQUE,
    entry_type ENUM('customer_payment', 'customer_charge', 'walkin_cash', 'vendor_payment', 'vendor_bill', 'expense') NOT NULL,
    party_type ENUM('customer', 'walkin', 'vendor', 'expense', 'other') NOT NULL DEFAULT 'other',
    party_name VARCHAR(150) NOT NULL DEFAULT '',
    customer_id INT DEFAULT NULL,
    vendor_id INT DEFAULT NULL,
    vendor_code VARCHAR(100) DEFAULT '',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash',
    reference_no VARCHAR(100) DEFAULT '',
    entry_date DATE NOT NULL,
    description TEXT,
    created_by VARCHAR(100) DEFAULT 'Admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ae_date (entry_date),
    INDEX idx_ae_type (entry_type),
    INDEX idx_ae_cust (customer_id),
    INDEX idx_ae_vendor (vendor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
}

/**
 * 1. Master Balance Sheet Overview
 */
export async function getMasterBalanceSheet() {
  await ensureAccountingEntriesTable()

  // Customers Total Outstanding Due
  const [custTotal] = await query(`
    SELECT 
      COUNT(*) as total_customers,
      COALESCE(SUM(current_balance), 0.00) as total_receivable
    FROM tbl_customers
  `)

  // Walk-in Shipments Revenue
  const [walkinTotal] = await query(`
    SELECT 
      COUNT(*) as total_walkin_shipments,
      COALESCE(SUM(total_amount), 0.00) as total_walkin_revenue
    FROM shipments
    WHERE (customer_id IS NULL OR customer_id = 0 OR customer_type = 'walkin')
      AND (is_trashed = 0 OR is_trashed IS NULL)
  `)

  // Registered Customer Shipments Revenue
  const [customerShipTotal] = await query(`
    SELECT 
      COUNT(*) as total_customer_shipments,
      COALESCE(SUM(total_amount), 0.00) as total_customer_revenue
    FROM shipments
    WHERE customer_id > 0 AND (customer_type != 'walkin' OR customer_type IS NULL)
      AND (is_trashed = 0 OR is_trashed IS NULL)
  `)

  // Total Vendor Freight Costs
  const [vendorCosts] = await query(`
    SELECT 
      COALESCE(SUM(vendor_rate), 0.00) as total_vendor_linehaul
    FROM shipments
    WHERE (is_trashed = 0 OR is_trashed IS NULL)
  `)

  // Vendor Payments Made
  const [vendorPaidRes] = await query(`
    SELECT COALESCE(SUM(amount), 0.00) as total_vendor_paid
    FROM accounting_entries
    WHERE entry_type = 'vendor_payment'
  `)

  // Total Expenses
  const [expenseRes] = await query(`
    SELECT COALESCE(SUM(amount), 0.00) as total_expenses
    FROM accounting_entries
    WHERE entry_type = 'expense'
  `)

  // Cash / Bank Balances
  const [cashAcc] = await query("SELECT current_balance FROM accounting_master_accounts WHERE account_code = '1111' LIMIT 1")
  const [bankAcc] = await query("SELECT current_balance FROM accounting_master_accounts WHERE account_code = '1121' LIMIT 1")

  const totalWalkinRev = parseFloat(walkinTotal?.total_walkin_revenue) || 0
  const totalCustRev = parseFloat(customerShipTotal?.total_customer_revenue) || 0
  const totalBilledRevenue = totalWalkinRev + totalCustRev

  const totalVendorBilled = parseFloat(vendorCosts?.total_vendor_linehaul) || 0
  const totalVendorPaid = parseFloat(vendorPaidRes?.total_vendor_paid) || 0
  const vendorPayableBalance = Math.max(0, totalVendorBilled - totalVendorPaid)

  const totalCustomerReceivable = parseFloat(custTotal?.total_receivable) || 0
  const totalExpenses = parseFloat(expenseRes?.total_expenses) || 0

  const grossProfit = totalBilledRevenue - totalVendorBilled
  const netProfit = grossProfit - totalExpenses

  return {
    receivables: {
      total_customer_due: totalCustomerReceivable,
      total_customers_count: parseInt(custTotal?.total_customers, 10) || 0,
      total_customer_shipments_revenue: totalCustRev
    },
    walkin: {
      total_walkin_revenue: totalWalkinRev,
      total_walkin_shipments_count: parseInt(walkinTotal?.total_walkin_shipments, 10) || 0
    },
    payables: {
      total_vendor_linehaul_cost: totalVendorBilled,
      total_vendor_paid: totalVendorPaid,
      total_vendor_payable: vendorPayableBalance
    },
    liquid_funds: {
      cash_in_hand: parseFloat(cashAcc?.current_balance || 0),
      bank_balance: parseFloat(bankAcc?.current_balance || 0),
      total_expenses: totalExpenses
    },
    profitability: {
      total_revenue: totalBilledRevenue,
      total_direct_costs: totalVendorBilled,
      gross_profit: grossProfit,
      net_profit: netProfit,
      margin_pct: totalBilledRevenue > 0 ? Math.round((grossProfit / totalBilledRevenue) * 10000) / 100 : 0
    }
  }
}

/**
 * 2. Customers Accounts Balance Sheet
 */
export async function getCustomersBalanceSheet() {
  await ensureAccountingEntriesTable()

  const customers = await query(`
    SELECT 
      c.id, c.name, c.company, c.phone, c.email, c.credit_limit, c.current_balance, c.status,
      COUNT(s.id) as shipments_count,
      COALESCE(SUM(s.total_amount), 0.00) as total_shipment_billing,
      (SELECT COALESCE(SUM(amount), 0.00) FROM customer_ledger cl WHERE cl.customer_id = c.id AND cl.entry_type = 'credit') as total_paid
    FROM tbl_customers c
    LEFT JOIN shipments s ON c.id = s.customer_id AND (s.is_trashed = 0 OR s.is_trashed IS NULL)
    GROUP BY c.id
    ORDER BY c.current_balance DESC, c.name ASC
  `)

  let grandTotalBalance = 0
  let grandTotalBilling = 0
  let grandTotalPaid = 0

  const list = customers.map(c => {
    const bal = parseFloat(c.current_balance) || 0
    const billing = parseFloat(c.total_shipment_billing) || 0
    const paid = parseFloat(c.total_paid) || 0
    grandTotalBalance += bal
    grandTotalBilling += billing
    grandTotalPaid += paid
    return {
      ...c,
      current_balance: bal,
      total_shipment_billing: billing,
      total_paid: paid,
      status_label: bal > 0 ? 'Due Pending' : bal < 0 ? 'Advance / Excess' : 'Settled'
    }
  })

  return {
    grand_total_balance: grandTotalBalance,
    grand_total_billing: grandTotalBilling,
    grand_total_paid: grandTotalPaid,
    total_customers: list.length,
    customers: list
  }
}

/**
 * 3. Walk-in Customers Balance Sheet
 */
export async function getWalkinBalanceSheet(filters = {}) {
  await ensureAccountingEntriesTable()

  let sql = `
    SELECT 
      id, order_id, tracking_number, sender_name, sender_phone, sender_city,
      receiver_name, receiver_country, receiver_city,
      chargeable_weight, rate_per_kg, shipping_charge, extra_charge, total_amount,
      payment_mode, status, created_at
    FROM shipments
    WHERE (customer_id IS NULL OR customer_id = 0 OR customer_type = 'walkin')
      AND (is_trashed = 0 OR is_trashed IS NULL)
  `
  const params = []

  if (filters.from_date) {
    sql += ' AND created_at >= ?'
    params.push(filters.from_date + ' 00:00:00')
  }
  if (filters.to_date) {
    sql += ' AND created_at <= ?'
    params.push(filters.to_date + ' 23:59:59')
  }
  if (filters.search) {
    sql += ' AND (tracking_number LIKE ? OR sender_name LIKE ? OR receiver_name LIKE ? OR receiver_country LIKE ?)'
    const t = `%${filters.search.trim()}%`
    params.push(t, t, t, t)
  }

  sql += ' ORDER BY created_at DESC LIMIT 100'

  const shipments = await query(sql, params)

  // Overall totals for walkin
  const [totalRow] = await query(`
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(total_amount), 0.00) as total_revenue,
      COALESCE(SUM(chargeable_weight), 0.00) as total_weight,
      COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN total_amount ELSE 0 END), 0.00) as cash_collected,
      COALESCE(SUM(CASE WHEN payment_mode != 'cash' THEN total_amount ELSE 0 END), 0.00) as digital_collected
    FROM shipments
    WHERE (customer_id IS NULL OR customer_id = 0 OR customer_type = 'walkin')
      AND (is_trashed = 0 OR is_trashed IS NULL)
  `)

  return {
    summary: {
      total_count: parseInt(totalRow?.total_count, 10) || 0,
      total_revenue: parseFloat(totalRow?.total_revenue || 0),
      total_weight: parseFloat(totalRow?.total_weight || 0),
      cash_collected: parseFloat(totalRow?.cash_collected || 0),
      digital_collected: parseFloat(totalRow?.digital_collected || 0)
    },
    shipments
  }
}

/**
 * 4. Vendors Balance Sheet
 */
export async function getVendorsBalanceSheet() {
  await ensureAccountingEntriesTable()

  // Get active vendors from configs
  const vendors = await query(`
    SELECT id, name, vendor_code, is_active
    FROM vendor_api_configs
    ORDER BY name ASC
  `)

  let grandTotalCost = 0
  let grandTotalPaid = 0
  let grandTotalPayable = 0

  const vendorList = []

  for (const v of vendors) {
    // Shipments forwarded to this vendor
    const [shipRes] = await query(
      `SELECT 
        COUNT(*) as shipments_count,
        COALESCE(SUM(chargeable_weight), 0.00) as total_weight,
        COALESCE(SUM(vendor_rate), 0.00) as total_cost
       FROM shipments
       WHERE (vendor_code = ? OR vendor_config_id = ?)
         AND (is_trashed = 0 OR is_trashed IS NULL)`,
      [v.vendor_code, v.id]
    )

    // Payments made to this vendor
    const [payRes] = await query(
      `SELECT COALESCE(SUM(amount), 0.00) as total_paid
       FROM accounting_entries
       WHERE (vendor_id = ? OR vendor_code = ?) AND entry_type = 'vendor_payment'`,
      [v.id, v.vendor_code]
    )

    const cost = parseFloat(shipRes?.total_cost) || 0
    const paid = parseFloat(payRes?.total_paid) || 0
    const payable = Math.round((cost - paid) * 100) / 100

    grandTotalCost += cost
    grandTotalPaid += paid
    grandTotalPayable += payable

    vendorList.push({
      id: v.id,
      name: v.name,
      vendor_code: v.vendor_code,
      shipments_count: parseInt(shipRes?.shipments_count, 10) || 0,
      total_weight: parseFloat(shipRes?.total_weight) || 0,
      total_cost: cost,
      total_paid: paid,
      balance_payable: payable,
      status: payable > 0 ? 'Payable Due' : payable < 0 ? 'Advance Paid' : 'Settled'
    })
  }

  return {
    grand_total_cost: grandTotalCost,
    grand_total_paid: grandTotalPaid,
    grand_total_payable: grandTotalPayable,
    vendors: vendorList
  }
}

/**
 * 5. Simple Financial Entries Register
 */
export async function getEntries(filters = {}) {
  await ensureAccountingEntriesTable()

  let sql = 'SELECT * FROM accounting_entries WHERE 1=1'
  const params = []

  if (filters.entry_type) {
    sql += ' AND entry_type = ?'
    params.push(filters.entry_type)
  }
  if (filters.party_type) {
    sql += ' AND party_type = ?'
    params.push(filters.party_type)
  }
  if (filters.customer_id) {
    sql += ' AND customer_id = ?'
    params.push(filters.customer_id)
  }
  if (filters.vendor_code) {
    sql += ' AND vendor_code = ?'
    params.push(filters.vendor_code)
  }
  if (filters.search) {
    sql += ' AND (entry_number LIKE ? OR party_name LIKE ? OR reference_no LIKE ? OR description LIKE ?)'
    const t = `%${filters.search.trim()}%`
    params.push(t, t, t, t)
  }

  sql += ' ORDER BY entry_date DESC, id DESC LIMIT 100'
  return await query(sql, params)
}

/**
 * Create a Simple Entry (Customer Payment, Charge, Walk-in, Vendor Payment, Expense)
 */
export async function createSimpleEntry(data, creator = 'Admin') {
  await ensureAccountingEntriesTable()

  const {
    entry_type,
    party_type = 'other',
    party_name = '',
    customer_id = null,
    vendor_id = null,
    vendor_code = '',
    amount,
    payment_mode = 'cash',
    reference_no = '',
    entry_date = new Date().toISOString().slice(0, 10),
    description = ''
  } = data

  const numAmount = Math.round((parseFloat(amount) || 0) * 100) / 100
  if (numAmount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  // Generate entry number
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
  const prefixMap = {
    customer_payment: 'CR',
    customer_charge: 'CD',
    walkin_cash: 'WC',
    vendor_payment: 'VP',
    vendor_bill: 'VB',
    expense: 'EX'
  }
  const pfx = prefixMap[entry_type] || 'EN'

  const [lastRow] = await query(
    'SELECT entry_number FROM accounting_entries WHERE entry_number LIKE ? ORDER BY id DESC LIMIT 1',
    [`${pfx}-${yyyymm}-%`]
  )

  let nextSeq = 1
  if (lastRow?.entry_number) {
    const parts = lastRow.entry_number.split('-')
    const lastNum = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastNum)) nextSeq = lastNum + 1
  }
  const entryNumber = `${pfx}-${yyyymm}-${String(nextSeq).padStart(4, '0')}`

  // If customer entry, sync with tbl_customers and customer_ledger
  let finalPartyName = party_name
  if (customer_id) {
    const [cust] = await query('SELECT id, name, company, email, current_balance FROM tbl_customers WHERE id = ?', [customer_id])
    if (cust) {
      finalPartyName = cust.company ? `${cust.name} (${cust.company})` : cust.name
      const curBal = parseFloat(cust.current_balance) || 0
      let newBal = curBal

      if (entry_type === 'customer_payment') {
        // Payment decreases customer due balance
        newBal = Math.round((curBal - numAmount) * 100) / 100
        await execute('UPDATE tbl_customers SET current_balance = ? WHERE id = ?', [newBal, customer_id])
        await execute(
          `INSERT INTO customer_ledger 
          (customer_id, customer_email, entry_type, amount, balance_after, reference_no, payment_mode, description, entry_date, created_by)
          VALUES (?, ?, 'credit', ?, ?, ?, ?, ?, ?, ?)`,
          [customer_id, cust.email, numAmount, newBal, reference_no, payment_mode, description || 'Customer Payment Received', entry_date, creator]
        )
      } else if (entry_type === 'customer_charge') {
        // Charge increases customer due balance
        newBal = Math.round((curBal + numAmount) * 100) / 100
        await execute('UPDATE tbl_customers SET current_balance = ? WHERE id = ?', [newBal, customer_id])
        await execute(
          `INSERT INTO customer_ledger 
          (customer_id, customer_email, entry_type, amount, balance_after, reference_no, payment_mode, description, entry_date, created_by)
          VALUES (?, ?, 'debit', ?, ?, ?, ?, ?, ?, ?)`,
          [customer_id, cust.email, numAmount, newBal, reference_no, payment_mode, description || 'Shipment / Service Charge', entry_date, creator]
        )
      }
    }
  }

  // Insert into accounting_entries
  const res = await execute(
    `INSERT INTO accounting_entries 
    (entry_number, entry_type, party_type, party_name, customer_id, vendor_id, vendor_code, amount, payment_mode, reference_no, entry_date, description, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entryNumber,
      entry_type,
      party_type,
      finalPartyName,
      customer_id || null,
      vendor_id || null,
      vendor_code || '',
      numAmount,
      payment_mode,
      reference_no.trim(),
      entry_date,
      description.trim(),
      creator
    ]
  )

  const [newEntry] = await query('SELECT * FROM accounting_entries WHERE id = ?', [res.insertId])
  return newEntry
}

/**
 * Delete a simple entry
 */
export async function deleteSimpleEntry(id) {
  await ensureAccountingEntriesTable()
  const [entry] = await query('SELECT * FROM accounting_entries WHERE id = ?', [id])
  if (!entry) throw new Error('Entry not found')

  // Reverse customer balance if applicable
  if (entry.customer_id) {
    const [cust] = await query('SELECT id, current_balance FROM tbl_customers WHERE id = ?', [entry.customer_id])
    if (cust) {
      const curBal = parseFloat(cust.current_balance) || 0
      let revertedBal = curBal
      if (entry.entry_type === 'customer_payment') {
        // Re-add amount that was deducted
        revertedBal = Math.round((curBal + parseFloat(entry.amount)) * 100) / 100
      } else if (entry.entry_type === 'customer_charge') {
        // Deduct amount that was charged
        revertedBal = Math.round((curBal - parseFloat(entry.amount)) * 100) / 100
      }
      await execute('UPDATE tbl_customers SET current_balance = ? WHERE id = ?', [revertedBal, entry.customer_id])
    }
  }

  await execute('DELETE FROM accounting_entries WHERE id = ?', [id])
  return { success: true, message: `Entry ${entry.entry_number} deleted and balances updated` }
}
