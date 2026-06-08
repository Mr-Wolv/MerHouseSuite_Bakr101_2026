# Frontend Guide

The MerHouse frontend is a React operations console backed by the Spring Boot API.

## Stack

- React 19
- TypeScript
- Vite
- React Router
- Vitest
- React Testing Library
- Playwright
- nginx for the Docker image

## Runtime

From `frontend/`:

```powershell
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8080`.

The Docker image builds the React app and serves it through nginx. In Docker Compose, nginx proxies API and OpenAPI requests to the backend service.

## Mobile Web App Runtime

V16.1 treats mobile as the same React app running as an installable progressive web app. The mobile foundation lives in:

| Path | Role |
| --- | --- |
| `frontend/index.html` | Mobile metadata and manifest link |
| `frontend/public/manifest.webmanifest` | App name, start URL, display mode, theme colors, and icon list |
| `frontend/public/pwa-icon.svg` | Mobile app icon used by the manifest and touch metadata |
| `frontend/public/sw.js` | Online-first service worker for shell/navigation fallback |
| `frontend/src/registerServiceWorker.ts` | Production-only service worker registration |

Check installability metadata from the repository root:

```powershell
.\scripts\quality\pwa-check.ps1
```

V16.1 mobile support is not a native app-store build. Native push, camera/barcode APIs, offline write queues, and app-store packaging remain later work.

## Theme Runtime

V15 adds a frontend theme provider under `frontend/src/theme`. The default preference is `system`, which resolves through `prefers-color-scheme`. When a user toggles the visible theme control, the explicit `light` or `dark` preference is stored in `localStorage` under `merhouse-theme-preference`.

The provider applies `data-theme="light"` or `data-theme="dark"` and `color-scheme` to the document root. Shared color, surface, focus, status, and form tokens live in `frontend/src/index.css`; page-specific styling should consume those tokens instead of adding new hard-coded colors.

## Tests And Build

```powershell
npm test -- --run
npm run build
```

Browser workflow tests are kept in `frontend/tests/e2e/` and use `frontend/playwright.config.ts`.
Run them against a seeded local stack:

```powershell
npm run test:e2e
```

The Playwright suite runs with one worker because the end-to-end tests share one seeded local backend, database, and browser target. Keep it serial unless the suite is redesigned to isolate data and runtime state per worker.

When the Docker frontend is already running, point the whole Playwright suite at it so both route-tour and admin-console specs use the same browser target:

```powershell
$env:FRONTEND_TOUR_BASE_URL = "http://localhost:3000"
npm run test:e2e
Remove-Item Env:\FRONTEND_TOUR_BASE_URL
```

## Route Map

Routes are defined in `frontend/src/App.tsx`.

| Route | Purpose |
| --- | --- |
| `/login` | Login |
| `/forgot-password` | Password reset request |
| `/reset-password` | Password reset confirmation |
| `/request-access` | Merchant or warehouse access request |
| `/admin` | Platform overview |
| `/admin/tenants` | Tenant management |
| `/admin/users` | User management |
| `/admin/access-requests` | Access request review and conversion |
| `/admin/outbox` | Outbox and dispatch diagnostics |
| `/admin/relationships` | Merchant-provider relationship governance |
| `/admin/audit` | Audit event review |
| `/merchant` | Merchant overview |
| `/merchant/inventory` | Merchant inventory, relationships, inbound stock, and authorized stock |
| `/merchant/orders` | Order creation, allocation, cancellation, contacts, imports, and shipment-facing work |
| `/warehouse` | Warehouse inventory, receiving, fulfillment, shipments, and exceptions |
| `/service-accountability` | At-risk SLA work, disputes, claims, reviews, service agreements, statements, and import history |
| `/assistant` | Prototype-local scoped assistant summaries, suggestions, refusals, and interaction history |
| `/notifications` | Action inbox, notification delivery history, and authenticated notification preferences |
| `/account` | Signed-in account context and self-service password change |
| `/orders/:orderId` | Order detail |
| `/inventory/items/:inventoryItemId` | Inventory item detail |
| `/inbound-stock-requests/:inboundStockRequestId` | Inbound stock detail |
| `/shipments/:shipmentId` | Shipment detail |
| `/fulfillment-allocations/:allocationId` | Fulfillment allocation detail |
| `/merchant-warehouse/relationships/:relationshipId` | Relationship detail |

## Code Map

| Path | Role |
| --- | --- |
| `frontend/src/api` | API client and shared DTO types |
| `frontend/src/auth` | Authentication context and hooks |
| `frontend/src/components` | Shared layout, metric, status, and data-state components |
| `frontend/src/pages` | Route-level pages |
| `frontend/src/theme` | V15 theme provider, persistence, and document theme hook |
| `frontend/src/test` | Test setup |

Frontend role gates shape navigation and page access. Backend authorization remains the source of enforcement for API behavior.
