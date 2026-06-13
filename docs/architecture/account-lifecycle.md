# Account Lifecycle

MerHouse account workflows cover platform-created users, public access requests, disabled-account behavior, and password recovery.

Public account-entry fields normalize copied whitespace before validation. Login, password-reset request, and public access-request email fields trim surrounding spaces before `@Email` validation; organization names and access-request notes also trim surrounding spaces. Password and new-password values are not trimmed.

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
4. Confirmation trims surrounding whitespace from the submitted reset token, validates the token, updates the password hash, and marks the token as used. The new password value is not trimmed; only the copy/paste token boundary is normalized.

Expired, used, missing, disabled-user, and invalid tokens produce the same invalid-or-expired result.

Enabled-user reset requests are throttled per account using `MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT` inside the rolling `MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES` window. Over-limit requests return the same generic public response and do not create another token or delivery record, preserving account-enumeration safety while limiting recovery traffic.

Enabled-user reset requests also create a local notification delivery history record for the requesting account. By default this record is local history only; it is not SMS, phone OS push, lock-screen, notification-tray, webhook, or provider delivery. When V17 SMTP email delivery is enabled, the same notification path records an email-channel provider attempt for the reset-link body.

The default local Docker stack keeps `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN=false`, so a browser user can request a reset and see the generic success message, but cannot complete the reset from the browser without a token supplied by another local proof path. To prove the complete request/confirm loop locally, set `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN=true`, rebuild or restart the backend, and run the API smoke test with `-ExpectRecoveryToken`. Production reset delivery remains a V17 real activation item.

V17 may replace the local proof path with email-delivered **OTP** or reset-link delivery through a configured mailbox/provider. The intended direction is email delivery, not Android OS push. Any Gmail or transactional-email setup must keep provider credentials out of Git, keep public token echo disabled, preserve token hashing/expiry/replay protection, and prove throttling, audit, provider failure, and recipient-scoped delivery behavior before production use.

### OTP Recovery (V17 Portfolio Feature B)

V17 introduces an OTP-based password recovery flow as a portfolio feature:

- `POST /api/v1/auth/recovery/request-otp` generates a 6-digit numeric OTP via `SecureRandom`, hashes it with SHA-256, stores it with a 15-minute TTL, and calls `EmailDeliveryService`.
- `POST /api/v1/auth/recovery/verify-otp` accepts email + OTP, returns a session token on success.
- `POST /api/v1/auth/recovery/reset-with-otp` accepts the session token + new password, resets the password hash.
- Throttling reuses existing `MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT` (5 per window).
- Replay protection: used OTPs are marked and rejected.
- Generic response for unknown emails is preserved.
- When `MERHOUSE_EMAIL_PROVIDER=log`, the OTP appears in the backend console for local demo.
- Audit trail: `adminAuditService.record()` for request, verification, and completion.

## Access Requests

Public access requests let prospective merchant or warehouse users ask for onboarding without creating an active account.

The public access-request form and API trim copied whitespace from organization name, requester email, and notes before validation and storage.

Pending duplicate requester emails are rejected before another record is stored. Repeated submissions for the same requester email are also bounded by `MERHOUSE_ACCESS_REQUEST_LIMIT` inside the rolling `MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS` window, so public onboarding can be exposed without turning accidental retries into an unbounded review queue.

Access requests start as `PENDING`. Platform users can approve, reject, and convert approved requests into tenant and user records. Reviewed requests record reviewer, note, and review time. Conversion preserves that approval review trail; the conversion actor is recorded through the admin audit event rather than overwriting the reviewer attached to the original decision.

Converting an approved access request requires a temporary setup password and a nonblank conversion reason. It also creates a local notification delivery history record for the new user. Production account invitation delivery remains blocked until later real deployment activation.

V17 access-request activation may send account-ready or invitation email after approval/conversion. That work must preserve reviewer/converter audit, avoid checked-in setup credentials, and prove the recipient email path through staging before any public deployment claim.

### Auto-Activation (V17 Portfolio Feature A)

V17 introduces an `approveAndActivate` flow that combines approval and conversion into a single action:

- `POST /api/v1/access-requests/{id}/approve-and-activate` creates the tenant and user in one transaction.
- The tenant name is derived from the request's organization name.
- The user email is the requester's email; a random temporary password is auto-generated via `SecureRandom`.
- The user's role matches the `requestedRole` from the form.
- `NotificationService.recordForUser()` is called with `ACCOUNT_LIFECYCLE` topic.
- `EmailDeliveryService.send()` delivers the activation email when `MERHOUSE_EMAIL_ENABLED=true` or logs to console when `MERHOUSE_EMAIL_PROVIDER=log`.
- The existing `approve()` and `convert()` endpoints remain for backward compatibility.
- Full audit trail: `adminAuditService.record()` with `ACCESS_REQUEST_APPROVED_AND_ACTIVATED` action.
