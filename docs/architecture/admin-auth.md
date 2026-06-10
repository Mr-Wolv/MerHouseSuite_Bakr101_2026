# Admin And Authentication Model

MerHouse uses stateless API authentication with signed access tokens, BCrypt password hashes, role-based authorization, and tenant-aware service checks.

## Roles

- `OWNER`: platform owner role with platform-admin management capabilities.
- `ADMIN`: platform operator role for tenant, user, relationship, and operational administration.
- `SUPPORT_ADMIN`: support role for account and operational assistance. Support admins can review user context and reset supported user passwords, but they cannot enable, disable, create, or change roles for platform accounts.
- `AUDITOR`: read-only platform review role.
- `MERCHANT`: merchant tenant user.
- `WAREHOUSE_OPERATOR`: warehouse-provider tenant user.

## Authentication Flow

1. `POST /api/v1/auth/login` validates email and password.
2. The API returns a signed bearer token and the current user summary.
3. Clients send `Authorization: Bearer <token>` for authenticated API calls.
4. `GET /api/v1/auth/me` returns the current active user.
5. `PATCH /api/v1/auth/me/password` lets the signed-in user change their own password after current-password verification.

Access tokens include user id, tenant id, email, role, issue time, and expiration.

Self-service account settings do not change email, role, tenant, enabled state, or token lifetime. Platform account governance remains under `/api/v1/admin/users`.

Admin user-management routes separate support from mutation: owner/admin roles can create users, enable or disable accounts, and change roles; support-admin can perform supported password resets; auditor stays read-only. Relationship governance follows the same platform-mutation boundary for suspend, reactivate, and end actions. Outbox diagnostics also follow the split: owner/admin users can process, retry, and dead-letter outbox events, while support-admin and auditor users see review/escalation attention language and read-only diagnostics.

Admin account and governance forms normalize copied text before validation and audit capture. User emails, tenant names, warehouse names and addresses, and action reasons trim surrounding whitespace. Password and temporary reset password values remain exact.

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
