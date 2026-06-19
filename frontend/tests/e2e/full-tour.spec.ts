import { expect, test } from '@playwright/test'
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { firebaseLogin, createFirebaseUser } from './firebase-auth-helper'

const APP_URL = process.env.FRONTEND_TOUR_BASE_URL ?? 'http://127.0.0.1:3001'
const API_URL = process.env.E2E_API_URL ?? (process.env.FRONTEND_TOUR_BASE_URL ? APP_URL : 'http://127.0.0.1:8081')
const REPORT_PATH = process.env.FRONTEND_TOUR_REPORT ?? '../reports/latest-frontend-full-tour.json'
const TOKEN_KEY = 'warehouse-console-token'
const DETAIL_DISCOVERY_HEADING_TIMEOUT_MS = 45_000
const ROUTE_HEADING_TIMEOUT_MS = 45_000
const WORKFLOW_ACTION_TIMEOUT_MS = 30_000
const FULL_TOUR_TIMEOUT_MS = Number(process.env.FRONTEND_TOUR_TIMEOUT_MS ?? '420000')
const TOUR_PROGRESS_EVERY = Number(process.env.FRONTEND_TOUR_PROGRESS_EVERY ?? '10')
const ROUTE_TOUR_CONCURRENCY = Number(process.env.FRONTEND_TOUR_CONCURRENCY ?? '6')
const TOUR_COVERAGE = (process.env.FRONTEND_TOUR_COVERAGE ?? 'full').toLowerCase()
const IS_DEPLOYMENT_COVERAGE = TOUR_COVERAGE === 'deployment'

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
  stakeholderState?: 'active' | 'empty'
  account?: Account
}

