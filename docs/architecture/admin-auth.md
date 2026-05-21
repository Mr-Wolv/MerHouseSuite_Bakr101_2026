# Admin And Authentication Model

MerHouse uses stateless API authentication with signed access tokens, BCrypt password hashes, role-based authorization, and tenant-aware service checks.

## Roles

- `OWNER`: platform owner role with platform-admin management capabilities.
- `ADMIN`: platform operator role for tenant, user, relationship, and operational administration.
- `SUPPORT_ADMIN`: support role for account and operational assistance.
- `AUDITOR`: read-only platform review role.
- `MERCHANT`: merchant tenant user.
- `WAREHOUSE_OPERATOR`: warehouse-provider tenant user.

## Authentication Flow

1. `POST /api/v1/auth/login` validates email and password.
2. The API returns a signed bearer token and the current user summary.
3. Clients send `Authorization: Bearer <token>` for authenticated API calls.
4. `GET /api/v1/auth/me` returns the current active user.

Access tokens include user id, tenant id, email, role, issue time, and expiration.

## Runtime Configuration

The backend reads authentication settings from environment variables:

| Variable | Purpose |
| --- | --- |
| `MERHOUSE_AUTH_JWT_SECRET` | HMAC signing secret |
| `MERHOUSE_AUTH_JWT_EXPIRES_SECONDS` | Access-token lifetime |
| `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN` | Local recovery-token echo switch |
| `MERHOUSE_AUTH_SEED_ADMIN_ENABLED` | Local owner seeding switch |
| `MERHOUSE_AUTH_SEED_ADMIN_EMAIL` | Local owner email |
| `MERHOUSE_AUTH_SEED_ADMIN_PASSWORD` | Local owner password |
| `MERHOUSE_DEPLOYMENT_PUBLIC` | Enables stricter startup validation |

## Startup Safety Checks

When `MERHOUSE_DEPLOYMENT_PUBLIC=true`, startup validates that deployment-shaped authentication and database settings are configured, local account seeding is off, recovery-token echoing is off, and Swagger UI is not exposed through the application.
