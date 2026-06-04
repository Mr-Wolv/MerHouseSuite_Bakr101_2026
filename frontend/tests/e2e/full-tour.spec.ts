import { expect, test } from '@playwright/test'
import type { APIRequestContext, Browser, Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const APP_URL = process.env.FRONTEND_TOUR_BASE_URL ?? 'http://localhost:3000'
const API_URL = process.env.E2E_API_URL ?? APP_URL
const REPORT_PATH = process.env.FRONTEND_TOUR_REPORT ?? '../reports/latest-frontend-full-tour.json'
const TOKEN_KEY = 'warehouse-console-token'

type Role = 'public' | 'owner' | 'admin' | 'supportAdmin' | 'auditor' | 'merchant' | 'warehouse'
type AuthenticatedRole = Exclude<Role, 'public'>

type Account = {
  email: string
  password: string
}

type TourCase = {
  role: Role
  path: string
  viewport: 'desktop' | 'narrow'
}

type TourRecord = TourCase & {
  status: number
  title: string
  heading: string
  overflow: boolean
  buttonCount: number
  enabledButtonCount: number
  linkCount: number
  formControlCount: number
  interactionUnitCount: number
  emptyControlLabels: string[]
  unlabeledFormControls: string[]
  consoleErrors: string[]
}

type ApiEntity = {
  id: string
  [key: string]: unknown
}

const baseAccounts: Record<'owner' | 'merchant' | 'warehouse', Account> = {
  owner: {
    email: process.env.FRONTEND_TOUR_ADMIN_EMAIL ?? 'admin@merhouse.local',
    password: process.env.FRONTEND_TOUR_ADMIN_PASSWORD ?? 'local-owner-password',
  },
  merchant: {
    email: process.env.FRONTEND_TOUR_MERCHANT_EMAIL ?? 'review.merchant@merhouse.local',
    password: process.env.FRONTEND_TOUR_MERCHANT_PASSWORD ?? 'review-password',
  },
  warehouse: {
    email: process.env.FRONTEND_TOUR_WAREHOUSE_EMAIL ?? 'review.operator@merhouse.local',
    password: process.env.FRONTEND_TOUR_WAREHOUSE_PASSWORD ?? 'review-password',
  },
}

const publicPaths = ['/login', '/forgot-password', '/reset-password', '/request-access']
const rolePaths: Record<Exclude<Role, 'public'>, string[]> = {
  owner: [
    '/admin',
    '/admin/tenants',
    '/admin/users',
    '/admin/access-requests',
    '/admin/outbox',
    '/admin/relationships',
    '/admin/audit',
    '/service-accountability',
    '/assistant',
    '/notifications',
  ],
  admin: [
    '/admin',
    '/admin/tenants',
    '/admin/users',
    '/admin/access-requests',
    '/admin/outbox',
    '/admin/relationships',
    '/admin/audit',
    '/service-accountability',
    '/assistant',
    '/notifications',
  ],
  supportAdmin: [
    '/admin',
    '/admin/users',
    '/admin/access-requests',
    '/admin/outbox',
    '/admin/relationships',
    '/admin/audit',
    '/service-accountability',
    '/assistant',
    '/notifications',
  ],
  auditor: [
    '/admin',
    '/admin/outbox',
    '/admin/relationships',
    '/admin/audit',
    '/service-accountability',
    '/assistant',
    '/notifications',
  ],
  merchant: ['/merchant', '/merchant/inventory', '/merchant/orders', '/service-accountability', '/assistant', '/notifications'],
  warehouse: ['/warehouse', '/service-accountability', '/assistant', '/notifications'],
}

const viewports = {
  desktop: { width: 1366, height: 900 },
  narrow: { width: 390, height: 844 },
} as const

const detailPathPattern =
  /^\/(orders|shipments|fulfillment-allocations|inbound-stock-requests|inventory\/items|merchant-warehouse\/relationships)\//
const detailPathKinds = [
  'orders',
  'shipments',
  'fulfillment-allocations',
  'inbound-stock-requests',
  'inventory/items',
  'merchant-warehouse/relationships',
] as const

function detailPathKind(path: string) {
  return detailPathKinds.find((kind) => path.startsWith(`/${kind}/`))
}

async function loginToken(request: APIRequestContext, account: Account) {
  const response = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: {
      email: account.email,
      password: account.password,
    },
  })
  expect(response.ok(), `login should work for ${account.email}`).toBeTruthy()
  const body = (await response.json()) as { accessToken?: string }
  expect(body.accessToken, `login token should be present for ${account.email}`).toBeTruthy()
  return body.accessToken as string
}

