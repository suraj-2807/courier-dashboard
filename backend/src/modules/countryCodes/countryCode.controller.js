import { query, execute } from '../../config/db.js'

/**
 * Get all country code mappings and return dictionary for quick lookup
 */
export const getCountryCodes = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM country_codes ORDER BY country_name ASC')
    const lookupMap = {}
    
    const rowsList = Array.isArray(rows) ? rows : []
    rowsList.forEach(row => {
      if (row && row.country_name && row.country_code) {
        lookupMap[String(row.country_name).trim().toUpperCase()] = String(row.country_code).trim().toUpperCase()
      }
    })

    return res.json({
      success: true,
      countryCodes: rowsList,
      lookupMap
    })
  } catch (error) {
    console.error('Error in getCountryCodes:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

function extractVal(obj, possibleKeys) {
  if (!obj || typeof obj !== 'object') return ''
  for (const k of Object.keys(obj)) {
    const cleanKey = k.trim().toLowerCase()
    for (const target of possibleKeys) {
      if (cleanKey === target.toLowerCase()) {
        return obj[k]
      }
    }
  }
  return ''
}

/**
 * Import country code mappings from array or CSV rows
 * Expects array of objects: [{ country_name / branch_name: 'USA', country_code: 'US' }, ...]
 */
export const importCountryCodes = async (req, res) => {
  try {
    const { rows = [] } = req.body

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No country rows provided in request payload'
      })
    }

    let insertedCount = 0
    for (const item of rows) {
      // Support flexible CSV field names: "Branch Name", "Country Name", "Branch", "Country", "Country Code", "Code", etc.
      const nameRaw = item.country_name || extractVal(item, ['country_name', 'branch_name', 'branch name', 'country name', 'branch', 'country', 'name'])
      const codeRaw = item.country_code || extractVal(item, ['country_code', 'country code', 'code', 'iso', 'iso code', 'countrycode'])

      if (!nameRaw || !codeRaw) continue

      const countryName = String(nameRaw).trim().toUpperCase()
      const countryCode = String(codeRaw).trim().toUpperCase()

      if (countryName && countryCode) {
        await execute(
          `INSERT INTO country_codes (country_name, country_code)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE country_code = VALUES(country_code)`,
          [countryName, countryCode]
        )
        insertedCount++
      }
    }

    const updatedList = await query('SELECT * FROM country_codes ORDER BY country_name ASC')
    const lookupMap = {}
    const listArr = Array.isArray(updatedList) ? updatedList : []
    listArr.forEach(row => {
      if (row && row.country_name && row.country_code) {
        lookupMap[String(row.country_name).trim().toUpperCase()] = String(row.country_code).trim().toUpperCase()
      }
    })

    return res.json({
      success: true,
      message: `Successfully imported/updated ${insertedCount} country code mappings.`,
      countryCodes: listArr,
      lookupMap
    })
  } catch (error) {
    console.error('Error in importCountryCodes:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Add or update single country code mapping
 */
export const addCountryCode = async (req, res) => {
  try {
    const { country_name, country_code } = req.body

    if (!country_name || !country_code) {
      return res.status(400).json({
        success: false,
        message: 'Country name and country code are required'
      })
    }

    const name = String(country_name).trim().toUpperCase()
    const code = String(country_code).trim().toUpperCase()

    await execute(
      `INSERT INTO country_codes (country_name, country_code)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE country_code = VALUES(country_code)`,
      [name, code]
    )

    return res.json({
      success: true,
      message: `Mapping added: ${name} -> ${code}`
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Delete a single country code mapping
 */
export const deleteCountryCode = async (req, res) => {
  try {
    const { id } = req.params
    await execute('DELETE FROM country_codes WHERE id = ?', [id])

    return res.json({
      success: true,
      message: 'Country code mapping deleted successfully'
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}
