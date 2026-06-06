import supabase from '../../config/supabase.js'

export const searchTracking = async (req, res) => {
  try {
    const { tracking_number } = req.query

    if (!tracking_number) {
      return res.status(400).json({
        success: false,
        message: 'Tracking number is required'
      })
    }

    const { data: shipment, error } = await supabase
      .from('shipments')
      .select(
        `
        *,
        senders(*),
        receivers(*),
        courier_providers(*)
      `
      )
      .eq('tracking_number', tracking_number)
      .single()

    if (error || !shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      })
    }

    const { data: events, error: eventsError } = await supabase
      .from('tracking_events')
      .select('*')
      .eq('shipment_id', shipment.id)
      .order('event_time', { ascending: false })

    if (eventsError) throw eventsError

    return res.json({
      success: true,
      shipment: {
        ...shipment,
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
