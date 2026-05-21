import {
  Boxes,
  Building2,
  ClipboardList,
  ClipboardCheck,
  FileSearch,
  Handshake,
  LogOut,
  PackageCheck,
  RadioTower,
  Users,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
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
  ],
  WAREHOUSE_OPERATOR: [
    { to: '/warehouse', label: 'Warehouse', icon: PackageCheck },
    { to: '/service-accountability', label: 'Service', icon: Handshake },
  ],
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const navItems = user ? navByRole[user.role] : []

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
