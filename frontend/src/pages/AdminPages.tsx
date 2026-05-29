import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type {
  CarrierDispatch,
  AccessRequest,
  AdminAuditEvent,
  AdminPlatformSummary,
  AdminTenantHealth,
  MerchantWarehouseRelationship,
  Order,
  OutboxEvent,
  OutboxProcessResponse,
  OutboxSummary,
  Tenant,
  TenantType,
  User,
  UserRole,
} from '../api/types'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { Metric } from '../components/Metric'
import { StatusBadge } from '../components/StatusBadge'

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
  const { data, loading, error } = useAdminData()
  const orderCounts = useMemo(() => {
    const counts = new Map<string, number>()
    data?.orders.forEach((order) => counts.set(order.status, (counts.get(order.status) ?? 0) + 1))
    return Array.from(counts.entries())
  }, [data?.orders])

  if (loading) return <LoadingState />
  if (error) return <ErrorState title={error} />
  if (!data) return <EmptyState label="No admin data available" />

  return (
    <div className="page-stack">
      <PageHeading title="Admin Overview" subtitle="Platform-wide tenants, users, and order activity." />
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
          <EmptyState label="No orders yet" />
        )}
      </section>
      <AdminOrdersTable orders={data.orders.slice(0, 12)} />
      <TenantHealthTable rows={data.tenantHealth} />
    </div>
  )
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
    queueMicrotask(() => {
      setUsers(data?.users ?? [])
      if (!tenantId && data?.tenants[0]) {
        setTenantId(data.tenants[0].id)
      }
    })
  }, [data?.tenants, data?.users, tenantId])

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
  if (!data) return <EmptyState label="No users available" />

  return (
    <div className="page-stack">
      <PageHeading title="Users" subtitle="Create, recover, and govern platform and tenant accounts with safety rails." />
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
        <button className="primary-button fit-button" type="submit" disabled={submitting || !canMutateUsers}>
          {!canMutateUsers ? 'Owner/admin only' : submitting ? 'Creating' : 'Create user'}
        </button>
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
      <div className="table-toolbar" aria-label="User result pagination">
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
                    const disableLabel = !user.enabled ? 'Disabled' : isCurrentUser ? 'Current user' : isLastEnabledOwner ? 'Last owner' : 'Disable'

                    return (
                      <div className="action-row compact-actions">
                        <button
                          className="table-button"
                          type="button"
                          disabled={!canMutateUsers || !user.enabled || isCurrentUser || isLastEnabledOwner || protectedAdmin}
                          onClick={() => void handleDisableUser(user.id)}
                        >
                          {disableLabel}
                        </button>
                        <button
                          className="table-button"
                          type="button"
                          disabled={!canMutateUsers || user.enabled || protectedAdmin}
                          onClick={() => void handleEnableUser(user.id)}
                        >
                          Enable
                        </button>
                        <button
                          className="table-button"
                          type="button"
                          disabled={!canSupportUsers || protectedAdmin || temporaryPassword.length < 8}
                          onClick={() => void handleResetPassword(user.id)}
                        >
                          Reset
                        </button>
                        <select
                          aria-label={`Change role for ${user.email}`}
                          value={user.role}
                          disabled={!canMutateUsers || isCurrentUser || protectedAdmin}
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
  const [name, setName] = useState('')
  const [type, setType] = useState<TenantType>('MERCHANT')
  const [filter, setFilter] = useState<'ALL' | TenantType>('ALL')
  const [reason, setReason] = useState('Tenant governance review')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    api.tenants(token)
      .then(setTenants)
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load tenants.')
      })
      .finally(() => setLoading(false))
  }, [token])

  const filteredTenants = tenants.filter((tenant) => filter === 'ALL' || tenant.type === filter)

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

  return (
    <div className="page-stack">
      <PageHeading title="Access Requests" subtitle="Review public merchant and warehouse onboarding requests." />
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
                  <th>Note</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const pending = request.status === 'PENDING'
                  const approveLabel = request.status === 'APPROVED' ? 'Approved' : pending ? 'Approve' : 'Approval closed'
                  const rejectLabel = request.status === 'REJECTED' ? 'Rejected' : pending ? 'Reject' : 'Rejection closed'
                  return (
                    <tr key={request.id}>
                      <td>{request.organizationName}</td>
                      <td>{request.requesterEmail}</td>
                      <td><StatusBadge value={request.requestedRole} /></td>
                      <td><StatusBadge value={request.status} /></td>
                      <td>{request.convertedAt ? `Tenant ${shortId(request.convertedTenantId ?? '')}` : 'Not converted'}</td>
                      <td>{request.reviewNote ?? request.notes ?? 'No notes'}</td>
                      <td>
                        <div className="action-row compact-actions">
                          <button
                            className="table-button"
                            type="button"
                            disabled={!canMutatePlatform || !pending || actionId === request.id}
                            onClick={() => void reviewAccessRequest(request.id, 'approve')}
                          >
                            {canMutatePlatform ? approveLabel : 'Owner/admin only'}
                          </button>
                          <button
                            className="table-button"
                            type="button"
                            disabled={!canMutatePlatform || !pending || actionId === request.id}
                            onClick={() => void reviewAccessRequest(request.id, 'reject')}
                          >
                            {rejectLabel}
                          </button>
                          <button
                            className="table-button"
                            type="button"
                            disabled={!canMutatePlatform || request.status !== 'APPROVED' || Boolean(request.convertedAt) || actionId === request.id || temporaryPassword.length < 8}
                            onClick={() => void convertAccessRequest(request)}
                          >
                            {request.convertedAt ? 'Converted' : 'Convert'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No access requests yet" />
        )}
      </section>
    </div>
  )
}

