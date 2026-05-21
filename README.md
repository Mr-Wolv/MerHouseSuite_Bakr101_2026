# MerHouse

MerHouse is a B2B fulfillment coordination system for merchants and warehouse providers.

It models the operating relationship between a brand or merchant and a warehouse partner: products, inventory expectations, inbound stock, customer orders, allocation, fulfillment progress, exceptions, shipment evidence, and service accountability all move through one role-aware workflow.

## Product Surface

- Authenticated role-aware web app for platform, merchant, and warehouse users.
- Merchant workflows for inventory, inbound stock, order creation, order import history, allocation visibility, fulfillment status, service records, and operational detail pages.
- Warehouse workflows for receiving, pick/pack/ship progress, shipment package evidence, exception reporting, and warehouse inventory.
- Platform workflows for tenant management, user management, onboarding requests, role changes, account status, audit events, and background work visibility.
- Service accountability for agreements, service statements, SLA status, disputes, claims, and review requests.
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
This repository is prepared for public source review and local development. SaaS deployment work is intentionally reserved for the V16 productionization phase.

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
- [Architecture notes](docs/architecture/merchant-warehouse-operating-loop.md)
- [System diagrams](docs/architecture/system-diagrams.html)
