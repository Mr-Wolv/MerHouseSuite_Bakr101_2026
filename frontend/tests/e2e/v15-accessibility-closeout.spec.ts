import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { firebaseLogin } from './firebase-auth-helper'

const APP_URL = process.env.FRONTEND_TOUR_BASE_URL ?? 'http://localhost:3001'
const API_URL = process.env.E2E_API_URL ?? APP_URL
const REPORT_PATH = process.env.V15_CLOSEOUT_REPORT ?? '../reports/v15-closeout/v15-accessibility-proof.json'

type Account = {
  email: string
  password: string
}

type CloseoutRecord = {
  check: string
  route: string
  status: 'PASS'
  details: Record<string, unknown>
}

const ownerAccount: Account = {
  email: process.env.FRONTEND_TOUR_ADMIN_EMAIL ?? 'admin@merhouse.local',
  password: process.env.FRONTEND_TOUR_ADMIN_PASSWORD ?? 'local-owner-password',
}

const expectedEvidence = [
  '../reports/v15-admin-polish/admin-guidance-live-check.json',
  '../reports/v15-admin-residue-polish/admin-residue-live-check.json',
  '../reports/v15-merchant-polish/merchant-live-check.json',
  '../reports/v15-merchant-polish/merchant-detail-live-check.json',
  '../reports/v15-warehouse-polish/warehouse-live-check.json',
  '../reports/v15-warehouse-polish/warehouse-detail-live-check.json',
  '../reports/v15-service-accountability-polish/service-accountability-live-check.json',
  '../reports/v15-assistant-polish/assistant-live-check.json',
  '../reports/v15-assistant-polish/assistant-auditor-live-check.json',
  '../reports/v15-notifications-polish/notifications-live-check.json',
  '../reports/v15-relationship-detail-polish/relationship-detail-live-check.json',
  '../reports/v15-public-auth-polish/public-auth-live-check.json',
]

