const isDpd = value => /(?:^|[^a-z0-9])dpd(?:[^a-z0-9]|$)/i.test(String(value || ''))
const isNumberedLabel = name => /^\d{14}(?:_\d+)+_label_\d+\.pdf$/i.test(name)

export function getForwarderLabels(booking, trackingCarrier) {
  let raw = booking?.vendor_raw_response
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!raw || typeof raw !== 'object') return []

  const response = raw.Response || raw.response
  const sections = [raw, raw.data, response, response?.data].filter(Boolean)
  const acx = [booking.vac_vendor_code, booking.vendor_api_configs?.vendor_code, booking.vendor_code]
    .some(code => /^acx(?:_?international|intl|_courier)?$/i.test(code || ''))
  const hasDpdCarrier = [trackingCarrier, booking.secondary_carrier].some(isDpd)
    || [booking.forwarding_no, booking.vendor_awb_number_2].some(number => /^026\d{11}$/.test(String(number || '').trim()))
    || sections.some(section =>
      [section.secondary_carrier, section.forwarding_carrier, section.ForwardingCarrier, section.carrier].some(isDpd)
      || [section.forwording_no, section.forwarding_no].some(number => /^026\d{11}$/.test(String(number || '').trim()))
    )
  const documents = new Map()

  const addLabel = (item, name, dpd) => {
    const source = typeof item === 'string' ? item : item?.label || item?.pdf || item?.label_url || item?.url
    const value = typeof source === 'string' ? source.trim() : ''
    if (!/^(?:https?:\/\/|(?:data:application\/pdf;base64,)?JVBERi0)/i.test(value)) return
    if (!documents.has(value) || dpd) {
      documents.set(value, { name, value, title: dpd ? 'DPD Label' : 'Forwarder Label' })
    }
  }

  for (const section of sections) {
    for (const [key, value] of Object.entries(section)) {
      if (/^dpd_?label(?:_?url)?$/i.test(key)) addLabel(value, 'DPD_Label.pdf', true)
    }
    if (!Array.isArray(section.labels)) continue

    for (const label of section.labels) {
      const name = String(label?.filename || label?.file_name || label?.name || '')
      const dpd = [name, label?.carrier, label?.type].some(isDpd) || /^dpdlabel/i.test(name)
      if (dpd || ((acx || hasDpdCarrier) && isNumberedLabel(name))) {
        addLabel(label, name || 'DPD_Label.pdf', dpd || hasDpdCarrier)
      }
    }
  }

  return [...documents.values()]
}
