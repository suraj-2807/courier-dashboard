import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  getApiSettings,
  getApiSettingById,
  createApiSetting,
  updateApiSetting,
  deleteApiSetting,
  testApiConnection,
  toggleApiSetting,
  getActiveVendors,
  saveAuthToken,
  pushTestData,
  getPushLogs,
  getInternalFields,
  extractTemplatePaths
} from './apiSettings.controller.js'

const router = express.Router()

// Vendor configs CRUD
router.get('/', authMiddleware, getApiSettings)
router.get('/active-vendors', authMiddleware, getActiveVendors)
router.get('/internal-fields', authMiddleware, getInternalFields)
router.get('/:id', authMiddleware, getApiSettingById)
router.post('/', authMiddleware, createApiSetting)
router.put('/:id', authMiddleware, updateApiSetting)
router.delete('/:id', authMiddleware, deleteApiSetting)

// Test, toggle, token, push
router.post('/:id/test', authMiddleware, testApiConnection)
router.patch('/:id/toggle', authMiddleware, toggleApiSetting)
router.post('/:id/save-auth-token', authMiddleware, saveAuthToken)
router.post('/:id/push-test', authMiddleware, pushTestData)
router.get('/:id/push-logs', authMiddleware, getPushLogs)
router.post('/extract-template-paths', authMiddleware, extractTemplatePaths)

export default router
