import * as ratesApiService from '../../services/ratesApi.service.js'
import { query } from '../../config/db.js'
import {
  calculateProfitMargin,
  getAllProfitRules,
  createProfitRule,
  updateProfitRule,
  deleteProfitRule,
  clearAllProfitRules
} from '../../services/rateProfit.service.js'

/**
 * Get all vendors available on the portal with rate API status
 */
export const getVendors = async (req, res) => {
  try {
    const apiVendorsRes = await ratesApiService.getVendors().catch(() => ({ ok: false, vendors: [] }))
    const apiVendors = (apiVendorsRes && apiVendorsRes.vendors) ? apiVendorsRes.vendors : []

    let portalVendors = []
    try {
      const rows = await query(
        `SELECT id, name, vendor_code, available_services, available_vendor_codes, available_product_codes
         FROM vendor_api_configs
         WHERE is_active = TRUE
         ORDER BY name ASC`
      )
      if (rows && rows.length > 0) {
        portalVendors = rows.map(r => ({
          ...r,
          available_services: typeof r.available_services === 'string' ? JSON.parse(r.available_services || '[]') : (r.available_services || [])
        }))
      }
    } catch (dbErr) {
      // DB offline or not configured
    }

    // Merge API vendors with portal vendors
    const vendorMap = new Map()

    // Add API vendors
    apiVendors.forEach(v => {
      const slug = v.slug || v.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      vendorMap.set(slug, {
        id: v.id,
        name: v.name,
        vendor_code: slug,
        slug: slug,
        has_rate_sheet: true,
        is_api_driven: true,
        source: 'Live Rates API',
        active_versions: v.active_versions || 1,
        total_rows: v.total_rows || 0,
        last_upload: v.last_upload || v.updated_at
      })
    })

    // Pacific default if not present
    if (!vendorMap.has('pacific')) {
      vendorMap.set('pacific', {
        name: 'Pacific Express',
        vendor_code: 'pacific',
        slug: 'pacific',
        has_rate_sheet: true,
        is_api_driven: true,
        source: 'Live Rates API'
      })
    }

    // Include portal DB vendors
    portalVendors.forEach(pv => {
      const code = pv.vendor_code || pv.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (vendorMap.has(code)) {
        const existing = vendorMap.get(code)
        vendorMap.set(code, {
          ...pv,
          ...existing,
          name: pv.name || existing.name
        })
      } else {
        vendorMap.set(code, {
          ...pv,
          vendor_code: code,
          has_rate_sheet: code === 'pacific',
          is_api_driven: code === 'pacific',
          source: code === 'pacific' ? 'Live Rates API' : 'Portal'
        })
      }
    })

    const vendors = Array.from(vendorMap.values())
    return res.json({ success: true, ok: true, vendors, count: vendors.length })
  } catch (error) {
    console.error('Error fetching vendors:', error)
    return res.status(500).json({ success: false, ok: false, message: error.message })
  }
}

/**
 * Calculate rate via Live Prince Express Rates API
 */
export const calculateVendorRate = async (req, res) => {
  try {
    const params = { ...(req.body || {}), ...(req.query || {}) }
    const vendor = params.vendor || params.vendor_code || 'pacific'
    const country = params.country || params.receiver_country || ''
    const service_code = params.service_code || params.service || ''
    const weight = params.weight_kg !== undefined ? params.weight_kg : (params.weight || 1)
    const postcode = params.postcode || params.pincode || params.zipcode || params.receiver_pincode || ''
    const state = params.state || params.receiver_state || params.province || ''

    if (!country) {
      return res.status(400).json({
        success: false,
        ok: false,
        message: 'Destination country is required.'
      })
    }

    if (!weight || parseFloat(weight) <= 0) {
      return res.status(400).json({
        success: false,
        ok: false,
        message: 'Valid shipment weight (kg) is required.'
      })
    }

    const result = await ratesApiService.calculateRate({
      vendor,
      country,
      service_code,
      weight: parseFloat(weight),
      postcode,
      state
    })

    if (!result.success && !result.ok) {
      return res.status(422).json(result)
    }

    // Apply profit addition to vendor's base cost according to weight & country rules
    const baseVendorRate = result.vendor_rate !== undefined ? parseFloat(result.vendor_rate) : parseFloat(result.final_rate) || 0
    const profitCalc = await calculateProfitMargin({
      vendor_code: vendor,
      country,
      weight: parseFloat(weight),
      base_vendor_cost: baseVendorRate
    })

    const finalRateWithProfit = profitCalc.final_customer_rate
    const ratePerKgWithProfit = profitCalc.rate_per_kg

    return res.json({
      ...result,
      vendor_rate: finalRateWithProfit, // Populates into shipping_charge on booking form
      final_rate: finalRateWithProfit,
      rate_per_kg: ratePerKgWithProfit, // Populates into rate_per_kg on booking form (finalRateWithProfit / weight)
      base_vendor_cost: baseVendorRate,
      base_rate_per_kg: result.rate_per_kg,
      remote_status: result.remote_status || 'NONE',
      is_remote: !!result.is_remote,
      duty_paid: result.duty_paid || null,
      profit_margin_amount: profitCalc.profit_margin_amount,
      profit_percentage: profitCalc.total_percentage,
      applied_profit_rules: profitCalc.applied_rules
    })
  } catch (error) {
    console.error('Rates API calculation error:', error)
    return res.status(500).json({ success: false, ok: false, message: error.message })
  }
}

