import { query, execute } from '../../config/db.js'
import { encrypt, decrypt, maskValue } from '../../utils/encryption.js'
import {
  pushToVendorApi,
  authenticateVendor,
  extractFieldPaths,
  INTERNAL_FIELDS
} from '../../services/vendorApiPush.service.js'
import { createAdapter } from '../../courierAdapters/adapterRegistry.js'

/**
 * Get all vendor API configurations
 */
export const getApiSettings = async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM vendor_api_configs ORDER BY created_at DESC'
    )

    // Mask sensitive credentials before sending to client
    const masked = (rows || []).map((config) => ({
      ...config,
      auth_credentials: undefined,
      has_credentials: !!config.auth_credentials
    }))

    return res.json({
      success: true,
      configs: masked
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Get only active vendor configs (for booking dropdown)
 */
export const getActiveVendors = async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, name, vendor_code, available_services, environment, auth_type
       FROM vendor_api_configs
       WHERE is_active = TRUE
       ORDER BY name ASC`
    )

    return res.json({
      success: true,
      vendors: rows || []
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Get a single vendor API configuration by ID
 */
export const getApiSettingById = async (req, res) => {
  try {
    const { id } = req.params

    const rows = await query(
      'SELECT * FROM vendor_api_configs WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API configuration not found'
      })
    }

    // Mask credentials
    const masked = {
      ...rows[0],
      auth_credentials: undefined,
      has_credentials: !!rows[0].auth_credentials
    }

    return res.json({
      success: true,
      config: masked
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Create a new vendor API configuration.
 * 
 * Accepts BOTH the simple form fields (user_id, password, customer_code, etc.)
 * AND the advanced template fields (request_template, field_mapping, etc.)
 * 
 * When simple fields are provided, auto-generates the template structures
 * that the engine needs.
 */
export const createApiSetting = async (req, res) => {
  try {
    const body = req.body

    // Validate required fields
    if (!body.name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      })
    }

    // Build the config object
    const configData = _buildConfigFromBody(body)

    const result = await execute(
      `INSERT INTO vendor_api_configs (
        name, vendor_code, auth_type, auth_url, auth_payload_template,
        auth_credentials, auth_token_path, shipment_api_url, shipment_api_method,
        request_template, field_mapping, headers_template,
        response_tracking_path, response_success_path, response_success_value,
        available_services, environment, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        configData.name,
        configData.vendor_code,
        configData.auth_type,
        configData.auth_url,
        JSON.stringify(configData.auth_payload_template),
        configData.auth_credentials,
        configData.auth_token_path,
        configData.shipment_api_url,
        configData.shipment_api_method,
        JSON.stringify(configData.request_template),
        JSON.stringify(configData.field_mapping),
        JSON.stringify(configData.headers_template),
        configData.response_tracking_path,
        configData.response_success_path,
        configData.response_success_value,
        JSON.stringify(configData.available_services),
        configData.environment,
        configData.is_active
      ]
    )

    const rows = await query(
      'SELECT * FROM vendor_api_configs WHERE id = ?',
      [result.insertId]
    )

    return res.status(201).json({
      success: true,
      config: {
        ...rows[0],
        auth_credentials: undefined,
        has_credentials: !!rows[0].auth_credentials
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Update an existing vendor API configuration
 */
export const updateApiSetting = async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body

    const setClauses = []
    const values = []

    // Map simple and advanced fields
    const directFields = [
      'name', 'vendor_code', 'auth_type', 'auth_url', 'auth_token_path',
      'shipment_api_url', 'shipment_api_method',
      'response_tracking_path', 'response_success_path', 'response_success_value',
      'environment', 'is_active'
    ]

    for (const field of directFields) {
      if (body[field] !== undefined) {
        setClauses.push(`${field} = ?`)
        values.push(body[field])
      }
    }

    // JSON fields
    const jsonFields = [
      'auth_payload_template', 'request_template', 'field_mapping',
      'headers_template', 'available_services'
    ]

    for (const field of jsonFields) {
      if (body[field] !== undefined) {
        setClauses.push(`${field} = ?`)
        values.push(JSON.stringify(body[field]))
      }
    }

    // Handle simple form fields → auto-map to api_url / credentials
    if (body.api_url !== undefined) {
      setClauses.push('shipment_api_url = ?')
      values.push(body.api_url)
    }

    // Build encrypted credentials from simple fields
    if (body.user_id || body.password || body.customer_code || body.company_code) {
      const credentials = {}
      if (body.user_id) credentials.user_id = body.user_id
      if (body.password) credentials.password = body.password
      if (body.customer_code) credentials.customer_code = body.customer_code
      if (body.company_code) credentials.company_code = body.company_code
      if (body.customer_id) credentials.customer_id = body.customer_id
      setClauses.push('auth_credentials = ?')
      values.push(encrypt(JSON.stringify(credentials)))
    }

    // Handle advanced auth_credentials object
    if (body.auth_credentials && typeof body.auth_credentials === 'object') {
      setClauses.push('auth_credentials = ?')
      values.push(encrypt(JSON.stringify(body.auth_credentials)))
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      })
    }

    values.push(id)

    await execute(
      `UPDATE vendor_api_configs SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    )

    const rows = await query(
      'SELECT * FROM vendor_api_configs WHERE id = ?',
      [id]
    )

    return res.json({
      success: true,
      config: {
        ...rows[0],
        auth_credentials: undefined,
        has_credentials: !!rows[0].auth_credentials
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Delete a vendor API configuration
 */
export const deleteApiSetting = async (req, res) => {
  try {
    const { id } = req.params

    await execute(
      'DELETE FROM vendor_api_configs WHERE id = ?',
      [id]
    )

    return res.json({
      success: true,
      message: 'API configuration deleted successfully'
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Test connection to a vendor API (auth check only).
 * Uses the adapter pipeline for consistent testing.
 */
export const testApiConnection = async (req, res) => {
  try {
    const { id } = req.params

    const rows = await query(
      'SELECT * FROM vendor_api_configs WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API configuration not found'
      })
    }

    const config = rows[0]
    const startTime = Date.now()

    try {
      if (config.auth_type === 'token') {
        // Test token-based auth using adapter
        const adapter = createAdapter(config)
        const authContext = await adapter.authenticate()
        const latency = Date.now() - startTime

        return res.json({
          success: true,
          connection: {
            reachable: true,
            auth_type: 'token',
            latency_ms: latency,
            message: 'Token authentication successful',
            token_preview: authContext?.token ? `${authContext.token.substring(0, 12)}...` : '',
            customer_id: authContext?.customerId || '',
            auth_context: {
              has_token: !!authContext?.token,
              has_customer_id: !!authContext?.customerId
            }
          }
        })
      } else {
        // For inline/api_key — just ping the shipment URL
        const apiUrl = config.shipment_api_url || config.api_url
        const response = await fetch(apiUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10000)
        }).catch(() => null)

        const finalResponse = response || await fetch(apiUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(10000)
        }).catch(() => null)

        const latency = Date.now() - startTime

        return res.json({
          success: true,
          connection: {
            reachable: !!finalResponse,
            auth_type: config.auth_type,
            status_code: finalResponse?.status || 0,
            latency_ms: latency,
            message: finalResponse
              ? `Endpoint reachable (HTTP ${finalResponse.status})`
              : 'Could not reach the API endpoint'
          }
        })
      }
    } catch (fetchError) {
      const latency = Date.now() - startTime
      return res.json({
        success: true,
        connection: {
          reachable: false,
          latency_ms: latency,
          message: fetchError.message || 'Could not reach the API endpoint'
        }
      })
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Save auth token and customer_id after a successful test connection.
 * This persists the tokens so they can be reused without re-authenticating.
 */
export const saveAuthToken = async (req, res) => {
  try {
    const { id } = req.params
    const { token, customer_id } = req.body

    // Fetch existing config to merge credentials
    const rows = await query(
      'SELECT auth_credentials FROM vendor_api_configs WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API configuration not found'
      })
    }

    // Decrypt existing credentials and merge
    let credentials = {}
    try {
      if (rows[0].auth_credentials) {
        credentials = JSON.parse(decrypt(rows[0].auth_credentials))
      }
    } catch {
      // Start fresh
    }

    if (token) credentials._cached_token = token
    if (customer_id) credentials.customer_id = customer_id
    credentials._token_cached_at = new Date().toISOString()

    await execute(
      'UPDATE vendor_api_configs SET auth_credentials = ? WHERE id = ?',
      [encrypt(JSON.stringify(credentials)), id]
    )

    return res.json({
      success: true,
      message: 'Auth token and customer ID saved successfully'
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Toggle active status of a vendor API configuration
 */
export const toggleApiSetting = async (req, res) => {
  try {
    const { id } = req.params

    const rows = await query(
      'SELECT is_active FROM vendor_api_configs WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API configuration not found'
      })
    }

    const newStatus = !rows[0].is_active

    await execute(
      'UPDATE vendor_api_configs SET is_active = ? WHERE id = ?',
      [newStatus, id]
    )

    const updatedRows = await query(
      'SELECT * FROM vendor_api_configs WHERE id = ?',
      [id]
    )

    return res.json({
      success: true,
      config: updatedRows[0]
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Push test — send sample shipment data to a vendor API
 */
export const pushTestData = async (req, res) => {
  try {
    const { id } = req.params
    const { sample_data } = req.body

    const rows = await query(
      'SELECT * FROM vendor_api_configs WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API configuration not found'
      })
    }

    const config = rows[0]
    const result = await pushToVendorApi(config, sample_data || {})

    // Log the push attempt
    await execute(
      `INSERT INTO vendor_api_push_logs 
       (vendor_config_id, request_url, request_payload, response_status, response_body, tracking_number_received, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        config.shipment_api_url,
        JSON.stringify(result.requestPayload || {}),
        result.responseStatus || 0,
        JSON.stringify(result.responseBody || {}),
        result.trackingNumber || '',
        result.success ? 'success' : 'failed',
        result.error || ''
      ]
    )

    // Update last push status
    await execute(
      `UPDATE vendor_api_configs 
       SET last_push_status = ?, last_push_at = NOW(), last_push_response = ?
       WHERE id = ?`,
      [
        result.success ? 'success' : 'failed',
        JSON.stringify(result.responseBody || {}),
        id
      ]
    )

    return res.json({
      success: true,
      push_result: result
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Get push logs for a vendor config
 */
export const getPushLogs = async (req, res) => {
  try {
    const { id } = req.params

    const rows = await query(
      `SELECT * FROM vendor_api_push_logs
       WHERE vendor_config_id = ?
       ORDER BY pushed_at DESC
       LIMIT 50`,
      [id]
    )

    return res.json({
      success: true,
      logs: rows || []
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Get available internal fields for mapping
 */
export const getInternalFields = async (req, res) => {
  return res.json({
    success: true,
    fields: INTERNAL_FIELDS
  })
}

/**
 * Extract field paths from a given JSON template
 */
export const extractTemplatePaths = async (req, res) => {
  try {
    const { template } = req.body

    if (!template || typeof template !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'A valid JSON template object is required'
      })
    }

    const paths = extractFieldPaths(template)

    return res.json({
      success: true,
      paths
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}


// ─── Private Helpers ───

/**
 * Build a vendor_api_configs row from the request body.
 * Handles both simple (user_id/password) and advanced (templates) form data.
 */
function _buildConfigFromBody(body) {
  // Build encrypted credentials
  let encryptedCredentials = ''
  if (body.auth_credentials && typeof body.auth_credentials === 'object') {
    encryptedCredentials = encrypt(JSON.stringify(body.auth_credentials))
  } else if (body.user_id || body.password || body.customer_code || body.company_code) {
    // Simple form fields → build credentials object
    const credentials = {}
    if (body.user_id) credentials.user_id = body.user_id
    if (body.username) credentials.username = body.username
    if (body.password) credentials.password = body.password
    if (body.customer_code) credentials.customer_code = body.customer_code
    if (body.company_code) credentials.company_code = body.company_code
    if (body.customer_id) credentials.customer_id = body.customer_id
    encryptedCredentials = encrypt(JSON.stringify(credentials))
  }

  // Determine shipment API URL
  const shipmentApiUrl = body.shipment_api_url || body.api_url || ''

  // Build auth_payload_template from simple fields if needed
  let authPayloadTemplate = body.auth_payload_template || {}
  if (body.auth_type === 'token' && Object.keys(authPayloadTemplate).length === 0) {
    // Auto-generate based on common patterns
    authPayloadTemplate = {
      username: '',
      password: ''
    }
  }

  return {
    name: body.name,
    vendor_code: body.vendor_code || '',
    auth_type: body.auth_type || 'inline',
    auth_url: body.auth_url || '',
    auth_payload_template: authPayloadTemplate,
    auth_credentials: encryptedCredentials,
    auth_token_path: body.auth_token_path || 'data.token',
    shipment_api_url: shipmentApiUrl,
    shipment_api_method: body.shipment_api_method || 'POST',
    request_template: body.request_template || {},
    field_mapping: body.field_mapping || {},
    headers_template: body.headers_template || {},
    response_tracking_path: body.response_tracking_path || '',
    response_success_path: body.response_success_path || '',
    response_success_value: body.response_success_value || '',
    available_services: body.available_services || [],
    environment: body.environment || 'production',
    is_active: body.is_active !== undefined ? body.is_active : true
  }
}
