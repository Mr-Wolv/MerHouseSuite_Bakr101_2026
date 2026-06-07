import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type {
  AccessRequest,
  AdminPlatformSummary,
  AdminTenantHealth,
  MerchantWarehouseRelationship,
  Order,
  Tenant,
  TenantType,
  User,
  UserRole,
  AttentionSignal,
  Warehouse,
} from '../api/types'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { shortId } from '../components/format'
import { Metric } from '../components/Metric'
import { GuidancePanel as AdminGuidancePanel, PageHeading, WorkflowDivider } from '../components/PageChrome'
import { StatusBadge } from '../components/StatusBadge'
import { AttentionQueue } from '../components/AttentionQueue'
export { AdminAuditPage } from '../features/admin/audit/AdminAuditPage'
export { AdminOutboxPage } from '../features/admin/outbox/AdminOutboxPage'

type AdminData = {
  tenants: Tenant[]
  users: User[]
  orders: Order[]
  summary: AdminPlatformSummary
  tenantHealth: AdminTenantHealth[]
}

const ADMIN_USER_PAGE_SIZE = 25

function useAdminData() {
  const { token } = useAuth()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!token) return
    Promise.all([api.tenants(token), api.users(token), api.orders(token), api.adminSummary(token), api.adminTenantHealth(token)])
      .then(([tenants, users, orders, summary, tenantHealth]) => setData({ tenants, users, orders, summary, tenantHealth }))
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load admin data.')
      })
      .finally(() => setLoading(false))
  }, [token])

  return { data, loading, error }
}

