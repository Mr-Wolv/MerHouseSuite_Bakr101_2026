# Backend Guide

The MerHouse backend is a Spring Boot API that owns the transactional domain model, authorization checks, persistence, migrations, and OpenAPI metadata.

## Stack

- Java 21
- Spring Boot 4
- Spring Web MVC
- Spring Security
- Spring Data JPA
- Flyway
- PostgreSQL 17
- Testcontainers

## Runtime

From `backend/`:

```powershell
.\mvnw.cmd spring-boot:run
```

The Docker Compose stack supplies PostgreSQL and the required backend environment variables.

## Configuration

Core application settings live in `backend/src/main/resources/application.properties`.

Important environment variables:

| Variable | Purpose |
| --- | --- |
| `SPRING_DATASOURCE_URL` | JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | Database user |
| `SPRING_DATASOURCE_PASSWORD` | Database password |
| `MERHOUSE_AUTH_JWT_SECRET` | JWT signing secret |
| `MERHOUSE_AUTH_JWT_EXPIRES_SECONDS` | JWT lifetime |
| `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN` | Local recovery-token echo switch |
| `MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT` | Maximum reset-token preparations per enabled account inside the recovery window |
| `MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES` | Rolling window, in minutes, for reset-request throttling |
| `MERHOUSE_ACCESS_REQUEST_LIMIT` | Maximum public access-request submissions per requester email inside the access-request window |
| `MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS` | Rolling window, in hours, for public access-request throttling |
| `MERHOUSE_AUTH_SEED_ADMIN_ENABLED` | Local owner seeding switch |
| `MERHOUSE_SWAGGER_ENABLED` | OpenAPI and Swagger UI switch |
| `MERHOUSE_DEPLOYMENT_PUBLIC` | Deployment-shaped startup validation |
| `MERHOUSE_CORS_ALLOWED_ORIGINS` | Comma-separated browser/native origins allowed to call `/api/**`; the local default includes Docker nginx, Vite dev/tour origins, and Capacitor local origins |
| `MERHOUSE_EMAIL_ENABLED` | Opt-in SMTP-backed email delivery attempts for V17 recovery, account-ready, and notification email proof |
| `MERHOUSE_EMAIL_FROM` | Sender address required when email delivery is enabled |
| `MERHOUSE_EMAIL_REPLY_TO` | Optional reply-to address; public startup rejects placeholders or malformed values when set with email delivery enabled |
| `MERHOUSE_SMTP_HOST` / `MERHOUSE_SMTP_PORT` | SMTP provider target; public startup rejects local SMTP hosts when email delivery is enabled |
| `MERHOUSE_SMTP_USERNAME` / `MERHOUSE_SMTP_PASSWORD` | SMTP provider account and private credential required when email delivery is enabled |
| `MERHOUSE_AGENT_MODE` | Agent runtime mode; public startup currently accepts only `deterministic` |
| `MERHOUSE_AGENT_TIMEOUT_SECONDS` | Agent runtime timeout guard; public startup requires 1-60 seconds |

## Tests

```powershell
.\mvnw.cmd test
```

The backend test suite includes service tests, web/controller tests, OpenAPI configuration tests, startup validation tests, JWT tests, and PostgreSQL integration tests with Flyway migrations.

Maven Surefire loads Mockito as an explicit Java agent during tests so newer JDKs do not depend on Mockito's deprecated dynamic self-attachment path.

## Code Map

| Path | Role |
| --- | --- |
| `backend/src/main/java/com/merhouse/web` | REST controllers |
| `backend/src/main/java/com/merhouse/service` | Domain and application services |
| `backend/src/main/java/com/merhouse/repository` | Spring Data repositories |
| `backend/src/main/java/com/merhouse/entity` | JPA entities and enums |
| `backend/src/main/java/com/merhouse/dto` | Request and response DTOs |
| `backend/src/main/java/com/merhouse/security` | Token and authentication support |
| `backend/src/main/resources/db/migration` | Flyway migrations |

## API Modules

- Authentication, current user, account settings, and self-service password change
- Access requests
- Tenant and user administration
- Inventory and warehouse inventory
- Orders, allocation, backorders, and imports
- Fulfillment allocations, exceptions, and shipments
- Merchant-warehouse relationships and inbound stock
- Operational details and timelines
- Service accountability, agreements, statements, SLA review, disputes, claims, and order imports
- Deterministic local operations assistance with scoped summaries, review suggestions, refusals, and auditable human decisions
- Local notification action inbox, recipient-scoped delivery history, preferences, and app-shell unread summary
- Transactional outbox administration
