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
| `/service-accountability` | Agreements, SLA status, statements, disputes, claims, reviews, and import history |
| `/notifications` | Authenticated notification preferences and prototype-local delivery history |
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
| `frontend/src/test` | Test setup |

Frontend role gates shape navigation and page access. Backend authorization remains the source of enforcement for API behavior.