async function apiJson<T>(
  request: APIRequestContext,
  method: 'get' | 'post' | 'patch',
  path: string,
  token: string,
  data?: unknown,
) {
  const response = await request[method](`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  })
  expect(response.ok(), `${method.toUpperCase()} ${path} should succeed`).toBeTruthy()
  return (await response.json()) as T
}

async function publicApiJson<T>(
  request: APIRequestContext,
  method: 'get' | 'post' | 'patch',
  path: string,
  data?: unknown,
) {
  const response = await request[method](`${API_URL}${path}`, { data })
  expect(response.ok(), `${method.toUpperCase()} ${path} should succeed`).toBeTruthy()
  return (await response.json()) as T
}

async function createHarmonicFixture(request: APIRequestContext) {
  const adminToken = await loginToken(request, baseAccounts.owner)
  const suffix = `tour-${Date.now().toString(36)}`
  const password = 'tour-password'

  const merchant = await apiJson<ApiEntity>(request, 'post', '/api/v1/tenants', adminToken, {
    name: `Tour Merchant ${suffix}`,
    type: 'MERCHANT',
  })
  const provider = await apiJson<ApiEntity>(request, 'post', '/api/v1/tenants', adminToken, {
    name: `Tour Warehouse ${suffix}`,
    type: 'WAREHOUSE_PROVIDER',
  })
  const warehouse = await apiJson<ApiEntity>(request, 'post', '/api/v1/warehouses', adminToken, {
    tenantId: provider.id,
    name: `Tour Fulfillment Hub ${suffix}`,
    address: `Tour District ${suffix}`,
    latitude: null,
    longitude: null,
    capacity: 500,
  })
  const item = await apiJson<ApiEntity>(request, 'post', '/api/v1/inventory/items', adminToken, {
    merchantId: merchant.id,
    sku: `TOUR-SKU-${suffix}`,
    name: `Tour Item ${suffix}`,
    attributes: { tour: true, suffix },
  })
  let relationship = await apiJson<ApiEntity>(request, 'post', '/api/v1/merchant-warehouse/relationships', adminToken, {
    merchantId: merchant.id,
    warehouseProviderId: provider.id,
    serviceNotes: `Tour service lane ${suffix}`,
  })
  relationship = await apiJson<ApiEntity>(
    request,
    'patch',
    `/api/v1/merchant-warehouse/relationships/${relationship.id}/activate`,
    adminToken,
  )
  const merchantAccount = {
    email: `tour.merchant.${suffix}@merhouse.local`,
    password,
  }
  const warehouseAccount = {
    email: `tour.operator.${suffix}@merhouse.local`,
    password,
  }
  await apiJson<ApiEntity>(request, 'post', '/api/v1/admin/users', adminToken, {
    tenantId: merchant.id,
    email: merchantAccount.email,
    password,
    role: 'MERCHANT',
  })
  await apiJson<ApiEntity>(request, 'post', '/api/v1/admin/users', adminToken, {
    tenantId: provider.id,
    email: warehouseAccount.email,
    password,
    role: 'WAREHOUSE_OPERATOR',
  })

  return { suffix, merchant, provider, warehouse, item, relationship, merchantAccount, warehouseAccount }
}

async function createPlatformHierarchyFixture(request: APIRequestContext) {
  const ownerToken = await loginToken(request, baseAccounts.owner)
  const suffix = `roles-${Date.now().toString(36)}`
  const password = 'tour-password'

  const tenant = await apiJson<ApiEntity>(request, 'post', '/api/v1/tenants', ownerToken, {
    name: `Role Tour Tenant ${suffix}`,
    type: 'MERCHANT',
  })

  const makeAccount = async (role: 'ADMIN' | 'SUPPORT_ADMIN' | 'AUDITOR') => {
    const account = {
      email: `tour.${role.toLowerCase().replaceAll('_', '-')}.${suffix}@merhouse.local`,
      password,
    }
    await apiJson<ApiEntity>(request, 'post', '/api/v1/admin/users', ownerToken, {
      tenantId: tenant.id,
      email: account.email,
      password,
      role,
    })
    return account
  }
  const ordinaryMerchant = {
    email: `tour.merchant-user.${suffix}@merhouse.local`,
    password,
  }
  await apiJson<ApiEntity>(request, 'post', '/api/v1/admin/users', ownerToken, {
    tenantId: tenant.id,
    email: ordinaryMerchant.email,
    password,
    role: 'MERCHANT',
  })

  return {
    suffix,
    tenant,
    ordinaryMerchant,
    accounts: {
      owner: baseAccounts.owner,
      admin: await makeAccount('ADMIN'),
      supportAdmin: await makeAccount('SUPPORT_ADMIN'),
      auditor: await makeAccount('AUDITOR'),
      merchant: baseAccounts.merchant,
      warehouse: baseAccounts.warehouse,
    } satisfies Record<AuthenticatedRole, Account>,
  }
}

async function newAuthedPage(
  browser: Browser,
  role: AuthenticatedRole,
  viewport: keyof typeof viewports,
  accounts: Record<AuthenticatedRole, Account>,
) {
  return newAuthedPageForAccount(browser, accounts[role], viewport)
}

async function newAuthedPageForAccount(browser: Browser, account: Account, viewport: keyof typeof viewports) {
  const context = await browser.newContext({ viewport: viewports[viewport] })
  const token = await loginToken(context.request, account)
  await context.addInitScript(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // Chromium blocks localStorage on about:blank; the script also runs on the real app origin.
      }
    },
    { key: TOKEN_KEY, value: token },
  )
  const page = await context.newPage()
  return { context, page }
}

async function chooseSelectOptionByText(page: Page, formLabel: string, selectLabel: string, optionText: string) {
  await page.locator(`form[aria-label="${formLabel}"]`).evaluate(
    (form, labels) => {
      const select = [...form.querySelectorAll('select')].find((candidate) => {
        const ariaLabel = candidate.getAttribute('aria-label')
        const explicitLabel = candidate.id
          ? form.querySelector(`label[for="${candidate.id}"]`)?.textContent
          : null
        const wrappingLabel = candidate.closest('label')?.textContent
        return [ariaLabel, explicitLabel, wrappingLabel].some((text) => text?.includes(labels.selectLabel))
      }) as HTMLSelectElement | undefined
      if (!select) {
        throw new Error(`No select with label ${labels.selectLabel}`)
      }
      const option = [...select.options].find((candidate) => candidate.textContent?.includes(labels.optionText))
      if (!option) {
        throw new Error(`No option containing ${labels.optionText}`)
      }
      select.value = option.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    },
    { selectLabel, optionText },
  )
}

async function collectDetailPaths(
  browser: Browser,
  role: AuthenticatedRole,
  account: Account,
) {
  const { context, page } = await newAuthedPageForAccount(browser, account, 'desktop')
  const pathsByKind = new Map<string, string>()

  for (const path of rolePaths[role]) {
    await page.goto(`${APP_URL}${path}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 })
    const hrefs = await page.locator('a[href]').evaluateAll((anchors) =>
      anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
    )
    for (const href of hrefs) {
      const url = new URL(href)
      const kind = detailPathKind(url.pathname)
      if (kind && detailPathPattern.test(url.pathname) && !pathsByKind.has(kind)) {
        pathsByKind.set(kind, url.pathname)
      }
      if (pathsByKind.size === detailPathKinds.length) {
        break
      }
    }
    if (pathsByKind.size === detailPathKinds.length) {
      break
    }
  }

  await context.close()
  return [...pathsByKind.values()]
}

