import GenericAdapter from './GenericAdapter.js'
import FlySwiftAdapter from './FlySwiftAdapter.js'
import PacificAdapter from './PacificAdapter.js'

/**
 * Adapter Registry — resolves the correct courier adapter by vendor_code.
 * 
 * To add a new vendor:
 *   1. Create a new adapter file extending BaseAdapter (e.g., BlueDartAdapter.js)
 *   2. Import it here
 *   3. Add it to the ADAPTERS map with the vendor_code as the key
 * 
 * Any vendor_code not in this map falls back to GenericAdapter (template-driven).
 */
const ADAPTERS = {
  'flyswift': FlySwiftAdapter,
  'trackmate': FlySwiftAdapter,   // Alias — same vendor, different branding
  'pacific': PacificAdapter,
  'pacifc': PacificAdapter,       // Support typo variation as requested
  // 'bluedart': BlueDartAdapter,
  // 'delhivery': DelhiveryAdapter,
}

/**
 * Get the adapter class for a given vendor_code.
 * 
 * @param {string} vendorCode — The vendor_code from vendor_api_configs
 * @returns {typeof import('./BaseAdapter.js').default} Adapter class (not instance)
 */
export function getAdapterClass(vendorCode) {
  const normalized = (vendorCode || '').toLowerCase().trim()
  return ADAPTERS[normalized] || GenericAdapter
}

/**
 * Create an adapter instance for a vendor config.
 * 
 * @param {Object} config — The vendor_api_configs row
 * @returns {import('./BaseAdapter.js').default} Adapter instance
 */
export function createAdapter(config) {
  const AdapterClass = getAdapterClass(config.vendor_code)
  return new AdapterClass(config)
}

/**
 * Get all registered vendor codes and their adapter names.
 * Useful for the admin UI to show which vendors have dedicated support.
 */
export function getRegisteredVendors() {
  const vendors = new Map()
  for (const [code, AdapterClass] of Object.entries(ADAPTERS)) {
    vendors.set(code, AdapterClass.name)
  }
  return Object.fromEntries(vendors)
}
