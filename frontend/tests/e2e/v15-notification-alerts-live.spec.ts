import { expect, test } from '@playwright/test'
import type { APIRequestContext, Browser, Page, Route } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const APP_URL = process.env.FRONTEND_TOUR_BASE_URL ?? 'http://localhost:3000'
const API_URL = process.env.E2E_API_URL ?? APP_URL
const REPORT_PATH = process.env.V15_NOTIFICATION_ALERT_REPORT ?? '../reports/v15-1-ui-signature/notification-alert-live-check.json'
const TOKEN_KEY = 'warehouse-console-token'

type Account = {
  email: string
  password: string
}

type NotificationDeliveryFixture = {
  id: string
  recipientUserId: string
  tenantId: string
  topic: 'ACCOUNT_LIFECYCLE' | 'OPERATIONS' | 'SERVICE_ACCOUNTABILITY' | 'OUTBOX_HEALTH'
  channel: 'IN_APP' | 'EMAIL_PROTOTYPE'
  status: 'RECORDED' | 'READ' | 'SKIPPED_BY_PREFERENCE'
  deliveryStage: 'PREPARED' | 'LOCAL_RECORDED' | 'SKIPPED_BY_PREFERENCE'
  providerStatus: 'NOT_CONFIGURED' | 'READY_FOR_PROVIDER'
  title: string
  body: string
  sourceType: string | null
  sourceId: string | null
  prototypeLocal: boolean
  createdAt: string
  readAt: string | null
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

async function newAuthedPage(browser: Browser, account: Account) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
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

function delivery(overrides: Partial<NotificationDeliveryFixture>): NotificationDeliveryFixture {
  return {
    id: 'delivery-info',
    recipientUserId: 'owner-user',
    tenantId: 'owner-tenant',
    topic: 'SERVICE_ACCOUNTABILITY',
    channel: 'IN_APP',
    status: 'RECORDED',
    deliveryStage: 'LOCAL_RECORDED',
    providerStatus: 'NOT_CONFIGURED',
    title: 'Preference recorded',
    body: 'Service notification preferences were updated.',
    sourceType: null,
    sourceId: null,
    prototypeLocal: true,
    createdAt: '2026-05-31T07:00:00Z',
    readAt: null,
    ...overrides,
  }
}

async function fulfillJson(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  })
}

async function installNotificationFixture(page: Page) {
  let deliveries = [
    delivery({
      id: 'delivery-critical',
      topic: 'OUTBOX_HEALTH',
      title: 'Outbox dead-lettered',
      body: 'Failed outbox event needs retry before dispatch continues.',
      sourceType: 'OutboxEvent',
      sourceId: 'outbox-critical-0001',
      createdAt: '2026-05-31T07:03:00Z',
    }),
    delivery({
      id: 'delivery-action',
      topic: 'OPERATIONS',
      title: 'Returned shipment',
      body: 'Returned shipment needs warehouse review.',
      sourceType: 'Shipment',
      sourceId: 'shipment-action-0001',
      createdAt: '2026-05-31T07:02:00Z',
    }),
    delivery({
      id: 'delivery-info',
      topic: 'SERVICE_ACCOUNTABILITY',
      title: 'Preference recorded',
      body: 'Service notification preferences were updated.',
      sourceType: null,
      sourceId: null,
      createdAt: '2026-05-31T07:01:00Z',
    }),
    delivery({
      id: 'delivery-resolved',
      topic: 'OUTBOX_HEALTH',
      status: 'READ',
      title: 'Failed event resolved',
      body: 'Previously failed outbox work was reviewed.',
      sourceType: 'OutboxEvent',
      sourceId: 'outbox-resolved-0001',
      createdAt: '2026-05-31T07:00:00Z',
      readAt: '2026-05-31T07:04:00Z',
    }),
  ]

  await page.route('**/api/v1/notifications/preferences', (route) => fulfillJson(route, [
    {
      id: 'pref-account-in-app',
      topic: 'ACCOUNT_LIFECYCLE',
      channel: 'IN_APP',
      enabled: true,
      updatedAt: '2026-05-31T07:00:00Z',
    },
    {
      id: 'pref-outbox-in-app',
      topic: 'OUTBOX_HEALTH',
      channel: 'IN_APP',
      enabled: true,
      updatedAt: '2026-05-31T07:00:00Z',
    },
  ]))
  await page.route('**/api/v1/notifications/summary', (route) => fulfillJson(route, {
    unreadCount: deliveries.filter((item) => item.status === 'RECORDED' && !item.readAt).length,
    latestDeliveryAt: deliveries[0]?.createdAt ?? null,
  }))
  await page.route('**/api/v1/notifications/deliveries**', (route) => fulfillJson(route, deliveries))
  await page.route('**/api/v1/notifications/deliveries/*/read', async (route) => {
    const id = route.request().url().match(/deliveries\/([^/]+)\/read/)?.[1]
    deliveries = deliveries.map((item) => (
      item.id === id
        ? { ...item, status: 'READ', readAt: '2026-05-31T07:05:00Z' }
        : item
    ))
    await fulfillJson(route, deliveries.find((item) => item.id === id) ?? deliveries[0])
  })

  return {
    deliveries: () => deliveries,
  }
}