async function inspectPage(page: Page, role: Role, path: string, viewport: 'desktop' | 'narrow') {
  page.removeAllListeners('console')
  page.removeAllListeners('pageerror')
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message)
  })

  const response = await page.goto(`${APP_URL}${path}`, { waitUntil: 'domcontentloaded' })
  expect(response, `${role} ${path} should return a response`).toBeTruthy()
  await expect(page.locator('h1').first(), `${role} ${path} h1 should render`).toBeVisible({ timeout: 20_000 })

  const record = await page.evaluate(
    ({ roleName, routePath, viewportName, errors }) => {
      const heading = document.querySelector('h1')?.textContent?.trim() ?? ''
      const visible = (element: Element) => {
        const htmlElement = element as HTMLElement
        if (htmlElement.hidden || htmlElement.getAttribute('aria-hidden') === 'true') return false
        if (htmlElement instanceof HTMLInputElement && htmlElement.type === 'hidden') return false
        const style = window.getComputedStyle(htmlElement)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        return htmlElement.offsetParent !== null || style.position === 'fixed'
      }
      const controlName = (element: Element) => {
        const htmlElement = element as HTMLElement
        const id = htmlElement.id
        const labelByFor = id
          ? [...document.querySelectorAll('label')].find((label) => label.htmlFor === id)?.textContent?.trim()
          : ''
        const labelledBy = htmlElement.getAttribute('aria-labelledby')
          ?.split(/\s+/)
          .map((labelId) => document.getElementById(labelId)?.textContent?.trim() ?? '')
          .filter(Boolean)
          .join(' ')
        const wrappingLabel = htmlElement.closest('label')?.textContent?.trim()
        const title = htmlElement.getAttribute('title')
        const aria = htmlElement.getAttribute('aria-label')
        const placeholder = htmlElement.getAttribute('placeholder')
        const text = htmlElement.textContent?.trim()
        const name = htmlElement.getAttribute('name')
        return [aria, labelledBy, labelByFor, wrappingLabel, text, placeholder, title, name]
          .map((candidate) => candidate?.trim() ?? '')
          .find((candidate) => candidate.length > 0) ?? ''
      }
      const controls = [...document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="checkbox"], [role="switch"], [role="combobox"], [role="tab"]')]
        .filter(visible)
      const emptyControlLabels = controls
        .filter((control) => controlName(control).length === 0)
        .map((control) => {
          const element = control as HTMLElement
          return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.getAttribute('role') ? `[role=${element.getAttribute('role')}]` : ''}`
        })
      const buttons = [...document.querySelectorAll('button')]
      const formControls = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')]
        .filter(visible)
      const unlabeledFormControls = formControls
        .filter((control) => {
          const element = control as HTMLElement
          const id = element.id
          const hasHtmlFor = Boolean(id && [...document.querySelectorAll('label')].some((label) => label.htmlFor === id))
          const hasExplicitAria = Boolean(element.getAttribute('aria-label')?.trim() || element.getAttribute('aria-labelledby')?.trim())
          return !hasHtmlFor && !hasExplicitAria
        })
        .map((control) => {
          const element = control as HTMLElement
          return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} ${controlName(element) || '(unnamed)'}`
        })

      return {
        role: roleName,
        path: routePath,
        viewport: viewportName,
        status: 0,
        title: document.title,
        heading,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        buttonCount: buttons.length,
        enabledButtonCount: buttons.filter((button) => !button.disabled).length,
        linkCount: document.querySelectorAll('a[href]').length,
        formControlCount: formControls.length,
        interactionUnitCount: controls.length,
        emptyControlLabels,
        unlabeledFormControls,
        consoleErrors: errors,
      }
    },
    { roleName: role, routePath: path, viewportName: viewport, errors: consoleErrors },
  )

  record.status = response?.status() ?? 0
  expect(record.status, `${role} ${path} status`).toBe(200)
  expect(record.title, `${role} ${path} title`).toBe('MerHouse')
  expect(record.heading, `${role} ${path} h1`).not.toEqual('')
  expect(record.overflow, `${role} ${path} ${viewport} overflow`).toBeFalsy()
  expect(record.consoleErrors, `${role} ${path} console errors`).toEqual([])
  expect(record.emptyControlLabels, `${role} ${path} empty control labels`).toEqual([])
  expect(record.unlabeledFormControls, `${role} ${path} strictly labeled form controls`).toEqual([])

  return record as TourRecord
}

