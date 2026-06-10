# Production Deployment Activation

MerHouse can move from local-certified project to deployed service only through an explicit V17 activation. V16.2 proves that the codebase, docs, scripts, browser workflows, native Android wrapper, local performance checks, and public-readiness boundaries are coherent. V17 is the separate work of choosing infrastructure, replacing local-only providers, operating production data safely, and proving the deployed system in a staging or production-like environment.

## Activation Boundary

Do not describe MerHouse as production deployed until this page has concrete values, proof links, and owners for the deployment target being used.

V17 must not rely on local defaults:

- no seeded owner account in public environments
- no recovery-token echo
- no public Swagger UI unless deliberately protected
- no local-only provider claims for email, SMS, phone OS push, lock-screen, notification-tray, webhooks, carrier dispatch, monitoring, backup, or incident response
- no checked-in runtime secrets, provider credentials, deployment logs, or environment files

`MERHOUSE_DEPLOYMENT_PUBLIC=true` is the production-shaped startup mode. Production activation must prove it is enabled in the deployed backend environment.

## Required Decisions

Before implementation begins, choose and document:

| Decision | Required outcome |
| --- | --- |
| Hosting target | VPS/Compose, managed containers, platform app service, or Kubernetes. Prefer the simplest target that can run the backend, frontend, TLS, and background/runtime checks reliably. |
| Database | Managed PostgreSQL or explicitly operated PostgreSQL with backup, restore, migration, and retention procedures. |
| Domain and TLS | Public HTTPS frontend origin, API origin or reverse-proxy path, certificate ownership, redirect policy, and allowed CORS origins. |
| Secrets | Secret manager or deployment environment-variable system for database password, JWT signing secret, provider credentials, and admin bootstrap material. |
| Admin bootstrap | How the first owner account is created without keeping seed credentials enabled in production. |
| Notification and recovery delivery | Provider-backed email decision, callback/bounce handling, and local-record mapping. Gmail or another mail provider may be used for proof, but credentials must be externalized. Android OS notification delivery is not part of the current activation target. |
| Carrier/provider handoff | Keep local-only carrier records, or implement provider adapters with idempotent callbacks and retry policy. |
| Observability | Logs, metrics, error tracking, uptime checks, alerts, and incident owner. |
| Backup and restore | Backup schedule, restore drill, retention, and rollback owner. |
| Mobile release | Whether Android remains local-debug proof or moves to signed app-store/internal distribution. |
| Capacity target | Expected tenants, users, orders, inventory records, notification volume, provider exchanges, and peak concurrent sessions for the first production release. |
| Cross-platform release policy | Supported desktop browsers, mobile browser sizes, Android distribution channel, version compatibility, and rollback behavior across web and mobile clients. |

## Professional Product Bar

Production means MerHouse is operated as a real service, not just hosted somewhere public.

The deployment plan must cover:

- performance budgets for page loads, route readiness, API response timing, background job latency, and large-record workflows
- load and soak proof for expected concurrent users, bursty operational work, and scheduled/background processing
- data integrity under concurrent merchant, warehouse, platform, notification, outbox, and service-accountability actions
- provider exchanges for email, carrier or external integrations, monitoring, and any future agent/model provider, including retries, idempotency, callbacks, error states, quotas, and rate limits
- cross-platform proof across desktop web, mobile web viewport behavior, and the Android release channel chosen for production or internal distribution
- accessibility, copy clarity, empty/error/loading states, and denied-state behavior for every supported stakeholder role
- security hardening for secrets, CORS, TLS, headers, auth/session behavior, audit trails, least-privilege database access, and public admin surfaces
- operational readiness for logs, metrics, traces where useful, alert routing, incident response, maintenance windows, support handoff, and customer-visible status communication
- lifecycle operations for migrations, backup/restore drills, rollback, seed/bootstrap shutdown, provider-key rotation, dependency updates, and vulnerability response
- documentation that lets a new operator deploy, verify, monitor, recover, and explain the current production state without relying on private chat history

If a capability is deliberately not production-grade in the first deployment, it must be labeled as disabled, local-only, beta, or later-phase work in the product surface, roadmap, and affected architecture docs.

## Staging First

Production activation should start with staging. Staging must use the same deployment shape as production, but may use fake provider credentials and non-production domains.

Minimum staging proof:

```powershell
.\scripts\quality\public-readiness.ps1 -SkipCompose
.\scripts\quality\markdown-check.ps1
.\scripts\quality\api-smoke.ps1 -BaseUrl "https://<staging-api-or-frontend-origin>"
.\scripts\quality\frontend-full-tour.ps1 -BaseUrl "https://<staging-frontend-origin>" -ApiUrl "https://<staging-api-or-frontend-origin>"
.\scripts\quality\performance-readiness.ps1 -IncludeApiSmoke -ApiBaseUrl "https://<staging-api-or-frontend-origin>"
```

Staging must also include a production-shaped load and operations rehearsal before the production claim:

- browser and API smoke against seeded-but-realistic role data
- concurrent-user smoke for owner/admin, merchant, warehouse, support-admin, and auditor sessions
- provider failure rehearsal for email or any enabled external exchange
- migration rehearsal from an empty database and from a staging snapshot
- backup restore drill into a separate environment
- rollback rehearsal for the deployed frontend, backend, and database migration posture

If the Android app is part of the release claim, assemble the native shell against the staging API URL and run an installed-app tour on the staging backend:

```powershell
.\scripts\quality\native-mobile-check.ps1 -Assemble -ApiBaseUrl "https://<staging-api-origin>"
.\scripts\quality\native-android-tour.ps1 -ApiUrl "https://<staging-api-origin>"
```

## Production Cutover Proof

Before public production use, record:

- deployed commit SHA
- hosting target and region
- frontend URL
- API URL
- database host class and backup policy, without secrets
- production environment flags, including `MERHOUSE_DEPLOYMENT_PUBLIC=true`
- initial owner bootstrap method and proof that seeding is disabled afterward
- provider configuration status for notification, recovery, carrier, monitoring, and backup
- capacity target and latest load/performance proof summary
- successful migration from an empty or staging-like database
- API smoke pass against production or a locked production smoke tenant
- browser route proof against production
- cross-platform proof for the supported browser/mobile/Android release surfaces
- manual live owner, merchant, warehouse, support-admin, and auditor walkthrough
- rollback procedure and the proof that it was rehearsed

## Production Acceptance Bar

V17 is complete only when:

- production deploy and rollback are repeatable from documented steps
- secrets are externalized and rotated outside Git
- CORS, HTTPS, Swagger exposure, seed admin, recovery token echo, and public startup validation match the production boundary
- database backup and restore have been proven
- provider-backed delivery either works with evidence or remains explicitly disabled and labeled as local/in-app only
- monitoring and alerting detect API health, frontend reachability, backend errors, and failed background delivery/dispatch work
- capacity, load, soak, provider-exchange, and cross-platform proof meet the documented first-release target
- API smoke, frontend route proof, performance readiness, and live stakeholder walkthrough pass against the deployed environment
- remaining limitations are recorded in the roadmap, this page, or the affected architecture doc

## Current Status

As of 2026-06-10, V17 has not been activated. MerHouse is ready to start production deployment work, but no hosting target, domain, secret manager, provider contracts, production database, monitoring stack, backup procedure, rollback runbook, capacity target, load proof, provider-exchange proof, or app-store/internal mobile release process has been selected in tracked docs.
