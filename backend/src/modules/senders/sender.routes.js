import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'

import {
  createSender,
  getSenders,
  getSenderById,
  updateSender,
  deleteSender
} from './sender.controller.js'

const router = express.Router()

router.post(
  '/',
  authMiddleware,
  createSender
)

router.get(
  '/',
  authMiddleware,
  getSenders
)

router.get(
  '/:id',
  authMiddleware,
  getSenderById
)

router.put(
  '/:id',
  authMiddleware,
  updateSender
)

router.delete(
  '/:id',
  authMiddleware,
  deleteSender
)

export default router