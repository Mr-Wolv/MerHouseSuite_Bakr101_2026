# API Documentation

MerHouse exposes a versioned REST API under `/api/v1`.

## Local API Docs

When the backend is running locally:

- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`
- Grouped API JSON: `http://localhost:8080/v3/api-docs/merhouse-v1`

The generated OpenAPI title is `MerHouse API`, and the grouped contract is named `merhouse-v1`.

## API Areas

| Area | Base path |
| --- | --- |
| Authentication | `/api/v1/auth` |
| Access requests | `/api/v1/access-requests` |
| Tenants | `/api/v1/tenants` |
| Admin users | `/api/v1/admin/users` |
| Admin control plane | `/api/v1/admin/control` |
| Admin outbox | `/api/v1/admin/outbox` |
| Dashboard summaries | `/api/v1/dashboard` |
| Inventory | `/api/v1/inventory` |
| Warehouses | `/api/v1/warehouses` |
| Orders and imports | `/api/v1/orders` |
| Fulfillment and shipments | `/api/v1/fulfillment-allocations`, `/api/v1/shipments`, `/api/v1/fulfillment-exceptions` |
| Merchant-warehouse workflow | `/api/v1/merchant-warehouse` |
| Operational detail reads | `/api/v1/operational-details` |
| Service accountability | `/api/v1/service-accountability` |
| Notifications | `/api/v1/notifications` |

## Authentication

Authenticated endpoints use bearer-token authentication. Login returns the access token and current user summary. Frontend requests attach the token through the shared API client in `frontend/src/api/client.ts`.

## Source Of Truth

Controller mappings live in `backend/src/main/java/com/merhouse/web`. DTOs live in `backend/src/main/java/com/merhouse/dto`.
