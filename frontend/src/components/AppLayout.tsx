import { LogOut } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { appIcons } from './AppIcons'
import { BrandMark } from './BrandMark'
import { ThemeToggle } from './ThemeToggle'
import { notificationUnreadChangedEvent } from '../notifications/notificationEvents'
import type { NotificationUnreadChangedDetail } from '../notifications/notificationEvents'

const adminNav = [
  { to: '/admin', label: 'Overview', icon: appIcons.governance },
  { to: '/admin/tenants', label: 'Organizations', icon: appIcons.tenants },
  { to: '/admin/users', label: 'Accounts', icon: appIcons.users },
  { to: '/admin/access-requests', label: 'Access requests', icon: appIcons.access },
  { to: '/admin/relationships', label: 'Partners', icon: appIcons.relationships },
  { to: '/service-accountability', label: 'Service review', icon: appIcons.service },
  { to: '/admin/outbox', label: 'Outbox', icon: appIcons.outbox },
  { to: '/admin/audit', label: 'Audit trail', icon: appIcons.audit },
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
    { to: '/merchant', label: 'Home', icon: appIcons.operations },
    { to: '/merchant/inventory', label: 'Stock', icon: appIcons.inventory },
    { to: '/merchant/orders', label: 'Orders', icon: appIcons.orders },
    { to: '/service-accountability', label: 'Service review', icon: appIcons.service },
    { to: '/assistant', label: 'Assistant', icon: appIcons.assistant },
    { to: '/notifications', label: 'Alerts', icon: appIcons.alerts },
  ],
  WAREHOUSE_OPERATOR: [
    { to: '/warehouse', label: 'Work queue', icon: appIcons.warehouseWork },
    { to: '/service-accountability', label: 'Service review', icon: appIcons.service },
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

  useEffect(() => {
    function handleUnreadChanged(event: Event) {
      const detail = (event as CustomEvent<NotificationUnreadChangedDetail>).detail
      if (!detail || typeof detail.delta !== 'number') return
      setUnreadCount((current) => Math.max(0, current + detail.delta))
    }

    window.addEventListener(notificationUnreadChangedEvent, handleUnreadChanged)
    return () => window.removeEventListener(notificationUnreadChangedEvent, handleUnreadChanged)
  }, [])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <BrandMark />
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
          <Link className="topbar-identity" to="/account" aria-label={`Account settings for ${user?.email ?? 'current user'}`}>
            <span className="eyebrow">{user?.role.replaceAll('_', ' ')}</span>
            <strong>{user?.email}</strong>
          </Link>
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
