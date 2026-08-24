import { useState } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  MapPin,
  Truck,
  Link2,
  Settings,
  HelpCircle,
  Bell,
  Search,
  Plus,
  LogOut,
  User,
  Users,
  Tag,
  ChevronDown,
  Menu,
  X,
  IndianRupee,
  ClipboardList
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Shipments', path: '/bookings', icon: Package },
  { label: 'Customer Requests', path: '/booking-requests', icon: ClipboardList },
  { label: 'Tracking', path: '/tracking', icon: MapPin },
  { label: 'Users & Contacts', path: '/users', icon: Users },
  { label: 'Products & HSN', path: '/products', icon: Tag },
  { label: 'Rates', path: '/rates', icon: IndianRupee },
  { label: 'API Settings', path: '/api-settings', icon: Settings }
]

const bottomNav = [
  { label: 'Support', path: '/support', icon: HelpCircle },
  { label: 'Settings', path: '/settings', icon: Settings }
]

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')

  const handleGlobalSearch = (e) => {
    if (e.key === 'Enter' || e.type === 'submit') {
      e.preventDefault()
      if (globalSearch.trim()) {
        navigate(`/bookings?search=${encodeURIComponent(globalSearch.trim())}`)
      }
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-alt">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-[2px]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[232px] bg-navy flex flex-col transform transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Close button mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 text-white/60 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand */}
        <div className="px-5 pt-7 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-[15px] text-white font-extrabold leading-none tracking-tight">
                Prince Courier
              </h1>
              <p className="text-[9px] text-white/40 font-semibold tracking-[2.5px] uppercase mt-0.5">
                Service
              </p>
            </div>
          </div>
        </div>

        {/* New Shipment CTA */}
        <div className="px-4 mb-5">
          <Link
            to="/bookings/new"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary hover:bg-primary-dark text-white text-[13px] font-bold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            New Shipment
          </Link>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.path)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`group relative flex items-center gap-3 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all duration-150
                  ${active
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                  }`}
              >
                {/* Active indicator bar */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={active ? 2 : 1.5} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-5 space-y-0.5 border-t border-white/[0.06] pt-3 mt-2">
          {bottomNav.map((item) => {
            const active = isActive(item.path)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`group relative flex items-center gap-3 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all duration-150
                  ${active
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                  }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={active ? 2 : 1.5} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-[60px] bg-surface border-b border-border flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5 text-text-secondary" />
            </button>

            {/* Search */}
            <form onSubmit={handleGlobalSearch} className="hidden sm:flex items-center gap-2 bg-surface-alt border border-border rounded-xl px-3.5 py-[7px] w-[340px] focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <Search className="w-[15px] h-[15px] text-text-tertiary flex-shrink-0" />
              <input
                type="text"
                placeholder="Search tracking IDs, couriers..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={handleGlobalSearch}
                className="bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary outline-none w-full"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  className="text-text-tertiary hover:text-text-secondary cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </div>

          <div className="flex items-center gap-1">
            {/* Notification */}
            <button className="relative p-2 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer">
              <Bell className="w-[18px] h-[18px] text-text-secondary" />
              <span className="absolute top-2 right-2 w-[7px] h-[7px] bg-primary rounded-full ring-2 ring-surface" />
            </button>

            {/* Help */}
            <button className="p-2 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer hidden sm:block">
              <HelpCircle className="w-[18px] h-[18px] text-text-secondary" />
            </button>

            {/* Profile */}
            <div className="relative ml-1">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 py-1 pl-1 pr-2 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-navy to-navy-light rounded-full flex items-center justify-center ring-2 ring-border">
                  <User className="w-[14px] h-[14px] text-white" />
                </div>
                <ChevronDown className="w-3 h-3 text-text-tertiary hidden sm:block" />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-12 w-52 bg-surface rounded-2xl border border-border shadow-2xl z-50 py-1 animate-slide-down">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-[13px] font-bold text-text-primary truncate">
                        {user?.name || 'Admin User'}
                      </p>
                      <p className="text-[11px] text-text-tertiary truncate">
                        {user?.email || 'admin@princecourier.com'}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-danger hover:bg-danger-bg transition-colors cursor-pointer"
                    >
                      <LogOut className="w-[14px] h-[14px]" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
