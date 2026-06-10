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

The first V17 implementation target is VPS + Docker Compose:

- `deploy/vps/compose.production.yml` runs PostgreSQL, backend, and frontend with public startup validation enabled.
- the production Compose shape includes PostgreSQL, backend HTTP readiness, and frontend shell healthchecks.
- `deploy/vps/env.production.example` documents required runtime values without secrets.
- `deploy/vps/reverse-proxy.nginx.conf` is the public TLS reverse-proxy template.
- `scripts/deploy/env-audit.ps1` audits private env files before deployment without printing secret values.
- `scripts/deploy/reverse-proxy-check.ps1` validates the public nginx template for HTTPS redirect, TLS protocol, security headers, API-doc blocking, forwarded HTTPS headers, and loopback frontend proxying.
- `scripts/deploy/vps-check.ps1` validates the Compose shape before rollout without forcing private env files back to template throttle defaults.
- `scripts/deploy/deploy-vps.ps1` applies the VPS Compose stack only from a private env file after explicit confirmation, optional backup, optional pull, and optional build.
- `scripts/deploy/bootstrap-owner.ps1` creates the first deployed owner only after explicit confirmation, strict env audit, Compose shape proof, and a guard that no enabled owner exists; it does not enable public seed-admin startup.
- `scripts/deploy/backup-postgres.ps1`, `restore-postgres.ps1`, and `rollback-compose.ps1` define the first operations hooks. Backup, restore, and direct rollback refuse the example env template, run strict env audit, and validate the Compose shape before touching the selected deployment stack.
- `scripts/deploy/backup-restore-drill.ps1` records a guarded restore drill manifest for staging or drill environments.
- `scripts/deploy/rollback-drill.ps1` records a guarded rollback rehearsal manifest after env audit, Compose shape proof, confirmed rollback/up, and optional deployed monitoring samples.
- `scripts/quality/native-android-release-shape-check.ps1` statically verifies that the Android release build disables cleartext traffic and sources signing from external environment variables without hardcoded keystore material.
- `scripts/quality/deployed-monitoring-proof.ps1` samples deployed frontend and API health repeatedly with latency budgets.
- `scripts/quality/deployed-v17-proof.ps1` runs deployed frontend/API proof against explicit public URLs after rollout and writes a sanitized deployment evidence manifest.

Minimum staging proof:

```powershell
.\scripts\quality\public-readiness.ps1 -SkipCompose
.\scripts\quality\markdown-check.ps1
.\scripts\deploy\reverse-proxy-check.ps1
.\scripts\quality\api-smoke.ps1 -BaseUrl "https://<staging-api-or-frontend-origin>"
.\scripts\quality\deployed-monitoring-proof.ps1 -FrontendBaseUrl "https://<staging-frontend-origin>" -ApiBaseUrl "https://<staging-api-origin>"
.\scripts\quality\frontend-full-tour.ps1 -BaseUrl "https://<staging-frontend-origin>" -ApiUrl "https://<staging-api-or-frontend-origin>"
.\scripts\quality\performance-readiness.ps1 -IncludeApiSmoke -ApiBaseUrl "https://<staging-api-or-frontend-origin>"
.\scripts\quality\load-smoke.ps1 -BaseUrl "https://<staging-api-or-frontend-origin>" -ConcurrentUsers 25 -RequestsPerUser 8
.\scripts\quality\deployed-v17-proof.ps1 `
  -FrontendBaseUrl "https://<staging-frontend-origin>" `
  -ApiBaseUrl "https://<staging-api-origin>" `
  -DeploymentLabel "staging-v17" `
  -ProviderStatus "smtp-staging-configured" `
  -AdminEmail "<staging-owner-email>" `
  -AdminPassword "<staging-owner-password>" `
  -MerchantEmail "<staging-merchant-email>" `
  -MerchantPassword "<staging-merchant-password>" `
  -WarehouseEmail "<staging-warehouse-email>" `
  -WarehousePassword "<staging-warehouse-password>" `
  -SupportAdminEmail "<staging-support-email>" `
  -SupportAdminPassword "<staging-support-password>" `
  -AuditorEmail "<staging-auditor-email>" `
  -AuditorPassword "<staging-auditor-password>" `
  -IncludeLoadSmoke `
  -IncludeBrowserTour
```

`load-smoke.ps1` writes a sanitized JSON proof report with target URL, budgets, aggregate timing, failure count, and per-request records. When `deployed-v17-proof.ps1 -IncludeLoadSmoke` is used, the deployment evidence manifest links to that load-smoke report so load proof is not terminal-only.

`deployed-v17-proof.ps1` requires explicit staging or production smoke credentials and rejects local demo values. The owner credential is required for API smoke; role-specific stakeholder credentials are required when the deployed browser tour is included.