type TourRecord = TourCase & {
  status: number
  routeReadyMs: number
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

function progress(message: string) {
  console.log(`[frontend-tour] ${new Date().toISOString()} ${message}`)
}

function writeRouteReport(
  records: TourRecord[],
  detailPathsByRole: Partial<Record<AuthenticatedRole, string[]>>,
  partial: boolean,
) {
  const resolvedReportPath = resolve(process.cwd(), REPORT_PATH)
  mkdirSync(dirname(resolvedReportPath), { recursive: true })
  writeFileSync(
    partial ? resolvedReportPath.replace(/\.json$/, '.partial.json') : resolvedReportPath,
    `${JSON.stringify(
      {
        appUrl: APP_URL,
        apiUrl: API_URL,
        checkedAt: new Date().toISOString(),
        partial,
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
}

function writeActionReport(
  reportSuffix: string,
  acceptanceStandard: string,
  records: Array<Record<string, unknown>>,
  fixture?: Record<string, unknown>,
) {
  const resolvedReportPath = resolve(process.cwd(), REPORT_PATH)
  mkdirSync(dirname(resolvedReportPath), { recursive: true })
  writeFileSync(
    resolvedReportPath.replace(/\.json$/, `.${reportSuffix}.json`),
    `${JSON.stringify(
      {
        appUrl: APP_URL,
        apiUrl: API_URL,
        checkedAt: new Date().toISOString(),
        checkedActions: records.length,
        acceptanceStandard,
        fixture,
        records,
      },
      null,
      2,
    )}\n`,
  )
}

const baseAccounts: Record<'owner' | 'supportAdmin' | 'auditor' | 'merchant' | 'warehouse', Account> = {
  owner: {
    email: process.env.FRONTEND_TOUR_ADMIN_EMAIL ?? 'admin@merhouse.local',
    password: process.env.FRONTEND_TOUR_ADMIN_PASSWORD ?? 'local-owner-password',
  },
  supportAdmin: {
    email: process.env.FRONTEND_TOUR_SUPPORT_ADMIN_EMAIL ?? '',
    password: process.env.FRONTEND_TOUR_SUPPORT_ADMIN_PASSWORD ?? '',
  },
  auditor: {
    email: process.env.FRONTEND_TOUR_AUDITOR_EMAIL ?? '',
    password: process.env.FRONTEND_TOUR_AUDITOR_PASSWORD ?? '',
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

const publicPaths = ['/login', '/forgot-password', '/reset-password', '/request-access', '/how-to-use']
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
    '/account',
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
    '/account',
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
    '/account',
  ],
  auditor: [
    '/admin',
    '/admin/outbox',
    '/admin/relationships',
    '/admin/audit',
    '/service-accountability',
    '/assistant',
    '/notifications',
    '/account',
  ],
  merchant: ['/merchant', '/merchant/inventory', '/merchant/orders', '/service-accountability', '/assistant', '/notifications', '/account'],
  warehouse: ['/warehouse', '/service-accountability', '/assistant', '/notifications', '/account'],
}

const deploymentRolePaths: Record<AuthenticatedRole, string[]> = {
  owner: ['/admin', '/admin/users', '/admin/access-requests', '/admin/outbox', '/admin/audit', '/assistant', '/notifications', '/account'],
  admin: [],
  supportAdmin: ['/admin/users', '/admin/access-requests', '/admin/outbox', '/assistant', '/account'],
  auditor: ['/admin/audit', '/admin/outbox', '/assistant', '/account'],
  merchant: ['/merchant', '/merchant/inventory', '/merchant/orders', '/service-accountability', '/assistant', '/notifications', '/account'],
  warehouse: ['/warehouse', '/service-accountability', '/assistant', '/notifications', '/account'],
}

const deploymentEmptyStakeholderPaths = {
  merchant: ['/merchant', '/merchant/inventory', '/assistant', '/account'],
  warehouse: ['/warehouse', '/assistant', '/account'],
} as const

const deploymentRouteRoles = ['owner', 'supportAdmin', 'auditor', 'merchant', 'warehouse'] as const
const fullRouteRoles = ['owner', 'admin', 'supportAdmin', 'auditor', 'merchant', 'warehouse'] as const

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

function addUniquePath(paths: Map<string, string>, path: string) {
  const kind = detailPathKind(path)
  if (kind && detailPathPattern.test(path) && !paths.has(kind)) {
    paths.set(kind, path)
  }
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

async function expectOkMutation(responsePromise: Promise<{ ok(): boolean; status(): number; text(): Promise<string> }>, label: string) {
  const response = await responsePromise
  const body = response.ok() ? '' : await response.text()
  expect(response.ok(), `${label} should succeed. Status ${response.status()} ${body}`).toBeTruthy()
  return response
}

async function createHarmonicFixture(request: APIRequestContext) {
  const adminToken = await firebaseLogin(request, baseAccounts.owner.email, baseAccounts.owner.password)
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

  await createFirebaseUser(request, merchantAccount.email, merchantAccount.password)
  await createFirebaseUser(request, warehouseAccount.email, warehouseAccount.password)

  return { suffix, merchant, provider, warehouse, item, relationship, merchantAccount, warehouseAccount }
}

async function createPlatformHierarchyFixture(request: APIRequestContext) {
  const ownerToken = await firebaseLogin(request, baseAccounts.owner.email, baseAccounts.owner.password)
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

  await createFirebaseUser(request, ordinaryMerchant.email, ordinaryMerchant.password)

  return {
    suffix,
    tenant,
    ordinaryMerchant,
    accounts: {
      owner: baseAccounts.owner,
      admin: await makeAccount('ADMIN'),
      supportAdmin: baseAccounts.supportAdmin.email && baseAccounts.supportAdmin.password
        ? baseAccounts.supportAdmin
        : await makeAccount('SUPPORT_ADMIN'),
      auditor: baseAccounts.auditor.email && baseAccounts.auditor.password
        ? baseAccounts.auditor
        : await makeAccount('AUDITOR'),
      merchant: baseAccounts.merchant,
      warehouse: baseAccounts.warehouse,
    } satisfies Record<AuthenticatedRole, Account>,
  }
}

async function getPlatformRelationshipDetailPath(request: APIRequestContext) {
  const ownerToken = await firebaseLogin(request, baseAccounts.owner.email, baseAccounts.owner.password)
  const relationships = await apiJson<ApiEntity[]>(request, 'get', '/api/v1/merchant-warehouse/relationships', ownerToken)
  const relationship = relationships.find((candidate) => candidate.id)
  return relationship ? `/merchant-warehouse/relationships/${relationship.id}` : undefined
}

async function createEmptyStakeholderFixture(request: APIRequestContext) {
  const ownerToken = await firebaseLogin(request, baseAccounts.owner.email, baseAccounts.owner.password)
  const suffix = `empty-${Date.now().toString(36)}`
  const password = 'tour-password'

  const emptyMerchantTenant = await apiJson<ApiEntity>(request, 'post', '/api/v1/tenants', ownerToken, {
    name: `Empty Tour Merchant ${suffix}`,
    type: 'MERCHANT',
  })
  const emptyWarehouseTenant = await apiJson<ApiEntity>(request, 'post', '/api/v1/tenants', ownerToken, {
    name: `Empty Tour Warehouse ${suffix}`,
    type: 'WAREHOUSE_PROVIDER',
  })

  const emptyMerchant = {
    email: `tour.empty.merchant.${suffix}@merhouse.local`,
    password,
  }
  const emptyWarehouse = {
    email: `tour.empty.operator.${suffix}@merhouse.local`,
    password,
  }

  await apiJson<ApiEntity>(request, 'post', '/api/v1/admin/users', ownerToken, {
    tenantId: emptyMerchantTenant.id,
    email: emptyMerchant.email,
    password,
    role: 'MERCHANT',
  })
  await apiJson<ApiEntity>(request, 'post', '/api/v1/admin/users', ownerToken, {
    tenantId: emptyWarehouseTenant.id,
    email: emptyWarehouse.email,
    password,
    role: 'WAREHOUSE_OPERATOR',
  })

  await createFirebaseUser(request, emptyMerchant.email, emptyMerchant.password)
  await createFirebaseUser(request, emptyWarehouse.email, emptyWarehouse.password)

  return { emptyMerchant, emptyWarehouse }
}

async function newAuthedPageForAccount(browser: Browser, account: Account, viewport: keyof typeof viewports) {
  const context = await browser.newContext({ viewport: viewports[viewport] })
  const token = await firebaseLogin(context.request, account.email, account.password)
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

async function newAuthedContextForAccount(browser: Browser, account: Account, viewport: keyof typeof viewports) {
  const context = await browser.newContext({ viewport: viewports[viewport] })
  const token = await firebaseLogin(context.request, account.email, account.password)
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
  return context
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  const queue = [...items]
  const workerCount = Math.max(1, Math.min(limit, queue.length))
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const item = queue.shift()
        if (item) {
          await worker(item)
        }
      }
    }),
  )
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
  seedPaths: string[] = [],
) {
  const { context, page } = await newAuthedPageForAccount(browser, account, 'desktop')
  const pathsByKind = new Map<string, string>()
  for (const seedPath of seedPaths) {
    addUniquePath(pathsByKind, seedPath)
  }

  for (const path of [...rolePaths[role], ...seedPaths]) {
    progress(`discover ${role} ${path}`)
    await page.goto(`${APP_URL}${path}`, { waitUntil: 'domcontentloaded' })
    await waitForAppSettled(page, `${role} ${path} detail discovery`, DETAIL_DISCOVERY_HEADING_TIMEOUT_MS)
    const hrefs = await page.locator('a[href]').evaluateAll((anchors) =>
      anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
    )
    for (const href of hrefs) {
      const url = new URL(href)
      addUniquePath(pathsByKind, url.pathname)
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

async function waitForAppSettled(page: Page, label: string, timeout = ROUTE_HEADING_TIMEOUT_MS) {
  await expect(page.locator('h1').first(), `${label} h1 should render`).toBeVisible({ timeout })
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText ?? ''
      const loadingRe = new RegExp('(?:^|\\n)\\s*Loading(?:\\s+[A-Za-z ]+)?\\s*(?:\\n|$)')
      const restoringRe = new RegExp('(?:^|\\n)\\s*Restoring session\\s*(?:\\n|$)')
      return !loadingRe.test(text) && !restoringRe.test(text)
    },
    undefined,
    { timeout },
  )
}

async function inspectPage(
  page: Page,
  role: Role,
  path: string,
  viewport: 'desktop' | 'narrow',
  stakeholderState?: 'active' | 'empty',
) {
  progress(`inspect ${role} ${viewport} ${path}${stakeholderState ? ` ${stakeholderState}` : ''}`)
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

  const routeStart = Date.now()
  const response = await page.goto(`${APP_URL}${path}`, { waitUntil: 'domcontentloaded' })
  expect(response, `${role} ${path} should return a response`).toBeTruthy()
  await waitForAppSettled(page, `${role} ${path}`)
  const routeReadyMs = Date.now() - routeStart

  const record = await page.evaluate(
    ({ roleName, routePath, viewportName, state, readyMs, errors }) => {
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
        stakeholderState: state,
        status: 0,
        routeReadyMs: readyMs,
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
    { roleName: role, routePath: path, viewportName: viewport, state: stakeholderState, readyMs: routeReadyMs, errors: consoleErrors },
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

test('public auth UI input tour accepts typed happy and unhappy paths', async ({ browser }) => {
  test.setTimeout(120_000)
  progress(`ui input tour starting app=${APP_URL}`)
  const records: Array<Record<string, unknown>> = []
  const context = await browser.newContext({ viewport: viewports.desktop })
  const page = await context.newPage()
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message)
  })

  await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded' })
  await waitForAppSettled(page, 'public login input')
  await page.getByLabel('Email').fill(`wrong-${Date.now()}@merhouse.local`)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText('Invalid email or password')
  await expect(page).toHaveURL(`${APP_URL}/login`)
  records.push({ route: '/login', action: 'typed invalid credentials and saw generic denial without navigation' })

  await page.getByLabel('Email').fill(baseAccounts.owner.email)
  await page.getByLabel('Password').fill(baseAccounts.owner.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Admin Overview' })).toBeVisible({ timeout: ROUTE_HEADING_TIMEOUT_MS })
  await expect(page).toHaveURL(`${APP_URL}/admin`)
  records.push({ route: '/login', action: 'typed owner credentials and reached admin workspace' })

  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page.getByRole('heading', { name: 'Operations Console' })).toBeVisible({ timeout: ROUTE_HEADING_TIMEOUT_MS })

  // Ensure the owner exists in the Firebase Auth emulator so password reset works.
  await createFirebaseUser(context.request, baseAccounts.owner.email, baseAccounts.owner.password)

  await page.goto(`${APP_URL}/forgot-password`, { waitUntil: 'domcontentloaded' })
  await waitForAppSettled(page, 'forgot password input')
  await page.getByLabel('Email').fill(baseAccounts.owner.email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText(/if an enabled account exists/i)
  records.push({ route: '/forgot-password', action: 'typed owner email and saw generic reset-link-sent message' })

  await page.goto(`${APP_URL}/reset-password`, { waitUntil: 'domcontentloaded' })
  await waitForAppSettled(page, 'reset password input')
  await expect(page.getByRole('alert')).toBeVisible({ timeout: ROUTE_HEADING_TIMEOUT_MS })
  records.push({ route: '/reset-password', action: 'visited without oobCode and saw invalid-link alert' })

  const accessEmail = `ui-input.${Date.now()}@merhouse.local`
  await page.goto(`${APP_URL}/request-access`, { waitUntil: 'domcontentloaded' })
  await waitForAppSettled(page, 'request access input')
  await page.getByLabel('Organization').fill(`UI Input Merchant ${Date.now()}`)
  await page.getByLabel('Email').fill(accessEmail)
  await page.getByLabel('Role').selectOption('MERCHANT')
  await page.getByLabel('Notes').fill('Deployment UI input proof; no secrets.')
  await page.getByRole('button', { name: 'Submit request' }).click()
  await expect(page.getByRole('status')).toContainText(`Access request pending for ${accessEmail}`)
  records.push({ route: '/request-access', action: 'typed access request and saw pending status' })

  await context.close()
  const unexpectedConsoleErrors = consoleErrors.filter((message) => (
    !/Failed to load resource: the server responded with a status of (400|401|404|409)/.test(message)
  ))
  expect(unexpectedConsoleErrors, 'public auth UI input console errors').toEqual([])

  writeActionReport(
    'ui-input',
    'Public auth UI input proof records typed happy and unhappy paths through login, recovery, reset, and access-request forms.',
    records,
  )
  progress(`ui input tour completed ${records.length} action records`)
})

test('full frontend route tour passes with seeded accounts', async ({ browser, request }) => {
  test.setTimeout(FULL_TOUR_TIMEOUT_MS)
  progress(`route tour starting app=${APP_URL} api=${API_URL} coverage=${TOUR_COVERAGE} timeoutMs=${FULL_TOUR_TIMEOUT_MS}`)
  const hierarchy = IS_DEPLOYMENT_COVERAGE ? undefined : await createPlatformHierarchyFixture(request)
  if (hierarchy) {
    progress('platform hierarchy fixture ready')
  }
  const activeStakeholders = IS_DEPLOYMENT_COVERAGE ? undefined : await createHarmonicFixture(request)
  if (activeStakeholders) {
    progress('active stakeholder fixture ready')
  }
  const emptyStakeholders = await createEmptyStakeholderFixture(request)
  progress('empty stakeholder fixture ready')
  const records: TourRecord[] = []
  const detailCases: TourCase[] = []
  const detailPathsByRole: Partial<Record<AuthenticatedRole, string[]>> = {}
  const accounts = {
    owner: baseAccounts.owner,
    admin: hierarchy?.accounts.admin ?? baseAccounts.owner,
    supportAdmin: hierarchy?.accounts.supportAdmin ?? baseAccounts.supportAdmin,
    auditor: hierarchy?.accounts.auditor ?? baseAccounts.auditor,
    merchant: activeStakeholders?.merchantAccount ?? baseAccounts.merchant,
    warehouse: activeStakeholders?.warehouseAccount ?? baseAccounts.warehouse,
  } satisfies Record<AuthenticatedRole, Account>

  const routeRoles = IS_DEPLOYMENT_COVERAGE ? deploymentRouteRoles : fullRouteRoles
  if (IS_DEPLOYMENT_COVERAGE) {
    for (const role of routeRoles) {
      detailPathsByRole[role] = []
    }
  } else {
    const platformRelationshipDetailPath = await getPlatformRelationshipDetailPath(request)
    for (const role of routeRoles) {
      const platformDetailSeeds = platformRelationshipDetailPath && ['owner', 'admin', 'supportAdmin', 'auditor'].includes(role)
        ? [platformRelationshipDetailPath]
        : []
      const detailPaths = await collectDetailPaths(browser, role, accounts[role], platformDetailSeeds)
      detailPathsByRole[role] = detailPaths
      progress(`discovered ${detailPaths.length} detail path(s) for ${role}`)
      for (const path of detailPaths) {
        detailCases.push({ role, path, viewport: 'desktop' }, { role, path, viewport: 'narrow' })
      }
    }
  }

  const routedPaths = IS_DEPLOYMENT_COVERAGE ? deploymentRolePaths : rolePaths
  const merchantEmptyPaths = IS_DEPLOYMENT_COVERAGE ? deploymentEmptyStakeholderPaths.merchant : rolePaths.merchant
  const warehouseEmptyPaths = IS_DEPLOYMENT_COVERAGE ? deploymentEmptyStakeholderPaths.warehouse : rolePaths.warehouse

  const baseCases: TourCase[] = [
    ...publicPaths.flatMap((path) => [
      { role: 'public' as const, path, viewport: 'desktop' as const },
      { role: 'public' as const, path, viewport: 'narrow' as const },
    ]),
    ...routeRoles.flatMap((role) =>
      routedPaths[role].flatMap((path) => [
        {
          role,
          path,
          viewport: 'desktop' as const,
          stakeholderState: role === 'merchant' || role === 'warehouse' ? 'active' as const : undefined,
        },
        {
          role,
          path,
          viewport: 'narrow' as const,
          stakeholderState: role === 'merchant' || role === 'warehouse' ? 'active' as const : undefined,
        },
      ]),
    ),
    ...merchantEmptyPaths.flatMap((path) => [
      { role: 'merchant' as const, path, viewport: 'desktop' as const, stakeholderState: 'empty' as const, account: emptyStakeholders.emptyMerchant },
      { role: 'merchant' as const, path, viewport: 'narrow' as const, stakeholderState: 'empty' as const, account: emptyStakeholders.emptyMerchant },
    ]),
    ...warehouseEmptyPaths.flatMap((path) => [
      { role: 'warehouse' as const, path, viewport: 'desktop' as const, stakeholderState: 'empty' as const, account: emptyStakeholders.emptyWarehouse },
      { role: 'warehouse' as const, path, viewport: 'narrow' as const, stakeholderState: 'empty' as const, account: emptyStakeholders.emptyWarehouse },
    ]),
  ]

  const cases = [...baseCases, ...detailCases]
  const routeConcurrency = Math.max(1, ROUTE_TOUR_CONCURRENCY)
  progress(`route tour inspecting ${cases.length} case(s) with concurrency=${routeConcurrency}`)

  const recordRoute = (record: TourRecord) => {
    records.push(record)
    if (records.length % Math.max(1, TOUR_PROGRESS_EVERY) === 0) {
      progress(`inspected ${records.length}/${cases.length} route cases`)
      writeRouteReport(records, detailPathsByRole, true)
    }
  }

  const inspectCasesInContext = async (
    context: BrowserContext,
    routeCases: TourCase[],
  ) => {
    await runWithConcurrency(routeCases, routeConcurrency, async (tourCase) => {
      const page = await context.newPage()
      try {
        recordRoute(await inspectPage(page, tourCase.role, tourCase.path, tourCase.viewport, tourCase.stakeholderState))
      } finally {
        await page.close()
      }
    })
  }

  for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
    progress(`viewport ${viewport} starting`)
    const publicContext = await browser.newContext({ viewport: viewports[viewport] })
    await inspectCasesInContext(
      publicContext,
      cases.filter((candidate) => candidate.role === 'public' && candidate.viewport === viewport),
    )
    await publicContext.close()

    for (const role of routeRoles) {
      const roleCases = cases.filter((candidate) => candidate.role === role && candidate.viewport === viewport && !candidate.account)
      if (roleCases.length === 0) {
        continue
      }
      const context = await newAuthedContextForAccount(browser, accounts[role], viewport)
      await inspectCasesInContext(context, roleCases)
      await context.close()
    }

    const customAccountCases = new Map<string, { account: Account; cases: TourCase[] }>()
    for (const tourCase of cases.filter((candidate) => candidate.viewport === viewport && candidate.account)) {
      const account = tourCase.account as Account
      const accountKey = `${account.email}\u0000${account.password}`
      const group = customAccountCases.get(accountKey)
      if (group) {
        group.cases.push(tourCase)
      } else {
        customAccountCases.set(accountKey, { account, cases: [tourCase] })
      }
    }

    for (const group of customAccountCases.values()) {
      const context = await newAuthedContextForAccount(browser, group.account, viewport)
      await inspectCasesInContext(context, group.cases)
      await context.close()
    }
  }

  writeRouteReport(records, detailPathsByRole, false)
  progress(`route tour completed ${records.length} route records`)
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
  await expect(supportPage.getByText('Owner/admin account creation')).toBeVisible()
  await supportPage.getByLabel('Email search').fill(hierarchy.ordinaryMerchant.email)
  const ordinaryUserRow = supportPage.locator('tr').filter({ hasText: hierarchy.ordinaryMerchant.email }).first()
  await expect(ordinaryUserRow).toBeVisible()
  await expect(ordinaryUserRow.getByText('Owner/admin action')).toBeVisible()
  await expect(ordinaryUserRow.getByRole('button', { name: 'Disable' })).toHaveCount(0)
  await supportPage.getByLabel('Temporary reset password').fill('support-reset-password')
  await ordinaryUserRow.getByRole('button', { name: 'Reset' }).click()
  await expect(supportPage.locator('.inline-error')).toHaveCount(0)
  records.push({ role: 'supportAdmin', action: 'reset ordinary user while account mutation ownership stayed explicit' })

  await supportPage.goto(`${APP_URL}/admin/access-requests`, { waitUntil: 'networkidle' })
  await expect(supportPage.getByRole('heading', { name: 'Access Requests' })).toBeVisible()
  await expect(supportPage.getByText(`Hierarchy Access ${hierarchy.suffix}`)).toBeVisible()
  await expect(supportPage.getByText('Review and escalate').first()).toBeVisible()
  await expect(supportPage.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  await expect(supportPage.getByRole('button', { name: 'Reject' })).toHaveCount(0)
  await expect(supportPage.getByRole('button', { name: 'Convert' })).toHaveCount(0)
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
  await expect(auditorPage.getByRole('heading', { name: 'Operational Review Assistant' })).toBeVisible()
  const auditorPrompt = `What should I review next for hierarchy ${hierarchy.suffix}?`
  await auditorPage.getByLabel('Prompt').fill(auditorPrompt)
  await auditorPage.getByRole('button', { name: 'Run assistant' }).click()
  const latestAssistantRecord = auditorPage.locator('article').filter({ hasText: auditorPrompt }).first()
  await expect(latestAssistantRecord).toContainText(/Suggested next step/)
  await expect(auditorPage.getByRole('button', { name: 'Accept suggestion' })).toHaveCount(0)
  await expect(auditorPage.getByRole('button', { name: 'Reject suggestion' })).toHaveCount(0)
  await auditorPage.goto(`${APP_URL}/admin/audit`, { waitUntil: 'networkidle' })
  await auditorPage.getByLabel('Audit filter').selectOption('ASSISTANT')
  await expect(auditorPage.getByText('ASSISTANT SUGGESTION', { exact: true }).first()).toBeVisible()
  await auditorPage.goto(`${APP_URL}/admin/users`, { waitUntil: 'networkidle' })
  await expect(auditorPage.getByRole('heading', { name: 'Admin Overview' })).toBeVisible()
  await auditorPage.goto(`${APP_URL}/admin/outbox`, { waitUntil: 'networkidle' })
  await expect(auditorPage.getByText('Read-only diagnostics').first()).toBeVisible()
  await expect(auditorPage.getByRole('button', { name: 'Retry' })).toHaveCount(0)
  await expect(auditorPage.getByRole('button', { name: 'Dead-letter' })).toHaveCount(0)
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
  const approveButton = requestRow.getByRole('button', { name: 'Approve & activate' })
  await expect(approveButton).toBeVisible()
  await approveButton.click()
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

  writeActionReport(
    'hierarchy',
    'Platform hierarchy action proof records allowed actions and denied controls for owner, admin, support-admin, and auditor users.',
    records,
    {
      suffix: hierarchy.suffix,
      tenant: hierarchy.tenant.id,
    },
  )
})

test('notification delivery history remains scoped to the recipient account', async ({ browser, request }) => {
  test.setTimeout(120_000)
  const hierarchy = await createPlatformHierarchyFixture(request)
  const records: Array<Record<string, unknown>> = []

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
  records.push({ role: 'supportAdmin', action: 'did not see another user password reset notification' })
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
  records.push({ role: 'admin', action: 'saw own password reset notification and unread alert count' })
  await adminContext.close()

  writeActionReport(
    'notification-scope',
    'Notification scope proof records that local delivery history and unread counts stay recipient-scoped.',
    records,
    {
      suffix: hierarchy.suffix,
      recipient: hierarchy.accounts.admin.email,
      nonRecipient: hierarchy.accounts.supportAdmin.email,
    },
  )
})

test('notification preferences change visible delivery state across merchant and warehouse roles', async ({ browser, request }) => {
  test.setTimeout(180_000)
  const fixture = await createHarmonicFixture(request)
  const records: Array<Record<string, unknown>> = []

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
  records.push({ actor: 'merchant', action: 'saw local password reset delivery and unread alert before preference change' })

  const { context: warehouseContext, page: warehousePage } = await newAuthedPageForAccount(
    browser,
    fixture.warehouseAccount,
    'desktop',
  )
  await warehousePage.goto(`${APP_URL}/notifications`, { waitUntil: 'domcontentloaded' })
  await expect(warehousePage.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await expect(warehousePage.getByText('Password reset prepared')).toHaveCount(0)
  await expect(warehousePage.locator('[aria-label="1 unread alerts"]')).toHaveCount(0)
  records.push({ actor: 'warehouse', action: 'did not see merchant password reset delivery or unread alert' })

  const accountLifecycleInAppRow = merchantPage
    .locator('tr')
    .filter({ hasText: 'Account lifecycle' })
    .filter({ hasText: 'In app' })
  const preferenceResponse = merchantPage.waitForResponse((response) => (
    response.url().includes('/api/v1/notifications/preferences')
      && response.request().method() === 'PATCH'
  ))
  await accountLifecycleInAppRow.getByRole('button', { name: 'Disable' }).click()
  await expectOkMutation(preferenceResponse, 'Notification preference update')
  await merchantPage.reload({ waitUntil: 'domcontentloaded' })
  await expect(accountLifecycleInAppRow).toContainText(/disabled/i)

  await publicApiJson<ApiEntity>(request, 'post', '/api/v1/auth/password-reset/request', {
    email: fixture.merchantAccount.email,
  })
  await merchantPage.reload({ waitUntil: 'domcontentloaded' })
  await expect(merchantPage.getByText('1 active')).toBeVisible()
  await expect(merchantPage.getByText('1 records')).toBeVisible()
  await expect(merchantPage.getByText('Skipped by preference', { exact: true })).toBeVisible()
  await expect(merchantPage.locator('[aria-label="1 unread alerts"]')).toBeVisible()
  await expect(merchantPage.locator('[aria-label="2 unread alerts"]')).toHaveCount(0)
  records.push({ actor: 'merchant', action: 'disabled in-app preference and saw skipped delivery without extra unread alert' })

  await publicApiJson<ApiEntity>(request, 'post', '/api/v1/auth/password-reset/request', {
    email: fixture.warehouseAccount.email,
  })
  await warehousePage.reload({ waitUntil: 'domcontentloaded' })
  await expect(warehousePage.getByText('Password reset prepared')).toBeVisible()
  await expect(warehousePage.getByText('Local recorded')).toBeVisible()
  await expect(warehousePage.getByText('Channel recorded')).toBeVisible()
  await expect(warehousePage.getByText('1 active')).toBeVisible()
  await expect(warehousePage.locator('[aria-label="1 unread alerts"]')).toBeVisible()
  records.push({ actor: 'warehouse', action: 'kept default preference and saw own local delivery plus unread alert' })

  await merchantContext.close()
  await warehouseContext.close()

  writeActionReport(
    'notification-preferences',
    'Notification preference proof records local delivery visibility, skipped delivery state, and unread alert behavior across merchant and warehouse users.',
    records,
    {
      suffix: fixture.suffix,
      merchant: fixture.merchant.name,
      warehouseProvider: fixture.provider.name,
    },
  )
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
  const inboundCreateResponse = merchantPage.waitForResponse((response) => (
    response.url().includes('/api/v1/merchant-warehouse/inbound-stock-requests')
      && response.request().method() === 'POST'
  ))
  await inboundForm.getByRole('button', { name: 'Submit inbound' }).click()
  await expectOkMutation(inboundCreateResponse, 'Inbound stock submission')
  await merchantPage.reload({ waitUntil: 'networkidle' })
  const merchantInboundRow = merchantPage.locator('tr').filter({ hasText: `ASN-${fixture.suffix}` }).first()
  await expect(merchantInboundRow).toBeVisible({ timeout: WORKFLOW_ACTION_TIMEOUT_MS })
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
  await expect(inboundRow.getByRole('button', { name: 'Post receipt' })).toBeEnabled()
  await inboundRow.getByRole('button', { name: 'Post receipt' }).click()
  await expect(inboundRow).toContainText('RECEIVED')
  records.push({ actor: 'warehouse', action: 'approved and received inbound stock', quantity: 5 })
  await warehousePage.goto(`${APP_URL}/notifications`, { waitUntil: 'networkidle' })
  await expect(warehousePage.getByText('Inbound stock needs review')).toBeVisible()
  await expect(warehousePage.getByText(new RegExp(`${fixture.merchant.name as string} submitted 5 units`))).toBeVisible()
  await expect(warehousePage.locator('.data-chip').filter({ hasText: 'InboundStockRequest' }).first()).toBeVisible()
  records.push({ actor: 'warehouse', action: 'saw connected inbound review alert' })
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
  await expect(merchantOrderPage.getByText('Order created.')).toBeVisible({ timeout: WORKFLOW_ACTION_TIMEOUT_MS })
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
  await merchantProofPage.goto(`${APP_URL}/notifications`, { waitUntil: 'networkidle' })
  await expect(merchantProofPage.getByText('Inbound stock received')).toBeVisible()
  await expect(merchantProofPage.getByText(new RegExp(`${fixture.provider.name as string} received 5 units`))).toBeVisible()
  await expect(merchantProofPage.locator('.data-chip').filter({ hasText: 'InboundStockRequest' }).first()).toBeVisible()
  records.push({ actor: 'merchant', action: 'saw connected inbound received alert' })
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

  writeActionReport(
    'harmonic',
    'Harmonic workflow action proof records merchant, warehouse, and admin handoffs across inbound stock, allocation, notifications, and relationship governance.',
    records,
    {
      suffix: fixture.suffix,
      merchant: fixture.merchant.name,
      provider: fixture.provider.name,
      warehouse: fixture.warehouse.name,
      item: fixture.item.sku,
    },
  )
})
