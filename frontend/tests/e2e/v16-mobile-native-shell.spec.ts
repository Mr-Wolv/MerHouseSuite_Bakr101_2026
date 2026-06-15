import { expect, test } from '@playwright/test'

const APP_URL = process.env.FRONTEND_TOUR_BASE_URL ?? 'http://localhost:3001'

test('shared mobile shell metadata supports native packaging and matches the app shell', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${APP_URL}/login`)

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0f766e')
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')

  const manifestResponse = await request.get(`${APP_URL}/manifest.webmanifest`)
  expect(manifestResponse.ok()).toBeTruthy()
  const manifest = await manifestResponse.json()
  expect(manifest.name).toBe('MerHouse Operations Console')
  expect(manifest.short_name).toBe('MerHouse')
  expect(manifest.start_url).toBe('/')
  expect(manifest.scope).toBe('/')
  expect(manifest.display).toBe('standalone')
  expect(manifest.theme_color).toBe('#0f766e')
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        src: '/app-icon.svg',
        purpose: expect.stringContaining('maskable'),
      }),
    ]),
  )

  const iconResponse = await request.get(`${APP_URL}/app-icon.svg`)
  expect(iconResponse.ok()).toBeTruthy()

  const serviceWorkerResponse = await request.get(`${APP_URL}/sw.js`)
  expect(serviceWorkerResponse.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { name: 'Operations Console' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})