test('full frontend route tour passes with seeded accounts', async ({ browser, request }) => {
  test.setTimeout(420_000)
  const hierarchy = await createPlatformHierarchyFixture(request)
  const records: TourRecord[] = []
  const detailCases: TourCase[] = []
  const detailPathsByRole: Partial<Record<AuthenticatedRole, string[]>> = {}
  const accounts = hierarchy.accounts

  for (const role of ['owner', 'admin', 'supportAdmin', 'auditor', 'merchant', 'warehouse'] as const) {
    const detailPaths = await collectDetailPaths(browser, role, accounts[role])
    detailPathsByRole[role] = detailPaths
    for (const path of detailPaths) {
      detailCases.push({ role, path, viewport: 'desktop' }, { role, path, viewport: 'narrow' })
    }
  }

  const baseCases: TourCase[] = [
    ...publicPaths.flatMap((path) => [
      { role: 'public' as const, path, viewport: 'desktop' as const },
      { role: 'public' as const, path, viewport: 'narrow' as const },
    ]),
    ...Object.entries(rolePaths).flatMap(([role, paths]) =>
      paths.flatMap((path) => [
        { role: role as AuthenticatedRole, path, viewport: 'desktop' as const },
        { role: role as AuthenticatedRole, path, viewport: 'narrow' as const },
      ]),
    ),
  ]

  const cases = [...baseCases, ...detailCases]

  for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
    const publicContext = await browser.newContext({ viewport: viewports[viewport] })
    const publicPage = await publicContext.newPage()
    for (const tourCase of cases.filter((candidate) => candidate.role === 'public' && candidate.viewport === viewport)) {
      records.push(await inspectPage(publicPage, tourCase.role, tourCase.path, tourCase.viewport))
    }
    await publicContext.close()

    for (const role of ['owner', 'admin', 'supportAdmin', 'auditor', 'merchant', 'warehouse'] as const) {
      const roleCases = cases.filter((candidate) => candidate.role === role && candidate.viewport === viewport)
      if (roleCases.length === 0) {
        continue
      }
      const { context, page } = await newAuthedPage(browser, role, viewport, accounts)
      for (const tourCase of roleCases) {
        records.push(await inspectPage(page, tourCase.role, tourCase.path, tourCase.viewport))
      }
      await context.close()
    }
  }

  const resolvedReportPath = resolve(process.cwd(), REPORT_PATH)
  mkdirSync(dirname(resolvedReportPath), { recursive: true })
  writeFileSync(
    resolvedReportPath,
    `${JSON.stringify(
      {
        appUrl: APP_URL,
        apiUrl: API_URL,
        checkedAt: new Date().toISOString(),
        checkedRoutes: records.length,
        acceptanceStandard: 'Every routed surface records visible interactive controls and requires visible form controls to have explicit label bindings or ARIA names.',
        detailPathsByRole,
        totals: {
          interactionUnits: records.reduce((sum, record) => sum + record.interactionUnitCount, 0),
          formControls: records.reduce((sum, record) => sum + record.formControlCount, 0),
          buttons: records.reduce((sum, record) => sum + record.buttonCount, 0),
          enabledButtons: records.reduce((sum, record) => sum + record.enabledButtonCount, 0),
          links: records.reduce((sum, record) => sum + record.linkCount, 0),
        },
        records,
      },
      null,
      2,
    )}\n`,
  )
})

