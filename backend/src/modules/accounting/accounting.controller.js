import * as accountingService from '../../services/accounting.service.js'
import { query, execute } from '../../config/db.js'

/**
 * Check if accounting is enabled in system settings
 */
export async function getLedgerStatus(req, res) {
  try {
    const rows = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'enable_accounting' LIMIT 1")
    const isEnabled = rows.length > 0 && (rows[0].setting_value === 'true' || rows[0].setting_value === true || rows[0].setting_value === '1')
    return res.json({
      success: true,
      enabled: isEnabled
    })
  } catch (error) {
    console.error('Error getting accounting status:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Toggle accounting ledger in system settings
 */
export async function toggleLedgerStatus(req, res) {
  try {
    const { enabled } = req.body
    const val = Boolean(enabled) ? 'true' : 'false'
    await execute(
      `INSERT INTO system_settings (setting_key, setting_value, description)
       VALUES ('enable_accounting', ?, 'Enable customer debit/credit accounting ledger, balance tracking, and customer accounting statements')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [val]
    )
    return res.json({
      success: true,
      enabled: val === 'true',
      message: `Accounting ledger has been ${val === 'true' ? 'enabled' : 'disabled'}`
    })
  } catch (error) {
    console.error('Error toggling accounting status:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Get Chart of Accounts
 */
export async function getAccounts(req, res) {
  try {
    const accounts = await accountingService.getChartOfAccounts(req.query)
    return res.json({
      success: true,
      accounts
    })
  } catch (error) {
    console.error('Error fetching chart of accounts:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Create Master Account
 */
export async function createAccount(req, res) {
  try {
    const account = await accountingService.createMasterAccount(req.body)
    return res.status(201).json({
      success: true,
      message: 'Master account created successfully',
      account
    })
  } catch (error) {
    console.error('Error creating master account:', error)
    return res.status(400).json({ success: false, message: error.message })
  }
}

/**
 * Update Master Account
 */
export async function updateAccount(req, res) {
  try {
    const account = await accountingService.updateMasterAccount(req.params.id, req.body)
    return res.json({
      success: true,
      message: 'Master account updated successfully',
      account
    })
  } catch (error) {
    console.error('Error updating master account:', error)
    return res.status(400).json({ success: false, message: error.message })
  }
}

/**
 * Delete Master Account
 */
export async function deleteAccount(req, res) {
  try {
    await accountingService.deleteMasterAccount(req.params.id)
    return res.json({
      success: true,
      message: 'Master account deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting master account:', error)
    return res.status(400).json({ success: false, message: error.message })
  }
}

/**
 * List Vouchers
 */
export async function getVouchers(req, res) {
  try {
    const vouchers = await accountingService.getVouchers(req.query)
    return res.json({
      success: true,
      vouchers
    })
  } catch (error) {
    console.error('Error fetching vouchers:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Get Voucher by ID
 */
export async function getVoucher(req, res) {
  try {
    const voucher = await accountingService.getVoucherById(req.params.id)
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Voucher not found' })
    }
    return res.json({
      success: true,
      voucher
    })
  } catch (error) {
    console.error('Error fetching voucher:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Create Balanced Double-Entry Voucher
 */
export async function createVoucher(req, res) {
  try {
    const creator = req.user?.name || req.user?.username || 'Admin'
    const voucher = await accountingService.createVoucher(req.body, creator)
    return res.status(201).json({
      success: true,
      message: `Voucher ${voucher.voucher_no} created and tallied successfully`,
      voucher
    })
  } catch (error) {
    console.error('Error creating voucher:', error)
    return res.status(400).json({ success: false, message: error.message })
  }
}

/**
 * Delete Voucher & Reverse Balances
 */
export async function deleteVoucher(req, res) {
  try {
    const result = await accountingService.deleteVoucher(req.params.id)
    return res.json(result)
  } catch (error) {
    console.error('Error deleting voucher:', error)
    return res.status(400).json({ success: false, message: error.message })
  }
}

/**
 * Get Account Ledger History & Running Balance
 */
export async function getAccountLedger(req, res) {
  try {
    const data = await accountingService.getAccountLedger(req.params.accountId, req.query)
    return res.json({
      success: true,
      ...data
    })
  } catch (error) {
    console.error('Error fetching account ledger:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Get Trial Balance Report
 */
export async function getTrialBalance(req, res) {
  try {
    const report = await accountingService.getTrialBalance()
    return res.json({
      success: true,
      ...report
    })
  } catch (error) {
    console.error('Error generating trial balance:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Get Day Book & Cash Drawer Tally
 */
export async function getDayBook(req, res) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10)
    const report = await accountingService.getDayBook(date)
    return res.json({
      success: true,
      ...report
    })
  } catch (error) {
    console.error('Error fetching day book:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}
