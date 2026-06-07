# MerHouse

MerHouse is a B2B fulfillment coordination system for merchants and warehouse providers.

This workspace is private. The intended future public release boundary is a separate repository containing only the `backend/` and `frontend/` application folders. Private operational material and sensitive information may live in this private repo, but they should stay outside `backend/` and `frontend/` and be referenced by path, environment variable, or template. That includes API keys, tokens, credentials, private prompts, customer data, vendor account details, internal endpoints, generated sensitive reports, and environment-specific values.

It models the operating relationship between a brand or merchant and a warehouse partner: products, inventory expectations, inbound stock, customer orders, allocation, fulfillment progress, exceptions, shipment evidence, and service accountability all move through one role-aware workflow.

## Product Surface

- Authenticated role-aware web app for platform, merchant, and warehouse users.
- Merchant workflows for inventory, inbound stock, order creation, order import history, allocation visibility, fulfillment status, service records, and operational detail pages.
- Warehouse workflows for receiving, pick/pack/ship progress, shipment package evidence, exception reporting, and warehouse inventory.
- Platform workflows for tenant management, user management, onboarding requests, role changes, account status, relationship governance, audit evidence, outbox diagnostics, and attention-first operational review.
- Service accountability for agreement setup, agreement proposal and acceptance, at-risk SLA work, service statements, disputes, claims, review requests, and import evidence.
- Account settings after sign-in for account context and current-password-verified self-service password changes.
- Deterministic prototype-local operations assistant for scoped summaries, review-only suggestions, refusals, pending-decision review, and auditable interaction history.
- Prototype-local notification action inbox for account lifecycle events, connected operational handoffs, service accountability updates, outbox health, per-user preferences, delivery history, and app-shell alert counts without external provider delivery.
- REST API with validation, authorization, tenant-aware data access, Flyway migrations, PostgreSQL persistence, and OpenAPI metadata.

## Tech Stack

- Java 21, Spring Boot, Spring Security, Spring Data JPA, Flyway
- PostgreSQL
- React, TypeScript, Vite, Vitest
- Docker Compose, nginx

## Repository Layout

```text
backend/        Spring Boot API, domain services, repositories, migrations, and tests
frontend/       React application, API client, pages, shared components, and tests
docs/           Architecture and development documentation
scripts/        Local development, quality, smoke-test, and maintenance helpers
docker-compose.yml
                Local full-stack runtime
```

## Local Development

Requirements:

- Docker Desktop
- PowerShell

Create an environment file:

```powershell
Copy-Item .env.example .env
```

Set local values in `.env`, then start the stack:

```powershell
docker compose up --build
```

Local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`

The compose stack builds and runs PostgreSQL, the Spring Boot API, and the nginx-served frontend.
This repository is prepared for private local development and future deployment readiness. V16 certification uses local mocks, dry-run proof, and publication-boundary checks; it does not perform real cloud/provider deployment. Any later public release should be assembled from the publishable `backend/` and `frontend/` boundary after a publication review.

## Development Commands

Backend:

```powershell
cd backend
.\mvnw.cmd test
```

Frontend:

```powershell
cd frontend
npm test -- --run
npm run build
```

Compose configuration:

```powershell
docker compose --env-file .env.example config --quiet
```

Full local quality check:

```powershell
.\scripts\quality\check.ps1
```

Deployment-ready local certification gate:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -SkipCompose
```

Start or stop the local stack:

```powershell
.\scripts\local\start.ps1
.\scripts\local\stop.ps1
```

## Runtime Configuration

The backend reads configuration from environment variables. `.env.example` contains the local Docker Compose template.

| Variable | Purpose |
| --- | --- |
| `MERHOUSE_POSTGRES_DB` | PostgreSQL database name |
| `MERHOUSE_POSTGRES_USER` | PostgreSQL user |
| `MERHOUSE_POSTGRES_PASSWORD` | PostgreSQL password |
| `MERHOUSE_AUTH_JWT_SECRET` | HMAC secret for API access tokens |
| `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN` | Development switch for returning recovery tokens in API responses |
| `MERHOUSE_AUTH_SEED_ADMIN_ENABLED` | Development switch for creating an initial owner account |
| `MERHOUSE_AUTH_SEED_ADMIN_EMAIL` | Initial owner email when seeding is enabled |
| `MERHOUSE_AUTH_SEED_ADMIN_PASSWORD` | Initial owner password when seeding is enabled |
| `MERHOUSE_SWAGGER_ENABLED` | Enables OpenAPI JSON and Swagger UI |
| `MERHOUSE_DEPLOYMENT_PUBLIC` | Enables stricter startup validation for public deployment-shaped environments |

## Documentation

- [Documentation index](docs/index.md)
- [Roadmap](docs/architecture/roadmap.md)
- [Backend guide](docs/development/backend.md)
- [Frontend guide](docs/development/frontend.md)
- [Scripts guide](docs/development/scripts.md)
- [Knowledge system](docs/development/knowledge-system.md)
- [Architecture notes](docs/architecture/merchant-warehouse-operating-loop.md)
- [Agentic operations assistance](docs/architecture/agentic-operations-assistance.md)
- [Notifications](docs/architecture/notifications.md)
- [Deployment-ready local certification](docs/architecture/deployment-ready-local-certification.md)
- [Structural stabilization](docs/architecture/structural-stabilization.md)
- [System diagrams](docs/architecture/system-diagrams.html)