function writeReport(payload: Record<string, unknown>) {
  const resolvedReportPath = resolve(process.cwd(), REPORT_PATH)
  mkdirSync(dirname(resolvedReportPath), { recursive: true })
  writeFileSync(resolvedReportPath, `${JSON.stringify(payload, null, 2)}\n`)
  writeFileSync(
    resolvedReportPath.replace(/\.json$/, '.summary.md'),
    [
      '# V15.1 Notification Alert Live Check',
      '',
      `Checked at: ${payload.checkedAt}`,
      '',
      `Route: \`${payload.route}\``,
      '',
      `Screenshots: ${(payload.screenshots as string[]).join(', ')}`,
      '',
    ].join('\n'),
  )
}

test('notification center renders alert severity lanes and quiets a read critical alert', async ({ browser }) => {
  test.setTimeout(120_000)
  const { context, page } = await newAuthedPage(browser, ownerAccount)
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  const fixture = await installNotificationFixture(page)

  const resolvedReportPath = resolve(process.cwd(), REPORT_PATH)
  const screenshotDir = dirname(resolvedReportPath)
  mkdirSync(screenshotDir, { recursive: true })

  await page.goto(`${APP_URL}/notifications?v15-1-notification-alerts=live`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined)

  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await expect(page.locator('.severity-critical', { hasText: 'Critical' })).toBeVisible()
  await expect(page.locator('.severity-action', { hasText: 'Action needed' })).toBeVisible()
  await expect(page.locator('.severity-review', { hasText: 'Review' })).toBeVisible()
  await expect(page.locator('.severity-cleared', { hasText: 'Cleared' })).toBeVisible()
  await expect(page.locator('.notification-critical').filter({ hasText: 'Outbox dead-lettered' })).toBeVisible()
  await expect(page.locator('.notification-action').filter({ hasText: 'Returned shipment' })).toBeVisible()
  await expect(page.locator('.notification-review').filter({ hasText: 'Preference recorded' })).toBeVisible()
  await expect(page.locator('.notification-cleared').filter({ hasText: 'Failed event resolved' })).toBeVisible()
  await expect(page.locator('[aria-label="3 unread alerts"]')).toBeVisible()

  const firstScreenshot = 'notification-alert-spectrum.png'
  await page.screenshot({ path: resolve(screenshotDir, firstScreenshot), fullPage: true })

  await page.locator('.notification-critical').filter({ hasText: 'Outbox dead-lettered' }).getByRole('button', { name: /Mark read/ }).click()
  await expect(page.locator('.notification-cleared').filter({ hasText: 'Outbox dead-lettered' })).toBeVisible()
  await expect(page.locator('.notification-critical').filter({ hasText: 'Outbox dead-lettered' })).toHaveCount(0)
  await expect(page.locator('[aria-label="2 unread alerts"]')).toBeVisible()
  await expect(page.locator('[aria-label="3 unread alerts"]')).toHaveCount(0)

  const resolvedScreenshot = 'notification-alert-after-read.png'
  await page.screenshot({ path: resolve(screenshotDir, resolvedScreenshot), fullPage: true })

  expect(consoleErrors).toEqual([])
  writeReport({
    appUrl: APP_URL,
    checkedAt: new Date().toISOString(),
    route: '/notifications',
    acceptanceStandard:
      'Notification cards display distinct critical, action, review, and resolved lanes, with read critical alerts settling into resolved treatment and the shell unread badge decrementing immediately after the read click.',
    unreadBeforeRead: 3,
    unreadAfterRead: fixture.deliveries().filter((item) => item.status === 'RECORDED' && !item.readAt).length,
    screenshots: [firstScreenshot, resolvedScreenshot],
    consoleErrors,
    status: 'PASS',
  })
  await context.close()
})
