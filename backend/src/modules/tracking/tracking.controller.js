import { query } from '../../config/db.js'

export const searchTracking = async (req, res) => {
  try {
    const { tracking_number } = req.query

    if (!tracking_number) {
      return res.status(400).json({
        success: false,
        message: 'Tracking number is required'
      })
    }

    // Fetch shipment with JOINs
    const rows = await query(
      `SELECT s.*,
        JSON_OBJECT(
          'id', snd.id, 'name', snd.name, 'phone', snd.phone, 'email', snd.email,
          'address', snd.address, 'city', snd.city, 'state', snd.state, 'pincode', snd.pincode
        ) as senders,
        JSON_OBJECT(
          'id', rcv.id, 'name', rcv.name, 'phone', rcv.phone, 'email', rcv.email,
          'address', rcv.address, 'city', rcv.city, 'state', rcv.state, 'pincode', rcv.pincode
        ) as receivers,
        JSON_OBJECT(
          'id', cp.id, 'name', cp.name, 'code', cp.code, 'tracking_url', cp.tracking_url
        ) as courier_providers
       FROM shipments s
       LEFT JOIN senders snd ON s.sender_id = snd.id
       LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
       LEFT JOIN courier_providers cp ON s.courier_provider_id = cp.id
       WHERE s.tracking_number = ?
       LIMIT 1`,
      [tracking_number]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      })
    }

    const { senders, receivers, courier_providers, ...shipment } = rows[0]

    // Get tracking events
    const events = await query(
      'SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY event_time DESC',
      [shipment.id]
    )

    return res.json({
      success: true,
      shipment: {
        ...shipment,
        senders: senders?.id ? senders : null,
        receivers: receivers?.id ? receivers : null,
        courier_providers: courier_providers?.id ? courier_providers : null,
        tracking_events: events
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}
