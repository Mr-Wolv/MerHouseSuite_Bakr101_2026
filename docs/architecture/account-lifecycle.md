# Account Lifecycle

MerHouse account workflows cover platform-created users, public access requests, disabled-account behavior, and password recovery.

## User Creation

Platform users create accounts through the admin user API. Email addresses are normalized before storage, duplicate emails are rejected, and passwords are stored as BCrypt hashes.

User roles are tied to tenant type:

- Merchant users belong to merchant tenants.
- Warehouse operators belong to warehouse-provider tenants.
- Platform roles belong to platform administration.

New users start enabled.

## Account Settings

Authenticated users can review their account context at `/account` and change their own password through `PATCH /api/v1/auth/me/password`. The endpoint requires the current password and a valid new password. It does not allow self-service email, role, tenant, or enabled-state changes; those remain platform account-governance actions.

## Disabled Accounts

Disabled users cannot log in and cannot continue using existing access tokens. Request authentication resolves the persisted user record, so account status changes take effect after the account is disabled.

The backend preserves platform continuity by keeping at least one owner account enabled.

## Password Recovery

Password recovery uses a request and confirmation flow:

1. A reset request is submitted for an email address.
2. The response remains generic.
3. A one-time reset token is generated and stored as a hash.
4. Confirmation validates the token, updates the password hash, and marks the token as used.

Expired, used, missing, disabled-user, and invalid tokens produce the same invalid-or-expired result.

For V13, enabled-user reset requests also create a prototype-local notification delivery record for the requesting account. This record is local history only; it is not an email or provider delivery.

The default local Docker stack keeps `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN=false`, so a browser user can request a reset and see the generic success message, but cannot complete the reset from the browser without a token supplied by another local proof path. To prove the complete request/confirm loop locally, set `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN=true`, rebuild or restart the backend, and run the API smoke test with `-ExpectRecoveryToken`. Production reset delivery remains a V16 local certification and V17 real activation item.

## Access Requests

Public access requests let prospective merchant or warehouse users ask for onboarding without creating an active account.

Access requests start as `PENDING`. Platform users can approve, reject, and convert approved requests into tenant and user records. Reviewed requests record reviewer, note, and review time.

For V13, converting an approved access request also creates a prototype-local notification delivery record for the new user. Production account invitation delivery remains blocked until V16 local certification and any later real deployment activation.
