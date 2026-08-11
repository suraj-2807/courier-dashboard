import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Settings,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Zap,
  Shield,
  Eye,
  EyeOff,
  X,
  Pencil,
  Globe,
  Activity,
  Send,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Webhook,
  Code2,
  Server,
  ChevronRight,
  AlertCircle,
  Key,
  Save,
  FileText,
  ChevronDown
} from 'lucide-react'
import {
  getApiSettings,
  createApiSetting,
  updateApiSetting,
  deleteApiSetting,
  testApiConnection,
  toggleApiSetting,
  saveAuthToken,
  getPushLogs,
  getInternalFields,
  extractTemplatePaths
} from '../api/apiSettings.api'

const AUTH_TYPES = [
  { value: 'token', label: 'Token (Bearer)', desc: 'Separate auth endpoint → get token → use in headers' },
  { value: 'inline', label: 'Inline (Payload)', desc: 'Credentials sent directly in the request payload' },
  { value: 'api_key', label: 'API Key (Header)', desc: 'API key sent as a custom header' }
]

function safeArray(val) {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim() !== '') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }
  return []
}

function safeNullableArray(val) {
  if (val === null || val === undefined) return null
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim() !== '') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }
  return null
}

function safeObject(val) {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim() !== '') {
    try {
      const parsed = JSON.parse(val)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {}
  }
  return {}
}

const EMPTY_FORM = {
  name: '',
  vendor_code: '',
  auth_type: 'token',
  auth_url: '',
  auth_token_path: 'data.token',
  shipment_api_url: '',
  shipment_api_method: 'POST',
  // Simple credential fields
  user_id: '',
  username: '',
  password: '',
  customer_code: '',
  company_code: '',
  customer_id: '',
  // Response parsing
  response_tracking_path: '',
  response_success_path: '',
  response_success_value: '',
  available_services: [],
  available_vendor_codes: [],
  available_product_codes: [],
  required_fields: null,
  product_code_restrictions: null,
  // Settings
  environment: 'production',
  is_active: true,
  // Templates & Mappings
  request_template: {},
  field_mapping: {},
  headers_template: {}
}

const EMPTY_SERVICE = { code: '', label: '' }
const EMPTY_CODE_ENTRY = { code: '', label: '' }
const EMPTY_RESTRICTION = { code: '', label: '', countries: '', min_weight: '', max_weight: '', package_types: '' }

// All configurable form sections for required_fields
const ALL_FORM_SECTIONS = [
  { key: 'vendor_code', label: 'Vendor Code' },
  { key: 'product_code', label: 'Product Code' },
  { key: 'service_code', label: 'Service Code' },
  { key: 'invoice', label: 'Invoice & Export Details' },
  { key: 'eawb', label: 'eAWB Details' },
  { key: 'additional_charges', label: 'Additional Charges' },
  { key: 'buyer_details', label: 'Buyer Details' },
  { key: 'gst_manifest', label: 'GST & Manifest' },
  { key: 'advanced_config', label: 'Advanced Configuration' }
]

