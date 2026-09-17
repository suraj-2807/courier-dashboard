import { query, execute } from '../../config/db.js'

const DEFAULT_ISO_COUNTRIES = [
  ['AFGHANISTAN', 'AF'], ['ALAND ISLANDS', 'AX'], ['ALBANIA', 'AL'], ['ALGERIA', 'DZ'], ['AMERICAN SAMOA', 'AS'],
  ['ANDORRA', 'AD'], ['ANGOLA', 'AO'], ['ANGUILLA', 'AI'], ['ANTARCTICA', 'AQ'], ['ANTIGUA AND BARBUDA', 'AG'],
  ['ARGENTINA', 'AR'], ['ARMENIA', 'AM'], ['ARUBA', 'AW'], ['AUSTRALIA', 'AU'], ['AUSTRIA', 'AT'],
  ['AZERBAIJAN', 'AZ'], ['BAHAMAS', 'BS'], ['BAHRAIN', 'BH'], ['BANGLADESH', 'BD'], ['BARBADOS', 'BB'],
  ['BELARUS', 'BY'], ['BELGIUM', 'BE'], ['BELIZE', 'BZ'], ['BENIN', 'BJ'], ['BERMUDA', 'BM'],
  ['BHUTAN', 'BT'], ['BOLIVIA', 'BO'], ['BOSNIA AND HERZEGOVINA', 'BA'], ['BOTSWANA', 'BW'], ['BOUVET ISLAND', 'BV'],
  ['BRAZIL', 'BR'], ['BRITISH INDIAN OCEAN TERRITORY', 'IO'], ['BRUNEI', 'BN'], ['BULGARIA', 'BG'],
  ['BURKINA FASO', 'BF'], ['BURUNDI', 'BI'], ['CAMBODIA', 'KH'], ['CAMEROON', 'CM'], ['CANADA', 'CA'],
  ['CAPE VERDE', 'CV'], ['CAYMAN ISLANDS', 'KY'], ['CENTRAL AFRICAN REPUBLIC', 'CF'], ['CHAD', 'TD'],
  ['CHILE', 'CL'], ['CHINA', 'CN'], ['CHRISTMAS ISLAND', 'CX'], ['COCOS (KEELING) ISLANDS', 'CC'],
  ['COLOMBIA', 'CO'], ['COMOROS', 'KM'], ['CONGO', 'CG'], ['CONGO (DRC)', 'CD'], ['COOK ISLANDS', 'CK'],
  ['COSTA RICA', 'CR'], ['IVORY COAST', 'CI'], ['CROATIA', 'HR'], ['CUBA', 'CU'], ['CURACAO', 'CW'],
  ['CYPRUS', 'CY'], ['CZECH REPUBLIC', 'CZ'], ['DENMARK', 'DK'], ['DJIBOUTI', 'DJ'], ['DOMINICA', 'DM'],
  ['DOMINICAN REPUBLIC', 'DO'], ['ECUADOR', 'EC'], ['EGYPT', 'EG'], ['EL SALVADOR', 'SV'],
  ['EQUATORIAL GUINEA', 'GQ'], ['ERITREA', 'ER'], ['ESTONIA', 'EE'], ['ESWATINI', 'SZ'], ['ETHIOPIA', 'ET'],
  ['FALKLAND ISLANDS', 'FK'], ['FAROE ISLANDS', 'FO'], ['FIJI', 'FJ'], ['FINLAND', 'FI'], ['FRANCE', 'FR'],
  ['FRENCH GUIANA', 'GF'], ['FRENCH POLYNESIA', 'PF'], ['FRENCH SOUTHERN TERRITORIES', 'TF'], ['GABON', 'GA'],
  ['GAMBIA', 'GM'], ['GEORGIA', 'GE'], ['GERMANY', 'DE'], ['GHANA', 'GH'], ['GIBRALTAR', 'GI'],
  ['GREECE', 'GR'], ['GREENLAND', 'GL'], ['GRENADA', 'GD'], ['GUADELOUPE', 'GP'], ['GUAM', 'GU'],
  ['GUATEMALA', 'GT'], ['GUERNSEY', 'GG'], ['GUINEA', 'GN'], ['GUINEA-BISSAU', 'GW'], ['GUYANA', 'GY'],
  ['HAITI', 'HT'], ['HEARD ISLAND AND MCDONALD ISLANDS', 'HM'], ['VATICAN CITY', 'VA'], ['HONDURAS', 'HN'],
  ['HONG KONG', 'HK'], ['HUNGARY', 'HU'], ['ICELAND', 'IS'], ['INDIA', 'IN'], ['INDONESIA', 'ID'],
  ['IRAN', 'IR'], ['IRAQ', 'IQ'], ['IRELAND', 'IE'], ['ISLE OF MAN', 'IM'], ['ISRAEL', 'IL'],
  ['ITALY', 'IT'], ['JAMAICA', 'JM'], ['JAPAN', 'JP'], ['JERSEY', 'JE'], ['JORDAN', 'JO'],
  ['KAZAKHSTAN', 'KZ'], ['KENYA', 'KE'], ['KIRIBATI', 'KI'], ['NORTH KOREA', 'KP'], ['SOUTH KOREA', 'KR'],
  ['KUWAIT', 'KW'], ['KYRGYZSTAN', 'KG'], ['LAOS', 'LA'], ['LATVIA', 'LV'], ['LEBANON', 'LB'],
  ['LESOTHO', 'LS'], ['LIBERIA', 'LR'], ['LIBYA', 'LY'], ['LIECHTENSTEIN', 'LI'], ['LITHUANIA', 'LT'],
  ['LUXEMBOURG', 'LU'], ['MACAU', 'MO'], ['MADAGASCAR', 'MG'], ['MALAWI', 'MW'], ['MALAYSIA', 'MY'],
  ['MALDIVES', 'MV'], ['MALI', 'ML'], ['MALTA', 'MT'], ['MARSHALL ISLANDS', 'MH'], ['MARTINIQUE', 'MQ'],
  ['MAURITANIA', 'MR'], ['MAURITIUS', 'MU'], ['MAYOTTE', 'YT'], ['MEXICO', 'MX'], ['MICRONESIA', 'FM'],
  ['MOLDOVA', 'MD'], ['MONACO', 'MC'], ['MONGOLIA', 'MN'], ['MONTENEGRO', 'ME'], ['MONTSERRAT', 'MS'],
  ['MOROCCO', 'MA'], ['MOZAMBIQUE', 'MZ'], ['MYANMAR', 'MM'], ['NAMIBIA', 'NA'], ['NAURU', 'NR'],
  ['NEPAL', 'NP'], ['NETHERLANDS', 'NL'], ['NEW CALEDONIA', 'NC'], ['NEW ZEALAND', 'NZ'], ['NICARAGUA', 'NI'],
  ['NIGER', 'NE'], ['NIGERIA', 'NG'], ['NIUE', 'NU'], ['NORFOLK ISLAND', 'NF'], ['NORTH MACEDONIA', 'MK'],
  ['NORTHERN MARIANA ISLANDS', 'MP'], ['NORWAY', 'NO'], ['OMAN', 'OM'], ['PAKISTAN', 'PK'], ['PALAU', 'PW'],
  ['PALESTINE', 'PS'], ['PANAMA', 'PA'], ['PAPUA NEW GUINEA', 'PG'], ['PARAGUAY', 'PY'], ['PERU', 'PE'],
  ['PHILIPPINES', 'PH'], ['PITCAIRN', 'PN'], ['POLAND', 'PL'], ['PORTUGAL', 'PT'], ['PUERTO RICO', 'PR'],
  ['QATAR', 'QA'], ['REUNION', 'RE'], ['ROMANIA', 'RO'], ['RUSSIA', 'RU'], ['RWANDA', 'RW'],
  ['SAINT BARTHELEMY', 'BL'], ['SAINT HELENA', 'SH'], ['SAINT KITTS AND NEVIS', 'KN'], ['SAINT LUCIA', 'LC'],
  ['SAINT MARTIN', 'MF'], ['SAINT PIERRE AND MIQUELON', 'PM'], ['SAINT VINCENT AND THE GRENADINES', 'VC'],
  ['SAMOA', 'WS'], ['SAN MARINO', 'SM'], ['SAO TOME AND PRINCIPE', 'ST'], ['SAUDI ARABIA', 'SA'],
  ['SENEGAL', 'SN'], ['SERBIA', 'RS'], ['SEYCHELLES', 'SC'], ['SIERRA LEONE', 'SL'], ['SINGAPORE', 'SG'],
  ['SINT MAARTEN', 'SX'], ['SLOVAKIA', 'SK'], ['SLOVENIA', 'SI'], ['SOLOMON ISLANDS', 'SB'], ['SOMALIA', 'SO'],
  ['SOUTH AFRICA', 'ZA'], ['SOUTH GEORGIA', 'GS'], ['SOUTH SUDAN', 'SS'], ['SPAIN', 'ES'], ['SRI LANKA', 'LK'],
  ['SUDAN', 'SD'], ['SURINAME', 'SR'], ['SVALBARD AND JAN MAYEN', 'SJ'], ['SWEDEN', 'SE'], ['SWITZERLAND', 'CH'],
  ['SYRIA', 'SY'], ['TAIWAN', 'TW'], ['TAJIKISTAN', 'TJ'], ['TANZANIA', 'TZ'], ['THAILAND', 'TH'],
  ['TIMOR-LESTE', 'TL'], ['TOGO', 'TG'], ['TOKELAU', 'TK'], ['TONGA', 'TO'], ['TRINIDAD AND TOBAGO', 'TT'],
  ['TUNISIA', 'TN'], ['TURKEY', 'TR'], ['TURKMENISTAN', 'TM'], ['TURKS AND CAICOS ISLANDS', 'TC'],
  ['TUVALU', 'TV'], ['UGANDA', 'UG'], ['UKRAINE', 'UA'], ['UNITED ARAB EMIRATES', 'AE'],
  ['UNITED KINGDOM', 'GB'], ['UNITED STATES', 'US'], ['UNITED STATES MINOR OUTLYING ISLANDS', 'UM'],
  ['URUGUAY', 'UY'], ['UZBEKISTAN', 'UZ'], ['VANUATU', 'VU'], ['VENEZUELA', 'VE'], ['VIETNAM', 'VN'],
  ['VIRGIN ISLANDS (BRITISH)', 'VG'], ['VIRGIN ISLANDS (U.S.)', 'VI'], ['WALLIS AND FUTUNA', 'WF'],
  ['WESTERN SAHARA', 'EH'], ['YEMEN', 'YE'], ['ZAMBIA', 'ZM'], ['ZIMBABWE', 'ZW'], ['KOSOVO', 'XK']
]

