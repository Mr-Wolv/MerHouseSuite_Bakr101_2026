# Mobile-Ready Local Certification

V16.1 makes MerHouse locally proven as both a desktop web app and an installable mobile web app.

The mobile app is the same React application and Spring Boot API. It should feel intentional on a phone, but it should not split the project into a second native codebase.

## Boundary

V16.1 includes:

- installable progressive web app behavior
- mobile app metadata, manifest, icons, and theme colors
- mobile-safe app shell and routing
- touch-friendly workflow surfaces
- desktop and mobile browser proof
- CI checks for mobile/PWA readiness

V16.1 does not include:

- native app-store packaging
- native push notifications
- native camera or barcode APIs
- offline write queues or conflict resolution
- separate React Native, Capacitor, or native mobile code
- provider-backed mobile notification delivery

Those native/provider features belong to V17 or VInfinite when the project is intentionally activated for production deployment or expanded beyond the local prototype boundary.

## Mobile Product Standard

Mobile should preserve the same role-aware product idea as desktop:

- each signed-in user can see what needs attention
- each attention item has an owner and next action
- merchant and warehouse users can move from first-run setup into active operating work
- service accountability, notifications, assistant, and account settings remain coherent on phone viewports
- admin, support, and auditor routes remain usable even when they are not the primary mobile workflows

## Implementation Plan

1. Add PWA install foundation.
   - `manifest.webmanifest`
   - app icons and theme metadata
   - mobile browser metadata in `index.html`
   - routing fallback remains compatible with nginx and Vite

2. Polish the app shell for mobile.
   - touch-safe navigation
   - compact account access
   - safe-area padding
   - no desktop-sidebar dependence
   - stable button, menu, tab, and dialog layout

3. Polish role workflows for phone use.
   - merchant dashboard, inventory, orders, notifications, service accountability, assistant, and account settings
   - warehouse dashboard, receiving/fulfillment work, exceptions, notifications, service accountability, assistant, and account settings
   - platform/admin/support/auditor surfaces remain readable, reachable, and safe

4. Prove mobile states.
   - empty/new stakeholder
   - active operating work
   - attention/action-needed work
   - blocked/error state
   - resolved/history state

5. Add mobile proof.
   - mobile route tour
   - manifest/installability check
   - no horizontal overflow
   - no clipped visible controls
   - no unnamed controls
   - no console errors
   - stable mobile login/session behavior

6. Tighten CI and docs.
   - add mobile/PWA checks to GitHub Actions
   - upload mobile proof reports
   - update README, docs index, frontend docs, scripts docs, and roadmap

## Completion Bar

Do not call V16.1 complete until:

- local mobile browser proof passes
- local desktop proof still passes
- installability/PWA proof passes
- frontend and backend tests pass
- API smoke passes
- GitHub Actions quality gate passes
- docs describe the same mobile boundary the code actually implements

## Current Proof Snapshot

The local V16.1 proof pass on 2026-06-08 verified:

- `.\scripts\quality\pwa-check.ps1` passed.
- `npm --prefix frontend test -- --run` passed with 128 tests across 22 files.
- `npm --prefix frontend run build` passed.
- Playwright E2E passed with 19 tests, including `v16-mobile-pwa.spec.ts`.
- `.\scripts\quality\frontend-full-tour.ps1 -OutputPath ".\reports\v16-1-mobile-full-tour.json"` passed with 152 routed records and 0 bad records.
- `.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose` passed, including backend tests, frontend lint/build/Vitest, Playwright E2E, PWA proof, markdown, public-readiness, and API smoke.

GitHub Actions proof passed on run `27143382033` for commit `c490a00`, covering backend, frontend, Compose, public readiness with mobile installability, and integration proof.
