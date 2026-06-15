import { expect, test } from '@playwright/test'
import type { APIRequestContext, Browser, Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const APP_URL = process.env.FRONTEND_TOUR_BASE_URL ?? 'http://localhost:3001'
const API_URL = process.env.E2E_API_URL ?? APP_URL
const REPORT_PATH = process.env.V15_EMPTY_STATE_REPORT ?? '../reports/v15-1-ui-signature/empty-state-live-check.json'
const TOKEN_KEY = 'warehouse-console-token'

type Account = {
  email: string
  password: string
}

type ApiEntity = {
  id: string
  [key: string]: unknown
}

type EmptyStateRecord = {
  role: 'merchant' | 'warehouse'
  route: string
  heading: string
  expectedGuidance: string
  screenshot: string
  status: 'PASS'
}

const ownerAccount: Account = {
  email: process.env.FRONTEND_TOUR_ADMIN_EMAIL ?? 'admin@merhouse.local',
  password: process.env.FRONTEND_TOUR_ADMIN_PASSWORD ?? 'local-owner-password',
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

async function createEmptyFixture(request: APIRequestContext) {
  const ownerToken = await loginToken(request, ownerAccount)
  const suffix = `empty-${Date.now().toString(36)}`
  const password = 'empty-tour-password'

  const merchant = await apiJson<ApiEntity>(request, 'post', '/api/v1/tenants', ownerToken, {
    name: `Empty Merchant ${suffix}`,
    type: 'MERCHANT',
  })
  const provider = await apiJson<ApiEntity>(request, 'post', '/api/v1/tenants', ownerToken, {
    name: `Empty Warehouse Provider ${suffix}`,
    type: 'WAREHOUSE_PROVIDER',
  })
  await apiJson<ApiEntity>(request, 'post', '/api/v1/warehouses', ownerToken, {
    tenantId: provider.id,
    name: `Empty Fulfillment Hub ${suffix}`,
    address: `Empty District ${suffix}`,
    latitude: null,
    longitude: null,
    capacity: 100,
  })

  const merchantAccount = {
    email: `empty.merchant.${suffix}@merhouse.local`,
    password,
  }
  const warehouseAccount = {
    email: `empty.operator.${suffix}@merhouse.local`,
    password,
  }

  await apiJson<ApiEntity>(request, 'post', '/api/v1/admin/users', ownerToken, {
    tenantId: merchant.id,
    email: merchantAccount.email,
    password,
    role: 'MERCHANT',
  })
  await apiJson<ApiEntity>(request, 'post', '/api/v1/admin/users', ownerToken, {
    tenantId: provider.id,
    email: warehouseAccount.email,
    password,
    role: 'WAREHOUSE_OPERATOR',
  })

  return { suffix, merchantAccount, warehouseAccount }
}

async function newAuthedPage(browser: Browser, account: Account) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const token = await loginToken(context.request, account)
  await context.addInitScript(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // The script also runs once the app origin exists.
      }
    },
    { key: TOKEN_KEY, value: token },
  )
  const page = await context.newPage()
  return { context, page }
}

function safeName(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/-+/g, '-').toLowerCase()
}

async function inspectEmptyState(
  page: Page,
  role: 'merchant' | 'warehouse',
  route: string,
  expectedGuidance: string,
  screenshotDir: string,
) {
  await page.goto(`${APP_URL}${route}?v15-1-empty-state=live`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined)
  await expect(page.locator('h1').first()).toBeVisible()
  await expect(page.getByText(expectedGuidance, { exact: false })).toBeVisible()
  const screenshot = `${role}-${safeName(route)}.png`
  await page.screenshot({ path: resolve(screenshotDir, screenshot), fullPage: true })
  return {
    role,
    route,
    heading: await page.locator('h1').first().innerText(),
    expectedGuidance,
    screenshot,
    status: 'PASS' as const,
  }
}

function writeReport(records: EmptyStateRecord[]) {
  const resolvedReportPath = resolve(process.cwd(), REPORT_PATH)
  const screenshotDir = dirname(resolvedReportPath)
  mkdirSync(screenshotDir, { recursive: true })
  const payload = {
    appUrl: APP_URL,
    apiUrl: API_URL,
    checkedAt: new Date().toISOString(),
    acceptanceStandard:
      'Fresh merchant and warehouse accounts with no operational history receive role-aware empty-state guidance instead of dead-end blank panels.',
    records,
  }
  writeFileSync(resolvedReportPath, `${JSON.stringify(payload, null, 2)}\n`)
  writeFileSync(
    resolvedReportPath.replace(/\.json$/, '.summary.md'),
    [
      '# V15.1 Empty-State Live Check',
      '',
      `Checked at: ${payload.checkedAt}`,
      '',
      '| Role | Route | Heading | Status | Screenshot |',
      '| --- | --- | --- | --- | --- |',
      ...records.map((record) => `| ${record.role} | \`${record.route}\` | ${record.heading} | ${record.status} | ${record.screenshot} |`),
      '',
    ].join('\n'),
  )
}

test('fresh accounts see guided first-run empty states', async ({ browser, request }) => {
  test.setTimeout(180_000)
  const fixture = await createEmptyFixture(request)
  const resolvedReportPath = resolve(process.cwd(), REPORT_PATH)
  const screenshotDir = dirname(resolvedReportPath)
  mkdirSync(screenshotDir, { recursive: true })
  const records: EmptyStateRecord[] = []

  const { context: merchantContext, page: merchantPage } = await newAuthedPage(browser, fixture.merchantAccount)
  records.push(await inspectEmptyState(
    merchantPage,
    'merchant',
    '/merchant',
    'Create the first order once a SKU and active warehouse partner are ready',
    screenshotDir,
  ))
  records.push(await inspectEmptyState(
    merchantPage,
    'merchant',
    '/merchant/inventory',
    'Create your first SKU',
    screenshotDir,
  ))
  records.push(await inspectEmptyState(
    merchantPage,
    'merchant',
    '/merchant/orders',
    'Create the first order',
    screenshotDir,
  ))
  records.push(await inspectEmptyState(
    merchantPage,
    'merchant',
    '/service-accountability',
    'Create or activate a partner relationship',
    screenshotDir,
  ))
  records.push(await inspectEmptyState(
    merchantPage,
    'merchant',
    '/assistant',
    'Start with a scoped summary',
    screenshotDir,
  ))
  records.push(await inspectEmptyState(
    merchantPage,
    'merchant',
    '/notifications',
    'will appear here',
    screenshotDir,
  ))
  await merchantContext.close()

  const { context: warehouseContext, page: warehousePage } = await newAuthedPage(browser, fixture.warehouseAccount)
  records.push(await inspectEmptyState(
    warehousePage,
    'warehouse',
    '/warehouse',
    'No pick work yet. Confirm partner access, received stock, and merchant orders',
    screenshotDir,
  ))
  records.push(await inspectEmptyState(
    warehousePage,
    'warehouse',
    '/service-accountability',
    'Create or activate a partner relationship',
    screenshotDir,
  ))
  records.push(await inspectEmptyState(
    warehousePage,
    'warehouse',
    '/assistant',
    'Start with a scoped summary',
    screenshotDir,
  ))
  records.push(await inspectEmptyState(
    warehousePage,
    'warehouse',
    '/notifications',
    'will appear here',
    screenshotDir,
  ))
  await warehouseContext.close()

  writeReport(records)
})