let tableEnsured = false
async function ensureCountryCodesTable() {
  if (tableEnsured) return
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS country_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        country_name VARCHAR(150) NOT NULL UNIQUE,
        country_code VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)
    tableEnsured = true
  } catch (err) {
    console.error('ensureCountryCodesTable error:', err.message)
  }
}

/**
 * Get all country code mappings and return dictionary for quick lookup
 */
export const getCountryCodes = async (req, res) => {
  try {
    await ensureCountryCodesTable()
    let rows = []
    try {
      rows = await query('SELECT * FROM country_codes ORDER BY country_name ASC')
    } catch (e) {
      console.warn('Could not query country_codes table, using defaults:', e.message)
    }

    const lookupMap = {}

    const ALIAS_MAP = {
      'FRA': 'FRANCE', 'DUBAI': 'UNITED ARAB EMIRATES', 'DXB': 'UNITED ARAB EMIRATES',
      'SHARJAH': 'UNITED ARAB EMIRATES', 'ABU DHABI': 'UNITED ARAB EMIRATES', 'AJMAN': 'UNITED ARAB EMIRATES',
      'DEU': 'GERMANY', 'GER': 'GERMANY', 'CAN': 'CANADA', 'SGP': 'SINGAPORE', 'SIN': 'SINGAPORE',
      'USA': 'UNITED STATES', 'US': 'UNITED STATES', 'UK': 'UNITED KINGDOM', 'GBR': 'UNITED KINGDOM',
      'IND': 'INDIA', 'IN': 'INDIA', 'AUS': 'AUSTRALIA', 'JPN': 'JAPAN', 'NLD': 'NETHERLANDS', 'NZL': 'NEW ZEALAND'
    }

    const CODE_MAP = {
      'FRA': 'FR', 'DUBAI': 'AE', 'DXB': 'AE', 'SHARJAH': 'AE', 'ABU DHABI': 'AE', 'AJMAN': 'AE',
      'DEU': 'DE', 'GER': 'DE', 'CAN': 'CA', 'SGP': 'SG', 'SIN': 'SG',
      'USA': 'US', 'UK': 'GB', 'GBR': 'GB', 'IND': 'IN', 'AUS': 'AU', 'JPN': 'JP', 'NLD': 'NL', 'NZL': 'NZ'
    }

    const rowsList = Array.isArray(rows) ? rows : []
    const cleanedList = []
    const seenNames = new Set()

    rowsList.forEach(row => {
      if (row && row.country_name) {
        let name = String(row.country_name).replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim().toUpperCase()
        name = name.replace(/\s*[-–—]\s*[A-Z]{2,3}$/i, '').trim()
        if (!name || name === '-' || name === '—') return

        let code = String(row.country_code || '').trim().toUpperCase()
        if (ALIAS_MAP[name]) name = ALIAS_MAP[name]
        if (CODE_MAP[code]) code = CODE_MAP[code]
        if (!code && CODE_MAP[name]) code = CODE_MAP[name]

        lookupMap[name] = code || row.country_code
        if (row.country_name) {
          lookupMap[String(row.country_name).trim().toUpperCase()] = code || row.country_code
        }

        if (!seenNames.has(name)) {
          seenNames.add(name)
          cleanedList.push({
            ...row,
            country_name: name,
            country_code: code || row.country_code
          })
        }
      }
    })

    // Fallback: add any missing countries from DEFAULT_ISO_COUNTRIES
    DEFAULT_ISO_COUNTRIES.forEach(([name, code]) => {
      if (!seenNames.has(name)) {
        seenNames.add(name)
        cleanedList.push({
          country_name: name,
          country_code: code
        })
      }
      if (!lookupMap[name]) {
        lookupMap[name] = code
      }
    })

    // Sort alphabetically by country_name
    cleanedList.sort((a, b) => a.country_name.localeCompare(b.country_name))

    return res.json({
      success: true,
      countryCodes: cleanedList,
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
