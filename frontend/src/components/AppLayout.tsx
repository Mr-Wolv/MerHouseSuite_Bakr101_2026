import {
  Boxes,
  Building2,
  ClipboardList,
  ClipboardCheck,
  FileSearch,
  Handshake,
  LogOut,
  Bell,
  PackageCheck,
  RadioTower,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'

const adminNav = [
  { to: '/admin', label: 'Overview', icon: Building2 },
  { to: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/access-requests', label: 'Access', icon: ClipboardCheck },
  { to: '/admin/relationships', label: 'Relations', icon: Handshake },
  { to: '/service-accountability', label: 'Service', icon: Handshake },
  { to: '/admin/outbox', label: 'Outbox', icon: RadioTower },
  { to: '/admin/audit', label: 'Audit', icon: FileSearch },
  { to: '/notifications', label: 'Alerts', icon: Bell },
]

const navByRole = {
  OWNER: adminNav,
  ADMIN: [
    ...adminNav,
  ],
  SUPPORT_ADMIN: adminNav.filter((item) => item.to !== '/admin/tenants'),
  AUDITOR: adminNav.filter(
    (item) => item.to !== '/admin/tenants' && item.to !== '/admin/users' && item.to !== '/admin/access-requests',
  ),
  MERCHANT: [
    { to: '/merchant', label: 'Overview', icon: ClipboardList },
    { to: '/merchant/inventory', label: 'Inventory', icon: Boxes },
    { to: '/merchant/orders', label: 'Orders', icon: ClipboardList },
    { to: '/service-accountability', label: 'Service', icon: Handshake },
    { to: '/notifications', label: 'Alerts', icon: Bell },
  ],
  WAREHOUSE_OPERATOR: [
    { to: '/warehouse', label: 'Warehouse', icon: PackageCheck },
    { to: '/service-accountability', label: 'Service', icon: Handshake },
    { to: '/notifications', label: 'Alerts', icon: Bell },
  ],
}

export function AppLayout() {
  const { token, user, logout } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const navItems = user ? navByRole[user.role] : []

  const refreshNotificationSummary = useCallback(async () => {
    if (!token) {
      setUnreadCount(0)
      return
    }
    try {
      const summary = await api.notificationSummary(token)
      setUnreadCount(summary.unreadCount)
    } catch {
      setUnreadCount(0)
    }
  }, [token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshNotificationSummary()
    }, 0)
    const interval = window.setInterval(() => {
      void refreshNotificationSummary()
    }, 15000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [refreshNotificationSummary])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div>
            <strong>MerHouse</strong>
            <span>Operations Console</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end className="nav-link">
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                {item.to === '/notifications' && unreadCount > 0 ? (
                  <span className="nav-count" aria-label={`${unreadCount} unread alerts`}>{unreadCount}</span>
                ) : null}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">{user?.role.replaceAll('_', ' ')}</span>
            <strong>{user?.email}</strong>
          </div>
          <button className="icon-text-button" type="button" onClick={logout}>
            <LogOut size={18} aria-hidden="true" />
            <span>Logout</span>
          </button>
        </header>

        <section className="content-shell" id="main-content" tabIndex={-1}>
          <Outlet />
        </section>
      </main>
    </div>
  )
}
