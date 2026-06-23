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
- Firebase Admin SDK

## Runtime

From `backend/`:

```powershell
.\\mvnw.cmd spring-boot:run
```

The Docker Compose stack supplies PostgreSQL, Firebase Auth emulator, and the required backend environment variables. Compose builds the backend from `backend/backend-compose.Dockerfile`; the managed Hugging Face deployment image is tracked separately under `deploy/managed/huggingface-backend/Dockerfile`.

## Configuration

Core application settings live in `backend/src/main/resources/application.properties`.

Important environment variables:

| Variable | Purpose |
| --- | --- |
| `SPRING_DATASOURCE_URL` | JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | Database user |
| `SPRING_DATASOURCE_PASSWORD` | Database password |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Production service-account JSON for Firebase Admin SDK. |
| `FIREBASE_PROJECT_ID` | Firebase project ID. |
| `FIREBASE_EMULATOR_HOST` | Firebase Auth emulator host for local development. |
| `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN` | Local recovery-token echo switch |
| `MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT` | Maximum reset-token preparations per enabled account inside the recovery window |
| `MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES` | Rolling window, in minutes, for reset-request throttling |
| `MERHOUSE_ACCESS_REQUEST_LIMIT` | Maximum public access-request submissions per requester email inside the access-request window |
| `MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS` | Rolling window, in hours, for public access-request throttling |
| `MERHOUSE_AUTH_SEED_ADMIN_ENABLED` | Local owner seeding switch |
| `MERHOUSE_SWAGGER_ENABLED` | OpenAPI and Swagger UI switch |
| `MERHOUSE_DEPLOYMENT_PUBLIC` | Deployment-shaped startup validation |
| `MERHOUSE_CORS_ALLOWED_ORIGINS` | Comma-separated browser/native origins allowed to call `/api/**`; the local default includes Docker nginx, Vite dev/tour origins, and Capacitor local origins. Public startup validation rejects wildcard CORS and requires this list to include `MERHOUSE_PUBLIC_FRONTEND_URL`. |
| `MERHOUSE_PUBLIC_FRONTEND_URL` | Public HTTPS frontend origin used for password-reset links in recovery-token modes |

## Tests

```powershell
.\\mvnw.cmd test
```

The backend test suite includes service tests, web/controller tests, OpenAPI configuration tests, startup validation tests, and PostgreSQL integration tests with Flyway migrations.

Maven Surefire loads Mockito as an explicit Java agent during tests so newer JDKs do not depend on Mockito's deprecated dynamic self-attachment path.

## Code Map

| Path | Role |
| --- | --- |
| `backend/src/main/java/com/merhouse/web` | REST controllers |
| `backend/src/main/java/com/merhouse/service` | Domain and application services |
| `backend/src/main/java/com/merhouse/repository` | Spring Data repositories |
| `backend/src/main/java/com/merhouse/entity` | JPA entities and enums |
| `backend/src/main/java/com/merhouse/dto` | Request and response DTOs |
| `backend/src/main/java/com/merhouse/security` | Firebase token authentication support |
| `backend/src/main/resources/db/migration` | Flyway migrations |

## API Modules

- Authentication via Firebase Auth, current user, account settings, and self-service password change
- Access requests
- Tenant and user administration
- Inventory and warehouse inventory
- Orders, allocation, backorders, and imports
- Fulfillment allocations, exceptions, and shipments
- Merchant-warehouse relationships and inbound stock
- Operational details and timelines
- Service accountability, agreements, statements, SLA review, disputes, claims, and order imports
- Local notification action inbox, recipient-scoped delivery history, preferences, and app-shell unread summary
- Transactional outbox administration
