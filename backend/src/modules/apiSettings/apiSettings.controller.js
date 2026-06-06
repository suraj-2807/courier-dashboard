import supabase from '../../config/supabase.js'
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
    const { data, error } = await supabase
      .from('vendor_api_configs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Mask sensitive credentials before sending to client
    const masked = (data || []).map((config) => ({
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
    const { data, error } = await supabase
      .from('vendor_api_configs')
      .select('id, name, vendor_code, available_services, environment, auth_type')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error

    return res.json({
      success: true,
      vendors: data || []
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

    const { data, error } = await supabase
      .from('vendor_api_configs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    // Mask credentials
    const masked = {
      ...data,
      auth_credentials: undefined,
      has_credentials: !!data.auth_credentials
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

    const { data, error } = await supabase
      .from('vendor_api_configs')
      .insert([configData])
      .select()

    if (error) throw error

    return res.status(201).json({
      success: true,
      config: {
        ...data[0],
        auth_credentials: undefined,
        has_credentials: !!data[0].auth_credentials
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

    const updateData = {
      updated_at: new Date().toISOString()
    }

    // Map simple and advanced fields
    if (body.name !== undefined) updateData.name = body.name
    if (body.vendor_code !== undefined) updateData.vendor_code = body.vendor_code
    if (body.auth_type !== undefined) updateData.auth_type = body.auth_type
    if (body.auth_url !== undefined) updateData.auth_url = body.auth_url
    if (body.auth_payload_template !== undefined) updateData.auth_payload_template = body.auth_payload_template
    if (body.auth_token_path !== undefined) updateData.auth_token_path = body.auth_token_path
    if (body.shipment_api_url !== undefined) updateData.shipment_api_url = body.shipment_api_url
    if (body.shipment_api_method !== undefined) updateData.shipment_api_method = body.shipment_api_method
    if (body.request_template !== undefined) updateData.request_template = body.request_template
    if (body.field_mapping !== undefined) updateData.field_mapping = body.field_mapping
    if (body.headers_template !== undefined) updateData.headers_template = body.headers_template
    if (body.response_tracking_path !== undefined) updateData.response_tracking_path = body.response_tracking_path
    if (body.response_success_path !== undefined) updateData.response_success_path = body.response_success_path
    if (body.response_success_value !== undefined) updateData.response_success_value = body.response_success_value
    if (body.available_services !== undefined) updateData.available_services = body.available_services
    if (body.environment !== undefined) updateData.environment = body.environment
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    // Handle simple form fields → auto-map to api_url / credentials
    if (body.api_url !== undefined) updateData.shipment_api_url = body.api_url

    // Build encrypted credentials from simple fields
    if (body.user_id || body.password || body.customer_code || body.company_code) {
      const credentials = {}
      if (body.user_id) credentials.user_id = body.user_id
      if (body.password) credentials.password = body.password
      if (body.customer_code) credentials.customer_code = body.customer_code
      if (body.company_code) credentials.company_code = body.company_code
      if (body.customer_id) credentials.customer_id = body.customer_id
      updateData.auth_credentials = encrypt(JSON.stringify(credentials))
    }

    // Handle advanced auth_credentials object
    if (body.auth_credentials && typeof body.auth_credentials === 'object') {
      updateData.auth_credentials = encrypt(JSON.stringify(body.auth_credentials))
    }

    const { data, error } = await supabase
      .from('vendor_api_configs')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) throw error

    return res.json({
      success: true,
      config: {
        ...data[0],
        auth_credentials: undefined,
        has_credentials: !!data[0].auth_credentials
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

    const { error } = await supabase
      .from('vendor_api_configs')
      .delete()
      .eq('id', id)

    if (error) throw error

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

    const { data: config, error } = await supabase
      .from('vendor_api_configs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

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
    const { data: config, error: fetchError } = await supabase
      .from('vendor_api_configs')
      .select('auth_credentials')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    // Decrypt existing credentials and merge
    let credentials = {}
    try {
      if (config.auth_credentials) {
        credentials = JSON.parse(decrypt(config.auth_credentials))
      }
    } catch {
      // Start fresh
    }

    if (token) credentials._cached_token = token
    if (customer_id) credentials.customer_id = customer_id
    credentials._token_cached_at = new Date().toISOString()

    const { error } = await supabase
      .from('vendor_api_configs')
      .update({
        auth_credentials: encrypt(JSON.stringify(credentials)),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error

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

    const { data: current, error: fetchError } = await supabase
      .from('vendor_api_configs')
      .select('is_active')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    const { data, error } = await supabase
      .from('vendor_api_configs')
      .update({
        is_active: !current.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()

    if (error) throw error

    return res.json({
      success: true,
      config: data[0]
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

    const { data: config, error } = await supabase
      .from('vendor_api_configs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    const result = await pushToVendorApi(config, sample_data || {})

    // Log the push attempt
    await supabase.from('vendor_api_push_logs').insert([{
      vendor_config_id: id,
      request_url: config.shipment_api_url,
      request_payload: result.requestPayload || {},
      response_status: result.responseStatus,
      response_body: result.responseBody || {},
      tracking_number_received: result.trackingNumber,
      status: result.success ? 'success' : 'failed',
      error_message: result.error || ''
    }])

    // Update last push status
    await supabase.from('vendor_api_configs').update({
      last_push_status: result.success ? 'success' : 'failed',
      last_push_at: new Date().toISOString(),
      last_push_response: result.responseBody || {}
    }).eq('id', id)

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

    const { data, error } = await supabase
      .from('vendor_api_push_logs')
      .select('*')
      .eq('vendor_config_id', id)
      .order('pushed_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return res.json({
      success: true,
      logs: data || []
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
