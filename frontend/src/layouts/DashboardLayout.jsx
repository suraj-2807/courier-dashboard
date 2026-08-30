import { useState, useEffect } from 'react'
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
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  UserCheck
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Shipments', path: '/bookings', icon: Package },
  { label: 'Customers', path: '/customers', icon: UserCheck },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })
  const [profileOpen, setProfileOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem('sidebar_collapsed', String(next))
      } catch {}
      return next
    })
  }

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
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-navy flex flex-col transition-all duration-300 ease-in-out select-none
          ${sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[232px]'}
          w-[232px]
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
        <div className={`pt-6 pb-4 ${sidebarCollapsed ? 'px-3 text-center' : 'px-4'}`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? 'mx-auto' : ''}`}>
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
                <Truck className="w-4 h-4 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <h1 className="text-[14px] text-white font-extrabold leading-none tracking-tight truncate">
                    Prince Courier
                  </h1>
                  <p className="text-[8.5px] text-white/40 font-semibold tracking-[2.5px] uppercase mt-0.5">
                    Express
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Collapse Toggle */}
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                className="hidden lg:flex p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* New Shipment CTA */}
        <div className={`mb-4 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          <Link
            to="/bookings/new"
            title="New Shipment"
            className={`flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]
              ${sidebarCollapsed ? 'w-10 h-10 mx-auto' : 'gap-2 w-full py-2.5 text-[13px]'}`}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {!sidebarCollapsed && <span>New Shipment</span>}
          </Link>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const active = isActive(item.path)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => setSidebarOpen(false)}
                className={`group relative flex items-center rounded-xl text-[13px] font-medium transition-all duration-150
                  ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-[9px]'}
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
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom Collapse Toggle & Nav */}
        <div className="px-2 pb-4 space-y-0.5 border-t border-white/[0.06] pt-2 mt-1">
          {bottomNav.map((item) => {
            const active = isActive(item.path)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => setSidebarOpen(false)}
                className={`group relative flex items-center rounded-xl text-[13px] font-medium transition-all duration-150
                  ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-[9px]'}
                  ${active
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                  }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={active ? 2 : 1.5} />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}

          {/* Desktop Expand Button when collapsed */}
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex items-center justify-center w-full p-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer mt-1"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-[60px] bg-surface border-b border-border flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5 text-text-secondary" />
            </button>

            {/* Desktop Quick Sidebar Collapse Button */}
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex p-2 rounded-xl text-text-secondary hover:text-navy hover:bg-surface-hover transition-colors cursor-pointer"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-[18px] h-[18px]" />
              ) : (
                <PanelLeftClose className="w-[18px] h-[18px]" />
              )}
            </button>

            {/* Enhanced Global Search */}
            <form
              onSubmit={handleGlobalSearch}
              className="flex items-center gap-2 bg-surface-alt border border-border rounded-xl px-3.5 py-[7px] w-[220px] sm:w-[360px] lg:w-[420px] focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all shadow-2xs"
            >
              <Search className="w-[15px] h-[15px] text-text-tertiary flex-shrink-0" />
              <input
                type="text"
                placeholder="Search AWB, Vendor AWB, Shipper, Consignee, Date..."
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