test('admin hierarchy tour proves role-specific actions and denials', async ({ browser, request }) => {
  test.setTimeout(180_000)
  const hierarchy = await createPlatformHierarchyFixture(request)
  const records: Array<Record<string, unknown>> = []

  const submitted = await publicApiJson<ApiEntity>(request, 'post', '/api/v1/access-requests', {
    organizationName: `Hierarchy Access ${hierarchy.suffix}`,
    requesterEmail: `hierarchy-access.${hierarchy.suffix}@merhouse.local`,
    requestedRole: 'MERCHANT',
    notes: 'Hierarchy tour request',
  })

  const { context: supportContext, page: supportPage } = await newAuthedPageForAccount(
    browser,
    hierarchy.accounts.supportAdmin,
    'desktop',
  )
  await supportPage.goto(`${APP_URL}/admin/users`, { waitUntil: 'networkidle' })
  await expect(supportPage.getByRole('heading', { name: 'Users' })).toBeVisible()
  await expect(supportPage.getByRole('link', { name: 'Organizations' })).toHaveCount(0)
  await expect(supportPage.getByRole('button', { name: 'Owner/admin only' })).toBeDisabled()
  await supportPage.getByLabel('Email search').fill(hierarchy.ordinaryMerchant.email)
  const ordinaryUserRow = supportPage.locator('tr').filter({ hasText: hierarchy.ordinaryMerchant.email }).first()
  await expect(ordinaryUserRow).toBeVisible()
  await expect(ordinaryUserRow.getByRole('button', { name: 'Disable' })).toBeDisabled()
  await supportPage.getByLabel('Temporary reset password').fill('support-reset-password')
  await ordinaryUserRow.getByRole('button', { name: 'Reset' }).click()
  await expect(supportPage.locator('.inline-error')).toHaveCount(0)
  records.push({ role: 'supportAdmin', action: 'reset ordinary user while account mutation stayed disabled' })

  await supportPage.goto(`${APP_URL}/admin/access-requests`, { waitUntil: 'networkidle' })
  await expect(supportPage.getByRole('heading', { name: 'Access Requests' })).toBeVisible()
  await expect(supportPage.getByText(`Hierarchy Access ${hierarchy.suffix}`)).toBeVisible()
  await expect(supportPage.getByRole('button', { name: 'Owner/admin only' }).first()).toBeDisabled()
  records.push({ role: 'supportAdmin', action: 'viewed access queue without approval power' })
  await supportContext.close()

  const { context: auditorContext, page: auditorPage } = await newAuthedPageForAccount(
    browser,
    hierarchy.accounts.auditor,
    'desktop',
  )
  await auditorPage.goto(`${APP_URL}/admin/audit`, { waitUntil: 'networkidle' })
  await expect(auditorPage.getByRole('heading', { name: 'Admin Audit' })).toBeVisible()
  await expect(auditorPage.getByRole('link', { name: 'Organizations' })).toHaveCount(0)
  await expect(auditorPage.getByRole('link', { name: 'Accounts' })).toHaveCount(0)
  await expect(auditorPage.getByRole('link', { name: 'Access requests' })).toHaveCount(0)
  await auditorPage.goto(`${APP_URL}/assistant`, { waitUntil: 'networkidle' })
  await expect(auditorPage.getByRole('heading', { name: 'Assistant' })).toBeVisible()
  await auditorPage.getByLabel('Prompt').fill('What should I review next?')
  await auditorPage.getByRole('button', { name: 'Run assistant' }).click()
  await expect(auditorPage.getByText(/Suggested next step/)).toBeVisible()
  await expect(auditorPage.getByRole('button', { name: 'Accept suggestion' })).toHaveCount(0)
  await expect(auditorPage.getByRole('button', { name: 'Reject suggestion' })).toHaveCount(0)
  await auditorPage.goto(`${APP_URL}/admin/audit`, { waitUntil: 'networkidle' })
  await auditorPage.getByLabel('Audit filter').selectOption('ASSISTANT')
  await expect(auditorPage.getByText('ASSISTANT SUGGESTION', { exact: true }).first()).toBeVisible()
  await auditorPage.goto(`${APP_URL}/admin/users`, { waitUntil: 'networkidle' })
  await expect(auditorPage.getByRole('heading', { name: 'Admin Overview' })).toBeVisible()
  await auditorPage.goto(`${APP_URL}/admin/outbox`, { waitUntil: 'networkidle' })
  await expect(auditorPage.getByRole('button', { name: 'Owner/admin only' })).toBeDisabled()
  records.push({ role: 'auditor', action: 'reviewed assistant audit records without suggestion decision controls' })
  await auditorContext.close()

  const { context: adminContext, page: adminPage } = await newAuthedPageForAccount(
    browser,
    hierarchy.accounts.admin,
    'desktop',
  )
  await adminPage.goto(`${APP_URL}/admin/access-requests`, { waitUntil: 'networkidle' })
  const requestRow = adminPage.locator('tr').filter({ hasText: submitted.id as string }).or(
    adminPage.locator('tr').filter({ hasText: `hierarchy-access.${hierarchy.suffix}@merhouse.local` }),
  ).first()
  await expect(requestRow).toBeVisible()
  await requestRow.getByRole('button', { name: 'Approve' }).click()
  await expect(requestRow).toContainText('APPROVED')
  await adminPage.goto(`${APP_URL}/admin/tenants`, { waitUntil: 'networkidle' })
  await expect(adminPage.locator('h1').filter({ hasText: 'Tenants' })).toBeVisible()
  await expect(adminPage.getByRole('button', { name: 'Create tenant' })).toBeEnabled()
  records.push({ role: 'admin', action: 'approved access request and retained tenant governance controls' })
  await adminContext.close()

  const { context: ownerContext, page: ownerPage } = await newAuthedPageForAccount(browser, hierarchy.accounts.owner, 'desktop')
  await ownerPage.goto(`${APP_URL}/admin/users`, { waitUntil: 'networkidle' })
  await expect(ownerPage.getByRole('heading', { name: 'Users' })).toBeVisible()
  await ownerPage.getByLabel('Email search').fill(hierarchy.accounts.admin.email)
  await expect(ownerPage.getByLabel(`Change role for ${hierarchy.accounts.admin.email}`)).toBeEnabled()
  records.push({ role: 'owner', action: 'saw platform-admin role management controls' })
  await ownerContext.close()

  const resolvedReportPath = resolve(process.cwd(), REPORT_PATH)
  mkdirSync(dirname(resolvedReportPath), { recursive: true })
  writeFileSync(
    resolvedReportPath.replace(/\.json$/, '.hierarchy.json'),
    `${JSON.stringify(
      {
        appUrl: APP_URL,
        apiUrl: API_URL,
        checkedAt: new Date().toISOString(),
        fixture: {
          suffix: hierarchy.suffix,
          tenant: hierarchy.tenant.id,
        },
        records,
      },
      null,
      2,
    )}\n`,
  )
})

