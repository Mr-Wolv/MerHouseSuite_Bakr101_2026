# V17 External Service Activation

This note records the external-service layer MerHouse activates during the private V17 deployed lane. Private V17 deployment exists, but this is not a public production claim until sanitized service proof and cutover evidence are complete.

V17 should finish as a simple deployed release before adding more product surface. Email is the real external service target for the first deployment. Android OS notifications, push providers, and autonomous agent mutations are out of scope. A future AI assistant could be designed as a backend-mediated prototype that reads authorized context and suggests next steps, but it cannot perform operational work until a later tool-authorization release is designed, tested, audited, and proven.

> **Deployment status update:** The private V17 deployment is **confirmed live** on Neon PostgreSQL, Hugging Face Docker Space, and GitHub Actions CI/CD. The three V17 portfolio features are implemented: Access Request & Approve-and-Activate, Password Recovery (via Firebase Auth), and the How To Use Page. The OTP-specific password recovery flow was removed; Firebase Auth handles password-reset email delivery via built-in email templates. AI Assistant Completion is deferred to Vinfinite.

V16.2 kept account recovery, access-request conversion, and notifications local and auditable. V17 extends those boundaries with real external services only after staging proof, provider credentials, secrets handling, monitoring, and rollback are ready. The AI Assistant (deterministic read-plus-draft) was removed from the codebase and deferred to Vinfinite.

## Service Targets

| Service | Current V16.2 behavior | V17 target |
| --- | --- | --- |
| Password recovery | Local one-time reset-token proof with generic public responses and optional development token echo. Firebase Auth handles password-reset email delivery via built-in email templates. | Firebase Auth built-in email templates for password reset; token hashing, expiry, replay protection, rate limits, audit records in place. |
| Sign up | Direct registration creates tenant + user immediately. No admin approval flow. | Account is active on creation. Firebase Auth handles login. |
| Notifications | Recipient-scoped in-app records, delivery history, preferences, and app-shell alert counts. | In-app records only (no SMTP provider connected). Android OS push, lock-screen, and notification-tray delivery are not part of the current target. |
| Agent | Removed from codebase. | Deferred to Vinfinite. |

## Gmail And Email Direction

The initial real delivery direction is email, not phone OS notifications.

Before a production/public service claim, choose whether MerHouse uses:

- a dedicated Gmail/Google Workspace mailbox for development or early staging proof
- a transactional email provider for production-shaped sending
- both, with Gmail limited to non-production proof and a transactional provider for production

Tracked configuration must stay provider-neutral where possible:

- SMTP/API credentials live only in environment variables or a secret manager.
- Sender address, reply-to address, allowed origins, and callback URLs are deployment configuration.
- Bounce, rejection, quota, and delivery-status behavior must be represented in delivery records or provider logs.
- Public environments must keep recovery token echo disabled.

The first implementation uses SMTP configuration and is safe by default:

- `MERHOUSE_EMAIL_ENABLED=false` keeps local behavior unchanged.
- When enabled, MerHouse records a second email-channel delivery attempt alongside the in-app alert.
- Sent, failed, skipped-by-preference, provider-message, provider-error, attempted, sent, failed, and retry-count evidence is stored on notification delivery records.
- Public startup validation rejects enabled email delivery when sender, external SMTP host, SMTP username, or private SMTP credential values are missing.
- Password reset requests are throttled per enabled account by `MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT` inside `MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES`; over-limit requests keep the generic public response and do not create another token or delivery.
- Public access requests reject duplicate pending requester emails and are throttled per requester email by `MERHOUSE_ACCESS_REQUEST_LIMIT` inside `MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS`; over-limit submissions are rejected before another review record is created.

This works in the selected managed lane as long as the Hugging Face backend has outbound SMTP access and public links use the Firebase Hosting frontend URL. The host location does not change the email delivery contract: MerHouse sends through SMTP, stores provider attempt evidence, and users follow HTTPS links back through the configured frontend. Gmail/Google Workspace SMTP is only a sending provider here. Sign in with Google is not included in that SMTP work; it is a separate OAuth/OpenID Connect login feature and should not be claimed until redirect URIs, credentials, UI/backend flow, tests, and live proof are implemented.

## Notification Policy

MerHouse should send email notifications only when the recipient, topic, and channel are allowed.

Initial email-capable topics:

- account lifecycle: password recovery and account-ready invitation
- access-request review or conversion outcomes
- operational handoffs that already create routed local alert records
- service-accountability work that already creates routed local alert records
- outbox-health alerts for platform operators

Native Android OS notifications, lock-screen alerts, notification-tray delivery, and push-provider rollout are intentionally scratched from this service target. The Android app may continue to show the shared in-app Alerts surface through the existing frontend shell.

## Agentic Work Direction

The deterministic read-plus-draft AI Assistant was removed from the codebase and is deferred to Vinfinite. Any future real MerHouse agent must remain backend-mediated. A later provider-backed or tool-enabled agent can plan and call tools only through approved backend APIs; it must not connect directly to the database, bypass role/tenant authorization, or silently mutate operational records.

Required shape for a future agent:

```text
user -> frontend -> backend -> agent service/model runtime
                           -> backend-approved tool APIs
                           -> audit/database
```

## V17 Proof Bar

Do not call these services activated until proof exists for:

- provider credentials externalized and absent from Git
- public startup validation with `MERHOUSE_DEPLOYMENT_PUBLIC=true`
- capacity and rate-limit targets for recovery, access-request, notification, and agent/tool traffic
- password recovery email with no public token echo
- access-request approval or conversion email in staging
- notification preference enforcement for email sends
- recipient scoping and tenant boundaries
- provider failure, retry, skipped-by-preference, and bounce/error handling
- concurrent delivery and duplicate-submit proof for high-traffic account and notification paths
- agent authorization, audit, and no-mutation behavior (when an agent is implemented)
- browser proof and API smoke against the staging target
- load/performance proof against production-shaped seeded data and expected first-release user volume
- updated diagrams, roadmap, README, scripts, and affected tests

Until that proof exists against deployed staging or production targets, MerHouse remains privately deployed with default in-app delivery records and opt-in SMTP attempt plumbing. The deterministic read-plus-draft assistant prototype was removed from the codebase and is deferred to Vinfinite.
