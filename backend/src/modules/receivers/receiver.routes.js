import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  createReceiver,
  getReceivers,
  searchReceivers,
  bulkImportReceivers,
  getReceiverById,
  updateReceiver,
  deleteReceiver
} from './receiver.controller.js'

const router = express.Router()

router.get('/search', authMiddleware, searchReceivers)
router.post('/bulk-import', authMiddleware, bulkImportReceivers)

router.post('/', authMiddleware, createReceiver)
router.get('/', authMiddleware, getReceivers)
router.get('/:id', authMiddleware, getReceiverById)
router.put('/:id', authMiddleware, updateReceiver)
router.delete('/:id', authMiddleware, deleteReceiver)

export default router