When signed Android release, installed Android tour, backup restore drill, rollback rehearsal, provider-backed email proof, alert-routing proof, or final live stakeholder walkthrough proof has already run, pass those generated JSON paths through `-AndroidReleaseManifestPath`, `-InstalledAndroidTourReportPath`, `-BackupRestoreManifestPath`, `-RollbackManifestPath`, `-EmailProviderProofManifestPath`, `-AlertRoutingManifestPath`, and `-LiveStakeholderWalkthroughManifestPath`. The deployed evidence manifest validates and records each attached artifact path plus its expected proof schema; Android release `apiBaseUrl`, installed Android tour `apiUrl`, rollback post-monitoring URLs, email-provider `apiBaseUrl`/`frontendBaseUrl`/`providerStatus`, alert-routing `apiBaseUrl`/`frontendBaseUrl`, and live walkthrough `apiBaseUrl`/`frontendBaseUrl` must match the deployed targets before those items can clear `nextRequiredEvidence`. Android release evidence must also point to an existing APK/AAB whose SHA-256 digest, byte size, release cleartext policy, and external-keystore signing boundary match the sanitized release manifest. Installed Android tour evidence must prove the installed APK fingerprint, APK byte size, checked timestamp, connected device serials, checked route count, route records, and empty bad-record list against the same deployed API URL. Backup/restore evidence must prove env/Compose preflight, point to an existing backup file whose SHA-256 and byte size match the manifest, and report restore status as true. Rollback evidence must prove env/Compose preflight, rollback execution, secret-handling policy, and post-rollback monitoring against the same deployed frontend/API URLs; a rollback drill without monitoring is useful rehearsal output, but it does not clear V17 deployed or cutover rollback evidence. Email-provider evidence must prove password recovery, access-request/account-ready, and notification email workflows with per-workflow `SENT` provider statuses, delivery evidence, and a secret-handling policy. Alert-routing evidence must include routed signals, delivery evidence, and a secret-handling policy. Live walkthrough evidence must prove both browser and installed-Android walkthroughs across owner, merchant, warehouse, support-admin, and auditor roles. The manifest still records `productionClaim=false` until a deliberate cutover decision is made after reviewing remaining evidence.

Staging must also include a production-shaped load and operations rehearsal before the production claim:

- first-owner bootstrap through `scripts/deploy/bootstrap-owner.ps1`, followed by proof that `MERHOUSE_AUTH_SEED_ADMIN_ENABLED=false` remains in the deployed backend environment
- browser and API smoke against seeded-but-realistic role data
- concurrent-user smoke for owner/admin, merchant, warehouse, support-admin, and auditor sessions
- provider failure rehearsal for email or any enabled external exchange
- migration rehearsal from an empty database and from a staging snapshot
- backup restore drill into a separate environment
- rollback rehearsal for the deployed frontend, backend, and database migration posture

The restore drill command is destructive and must target staging or a dedicated drill environment:

```powershell
.\scripts\deploy\backup-restore-drill.ps1 -EnvFile ".env.staging" -OutputDirectory ".\reports" -ConfirmDrill
```

The drill writes a sanitized `v17-restore-drill-*.json` manifest with commit SHA, env/Compose preflight status, host-copied backup path, backup SHA-256, byte size, env file name only, and restore status. Direct backup output defaults under ignored `reports/backups/` unless an operator supplies an explicit external path, so database archives do not become public repository material by accident.

The rollback rehearsal command is also deployment-changing and must target staging, a drill environment, or an explicitly selected production rollback window:

```powershell
.\scripts\deploy\rollback-drill.ps1 -EnvFile ".env.staging" -FrontendBaseUrl "https://<staging-frontend-origin>" -ApiBaseUrl "https://<staging-api-origin>" -ConfirmRollbackDrill
```

For a local production-shaped rehearsal on `127.0.0.1` only, pass `-AllowLocalHttpRehearsal` with the HTTP loopback URLs. Do not use that switch for staging or production claims.

The rollback drill writes a sanitized `v17-rollback-rehearsal-*.json` manifest with commit SHA, Compose path, env file name only, env/Compose preflight status, rollback status, optional monitoring report path, and the remaining live proof required before declaring rollback readiness. Direct `rollback-compose.ps1` runs also refuse the example env template and repeat strict env audit plus Compose shape validation before changing the selected deployment stack.

If the Android app is part of the release claim, assemble the native shell against the staging API URL and run an installed-app tour on the staging backend:

```powershell
.\scripts\quality\native-mobile-check.ps1 -Assemble -ApiBaseUrl "https://<staging-api-origin>"
.\scripts\quality\native-android-tour.ps1 -ApiUrl "https://<staging-api-origin>"
.\scripts\quality\native-android-release-check.ps1 -ApiBaseUrl "https://<staging-api-origin>" -Bundle -OutputPath ".\reports\v17-android-release.json"
```

