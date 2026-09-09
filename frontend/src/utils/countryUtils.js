/**
 * Universal Country Map and Utilities
 * Provides comprehensive ISO 3166-1 alpha-2, alpha-3, and alias resolution to full country names and codes.
 */

export const ISO_COUNTRY_MAP = {
  // Asia
  IN: 'INDIA',
  IND: 'INDIA',
  AE: 'UNITED ARAB EMIRATES',
  ARE: 'UNITED ARAB EMIRATES',
  UAE: 'UNITED ARAB EMIRATES',
  SA: 'SAUDI ARABIA',
  SAU: 'SAUDI ARABIA',
  KSA: 'SAUDI ARABIA',
  QA: 'QATAR',
  QAT: 'QATAR',
  KW: 'KUWAIT',
  KWT: 'KUWAIT',
  OM: 'OMAN',
  OMN: 'OMAN',
  BH: 'BAHRAIN',
  BHR: 'BAHRAIN',
  SG: 'SINGAPORE',
  SGP: 'SINGAPORE',
  MY: 'MALAYSIA',
  MYS: 'MALAYSIA',
  TH: 'THAILAND',
  THA: 'THAILAND',
  ID: 'INDONESIA',
  IDN: 'INDONESIA',
  PH: 'PHILIPPINES',
  PHL: 'PHILIPPINES',
  VN: 'VIETNAM',
  VNM: 'VIETNAM',
  CN: 'CHINA',
  CHN: 'CHINA',
  HK: 'HONG KONG',
  HKG: 'HONG KONG',
  JP: 'JAPAN',
  JPN: 'JAPAN',
  KR: 'SOUTH KOREA',
  KOR: 'SOUTH KOREA',
  LK: 'SRI LANKA',
  LKA: 'SRI LANKA',
  BD: 'BANGLADESH',
  BGD: 'BANGLADESH',
  NP: 'NEPAL',
  NPL: 'NEPAL',
  PK: 'PAKISTAN',
  PAK: 'PAKISTAN',
  BT: 'BHUTAN',
  BTN: 'BHUTAN',
  MV: 'MALDIVES',
  MDV: 'MALDIVES',
  TW: 'TAIWAN',
  TWN: 'TAIWAN',
  IL: 'ISRAEL',
  ISR: 'ISRAEL',
  JO: 'JORDAN',
  JOR: 'JORDAN',
  LB: 'LEBANON',
  LBN: 'LEBANON',
  TR: 'TURKEY',
  TUR: 'TURKEY',

  // North America
  US: 'UNITED STATES',
  USA: 'UNITED STATES',
  CA: 'CANADA',
  CAN: 'CANADA',
  MX: 'MEXICO',
  MEX: 'MEXICO',
  PR: 'PUERTO RICO',
  PRI: 'PUERTO RICO',

  // Europe & UK
  GB: 'UNITED KINGDOM',
  GBR: 'UNITED KINGDOM',
  UK: 'UNITED KINGDOM',
  DE: 'GERMANY',
  DEU: 'GERMANY',
  FR: 'FRANCE',
  FRA: 'FRANCE',
  IT: 'ITALY',
  ITA: 'ITALY',
  ES: 'SPAIN',
  ESP: 'SPAIN',
  NL: 'NETHERLANDS',
  NLD: 'NETHERLANDS',
  BE: 'BELGIUM',
  BEL: 'BELGIUM',
  CH: 'SWITZERLAND',
  CHE: 'SWITZERLAND',
  AT: 'AUSTRIA',
  AUT: 'AUSTRIA',
  SE: 'SWEDEN',
  SWE: 'SWEDEN',
  NO: 'NORWAY',
  NOR: 'NORWAY',
  DK: 'DENMARK',
  DNK: 'DENMARK',
  FI: 'FINLAND',
  FIN: 'FINLAND',
  IE: 'IRELAND',
  IRL: 'IRELAND',
  PT: 'PORTUGAL',
  PRT: 'PORTUGAL',
  PL: 'POLAND',
  POL: 'POLAND',
  GR: 'GREECE',
  GRC: 'GREECE',
  CZ: 'CZECH REPUBLIC',
  CZE: 'CZECH REPUBLIC',
  HU: 'HUNGARY',
  HUN: 'HUNGARY',
  RO: 'ROMANIA',
  ROU: 'ROMANIA',
  BG: 'BULGARIA',
  BGR: 'BULGARIA',
  HR: 'CROATIA',
  HRV: 'CROATIA',
  CY: 'CYPRUS',
  CYP: 'CYPRUS',
  RU: 'RUSSIA',
  RUS: 'RUSSIA',
  UA: 'UKRAINE',
  UKR: 'UKRAINE',

  // Oceania
  AU: 'AUSTRALIA',
  AUS: 'AUSTRALIA',
  NZ: 'NEW ZEALAND',
  NZL: 'NEW ZEALAND',
  FJ: 'FIJI',
  FJI: 'FIJI',

  // Africa
  MW: 'MALAWI',
  MWI: 'MALAWI',
  ZM: 'ZAMBIA',
  ZMB: 'ZAMBIA',
  ZW: 'ZIMBABWE',
  ZWE: 'ZIMBABWE',
  MZ: 'MOZAMBIQUE',
  MOZ: 'MOZAMBIQUE',
  TZ: 'TANZANIA',
  TZA: 'TANZANIA',
  KE: 'KENYA',
  KEN: 'KENYA',
  UG: 'UGANDA',
  UGA: 'UGANDA',
  RW: 'RWANDA',
  RWA: 'RWANDA',
  CD: 'DR CONGO',
  COD: 'DR CONGO',
  ZA: 'SOUTH AFRICA',
  ZAF: 'SOUTH AFRICA',
  NG: 'NIGERIA',
  NGA: 'NIGERIA',
  GH: 'GHANA',
  GHA: 'GHANA',
  MU: 'MAURITIUS',
  MUS: 'MAURITIUS',
  SC: 'SEYCHELLES',
  SYC: 'SEYCHELLES',
  EG: 'EGYPT',
  EGY: 'EGYPT',
  ET: 'ETHIOPIA',
  ETH: 'ETHIOPIA',
  BW: 'BOTSWANA',
  BWA: 'BOTSWANA',
  NA: 'NAMIBIA',
  NAM: 'NAMIBIA',
  SZ: 'ESWATINI',
  SWZ: 'ESWATINI',
  LS: 'LESOTHO',
  LSO: 'LESOTHO',
  MG: 'MADAGASCAR',
  MDG: 'MADAGASCAR',
  MA: 'MOROCCO',
  MAR: 'MOROCCO',

  // South America
  BR: 'BRAZIL',
  BRA: 'BRAZIL',
  AR: 'ARGENTINA',
  ARG: 'ARGENTINA',
  CL: 'CHILE',
  CHL: 'CHILE',
  CO: 'COLOMBIA',
  COL: 'COLOMBIA',
  PE: 'PERU',
  PER: 'PERU',
  EC: 'ECUADOR',
  ECU: 'ECUADOR',
  // Extra 3-letter, aliases, and common city destinations
  DUBAI: 'UNITED ARAB EMIRATES',
  DXB: 'UNITED ARAB EMIRATES',
  SHARJAH: 'UNITED ARAB EMIRATES',
  SHJ: 'UNITED ARAB EMIRATES',
  'ABU DHABI': 'UNITED ARAB EMIRATES',
  ABUDHABI: 'UNITED ARAB EMIRATES',
  AUH: 'UNITED ARAB EMIRATES',
  AJMAN: 'UNITED ARAB EMIRATES',
  FUJAIRAH: 'UNITED ARAB EMIRATES',
  'RAS AL KHAIMAH': 'UNITED ARAB EMIRATES',
  'UMM AL QUWAIN': 'UNITED ARAB EMIRATES',
  GER: 'GERMANY',
  SIN: 'SINGAPORE',
  MAS: 'MALAYSIA',
  RSA: 'SOUTH AFRICA',
  HOL: 'NETHERLANDS',
  SUI: 'SWITZERLAND',
  POR: 'PORTUGAL'
}

