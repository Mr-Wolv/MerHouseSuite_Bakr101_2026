import { expect, test } from '@playwright/test'
import type { APIRequestContext, Locator } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080'
const screenshotDir = '../reports/v7.5'

async function api<T>(request: APIRequestContext, method: 'get' | 'post' | 'patch', path: string, token?: string, body?: unknown) {
  const response = await request[method](`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    data: body,
  })
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<T>
}

async function createActiveRelationship(request: APIRequestContext, token: string, merchantId: string, warehouseProviderId: string) {
  const relationship = await api<{ id: string }>(request, 'post', '/api/v1/merchant-warehouse/relationships', token, {
    merchantId,
    warehouseProviderId,
    serviceNotes: 'Playwright service relationship',
  })
  await api(request, 'patch', `/api/v1/merchant-warehouse/relationships/${relationship.id}/activate`, token)
  return relationship
}

async function clickFreshButton(button: () => Locator) {
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const current = button()
      await expect(current).toBeVisible({ timeout: 5_000 })
      await current.click({ timeout: 5_000 })
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw lastError
}

test.describe('admin console', () => {
  test('supports keyboard skip navigation and narrow admin layout', async ({ page }) => {
    mkdirSync(screenshotDir, { recursive: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.getByLabel('Email').fill('admin@merhouse.local')
    await page.getByLabel('Password').fill('local-owner-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Admin Overview' })).toBeVisible({ timeout: 20_000 })

    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: 'Skip to content' })
    await expect(skipLink).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused()

    await page.getByRole('link', { name: 'Accounts' }).click()
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible()
    await expect(page.getByRole('form', { name: 'Create user form' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy()
    await page.screenshot({ path: `${screenshotDir}/admin-users-narrow.png`, fullPage: true })
  })

  test('validates admin user operations against the backend', async ({ page }) => {
    const suffix = Date.now().toString(36)
    const tenantName = `E2E Merchant ${suffix}`
    const userEmail = `e2e-user-${suffix}@merhouse.local`
    const invalidEmail = `e2e-invalid-${suffix}@merhouse.local`

    await page.goto('/')
    await page.getByLabel('Email').fill('admin@merhouse.local')
    await page.getByLabel('Password').fill('local-owner-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('heading', { name: 'Admin Overview' })).toBeVisible()

    await page.getByRole('link', { name: 'Organizations' }).click()
    await expect(page.getByRole('heading', { name: 'Tenants', level: 1 })).toBeVisible()
    await page.getByRole('form', { name: 'Create tenant form' }).getByLabel('Name').fill(tenantName)
    await page.getByRole('button', { name: 'Create tenant' }).click()
    await expect(page.getByRole('cell', { name: tenantName })).toBeVisible()

    await page.getByRole('link', { name: 'Accounts' }).click()
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible()
    await expect(page.getByRole('row', { name: /admin@merhouse\.local/ }).getByRole('button', { name: 'Current user' })).toBeDisabled()

    const createUserForm = page.getByRole('form', { name: 'Create user form' })
    await createUserForm.getByLabel('Tenant').selectOption({ label: `${tenantName} (MERCHANT)` })
    await createUserForm.locator('#admin-user-role').selectOption('WAREHOUSE_OPERATOR')
    await createUserForm.getByLabel('Email').fill(invalidEmail)
    await createUserForm.getByLabel('Password').fill('operator-password')
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(page.getByText('WAREHOUSE_OPERATOR users must belong to a warehouse provider tenant.')).toBeVisible()

    await createUserForm.locator('#admin-user-role').selectOption('MERCHANT')
    await createUserForm.getByLabel('Email').fill(userEmail)
    await createUserForm.getByLabel('Password').fill('merchant-password')
    await page.getByRole('button', { name: 'Create user' }).click()

    const newUserRow = page.getByRole('row', { name: new RegExp(userEmail.replace('.', '\\.')) })
    await expect(newUserRow).toBeVisible()
    await newUserRow.getByRole('button', { name: 'Disable' }).click()
    await expect(newUserRow).toContainText('DISABLED')
    await expect(newUserRow.getByRole('button', { name: 'Disabled' })).toBeDisabled()
  })

  test('supports password recovery and access request review', async ({ page, request }) => {
    const suffix = Date.now().toString(36)
    let dialogSeen = false
    page.on('dialog', async (dialog) => {
      dialogSeen = true
      await dialog.dismiss()
    })
    const adminLogin = await api<{ accessToken: string }>(request, 'post', '/api/v1/auth/login', undefined, {
      email: 'admin@merhouse.local',
      password: 'local-owner-password',
    })
    const merchant = await api<{ id: string }>(request, 'post', '/api/v1/tenants', adminLogin.accessToken, {
      name: `E2E Recovery Merchant ${suffix}`,
      type: 'MERCHANT',
    })
    const merchantEmail = `e2e-recovery-${suffix}@merhouse.local`
    await api(request, 'post', '/api/v1/admin/users', adminLogin.accessToken, {
      tenantId: merchant.id,
      email: merchantEmail,
      password: 'merchant-password',
      role: 'MERCHANT',
    })

    await page.goto('/login')
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await expect(page.getByRole('heading', { name: 'Password Recovery' })).toBeVisible()
    await page.getByLabel('Email').fill(merchantEmail)
    await page.getByRole('button', { name: 'Request reset' }).click()
    await expect(page.getByText(/reset link has been prepared/i)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open reset link' })).toHaveCount(0)

    await page.goto('/request-access')
    const accessOrganization = `<img src=x onerror=alert(1)> E2E Access ${suffix}`
    await page.getByLabel('Organization').fill(accessOrganization)
    await page.getByLabel('Email').fill(`e2e-access-${suffix}@merhouse.local`)
    await page.getByLabel('Role').selectOption('WAREHOUSE_OPERATOR')
    await page.getByLabel('Notes').fill("' OR '1'='1 <script>alert(1)</script>")
    await page.getByRole('button', { name: 'Submit request' }).click()
    await expect(page.getByText(/access request pending/i)).toBeVisible()

    await page.evaluate(() => window.localStorage.clear())
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@merhouse.local')
    await page.getByLabel('Password').fill('local-owner-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Admin Overview' })).toBeVisible()
    await page.goto('/admin/access-requests')
    await expect(page.getByRole('heading', { name: 'Access Requests' })).toBeVisible({ timeout: 20_000 })
    const requestRow = page.getByRole('row', { name: new RegExp(`e2e-access-${suffix}@merhouse\\.local`) })
    await expect(requestRow).toContainText(accessOrganization)
    await expect(requestRow.locator('img')).toHaveCount(0)
    await expect(requestRow).toContainText('PENDING')
    await page.getByLabel('Note applied to the next review action').fill('Approved in Playwright')
    await requestRow.getByRole('button', { name: 'Approve' }).click()
    await expect(requestRow).toContainText('APPROVED')
    expect(dialogSeen).toBeFalsy()
  })

  test('can inspect and refresh outbox health', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Email').fill('admin@merhouse.local')
    await page.getByLabel('Password').fill('local-owner-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.getByRole('link', { name: 'Outbox' }).click()
    await expect(page.getByRole('heading', { name: 'Outbox', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent Events', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Carrier Dispatches', level: 2 })).toBeVisible()

    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeEnabled()
  })

  test('merchant can create inventory and manage an order', async ({ page, request }) => {
    const suffix = Date.now().toString(36)
    const tenantName = `E2E Flow Merchant ${suffix}`
    const merchantEmail = `e2e-merchant-${suffix}@merhouse.local`
    const merchantPassword = 'merchant-password'
    const sku = `E2E-SKU-${suffix}`
    const adminLogin = await api<{ accessToken: string }>(request, 'post', '/api/v1/auth/login', undefined, {
      email: 'admin@merhouse.local',
      password: 'local-owner-password',
    })
    const merchant = await api<{ id: string }>(request, 'post', '/api/v1/tenants', adminLogin.accessToken, {
      name: tenantName,
      type: 'MERCHANT',
    })
    await api(request, 'post', '/api/v1/admin/users', adminLogin.accessToken, {
      tenantId: merchant.id,
      email: merchantEmail,
      password: merchantPassword,
      role: 'MERCHANT',
    })

    await page.goto('/')
    await page.getByLabel('Email').fill(merchantEmail)
    await page.getByLabel('Password').fill(merchantPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Merchant Overview' })).toBeVisible()

    await page.getByRole('link', { name: 'Stock' }).click()
    const createItemForm = page.getByRole('form', { name: 'Create inventory item form' })
    await createItemForm.getByLabel('SKU').fill(sku)
    await createItemForm.getByLabel('Name').fill('E2E Merchant Item')
    await page.getByRole('button', { name: 'Create item' }).click()
    await expect(page.getByRole('cell', { name: sku })).toBeVisible()

    await page.getByRole('link', { name: 'Orders' }).click()
    const createOrderForm = page.getByRole('form', { name: 'Create order form' })
    await createOrderForm.getByLabel('Item').selectOption({ label: `${sku} - E2E Merchant Item` })
    await createOrderForm.getByLabel('Quantity').fill('2')
    await createOrderForm.getByLabel('Customer address').fill('E2E Customer, Cairo')
    await page.getByRole('button', { name: 'Create order' }).click()

    const orderCard = page.locator('article.queue-card').filter({ hasText: `${sku} x2` }).first()
    await expect(orderCard).toBeVisible()
    await orderCard.getByRole('button', { name: 'Allocate' }).click()
    await expect(orderCard).toContainText('BACKORDERED')
    await orderCard.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(orderCard).toContainText('CANCELLED')
  })

  test('warehouse operator can fulfill and deliver an allocation', async ({ page, request }) => {
    const suffix = Date.now().toString(36)
    const adminLogin = await api<{ accessToken: string }>(request, 'post', '/api/v1/auth/login', undefined, {
      email: 'admin@merhouse.local',
      password: 'local-owner-password',
    })
    const adminToken = adminLogin.accessToken
    const merchant = await api<{ id: string }>(request, 'post', '/api/v1/tenants', adminToken, {
      name: `E2E Operator Merchant ${suffix}`,
      type: 'MERCHANT',
    })
    const warehouseTenant = await api<{ id: string }>(request, 'post', '/api/v1/tenants', adminToken, {
      name: `E2E Operator Warehouse ${suffix}`,
      type: 'WAREHOUSE_PROVIDER',
    })
    const warehouse = await api<{ id: string }>(request, 'post', '/api/v1/warehouses', adminToken, {
      tenantId: warehouseTenant.id,
      name: `E2E Warehouse ${suffix}`,
      address: 'Operator Cairo',
      latitude: null,
      longitude: null,
      capacity: 100,
    })
    const item = await api<{ id: string }>(request, 'post', '/api/v1/inventory/items', adminToken, {
      merchantId: merchant.id,
      sku: `OP-E2E-${suffix}`,
      name: 'Operator E2E Item',
      attributes: { source: 'playwright' },
    })
    await createActiveRelationship(request, adminToken, merchant.id, warehouseTenant.id)
    await api(request, 'post', '/api/v1/inventory/stock', adminToken, {
      warehouseId: warehouse.id,
      inventoryItemId: item.id,
      quantity: 4,
    })
    const operatorEmail = `e2e-operator-${suffix}@merhouse.local`
    const operatorPassword = 'operator-password'
    await api(request, 'post', '/api/v1/admin/users', adminToken, {
      tenantId: warehouseTenant.id,
      email: operatorEmail,
      password: operatorPassword,
      role: 'WAREHOUSE_OPERATOR',
    })
    const order = await api<{ id: string }>(request, 'post', '/api/v1/orders', adminToken, {
      merchantId: merchant.id,
      customerAddress: 'Operator E2E Customer, Cairo',
      items: [{ inventoryItemId: item.id, quantity: 2 }],
    })
    await api(request, 'post', `/api/v1/orders/${order.id}/allocate`, adminToken)

    await page.goto('/')
    await page.getByLabel('Email').fill(operatorEmail)
    await page.getByLabel('Password').fill(operatorPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Warehouse Console' })).toBeVisible()

    const allocationCard = page.getByLabel(/Allocation .*Operator E2E Customer/)
    await expect(allocationCard).toContainText('PENDING')
    await allocationCard.getByRole('button', { name: 'Pick', exact: true }).click()
    await expect(allocationCard).toContainText('PICKING')
    await allocationCard.getByRole('button', { name: 'Pack' }).click()
    await expect(allocationCard).toContainText('PACKED')
    await allocationCard.getByRole('button', { name: 'Ship' }).click()
    await expect(allocationCard).toContainText('SHIPPED')
    await expect(allocationCard).toContainText('IN_TRANSIT')
    await allocationCard.getByRole('button', { name: 'Deliver' }).click()
    await expect(allocationCard).toContainText('DELIVERED')
  })

  test('warehouse operator can fail and return in-transit shipments', async ({ page, request }) => {
    const suffix = Date.now().toString(36)
    const adminLogin = await api<{ accessToken: string }>(request, 'post', '/api/v1/auth/login', undefined, {
      email: 'admin@merhouse.local',
      password: 'local-owner-password',
    })
    const adminToken = adminLogin.accessToken
    const merchant = await api<{ id: string }>(request, 'post', '/api/v1/tenants', adminToken, {
      name: `E2E Shipment Merchant ${suffix}`,
      type: 'MERCHANT',
    })
    const warehouseTenant = await api<{ id: string }>(request, 'post', '/api/v1/tenants', adminToken, {
      name: `E2E Shipment Warehouse ${suffix}`,
      type: 'WAREHOUSE_PROVIDER',
    })
    const warehouse = await api<{ id: string }>(request, 'post', '/api/v1/warehouses', adminToken, {
      tenantId: warehouseTenant.id,
      name: `E2E Shipment Warehouse ${suffix}`,
      address: 'Shipment Cairo',
      latitude: null,
      longitude: null,
      capacity: 100,
    })
    const item = await api<{ id: string }>(request, 'post', '/api/v1/inventory/items', adminToken, {
      merchantId: merchant.id,
      sku: `SHIP-E2E-${suffix}`,
      name: 'Shipment E2E Item',
      attributes: { source: 'playwright' },
    })
    await createActiveRelationship(request, adminToken, merchant.id, warehouseTenant.id)
    await api(request, 'post', '/api/v1/inventory/stock', adminToken, {
      warehouseId: warehouse.id,
      inventoryItemId: item.id,
      quantity: 10,
    })
    const operatorEmail = `e2e-ship-operator-${suffix}@merhouse.local`
    const operatorPassword = 'operator-password'
    await api(request, 'post', '/api/v1/admin/users', adminToken, {
      tenantId: warehouseTenant.id,
      email: operatorEmail,
      password: operatorPassword,
      role: 'WAREHOUSE_OPERATOR',
    })

    async function createInTransitOrder(label: string) {
      const order = await api<{ id: string; allocations: { id: string }[] }>(request, 'post', '/api/v1/orders', adminToken, {
        merchantId: merchant.id,
        customerAddress: `${label} Shipment Customer, Cairo`,
        items: [{ inventoryItemId: item.id, quantity: 2 }],
      })
      const allocated = await api<{ allocations: { id: string }[] }>(request, 'post', `/api/v1/orders/${order.id}/allocate`, adminToken)
      const allocationId = allocated.allocations[0].id
      await api(request, 'patch', `/api/v1/fulfillment-allocations/${allocationId}/status`, adminToken, { nextStatus: 'PICKING' })
      await api(request, 'patch', `/api/v1/fulfillment-allocations/${allocationId}/status`, adminToken, { nextStatus: 'PACKED' })
      await api(request, 'post', '/api/v1/shipments', adminToken, {
        allocationId,
        carrier: 'FedEx',
        trackingNumber: `TRACK-${label}-${suffix}`,
        packageCount: 1,
        packageWeightKg: 2.5,
        packageLengthCm: 40,
        packageWidthCm: 30,
        packageHeightCm: 20,
        packingNote: 'Playwright shipment packed with V10 evidence.',
        metadata: { source: 'playwright', evidence: 'e2e' },
      })
    }

    await createInTransitOrder('Failed')
    await createInTransitOrder('Returned')

    await page.goto('/')
    await page.getByLabel('Email').fill(operatorEmail)
    await page.getByLabel('Password').fill(operatorPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Warehouse Console' })).toBeVisible()

    const failedCard = page.getByLabel(/Allocation .*Failed Shipment Customer/)
    await expect(failedCard).toContainText('IN_TRANSIT')
    await failedCard.getByRole('button', { name: 'Mark failed' }).click()
    await expect(failedCard).toContainText('FAILED')

    const returnedCard = page.getByLabel(/Allocation .*Returned Shipment Customer/)
    await expect(returnedCard).toContainText('IN_TRANSIT')
    await returnedCard.getByRole('button', { name: 'Mark returned' }).click()
    await expect(returnedCard).toContainText('RETURNED')
  })

  test('merchant and warehouse complete the V8 operating loop through the UI', async ({ page, request }) => {
    const suffix = Date.now().toString(36)
    const adminLogin = await api<{ accessToken: string }>(request, 'post', '/api/v1/auth/login', undefined, {
      email: 'admin@merhouse.local',
      password: 'local-owner-password',
    })
    const adminToken = adminLogin.accessToken
    const merchant = await api<{ id: string }>(request, 'post', '/api/v1/tenants', adminToken, {
      name: `E2E V8 Merchant ${suffix}`,
      type: 'MERCHANT',
    })
    const warehouseTenant = await api<{ id: string }>(request, 'post', '/api/v1/tenants', adminToken, {
      name: `E2E V8 Warehouse ${suffix}`,
      type: 'WAREHOUSE_PROVIDER',
    })
    await api(request, 'post', '/api/v1/warehouses', adminToken, {
      tenantId: warehouseTenant.id,
      name: `V8 Hub ${suffix}`,
      address: 'V8 Cairo',
      latitude: null,
      longitude: null,
      capacity: 200,
    })
    const merchantEmail = `e2e-v8-merchant-${suffix}@merhouse.local`
    const operatorEmail = `e2e-v8-operator-${suffix}@merhouse.local`
    const merchantPassword = 'merchant-password'
    const operatorPassword = 'operator-password'
    await api(request, 'post', '/api/v1/admin/users', adminToken, {
      tenantId: merchant.id,
      email: merchantEmail,
      password: merchantPassword,
      role: 'MERCHANT',
    })
    await api(request, 'post', '/api/v1/admin/users', adminToken, {
      tenantId: warehouseTenant.id,
      email: operatorEmail,
      password: operatorPassword,
      role: 'WAREHOUSE_OPERATOR',
    })

    const sku = `V8-E2E-${suffix}`
    await page.goto('/login')
    await page.getByLabel('Email').fill(merchantEmail)
    await page.getByLabel('Password').fill(merchantPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Merchant Overview' })).toBeVisible()
    await page.getByRole('link', { name: 'Stock' }).click()
    await page.getByRole('form', { name: 'Create inventory item form' }).getByLabel('SKU').fill(sku)
    await page.getByRole('form', { name: 'Create inventory item form' }).getByLabel('Name').fill('V8 E2E Item')
    await page.getByRole('button', { name: 'Create item' }).click()
    await expect(page.getByRole('cell', { name: sku })).toBeVisible()

    const relationshipForm = page.getByRole('form', { name: 'Request warehouse service form' })
    await relationshipForm.getByLabel('Warehouse provider').selectOption({ label: `E2E V8 Warehouse ${suffix}` })
    await relationshipForm.getByLabel('Service notes').fill('Daily V8 receiving')
    await relationshipForm.getByRole('button', { name: 'Request service' }).click()
    await expect(page.getByRole('row', { name: /Daily V8 receiving/ })).toContainText('REQUESTED')

    await page.getByRole('button', { name: 'Logout' }).click()
    await page.getByLabel('Email').fill(operatorEmail)
    await page.getByLabel('Password').fill(operatorPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Warehouse Console' })).toBeVisible()
    const relationshipRow = page.getByRole('row', { name: /Daily V8 receiving/ })
    await relationshipRow.getByRole('button', { name: 'Activate' }).click()
    await expect(relationshipRow).toContainText('ACTIVE')

    await page.getByRole('button', { name: 'Logout' }).click()
    await page.getByLabel('Email').fill(merchantEmail)
    await page.getByLabel('Password').fill(merchantPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('link', { name: 'Stock' }).click()
    const inboundForm = page.getByRole('form', { name: 'Submit inbound stock form' })
    await inboundForm.getByLabel('Relationship').selectOption({ label: `E2E V8 Warehouse ${suffix}` })
    await inboundForm.getByLabel('Target warehouse').selectOption({ label: `V8 Hub ${suffix}` })
    await inboundForm.getByLabel('Item').selectOption({ label: `${sku} - V8 E2E Item` })
    await inboundForm.getByLabel('Quantity').fill('4')
    await inboundForm.getByLabel('Reference').fill(`ASN-${suffix}`)
    await inboundForm.getByRole('button', { name: 'Submit inbound' }).click()
    await expect(page.getByRole('row', { name: new RegExp(`ASN-${suffix}`) })).toContainText('SUBMITTED')

    await page.getByRole('button', { name: 'Logout' }).click()
    await page.getByLabel('Email').fill(operatorEmail)
    await page.getByLabel('Password').fill(operatorPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    const inboundRow = () => page.getByRole('row', { name: new RegExp(`${sku} - V8 E2E Item`) })
    await clickFreshButton(() => inboundRow().getByRole('button', { name: 'Approve' }))
    await expect(inboundRow()).toContainText('APPROVED', { timeout: 20_000 })
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Warehouse Console' })).toBeVisible()
    await expect(inboundRow()).toContainText('APPROVED', { timeout: 20_000 })
    await expect(inboundRow().getByRole('button', { name: 'Receive all' })).toBeVisible()
    await clickFreshButton(() => inboundRow().getByRole('button', { name: 'Receive all' }))
    await expect(inboundRow().getByText('No warehouse action')).toBeVisible()
    await expect(inboundRow()).toContainText('RECEIVED', { timeout: 20_000 })

    await page.getByRole('button', { name: 'Logout' }).click()
    await page.getByLabel('Email').fill(merchantEmail)
    await page.getByLabel('Password').fill(merchantPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('link', { name: 'Orders' }).click()
    const orderForm = page.getByRole('form', { name: 'Create order form' })
    await orderForm.getByLabel('Item').selectOption({ label: `${sku} - V8 E2E Item` })
    await orderForm.getByLabel('Quantity').fill('2')
    await orderForm.getByLabel('Customer address').fill(`V8 Customer ${suffix}, Cairo`)
    await orderForm.getByRole('button', { name: 'Create order' }).click()
    const orderCard = page.locator('article.queue-card').filter({ hasText: `${sku} x2` }).first()
    await orderCard.getByRole('button', { name: 'Allocate' }).click()
    await expect(orderCard).toContainText(`V8 Hub ${suffix}`)
    await orderCard.locator('a').first().click()
    await expect(page.getByRole('heading', { name: 'Order Detail' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible()

    await page.getByRole('button', { name: 'Logout' }).click()
    await page.getByLabel('Email').fill(operatorEmail)
    await page.getByLabel('Password').fill(operatorPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    const allocationCard = page.getByLabel(new RegExp(`Allocation .*V8 Customer ${suffix}`))
    await expect(allocationCard).toContainText('PENDING')
    await allocationCard.locator('a').first().click()
    await expect(page.getByRole('heading', { name: 'Allocation Detail' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible()
  })

  test('shows V11 service accountability records and import validation', async ({ page, request }) => {
    mkdirSync('../reports/v11', { recursive: true })
    const suffix = Date.now().toString(36)
    const adminLogin = await api<{ accessToken: string }>(request, 'post', '/api/v1/auth/login', undefined, {
      email: 'admin@merhouse.local',
      password: 'local-owner-password',
    })
    const adminToken = adminLogin.accessToken
    const merchant = await api<{ id: string }>(request, 'post', '/api/v1/tenants', adminToken, {
      name: `E2E V11 Merchant ${suffix}`,
      type: 'MERCHANT',
    })
    const warehouseTenant = await api<{ id: string }>(request, 'post', '/api/v1/tenants', adminToken, {
      name: `E2E V11 Warehouse ${suffix}`,
      type: 'WAREHOUSE_PROVIDER',
    })
    const warehouse = await api<{ id: string }>(request, 'post', '/api/v1/warehouses', adminToken, {
      tenantId: warehouseTenant.id,
      name: `V11 Hub ${suffix}`,
      address: 'V11 Cairo',
      latitude: null,
      longitude: null,
      capacity: 100,
    })
    const item = await api<{ id: string }>(request, 'post', '/api/v1/inventory/items', adminToken, {
      merchantId: merchant.id,
      sku: `V11-SKU-${suffix}`,
      name: 'V11 Service Item',
      attributes: { source: 'playwright-v11' },
    })
    const relationship = await createActiveRelationship(request, adminToken, merchant.id, warehouseTenant.id)
    const inbound = await api<{ id: string }>(request, 'post', '/api/v1/merchant-warehouse/inbound-stock-requests', adminToken, {
      relationshipId: relationship.id,
      warehouseId: warehouse.id,
      inventoryItemId: item.id,
      requestedQuantity: 3,
      merchantReference: `V11-ASN-${suffix}`,
      merchantNote: 'Playwright V11 inbound',
    })
    await api(request, 'patch', `/api/v1/merchant-warehouse/inbound-stock-requests/${inbound.id}/approve`, adminToken)
    await api(request, 'patch', `/api/v1/merchant-warehouse/inbound-stock-requests/${inbound.id}/receiving`, adminToken)
    await api(request, 'patch', `/api/v1/merchant-warehouse/inbound-stock-requests/${inbound.id}/receive`, adminToken, {
      receivedQuantity: 3,
      damagedQuantity: 0,
      receivingNote: 'Received for V11 Playwright proof',
    })
    const today = new Date()
    const isoDate = (days: number) => new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10)
    const agreement = await api<{ id: string }>(request, 'post', '/api/v1/service-accountability/agreements', adminToken, {
      relationshipId: relationship.id,
      title: `V11 Service Terms ${suffix}`,
      effectiveDate: isoDate(1),
      renewalReviewDate: isoDate(30),
      cancellationWindowDays: 14,
      serviceScopes: ['INBOUND_RECEIVING', 'STORAGE', 'PICK_PACK', 'SHIPMENT_HANDOFF'],
      serviceNotes: 'Internal service-accountability record',
      rateCard: {
        inboundReceivingFeePerUnit: 2.5,
        coordinationFeePercent: 5,
        fixedCoordinationFee: 1,
      },
      slaPolicy: {
        receivingSlaHours: 48,
        pickPackSlaHours: 24,
        shipmentHandoffSlaHours: 12,
        exceptionResponseSlaHours: 8,
      },
    })
    await api(request, 'patch', `/api/v1/service-accountability/agreements/${agreement.id}/propose`, adminToken)
    await api(request, 'patch', `/api/v1/service-accountability/agreements/${agreement.id}/accept`, adminToken)
    const statement = await api<{ id: string; lines: { id: string }[] }>(request, 'post', `/api/v1/service-accountability/agreements/${agreement.id}/statements/generate`, adminToken, {
      periodStart: isoDate(0),
      periodEnd: isoDate(7),
      dueDate: isoDate(14),
      idempotencyKey: `e2e-v11-${suffix}`,
      inboundStockRequestIds: [inbound.id],
    })
    await api(request, 'post', `/api/v1/service-accountability/statements/${statement.id}/disputes`, adminToken, {
      statementLineId: statement.lines[0].id,
      reason: 'Playwright dispute review',
      evidenceNote: 'Visible dispute proof',
    })
    await api(request, 'post', `/api/v1/service-accountability/agreements/${agreement.id}/claims`, adminToken, {
      sourceType: 'INBOUND_STOCK_REQUEST',
      sourceId: inbound.id,
      claimType: 'RECEIVING_REVIEW',
      reason: 'Playwright claim review',
    })
    await api(request, 'post', `/api/v1/service-accountability/agreements/${agreement.id}/reviews`, adminToken, {
      reviewType: 'MANUAL_ADJUSTMENT',
      reason: 'Playwright service review',
    })
    await api(request, 'post', '/api/v1/orders/imports', adminToken, {
      merchantId: merchant.id,
      mode: 'PARTIAL_ACCEPT',
      sourceLabel: `V11 Import ${suffix}`,
      rows: [
        {
          merchantOrderReference: `V11-IMPORT-${suffix}-1`,
          sku: `V11-SKU-${suffix}`,
          quantity: 1,
          customerAddress: 'V11 Import Customer',
        },
        {
          merchantOrderReference: `V11-IMPORT-${suffix}-1`,
          sku: `V11-SKU-${suffix}`,
          quantity: 1,
          customerAddress: 'Duplicate Import Customer',
        },
      ],
    })
    const merchantEmail = `e2e-v11-merchant-${suffix}@merhouse.local`
    await api(request, 'post', '/api/v1/admin/users', adminToken, {
      tenantId: merchant.id,
      email: merchantEmail,
      password: 'merchant-password',
      role: 'MERCHANT',
    })

    await page.goto('/login')
    await page.getByLabel('Email').fill(merchantEmail)
    await page.getByLabel('Password').fill('merchant-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Merchant Overview' })).toBeVisible()
    await page.getByRole('link', { name: 'Service review' }).click()
    await expect(page.getByRole('heading', { name: 'Service Accountability' })).toBeVisible()
    await expect(page.getByText(`V11 Service Terms ${suffix}`)).toBeVisible()
    await expect(page.getByText('INBOUND STOCK REQUEST')).toBeVisible()
    await expect(page.getByText('Playwright dispute review')).toBeVisible()
    await expect(page.getByText('RECEIVING REVIEW')).toBeVisible()
    await expect(page.getByText(`V11 Import ${suffix}`)).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy()
    await page.screenshot({ path: `../reports/v11/service-accountability-${suffix}.png`, fullPage: true })
  })
})
