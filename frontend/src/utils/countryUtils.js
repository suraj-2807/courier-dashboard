/**
 * Universal Country Map and Utilities
 * Provides comprehensive ISO 3166-1 alpha-2, alpha-3, and alias resolution to full country names and codes.
 */

export const ISO_COUNTRY_MAP = {
  // Complete ISO 3166-1 alpha-2 countries and territories (249 total)
  AF: 'AFGHANISTAN', AX: 'ALAND ISLANDS', AL: 'ALBANIA', DZ: 'ALGERIA', AS: 'AMERICAN SAMOA', AD: 'ANDORRA',
  AO: 'ANGOLA', AI: 'ANGUILLA', AQ: 'ANTARCTICA', AG: 'ANTIGUA AND BARBUDA', AR: 'ARGENTINA', AM: 'ARMENIA',
  AW: 'ARUBA', AU: 'AUSTRALIA', AT: 'AUSTRIA', AZ: 'AZERBAIJAN', BS: 'BAHAMAS', BH: 'BAHRAIN',
  BD: 'BANGLADESH', BB: 'BARBADOS', BY: 'BELARUS', BE: 'BELGIUM', BZ: 'BELIZE', BJ: 'BENIN',
  BM: 'BERMUDA', BT: 'BHUTAN', BO: 'BOLIVIA', BA: 'BOSNIA AND HERZEGOVINA', BW: 'BOTSWANA', BV: 'BOUVET ISLAND',
  BR: 'BRAZIL', IO: 'BRITISH INDIAN OCEAN TERRITORY', BN: 'BRUNEI', BG: 'BULGARIA', BF: 'BURKINA FASO', BI: 'BURUNDI',
  KH: 'CAMBODIA', CM: 'CAMEROON', CA: 'CANADA', CV: 'CAPE VERDE', KY: 'CAYMAN ISLANDS', CF: 'CENTRAL AFRICAN REPUBLIC',
  TD: 'CHAD', CL: 'CHILE', CN: 'CHINA', CX: 'CHRISTMAS ISLAND', CC: 'COCOS (KEELING) ISLANDS', CO: 'COLOMBIA',
  KM: 'COMOROS', CG: 'CONGO', CD: 'CONGO (DRC)', CK: 'COOK ISLANDS', CR: 'COSTA RICA', CI: 'IVORY COAST',
  HR: 'CROATIA', CU: 'CUBA', CW: 'CURACAO', CY: 'CYPRUS', CZ: 'CZECH REPUBLIC', DK: 'DENMARK',
  DJ: 'DJIBOUTI', DM: 'DOMINICA', DO: 'DOMINICAN REPUBLIC', EC: 'ECUADOR', EG: 'EGYPT', SV: 'EL SALVADOR',
  GQ: 'EQUATORIAL GUINEA', ER: 'ERITREA', EE: 'ESTONIA', SZ: 'ESWATINI', ET: 'ETHIOPIA', FK: 'FALKLAND ISLANDS',
  FO: 'FAROE ISLANDS', FJ: 'FIJI', FI: 'FINLAND', FR: 'FRANCE', GF: 'FRENCH GUIANA', PF: 'FRENCH POLYNESIA',
  TF: 'FRENCH SOUTHERN TERRITORIES', GA: 'GABON', GM: 'GAMBIA', GE: 'GEORGIA', DE: 'GERMANY', GH: 'GHANA',
  GI: 'GIBRALTAR', GR: 'GREECE', GL: 'GREENLAND', GD: 'GRENADA', GP: 'GUADELOUPE', GU: 'GUAM',
  GT: 'GUATEMALA', GG: 'GUERNSEY', GN: 'GUINEA', GW: 'GUINEA-BISSAU', GY: 'GUYANA', HT: 'HAITI',
  HM: 'HEARD ISLAND AND MCDONALD ISLANDS', VA: 'VATICAN CITY', HN: 'HONDURAS', HK: 'HONG KONG', HU: 'HUNGARY',
  IS: 'ICELAND', IN: 'INDIA', ID: 'INDONESIA', IR: 'IRAN', IQ: 'IRAQ', IE: 'IRELAND',
  IM: 'ISLE OF MAN', IL: 'ISRAEL', IT: 'ITALY', JM: 'JAMAICA', JP: 'JAPAN', JE: 'JERSEY',
  JO: 'JORDAN', KZ: 'KAZAKHSTAN', KE: 'KENYA', KI: 'KIRIBATI', KP: 'NORTH KOREA', KR: 'SOUTH KOREA',
  KW: 'KUWAIT', KG: 'KYRGYZSTAN', LA: 'LAOS', LV: 'LATVIA', LB: 'LEBANON', LS: 'LESOTHO',
  LR: 'LIBERIA', LY: 'LIBYA', LI: 'LIECHTENSTEIN', LT: 'LITHUANIA', LU: 'LUXEMBOURG', MO: 'MACAU',
  MG: 'MADAGASCAR', MW: 'MALAWI', MY: 'MALAYSIA', MV: 'MALDIVES', ML: 'MALI', MT: 'MALTA',
  MH: 'MARSHALL ISLANDS', MQ: 'MARTINIQUE', MR: 'MAURITANIA', MU: 'MAURITIUS', YT: 'MAYOTTE', MX: 'MEXICO',
  FM: 'MICRONESIA', MD: 'MOLDOVA', MC: 'MONACO', MN: 'MONGOLIA', ME: 'MONTENEGRO', MS: 'MONTSERRAT',
  MA: 'MOROCCO', MZ: 'MOZAMBIQUE', MM: 'MYANMAR', NA: 'NAMIBIA', NR: 'NAURU', NP: 'NEPAL',
  NL: 'NETHERLANDS', NC: 'NEW CALEDONIA', NZ: 'NEW ZEALAND', NI: 'NICARAGUA', NE: 'NIGER', NG: 'NIGERIA',
  NU: 'NIUE', NF: 'NORFOLK ISLAND', MK: 'NORTH MACEDONIA', MP: 'NORTHERN MARIANA ISLANDS', NO: 'NORWAY',
  OM: 'OMAN', PK: 'PAKISTAN', PW: 'PALAU', PS: 'PALESTINE', PA: 'PANAMA', PG: 'PAPUA NEW GUINEA',
  PY: 'PARAGUAY', PE: 'PERU', PH: 'PHILIPPINES', PN: 'PITCAIRN', PL: 'POLAND', PT: 'PORTUGAL',
  PR: 'PUERTO RICO', QA: 'QATAR', RE: 'REUNION', RO: 'ROMANIA', RU: 'RUSSIA', RW: 'RWANDA',
  BL: 'SAINT BARTHELEMY', SH: 'SAINT HELENA', KN: 'SAINT KITTS AND NEVIS', LC: 'SAINT LUCIA',
  MF: 'SAINT MARTIN', PM: 'SAINT PIERRE AND MIQUELON', VC: 'SAINT VINCENT AND THE GRENADINES',
  WS: 'SAMOA', SM: 'SAN MARINO', ST: 'SAO TOME AND PRINCIPE', SA: 'SAUDI ARABIA', SN: 'SENEGAL',
  RS: 'SERBIA', SC: 'SEYCHELLES', SL: 'SIERRA LEONE', SG: 'SINGAPORE', SX: 'SINT MAARTEN',
  SK: 'SLOVAKIA', SI: 'SLOVENIA', SB: 'SOLOMON ISLANDS', SO: 'SOMALIA', ZA: 'SOUTH AFRICA',
  GS: 'SOUTH GEORGIA', SS: 'SOUTH SUDAN', ES: 'SPAIN', LK: 'SRI LANKA', SD: 'SUDAN',
  SR: 'SURINAME', SJ: 'SVALBARD AND JAN MAYEN', SE: 'SWEDEN', CH: 'SWITZERLAND', SY: 'SYRIA',
  TW: 'TAIWAN', TJ: 'TAJIKISTAN', TZ: 'TANZANIA', TH: 'THAILAND', TL: 'TIMOR-LESTE',
  TG: 'TOGO', TK: 'TOKELAU', TO: 'TONGA', TT: 'TRINIDAD AND TOBAGO', TN: 'TUNISIA',
  TR: 'TURKEY', TM: 'TURKMENISTAN', TC: 'TURKS AND CAICOS ISLANDS', TV: 'TUVALU', UG: 'UGANDA',
  UA: 'UKRAINE', AE: 'UNITED ARAB EMIRATES', GB: 'UNITED KINGDOM', US: 'UNITED STATES',
  UM: 'UNITED STATES MINOR OUTLYING ISLANDS', UY: 'URUGUAY', UZ: 'UZBEKISTAN', VU: 'VANUATU',
  VE: 'VENEZUELA', VN: 'VIETNAM', VG: 'VIRGIN ISLANDS (BRITISH)', VI: 'VIRGIN ISLANDS (U.S.)',
  WF: 'WALLIS AND FUTUNA', EH: 'WESTERN SAHARA', YE: 'YEMEN', ZM: 'ZAMBIA', ZW: 'ZIMBABWE',
  XK: 'KOSOVO',

  // Common 3-letter ISO and aliases
  IND: 'INDIA', ARE: 'UNITED ARAB EMIRATES', UAE: 'UNITED ARAB EMIRATES', SAU: 'SAUDI ARABIA',
  KSA: 'SAUDI ARABIA', QAT: 'QATAR', KWT: 'KUWAIT', OMN: 'OMAN', BHR: 'BAHRAIN', SGP: 'SINGAPORE',
  SIN: 'SINGAPORE', MYS: 'MALAYSIA', MAS: 'MALAYSIA', THA: 'THAILAND', IDN: 'INDONESIA',
  PHL: 'PHILIPPINES', VNM: 'VIETNAM', CHN: 'CHINA', HKG: 'HONG KONG', JPN: 'JAPAN',
  KOR: 'SOUTH KOREA', LKA: 'SRI LANKA', BGD: 'BANGLADESH', NPL: 'NEPAL', PAK: 'PAKISTAN',
  BTN: 'BHUTAN', MDV: 'MALDIVES', TWN: 'TAIWAN', ISR: 'ISRAEL', JOR: 'JORDAN', LBN: 'LEBANON',
  TUR: 'TURKEY', USA: 'UNITED STATES', CAN: 'CANADA', MEX: 'MEXICO', PRI: 'PUERTO RICO',
  GBR: 'UNITED KINGDOM', UK: 'UNITED KINGDOM', DEU: 'GERMANY', GER: 'GERMANY', FRA: 'FRANCE',
  ITA: 'ITALY', ESP: 'SPAIN', NLD: 'NETHERLANDS', HOL: 'NETHERLANDS', BEL: 'BELGIUM',
  CHE: 'SWITZERLAND', SUI: 'SWITZERLAND', AUT: 'AUSTRIA', SWE: 'SWEDEN', NOR: 'NORWAY',
  DNK: 'DENMARK', FIN: 'FINLAND', IRL: 'IRELAND', PRT: 'PORTUGAL', POR: 'PORTUGAL',
  POL: 'POLAND', GRC: 'GREECE', CZE: 'CZECH REPUBLIC', HUN: 'HUNGARY', ROU: 'ROMANIA',
  BGR: 'BULGARIA', HRV: 'CROATIA', CYP: 'CYPRUS', RUS: 'RUSSIA', UKR: 'UKRAINE',
  AUS: 'AUSTRALIA', NZL: 'NEW ZEALAND', FJI: 'FIJI', MWI: 'MALAWI', ZMB: 'ZAMBIA',
  ZWE: 'ZIMBABWE', MOZ: 'MOZAMBIQUE', TZA: 'TANZANIA', KEN: 'KENYA', UGA: 'UGANDA',
  RWA: 'RWANDA', COD: 'DR CONGO', ZAF: 'SOUTH AFRICA', RSA: 'SOUTH AFRICA', NGA: 'NIGERIA',
  GHA: 'GHANA', MUS: 'MAURITIUS', SYC: 'SEYCHELLES', EGY: 'EGYPT', ETH: 'ETHIOPIA',
  BWA: 'BOTSWANA', NAM: 'NAMIBIA', SWZ: 'ESWATINI', LSO: 'LESOTHO', MDG: 'MADAGASCAR',
  MAR: 'MOROCCO', BRA: 'BRAZIL', ARG: 'ARGENTINA', CHL: 'CHILE', COL: 'COLOMBIA',
  PER: 'PERU', ECU: 'ECUADOR',
  // Common UAE emirate city destinations
  DUBAI: 'UNITED ARAB EMIRATES', DXB: 'UNITED ARAB EMIRATES',
  SHARJAH: 'UNITED ARAB EMIRATES', SHJ: 'UNITED ARAB EMIRATES',
  'ABU DHABI': 'UNITED ARAB EMIRATES', ABUDHABI: 'UNITED ARAB EMIRATES', AUH: 'UNITED ARAB EMIRATES',
  AJMAN: 'UNITED ARAB EMIRATES', FUJAIRAH: 'UNITED ARAB EMIRATES',
  'RAS AL KHAIMAH': 'UNITED ARAB EMIRATES', 'UMM AL QUWAIN': 'UNITED ARAB EMIRATES'
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
  if (clean === '—' || clean === '–' || clean === '-' || clean === 'NULL' || clean === 'UNDEFINED' || clean === 'N/A' || clean === 'NONE') return ''

  // Strip trailing "- XX" (e.g. "INDIA - IN" -> "INDIA") and surrounding hyphens/dashes
  clean = clean.replace(/\s*[-–—]\s*[A-Z]{2,3}$/i, '').replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim()
  if (!clean || clean === '-' || clean === '–' || clean === '—') return ''

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
      const cName = found.country_name.trim().toUpperCase().replace(/\s*[-–—]\s*[A-Z]{2,3}$/i, '').replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim()
      if (ISO_COUNTRY_MAP[cName]) return ISO_COUNTRY_MAP[cName]
      if (cName.length > 3) return cName
    }
  }

  // 3. Handle combined formats e.g. "DUBAI, UAE" or "PARIS, FRANCE" or "FRANKFURT - DEU"
  if (clean.includes(',') || clean.includes(' - ') || clean.includes(' – ') || clean.includes(' — ') || clean.includes('/')) {
    const parts = clean.split(/[,/–—\-]+/).map(p => p.trim()).filter(Boolean)
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

  return clean.replace(/^[\s\-–—]+|[\s\-–—]+$/g, '')
}

/**
 * Returns the 2-letter ISO country code for any full name or code input.
 * E.g. "UNITED STATES" -> "US", "INDIA" -> "IN", "DUBAI" -> "AE", "FRA" -> "FR", "DEU" -> "DE"
 */
export function getCountryCode(codeOrName, customCountryList = []) {
  if (!codeOrName) return ''
  let clean = String(codeOrName).trim().toUpperCase()
  if (clean === '—' || clean === '–' || clean === '-' || clean === 'NULL' || clean === 'UNDEFINED' || clean === 'N/A' || clean === 'NONE') return ''

  clean = clean.replace(/\s*[-–—]\s*[A-Z]{2,3}$/i, '').replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim()
  if (!clean || clean === '-' || clean === '–' || clean === '—') return ''

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
