import { query, execute } from '../../config/db.js'

/**
 * Search products for autocomplete by name/HSN code and country
 */
export const searchProducts = async (req, res) => {
  try {
    const { q, country } = req.query
    if (!q || !q.trim()) {
      return res.json({ success: true, products: [] })
    }

    const searchTerm = `%${q.trim()}%`
    let sql = `
      SELECT * FROM products
      WHERE is_active = TRUE
        AND (name LIKE ? OR hs_code LIKE ?)
    `
    const params = [searchTerm, searchTerm]

    if (country && country.trim()) {
      const c = country.trim().toUpperCase()
      sql += ` AND (UPPER(country) = ? OR UPPER(country) = 'ALL' OR country = '' OR country IS NULL)`
      params.push(c)
    }

    sql += ` ORDER BY name ASC LIMIT 15`

    const rows = await query(sql, params)
    return res.json({ success: true, products: rows })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Get all products with optional filters
 */
export const getProducts = async (req, res) => {
  try {
    const { search, country } = req.query
    let sql = `SELECT * FROM products WHERE 1=1`
    const params = []

    if (search && search.trim()) {
      const s = `%${search.trim()}%`
      sql += ` AND (name LIKE ? OR hs_code LIKE ? OR description LIKE ?)`
      params.push(s, s, s)
    }

    if (country && country.trim()) {
      const c = country.trim().toUpperCase()
      if (c !== 'ALL') {
        sql += ` AND (UPPER(country) = ? OR country = '' OR UPPER(country) = 'ALL')`
        params.push(c)
      }
    }

    sql += ` ORDER BY created_at DESC`

    const rows = await query(sql, params)
    return res.json({
      success: true,
      products: rows,
      total: rows.length
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Create a new product / HSN mapping
 */
export const createProduct = async (req, res) => {
  try {
    const { name, hs_code, country, description } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product Name is required' })
    }
    if (!hs_code || !hs_code.trim()) {
      return res.status(400).json({ success: false, message: 'HSN Code is required' })
    }

    const cleanName = name.trim()
    const cleanHs = hs_code.trim()
    const cleanCountry = (country || '').trim().toUpperCase()

    // Check if duplicate product + hs_code + country exists
    const existing = await query(
      `SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(?) AND hs_code = ? AND UPPER(country) = ? LIMIT 1`,
      [cleanName, cleanHs, cleanCountry]
    )

    if (existing.length > 0) {
      await execute(
        `UPDATE products SET description = ?, is_active = TRUE WHERE id = ?`,
        [description || '', existing[0].id]
      )
      const rows = await query('SELECT * FROM products WHERE id = ?', [existing[0].id])
      return res.status(200).json({ success: true, product: rows[0] })
    }

    const result = await execute(
      `INSERT INTO products (name, hs_code, country, description)
       VALUES (?, ?, ?, ?)`,
      [cleanName, cleanHs, cleanCountry, description || '']
    )

    const rows = await query('SELECT * FROM products WHERE id = ?', [result.insertId])

    return res.status(201).json({
      success: true,
      product: rows[0]
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Update an existing product
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params
    const { name, hs_code, country, description, is_active } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product Name is required' })
    }
    if (!hs_code || !hs_code.trim()) {
      return res.status(400).json({ success: false, message: 'HSN Code is required' })
    }

    await execute(
      `UPDATE products
       SET name = ?, hs_code = ?, country = ?, description = ?, is_active = ?
       WHERE id = ?`,
      [
        name.trim(),
        hs_code.trim(),
        (country || '').trim().toUpperCase(),
        description || '',
        is_active !== undefined ? is_active : true,
        id
      ]
    )

    const rows = await query('SELECT * FROM products WHERE id = ?', [id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' })
    }

    return res.json({
      success: true,
      product: rows[0]
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Delete a product
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params
    await execute('DELETE FROM products WHERE id = ?', [id])
    return res.json({ success: true, message: 'Product deleted successfully' })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Bulk import products from CSV array
 */
export const bulkImportProducts = async (req, res) => {
  try {
    const { products: importList } = req.body
    if (!Array.isArray(importList) || importList.length === 0) {
      return res.status(400).json({ success: false, message: 'No product rows provided' })
    }

    let inserted = 0
    for (const item of importList) {
      const name = (item.name || item.product_name || '').trim()
      const hs = (item.hs_code || item.hsn_code || item.hscode || '').trim()
      const country = (item.country || item.country_code || '').trim().toUpperCase()
      const description = (item.description || '').trim()

      if (!name || !hs) continue

      // Check existing
      const existing = await query(
        `SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(?) AND hs_code = ? AND UPPER(country) = ? LIMIT 1`,
        [name, hs, country]
      )

      if (existing.length > 0) {
        await execute(
          `UPDATE products SET description = ?, is_active = TRUE WHERE id = ?`,
          [description || '', existing[0].id]
        )
      } else {
        await execute(
          `INSERT INTO products (name, hs_code, country, description)
           VALUES (?, ?, ?, ?)`,
          [name, hs, country, description]
        )
      }
      inserted++
    }

    return res.json({
      success: true,
      message: `${inserted} products processed successfully`,
      imported: inserted
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}