export default function ApiSettingsPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [testingId, setTestingId] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [newService, setNewService] = useState(EMPTY_SERVICE)
  const [newVendorCode, setNewVendorCode] = useState(EMPTY_CODE_ENTRY)
  const [newProductCode, setNewProductCode] = useState(EMPTY_CODE_ENTRY)
  const [newRestriction, setNewRestriction] = useState(EMPTY_RESTRICTION)
  const [expandedLogs, setExpandedLogs] = useState(null)
  const [logsData, setLogsData] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('vendors')
  const [requestTemplateStr, setRequestTemplateStr] = useState('')
  const [headersTemplateStr, setHeadersTemplateStr] = useState('')
  const [modalTab, setModalTab] = useState('connection')

  // Fetch internal fields for mapping
  const { data: fieldsData } = useQuery({
    queryKey: ['internal-fields'],
    queryFn: getInternalFields
  })
  const internalFields = fieldsData?.fields || []

  // Fetch configs
  const { data, isLoading } = useQuery({
    queryKey: ['api-settings'],
    queryFn: getApiSettings
  })

  const configs = data?.configs || []

  // Mutations
  const createMutation = useMutation({
    mutationFn: createApiSetting,
    onSuccess: () => {
      toast.success('Vendor API added successfully')
      queryClient.invalidateQueries({ queryKey: ['api-settings'] })
      closeModal()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateApiSetting(id, data),
    onSuccess: () => {
      toast.success('Vendor API updated successfully')
      queryClient.invalidateQueries({ queryKey: ['api-settings'] })
      closeModal()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update')
  })

  const deleteMutation = useMutation({
    mutationFn: deleteApiSetting,
    onSuccess: () => {
      toast.success('Vendor API deleted')
      queryClient.invalidateQueries({ queryKey: ['api-settings'] })
      setDeleteConfirm(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete')
  })

  const toggleMutation = useMutation({
    mutationFn: toggleApiSetting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-settings'] })
    }
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setRequestTemplateStr('')
    setHeadersTemplateStr('')
    setModalTab('connection')
    setShowPassword(false)
    setNewService(EMPTY_SERVICE)
    setNewVendorCode(EMPTY_CODE_ENTRY)
    setNewProductCode(EMPTY_CODE_ENTRY)
  }

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setRequestTemplateStr('{\n  \n}')
    setHeadersTemplateStr('{\n  "Content-Type": "application/json"\n}')
    setModalTab('connection')
    setEditingId(null)
    setShowModal(true)
  }

  const openEdit = (config) => {
    setForm({
      name: config.name || '',
      vendor_code: config.vendor_code || '',
      auth_type: config.auth_type || 'inline',
      auth_url: config.auth_url || '',
      auth_token_path: config.auth_token_path || 'data.token',
      shipment_api_url: config.shipment_api_url || '',
      shipment_api_method: config.shipment_api_method || 'POST',
      user_id: '',
      username: '',
      password: '',
      customer_code: '',
      company_code: '',
      customer_id: '',
      response_tracking_path: config.response_tracking_path || '',
      response_success_path: config.response_success_path || '',
      response_success_value: config.response_success_value || '',
      available_services: safeArray(config.available_services),
      available_vendor_codes: safeArray(config.available_vendor_codes),
      available_product_codes: safeArray(config.available_product_codes),
      required_fields: safeNullableArray(config.required_fields),
      product_code_restrictions: safeNullableArray(config.product_code_restrictions),
      environment: config.environment || 'production',
      is_active: config.is_active,
      field_mapping: safeObject(config.field_mapping)
    })
    setRequestTemplateStr(JSON.stringify(safeObject(config.request_template), null, 2))
    setHeadersTemplateStr(JSON.stringify(safeObject(config.headers_template) || { "Content-Type": "application/json" }, null, 2))
    setModalTab('connection')
    setEditingId(config.id)
    setShowModal(true)
  }

  const handleParseTemplate = async () => {
    let parsed
    try {
      parsed = JSON.parse(requestTemplateStr)
    } catch (e) {
      toast.error('Invalid JSON in Request Template: ' + e.message)
      return
    }

    const toastId = toast.loading('Extracting field paths...')
    try {
      const response = await extractTemplatePaths(parsed)
      if (response.success && Array.isArray(response.paths)) {
        toast.success(`Successfully parsed ${response.paths.length} field paths!`, { id: toastId })
        const newMapping = { ...form.field_mapping }
        for (const path of response.paths) {
          if (!newMapping[path]) {
            newMapping[path] = { type: 'ignore', source: '', value: '', transform: '' }
          }
        }
        setForm(prev => ({
          ...prev,
          field_mapping: newMapping
        }))
      } else {
        toast.error('Failed to parse field paths', { id: toastId })
      }
    } catch (err) {
      toast.error(err.message || 'Error parsing template', { id: toastId })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    let request_template = {}
    let headers_template = {}

    try {
      if (requestTemplateStr.trim()) {
        request_template = JSON.parse(requestTemplateStr)
      }
    } catch (err) {
      toast.error('Request Template must be valid JSON')
      return
    }

    try {
      if (headersTemplateStr.trim()) {
        headers_template = JSON.parse(headersTemplateStr)
      }
    } catch (err) {
      toast.error('Headers Template must be valid JSON')
      return
    }

    const cleanedMapping = {}
    for (const [key, mappingConfig] of Object.entries(form.field_mapping || {})) {
      if (mappingConfig.type && mappingConfig.type !== 'ignore') {
        cleanedMapping[key] = {
          type: mappingConfig.type,
          source: mappingConfig.source || '',
          value: mappingConfig.value || '',
          transform: mappingConfig.transform || ''
        }
      }
    }

    const payload = {
      name: form.name,
      vendor_code: form.vendor_code,
      auth_type: form.auth_type,
      auth_url: form.auth_url,
      auth_token_path: form.auth_token_path,
      shipment_api_url: form.shipment_api_url,
      shipment_api_method: form.shipment_api_method,
      response_tracking_path: form.response_tracking_path,
      response_success_path: form.response_success_path,
      response_success_value: form.response_success_value,
      available_services: form.available_services,
      available_vendor_codes: form.available_vendor_codes,
      available_product_codes: form.available_product_codes,
      required_fields: form.required_fields,
      product_code_restrictions: form.product_code_restrictions,
      environment: form.environment,
      is_active: form.is_active,
      request_template,
      headers_template,
      field_mapping: cleanedMapping
    }

    if (form.user_id || form.username || form.password || form.customer_code || form.company_code || form.customer_id) {
      if (form.user_id) payload.user_id = form.user_id
      if (form.username) payload.username = form.username
      if (form.password) payload.password = form.password
      if (form.customer_code) payload.customer_code = form.customer_code
      if (form.company_code) payload.company_code = form.company_code
      if (form.customer_id) payload.customer_id = form.customer_id
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleTest = async (id) => {
    setTestingId(id)
    setTestResult(null)
    try {
      const result = await testApiConnection(id)
      setTestResult({ id, ...result.connection })
    } catch {
      setTestResult({ id, reachable: false, message: 'Test failed' })
    } finally {
      setTestingId(null)
    }
  }

  const handleSaveToken = async () => {
    if (!testResult?.id) return
    try {
      await saveAuthToken(testResult.id, {
        token: testResult.token_preview || '',
        customer_id: testResult.customer_id || ''
      })
      toast.success('Auth token & customer ID saved!')
    } catch {
      toast.error('Failed to save auth token')
    }
  }

  const handleViewLogs = async (id) => {
    if (expandedLogs === id) {
      setExpandedLogs(null)
      return
    }
    setExpandedLogs(id)
    setLogsLoading(true)
    try {
      const result = await getPushLogs(id)
      setLogsData(result.logs || [])
    } catch {
      setLogsData([])
    } finally {
      setLogsLoading(false)
    }
  }

  const addService = () => {
    if (!newService.code) return
    setForm(prev => ({
      ...prev,
      available_services: [
        ...safeArray(prev.available_services),
        { code: newService.code, label: newService.label || newService.code }
      ]
    }))
    setNewService(EMPTY_SERVICE)
  }

  const removeService = (idx) => {
    setForm(prev => ({
      ...prev,
      available_services: safeArray(prev.available_services).filter((_, i) => i !== idx)
    }))
  }

  const addVendorCode = () => {
    if (!newVendorCode.code) return
    setForm(prev => ({
      ...prev,
      available_vendor_codes: [
        ...safeArray(prev.available_vendor_codes),
        { code: newVendorCode.code, label: newVendorCode.label || newVendorCode.code }
      ]
    }))
    setNewVendorCode(EMPTY_CODE_ENTRY)
  }

  const removeVendorCode = (idx) => {
    setForm(prev => ({
      ...prev,
      available_vendor_codes: safeArray(prev.available_vendor_codes).filter((_, i) => i !== idx)
    }))
  }

  const addProductCode = () => {
    if (!newProductCode.code) return
    setForm(prev => ({
      ...prev,
      available_product_codes: [
        ...safeArray(prev.available_product_codes),
        { code: newProductCode.code, label: newProductCode.label || newProductCode.code }
      ]
    }))
    setNewProductCode(EMPTY_CODE_ENTRY)
  }

  const removeProductCode = (idx) => {
    setForm(prev => ({
      ...prev,
      available_product_codes: safeArray(prev.available_product_codes).filter((_, i) => i !== idx)
    }))
  }

  // Toggle a field in required_fields. If required_fields is null (show all), clicking a field
  // initializes it with all sections except the toggled one. Toggling all ON returns to null.
  const toggleRequiredField = (fieldKey) => {
    setForm(prev => {
      const current = safeNullableArray(prev.required_fields)
      if (current === null) {
        // Currently showing all → turn off this one field
        const allKeys = ALL_FORM_SECTIONS.map(s => s.key)
        return { ...prev, required_fields: allKeys.filter(k => k !== fieldKey) }
      }
      if (current.includes(fieldKey)) {
        // Remove it
        const updated = current.filter(k => k !== fieldKey)
        return { ...prev, required_fields: updated.length === 0 ? [] : updated }
      } else {
        // Add it
        const updated = [...current, fieldKey]
        // If all fields are selected, set to null (show all / backward compat)
        if (updated.length === ALL_FORM_SECTIONS.length) {
          return { ...prev, required_fields: null }
        }
        return { ...prev, required_fields: updated }
      }
    })
  }

  const addRestriction = () => {
    if (!newRestriction.code) return
    const restriction = {
      code: newRestriction.code.toUpperCase(),
      label: newRestriction.label || newRestriction.code.toUpperCase(),
      countries: newRestriction.countries ? newRestriction.countries.split(',').map(c => c.trim().toUpperCase()).filter(Boolean) : ['*'],
      min_weight: newRestriction.min_weight ? parseFloat(newRestriction.min_weight) : undefined,
      max_weight: newRestriction.max_weight ? parseFloat(newRestriction.max_weight) : undefined,
      package_types: newRestriction.package_types ? newRestriction.package_types.split(',').map(t => t.trim().toUpperCase()).filter(Boolean) : undefined
    }
    // Clean undefined values
    Object.keys(restriction).forEach(k => restriction[k] === undefined && delete restriction[k])
    setForm(prev => ({
      ...prev,
      product_code_restrictions: [...safeArray(prev.product_code_restrictions), restriction]
    }))
    setNewRestriction(EMPTY_RESTRICTION)
  }

  const removeRestriction = (idx) => {
    setForm(prev => ({
      ...prev,
      product_code_restrictions: safeArray(prev.product_code_restrictions).filter((_, i) => i !== idx)
    }))
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    })
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px' }}>
              API Integrations
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Manage your vendor API connections, test authentication, and monitor API logs.
            </p>
          </div>
          <button
            onClick={openAdd}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
              border: 'none', borderRadius: '12px',
              fontSize: '13px', fontWeight: 700, color: '#fff',
              cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: 'var(--font-family-body)',
              boxShadow: '0 4px 12px rgba(187, 0, 19, 0.3)'
            }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Add Vendor
          </button>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Vendor API Cards */}
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: '16px',
          border: '1px solid var(--color-border)',
          overflow: 'hidden'
        }}>
          {/* Card Header */}
          <div style={{
            padding: '20px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--color-border-light)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Shield style={{ width: '16px', height: '16px', color: '#fff' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Vendor API Connections
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {configs.length} vendor{configs.length !== 1 ? 's' : ''} configured • {configs.filter(c => c.is_active).length} active
                </p>
              </div>
            </div>
          </div>

          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1.8fr 0.8fr 0.8fr 140px',
            padding: '10px 24px',
            borderBottom: '1px solid var(--color-border-light)',
            background: 'var(--color-surface-alt)'
          }}>
            {['NAME', 'AUTH TYPE', 'SHIPMENT API', 'ENV', 'STATUS', 'ACTIONS'].map((h) => (
              <span key={h} style={{
                fontSize: '10px', fontWeight: 700,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.8px'
              }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {isLoading ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <Loader2 style={{ width: '24px', height: '24px', color: 'var(--color-text-tertiary)', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
              <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', marginTop: '8px' }}>Loading configurations...</p>
            </div>
          ) : configs.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'var(--color-surface-alt)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
              }}>
                <Server style={{ width: '22px', height: '22px', color: 'var(--color-text-tertiary)' }} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>No vendor APIs configured</p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>Click "Add Vendor" to connect your first courier API.</p>
            </div>
          ) : (
            configs.map((config, idx) => (
              <div key={config.id}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr 1.8fr 0.8fr 0.8fr 140px',
                    padding: '16px 24px',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--color-border-light)',
                    transition: 'background 0.15s',
                    cursor: 'default'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Name + vendor code */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{config.name}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px', display: 'block' }}>
                      {config.vendor_code || '—'}
                    </span>
                  </div>

                  {/* Auth Type */}
                  <span style={{
                    fontSize: '11px', fontWeight: 600,
                    padding: '3px 8px', borderRadius: '6px',
                    display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content',
                    background: config.auth_type === 'token' ? '#EDE9FE' : config.auth_type === 'api_key' ? '#E0E7FF' : '#FEF3C7',
                    color: config.auth_type === 'token' ? '#6D28D9' : config.auth_type === 'api_key' ? '#3730A3' : '#92400E'
                  }}>
                    <Key style={{ width: '10px', height: '10px' }} />
                    {config.auth_type === 'token' ? 'Bearer Token' : config.auth_type === 'api_key' ? 'API Key' : 'Inline'}
                  </span>

                  {/* Shipment API URL */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <code style={{
                      fontSize: '11px', color: 'var(--color-text-secondary)',
                      background: 'var(--color-surface-alt)', padding: '4px 8px',
                      borderRadius: '6px', maxWidth: '220px', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                      fontFamily: "'JetBrains Mono', monospace"
                    }}>{config.shipment_api_url || '—'}</code>
                  </div>

                  {/* Environment */}
                  <span style={{
                    fontSize: '10px', fontWeight: 700,
                    padding: '3px 8px', borderRadius: '6px',
                    display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content',
                    background: config.environment === 'production' ? '#FEF3C7' : '#E0E7FF',
                    color: config.environment === 'production' ? '#92400E' : '#3730A3'
                  }}>
                    <span style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: config.environment === 'production' ? '#F59E0B' : '#6366F1'
                    }} />
                    {config.environment === 'production' ? 'Prod' : 'Stage'}
                  </span>

                  {/* Status badge */}
                  <div>
                    {config.is_active ? (
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '3px 8px',
                        borderRadius: '6px', background: 'var(--color-success-bg)',
                        color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.5px'
                      }}>Active</span>
                    ) : (
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '3px 8px',
                        borderRadius: '6px', background: 'var(--color-surface-alt)',
                        color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px'
                      }}>Off</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <ActionBtn
                      icon={testingId === config.id ? Loader2 : Zap}
                      title="Test Connection"
                      hoverBg="var(--color-info-bg)"
                      hoverColor="var(--color-info)"
                      spinning={testingId === config.id}
                      onClick={() => handleTest(config.id)}
                    />
                    <ActionBtn
                      icon={Pencil}
                      title="Edit"
                      hoverBg="var(--color-warning-bg)"
                      hoverColor="var(--color-warning)"
                      onClick={() => openEdit(config)}
                    />
                    <ActionBtn
                      icon={FileText}
                      title="View Logs"
                      hoverBg="#E0E7FF"
                      hoverColor="#4338CA"
                      onClick={() => handleViewLogs(config.id)}
                    />
                    <ActionBtn
                      icon={config.is_active ? ToggleRight : ToggleLeft}
                      title={config.is_active ? 'Deactivate' : 'Activate'}
                      color={config.is_active ? 'var(--color-success)' : undefined}
                      hoverBg={config.is_active ? 'var(--color-success-bg)' : 'var(--color-surface-alt)'}
                      hoverColor={config.is_active ? 'var(--color-success)' : undefined}
                      onClick={() => toggleMutation.mutate(config.id)}
                    />
                    <ActionBtn
                      icon={Trash2}
                      title="Delete"
                      hoverBg="var(--color-danger-bg)"
                      hoverColor="var(--color-danger)"
                      onClick={() => setDeleteConfirm(config.id)}
                    />
                  </div>
                </div>

                {/* Expanded Logs */}
                {expandedLogs === config.id && (
                  <div style={{
                    padding: '16px 24px 20px',
                    background: 'var(--color-surface-alt)',
                    borderBottom: '1px solid var(--color-border-light)',
                    animation: 'fadeIn 0.25s ease-out'
                  }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Recent API Push Logs
                    </h4>
                    {logsLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
                        <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite', color: 'var(--color-text-tertiary)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>Loading logs...</span>
                      </div>
                    ) : logsData.length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', padding: '8px 0' }}>No push logs yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {logsData.slice(0, 5).map((log) => (
                          <div key={log.id} style={{
                            display: 'grid', gridTemplateColumns: '80px 1fr 100px 120px',
                            gap: '12px', alignItems: 'center',
                            padding: '10px 14px', borderRadius: '10px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)'
                          }}>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 6px',
                              borderRadius: '4px', textAlign: 'center',
                              background: log.status === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                              color: log.status === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                              textTransform: 'uppercase'
                            }}>{log.status}</span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {log.tracking_number_received || log.error_message || '—'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                              HTTP {log.response_status || '—'}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
                              {formatDate(log.pushed_at)} {formatTime(log.pushed_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Test Result Banner */}
          {testResult && (
            <div style={{
              margin: '0 24px 16px',
              padding: '14px 18px',
              borderRadius: '12px',
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              animation: 'fadeIn 0.3s ease-out',
              background: testResult.reachable ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              border: `1px solid ${testResult.reachable ? '#BBF7D0' : '#FECACA'}`
            }}>
              {testResult.reachable ? (
                <CheckCircle2 style={{ width: '18px', height: '18px', color: 'var(--color-success)', flexShrink: 0, marginTop: '1px' }} />
              ) : (
                <XCircle style={{ width: '18px', height: '18px', color: 'var(--color-danger)', flexShrink: 0, marginTop: '1px' }} />
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: testResult.reachable ? '#166534' : '#991B1B' }}>
                  {testResult.message}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
                  {testResult.latency_ms && (
                    <span style={{ fontSize: '11px', color: testResult.reachable ? '#15803D' : '#B91C1C' }}>
                      Latency: {testResult.latency_ms}ms
                    </span>
                  )}
                  {testResult.token_preview && (
                    <span style={{ fontSize: '11px', color: '#15803D', fontFamily: "'JetBrains Mono', monospace" }}>
                      Token: {testResult.token_preview}
                    </span>
                  )}
                  {testResult.customer_id && (
                    <span style={{ fontSize: '11px', color: '#15803D' }}>
                      Customer ID: {testResult.customer_id}
                    </span>
                  )}
                </div>
                {/* Save Token Button */}
                {testResult.reachable && testResult.auth_type === 'token' && (
                  <button
                    onClick={handleSaveToken}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      marginTop: '10px', padding: '6px 14px', borderRadius: '8px',
                      border: '1px solid #BBF7D0', background: '#fff',
                      fontSize: '11px', fontWeight: 700, color: '#166534',
                      cursor: 'pointer', fontFamily: 'var(--font-family-body)'
                    }}
                  >
                    <Save style={{ width: '12px', height: '12px' }} />
                    Save Token & Customer ID
                  </button>
                )}
              </div>
              <button
                onClick={() => setTestResult(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: testResult.reachable ? '#166534' : '#991B1B' }}
              >
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Add/Edit Modal ─── */}
      {showModal && createPortal(
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflowY: 'auto', padding: '40px 20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '640px',
              background: 'var(--color-surface)',
              borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              zIndex: 101, animation: 'fadeInScale 0.25s ease-out',
              margin: 'auto',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'sticky', top: 0, background: 'var(--color-surface)',
              borderRadius: '20px 20px 0 0', zIndex: 2
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {editingId ? <Pencil style={{ width: '16px', height: '16px', color: '#fff' }} /> : <Plus style={{ width: '18px', height: '18px', color: '#fff' }} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{editingId ? 'Edit Vendor API' : 'Add Vendor API'}</h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '1px' }}>
                    {editingId ? 'Update the vendor connection details.' : 'Configure a new vendor courier API connection.'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{
                  background: 'var(--color-surface-alt)', border: 'none',
                  width: '32px', height: '32px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--color-text-tertiary)', transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-bg)'; e.currentTarget.style.color = 'var(--color-danger)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-alt)'; e.currentTarget.style.color = 'var(--color-text-tertiary)' }}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', padding: '0 24px' }}>
              {['connection', 'mapping'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setModalTab(tab)}
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: modalTab === tab ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                    borderBottom: modalTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family-body)',
                    transition: 'all 0.15s'
                  }}
                >
                  {tab === 'connection' ? 'Connection & Auth' : 'Advanced Mapping'}
                </button>
              ))}
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              {modalTab === 'connection' && (
                <>
                  {/* ── Section: Basic Info ── */}
                  <SectionLabel>Basic Information</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={labelStyle}>Display Name *</label>
                      <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g., FlySwift Production"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Vendor Code</label>
                      <input
                        value={form.vendor_code}
                        onChange={(e) => setForm({ ...form, vendor_code: e.target.value })}
                        placeholder="e.g., flyswift"
                        style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                      />
                      <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                        Use "flyswift" for FlySwift/Trackmate+ dedicated adapter, or leave blank for generic.
                      </p>
                    </div>
                    <div>
                      <label style={labelStyle}>Environment</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        {['production', 'staging'].map((env) => (
                          <button
                            key={env}
                            type="button"
                            onClick={() => setForm({ ...form, environment: env })}
                            style={{
                              flex: 1, padding: '8px 14px', borderRadius: '8px',
                              border: `2px solid ${form.environment === env ? 'var(--color-primary)' : 'var(--color-border)'}`,
                              background: form.environment === env ? 'rgba(187, 0, 19, 0.04)' : 'var(--color-surface)',
                              fontSize: '12px', fontWeight: 600,
                              color: form.environment === env ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                              cursor: 'pointer', transition: 'all 0.2s',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                              fontFamily: 'var(--font-family-body)'
                            }}
                          >
                            <span style={{
                              width: '5px', height: '5px', borderRadius: '50%',
                              background: env === 'production' ? '#F59E0B' : '#6366F1'
                            }} />
                            {env === 'production' ? 'Production' : 'Staging'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Section: Authentication ── */}
                  <SectionLabel>Authentication</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}>
                    {/* Auth Type Selector */}
                    <div>
                      <label style={labelStyle}>Auth Type *</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        {AUTH_TYPES.map((at) => (
                          <button
                            key={at.value}
                            type="button"
                            onClick={() => setForm({ ...form, auth_type: at.value })}
                            style={{
                              padding: '10px 12px', borderRadius: '10px',
                              border: `2px solid ${form.auth_type === at.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                              background: form.auth_type === at.value ? 'rgba(187, 0, 19, 0.04)' : 'var(--color-surface)',
                              cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                              fontFamily: 'var(--font-family-body)'
                            }}
                          >
                            <p style={{
                              fontSize: '12px', fontWeight: 700,
                              color: form.auth_type === at.value ? 'var(--color-primary)' : 'var(--color-text-primary)'
                            }}>{at.label}</p>
                            <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px', lineHeight: '1.3' }}>
                              {at.desc}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Token Auth Fields */}
                    {form.auth_type === 'token' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={labelStyle}>Auth Endpoint URL *</label>
                          <input
                            value={form.auth_url}
                            onChange={(e) => setForm({ ...form, auth_url: e.target.value })}
                            placeholder="https://api.vendor.com/auth/get_token"
                            style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Token Path in Response</label>
                          <input
                            value={form.auth_token_path}
                            onChange={(e) => setForm({ ...form, auth_token_path: e.target.value })}
                            placeholder="data.token"
                            style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                          />
                          <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                            Dot-notation path to extract token from auth response
                          </p>
                        </div>
                        <div>
                          <label style={labelStyle}>Customer ID</label>
                          <input
                            value={form.customer_id}
                            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                            placeholder="Returned from auth or pre-configured"
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    )}

                    {/* Credentials */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={labelStyle}>Username / User ID {!editingId && '*'}</label>
                        <input
                          required={!editingId}
                          value={form.user_id || form.username}
                          onChange={(e) => setForm({ ...form, user_id: e.target.value, username: e.target.value })}
                          placeholder={editingId ? 'Leave blank to keep current' : 'API Username'}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Password {!editingId && '*'}</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            required={!editingId}
                            type={showPassword ? 'text' : 'password'}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder={editingId ? 'Leave blank to keep current' : 'API Password'}
                            style={{ ...inputStyle, paddingRight: '40px' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)',
                              padding: '4px', display: 'flex'
                            }}
                          >
                            {showPassword ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Customer Code</label>
                        <input
                          value={form.customer_code}
                          onChange={(e) => setForm({ ...form, customer_code: e.target.value })}
                          placeholder="e.g., XYZ123"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Company Code</label>
                        <input
                          value={form.company_code}
                          onChange={(e) => setForm({ ...form, company_code: e.target.value })}
                          placeholder="e.g., BS"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Section: Shipment API ── */}
                  <SectionLabel>Shipment API</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}>
                    <div>
                      <label style={labelStyle}>Shipment API Endpoint *</label>
                      <input
                        required
                        value={form.shipment_api_url}
                        onChange={(e) => setForm({ ...form, shipment_api_url: e.target.value })}
                        placeholder="https://api.vendor.com/shipment/create_docket"
                        style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={labelStyle}>AWB/Tracking Path</label>
                        <input
                          value={form.response_tracking_path}
                          onChange={(e) => setForm({ ...form, response_tracking_path: e.target.value })}
                          placeholder="data.awb_number"
                          style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Success Check Path</label>
                        <input
                          value={form.response_success_path}
                          onChange={(e) => setForm({ ...form, response_success_path: e.target.value })}
                          placeholder="status"
                          style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Success Value</label>
                        <input
                          value={form.response_success_value}
                          onChange={(e) => setForm({ ...form, response_success_value: e.target.value })}
                          placeholder="success"
                          style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Section: Service Codes ── */}
                  <SectionLabel>Service Codes</SectionLabel>
                  <div style={{ marginBottom: '24px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>
                      Define available service types for this vendor (shown in booking dropdown).
                    </p>
                    {/* Existing services */}
                    {safeArray(form.available_services).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                        {safeArray(form.available_services).map((svc, idx) => (
                          <span key={idx} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '5px 10px', borderRadius: '8px',
                            background: 'var(--color-surface-alt)',
                            border: '1px solid var(--color-border)',
                            fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)'
                          }}>
                            <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--color-primary)' }}>
                              {svc.code}
                            </code>
                            {svc.label !== svc.code && <span style={{ color: 'var(--color-text-tertiary)' }}>— {svc.label}</span>}
                            <button
                              type="button"
                              onClick={() => removeService(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--color-text-tertiary)', display: 'flex' }}
                            >
                              <X style={{ width: '12px', height: '12px' }} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Add service row */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <input
                          value={newService.code}
                          onChange={(e) => setNewService({ ...newService, code: e.target.value })}
                          placeholder="Code (e.g., SPX)"
                          style={{ ...inputStyle, fontSize: '12px' }}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <input
                          value={newService.label}
                          onChange={(e) => setNewService({ ...newService, label: e.target.value })}
                          placeholder="Label (e.g., Standard Parcel Express)"
                          style={{ ...inputStyle, fontSize: '12px' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addService}
                        disabled={!newService.code}
                        style={{
                          padding: '10px 16px', borderRadius: '10px', border: 'none',
                          background: newService.code ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                          color: newService.code ? '#fff' : 'var(--color-text-tertiary)',
                          fontSize: '12px', fontWeight: 700, cursor: newService.code ? 'pointer' : 'not-allowed',
                          fontFamily: 'var(--font-family-body)', whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Plus style={{ width: '14px', height: '14px' }} />
                        Add
                      </button>
                    </div>
                  </div>

                  {/* ── Section: Vendor Codes ── */}
                  <SectionLabel>Vendor Codes</SectionLabel>
                  <div style={{ marginBottom: '24px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>
                      Define vendor codes available for this API (shown in booking dropdown, e.g. PC, DHL, FEDEX).
                    </p>
                    {safeArray(form.available_vendor_codes).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                        {safeArray(form.available_vendor_codes).map((vc, idx) => (
                          <span key={idx} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '5px 10px', borderRadius: '8px',
                            background: 'var(--color-surface-alt)',
                            border: '1px solid var(--color-border)',
                            fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)'
                          }}>
                            <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--color-primary)' }}>
                              {vc.code}
                            </code>
                            {vc.label !== vc.code && <span style={{ color: 'var(--color-text-tertiary)' }}>— {vc.label}</span>}
                            <button
                              type="button"
                              onClick={() => removeVendorCode(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--color-text-tertiary)', display: 'flex' }}
                            >
                              <X style={{ width: '12px', height: '12px' }} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <input
                          value={newVendorCode.code}
                          onChange={(e) => setNewVendorCode({ ...newVendorCode, code: e.target.value.toUpperCase() })}
                          placeholder="Code (e.g., PC)"
                          style={{ ...inputStyle, fontSize: '12px' }}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <input
                          value={newVendorCode.label}
                          onChange={(e) => setNewVendorCode({ ...newVendorCode, label: e.target.value })}
                          placeholder="Label (e.g., Pacific Express)"
                          style={{ ...inputStyle, fontSize: '12px' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addVendorCode}
                        disabled={!newVendorCode.code}
                        style={{
                          padding: '10px 16px', borderRadius: '10px', border: 'none',
                          background: newVendorCode.code ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                          color: newVendorCode.code ? '#fff' : 'var(--color-text-tertiary)',
                          fontSize: '12px', fontWeight: 700, cursor: newVendorCode.code ? 'pointer' : 'not-allowed',
                          fontFamily: 'var(--font-family-body)', whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Plus style={{ width: '14px', height: '14px' }} />
                        Add
                      </button>
                    </div>
                  </div>

                  {/* ── Section: Product Codes ── */}
                  <SectionLabel>Product Codes</SectionLabel>
                  <div style={{ marginBottom: '24px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>
                      Define product codes available for this API (shown in booking dropdown, e.g. SPX, DOX, INTL. SPX).
                    </p>
                    {safeArray(form.available_product_codes).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                        {safeArray(form.available_product_codes).map((pc, idx) => (
                          <span key={idx} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '5px 10px', borderRadius: '8px',
                            background: 'var(--color-surface-alt)',
                            border: '1px solid var(--color-border)',
                            fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)'
                          }}>
                            <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#6D28D9' }}>
                              {pc.code}
                            </code>
                            {pc.label !== pc.code && <span style={{ color: 'var(--color-text-tertiary)' }}>— {pc.label}</span>}
                            <button
                              type="button"
                              onClick={() => removeProductCode(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--color-text-tertiary)', display: 'flex' }}
                            >
                              <X style={{ width: '12px', height: '12px' }} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <input
                          value={newProductCode.code}
                          onChange={(e) => setNewProductCode({ ...newProductCode, code: e.target.value.toUpperCase() })}
                          placeholder="Code (e.g., SPX)"
                          style={{ ...inputStyle, fontSize: '12px' }}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <input
                          value={newProductCode.label}
                          onChange={(e) => setNewProductCode({ ...newProductCode, label: e.target.value })}
                          placeholder="Label (e.g., Parcel/Sample)"
                          style={{ ...inputStyle, fontSize: '12px' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addProductCode}
                        disabled={!newProductCode.code}
                        style={{
                          padding: '10px 16px', borderRadius: '10px', border: 'none',
                          background: newProductCode.code ? '#6D28D9' : 'var(--color-surface-alt)',
                          color: newProductCode.code ? '#fff' : 'var(--color-text-tertiary)',
                          fontSize: '12px', fontWeight: 700, cursor: newProductCode.code ? 'pointer' : 'not-allowed',
                          fontFamily: 'var(--font-family-body)', whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Plus style={{ width: '14px', height: '14px' }} />
                        Add
                      </button>
                    </div>
                  </div>

                  {/* ── Section: Required Form Fields ── */}
                  <SectionLabel>Required Booking Form Fields</SectionLabel>
                  <div style={{ marginBottom: '24px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>
                      Select which form sections are shown when this vendor is selected in the booking form.
                      If all are selected or none specified (default), all fields will be visible.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                      {ALL_FORM_SECTIONS.map(s => {
                        const reqFields = safeNullableArray(form.required_fields)
                        const isChecked = reqFields === null || (Array.isArray(reqFields) && reqFields.includes(s.key))
                        return (
                          <label
                            key={s.key}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '8px 12px', borderRadius: '10px',
                              background: isChecked ? 'rgba(109, 40, 217, 0.06)' : 'var(--color-surface-alt)',
                              border: `1px solid ${isChecked ? 'rgba(109, 40, 217, 0.3)' : 'var(--color-border)'}`,
                              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                              color: isChecked ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleRequiredField(s.key)}
                              style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                            />
                            <span>{s.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── Section: Product Code Restrictions ── */}
                  <SectionLabel>Product Code Restrictions</SectionLabel>
                  <div style={{ marginBottom: '24px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>
                      Add country/weight restrictions to product codes. Ineligible codes will be disabled or show warnings in booking.
                    </p>

                    {safeArray(form.product_code_restrictions).length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                        {safeArray(form.product_code_restrictions).map((r, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: '10px',
                              padding: '8px 12px', borderRadius: '10px',
                              background: 'var(--color-surface-alt)',
                              border: '1px solid var(--color-border)',
                              fontSize: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#6D28D9', fontSize: '12px' }}>
                                {r.code}
                              </code>
                              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.label}</span>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                                Countries: {r.countries ? r.countries.join(', ') : 'All (*)'}
                              </span>
                              {(r.min_weight !== undefined || r.max_weight !== undefined) && (
                                <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                                  Weight: {r.min_weight ?? 0}kg – {r.max_weight ?? '∞'}kg
                                </span>
                              )}
                              {r.package_types && (
                                <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                                  Pkg: {r.package_types.join(', ')}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeRestriction(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-tertiary)' }}
                            >
                              <X style={{ width: '14px', height: '14px' }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <input
                        value={newRestriction.code}
                        onChange={(e) => setNewRestriction({ ...newRestriction, code: e.target.value.toUpperCase() })}
                        placeholder="Product Code (e.g. SPX)"
                        style={{ ...inputStyle, fontSize: '12px' }}
                      />
                      <input
                        value={newRestriction.label}
                        onChange={(e) => setNewRestriction({ ...newRestriction, label: e.target.value })}
                        placeholder="Label (e.g. Express Parcel)"
                        style={{ ...inputStyle, fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <input
                        value={newRestriction.countries}
                        onChange={(e) => setNewRestriction({ ...newRestriction, countries: e.target.value })}
                        placeholder="Countries (e.g. US, UK, IN or * for all)"
                        style={{ ...inputStyle, fontSize: '12px' }}
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={newRestriction.min_weight}
                        onChange={(e) => setNewRestriction({ ...newRestriction, min_weight: e.target.value })}
                        placeholder="Min Wt (kg)"
                        style={{ ...inputStyle, fontSize: '12px' }}
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={newRestriction.max_weight}
                        onChange={(e) => setNewRestriction({ ...newRestriction, max_weight: e.target.value })}
                        placeholder="Max Wt (kg)"
                        style={{ ...inputStyle, fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={addRestriction}
                        disabled={!newRestriction.code}
                        style={{
                          padding: '8px 16px', borderRadius: '10px', border: 'none',
                          background: newRestriction.code ? '#6D28D9' : 'var(--color-surface-alt)',
                          color: newRestriction.code ? '#fff' : 'var(--color-text-tertiary)',
                          fontSize: '12px', fontWeight: 700, cursor: newRestriction.code ? 'pointer' : 'not-allowed',
                          fontFamily: 'var(--font-family-body)', display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Plus style={{ width: '14px', height: '14px' }} />
                        Add Restriction Rule
                      </button>
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'mapping' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease-out' }}>
                  {/* Custom Headers Template */}
                  <div>
                    <label style={labelStyle}>Headers Template (JSON)</label>
                    <textarea
                      value={headersTemplateStr}
                      onChange={(e) => setHeadersTemplateStr(e.target.value)}
                      placeholder={`{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer {{token}}"\n}`}
                      rows={4}
                      style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', resize: 'vertical' }}
                    />
                    <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                      Configure request headers. Use <code>{"{{token}}"}</code> as a placeholder for token authentication.
                    </p>
                  </div>

                  {/* Request Payload Template */}
                  <div>
                    <label style={labelStyle}>Request Template (JSON)</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <textarea
                        value={requestTemplateStr}
                        onChange={(e) => setRequestTemplateStr(e.target.value)}
                        placeholder={`{\n  "tracking_number": "",\n  "sender": {\n    "name": ""\n  }\n}`}
                        rows={6}
                        style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', resize: 'vertical', flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={handleParseTemplate}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'var(--color-primary)',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-family-body)',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          alignSelf: 'stretch',
                          justifyContent: 'center',
                          flexDirection: 'column'
                        }}
                      >
                        <Code2 style={{ width: '16px', height: '16px' }} />
                        Parse Fields
                      </button>
                    </div>
                    <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                      Paste the target JSON payload structure expected by the vendor's shipment creation API.
                    </p>
                  </div>

                  {/* Field Mappings */}
                  <div>
                    <SectionLabel>Field Mappings</SectionLabel>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '12px' }}>
                      Map parsed template JSON paths to internal shipment fields, static values, or credentials.
                    </p>

                    {Object.keys(form.field_mapping || {}).length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', border: '1.5px dashed var(--color-border)', borderRadius: '12px' }}>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
                          No fields mapped yet. Paste a JSON template above and click "Parse Fields" to populate fields.
                        </p>
                      </div>
                    ) : (
                      <div style={{
                        maxHeight: '320px',
                        overflowY: 'auto',
                        border: '1px solid var(--color-border)',
                        borderRadius: '12px',
                        background: 'var(--color-surface-alt)'
                      }}>
                        {Object.entries(form.field_mapping).map(([path, mappingConfig]) => (
                          <div
                            key={path}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1.8fr 1.2fr 2.5fr',
                              gap: '12px',
                              padding: '12px 16px',
                              alignItems: 'center',
                              borderBottom: '1px solid var(--color-border-light)'
                            }}
                          >
                            {/* Path label */}
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={path}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                                {path}
                              </span>
                            </div>

                            {/* Type selector */}
                            <select
                              value={mappingConfig.type || 'ignore'}
                              onChange={(e) => {
                                const val = e.target.value
                                setForm(prev => {
                                  const newMapping = { ...prev.field_mapping }
                                  newMapping[path] = { ...newMapping[path], type: val }
                                  return { ...prev, field_mapping: newMapping }
                                })
                              }}
                              style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px', height: '34px' }}
                            >
                              <option value="ignore">Ignore / Skip</option>
                              <option value="mapped">Internal Field</option>
                              <option value="static">Static Value</option>
                              <option value="credential">Credential</option>
                            </select>

                            {/* Value / Source mapping */}
                            <div>
                              {mappingConfig.type === 'mapped' && (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <select
                                    value={mappingConfig.source || ''}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setForm(prev => {
                                        const newMapping = { ...prev.field_mapping }
                                        newMapping[path] = { ...newMapping[path], source: val }
                                        return { ...prev, field_mapping: newMapping }
                                      })
                                    }}
                                    style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px', height: '34px', flex: 1 }}
                                  >
                                    <option value="">-- Choose Field --</option>
                                    {internalFields.map(f => (
                                      <option key={f.key} value={f.key}>{f.label} ({f.group})</option>
                                    ))}
                                  </select>
                                  
                                  <select
                                    value={mappingConfig.transform || ''}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setForm(prev => {
                                        const newMapping = { ...prev.field_mapping }
                                        newMapping[path] = { ...newMapping[path], transform: val }
                                        return { ...prev, field_mapping: newMapping }
                                      })
                                    }}
                                    title="Apply Transform"
                                    style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px', height: '34px', width: '90px' }}
                                  >
                                    <option value="">None</option>
                                    <option value="uppercase">UPPERCASE</option>
                                    <option value="lowercase">lowercase</option>
                                    <option value="string">To String</option>
                                    <option value="number">To Number</option>
                                    <option value="weight_per_piece">Wt / Piece</option>
                                    <option value="declared_value_per_piece">Val / Piece</option>
                                    <option value="index_1_based">Index (1..N)</option>
                                    <option value="index_0_based">Index (0..N-1)</option>
                                    <option value="date_yyyy_mm_dd">YYYY-MM-DD</option>
                                    <option value="time_hh_mm_ss">HH:MM:SS</option>
                                    <option value="date_dd_mm_yyyy">DD/MM/YYYY</option>
                                  </select>
                                </div>
                              )}

                              {mappingConfig.type === 'static' && (
                                <input
                                  value={mappingConfig.value || ''}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setForm(prev => {
                                      const newMapping = { ...prev.field_mapping }
                                      newMapping[path] = { ...newMapping[path], value: val }
                                      return { ...prev, field_mapping: newMapping }
                                    })
                                  }}
                                  placeholder="Static Value"
                                  style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px', height: '34px' }}
                                />
                              )}

                              {mappingConfig.type === 'credential' && (
                                <select
                                  value={mappingConfig.source || ''}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setForm(prev => {
                                      const newMapping = { ...prev.field_mapping }
                                      newMapping[path] = { ...newMapping[path], source: val }
                                      return { ...prev, field_mapping: newMapping }
                                    })
                                  }}
                                  style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px', height: '34px' }}
                                >
                                  <option value="">-- Choose Credential --</option>
                                  <option value="user_id">Username / User ID</option>
                                  <option value="password">Password</option>
                                  <option value="customer_code">Customer Code</option>
                                  <option value="company_code">Company Code</option>
                                  <option value="customer_id">Customer ID</option>
                                </select>
                              )}

                              {(!mappingConfig.type || mappingConfig.type === 'ignore') && (
                                <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Field ignored</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submit */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: '10px',
                marginTop: '8px', paddingTop: '20px',
                borderTop: '1px solid var(--color-border-light)'
              }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: '10px 20px', borderRadius: '10px',
                    border: '1.5px solid var(--color-border)',
                    background: 'var(--color-surface)', fontSize: '13px',
                    fontWeight: 600, color: 'var(--color-text-secondary)',
                    cursor: 'pointer', transition: 'all 0.2s',
                    fontFamily: 'var(--font-family-body)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  style={{
                    padding: '10px 24px', borderRadius: '10px', border: 'none',
                    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                    fontSize: '13px', fontWeight: 700, color: '#fff',
                    cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 4px 12px rgba(187, 0, 19, 0.3)',
                    fontFamily: 'var(--font-family-body)',
                    opacity: (createMutation.isPending || updateMutation.isPending) ? 0.7 : 1
                  }}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                  )}
                  {editingId ? 'Update Vendor' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteConfirm && createPortal(
        <div
          onClick={() => setDeleteConfirm(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflowY: 'auto', padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '400px', background: 'var(--color-surface)',
              borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              zIndex: 101, padding: '24px', textAlign: 'center',
              animation: 'fadeInScale 0.25s ease-out',
              margin: 'auto',
              position: 'relative'
            }}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'var(--color-danger-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <AlertCircle style={{ width: '24px', height: '24px', color: 'var(--color-danger)' }} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Delete Vendor API?</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
              This action cannot be undone. All API credentials for this vendor will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px',
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-surface)', fontSize: '13px',
                  fontWeight: 600, color: 'var(--color-text-secondary)',
                  cursor: 'pointer', fontFamily: 'var(--font-family-body)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                  background: 'var(--color-danger)', fontSize: '13px',
                  fontWeight: 700, color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  fontFamily: 'var(--font-family-body)'
                }}
              >
                {deleteMutation.isPending && <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />}
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Spin animation for loaders */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ─── Subcomponents ───

