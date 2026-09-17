/**
 * Rate Diff Service
 * 
 * Compares a new/draft vendor rate version against the currently active version.
 * Detects: new destinations, removed destinations, changed rates, changed transit times,
 * changed zones, changed remote area info.
 */
import { query } from '../../../config/db.js'

// ═══════════════════════════════════════════════════════════════
// COMPARE TWO VERSIONS
// ═══════════════════════════════════════════════════════════════
export async function compareVersions(vendorCode, newVersionId, activeVersionId) {
  if (!activeVersionId) {
    return {
      has_active: false,
      message: 'No active version to compare against. This will be the first active version.',
      summary: { new_destinations: 0, removed_destinations: 0, changed_rates: 0, changed_transit: 0, unchanged: 0 },
      changes: []
    }
  }

  // Fetch rates for both versions
  const [newRates, activeRates] = await Promise.all([
    query(
      `SELECT vr.*, 
         GROUP_CONCAT(
           CONCAT(vrs.min_weight, '|', COALESCE(vrs.max_weight, 'NULL'), '|', vrs.rate_per_kg)
           ORDER BY vrs.min_weight ASC SEPARATOR ';;'
         ) as slabs_raw
       FROM vendor_rates vr
       LEFT JOIN vendor_rate_slabs vrs ON vrs.rate_id = vr.id
       WHERE vr.version_id = ?
       GROUP BY vr.id
       ORDER BY vr.destination_country, vr.service_code`,
      [newVersionId]
    ),
    query(
      `SELECT vr.*, 
         GROUP_CONCAT(
           CONCAT(vrs.min_weight, '|', COALESCE(vrs.max_weight, 'NULL'), '|', vrs.rate_per_kg)
           ORDER BY vrs.min_weight ASC SEPARATOR ';;'
         ) as slabs_raw
       FROM vendor_rates vr
       LEFT JOIN vendor_rate_slabs vrs ON vrs.rate_id = vr.id
       WHERE vr.version_id = ?
       GROUP BY vr.id
       ORDER BY vr.destination_country, vr.service_code`,
      [activeVersionId]
    )
  ])

  // Build lookup maps keyed by destination+service_code
  const activeMap = new Map()
  for (const r of activeRates) {
    const key = `${r.destination_country}|${r.service_code}`.toUpperCase()
    activeMap.set(key, r)
  }

  const newMap = new Map()
  for (const r of newRates) {
    const key = `${r.destination_country}|${r.service_code}`.toUpperCase()
    newMap.set(key, r)
  }

  const changes = []
  let newDestinations = 0
  let removedDestinations = 0
  let changedRates = 0
  let changedTransit = 0
  let unchanged = 0

  // Compare new rates against active
  for (const [key, newRate] of newMap) {
    const activeRate = activeMap.get(key)
    
    if (!activeRate) {
      // New destination
      newDestinations++
      changes.push({
        type: 'added',
        destination: newRate.destination_country,
        service_code: newRate.service_code,
        new_base_500g: parseFloat(newRate.base_500g),
        new_addl_500g: parseFloat(newRate.addl_500g),
        new_transit_time: newRate.transit_time
      })
      continue
    }

    // Compare rates
    const base500gChanged = parseFloat(newRate.base_500g) !== parseFloat(activeRate.base_500g)
    const addl500gChanged = parseFloat(newRate.addl_500g) !== parseFloat(activeRate.addl_500g)
    const transitChanged = newRate.transit_time !== activeRate.transit_time
    const slabsChanged = (newRate.slabs_raw || '') !== (activeRate.slabs_raw || '')

    if (base500gChanged || addl500gChanged || slabsChanged) {
      changedRates++
      changes.push({
        type: 'rate_changed',
        destination: newRate.destination_country,
        service_code: newRate.service_code,
        old_base_500g: parseFloat(activeRate.base_500g),
        new_base_500g: parseFloat(newRate.base_500g),
        old_addl_500g: parseFloat(activeRate.addl_500g),
        new_addl_500g: parseFloat(newRate.addl_500g),
        base_500g_diff: parseFloat(newRate.base_500g) - parseFloat(activeRate.base_500g),
        slabs_changed: slabsChanged,
        transit_changed: transitChanged,
        old_transit_time: activeRate.transit_time,
        new_transit_time: newRate.transit_time
      })
    } else if (transitChanged) {
      changedTransit++
      changes.push({
        type: 'transit_changed',
        destination: newRate.destination_country,
        service_code: newRate.service_code,
        old_transit_time: activeRate.transit_time,
        new_transit_time: newRate.transit_time
      })
    } else {
      unchanged++
    }
  }

  // Check for removed destinations
  for (const [key, activeRate] of activeMap) {
    if (!newMap.has(key)) {
      removedDestinations++
      changes.push({
        type: 'removed',
        destination: activeRate.destination_country,
        service_code: activeRate.service_code,
        old_base_500g: parseFloat(activeRate.base_500g),
        old_addl_500g: parseFloat(activeRate.addl_500g),
        old_transit_time: activeRate.transit_time
      })
    }
  }

  // Zone changes
  const [newZoneCounts, activeZoneCounts] = await Promise.all([
    query('SELECT country_code, COUNT(*) as cnt FROM vendor_postcode_zones WHERE version_id = ? GROUP BY country_code', [newVersionId]),
    query('SELECT country_code, COUNT(*) as cnt FROM vendor_postcode_zones WHERE version_id = ? GROUP BY country_code', [activeVersionId])
  ])

  const zoneSummary = {}
  const activeZoneMap = new Map(activeZoneCounts.map(z => [z.country_code, z.cnt]))
  for (const z of newZoneCounts) {
    const oldCount = activeZoneMap.get(z.country_code) || 0
    zoneSummary[z.country_code] = { new_count: z.cnt, old_count: oldCount, diff: z.cnt - oldCount }
  }

  // Remote area changes
  const [newRemoteCnt, activeRemoteCnt] = await Promise.all([
    query('SELECT COUNT(*) as cnt FROM vendor_remote_areas WHERE version_id = ?', [newVersionId]),
    query('SELECT COUNT(*) as cnt FROM vendor_remote_areas WHERE version_id = ?', [activeVersionId])
  ])

  return {
    has_active: true,
    summary: {
      new_destinations: newDestinations,
      removed_destinations: removedDestinations,
      changed_rates: changedRates,
      changed_transit: changedTransit,
      unchanged,
      total_new: newRates.length,
      total_active: activeRates.length
    },
    zone_summary: zoneSummary,
    remote_area_summary: {
      new_count: newRemoteCnt[0]?.cnt || 0,
      old_count: activeRemoteCnt[0]?.cnt || 0
    },
    changes: changes.sort((a, b) => {
      const order = { added: 0, rate_changed: 1, transit_changed: 2, removed: 3 }
      return (order[a.type] ?? 9) - (order[b.type] ?? 9)
    })
  }
}