The default V17 preflight runs the Android release-shape check without needing signing secrets. That check also rejects Google/Firebase provider hooks while native OS push remains out of V17 scope. The signed release check requires external keystore and version environment variables, then writes a sanitized Android release manifest with commit SHA, API URL, artifact kind/path, SHA-256, byte size, version code, version name, cleartext policy, and external-keystore signing boundary. Keep the manifest with deployment evidence; keep keystores outside Git.

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

`deployed-v17-proof.ps1` writes a sanitized `v17-deployment-evidence-*.json` manifest that covers the deployed commit SHA, public frontend/API URLs, proof-output paths, included proof slices including monitoring samples and optional load-smoke report, provider-status label, attached sibling proof schemas, `productionClaim=false`, and remaining required evidence. Provider status remains conservative: configured-only labels keep provider-backed recovery, access-request, and notification email proof in `nextRequiredEvidence`; proven provider labels require a matching `merhouse.v17.email-provider-proof.v1` attachment, while an explicit `email-disabled-by-policy` label closes that evidence item as a deliberate no-provider policy. Backup/restore and rollback readiness are also attachment-driven: schema alone is not enough, because the wrapper checks restore status, backup hash and byte size, rollback preflight, rollback execution, post-rollback monitoring proof, and deployed target URLs before those items can close. Alert-routing and live stakeholder walkthrough readiness are also attachment-driven: health samples alone do not close alert routing, and scripted tours alone do not close the live reviewer walkthrough. The wrapper validates that deployed proof credentials were passed explicitly and are not the local demo defaults, but it never records those credentials in the manifest. Keep the manifest with release proof artifacts; do not add secrets, private env files, provider credentials, deployment logs, or backup archives to Git.

`v17-cutover-readiness.ps1` validates the sanitized deployment evidence manifest after all sibling proof artifacts are attached. It fails if required proof is missing, `nextRequiredEvidence` is nonempty, provider status is only configured, proven provider status lacks a matching email-provider proof artifact, included proof output reports are missing or unreadable, API-smoke reports lack passed status, test-run provenance, API response evidence, or post-transaction table evidence, attached proof files are missing or unreadable, attached proof has the wrong schema or target URL, Android release artifact hashes/sizes/policies do not match, installed Android tour provenance is missing APK fingerprint, device, route, timestamp, or clean-record evidence, backup/restore preflight, hashes, or restore status do not match, rollback preflight/rollback/monitoring evidence is incomplete, email-provider proof lacks per-workflow evidence or `SENT` provider statuses for recovery, access-request/account-ready, or notification email, alert-routing proof lacks per-signal evidence for API health, frontend health, or failed provider delivery, required live-walkthrough fields are absent, or a manifest tries to set `productionClaim=true`. A passing cutover-readiness report means the evidence package is ready for a separate human production cutover decision; it is not itself a deployment, publication, or production claim.

## Production Acceptance Bar

V17 is complete only when:

- production deploy and rollback are repeatable from documented steps
- secrets are externalized and rotated outside Git
- CORS, HTTPS, Swagger/OpenAPI unavailability, seed admin, recovery token echo, and public startup validation match the production boundary
- database backup and restore have been proven
- provider-backed delivery either works with evidence or remains explicitly disabled and labeled as local/in-app only
- monitoring and alerting detect API health, frontend reachability, backend errors, and failed background delivery/dispatch work
- capacity, load, soak, provider-exchange, and cross-platform proof meet the documented first-release target
- API smoke, frontend route proof, performance readiness, and live stakeholder walkthrough pass against the deployed environment
- remaining limitations are recorded in the roadmap, this page, or the affected architecture doc

## Current Status

As of 2026-06-10, V17 is in private implementation on a deployment branch, not publicly deployed. The selected first target is VPS + Docker Compose with PostgreSQL, backend, frontend, container healthchecks, nginx/TLS template with public-edge hardening checks, public-mode startup validation, private env auditing, backup/restore drill manifests, rollback rehearsal manifests, rollback/deploy scripts, deployed proof wrappers, deployed monitoring samples, deployed-evidence attachment rule validation, cutover-readiness guard fixtures, opt-in SMTP email attempts, signed internal Android release proof, and `scripts/quality/v17-production-readiness.ps1` preflight.

The following remain required before any production claim: real VPS access, frontend/API domain values, TLS/certificate setup, deployment secret storage, Gmail or provider SMTP credentials for staging proof, production database credentials, Android signing keystore, monitoring/alerting configuration, deployed staging URL, deployed production URL, deployed backup restore drill, deployed rollback rehearsal, load/soak proof, live browser walkthrough, and live installed-Android walkthrough against the deployed target.