/**
 * Get available services for vendor and country
 */
export const getServices = async (req, res) => {
  try {
    const vendor = req.query.vendor || req.params.vendorCode || 'pacific'
    const country = req.query.country || ''
    const data = await ratesApiService.getServices({ vendor, country })
    return res.json(data)
  } catch (error) {
    console.error('Error fetching services:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Get available destination countries for vendor
 */
export const getCountries = async (req, res) => {
  try {
    const vendor = req.query.vendor || req.params.vendorCode || 'pacific'
    const data = await ratesApiService.getCountries({ vendor })
    return res.json(data)
  } catch (error) {
    console.error('Error fetching countries:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Resolve destination postcode to shipping zone and town/city
 */
export const resolveZone = async (req, res) => {
  try {
    const vendor = req.query.vendor || req.params.vendorCode || 'pacific'
    const country = req.query.country || ''
    const postcode = req.query.postcode || req.query.pincode || req.query.zipcode || ''
    const state = req.query.state || req.query.receiver_state || ''

    if (!country || (!postcode && !state)) {
      return res.status(400).json({
        ok: false,
        error: 'Country and either postcode or state parameter are required.'
      })
    }

    const data = await ratesApiService.resolveZone({ vendor, country, postcode, state })
    return res.json(data)
  } catch (error) {
    console.error('Error resolving zone:', error)
    return res.status(500).json({ ok: false, message: error.message })
  }
}

/**
 * Get worksheets & column schema
 */
export const getSheets = async (req, res) => {
  try {
    const vendor = req.query.vendor || req.params.vendorCode || 'pacific'
    const data = await ratesApiService.getWorksheets({ vendor })
    return res.json(data)
  } catch (error) {
    console.error('Error getting worksheets:', error)
    return res.status(500).json({ ok: false, message: error.message })
  }
}

/**
 * Query rate records / tariff table
 */
export const queryRates = async (req, res) => {
  try {
    const data = await ratesApiService.queryRates(req.query)
    return res.json(data)
  } catch (error) {
    console.error('Error querying rates:', error)
    return res.status(500).json({ ok: false, message: error.message })
  }
}

/**
 * Update rate / price record via Rates API
 */
export const updateRate = async (req, res) => {
  try {
    const id = req.params.id || req.query.id || req.body?.id
    const data = req.body || {}
    const result = await ratesApiService.updateRateRecord(id, data)
    return res.json(result)
  } catch (error) {
    console.error('Error updating rate record:', error)
    return res.status(500).json({ ok: false, success: false, message: error.message })
  }
}

/**
 * Live Sandbox Proxy: Execute custom queries from the Live API Console
 */
export const sandboxProxy = async (req, res) => {
  try {
    const { method, url, headers, body } = req.body || {}
    if (!url) {
      return res.status(400).json({ error: 'Endpoint URL is required' })
    }

    const result = await ratesApiService.executeSandboxQuery({
      method: method || 'GET',
      url,
      headers: headers || {},
      body: body || null
    })

    return res.status(result.statusCode || 200).json(result)
  } catch (error) {
    console.error('Sandbox proxy error:', error)
    return res.status(500).json({
      error: error.message,
      statusCode: 500,
      latencyMs: 0
    })
  }
}

/**
 * Backwards compatibility: Get destinations & services for legacy UI autocomplete
 */
export const getDestinations = async (req, res) => {
  try {
    const vendor = req.params.vendorCode || req.query.vendor || 'pacific'
    const [countriesRes, servicesRes] = await Promise.all([
      ratesApiService.getCountries({ vendor }).catch(() => ({ countries: [] })),
      ratesApiService.getServices({ vendor }).catch(() => ({ service_codes: [], services: [] }))
    ])

    return res.json({
      success: true,
      destinations: countriesRes?.countries || [],
      services: servicesRes?.service_codes || (servicesRes?.services || []).map(s => s.service_code) || []
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Backwards compatibility: Sheet Info
 */
export const getVendorSheetInfo = async (req, res) => {
  try {
    const vendor = req.params.vendorCode || 'pacific'
    const [sheetsRes, countriesRes] = await Promise.all([
      ratesApiService.getWorksheets({ vendor }).catch(() => ({ worksheets: [] })),
      ratesApiService.getCountries({ vendor }).catch(() => ({ countries: [] }))
    ])

    return res.json({
      success: true,
      vendor_code: vendor,
      source: 'Live Prince Express Rates API',
      api_driven: true,
      sheets: (sheetsRes?.worksheets || []).map(w => w.sheet_name),
      worksheets: sheetsRes?.worksheets || [],
      destinations: countriesRes?.countries || [],
      destinations_count: countriesRes?.countries?.length || 0
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Backwards compatibility stubs for file downloads / workbook operations
 */
export const downloadVendorSheet = async (req, res) => {
  return res.status(200).json({
    message: 'Rates are now managed dynamically via the Live Prince Express Rates API.',
    api_endpoint: 'https://rates.princeexp.com/api/rates.php?vendor=pacific'
  })
}

export const importVendorRateSheet = async (req, res) => {
  return res.json({
    success: true,
    message: 'Rate calculation is fully live API driven. Rates are synchronized in real-time from rates.princeexp.com'
  })
}

export const getVendorWorkbook = async (req, res) => {
  return res.json({
    success: true,
    message: 'Worksheet editing is deprecated. Rates are fetched live via Rates API.'
  })
}

export const saveVendorWorkbook = async (req, res) => {
  return res.json({
    success: true,
    message: 'Worksheet editing is deprecated. Rates are fetched live via Rates API.'
  })
}

// ═══════════════════════════════════════════════════════════════════════
// PROFIT MARGIN RULES (Weight & Country-wise markup)
// ═══════════════════════════════════════════════════════════════════════

export const getProfitRules = async (req, res) => {
  try {
    const { rule_type } = req.query
    const rules = await getAllProfitRules(rule_type || null)
    return res.json({ success: true, rules, count: rules.length })
  } catch (error) {
    console.error('Error fetching profit rules:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const createProfitRuleHandler = async (req, res) => {
  try {
    const rule = await createProfitRule(req.body || {})
    return res.status(201).json({ success: true, message: 'Profit rule created successfully', rule })
  } catch (error) {
    console.error('Error creating profit rule:', error)
    return res.status(400).json({ success: false, message: error.message })
  }
}

export const updateProfitRuleHandler = async (req, res) => {
  try {
    const { id } = req.params
    const rule = await updateProfitRule(id, req.body || {})
    return res.json({ success: true, message: 'Profit rule updated successfully', rule })
  } catch (error) {
    console.error('Error updating profit rule:', error)
    return res.status(400).json({ success: false, message: error.message })
  }
}

export const deleteProfitRuleHandler = async (req, res) => {
  try {
    const { id } = req.params
    const result = await deleteProfitRule(id)
    return res.json(result)
  } catch (error) {
    console.error('Error deleting profit rule:', error)
    return res.status(400).json({ success: false, message: error.message })
  }
}

export const clearAllProfitRulesHandler = async (req, res) => {
  try {
    const result = await clearAllProfitRules()
    return res.json(result)
  } catch (error) {
    console.error('Error clearing profit rules:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const previewProfit = async (req, res) => {
  try {
    const { vendor_code, country, weight, base_vendor_cost } = req.body || {}
    const result = await calculateProfitMargin({
      vendor_code: vendor_code || 'pacific',
      country: country || '',
      weight: parseFloat(weight) || 1,
      base_vendor_cost: parseFloat(base_vendor_cost) || 0
    })
    return res.json({ success: true, ...result })
  } catch (error) {
    console.error('Error previewing profit:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}
