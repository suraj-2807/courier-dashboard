/**
 * Vendor Rate Calculation Service
 * 
 * Provides unified rate lookup for vendor rates:
 * Country + Postcode + Weight + Service + Active Version
 * → Zone + Base Rate + Transit Time + Remote Area Flag
 * 
 * Supports the Pacific pricing model:
 * - Up to 0.5kg: base_500g flat rate
 * - 0.5kg to ~5.5kg: base_500g + ceil((W - 0.5) / 0.5) * addl_500g
 * - 6kg+: W * rate_per_kg from matching slab
 */
import { query } from '../../../config/db.js'

// ═══════════════════════════════════════════════════════════════
// GET ACTIVE VERSION for a vendor
// ═══════════════════════════════════════════════════════════════
export async function getActiveVersion(vendorCode) {
  const rows = await query(
    `SELECT * FROM vendor_rate_versions 
     WHERE vendor_code = ? AND status = 'active' 
     LIMIT 1`,
    [vendorCode]
  )
  return rows.length > 0 ? rows[0] : null
}

// ═══════════════════════════════════════════════════════════════
// CALCULATE RATE
// ═══════════════════════════════════════════════════════════════
export async function calculateRate({ vendor_code, country, postcode, weight, service_code }) {
  // 1. Get active version
  const version = await getActiveVersion(vendor_code)
  if (!version) {
    return { success: false, message: `No active rate version found for vendor "${vendor_code}"` }
  }

  // 2. Find matching rate record for destination
  const rateRows = await query(
    `SELECT vr.*, GROUP_CONCAT(
       CONCAT(vrs.min_weight, '|', COALESCE(vrs.max_weight, 'NULL'), '|', vrs.rate_per_kg, '|', vrs.rate_type)
       ORDER BY vrs.min_weight ASC
       SEPARATOR ';;'
     ) as slabs_raw
     FROM vendor_rates vr
     LEFT JOIN vendor_rate_slabs vrs ON vrs.rate_id = vr.id
     WHERE vr.version_id = ?
       AND UPPER(vr.destination_country) = UPPER(?)
       AND (vr.service_code = ? OR vr.service_code = 'SELF' OR ? = '')
     GROUP BY vr.id
     ORDER BY 
       CASE WHEN vr.service_code = ? THEN 0 ELSE 1 END,
       vr.id ASC
     LIMIT 1`,
    [version.id, country, service_code || '', service_code || '', service_code || '']
  )

  if (rateRows.length === 0) {
    return {
      success: false,
      message: `No rate found for country "${country}" with service "${service_code || 'any'}" in active version (v${version.id})`
    }
  }

  const rate = rateRows[0]

  // 3. Parse slabs
  const slabs = parseSlabsRaw(rate.slabs_raw)

  // 4. Calculate price based on weight
  const weightKg = parseFloat(weight)
  if (isNaN(weightKg) || weightKg <= 0) {
    return { success: false, message: `Invalid weight: ${weight}` }
  }

  const priceResult = computePrice(weightKg, rate, slabs)

  // 5. Zone lookup (if postcode provided)
  let zoneInfo = null
  if (postcode) {
    zoneInfo = await lookupZone(version.id, postcode, country)
  }

  // 6. Remote area check
  const remoteInfo = await checkRemoteArea(version.id, postcode, country)

  return {
    success: true,
    vendor_code,
    version_id: version.id,
    version_name: version.version_name,
    destination: rate.destination_country,
    service_code: rate.service_code,
    service_name: rate.service_name,
    transit_time: rate.transit_time,
    weight_kg: weightKg,
    chargeable_weight: priceResult.chargeable_weight,
    base_rate: priceResult.base_rate,
    currency: 'INR',
    pricing_method: priceResult.method,
    breakup: priceResult.breakup,
    zone: zoneInfo?.zone || null,
    zone_details: zoneInfo,
    is_remote: remoteInfo.is_remote,
    remote_details: remoteInfo
  }
}