export function AdminOutboxPage() {
  const { token, user: currentUser } = useAuth()
  const [summary, setSummary] = useState<OutboxSummary | null>(null)
  const [events, setEvents] = useState<OutboxEvent[]>([])
  const [dispatches, setDispatches] = useState<CarrierDispatch[]>([])
  const [result, setResult] = useState<OutboxProcessResponse | null>(null)
  const [reason, setReason] = useState('Background work review')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(true)
  const [error, setError] = useState('')
  const canMutatePlatform = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN'

  async function refreshOutbox() {
    if (!token) return
    setRefreshing(true)
    setError('')
    try {
      const [nextSummary, nextEvents, nextDispatches] = await Promise.all([
        api.outboxSummary(token),
        api.outboxEvents(token),
        api.carrierDispatches(token),
      ])
      setSummary(nextSummary)
      setEvents(nextEvents)
      setDispatches(nextDispatches)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load outbox data.')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refreshOutbox()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function processOutbox() {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      setResult(await api.processOutbox(token))
      await refreshOutbox()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to process outbox.')
    } finally {
      setLoading(false)
    }
  }

  async function retryEvent(eventId: string) {
    if (!token) return
    setError('')
    try {
      const updated = await api.retryOutboxEvent(token, eventId)
      setEvents((current) => current.map((event) => (event.id === updated.id ? updated : event)))
      await refreshOutbox()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to retry outbox event.')
    }
  }

  async function deadLetterEvent(eventId: string) {
    if (!token) return
    setError('')
    try {
      const updated = await api.deadLetterOutboxEvent(token, eventId, { reason })
      setEvents((current) => current.map((event) => (event.id === updated.id ? updated : event)))
      await refreshOutbox()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to move outbox event.')
    }
  }

  return (
    <div className="page-stack">
      <PageHeading title="Outbox" subtitle="Monitor side-effect events, retries, and carrier dispatch records." />
      <div className="action-row">
        <button className="primary-button fit-button" type="button" onClick={processOutbox} disabled={loading || !canMutatePlatform}>
          {!canMutatePlatform ? 'Owner/admin only' : loading ? 'Processing' : 'Process outbox'}
        </button>
        <button className="icon-text-button" type="button" onClick={refreshOutbox} disabled={refreshing || loading}>
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
        <label className="inline-field" htmlFor="admin-outbox-action-reason">
          <span>Reason</span>
          <input id="admin-outbox-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
        </label>
      </div>
      {error ? <ErrorState title={error} /> : null}
      {summary ? (
        <div className="metric-grid">
          <Metric label="Pending" value={summary.pending} />
          <Metric label="Processed" value={summary.processed} />
          <Metric label="Failed" value={summary.failed} />
          <Metric label="Retryable failed" value={summary.retryableFailed} />
        </div>
      ) : refreshing ? (
        <LoadingState label="Loading outbox health" />
      ) : null}
      {result ? (
        <div className="state-panel">
          Processed {result.processed} events with {result.failed} failures.
        </div>
      ) : null}
      <OutboxEventsTable
        events={events}
        onRetry={canMutatePlatform ? retryEvent : undefined}
        onDeadLetter={canMutatePlatform ? deadLetterEvent : undefined}
      />
      <CarrierDispatchesTable dispatches={dispatches} />
    </div>
  )
}

