# Admin And Authentication Model

MerHouse uses Firebase Auth for authentication, BCrypt password hashes for local credential storage, role-based authorization, and tenant-aware service checks.

## Roles

- `OWNER`: platform owner role with platform-admin management capabilities.
- `ADMIN`: platform operator role for tenant, user, relationship, and operational administration.
- `SUPPORT_ADMIN`: support role for account and operational assistance. Support admins can review user context and reset supported user passwords, but they cannot enable, disable, create, or change roles for platform accounts.
- `AUDITOR`: read-only platform review role.
- `MERCHANT`: merchant tenant user.
- `WAREHOUSE_OPERATOR`: warehouse-provider tenant user.

## Authentication Flow

Firebase Auth is the only authentication path. All users authenticate through Firebase:

1. **Frontend:** `signInWithEmailAndPassword` (Firebase SDK) authenticates against Firebase Auth.
2. **Backend:** `FirebaseTokenFilter` verifies the Firebase ID token from the `Authorization: Bearer` header using the Firebase Admin SDK.
3. The backend looks up the user by email to get tenant and role information.
4. `GET /api/v1/auth/me` returns the current active user.
5. `PATCH /api/v1/auth/me/password` lets the signed-in user change their own password after current-password verification.

> Custom JWT authentication has been removed. Firebase is the sole authentication path.

The Firebase Admin SDK is always initialized on startup. In local development the Firebase Auth emulator (port 9099) is used automatically when `FIREBASE_EMULATOR_HOST` is set. In production, the SDK uses either a service-account JSON (`FIREBASE_SERVICE_ACCOUNT_JSON`) or Application Default Credentials.

Self-service account settings do not change email, role, tenant, enabled state, or token lifetime. Platform account governance remains under `/api/v1/admin/users`.

Admin user-management routes separate support from mutation: owner/admin roles can create users, enable or disable accounts, and change roles; support-admin can perform supported password resets; auditor stays read-only. Relationship governance follows the same platform-mutation boundary for suspend, reactivate, and end actions. Outbox diagnostics also follow the split: owner/admin users can process, retry, and dead-letter outbox events, while support-admin and auditor users see review/escalation attention language and read-only diagnostics.

Admin account and governance forms normalize copied text before validation and audit capture. User emails, tenant names, warehouse names and addresses, and action reasons trim surrounding whitespace. Password and temporary reset password values remain exact.

## Runtime Configuration

The backend reads authentication settings from environment variables:

| Variable | Purpose |
| --- | --- |
| `FIREBASE_AUTH_ENABLED` | Must be `true` (default). Firebase Auth is the only authentication path. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Production service-account JSON for Firebase Admin SDK. |
| `FIREBASE_PROJECT_ID` | Firebase project ID. |
| `FIREBASE_EMULATOR_HOST` | Firebase Auth emulator host for local development. |
| `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN` | Local recovery-token echo switch |
| `MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT` | Per-account reset-request throttle limit |
| `MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES` | Reset-request throttle window |
| `MERHOUSE_ACCESS_REQUEST_LIMIT` | Per-email public access-request throttle limit |
| `MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS` | Public access-request throttle window |
| `MERHOUSE_AUTH_SEED_ADMIN_ENABLED` | Local owner seeding switch |
| `MERHOUSE_AUTH_SEED_ADMIN_EMAIL` | Local owner email |
| `MERHOUSE_AUTH_SEED_ADMIN_PASSWORD` | Local owner password |
| `MERHOUSE_DEPLOYMENT_PUBLIC` | Enables stricter startup validation |

## Startup Safety Checks

When `MERHOUSE_DEPLOYMENT_PUBLIC=true`, startup validates that deployment-shaped authentication and database settings are configured, local account seeding is off, recovery-token echoing is off, recovery and access-request throttling are bounded, and Swagger UI is not exposed through the application.
