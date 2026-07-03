import { query } from '../../config/db.js'

export const getDashboardStats = async (req, res) => {
  try {
    // Total bookings
    const [totalRow] = await query(
      'SELECT COUNT(*) as count FROM shipments'
    )
    const totalBookings = totalRow.count

    // Delivered shipments
    const [deliveredRow] = await query(
      "SELECT COUNT(*) as count FROM shipments WHERE status = 'delivered'"
    )
    const deliveredCount = deliveredRow.count

    // Pending shipments
    const [pendingRow] = await query(
      "SELECT COUNT(*) as count FROM shipments WHERE status = 'pending'"
    )
    const pendingCount = pendingRow.count

    // In transit
    const [inTransitRow] = await query(
      "SELECT COUNT(*) as count FROM shipments WHERE status = 'in_transit'"
    )
    const inTransitCount = inTransitRow.count

    // Total revenue
    const [revenueRow] = await query(
      'SELECT COALESCE(SUM(total_amount), 0) as total FROM shipments'
    )
    const totalRevenue = parseFloat(revenueRow.total) || 0

    // Status breakdown
    const statusRows = await query(
      'SELECT status, COUNT(*) as count FROM shipments GROUP BY status'
    )
    const statusBreakdown = {}
    statusRows.forEach(row => {
      statusBreakdown[row.status] = row.count
    })

    // Recent bookings (last 10)
    const recentBookings = await query(
      `SELECT s.*,
        JSON_OBJECT('name', snd.name) as senders,
        JSON_OBJECT('name', rcv.name, 'city', rcv.city) as receivers,
        JSON_OBJECT('name', cp.name) as courier_providers
       FROM shipments s
       LEFT JOIN senders snd ON s.sender_id = snd.id
       LEFT JOIN receivers rcv ON s.receiver_id = rcv.id
       LEFT JOIN courier_providers cp ON s.courier_provider_id = cp.id
       ORDER BY s.created_at DESC
       LIMIT 10`
    )

    // Parse JSON objects for recent bookings
    const parsedRecentBookings = recentBookings.map(row => {
      const { senders, receivers, courier_providers, ...shipment } = row
      return {
        ...shipment,
        senders: senders?.name ? senders : null,
        receivers: receivers?.name ? receivers : null,
        courier_providers: courier_providers?.name ? courier_providers : null
      }
    })

    // Monthly revenue (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyRows = await query(
      `SELECT 
        MONTH(created_at) as month_num,
        YEAR(created_at) as year_num,
        COALESCE(SUM(total_amount), 0) as total
       FROM shipments
       WHERE created_at >= ?
       GROUP BY YEAR(created_at), MONTH(created_at)
       ORDER BY year_num, month_num`,
      [sixMonthsAgo.toISOString().split('T')[0]]
    )

    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]

    const monthlyRevenue = {}
    monthlyRows.forEach(row => {
      const monthKey = months[row.month_num - 1]
      monthlyRevenue[monthKey] = parseFloat(row.total) || 0
    })

    return res.json({
      success: true,
      stats: {
        totalBookings: totalBookings || 0,
        deliveredCount: deliveredCount || 0,
        pendingCount: pendingCount || 0,
        inTransitCount: inTransitCount || 0,
        totalRevenue,
        statusBreakdown,
        recentBookings: parsedRecentBookings,
        monthlyRevenue
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}