export function AdminOverviewPage() {
  const { user } = useAuth()
  const { data, loading, error } = useAdminData()
  const orderCounts = useMemo(() => {
    const counts = new Map<string, number>()
    data?.orders.forEach((order) => counts.set(order.status, (counts.get(order.status) ?? 0) + 1))
    return Array.from(counts.entries())
  }, [data?.orders])

  if (loading) return <LoadingState />
  if (error) return <ErrorState title={error} />
  if (!data) return <EmptyState label="No admin data available" guidance="Create tenants, users, access requests, and service relationships to begin building the operating network." />

  const adminAttentionSignals = data.summary.attentionSignals?.length
    ? data.summary.attentionSignals
    : adminSummarySignals(data.summary, user?.role)

  return (
    <div className="page-stack">
      <PageHeading title="Admin Overview" subtitle="Start with platform risks, onboarding, delivery failures, and service exceptions." />
      <AdminGuidancePanel title="Platform attention queue">
        Review the signals below first; broad tenant and order history stays lower on the page.
      </AdminGuidancePanel>
      <AttentionQueue
        signals={adminAttentionSignals}
        description="Governance, reliability, fulfillment, delivery, and service risks are separated here before broad platform health."
      />
      <WorkflowDivider
        eyebrow="Platform health"
        title="Network scale and readiness"
        description="Use these totals after the attention queue to understand tenant coverage, active relationships, inbound work, and admin staffing."
      />
      <div className="metric-grid">
        <Metric label="Tenants" value={data.summary.tenants} />
        <Metric label="Suspended tenants" value={data.summary.suspendedTenants} />
        <Metric label="Users" value={data.summary.users} />
        <Metric label="Platform admins" value={data.summary.platformAdmins} />
        <Metric label="Active relationships" value={data.summary.activeRelationships} />
        <Metric label="Open inbound" value={data.summary.openInboundRequests} />
        <Metric label="Failed shipments" value={data.summary.failedShipments} />
        <Metric label="Service risks" value={data.summary.openServiceDisputes + data.summary.openServiceClaims + data.summary.pendingServiceReviews} />
      </div>
      <WorkflowDivider
        eyebrow="Operational ledgers"
        title="Review order and tenant history"
        description="Use these tables for context after the active governance and reliability signals are triaged."
      />
      <section className="table-section">
        <h2>Order Status</h2>
        {orderCounts.length ? (
          <div className="status-row">
            {orderCounts.map(([status, count]) => (
              <div className="status-count" key={status}>
                <StatusBadge value={status} />
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState label="No orders yet" guidance="Orders will appear after merchant accounts create demand. Start by confirming tenant and relationship setup, then review merchant order queues." />
        )}
      </section>
      <AdminOrdersTable orders={data.orders.slice(0, 12)} />
      <TenantHealthTable rows={data.tenantHealth} />
    </div>
  )
}

function adminSummarySignals(summary: AdminPlatformSummary, role: UserRole = 'ADMIN'): AttentionSignal[] {
  const serviceRisks = summary.openServiceDisputes + summary.openServiceClaims + summary.pendingServiceReviews
  const suspendedGovernance = summary.suspendedTenants + summary.suspendedRelationships
  const deliveryFailures = summary.failedShipments + summary.returnedShipments
  const createdAt = new Date().toISOString()
  const canMutatePlatform = role === 'OWNER' || role === 'ADMIN'
  return [
    role === 'AUDITOR'
      ? null
      : countSignal(
        summary.pendingAccessRequests,
        'admin-access-requests',
        canMutatePlatform ? 'ACTION_NEEDED' : 'REVIEW',
        'Access requests need review',
        canMutatePlatform
          ? 'Pending onboarding requests are waiting on platform approval.'
          : 'Pending onboarding requests are waiting on owner/admin approval; support can review context and escalate.',
        canMutatePlatform ? 'Review requests' : 'Review and escalate',
        '/admin/access-requests',
        'AccessRequest',
        createdAt,
        canMutatePlatform ? 'ADMIN' : role,
      ),
    countSignal(
      summary.failedOutboxEvents,
      'admin-failed-outbox',
      'CRITICAL',
      'Outbox failures need reliability review',
      canMutatePlatform
        ? 'Failed integration work is waiting for retry or dead-letter handling.'
        : 'Failed integration work needs owner/admin retry or dead-letter handling; review diagnostics before escalation.',
      canMutatePlatform ? 'Open outbox diagnostics' : 'Review diagnostics',
      '/admin/outbox',
      'OutboxEvent',
      createdAt,
      canMutatePlatform ? 'ADMIN' : role,
    ),
    countSignal(serviceRisks, 'admin-service-risks', 'ACTION_NEEDED', 'Service accountability risks are open', 'Open disputes, claims, or pending reviews need a decision trail.', 'Open service review', '/service-accountability', 'ServiceAccountability', createdAt, role),
    countSignal(suspendedGovernance, 'admin-suspended-governance', 'REVIEW', 'Suspended governance needs context', 'Suspended tenants or relationships should be reviewed before daily operators depend on them.', 'Review relationships', '/admin/relationships', 'MerchantWarehouseRelationship', createdAt, role),
    countSignal(summary.openFulfillmentExceptions, 'admin-fulfillment-exceptions', 'CRITICAL', 'Fulfillment exceptions need operational follow-up', 'Open exceptions should be resolved through service review, not hidden in audit history.', 'Open service review', '/service-accountability', 'FulfillmentException', createdAt, role),
    countSignal(deliveryFailures, 'admin-delivery-failures', 'CRITICAL', 'Delivery failures need service follow-up', 'Failed or returned shipments should be inspected through operational detail and service accountability.', 'Open service review', '/service-accountability', 'Shipment', createdAt, role),
  ].filter((signal): signal is AttentionSignal => Boolean(signal))
}

function countSignal(
  count: number,
  id: string,
  severity: AttentionSignal['severity'],
  title: string,
  body: string,
  nextActionLabel: string,
  route: string,
  sourceType: string,
  createdAt: string,
  ownerRole: UserRole = 'ADMIN',
): AttentionSignal | null {
  if (count <= 0) return null
  return {
    id,
    severity,
    title,
    body: `${count} ${body}`,
    ownerRole,
    nextActionLabel,
    route,
    sourceType,
    sourceId: null,
    createdAt,
    resolved: false,
  }
}

export function AdminUsersPage() {
  const { token, user: currentUser } = useAuth()
  const { data, loading, error } = useAdminData()
  const [users, setUsers] = useState<User[]>([])
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL')
  const [tenantFilter, setTenantFilter] = useState('ALL')
  const [enabledFilter, setEnabledFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL')
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [role, setRole] = useState<UserRole>('MERCHANT')
  const [reason, setReason] = useState('Administrative account update')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [actionError, setActionError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!data?.users) return
    const loadedUsers = data.users
    queueMicrotask(() => {
      setUsers((current) => {
        const nextUsers = new Map(loadedUsers.map((user) => [user.id, user]))
        current.forEach((user) => {
          if (!nextUsers.has(user.id)) {
            nextUsers.set(user.id, user)
          }
        })
        return Array.from(nextUsers.values())
      })
    })
  }, [data?.users])

  useEffect(() => {
    if (!tenantId && data?.tenants[0]) {
      const defaultTenantId = data.tenants[0].id
      queueMicrotask(() => setTenantId(defaultTenantId))
    }
  }, [data?.tenants, tenantId])

  const filteredUsers = users.filter((user) => {
    const normalizedSearch = userSearch.trim().toLowerCase()
    if (normalizedSearch && !user.email.toLowerCase().includes(normalizedSearch)) return false
    if (roleFilter !== 'ALL' && user.role !== roleFilter) return false
    if (tenantFilter !== 'ALL' && user.tenantId !== tenantFilter) return false
    if (enabledFilter === 'ENABLED' && !user.enabled) return false
    if (enabledFilter === 'DISABLED' && user.enabled) return false
    return true
  })
  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / ADMIN_USER_PAGE_SIZE))
  const safeUserPage = Math.min(userPage, userPageCount)
  const pagedUsers = filteredUsers.slice((safeUserPage - 1) * ADMIN_USER_PAGE_SIZE, safeUserPage * ADMIN_USER_PAGE_SIZE)
  const firstUserNumber = filteredUsers.length ? (safeUserPage - 1) * ADMIN_USER_PAGE_SIZE + 1 : 0
  const lastUserNumber = Math.min(safeUserPage * ADMIN_USER_PAGE_SIZE, filteredUsers.length)
  const enabledOwnerCount = users.filter((user) => user.role === 'OWNER' && user.enabled).length
  const disabledUserCount = users.filter((user) => !user.enabled).length
  const resetReady = temporaryPassword.length >= 8
  const adminRoles: UserRole[] = ['OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR']
  const isAdminRole = (value: UserRole) => adminRoles.includes(value)
  const canMutateUsers = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN'
  const canSupportUsers = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPPORT_ADMIN'
  const canAssignAdminRoles = currentUser?.role === 'OWNER'

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setActionError('')
    setSubmitting(true)
    try {
      const created = await api.createUser(token, { tenantId, email, password, role })
      setUsers((current) => [...current, created])
      setUserSearch(created.email)
      setRoleFilter('ALL')
      setTenantFilter('ALL')
      setEnabledFilter('ALL')
      setUserPage(1)
      setEmail('')
      setPassword('')
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to create user.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDisableUser(userId: string) {
    if (!token) return
    setActionError('')
    try {
      const disabled = await api.disableUser(token, userId, { reason })
      setUsers((current) => current.map((user) => (user.id === disabled.id ? disabled : user)))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to disable user.')
    }
  }

  async function handleEnableUser(userId: string) {
    if (!token) return
    setActionError('')
    try {
      const enabled = await api.enableUser(token, userId, { reason })
      setUsers((current) => current.map((user) => (user.id === enabled.id ? enabled : user)))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to enable user.')
    }
  }

  async function handleRoleChange(userId: string, nextRole: UserRole) {
    if (!token) return
    setActionError('')
    try {
      const changed = await api.changeUserRole(token, userId, { role: nextRole, reason })
      setUsers((current) => current.map((user) => (user.id === changed.id ? changed : user)))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to change role.')
    }
  }

  async function handleResetPassword(userId: string) {
    if (!token) return
    setActionError('')
    if (temporaryPassword.length < 8) {
      setActionError('Temporary reset password must be at least 8 characters.')
      return
    }
    try {
      const changed = await api.adminResetUserPassword(token, userId, { newPassword: temporaryPassword, reason })
      setUsers((current) => current.map((user) => (user.id === changed.id ? changed : user)))
      setTemporaryPassword('')
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to reset password.')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState title={error} />
  if (!data) return <EmptyState label="No users available" guidance="Create the first platform or tenant user, assign the correct role, and keep the action reason ready for audit review." />

  return (
    <div className="page-stack">
      <PageHeading title="Users" subtitle="Create, recover, and govern platform and tenant accounts with safety rails." />
      <AdminGuidancePanel title="Privileged account changes">
        Disable, enable, role-change, and reset actions use the action reason below for audit review. Reset buttons stay locked until a temporary password is ready.
      </AdminGuidancePanel>
      <div className="status-row" aria-label="Account action safety summary">
        <div className="status-count">
          <StatusBadge value="ENABLED" />
          <strong>{users.length - disabledUserCount}</strong>
        </div>
        <div className="status-count">
          <StatusBadge value="DISABLED" />
          <strong>{disabledUserCount}</strong>
        </div>
        <div className="status-count">
          <StatusBadge value={resetReady ? 'RESET_READY' : 'RESET_LOCKED'} />
          <strong>{resetReady ? 'Ready' : 'Locked'}</strong>
        </div>
        <span className="status-narration">Current user, last owner, and protected admin controls explain why destructive actions are unavailable.</span>
      </div>
      <form aria-label="Create user form" className="panel-form" onSubmit={handleCreateUser}>
        <h2>Create User</h2>
        <div className="form-grid">
          <label className="span-two-field" htmlFor="admin-user-tenant">
            <span>Tenant</span>
            <select id="admin-user-tenant" value={tenantId} onChange={(event) => setTenantId(event.target.value)} required>
              {data.tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.type.replaceAll('_', ' ')})
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="admin-user-role">
            <span>Role</span>
            <select id="admin-user-role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              {canAssignAdminRoles ? <option value="OWNER">Owner</option> : null}
              {canAssignAdminRoles ? <option value="ADMIN">Admin</option> : null}
              {canAssignAdminRoles ? <option value="SUPPORT_ADMIN">Support admin</option> : null}
              {canAssignAdminRoles ? <option value="AUDITOR">Auditor</option> : null}
              <option value="MERCHANT">Merchant</option>
              <option value="WAREHOUSE_OPERATOR">Warehouse operator</option>
            </select>
          </label>
          <label htmlFor="admin-user-email">
            <span>Email</span>
            <input id="admin-user-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label htmlFor="admin-user-password">
            <span>Password</span>
            <input
              id="admin-user-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              type="password"
              required
            />
          </label>
        </div>
        {actionError ? <div className="inline-error">{actionError}</div> : null}
        {canMutateUsers ? (
          <button className="primary-button fit-button" type="submit" disabled={submitting}>
            {submitting ? 'Creating' : 'Create user'}
          </button>
        ) : (
          <span className="data-chip warning-chip">Owner/admin account creation</span>
        )}
      </form>
      <form aria-label="Admin action context" className="panel-form">
        <h2>Action Context</h2>
        <div className="form-grid">
          <label className="span-two-field" htmlFor="admin-user-action-reason">
            <span>Reason for privileged actions</span>
            <input id="admin-user-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
          </label>
          <label htmlFor="admin-user-temporary-password">
            <span>Temporary reset password</span>
            <input id="admin-user-temporary-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} minLength={8} type="password" />
          </label>
        </div>
      </form>
      <div className="filter-row">
        <label htmlFor="admin-user-search">
          <span>Email search</span>
          <input
            id="admin-user-search"
            value={userSearch}
            onChange={(event) => {
              setUserSearch(event.target.value)
              setUserPage(1)
            }}
            placeholder="Find user email"
          />
        </label>
        <label htmlFor="admin-user-role-filter">
          <span>Role</span>
          <select
            id="admin-user-role-filter"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as 'ALL' | UserRole)
              setUserPage(1)
            }}
          >
            <option value="ALL">All roles</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPPORT_ADMIN">Support admin</option>
            <option value="AUDITOR">Auditor</option>
            <option value="MERCHANT">Merchant</option>
            <option value="WAREHOUSE_OPERATOR">Warehouse operator</option>
          </select>
        </label>
        <label htmlFor="admin-user-tenant-filter">
          <span>Tenant</span>
          <select
            id="admin-user-tenant-filter"
            value={tenantFilter}
            onChange={(event) => {
              setTenantFilter(event.target.value)
              setUserPage(1)
            }}
          >
            <option value="ALL">All tenants</option>
            {data.tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
          </select>
        </label>
        <label htmlFor="admin-user-status-filter">
          <span>Status</span>
          <select
            id="admin-user-status-filter"
            value={enabledFilter}
            onChange={(event) => {
              setEnabledFilter(event.target.value as typeof enabledFilter)
              setUserPage(1)
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="ENABLED">Enabled</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </label>
      </div>
      <div className="table-toolbar result-toolbar" aria-label="User result pagination">
        <span>
          Showing {firstUserNumber}-{lastUserNumber} of {filteredUsers.length} users
        </span>
        <div className="action-row compact-actions">
          <button
            className="table-button"
            type="button"
            disabled={safeUserPage <= 1}
            onClick={() => setUserPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span>Page {safeUserPage} of {userPageCount}</span>
          <button
            className="table-button"
            type="button"
            disabled={safeUserPage >= userPageCount}
            onClick={() => setUserPage((current) => Math.min(userPageCount, current + 1))}
          >
            Next
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Tenant</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.map((user) => (
              <tr key={user.id}>
                <td className="nowrap-cell">{user.email}</td>
                <td><StatusBadge value={user.role} /></td>
                <td>{tenantName(data.tenants, user.tenantId)} <span className="mono-cell">{shortId(user.tenantId)}</span></td>
                <td><StatusBadge value={user.enabled ? 'ENABLED' : 'DISABLED'} /></td>
                <td>
                  {(() => {
                    const isCurrentUser = user.id === currentUser?.id
                    const isLastEnabledOwner = user.role === 'OWNER' && user.enabled && enabledOwnerCount <= 1
                    const protectedAdmin = isAdminRole(user.role) && !canAssignAdminRoles
                    const unavailableMutationLabel = !canMutateUsers
                      ? 'Owner/admin action'
                      : isCurrentUser
                          ? 'Current user'
                          : isLastEnabledOwner
                            ? 'Last owner'
                            : protectedAdmin
                              ? 'Protected admin'
                              : 'Disabled account'
                    const canDisableUser = canMutateUsers && user.enabled && !isCurrentUser && !isLastEnabledOwner && !protectedAdmin
                    const canEnableUser = canMutateUsers && !user.enabled && !protectedAdmin
                    const canResetUser = canSupportUsers && !protectedAdmin && temporaryPassword.length >= 8
                    const canChangeRole = canMutateUsers && !isCurrentUser && !protectedAdmin

                    return (
                      <div className="action-row compact-actions">
                        {canDisableUser ? (
                          <button className="table-button destructive-button" type="button" onClick={() => void handleDisableUser(user.id)}>
                            Disable
                          </button>
                        ) : null}
                        {canEnableUser ? (
                          <button className="table-button" type="button" onClick={() => void handleEnableUser(user.id)}>
                            Enable
                          </button>
                        ) : null}
                        {!canDisableUser && !canEnableUser ? <span className="data-chip warning-chip">{unavailableMutationLabel}</span> : null}
                        {canResetUser ? (
                          <button className="table-button" type="button" onClick={() => void handleResetPassword(user.id)}>
                            Reset
                          </button>
                        ) : (
                          <span className="data-chip">{protectedAdmin ? 'Protected reset' : canSupportUsers ? 'Enter reset password' : 'Reset locked'}</span>
                        )}
                        {canChangeRole ? (
                          <select
                            aria-label={`Change role for ${user.email}`}
                            value={user.role}
                            onChange={(event) => void handleRoleChange(user.id, event.target.value as UserRole)}
                          >
                            {!canAssignAdminRoles && isAdminRole(user.role) ? <option value={user.role}>{user.role.replaceAll('_', ' ')}</option> : null}
                            {canAssignAdminRoles ? <option value="OWNER">Owner</option> : null}
                            {canAssignAdminRoles ? <option value="ADMIN">Admin</option> : null}
                            {canAssignAdminRoles ? <option value="SUPPORT_ADMIN">Support admin</option> : null}
                            {canAssignAdminRoles ? <option value="AUDITOR">Auditor</option> : null}
                            <option value="MERCHANT">Merchant</option>
                            <option value="WAREHOUSE_OPERATOR">Warehouse operator</option>
                          </select>
                        ) : (
                          <span className="data-chip">{isCurrentUser ? 'Current role locked' : protectedAdmin ? 'Admin role locked' : 'Role change locked'}</span>
                        )}
                      </div>
                    )
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdminTenantsPage() {
  const { token } = useAuth()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<TenantType>('MERCHANT')
  const [warehouseTenantId, setWarehouseTenantId] = useState('')
  const [warehouseName, setWarehouseName] = useState('')
  const [warehouseAddress, setWarehouseAddress] = useState('')
  const [warehouseCapacity, setWarehouseCapacity] = useState(100)
  const [filter, setFilter] = useState<'ALL' | TenantType>('ALL')
  const [reason, setReason] = useState('Tenant governance review')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    Promise.all([api.tenants(token), api.warehouses(token)])
      .then(([nextTenants, nextWarehouses]) => {
        setTenants(nextTenants)
        setWarehouses(nextWarehouses)
        setWarehouseTenantId(nextTenants.find((tenant) => tenant.type === 'WAREHOUSE_PROVIDER' && tenant.active)?.id ?? '')
      })
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load tenants.')
      })
      .finally(() => setLoading(false))
  }, [token])

  const filteredTenants = tenants.filter((tenant) => filter === 'ALL' || tenant.type === filter)
  const warehouseProviderTenants = tenants.filter((tenant) => tenant.type === 'WAREHOUSE_PROVIDER' && tenant.active)
  const warehouseCountsByTenant = useMemo(() => {
    const counts = new Map<string, number>()
    warehouses.forEach((warehouse) => counts.set(warehouse.tenantId, (counts.get(warehouse.tenantId) ?? 0) + 1))
    return counts
  }, [warehouses])

  async function handleCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setSubmitting(true)
    setError('')
    try {
      const created = await api.createTenant(token, { name, type })
      setTenants((current) => [...current, created])
      setName('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to create tenant.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setSubmitting(true)
    setError('')
    try {
      const created = await api.createWarehouse(token, {
        tenantId: warehouseTenantId,
        name: warehouseName,
        address: warehouseAddress,
        capacity: warehouseCapacity,
      })
      setWarehouses((current) => [...current, created])
      setWarehouseName('')
      setWarehouseAddress('')
      setWarehouseCapacity(100)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to register warehouse location.')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleTenant(tenant: Tenant) {
    if (!token) return
    setError('')
    try {
      const next = tenant.active
        ? await api.suspendTenant(token, tenant.id, { reason })
        : await api.activateTenant(token, tenant.id, { reason })
      setTenants((current) => current.map((row) => (row.id === next.id ? next : row)))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to update tenant.')
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="page-stack">
      <PageHeading title="Tenants" subtitle="Create merchant and warehouse provider tenants for platform accounts." />
      <AdminGuidancePanel title="Tenant governance controls">
        Suspension is a privileged platform action. Keep the action reason current before suspending or reactivating tenants so audit review has operational context.
      </AdminGuidancePanel>
      <form aria-label="Create tenant form" className="panel-form" onSubmit={handleCreateTenant}>
        <h2>Create Tenant</h2>
        <div className="form-grid">
          <label htmlFor="admin-tenant-name">
            <span>Name</span>
            <input id="admin-tenant-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required />
          </label>
          <label htmlFor="admin-tenant-type">
            <span>Type</span>
            <select id="admin-tenant-type" value={type} onChange={(event) => setType(event.target.value as TenantType)}>
              <option value="MERCHANT">Merchant</option>
              <option value="WAREHOUSE_PROVIDER">Warehouse provider</option>
            </select>
          </label>
        </div>
        {error ? <div className="inline-error">{error}</div> : null}
        <button className="primary-button fit-button" type="submit" disabled={submitting}>
          {submitting ? 'Creating' : 'Create tenant'}
        </button>
      </form>
      <form aria-label="Register warehouse location form" className="panel-form" onSubmit={handleCreateWarehouse}>
        <h2>Register Warehouse Location</h2>
        <p className="form-helper">Create at least one physical warehouse for each warehouse-provider tenant before operators can receive inbound stock or fulfill orders.</p>
        <div className="form-grid">
          <label htmlFor="admin-warehouse-tenant">
            <span>Provider tenant</span>
            <select
              id="admin-warehouse-tenant"
              value={warehouseTenantId}
              onChange={(event) => setWarehouseTenantId(event.target.value)}
              disabled={!warehouseProviderTenants.length}
            >
              {warehouseProviderTenants.length ? warehouseProviderTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({warehouseCountsByTenant.get(tenant.id) ?? 0} warehouses)
                </option>
              )) : <option value="">Create a warehouse provider tenant first</option>}
            </select>
          </label>
          <label htmlFor="admin-warehouse-name">
            <span>Warehouse name</span>
            <input id="admin-warehouse-name" value={warehouseName} onChange={(event) => setWarehouseName(event.target.value)} maxLength={160} required />
          </label>
          <label className="span-two-field" htmlFor="admin-warehouse-address">
            <span>Address</span>
            <input id="admin-warehouse-address" value={warehouseAddress} onChange={(event) => setWarehouseAddress(event.target.value)} required />
          </label>
          <label htmlFor="admin-warehouse-capacity">
            <span>Capacity</span>
            <input id="admin-warehouse-capacity" type="number" min={0} value={warehouseCapacity} onChange={(event) => setWarehouseCapacity(Number(event.target.value))} />
          </label>
        </div>
        <button className="primary-button fit-button" type="submit" disabled={submitting || !warehouseProviderTenants.length || !warehouseTenantId}>
          {submitting ? 'Registering' : 'Register warehouse'}
        </button>
      </form>
      <div className="filter-row">
        <label htmlFor="admin-tenant-type-filter">
          <span>Type</span>
          <select id="admin-tenant-type-filter" value={filter} onChange={(event) => setFilter(event.target.value as 'ALL' | TenantType)}>
            <option value="ALL">All types</option>
            <option value="MERCHANT">Merchant</option>
            <option value="WAREHOUSE_PROVIDER">Warehouse provider</option>
          </select>
        </label>
        <label htmlFor="admin-tenant-action-reason">
          <span>Action reason</span>
          <input id="admin-tenant-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
        </label>
      </div>
      <TenantsTable tenants={filteredTenants} onToggle={toggleTenant} />
    </div>
  )
}

export function AdminAccessRequestsPage() {
  const { token, user: currentUser } = useAuth()
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [reviewNote, setReviewNote] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [conversionReason, setConversionReason] = useState('Approved onboarding conversion')
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const canMutatePlatform = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN'

  useEffect(() => {
    if (!token) return
    api.accessRequests(token)
      .then(setRequests)
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load access requests.')
      })
      .finally(() => setLoading(false))
  }, [token])

  async function reviewAccessRequest(id: string, action: 'approve' | 'reject') {
    if (!token) return
    setError('')
    setActionId(id)
    try {
      const next = action === 'approve'
        ? await api.approveAccessRequest(token, id, { reviewNote })
        : await api.rejectAccessRequest(token, id, { reviewNote })
      setRequests((current) => current.map((request) => (request.id === next.id ? next : request)))
      setReviewNote('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to review access request.')
    } finally {
      setActionId(null)
    }
  }

  async function convertAccessRequest(request: AccessRequest) {
    if (!token) return
    setError('')
    if (temporaryPassword.length < 8) {
      setError('Temporary setup password must be at least 8 characters.')
      return
    }
    setActionId(request.id)
    try {
      const next = await api.convertAccessRequest(token, request.id, {
        tenantName: request.organizationName,
        temporaryPassword,
        reason: conversionReason,
      })
      setRequests((current) => current.map((row) => (row.id === next.id ? next : row)))
      setTemporaryPassword('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to convert access request.')
    } finally {
      setActionId(null)
    }
  }

  if (loading) return <LoadingState label="Loading access requests" />

  const accessCounts = {
    pending: requests.filter((request) => request.status === 'PENDING').length,
    approved: requests.filter((request) => request.status === 'APPROVED').length,
    rejected: requests.filter((request) => request.status === 'REJECTED').length,
    converted: requests.filter((request) => Boolean(request.convertedAt)).length,
  }

  return (
    <div className="page-stack">
      <PageHeading title="Access Requests" subtitle="Review public merchant and warehouse onboarding requests." />
      <AdminGuidancePanel title="Onboarding review controls">
        Review notes apply to the next approve or reject action. Conversion creates the tenant account only after an approved request has a temporary setup password.
      </AdminGuidancePanel>
      <div className="status-row" aria-label="Access request status narration">
        <div className="status-count">
          <StatusBadge value="PENDING" />
          <strong>{accessCounts.pending}</strong>
        </div>
        <div className="status-count">
          <StatusBadge value="APPROVED" />
          <strong>{accessCounts.approved}</strong>
        </div>
        <div className="status-count">
          <StatusBadge value="REJECTED" />
          <strong>{accessCounts.rejected}</strong>
        </div>
        <div className="status-count">
          <StatusBadge value="CONVERTED" />
          <strong>{accessCounts.converted}</strong>
        </div>
        <span className="status-narration">Pending requests need review; approved requests still need conversion before the account is ready.</span>
      </div>
      <form aria-label="Review note form" className="panel-form">
        <h2>Review And Conversion Context</h2>
        <div className="form-grid">
          <label className="span-two-field" htmlFor="admin-access-review-note">
            <span>Note applied to the next review action</span>
            <textarea id="admin-access-review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength={1000} />
          </label>
          <label htmlFor="admin-access-conversion-reason">
            <span>Conversion reason</span>
            <input id="admin-access-conversion-reason" value={conversionReason} onChange={(event) => setConversionReason(event.target.value)} maxLength={1000} />
          </label>
          <label htmlFor="admin-access-temporary-password">
            <span>Temporary setup password</span>
            <input id="admin-access-temporary-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} minLength={8} type="password" />
          </label>
        </div>
      </form>
      {error ? <div className="inline-error">{error}</div> : null}
      <section className="table-section">
        <h2>Requests</h2>
        {requests.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Converted</th>
                  <th>Review trail</th>
                  <th>Note</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const pending = request.status === 'PENDING'
                  const approved = request.status === 'APPROVED'
                  const rejected = request.status === 'REJECTED'
                  const converted = Boolean(request.convertedAt)
                  const conversionReady = approved && !converted && temporaryPassword.length >= 8
                  return (
                    <tr key={request.id}>
                      <td>{request.organizationName}</td>
                      <td>{request.requesterEmail}</td>
                      <td><StatusBadge value={request.requestedRole} /></td>
                      <td><StatusBadge value={request.status} /></td>
                      <td>{request.convertedAt ? `Tenant ${shortId(request.convertedTenantId ?? '')}` : 'Not converted'}</td>
                      <td className="timeline-cell">
                        <span><span>Requested</span><TimestampCell value={request.createdAt} /></span>
                        {request.reviewedAt ? <span><span>Reviewed</span><TimestampCell value={request.reviewedAt} /></span> : <span><span>Reviewed</span>Pending</span>}
                        {request.convertedAt ? <span><span>Converted</span><TimestampCell value={request.convertedAt} /></span> : null}
                      </td>
                      <td className="note-cell">{request.reviewNote ?? request.notes ?? 'No notes'}</td>
                      <td>
                        {canMutatePlatform ? (
                          <div className="action-row compact-actions">
                            {pending ? (
                              <>
                                <button
                                  className="table-button"
                                  type="button"
                                  disabled={actionId === request.id}
                                  onClick={() => void reviewAccessRequest(request.id, 'approve')}
                                >
                                  Approve
                                </button>
                                <button
                                  className="table-button destructive-button"
                                  type="button"
                                  disabled={actionId === request.id}
                                  onClick={() => void reviewAccessRequest(request.id, 'reject')}
                                >
                                  Reject
                                </button>
                                <span className="data-chip">Convert after approval</span>
                              </>
                            ) : null}
                            {approved && !converted ? (
                              <>
                                <span className="data-chip">Approval recorded</span>
                                {conversionReady ? (
                                  <button
                                    className="table-button"
                                    type="button"
                                    disabled={actionId === request.id}
                                    onClick={() => void convertAccessRequest(request)}
                                  >
                                    Convert
                                  </button>
                                ) : (
                                  <span className="data-chip warning-chip">Enter setup password</span>
                                )}
                              </>
                            ) : null}
                            {rejected ? <span className="data-chip warning-chip">Rejected request</span> : null}
                            {converted ? <span className="data-chip">Account created</span> : null}
                          </div>
                        ) : (
                          <span className="data-chip">Review and escalate</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No access requests yet" guidance="New merchant and warehouse onboarding requests will land here. When one arrives, review notes, approve or reject it, then convert approved requests with a setup password." />
        )}
      </section>
    </div>
  )
}

export function AdminRelationshipsPage() {
  const { token, user: currentUser } = useAuth()
  const [relationships, setRelationships] = useState<MerchantWarehouseRelationship[]>([])
  const [reason, setReason] = useState('Relationship governance review')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canMutatePlatform = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN'

  useEffect(() => {
    if (!token) return
    api.merchantWarehouseRelationships(token)
      .then(setRelationships)
      .catch((caught) => setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load relationships.'))
      .finally(() => setLoading(false))
  }, [token])

  async function updateRelationship(
    relationship: MerchantWarehouseRelationship,
    action: 'suspend' | 'reactivate' | 'end',
  ) {
    if (!token) return
    setError('')
    try {
      const updated = action === 'suspend'
        ? await api.suspendMerchantWarehouseRelationship(token, relationship.id, { reason })
        : action === 'reactivate'
          ? await api.reactivateMerchantWarehouseRelationship(token, relationship.id, { reason })
          : await api.endMerchantWarehouseRelationship(token, relationship.id, { reason })
      setRelationships((current) => current.map((row) => (row.id === updated.id ? updated : row)))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to update relationship.')
    }
  }

  if (loading) return <LoadingState label="Loading relationships" />

  return (
    <div className="page-stack">
      <PageHeading title="Relationships" subtitle="Govern merchant and warehouse-provider service status without taking over daily work." />
      <AdminGuidancePanel title="Relationship operating boundary">
        Suspend or end relationships only to govern the merchant-provider service boundary. Auditors and support roles can review the same lifecycle trail without mutation controls.
      </AdminGuidancePanel>
      <form className="panel-form" aria-label="Relationship governance reason">
        <h2>Governance Reason</h2>
        <label htmlFor="admin-relationship-action-reason">
          <span>Reason applied to relationship actions</span>
          <input id="admin-relationship-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
        </label>
      </form>
      {error ? <ErrorState title={error} /> : null}
      <section className="table-section">
        <h2>Merchant-Warehouse Relationships</h2>
        {relationships.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Warehouse provider</th>
                  <th>Status</th>
                  <th>Lifecycle</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {relationships.map((relationship) => (
                  <tr key={relationship.id}>
                    <td>{relationship.merchantName}</td>
                    <td>{relationship.warehouseProviderName}</td>
                    <td><StatusBadge value={relationship.status} /></td>
                    <td><RelationshipLifecycleCell relationship={relationship} /></td>
                    <td className="note-cell">{relationship.statusReason ?? relationship.serviceNotes ?? 'No reason recorded'}</td>
                    <td>
                      <div className="action-row compact-actions">
                        {!canMutatePlatform ? <span className="data-chip">Read-only relationship review</span> : null}
                        {canMutatePlatform && relationship.status === 'ACTIVE' ? (
                          <button className="table-button warning-button" type="button" onClick={() => void updateRelationship(relationship, 'suspend')}>
                            Suspend
                          </button>
                        ) : null}
                        {canMutatePlatform && relationship.status === 'SUSPENDED' ? (
                          <button className="table-button" type="button" onClick={() => void updateRelationship(relationship, 'reactivate')}>
                            Reactivate
                          </button>
                        ) : null}
                        {canMutatePlatform && relationship.status !== 'ENDED' ? (
                          <button className="table-button destructive-button" type="button" onClick={() => void updateRelationship(relationship, 'end')}>
                            End
                          </button>
                        ) : null}
                        {canMutatePlatform && relationship.status === 'ENDED' ? <span className="data-chip">Ended relationship</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No relationships yet" guidance="Create or approve merchant-warehouse relationships so inventory, inbound stock, fulfillment, and service accountability can connect across tenants." />
        )}
      </section>
    </div>
  )
}

function AdminOrdersTable({ orders }: { orders: Order[] }) {
  return (
    <section className="table-section">
      <h2>Recent Operational Orders</h2>
      {orders.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Items</th>
                <th>Allocations</th>
                <th>Backorders</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="mono-cell">
                    <Link className="text-link" to={`/orders/${order.id}`}>{shortId(order.id)}</Link>
                  </td>
                  <td><StatusBadge value={order.status} /></td>
                  <td>{order.items.map((item) => `${item.sku} x${item.quantity}`).join(', ')}</td>
                  <td>{order.allocations.length ? order.allocations.map((allocation) => (
                    <Link className="text-link status-inline" key={allocation.id} to={`/fulfillment-allocations/${allocation.id}`}>
                      {allocation.warehouseName}
                    </Link>
                  )) : 'None'}</td>
                  <td>{order.backorders.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState label="No operational orders yet" guidance="Merchant orders will populate this table after inventory and relationship setup are in place." />
      )}
    </section>
  )
}

function TenantHealthTable({ rows }: { rows: AdminTenantHealth[] }) {
  return (
    <section className="table-section">
      <h2>Tenant Health</h2>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Status</th>
                <th>Users</th>
                <th>Relationships</th>
                <th>Ops</th>
                <th>Service risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.tenant.id}>
                  <td>{row.tenant.name}</td>
                  <td><StatusBadge value={row.tenant.active ? 'ACTIVE' : 'SUSPENDED'} /></td>
                  <td>{row.users}</td>
                  <td>{row.relationships}</td>
                  <td>{row.inboundRequests + row.orders + row.fulfillmentAllocations}</td>
                  <td>{row.openDisputes + row.openClaims + row.pendingReviews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState label="No tenant health rows yet" guidance="Tenant health rows appear after platform tenants exist and begin producing operational activity." />
      )}
    </section>
  )
}

function TenantsTable({ tenants, onToggle }: { tenants: Tenant[]; onToggle?: (tenant: Tenant) => void }) {
  return (
    <section className="table-section">
      <h2>Tenants</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Reason</th>
              <th>ID</th>
              {onToggle ? <th>Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td>{tenant.name}</td>
                <td><StatusBadge value={tenant.type} /></td>
                <td><StatusBadge value={tenant.active ? 'ACTIVE' : 'SUSPENDED'} /></td>
                <td className="note-cell">{tenant.suspensionReason ?? 'No active suspension'}</td>
                <td className="mono-cell">{shortId(tenant.id)}</td>
                {onToggle ? (
                  <td>
                    <button className={`table-button ${tenant.active ? 'warning-button' : ''}`.trim()} type="button" onClick={() => void onToggle(tenant)}>
                      {tenant.active ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TimestampCell({ value }: { value: string }) {
  return (
    <time className="timestamp-cell" dateTime={value}>
      {formatDate(value)}
    </time>
  )
}

function RelationshipLifecycleCell({ relationship }: { relationship: MerchantWarehouseRelationship }) {
  const events = [
    ['Created', relationship.createdAt],
    ['Activated', relationship.approvedAt],
    ['Suspended', relationship.suspendedAt],
    ['Ended', relationship.endedAt],
  ].filter((event): event is [string, string] => Boolean(event[1]))

  return (
    <div className="timeline-cell">
      {events.map(([label, value]) => (
        <span key={`${label}-${value}`}>
          <span>{label}</span>
          <TimestampCell value={value} />
        </span>
      ))}
    </div>
  )
}

function tenantName(tenants: Tenant[], tenantId: string) {
  return tenants.find((tenant) => tenant.id === tenantId)?.name ?? 'Unknown tenant'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
