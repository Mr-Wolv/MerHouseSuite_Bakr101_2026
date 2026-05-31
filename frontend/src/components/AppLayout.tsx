import { LogOut } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { appIcons } from './AppIcons'
import { ThemeToggle } from './ThemeToggle'

const adminNav = [
  { to: '/admin', label: 'Overview', icon: appIcons.governance },
  { to: '/admin/tenants', label: 'Tenants', icon: appIcons.tenants },
  { to: '/admin/users', label: 'Users', icon: appIcons.users },
  { to: '/admin/access-requests', label: 'Access', icon: appIcons.access },
  { to: '/admin/relationships', label: 'Relations', icon: appIcons.relationships },
  { to: '/service-accountability', label: 'Service', icon: appIcons.service },
  { to: '/admin/outbox', label: 'Outbox', icon: appIcons.outbox },
  { to: '/admin/audit', label: 'Audit', icon: appIcons.audit },
  { to: '/assistant', label: 'Assistant', icon: appIcons.assistant },
  { to: '/notifications', label: 'Alerts', icon: appIcons.alerts },
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
    { to: '/merchant', label: 'Overview', icon: appIcons.operations },
    { to: '/merchant/inventory', label: 'Inventory', icon: appIcons.inventory },
    { to: '/merchant/orders', label: 'Orders', icon: appIcons.orders },
    { to: '/service-accountability', label: 'Service', icon: appIcons.service },
    { to: '/assistant', label: 'Assistant', icon: appIcons.assistant },
    { to: '/notifications', label: 'Alerts', icon: appIcons.alerts },
  ],
  WAREHOUSE_OPERATOR: [
    { to: '/warehouse', label: 'Warehouse', icon: appIcons.warehouseWork },
    { to: '/service-accountability', label: 'Service', icon: appIcons.service },
    { to: '/assistant', label: 'Assistant', icon: appIcons.assistant },
    { to: '/notifications', label: 'Alerts', icon: appIcons.alerts },
  ],
}

export function AppLayout() {
  const { token, user, logout } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const navItems = user ? navByRole[user.role] : []
  const alertLabel = unreadCount > 99 ? '99+' : String(unreadCount)

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
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" role="img">
              <path d="M8 30V10l12-6 12 6v20l-12 6-12-6Z" />
              <path d="M14 27V15l6 5 6-5v12" />
              <path d="M20 20v11" />
            </svg>
          </span>
          <div>
            <strong>MerHouse</strong>
            <span>Operations Console</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.to === '/notifications' && unreadCount > 0 ? appIcons.alertsActive : item.icon
            return (
              <NavLink key={item.to} to={item.to} end className="nav-link">
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                {item.to === '/notifications' && unreadCount > 0 ? (
                  <span className="nav-count" aria-label={`${unreadCount} unread alerts`}>{alertLabel}</span>
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
          <div className="topbar-actions">
            <ThemeToggle />
            <button className="icon-text-button" type="button" onClick={logout}>
              <LogOut size={18} aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <section className="content-shell" id="main-content" tabIndex={-1}>
          <Outlet />
        </section>
      </main>
    </div>
  )
}
