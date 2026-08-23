import express from 'express'
import authMiddleware from '../../middlewares/auth.middleware.js'
import {
  getProducts,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkImportProducts
} from './product.controller.js'

const router = express.Router()

router.get('/search', authMiddleware, searchProducts)
router.post('/bulk-import', authMiddleware, bulkImportProducts)

router.get('/', authMiddleware, getProducts)
router.post('/', authMiddleware, createProduct)
router.put('/:id', authMiddleware, updateProduct)
router.delete('/:id', authMiddleware, deleteProduct)

export default router
