# MerHouse

MerHouse is a B2B fulfillment coordination system for merchants and warehouse providers.

This repository is prepared as a public local-development project. It includes the application source, documentation, scripts, CI configuration, Docker Compose setup, and agent guidance needed to understand and run MerHouse. Local-only working files stay outside Git.

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
- V16.1 mobile-ready work targets the same app as an installable mobile web app, not a separate native app.

## Local Workflow Truth

The app has been verified as a local, role-aware fulfillment coordination system:

- Platform owner/admin users review onboarding, govern tenants and relationships, manage accounts, inspect audit evidence, and monitor outbox reliability.
- Support admins can review and recover supported platform work without owner-only governance powers.
- Auditors can inspect governance, service, outbox, assistant, and audit evidence without mutation controls.
- Merchants can move from first-run setup into active work by creating stock, connecting a warehouse provider, sending inbound stock, creating orders, reading attention signals, and reviewing service accountability.
- Warehouse operators can move from first-run setup into active work by receiving inbound stock, picking/packing/shipping allocated orders, reporting exceptions, and reviewing service evidence.
- Every signed-in role can use `/account` for account context and current-password-verified password changes.

Fresh empty accounts and seeded active accounts are both expected states. Empty merchant and warehouse users should see guided first-run steps instead of blank panels; active users should see attention-first work queues before history, metrics, or diagnostics.

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
This repository is prepared for public local development and future deployment readiness. V16 certification uses local mocks, dry-run proof, and publication-boundary checks; it does not perform real cloud/provider deployment. Any later production activation still needs a separate deployment phase.

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

Heavy local certification with API smoke:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose
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

## Local Mocks And Non-Deployed Boundaries

V16 proves deployment readiness locally; it does not deploy MerHouse.

- Notification delivery and password recovery delivery are local records, not real email, SMS, push, or webhook provider sends.
- Carrier/provider handoff is represented by local outbox and carrier-dispatch records.
- Assistant behavior is deterministic local review assistance, not provider-backed AI.
- Health, backup/restore, dependency, and public-readiness proof are local/dry-run checks.
- Service statements are local service-unit records, not invoices or payment collection; dispute evidence is stored as notes and linked local records, not uploaded legal attachment packets.
- Failed and returned shipments are delivery-state evidence, not a full customer RMA, refund, inspection, disposition, or accounting workflow.
- Mobile support in V16.1 means an installable web app with mobile proof; native app-store packaging, native push, camera/barcode APIs, and offline sync are later work.
- Runtime-only values belong in `.env` or your shell environment. Keep generated proof reports, local data, and deployment-specific details out of Git.

Future production activation is a separate later phase and must replace local mocks with real provider contracts, deployment configuration, monitoring, backup/restore operations, and deployment-specific proof.

## Final Local QC Snapshot

The final closeout pass on 2026-06-08 verified:

- Live browser tour across 152 routed records for public auth/recovery/access/reset, owner/admin, support-admin, auditor, merchant, warehouse, account settings, notifications, assistant, service accountability, outbox, audit, and operational detail routes.
- Desktop and narrow viewport sweeps with no visible horizontal page overflow, clipped visible controls, missing accessible names, framework error residue, or confusing route fallback.
- Fresh merchant and warehouse accounts from empty state into active relationship, inbound receiving, stock, order allocation, notifications, and detail-page workflows.
- Account settings password change for a disposable user, including form clearing and login with the new password.
- `.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose` passed, including backend tests, frontend lint/build/Vitest, Playwright E2E, markdown, public-readiness, and API smoke.

Generated proof reports stay local through `.gitignore`.

## What Belongs In Git

The repository is intended to contain developer/user-relevant project material:

- `backend/`
- `frontend/`
- `docs/`
- `scripts/`
- `.github/`
- root configuration such as `README.md`, `AGENTS.md`, `.env.example`, `.gitattributes`, `.gitignore`, `docker-compose.yml`, and `pom.xml`

Local notes, generated reports, environment files, editor state, dependency output, build output, and deployment-specific run material are excluded.

## Documentation

- [Documentation index](docs/index.md)
- [Roadmap](docs/architecture/roadmap.md)
- [Backend guide](docs/development/backend.md)
- [Frontend guide](docs/development/frontend.md)
- [Scripts guide](docs/development/scripts.md)
- [Knowledge system](docs/development/knowledge-system.md)
- [Architecture notes](docs/architecture/merchant-warehouse-operating-loop.md)
- [Agentic operations assistance](docs/architecture/agentic-operations-assistance.md)
- [Mobile-ready local certification](docs/architecture/mobile-ready-local-certification.md)
- [Notifications](docs/architecture/notifications.md)
- [Deployment-ready local certification](docs/architecture/deployment-ready-local-certification.md)
- [System diagrams](docs/architecture/system-diagrams.html)
