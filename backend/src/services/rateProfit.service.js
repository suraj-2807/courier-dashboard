import { query, execute } from '../config/db.js'

/**
 * Ensure `rate_profit_rules` table exists in MySQL database
 */
export async function ensureRateProfitRulesTable() {
  try {
    await execute(`CREATE TABLE IF NOT EXISTS rate_profit_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rule_type ENUM('weight', 'country') NOT NULL,
      vendor_code VARCHAR(50) DEFAULT 'all',
      country VARCHAR(100) DEFAULT '',
      min_weight DECIMAL(10,3) DEFAULT 0.000,
      max_weight DECIMAL(10,3) DEFAULT 9999.000,
      margin_type ENUM('percentage', 'fixed_amount', 'fixed_per_kg') NOT NULL DEFAULT 'percentage',
      margin_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      is_active TINYINT(1) DEFAULT 1,
      notes VARCHAR(255) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_rpr_type (rule_type),
      INDEX idx_rpr_vendor (vendor_code),
      INDEX idx_rpr_country (country),
      INDEX idx_rpr_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  } catch (err) {
    if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
      console.error('ensureRateProfitRulesTable error:', err.message)
    }
  }
}

/**
 * Get all profit margin rules
 */
export async function getAllProfitRules(ruleType = null) {
  await ensureRateProfitRulesTable()
  let sql = 'SELECT * FROM rate_profit_rules'
  const params = []
  if (ruleType) {
    sql += ' WHERE rule_type = ?'
    params.push(ruleType)
  }
  sql += ' ORDER BY rule_type ASC, min_weight ASC, id ASC'
  return await query(sql, params)
}

/**
 * Create a new profit margin rule
 */
export async function createProfitRule(data) {
  await ensureRateProfitRulesTable()
  const {
    rule_type,
    vendor_code = 'all',
    country = '',
    min_weight = 0,
    max_weight = 9999,
    margin_type = 'percentage',
    margin_value = 0,
    is_active = 1,
    notes = ''
  } = data

  const cleanType = rule_type === 'country' ? 'country' : 'weight'
  const cleanVendor = (vendor_code || 'all').toLowerCase().trim()
  const cleanCountry = (country || '').trim()
  const minW = Math.max(0, parseFloat(min_weight) || 0)
  const maxW = Math.max(minW, parseFloat(max_weight) || 9999)
  const val = Math.max(0, parseFloat(margin_value) || 0)
  const active = is_active === false || is_active === 0 || is_active === '0' ? 0 : 1

  const res = await execute(
    `INSERT INTO rate_profit_rules 
     (rule_type, vendor_code, country, min_weight, max_weight, margin_type, margin_value, is_active, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [cleanType, cleanVendor, cleanCountry, minW, maxW, margin_type, val, active, notes]
  )

  const newId = res.insertId
  const [created] = await query('SELECT * FROM rate_profit_rules WHERE id = ?', [newId])
  return created
}

/**
 * Update an existing profit margin rule
 */
export async function updateProfitRule(id, data) {
  await ensureRateProfitRulesTable()
  const [existing] = await query('SELECT * FROM rate_profit_rules WHERE id = ?', [id])
  if (!existing) {
    throw new Error('Profit rule not found')
  }

  const updates = []
  const params = []

  if (data.rule_type !== undefined) {
    updates.push('rule_type = ?')
    params.push(data.rule_type === 'country' ? 'country' : 'weight')
  }
  if (data.vendor_code !== undefined) {
    updates.push('vendor_code = ?')
    params.push((data.vendor_code || 'all').toLowerCase().trim())
  }
  if (data.country !== undefined) {
    updates.push('country = ?')
    params.push((data.country || '').trim())
  }
  if (data.min_weight !== undefined) {
    updates.push('min_weight = ?')
    params.push(Math.max(0, parseFloat(data.min_weight) || 0))
  }
  if (data.max_weight !== undefined) {
    updates.push('max_weight = ?')
    params.push(Math.max(0, parseFloat(data.max_weight) || 9999))
  }
  if (data.margin_type !== undefined) {
    updates.push('margin_type = ?')
    params.push(data.margin_type)
  }
  if (data.margin_value !== undefined) {
    updates.push('margin_value = ?')
    params.push(Math.max(0, parseFloat(data.margin_value) || 0))
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = ?')
    params.push(data.is_active === false || data.is_active === 0 || data.is_active === '0' ? 0 : 1)
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?')
    params.push(data.notes || '')
  }

  if (updates.length > 0) {
    params.push(id)
    await execute(`UPDATE rate_profit_rules SET ${updates.join(', ')} WHERE id = ?`, params)
  }

  const [updated] = await query('SELECT * FROM rate_profit_rules WHERE id = ?', [id])
  return updated
}

/**
 * Delete a profit margin rule
 */
export async function deleteProfitRule(id) {
  await ensureRateProfitRulesTable()
  const numId = parseInt(id, 10)
  await execute('DELETE FROM rate_profit_rules WHERE id = ?', [numId])
  return { success: true, message: 'Rule deleted successfully', deletedId: numId }
}

/**
 * Clear all profit margin rules
 */
export async function clearAllProfitRules() {
  await ensureRateProfitRulesTable()
  await execute('DELETE FROM rate_profit_rules')
  return { success: true, message: 'All profit rules cleared successfully' }
}

/**
 * Calculate profit addition on vendor cost
 * Evaluates:
 * 1. Weight-wise profit rule (if matches vendor and weight bracket)
 * 2. Country-wise profit rule (if matches vendor, destination country and weight bracket)
 */
export async function calculateProfitMargin({
  vendor_code = 'pacific',
  country = '',
  weight = 1,
  base_vendor_cost = 0
}) {
  await ensureRateProfitRulesTable()

  const numCost = Math.max(0, parseFloat(base_vendor_cost) || 0)
  const numWeight = Math.max(0.001, parseFloat(weight) || 1)
  const cleanVendor = String(vendor_code || '').toLowerCase().trim()
  const cleanCountry = String(country || '').toLowerCase().trim()

  let activeRules = []
  try {
    activeRules = await query('SELECT * FROM rate_profit_rules WHERE is_active = 1 ORDER BY id ASC')
  } catch {
    activeRules = []
  }

  const appliedRules = []
  let totalProfitAmount = 0

  for (const rule of activeRules) {
    const ruleVendor = String(rule.vendor_code || 'all').toLowerCase().trim()
    const vendorMatches = ruleVendor === 'all' || ruleVendor === '' || ruleVendor === cleanVendor

    if (!vendorMatches) continue

    const minW = parseFloat(rule.min_weight) || 0
    const maxW = parseFloat(rule.max_weight) || 999999
    const weightMatches = numWeight >= minW && numWeight <= maxW

    if (!weightMatches) continue

    let matches = false
    if (rule.rule_type === 'weight') {
      matches = true
    } else if (rule.rule_type === 'country') {
      const ruleCountry = String(rule.country || '').toLowerCase().trim()
      if (ruleCountry !== '' && cleanCountry !== '') {
        matches = ruleCountry === cleanCountry ||
                  cleanCountry.includes(ruleCountry) ||
                  ruleCountry.includes(cleanCountry)
      }
    }

    if (matches) {
      const marginVal = parseFloat(rule.margin_value) || 0
      let ruleProfit = 0
      if (rule.margin_type === 'percentage') {
        ruleProfit = (numCost * marginVal) / 100
      } else if (rule.margin_type === 'fixed_per_kg') {
        ruleProfit = marginVal * numWeight
      } else {
        // fixed_amount
        ruleProfit = marginVal
      }

      ruleProfit = Math.round(ruleProfit * 100) / 100
      totalProfitAmount += ruleProfit

      appliedRules.push({
        id: rule.id,
        rule_type: rule.rule_type,
        vendor_code: rule.vendor_code,
        country: rule.country,
        margin_type: rule.margin_type,
        margin_value: marginVal,
        profit_amount: ruleProfit,
        label: rule.notes || (rule.rule_type === 'country'
          ? `${rule.country} (+${marginVal}${rule.margin_type === 'percentage' ? '%' : '₹'})`
          : `${minW}-${maxW}kg (+${marginVal}${rule.margin_type === 'percentage' ? '%' : '₹'})`)
      })
    }
  }

  totalProfitAmount = Math.round(totalProfitAmount * 100) / 100
  const finalCustomerRate = Math.round((numCost + totalProfitAmount) * 100) / 100
  const ratePerKg = numWeight > 0 ? Math.round((finalCustomerRate / numWeight) * 100) / 100 : finalCustomerRate

  return {
    base_vendor_cost: numCost,
    profit_margin_amount: totalProfitAmount,
    final_customer_rate: finalCustomerRate,
    rate_per_kg: ratePerKg,
    total_percentage: numCost > 0 ? Math.round((totalProfitAmount / numCost) * 1000) / 10 : 0,
    applied_rules: appliedRules
  }
}