// Inverted Map: Name -> Code
export const COUNTRY_NAME_TO_CODE = {}
Object.entries(ISO_COUNTRY_MAP).forEach(([k, v]) => {
  if (k.length === 2) {
    COUNTRY_NAME_TO_CODE[v.toUpperCase()] = k.toUpperCase()
  }
})
// Common aliases
COUNTRY_NAME_TO_CODE['UNITED STATES OF AMERICA'] = 'US'
COUNTRY_NAME_TO_CODE['AMERICA'] = 'US'
COUNTRY_NAME_TO_CODE['GREAT BRITAIN'] = 'GB'
COUNTRY_NAME_TO_CODE['ENGLAND'] = 'GB'
COUNTRY_NAME_TO_CODE['DUBAI'] = 'AE'
COUNTRY_NAME_TO_CODE['DXB'] = 'AE'
COUNTRY_NAME_TO_CODE['ABU DHABI'] = 'AE'
COUNTRY_NAME_TO_CODE['ABUDHABI'] = 'AE'
COUNTRY_NAME_TO_CODE['SHARJAH'] = 'AE'
COUNTRY_NAME_TO_CODE['AJMAN'] = 'AE'
COUNTRY_NAME_TO_CODE['FRA'] = 'FR'
COUNTRY_NAME_TO_CODE['DEU'] = 'DE'
COUNTRY_NAME_TO_CODE['GER'] = 'DE'
COUNTRY_NAME_TO_CODE['CAN'] = 'CA'
COUNTRY_NAME_TO_CODE['SGP'] = 'SG'
COUNTRY_NAME_TO_CODE['SIN'] = 'SG'

