# V17 External Service Activation

This note records the next service layer MerHouse may activate when the project moves beyond local certification. Private V17 implementation has begun, but this is not a current deployment claim.

V16.2 keeps account recovery, access-request conversion, notifications, and assistant behavior local and auditable. V17 may replace or extend those local boundaries with real external services after staging proof, provider credentials, secrets handling, monitoring, and rollback are ready.

## Service Targets

| Service | Current V16.2 behavior | V17 target |
| --- | --- | --- |
| Forgot password OTP | Local one-time reset-token proof with generic public responses and optional development token echo. | SMTP-delivered reset link through a configured mail provider, with token hashing, expiry, replay protection, rate limits, audit records, and no token echo in public environments. |
| Request access | Public request form plus platform review, approval, rejection, and local account-ready delivery history. | SMTP account-ready email after approval or conversion, with explicit reviewer/converter audit and no checked-in setup credentials. |
| Notifications | Recipient-scoped in-app records, delivery history, preferences, and app-shell alert counts. | Opt-in SMTP email notification attempts for configured topics, with provider status evidence. Android OS push, lock-screen, and notification-tray delivery are not part of this target unless a later roadmap change deliberately reopens them. |
| Agent | Deterministic local summaries, review-only suggestions, refusals, accept/reject decisions, and audit. | V17 v1 keeps deterministic read-plus-draft behavior behind a bounded runtime interface with scoped metadata and no operational mutations. Provider-backed reasoning or backend-approved tool execution is a later activation slice after authorization, approval, unavailable-state, audit, and live proof exist. |

## Gmail And Email Direction

The initial real delivery direction is email, not phone OS notifications.

Before implementation, choose whether MerHouse uses:

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

Any future real MerHouse agent must remain backend-mediated. The V17 v1 boundary is read-plus-draft only: the runtime may summarize approved context, propose review plans, and record scoped metadata, but it cannot call mutation tools or change operational records. A later provider-backed or tool-enabled agent can plan and call tools only through approved backend APIs; it must not connect directly to the database, bypass role/tenant authorization, or silently mutate operational records.

Required shape:

```text
user -> frontend -> backend -> agent service/model runtime
                           -> backend-approved tool APIs
                           -> audit/database
```

Current V17 v1 slice:

- read authorized operational context for one role and tenant
- propose a concrete plan with cited source records
- record runtime metadata including `agentMode`, optional `agentModelName`, `agenticWork=read-plus-draft`, `mutationPolicy`, and refusal path
- fall back to deterministic triage or an unavailable state when the model/runtime is unavailable

V17 v1 records `agentMode`, `agentModelName`, `agenticWork=read-plus-draft`, and `mutationPolicy` metadata on assistant interactions. This is the first bounded runtime seam; operational mutation remains out of scope until a later explicit tool-authorization slice.

Current V17 deployment safety accepts only `MERHOUSE_AGENT_MODE=deterministic` and a timeout from 1 to 60 seconds. Any non-deterministic mode must be rejected by startup validation and `scripts/deploy/env-audit.ps1` until a provider/runtime adapter, unavailable-state behavior, authorization tests, audit proof, and live staging proof exist.

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
- read-plus-draft agent authorization, refusal, audit, deterministic fallback metadata, and no-mutation behavior
- model/provider unavailable behavior before any non-deterministic or tool-enabled agent mode is allowed
- browser proof and API smoke against the staging target
- load/performance proof against production-shaped seeded data and expected first-release user volume
- updated diagrams, roadmap, README, scripts, and affected tests

Until that proof exists against staging and production targets, MerHouse remains locally certified with default local delivery records, opt-in SMTP attempt plumbing, and deterministic read-plus-draft assistant behavior.