function OutboxEventsTable({
  events,
  onRetry,
  onDeadLetter,
}: {
  events: OutboxEvent[]
  onRetry?: (eventId: string) => void
  onDeadLetter?: (eventId: string) => void
}) {
  return (
    <section className="table-section">
      <h2>Recent Events</h2>
      {events.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Aggregate</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.eventType}</td>
                  <td>{event.aggregateType} <span className="mono-cell">{shortId(event.aggregateId)}</span></td>
                  <td><StatusBadge value={event.status} /></td>
                  <td>{event.attempts}</td>
                  <td>{formatDate(event.createdAt)}</td>
                  <td>
                    <div className="action-row compact-actions">
                      <button
                        className="table-button"
                        type="button"
                        disabled={event.status !== 'FAILED' || !onRetry}
                        onClick={() => onRetry?.(event.id)}
                      >
                        Retry
                      </button>
                      <button
                        className="table-button"
                        type="button"
                        disabled={event.status === 'PROCESSED' || event.status === 'DEAD_LETTER' || !onDeadLetter}
                        onClick={() => onDeadLetter?.(event.id)}
                      >
                        Dead-letter
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState label="No outbox events yet" />
      )}
    </section>
  )
}

function CarrierDispatchesTable({ dispatches }: { dispatches: CarrierDispatch[] }) {
  return (
    <section className="table-section">
      <h2>Carrier Dispatches</h2>
      {dispatches.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Carrier</th>
                <th>Tracking</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map((dispatch) => (
                <tr key={dispatch.id}>
                  <td>{dispatch.eventType}</td>
                  <td>{dispatch.carrier ?? 'Unknown'}</td>
                  <td>{dispatch.trackingNumber ?? 'None'}</td>
                  <td><StatusBadge value={dispatch.status} /></td>
                  <td className="mono-cell">{dispatch.externalReference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState label="No carrier dispatches yet" />
      )}
    </section>
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
                    <td>{relationship.statusReason ?? relationship.serviceNotes ?? 'No reason recorded'}</td>
                    <td>
                      <div className="action-row compact-actions">
                        <button
                          className="table-button"
                          type="button"
                          disabled={!canMutatePlatform || relationship.status !== 'ACTIVE'}
                          onClick={() => void updateRelationship(relationship, 'suspend')}
                        >
                          {canMutatePlatform ? 'Suspend' : 'Owner/admin only'}
                        </button>
                        <button
                          className="table-button"
                          type="button"
                          disabled={!canMutatePlatform || relationship.status !== 'SUSPENDED'}
                          onClick={() => void updateRelationship(relationship, 'reactivate')}
                        >
                          Reactivate
                        </button>
                        <button
                          className="table-button"
                          type="button"
                          disabled={!canMutatePlatform || relationship.status === 'ENDED'}
                          onClick={() => void updateRelationship(relationship, 'end')}
                        >
                          End
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No relationships yet" />
        )}
      </section>
    </div>
  )
}

export function AdminAuditPage() {
  const { token } = useAuth()
  const [events, setEvents] = useState<AdminAuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    api.adminAuditEvents(token)
      .then(setEvents)
      .catch((caught) => setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load audit events.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <LoadingState label="Loading admin audit events" />

  return (
    <div className="page-stack">
      <PageHeading title="Admin Audit" subtitle="Review privileged platform actions, reasons, actors, and affected records." />
      {error ? <ErrorState title={error} /> : null}
      <section className="table-section">
        <h2>Recent Privileged Actions</h2>
        {events.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Record</th>
                  <th>Reason</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td><StatusBadge value={event.action} /></td>
                    <td>{event.actorEmail ?? 'System'}</td>
                    <td>{event.aggregateType} <span className="mono-cell">{shortId(event.aggregateId)}</span></td>
                    <td>{event.reason ?? 'No reason recorded'}</td>
                    <td>{formatDate(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No admin audit events yet" />
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
        <EmptyState label="No operational orders yet" />
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
        <EmptyState label="No tenant health rows yet" />
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
                <td className="mono-cell">{shortId(tenant.id)}</td>
                {onToggle ? (
                  <td>
                    <button className="table-button" type="button" onClick={() => void onToggle(tenant)}>
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

function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  )
}

function shortId(id: string) {
  return id.slice(0, 8)
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
