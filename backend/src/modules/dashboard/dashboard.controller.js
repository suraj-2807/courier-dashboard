import supabase from '../../config/supabase.js'

export const getDashboardStats = async (req, res) => {
  try {
    // Total bookings
    const { count: totalBookings } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })

    // Delivered shipments
    const { count: deliveredCount } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'delivered')

    // Pending shipments
    const { count: pendingCount } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    // In transit
    const { count: inTransitCount } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_transit')

    // Total revenue
    const { data: revenueData } = await supabase
      .from('shipments')
      .select('total_amount')

    const totalRevenue = (revenueData || []).reduce(
      (sum, item) => sum + (parseFloat(item.total_amount) || 0),
      0
    )

    // Status breakdown
    const { data: allShipments } = await supabase
      .from('shipments')
      .select('status')

    const statusBreakdown = (allShipments || []).reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {})

    // Recent bookings (last 10)
    const { data: recentBookings } = await supabase
      .from('shipments')
      .select(
        `
        *,
        senders(name),
        receivers(name, city),
        courier_providers(name)
      `
      )
      .order('created_at', { ascending: false })
      .limit(10)

    // Monthly revenue (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: monthlyData } = await supabase
      .from('shipments')
      .select('total_amount, created_at')
      .gte('created_at', sixMonthsAgo.toISOString())

    const monthlyRevenue = {}
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]

    ;(monthlyData || []).forEach((item) => {
      const date = new Date(item.created_at)
      const monthKey = months[date.getMonth()]
      monthlyRevenue[monthKey] =
        (monthlyRevenue[monthKey] || 0) +
        (parseFloat(item.total_amount) || 0)
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
        recentBookings: recentBookings || [],
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
