import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'
import {
  getCountryCodes,
  importCountryCodes,
  addCountryCode,
  deleteCountryCode
} from './countryCode.controller.js'

const router = express.Router()

router.get('/', getCountryCodes)
router.post('/', authMiddleware, addCountryCode)
router.post('/import', authMiddleware, importCountryCodes)
router.delete('/:id', authMiddleware, deleteCountryCode)

export default router
