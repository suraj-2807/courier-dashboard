import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  createSender,
  getSenders,
  searchSenders,
  bulkImportSenders,
  getSenderById,
  updateSender,
  deleteSender
} from './sender.controller.js'

const router = express.Router()

router.get('/search', authMiddleware, searchSenders)
router.post('/bulk-import', authMiddleware, bulkImportSenders)

router.post('/', authMiddleware, createSender)
router.get('/', authMiddleware, getSenders)
router.get('/:id', authMiddleware, getSenderById)
router.put('/:id', authMiddleware, updateSender)
router.delete('/:id', authMiddleware, deleteSender)

export default router