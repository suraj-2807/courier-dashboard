import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  createReceiver,
  getReceivers,
  getReceiverById,
  updateReceiver,
  deleteReceiver
} from './receiver.controller.js'

const router = express.Router()

router.post(
  '/',
  authMiddleware,
  createReceiver
)

router.get(
  '/',
  authMiddleware,
  getReceivers
)

router.get(
  '/:id',
  authMiddleware,
  getReceiverById
)

router.put(
  '/:id',
  authMiddleware,
  updateReceiver
)

router.delete(
  '/:id',
  authMiddleware,
  deleteReceiver
)

export default router