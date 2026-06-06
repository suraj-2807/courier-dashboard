/**
 * BaseAdapter — Abstract base class for all courier vendor adapters.
 * 
 * Every vendor adapter must extend this class and implement the required methods.
 * The adapter pattern allows vendor-specific logic (auth flows, payload structures,
 * response parsing) to be encapsulated without changing the core shipment push pipeline.
 */
export default class BaseAdapter {
  /**
   * @param {Object} config — The vendor_api_configs row from the database
   */
  constructor(config) {
    this.config = config
  }

  /**
   * Authenticate with the vendor API.
   * Returns an auth context object that downstream methods can use.
   * 
   * @returns {Promise<Object>} Auth context — e.g., { token, customerId, ... }
   *   Return {} or null if no auth is needed.
   */
  async authenticate() {
    throw new Error('authenticate() must be implemented by adapter subclass')
  }

  /**
   * Build the request payload for shipment creation.
   * 
   * @param {Object} shipmentData — Flat object of internal shipment fields
   * @param {Object} authContext — Object returned by authenticate()
   * @returns {Object} The vendor-specific request payload
   */
  buildPayload(shipmentData, authContext) {
    throw new Error('buildPayload() must be implemented by adapter subclass')
  }

  /**
   * Build HTTP headers for the shipment API request.
   * 
   * @param {Object} authContext — Object returned by authenticate()
   * @returns {Object} Headers object
   */
  buildHeaders(authContext) {
    return { 'Content-Type': 'application/json' }
  }

  /**
   * Parse the vendor's response to extract AWB, tracking URL, label URL, etc.
   * 
   * @param {Object} responseBody — Parsed JSON response from vendor
   * @returns {Object} { success, awbNumber, trackingUrl, labelUrl, errorMessage }
   */
  parseResponse(responseBody) {
    throw new Error('parseResponse() must be implemented by adapter subclass')
  }

  /**
   * Get available service codes for this vendor.
   * Default implementation returns the config's available_services.
   * Override for vendors that fetch services dynamically.
   * 
   * @returns {Promise<Array>} Array of { code, label } objects
   */
  async getServiceCodes() {
    return this.config.available_services || []
  }

  /**
   * Get the shipment API URL. Can be overridden for vendors
   * that construct URLs dynamically.
   * 
   * @returns {string}
   */
  getShipmentUrl() {
    return this.config.shipment_api_url
  }

  /**
   * Get the HTTP method for shipment creation.
   * 
   * @returns {string}
   */
  getHttpMethod() {
    return this.config.shipment_api_method || 'POST'
  }
}
