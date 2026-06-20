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

The Vite dev server proxies `/api` to `http://localhost:8080`. The backend default CORS origins include the documented local dev and tour origins, `http://localhost:5173` and `http://127.0.0.1:5173`, so browser sign-in behaves the same through Vite as it does through the Docker nginx frontend.

The local Docker Compose image builds the React app from `frontend/frontend-compose.Dockerfile` and serves it through nginx. In Docker Compose, nginx proxies API and OpenAPI requests to the backend service. The managed web deployment uses Firebase Hosting, not this local nginx image.

## Mobile Runtime

Mobile support uses one React app and one Spring Boot API. The browser-facing mobile shell metadata supports the web runtime and is also the build input for the native Android wrapper:

| Path | Role |
| --- | --- |
| `frontend/index.html` | Mobile metadata and manifest link |
| `frontend/public/manifest.webmanifest` | App name, start URL, display mode, theme colors, and icon list |
| `frontend/public/app-icon.svg` | Shared app icon used by the manifest, touch metadata, and native launcher generation |
| `frontend/public/sw.js` | Online-first service worker for shell/navigation fallback |
| `frontend/src/registerServiceWorker.ts` | Production-only service worker registration |

Check shared mobile shell metadata from the repository root:

```powershell
.\scripts\proof\android\mobile-shell-check.ps1
```

The pass output prints the resolved frontend root, manifest path, manifest name, short name, display mode, theme color, icon count, maskable-icon status, and service worker path so web/native shell proof is traceable.

The native Android wrapper packages the same frontend build without creating a second product implementation. The wrapper lives in:

| Path | Role |
| --- | --- |
| `frontend/capacitor.config.ts` | Capacitor app id, app name, web output directory, and Android scheme |
| `frontend/android` | Android wrapper source used for local debug APK builds |
| `frontend/dist` | React build copied into the Android app during Capacitor sync |

Native builds use the same API client and routes. For an Android emulator, the local backend base URL is normally `http://10.0.2.2:8080`:

```powershell
.\scripts\proof\android\native-mobile-check.ps1 -Assemble -ApiBaseUrl "http://10.0.2.2:8080"
```

The native check validates `-ApiBaseUrl` through the shared URL guard as a non-blank absolute `http` or `https` URL, applies the native build rule that it must not end with a trailing slash, defaults it to `http://10.0.2.2:8080` unless overridden, then sets `VITE_API_BASE_URL` during the build and verifies that the configured backend base URL is present in the compiled JavaScript before Capacitor sync. Sync output prints the normalized API base and the compiled asset path that proved it. Its structural pass also rejects Android-wrapper source that duplicates product API paths, React route definitions, direct fetch logic, or frontend API-base wiring. This keeps the web build proxy-relative and the native APK emulator/device-relative while preserving one shared route tree and one shared frontend API client.

The debug APK output is `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

The CI native Android job assembles the same debug APK with the emulator backend URL explicitly supplied, so local and CI Android artifacts carry the same backend boundary.

Native OS notification delivery, native push provider rollout, camera/barcode APIs, offline write queues, app-store signing, and app-store packaging remain later work.

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
$env:FRONTEND_TOUR_BASE_URL = "http://localhost:3001"
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
| `/assistant` | Deterministic local scoped assistant summaries, suggestions, refusals, and interaction history |
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