function SectionLabel({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      marginBottom: '14px', paddingBottom: '8px',
      borderBottom: '1px solid var(--color-border-light)'
    }}>
      <span style={{
        fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)',
        textTransform: 'uppercase', letterSpacing: '1px'
      }}>{children}</span>
    </div>
  )
}

function ActionBtn({ icon: Icon, title, onClick, hoverBg, hoverColor, color, spinning }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '6px', borderRadius: '8px', border: 'none',
        background: 'transparent', cursor: 'pointer',
        color: color || 'var(--color-text-tertiary)',
        transition: 'all 0.15s', display: 'flex', alignItems: 'center'
      }}
      onMouseEnter={(e) => {
        if (hoverBg) e.currentTarget.style.background = hoverBg
        if (hoverColor) e.currentTarget.style.color = hoverColor
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = color || 'var(--color-text-tertiary)'
      }}
    >
      <Icon style={{
        width: '14px', height: '14px',
        ...(spinning ? { animation: 'spin 1s linear infinite' } : {})
      }} />
    </button>
  )
}

// ─── Shared Styles ───

const labelStyle = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: '6px'
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1.5px solid var(--color-border)',
  fontSize: '13px',
  color: 'var(--color-text-primary)',
  outline: 'none',
  background: 'var(--color-surface)',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  fontFamily: 'var(--font-family-body)',
  boxSizing: 'border-box'
}