/**
 * Returns the full country name for any 2-letter, 3-letter, or name input.
 * E.g. "US" -> "UNITED STATES", "FRA" -> "FRANCE", "DUBAI" -> "UNITED ARAB EMIRATES", "DEU" -> "GERMANY"
 */
export function getFullCountryName(codeOrName, customCountryList = []) {
  if (!codeOrName) return ''
  let clean = String(codeOrName).trim().toUpperCase()
  if (clean === '—' || clean === '-' || clean === 'NULL' || clean === 'UNDEFINED') return ''

  // Strip trailing - XX (e.g. "INDIA - IN" -> "INDIA") and surrounding hyphens
  clean = clean.replace(/\s*[-—]\s*[A-Z]{2,3}$/i, '').replace(/^[-—\s]+|[-—\s]+$/g, '').trim()
  if (!clean || clean === '-' || clean === '—') return ''

  // 1. Direct Static ISO Map check (prioritized to guarantee standard codes like FRA, DEU, CAN, SGP, DUBAI resolve)
  if (ISO_COUNTRY_MAP[clean]) {
    return ISO_COUNTRY_MAP[clean]
  }

  // 2. Check custom DB country list if passed
  if (Array.isArray(customCountryList) && customCountryList.length > 0) {
    const found = customCountryList.find(c => 
      (c.country_code && c.country_code.trim().toUpperCase() === clean) ||
      (c.country_name && c.country_name.trim().toUpperCase() === clean)
    )
    if (found && found.country_name) {
      const cName = found.country_name.trim().toUpperCase().replace(/\s*[-—]\s*[A-Z]{2,3}$/i, '').replace(/^[-—\s]+|[-—\s]+$/g, '').trim()
      if (ISO_COUNTRY_MAP[cName]) return ISO_COUNTRY_MAP[cName]
      if (cName.length > 3) return cName
    }
  }

  // 3. Handle combined formats e.g. "DUBAI, UAE" or "PARIS, FRANCE" or "FRANKFURT - DEU"
  if (clean.includes(',') || clean.includes(' - ') || clean.includes('/')) {
    const parts = clean.split(/[,/-]+/).map(p => p.trim()).filter(Boolean)
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      if (ISO_COUNTRY_MAP[p]) return ISO_COUNTRY_MAP[p]
    }
  }

  // 4. If it's already a full name in our values
  for (const name of Object.values(ISO_COUNTRY_MAP)) {
    if (name.toUpperCase() === clean) {
      return name
    }
  }

  return clean
}

/**
 * Returns the 2-letter ISO country code for any full name or code input.
 * E.g. "UNITED STATES" -> "US", "INDIA" -> "IN", "DUBAI" -> "AE", "FRA" -> "FR", "DEU" -> "DE"
 */
export function getCountryCode(codeOrName, customCountryList = []) {
  if (!codeOrName) return ''
  let clean = String(codeOrName).trim().toUpperCase()
  if (clean === '—' || clean === '-' || clean === 'NULL' || clean === 'UNDEFINED') return ''

  clean = clean.replace(/\s*[-—]\s*[A-Z]{2,3}$/i, '').replace(/^[-—\s]+|[-—\s]+$/g, '').trim()
  if (!clean) return ''

  // If already a 2-letter code in our map
  if (clean.length === 2 && ISO_COUNTRY_MAP[clean]) {
    return clean
  }

  // Check mapped name / alias
  if (COUNTRY_NAME_TO_CODE[clean]) {
    return COUNTRY_NAME_TO_CODE[clean]
  }

  // Check 3-letter or alias in ISO_COUNTRY_MAP
  if (ISO_COUNTRY_MAP[clean]) {
    const full = ISO_COUNTRY_MAP[clean]
    if (COUNTRY_NAME_TO_CODE[full]) return COUNTRY_NAME_TO_CODE[full]
  }

  // Check custom DB country list
  if (Array.isArray(customCountryList) && customCountryList.length > 0) {
    const found = customCountryList.find(c => 
      (c.country_name && c.country_name.trim().toUpperCase() === clean) ||
      (c.country_code && c.country_code.trim().toUpperCase() === clean)
    )
    if (found && found.country_code) {
      return found.country_code.trim().toUpperCase()
    }
  }

  // Common fallbacks
  if (clean === 'IND') return 'IN'
  if (clean === 'USA') return 'US'
  if (clean === 'GBR' || clean === 'UK') return 'GB'
  if (clean === 'ARE' || clean === 'UAE' || clean === 'DUBAI' || clean === 'DXB' || clean === 'SHARJAH' || clean === 'ABU DHABI') return 'AE'
  if (clean === 'CAN') return 'CA'
  if (clean === 'AUS') return 'AU'
  if (clean === 'FRA') return 'FR'
  if (clean === 'DEU' || clean === 'GER') return 'DE'
  if (clean === 'SGP' || clean === 'SIN') return 'SG'

  return clean.length === 2 ? clean : ''
}