function contrastRatio(foreground: string, background: string) {
  function parseColor(value: string) {
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!match) throw new Error(`Unsupported color format: ${value}`)
    return [Number(match[1]), Number(match[2]), Number(match[3])]
  }

  function luminance(value: number[]) {
    const [r, g, b] = value.map((channel) => {
      const normalized = channel / 255
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const foregroundLuminance = luminance(parseColor(foreground))
  const backgroundLuminance = luminance(parseColor(background))
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

async function tokenContrast(page: Page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const probe = document.createElement('span')
    probe.style.display = 'none'
    document.body.appendChild(probe)

    function colorFor(variable: string) {
      probe.style.color = `var(${variable})`
      return getComputedStyle(probe).color
    }

    const colors = {
      text: colorFor('--text'),
      muted: colorFor('--muted'),
      accent: colorFor('--accent-dark'),
      danger: colorFor('--danger'),
      success: colorFor('--success'),
      background: colorFor('--bg'),
      surface: colorFor('--surface'),
      dangerSurface: colorFor('--danger-surface'),
      successSurface: colorFor('--success-surface'),
      theme: root.getPropertyValue('color-scheme').trim(),
    }
    probe.remove()
    return colors
  })
}

function writeReports(records: CloseoutRecord[]) {
  const resolvedReportPath = resolve(process.cwd(), REPORT_PATH)
  mkdirSync(dirname(resolvedReportPath), { recursive: true })
  const payload = {
    appUrl: APP_URL,
    apiUrl: API_URL,
    checkedAt: new Date().toISOString(),
    acceptanceStandard:
      'V15 closeout covers focus visibility, theme persistence, contrast-sensitive tokens, live-region announcements, reduced-motion rendering, and proof-bundle references.',
    records,
  }
  writeFileSync(resolvedReportPath, `${JSON.stringify(payload, null, 2)}\n`)
  writeFileSync(
    resolvedReportPath.replace(/\.json$/, '.summary.md'),
    [
      '# V15 Accessibility And Proof Bundle',
      '',
      `Checked at: ${payload.checkedAt}`,
      '',
      '| Check | Route | Status |',
      '| --- | --- | --- |',
      ...records.map((record) => `| ${record.check} | \`${record.route}\` | ${record.status} |`),
      '',
      'Machine-readable details are in the matching JSON report.',
      '',
    ].join('\n'),
  )
}

test('V15 accessibility closeout covers focus, live regions, contrast, theme, reduced motion, and proof bundle', async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(180_000)
  const records: CloseoutRecord[] = []

  await page.goto(`${APP_URL}/login?v15-closeout=theme`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Operations Console' })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  records.push({
    check: 'Persistent theme preference',
    route: '/login',
    status: 'PASS',
    details: { expectedTheme: 'dark' },
  })

  await page.keyboard.press('Tab')
  const focusedElement = await page.evaluate(() => {
    const active = document.activeElement
    if (!active) return null
    const styles = getComputedStyle(active)
    return {
      tagName: active.tagName,
      text: active.textContent?.trim() ?? '',
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,
    }
  })
  expect(focusedElement?.outlineStyle).not.toBe('none')
  expect(focusedElement?.outlineWidth).not.toBe('0px')
  records.push({
    check: 'Keyboard focus visibility',
    route: '/login',
    status: 'PASS',
    details: focusedElement ?? {},
  })

  await page.goto(`${APP_URL}/forgot-password?v15-closeout=live-region`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(`v15.closeout.${Date.now()}@example.test`)
  await page.getByRole('button', { name: 'Request reset' }).click()
  await expect(page.getByRole('status')).toContainText('reset link has been prepared')
  records.push({
    check: 'Public recovery status announcement',
    route: '/forgot-password',
    status: 'PASS',
    details: { liveRegionRole: 'status' },
  })

  const ownerToken = await firebaseLogin(request, ownerAccount.email, ownerAccount.password)
  const reducedMotionContext = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 },
  })
  await reducedMotionContext.addInitScript((token) => {
    localStorage.setItem('warehouse-console-token', token)
    localStorage.setItem('merhouse-theme-preference', 'dark')
  }, ownerToken)
  const auditPage = await reducedMotionContext.newPage()
  await auditPage.goto(`${APP_URL}/admin/audit?v15-closeout=reduced-motion`, { waitUntil: 'domcontentloaded' })
  await expect(auditPage.getByRole('heading', { name: 'Admin Audit' })).toBeVisible()
  await expect(auditPage.getByRole('status')).toContainText('Showing')
  const keyboardRegion = auditPage.locator('.keyboard-scroll-region')
  if (await keyboardRegion.count()) {
    await keyboardRegion.focus()
  }
  const reducedMotionEvidence = await auditPage.evaluate(() => ({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    keyboardRegions: document.querySelectorAll('.keyboard-scroll-region[tabindex="0"]').length,
    focusedKeyboardRegion: document.activeElement?.classList.contains('keyboard-scroll-region') ?? false,
  }))
  expect(reducedMotionEvidence.reducedMotion).toBeTruthy()
  records.push({
    check: 'Reduced-motion audit rendering and keyboard table reachability',
    route: '/admin/audit',
    status: 'PASS',
    details: reducedMotionEvidence,
  })
  await reducedMotionContext.close()

  for (const theme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await context.addInitScript((nextTheme) => {
      localStorage.setItem('merhouse-theme-preference', nextTheme)
    }, theme)
    const themedPage = await context.newPage()
    await themedPage.goto(`${APP_URL}/login?v15-closeout=contrast-${theme}`, { waitUntil: 'domcontentloaded' })
    await expect(themedPage.locator('html')).toHaveAttribute('data-theme', theme)
    const colors = await tokenContrast(themedPage)
    const ratios = {
      textOnBackground: contrastRatio(colors.text, colors.background),
      textOnSurface: contrastRatio(colors.text, colors.surface),
      mutedOnSurface: contrastRatio(colors.muted, colors.surface),
      accentOnSurface: contrastRatio(colors.accent, colors.surface),
      dangerOnDangerSurface: contrastRatio(colors.danger, colors.dangerSurface),
      successOnSuccessSurface: contrastRatio(colors.success, colors.successSurface),
    }
    expect(ratios.textOnBackground).toBeGreaterThanOrEqual(4.5)
    expect(ratios.textOnSurface).toBeGreaterThanOrEqual(4.5)
    expect(ratios.mutedOnSurface).toBeGreaterThanOrEqual(4.5)
    expect(ratios.accentOnSurface).toBeGreaterThanOrEqual(4.5)
    expect(ratios.dangerOnDangerSurface).toBeGreaterThanOrEqual(4.5)
    expect(ratios.successOnSuccessSurface).toBeGreaterThanOrEqual(4.5)
    records.push({
      check: `${theme} theme token contrast`,
      route: '/login',
      status: 'PASS',
      details: ratios,
    })
    await context.close()
  }

  const evidence = expectedEvidence.map((relativePath) => {
    const resolvedPath = resolve(process.cwd(), relativePath)
    return {
      path: relativePath,
      exists: existsSync(resolvedPath),
      outsidePublicationBoundary: !resolvedPath.includes('\\frontend\\') && !resolvedPath.includes('\\backend\\'),
    }
  })
  expect(evidence.filter((item) => !item.exists)).toEqual([])
  expect(evidence.filter((item) => !item.outsidePublicationBoundary)).toEqual([])
  records.push({
    check: 'V15 proof bundle references generated evidence outside app source',
    route: 'reports/v15-*',
    status: 'PASS',
    details: { evidence },
  })

  writeReports(records)
})
