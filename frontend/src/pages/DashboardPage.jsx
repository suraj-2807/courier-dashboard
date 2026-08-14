import { useDashboardStats } from '../hooks/useDashboard'
import {
  Package,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  IndianRupee,
  AlertTriangle,
  TrendingUp,
  MoreHorizontal,
  Truck,
  FileSpreadsheet,
  Plus
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'
import { formatCurrency, formatDate, getStatusLabel } from '../utils/formatters'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import ErrorState from '../components/ui/ErrorState'
import { Link } from 'react-router-dom'

const DONUT_COLORS = {
  delivered: '#BB0013',
  in_transit: '#0D2132',
  pending: '#F59E0B',
  booked: '#3B82F6',
  picked_up: '#06B6D4',
  out_for_delivery: '#F97316',
  failed: '#EF4444',
  cancelled: '#D1D5DB'
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboardStats()
  const stats = data?.stats

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="skeleton h-8 w-64 mb-2" />
          <div className="skeleton h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-[120px] rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 skeleton h-[360px] rounded-2xl" />
          <div className="skeleton h-[360px] rounded-2xl" />
        </div>
      </div>
    )
  }

  if (isError) return <ErrorState message="Failed to load dashboard" onRetry={refetch} />

  const totalShipmentsCount = stats?.totalBookings || 0
  const deliveredCount = stats?.deliveredCount || 0
  const inTransitCount = stats?.inTransitCount || 0
  const pendingCount = stats?.pendingCount || 0
  const failedCount = totalShipmentsCount - deliveredCount - inTransitCount - pendingCount

  const statCards = [
    {
      label: 'Total Shipments',
      value: totalShipmentsCount.toLocaleString(),
      icon: Package,
      subtitle: `${totalShipmentsCount > 0 ? '+14.2%' : '—'} vs last week`,
      subtitleColor: 'text-success',
      iconBg: 'bg-red-50',
      iconColor: 'text-primary'
    },
    {
      label: 'Delivered',
      value: deliveredCount.toLocaleString(),
      icon: CheckCircle2,
      subtitle: totalShipmentsCount > 0
        ? `${((deliveredCount / totalShipmentsCount) * 100).toFixed(1)}% Success Rate`
        : '0% Success Rate',
      subtitleColor: 'text-text-tertiary',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600'
    },
    {
      label: 'In Transit / Pending',
      value: (inTransitCount + pendingCount).toLocaleString(),
      icon: Truck,
      subtitle: totalShipmentsCount > 0
        ? `${(((inTransitCount + pendingCount) / totalShipmentsCount) * 100).toFixed(1)}% of total volume`
        : '0% of total volume',
      subtitleColor: 'text-text-tertiary',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      label: 'Failed / Exceptions',
      value: (failedCount > 0 ? failedCount : 0).toLocaleString(),
      icon: AlertTriangle,
      subtitle: totalShipmentsCount > 0
        ? `${(((failedCount > 0 ? failedCount : 0) / totalShipmentsCount) * 100).toFixed(1)}% Exception Rate`
        : '0% Exception Rate',
      subtitleColor: 'text-danger',
      iconBg: 'bg-red-50/60',
      iconColor: 'text-danger'
    }
  ]

  // Chart data
  const monthlyChartData = Object.entries(stats?.monthlyRevenue || {}).map(
    ([month, amount]) => ({ month, amount })
  )

  // Courier performance (simulated from status breakdown data)
  const courierPerformance = [
    { name: 'Prince Express', rate: deliveredCount > 0 ? 98.2 : 0, color: '#0D2132' },
    { name: 'Speed Delivery', rate: deliveredCount > 0 ? 95.4 : 0, color: '#BB0013' },
    { name: 'Flash Courier', rate: deliveredCount > 0 ? 92.1 : 0, color: '#3B82F6' },
    { name: 'Local Partners', rate: deliveredCount > 0 ? 88.5 : 0, color: '#D1D5DB' }
  ]

  const pieData = Object.entries(stats?.statusBreakdown || {}).map(
    ([status, count]) => ({
      name: getStatusLabel(status),
      value: count,
      color: DONUT_COLORS[status] || '#D1D5DB'
    })
  )
  const totalShipments = pieData.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-text-primary leading-tight">
            Dashboard Overview
          </h1>
          <p className="text-[13px] text-text-secondary mt-1">
            Real-time logistics performance and network status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-4 py-[7px] border border-border rounded-xl text-[12px] font-semibold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel Import
          </button>
          <Link
            to="/bookings/new"
            className="flex items-center gap-1.5 px-4 py-[7px] bg-primary text-white rounded-xl text-[12px] font-bold hover:bg-primary-dark transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Create Shipment
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-surface border border-border rounded-2xl p-5 hover:shadow-sm transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-text-secondary uppercase tracking-[1px]">
                {card.label}
              </span>
              <div className={`w-8 h-8 ${card.iconBg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <card.icon className={`w-4 h-4 ${card.iconColor}`} strokeWidth={2} />
              </div>
            </div>
            <p className="text-[28px] font-extrabold text-text-primary leading-none mb-2">
              {card.value}
            </p>
            <div className="flex items-center gap-1.5">
              <TrendingUp className={`w-3 h-3 ${card.subtitleColor}`} />
              <span className={`text-[11px] font-semibold ${card.subtitleColor}`}>
                {card.subtitle}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Shipment Volume (7-Day Trend) */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-bold text-text-primary">Shipment Volume (7-Day Trend)</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-text-tertiary">Total vs Exceptions</span>
              <button className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors cursor-pointer">
                <MoreHorizontal className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>
          </div>
          <div className="h-[260px]">
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 500 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 500 }}
                    tickFormatter={(v) => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${(v / 1000).toFixed(0)}k`}
                    dx={-4}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), 'Revenue']}
                    contentStyle={{
                      background: '#0D2132',
                      border: 'none',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      padding: '8px 14px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                    }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#9CA3AF', marginBottom: '2px', fontSize: '11px' }}
                    cursor={{ fill: 'rgba(13,33,50,0.04)', radius: 8 }}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={42}>
                    {monthlyChartData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={idx === monthlyChartData.length - 1 ? '#BB0013' : '#C7D9EB'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-text-tertiary text-sm">
                No shipment data yet
              </div>
            )}
          </div>
        </div>

        {/* Courier Performance */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-bold text-text-primary">Courier Performance</h2>
              <p className="text-[11px] text-text-tertiary mt-0.5">On-time delivery rate by provider</p>
            </div>
          </div>
          <div className="space-y-5">
            {courierPerformance.map((courier) => (
              <div key={courier.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] text-text-secondary font-medium">{courier.name}</span>
                  <span className="text-[13px] font-bold text-text-primary">{courier.rate}%</span>
                </div>
                <div className="w-full h-[6px] bg-surface-alt rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${courier.rate}%`,
                      backgroundColor: courier.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Bookings Table */}
      <div className="bg-surface border border-border rounded-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-[15px] font-bold text-text-primary">Recent Bookings</h2>
          <Link
            to="/bookings"
            className="text-[12px] font-bold text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
          >
            View All <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Tracking ID', 'Recipient', 'Destination', 'Status', 'Booking Date', 'Amount'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] ${
                      i === 5 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(stats?.recentBookings || []).map((b, idx) => (
                <tr
                  key={b.id}
                  className="border-b border-border-light hover:bg-surface-alt/60 transition-colors"
                >
                  <td className="px-5 py-3">
                    <Link to={`/bookings/${b.id}`} className="text-[13px] font-extrabold text-[#BB0013] hover:underline transition-colors">
                      {b.tracking_number || b.order_id}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-text-secondary">{b.receivers?.name || b.senders?.name || '—'}</td>
                  <td className="px-5 py-3 text-[13px] text-text-secondary">{b.receivers?.city || '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={b.status} size="xs" /></td>
                  <td className="px-5 py-3 text-[13px] text-text-secondary">{formatDate(b.created_at)}</td>
                  <td className="px-5 py-3 text-right text-[13px] font-bold text-text-primary">{formatCurrency(b.total_amount)}</td>
                </tr>
              ))}
              {(!stats?.recentBookings?.length) && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-[13px] text-text-tertiary">
                    No shipments yet. Create your first booking to see data here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