test('notification delivery history remains scoped to the recipient account', async ({ browser, request }) => {
  test.setTimeout(120_000)
  const hierarchy = await createPlatformHierarchyFixture(request)

  await publicApiJson<ApiEntity>(request, 'post', '/api/v1/auth/password-reset/request', {
    email: hierarchy.accounts.admin.email,
  })

  const { context: supportContext, page: supportPage } = await newAuthedPageForAccount(
    browser,
    hierarchy.accounts.supportAdmin,
    'desktop',
  )
  await supportPage.goto(`${APP_URL}/notifications`, { waitUntil: 'domcontentloaded' })
  await expect(supportPage.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await expect(supportPage.getByText('Password reset prepared')).toHaveCount(0)
  await expect(supportPage.locator('[aria-label="1 unread alerts"]')).toHaveCount(0)
  await supportContext.close()

  const { context: adminContext, page: adminPage } = await newAuthedPageForAccount(
    browser,
    hierarchy.accounts.admin,
    'desktop',
  )
  await adminPage.goto(`${APP_URL}/notifications`, { waitUntil: 'domcontentloaded' })
  await expect(adminPage.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await expect(adminPage.getByText('Password reset prepared')).toBeVisible()
  await expect(adminPage.locator('[aria-label="1 unread alerts"]')).toBeVisible()
  await adminContext.close()
})

test('notification preferences change visible delivery state across merchant and warehouse roles', async ({ browser, request }) => {
  test.setTimeout(180_000)
  const fixture = await createHarmonicFixture(request)

  await publicApiJson<ApiEntity>(request, 'post', '/api/v1/auth/password-reset/request', {
    email: fixture.merchantAccount.email,
  })

  const { context: merchantContext, page: merchantPage } = await newAuthedPageForAccount(
    browser,
    fixture.merchantAccount,
    'desktop',
  )
  await merchantPage.goto(`${APP_URL}/notifications`, { waitUntil: 'domcontentloaded' })
  await expect(merchantPage.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await expect(merchantPage.getByText('Password reset prepared')).toBeVisible()
  await expect(merchantPage.getByText('Local recorded')).toBeVisible()
  await expect(merchantPage.getByText('Channel recorded')).toBeVisible()
  await expect(merchantPage.locator('[aria-label="1 unread alerts"]')).toBeVisible()

  const { context: warehouseContext, page: warehousePage } = await newAuthedPageForAccount(
    browser,
    fixture.warehouseAccount,
    'desktop',
  )
  await warehousePage.goto(`${APP_URL}/notifications`, { waitUntil: 'domcontentloaded' })
  await expect(warehousePage.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await expect(warehousePage.getByText('Password reset prepared')).toHaveCount(0)
  await expect(warehousePage.locator('[aria-label="1 unread alerts"]')).toHaveCount(0)

  const accountLifecycleInAppRow = merchantPage
    .locator('tr')
    .filter({ hasText: 'Account lifecycle' })
    .filter({ hasText: 'In app' })
  await accountLifecycleInAppRow.getByRole('button', { name: 'Disable' }).click()
  await expect(accountLifecycleInAppRow).toContainText('disabled')

  await publicApiJson<ApiEntity>(request, 'post', '/api/v1/auth/password-reset/request', {
    email: fixture.merchantAccount.email,
  })
  await merchantPage.reload({ waitUntil: 'domcontentloaded' })
  await expect(merchantPage.getByText('2 records')).toBeVisible()
  await expect(merchantPage.getByText('Skipped by preference', { exact: true })).toBeVisible()
  await expect(merchantPage.locator('[aria-label="1 unread alerts"]')).toBeVisible()
  await expect(merchantPage.locator('[aria-label="2 unread alerts"]')).toHaveCount(0)

  await publicApiJson<ApiEntity>(request, 'post', '/api/v1/auth/password-reset/request', {
    email: fixture.warehouseAccount.email,
  })
  await warehousePage.reload({ waitUntil: 'domcontentloaded' })
  await expect(warehousePage.getByText('Password reset prepared')).toBeVisible()
  await expect(warehousePage.getByText('Local recorded')).toBeVisible()
  await expect(warehousePage.getByText('Channel recorded')).toBeVisible()
  await expect(warehousePage.getByText('1 records')).toBeVisible()
  await expect(warehousePage.locator('[aria-label="1 unread alerts"]')).toBeVisible()

  await merchantContext.close()
  await warehouseContext.close()
})

test('full frontend harmonic workflow proves admin merchant and warehouse coherence', async ({ browser, request }) => {
  test.setTimeout(420_000)
  const fixture = await createHarmonicFixture(request)
  const records: Array<Record<string, unknown>> = []

  const { context: merchantContext, page: merchantPage } = await newAuthedPageForAccount(
    browser,
    fixture.merchantAccount,
    'desktop',
  )
  await merchantPage.goto(`${APP_URL}/merchant/inventory`, { waitUntil: 'networkidle' })
  await expect(merchantPage.getByRole('link', { name: fixture.provider.name as string })).toBeVisible()
  const inboundForm = merchantPage.getByRole('form', { name: 'Submit inbound stock form' })
  await chooseSelectOptionByText(
    merchantPage,
    'Submit inbound stock form',
    'Target warehouse',
    fixture.warehouse.name as string,
  )
  await inboundForm.getByLabel('Quantity').fill('5')
  await inboundForm.getByLabel('Reference').fill(`ASN-${fixture.suffix}`)
  await inboundForm.getByLabel('Merchant note').fill('Harmonic tour inbound proof')
  await inboundForm.getByRole('button', { name: 'Submit inbound' }).click()
  const merchantInboundRow = merchantPage.locator('tr').filter({ hasText: `ASN-${fixture.suffix}` }).first()
  await expect(merchantInboundRow).toBeVisible()
  await expect(merchantInboundRow).toContainText('SUBMITTED')
  records.push({ actor: 'merchant', action: 'submitted inbound stock request', reference: `ASN-${fixture.suffix}` })
  await merchantContext.close()

  const { context: warehouseContext, page: warehousePage } = await newAuthedPageForAccount(
    browser,
    fixture.warehouseAccount,
    'desktop',
  )
  await warehousePage.goto(`${APP_URL}/warehouse`, { waitUntil: 'networkidle' })
  const inboundRow = warehousePage.locator('tr').filter({ hasText: fixture.item.sku as string }).first()
  await expect(inboundRow).toBeVisible()
  await expect(inboundRow).toContainText(fixture.item.name as string)
  await inboundRow.getByRole('button', { name: 'Approve' }).click()
  await expect(inboundRow).toContainText('APPROVED')
  await inboundRow.getByRole('button', { name: 'Start receiving' }).click()
  await expect(inboundRow).toContainText('RECEIVING')
  await inboundRow.getByRole('button', { name: 'Receive all' }).click()
  await expect(inboundRow).toContainText('RECEIVED')
  records.push({ actor: 'warehouse', action: 'approved and received inbound stock', quantity: 5 })
  await warehouseContext.close()

  const { context: merchantOrderContext, page: merchantOrderPage } = await newAuthedPageForAccount(
    browser,
    fixture.merchantAccount,
    'desktop',
  )
  await merchantOrderPage.goto(`${APP_URL}/merchant/inventory`, { waitUntil: 'networkidle' })
  await expect(merchantOrderPage.getByText('Authorized stock')).toBeVisible()
  await expect(merchantOrderPage.locator('tr').filter({ hasText: fixture.item.sku as string }).first()).toBeVisible()
  await merchantOrderPage.goto(`${APP_URL}/merchant/orders`, { waitUntil: 'networkidle' })
  const orderForm = merchantOrderPage.getByRole('form', { name: 'Create order form' })
  await orderForm.getByLabel('Quantity').fill('2')
  await orderForm.getByLabel('Customer address').fill(`Harmonic customer ${fixture.suffix}`)
  await orderForm.getByRole('button', { name: 'Create order' }).click()
  await expect(merchantOrderPage.getByText('Order created.')).toBeVisible()
  const newOrder = merchantOrderPage.locator('article').filter({ hasText: fixture.item.sku as string }).first()
  await expect(newOrder).toBeVisible()
  await newOrder.getByRole('button', { name: 'Allocate' }).click()
  await expect(newOrder.getByText('ALLOCATED')).toBeVisible()
  const allocationHref = await newOrder.locator('a[href*="/fulfillment-allocations/"]').getAttribute('href')
  expect(allocationHref, 'allocated order should link to a warehouse allocation').toBeTruthy()
  records.push({ actor: 'merchant', action: 'created and allocated order', allocationHref })
  await merchantOrderContext.close()

  const { context: warehousePickContext, page: warehousePickPage } = await newAuthedPageForAccount(
    browser,
    fixture.warehouseAccount,
    'desktop',
  )
  await warehousePickPage.goto(`${APP_URL}/warehouse`, { waitUntil: 'networkidle' })
  const allocationCard = warehousePickPage.locator('article').filter({ hasText: `Harmonic customer ${fixture.suffix}` }).first()
  await expect(allocationCard).toBeVisible()
  await allocationCard.getByRole('button', { name: 'Pick', exact: true }).click()
  await expect(allocationCard).toContainText('PICKING')
  records.push({ actor: 'warehouse', action: 'moved allocated order to picking' })
  await warehousePickContext.close()

  const { context: merchantProofContext, page: merchantProofPage } = await newAuthedPageForAccount(
    browser,
    fixture.merchantAccount,
    'desktop',
  )
  await merchantProofPage.goto(`${APP_URL}${allocationHref}`, { waitUntil: 'networkidle' })
  await expect(merchantProofPage.getByRole('heading', { name: 'Allocation Detail' })).toBeVisible()
  await expect(merchantProofPage.locator('.status-badge').filter({ hasText: 'PICKING' }).first()).toBeVisible()
  await expect(merchantProofPage.getByText('Allocation picking', { exact: true })).toBeVisible()
  records.push({ actor: 'merchant', action: 'observed warehouse picking status and timeline' })
  await merchantProofContext.close()

  const { context: adminContext, page: adminPage } = await newAuthedPageForAccount(browser, baseAccounts.owner, 'desktop')
  await adminPage.goto(`${APP_URL}/admin`, { waitUntil: 'networkidle' })
  await expect(adminPage.getByRole('heading', { name: 'Admin Overview' })).toBeVisible()
  await expect(adminPage.getByText('Active relationships', { exact: true })).toBeVisible()
  await adminPage.goto(`${APP_URL}/admin/relationships`, { waitUntil: 'networkidle' })
  const relationshipRow = adminPage.locator('tr').filter({ hasText: fixture.merchant.name as string }).filter({
    hasText: fixture.provider.name as string,
  })
  await expect(relationshipRow).toBeVisible()
  records.push({ actor: 'admin', action: 'observed governed relationship after merchant warehouse work' })
  await adminContext.close()

  const resolvedReportPath = resolve(process.cwd(), REPORT_PATH)
  mkdirSync(dirname(resolvedReportPath), { recursive: true })
  writeFileSync(
    resolvedReportPath.replace(/\.json$/, '.harmonic.json'),
    `${JSON.stringify(
      {
        appUrl: APP_URL,
        apiUrl: API_URL,
        checkedAt: new Date().toISOString(),
        fixture: {
          suffix: fixture.suffix,
          merchant: fixture.merchant.name,
          provider: fixture.provider.name,
          warehouse: fixture.warehouse.name,
          item: fixture.item.sku,
        },
        records,
      },
      null,
      2,
    )}\n`,
  )
})