// ═══════════════════════════════════════════════════════════════
// PRICE COMPUTATION — Pacific pricing model
// ═══════════════════════════════════════════════════════════════
function computePrice(weightKg, rate, slabs) {
  const base500g = parseFloat(rate.base_500g) || 0
  const addl500g = parseFloat(rate.addl_500g) || 0

  // Case 1: Weight <= 0.5 kg
  if (weightKg <= 0.5) {
    return {
      base_rate: base500g,
      chargeable_weight: 0.5,
      method: 'base_500g',
      breakup: { base_500g: base500g }
    }
  }

  // Case 2: Weight > 0.5 kg but below first slab threshold
  // Find the lowest slab min_weight to determine threshold
  const firstSlabMin = slabs.length > 0 ? slabs[0].min_weight : Infinity
  
  if (weightKg < firstSlabMin) {
    // Use addl_500g incremental pricing
    const additionalUnits = Math.ceil((weightKg - 0.5) / 0.5)
    const totalRate = base500g + (additionalUnits * addl500g)
    const chargeableWeight = 0.5 + (additionalUnits * 0.5)
    
    return {
      base_rate: totalRate,
      chargeable_weight: chargeableWeight,
      method: 'addl_500g',
      breakup: {
        base_500g: base500g,
        additional_units: additionalUnits,
        addl_500g_rate: addl500g,
        additional_charge: additionalUnits * addl500g
      }
    }
  }

  // Case 3: Weight falls into a slab (per-kg pricing)
  const matchingSlab = slabs.find(s => {
    if (s.max_weight === null) return weightKg >= s.min_weight
    return weightKg >= s.min_weight && weightKg <= s.max_weight
  })

  if (matchingSlab) {
    // Round up weight to next 0.5kg for chargeable weight
    const chargeableWeight = Math.ceil(weightKg * 2) / 2
    const totalRate = chargeableWeight * matchingSlab.rate_per_kg

    return {
      base_rate: totalRate,
      chargeable_weight: chargeableWeight,
      method: 'per_kg_slab',
      breakup: {
        slab: `${matchingSlab.min_weight}kg - ${matchingSlab.max_weight === null ? '∞' : matchingSlab.max_weight + 'kg'}`,
        rate_per_kg: matchingSlab.rate_per_kg,
        chargeable_weight: chargeableWeight
      }
    }
  }

  // Fallback: use addl_500g if no slab matches
  const additionalUnits = Math.ceil((weightKg - 0.5) / 0.5)
  const totalRate = base500g + (additionalUnits * addl500g)
  
  return {
    base_rate: totalRate,
    chargeable_weight: Math.ceil(weightKg * 2) / 2,
    method: 'addl_500g_fallback',
    breakup: {
      base_500g: base500g,
      additional_units: additionalUnits,
      addl_500g_rate: addl500g,
      additional_charge: additionalUnits * addl500g
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ZONE LOOKUP — 3-tier: exact match → prefix match → range match
// ═══════════════════════════════════════════════════════════════
async function lookupZone(versionId, postcode, country) {
  const cleanPostcode = String(postcode).trim().toUpperCase().replace(/\s+/g, '')
  
  // Determine country code from country name
  const countryCode = getCountryCode(country)
  if (!countryCode) return null

  // Tier 1: Exact match
  let rows = await query(
    `SELECT * FROM vendor_postcode_zones 
     WHERE version_id = ? AND country_code = ? AND UPPER(REPLACE(postcode, ' ', '')) = ?
     LIMIT 1`,
    [versionId, countryCode, cleanPostcode]
  )
  if (rows.length > 0) return rows[0]

  // Tier 2: Prefix match (progressively shorter prefixes)
  for (let len = Math.min(cleanPostcode.length, 6); len >= 2; len--) {
    const prefix = cleanPostcode.substring(0, len)
    rows = await query(
      `SELECT * FROM vendor_postcode_zones 
       WHERE version_id = ? AND country_code = ? AND UPPER(postcode_prefix) = ?
       LIMIT 1`,
      [versionId, countryCode, prefix]
    )
    if (rows.length > 0) return rows[0]
  }

  // Tier 3: Range match — for postcodes stored as "1000-1999" style ranges
  // Requires a special query for numeric postcode ranges
  if (/^\d+$/.test(cleanPostcode)) {
    const numPostcode = parseInt(cleanPostcode, 10)
    rows = await query(
      `SELECT * FROM vendor_postcode_zones 
       WHERE version_id = ? AND country_code = ? 
         AND postcode LIKE '%-%'
         AND CAST(SUBSTRING_INDEX(postcode, '-', 1) AS UNSIGNED) <= ?
         AND CAST(SUBSTRING_INDEX(postcode, '-', -1) AS UNSIGNED) >= ?
       LIMIT 1`,
      [versionId, countryCode, numPostcode, numPostcode]
    )
    if (rows.length > 0) return rows[0]
  }

  return null
}

// ═══════════════════════════════════════════════════════════════
// REMOTE AREA CHECK
// ═══════════════════════════════════════════════════════════════
async function checkRemoteArea(versionId, postcode, country) {
  if (!postcode) return { is_remote: false }

  const cleanPostcode = String(postcode).trim().toUpperCase().replace(/\s+/g, '')

  // Check vendor_remote_areas table
  // 1. Exact postcode match
  let rows = await query(
    `SELECT * FROM vendor_remote_areas 
     WHERE version_id = ? AND UPPER(REPLACE(postcode_exact, ' ', '')) = ?
     LIMIT 1`,
    [versionId, cleanPostcode]
  )
  if (rows.length > 0) {
    return { is_remote: true, source: 'remote_areas_exact', details: rows[0] }
  }

  // 2. Range match
  if (/^\d+$/.test(cleanPostcode)) {
    const numPostcode = parseInt(cleanPostcode, 10)
    rows = await query(
      `SELECT * FROM vendor_remote_areas 
       WHERE version_id = ? 
         AND postcode_from != '' AND postcode_to != ''
         AND CAST(postcode_from AS UNSIGNED) <= ?
         AND CAST(postcode_to AS UNSIGNED) >= ?
       LIMIT 1`,
      [versionId, numPostcode, numPostcode]
    )
    if (rows.length > 0) {
      return { is_remote: true, source: 'remote_areas_range', details: rows[0] }
    }
  }

  // 3. Check vendor_postcode_zones for is_remote flag
  const countryCode = getCountryCode(country)
  if (countryCode) {
    rows = await query(
      `SELECT * FROM vendor_postcode_zones 
       WHERE version_id = ? AND country_code = ? AND is_remote = TRUE
         AND (UPPER(REPLACE(postcode, ' ', '')) = ? OR UPPER(postcode_prefix) = ?)
       LIMIT 1`,
      [versionId, countryCode, cleanPostcode, cleanPostcode.substring(0, 3)]
    )
    if (rows.length > 0) {
      return { is_remote: true, source: 'postcode_zones', details: rows[0] }
    }
  }

  return { is_remote: false }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function parseSlabsRaw(slabsRaw) {
  if (!slabsRaw) return []
  return slabsRaw.split(';;').map(s => {
    const [min, max, ratePerKg, rateType] = s.split('|')
    return {
      min_weight: parseFloat(min),
      max_weight: max === 'NULL' ? null : parseFloat(max),
      rate_per_kg: parseFloat(ratePerKg),
      rate_type: rateType
    }
  }).filter(s => !isNaN(s.min_weight) && !isNaN(s.rate_per_kg))
}

function getCountryCode(country) {
  if (!country) return null
  const upper = country.toUpperCase().trim()
  
  const map = {
    'CANADA': 'CA',
    'AUSTRALIA': 'AU',
    'NEW ZEALAND': 'NZ',
    'SCOTLAND': 'GB-SCT',
    'UNITED KINGDOM': 'GB',
    'UK': 'GB'
  }

  // Direct match
  if (map[upper]) return map[upper]

  // Check if the input already is a country code
  if (/^[A-Z]{2,6}$/.test(upper)) return upper

  return null
}
