# Production Deployment Activation

MerHouse can move from local-certified project to deployed service only through an explicit V17 activation. V16.2 proves that the codebase, docs, scripts, browser workflows, native Android wrapper, local performance checks, and public-readiness boundaries are coherent. V17 is the separate work of choosing infrastructure, replacing local-only providers, operating production data safely, and proving the deployed system in a staging or production-like environment.

## Activation Boundary

Do not describe MerHouse as production deployed until this page has concrete values, proof links, and owners for the deployment target being used.

The V17 release should stay deliberately small: deploy the existing product professionally, prove the web/backend and signed Android release against real HTTPS targets, and move future hardening into CI/CD-backed bug hunting. Do not add new broad product scope to make deployment feel more complete. The agent is the one accepted prototype in V17: it may be useful read-plus-draft assistance, but it is not production autonomous automation, does not mutate operational records, and must keep deterministic fallback behavior until a later explicit provider/tool-authorization slice is designed and proven.

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

## Deployment Lanes

Use the selected lane for current V17 work. Other hosting lanes are VInfinite candidates unless a later deployment decision deliberately reopens them.

| Lane | When to use | What it proves | Limits |
| --- | --- | --- | --- |
| 1. Neon + Hugging Face Docker Space + Vercel + GitHub Release | Selected no-card V17 lane when the release needs a stable public HTTPS backend URL without an owned domain or local tunnel. Use Neon PostgreSQL, a Hugging Face Docker Space backend, Vercel React/Vite frontend, and signed APK assets attached to GitHub Releases. | Stable managed database, stable public backend/frontend URLs, frontend CI/CD, Docker backend deployment, signed Android API URL proof, live web/Android walkthrough, and a simple release artifact channel. | Free tiers can sleep, rebuilds are Space-repo driven, provider quotas apply, and operator-entered secrets still need explicit proof. Backup/restore, monitoring, and alert-routing proof still need evidence. |
| VInfinite candidate: Cloud Run managed container host | Reopen only if a single managed-container lane becomes simpler and billing setup is acceptable. | Stable Google-managed `run.app` HTTPS URL, machine-independent web/API availability, and a cleaner hosted target for Android release proof. | Requires Google Cloud project/billing setup, container deployment wiring, external database decision, budget alerts, and provider-specific operations proof. |
| VInfinite candidate: VPS/Compose or Oracle Cloud Always Free | Reopen only if the current managed path becomes unacceptable and an operator accepts VPS hardening work. | Full server control and closer operations rehearsal. | Requires VM hardening, TLS, backups, rollback, monitoring, patching, and ongoing server ownership. |
| VInfinite candidate: sponsored professional hosting | Reopen when budget exists for more durable operations. | Managed or professionally operated infrastructure, managed database/backups, observability, uptime, incident response, and a cleaner production claim. | Requires budget, sponsor decisions, vendor ownership, and a deliberate production operations plan. |

The earlier ngrok static dev-domain lane is no longer the selected release target. It proved useful for local reachability, but live browser/API behavior degraded enough that it should remain a temporary development tunnel only. Do not use ngrok proof as final V17 release evidence unless a future operator deliberately reopens that lane and records why the tunnel behavior is acceptable.

The selected first distribution posture is Neon plus Hugging Face Spaces plus Vercel plus a signed APK published through GitHub Releases. Firebase App Distribution can be added later for tester management, but it is not required for the first no-domain release channel. Earlier provider trials that required a card or exposed only temporary free URLs are not active deployment lanes. VPS/Compose, Oracle Cloud Always Free, Cloud Run, and sponsored professional hosting are VInfinite candidates, not current progress. Gmail/Google Workspace SMTP can still be proven later because email sending is outbound from the backend and links can return through the Vercel frontend URL.

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

The selected V17 implementation target is now provider-split managed hosting:

- Neon PostgreSQL hosts the deployment database. Use the Neon JDBC URL with `sslmode=require`; keep credentials in provider environment variables, provider secrets, or ignored private env files only.
- `deploy/managed/huggingface-backend/space-readme-template.md` and `deploy/managed/huggingface-backend/Dockerfile` define the Hugging Face Docker Space backend template, including `sdk: docker`, `app_port: 7860`, a self-contained `backend/` source copy in the Space repository, and runtime `SERVER_PORT=7860`.
- `deploy/managed/huggingface-backend/env.backend.example` documents the backend variables that must be filled in Hugging Face Space Settings after the Vercel frontend URL and Neon database URL are known.
- `frontend/vercel.json` sets the Vercel build command, output directory, and SPA fallback rewrite for the React Router app.
- `deploy/managed/vercel-frontend/env.frontend.example` documents the frontend `VITE_API_BASE_URL` value that points at the backend HTTPS origin.
- `scripts/deploy/huggingface-vercel-check.ps1` validates the Hugging Face/Vercel deployment shape locally before provider rollout.
- `backend/src/main/resources/application.properties` accepts platform `PORT` and `SERVER_PORT` environment variables while retaining the local fallback.
- signed Android release proof builds the APK against the Hugging Face backend URL and publishes the APK plus SHA-256 through GitHub Releases after live web/API proof passes.

- `scripts/proof/android/native-android-release-shape-check.ps1` statically verifies that the Android release build disables cleartext traffic and sources signing from external environment variables without hardcoded keystore material.
- `scripts/proof/release/deployed-monitoring-proof.ps1` samples deployed HTTPS frontend and API health repeatedly with latency budgets; local HTTP output is only allowed when explicitly marked as rehearsal.
- `scripts/proof/release/v17-email-provider-proof.ps1` writes the sanitized email-provider artifact only after explicit operator confirmation of provider-backed recovery, access-request/account-ready, and notification email delivery evidence.
- `scripts/proof/release/v17-alert-routing-proof.ps1` writes the sanitized alert-routing artifact only after explicit operator confirmation of API health, frontend health, and failed-provider-delivery alert evidence.
- `scripts/proof/release/v17-live-stakeholder-walkthrough-proof.ps1` writes the sanitized final live-review artifact only after the reviewer completes the real browser and installed-Android walkthroughs.
- `scripts/proof/release/deployed-v17-proof.ps1` runs deployed frontend/API proof against explicit public HTTPS URLs after rollout and writes a sanitized deployment evidence manifest.

Provider rollout order for the selected lane:

1. Create the Neon project/database and copy the PostgreSQL JDBC URL with `sslmode=require`.
2. Create the Vercel project from `frontend/` with `VITE_API_BASE_URL` temporarily set to the intended Hugging Face Space URL or a harmless placeholder. This first frontend deploy only establishes the stable Vercel URL.
3. Create the Hugging Face Docker Space, copy `deploy/managed/huggingface-backend/space-readme-template.md` as `README.md`, copy `deploy/managed/huggingface-backend/Dockerfile`, and copy the repository `backend/` directory into the Space repository, set the Neon JDBC URL, JWT secret, public deployment flags, and CORS/frontend values from the real Vercel URL in Space Settings, then deploy and confirm `/api/v1/health`.
4. Replace the Vercel `VITE_API_BASE_URL` value with the real Hugging Face backend URL and redeploy the frontend.
5. Bootstrap the first owner through a private operator path, then run deployed API smoke, live web browser review, signed APK build through the GitHub Release workflow, and installed Android live review.
6. Keep SMTP disabled until provider credentials are ready; when enabled, prove recovery, access request/account-ready, and notification email delivery with sanitized evidence only.

CI/CD becomes the ongoing bug-hunt engine after the first deployment. The release path should keep checks boring and repeatable: deploy, run smoke/monitoring/load/browser/mobile proof, personally tour the live web and installed Android app, fix real failures, rerun the matching proof, and only then broaden the gate if the failure shows a durable gap.

Live deployed behavior is the V17 priority. The reviewer must see the actual deployed browser and installed Android app behaving correctly across happy paths and unhappy paths; screenshots, JSON reports, and scripted tours are supporting records only. Do not add more test machinery or refactor product code just because a deployment-time test feels awkward. Change the app, scripts, or deployment shape only when the live tours expose a concrete defect, unsafe public boundary, missing rollback/ops proof, or repository-readiness issue.

Minimum staging proof:

```powershell
.\scripts\quality\v17-production-readiness.ps1
.\scripts\quality\public-readiness.ps1 -SkipCompose
.\scripts\quality\markdown-check.ps1
.\scripts\quality\api-smoke.ps1 -BaseUrl "https://<staging-api-or-frontend-origin>"
.\scripts\proof\release\deployed-monitoring-proof.ps1 -FrontendBaseUrl "https://<staging-frontend-origin>" -ApiBaseUrl "https://<staging-api-origin>"
.\scripts\proof\web\frontend-full-tour.ps1 -BaseUrl "https://<staging-frontend-origin>" -ApiUrl "https://<staging-api-or-frontend-origin>" -Coverage Deployment
.\scripts\proof\release\performance-readiness.ps1 -IncludeApiSmoke -ApiBaseUrl "https://<staging-api-or-frontend-origin>"
.\scripts\proof\release\load-smoke.ps1 -BaseUrl "https://<staging-api-or-frontend-origin>" -ConcurrentUsers 25 -RequestsPerUser 8
.\scripts\proof\release\deployed-v17-proof.ps1 `
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

`deployed-v17-proof.ps1` requires explicit public HTTPS frontend/API URLs plus explicit staging or production smoke credentials, and rejects local demo values. The owner credential is required for API smoke; role-specific stakeholder credentials are required when the deployed browser tour is included. Local HTTP targets remain valid for local development proof and explicit `-AllowLocalHttpRehearsal` rollback drills, but they cannot create deployed V17 evidence. Standalone deployed monitoring proof follows the same boundary: HTTPS is required unless the run is explicitly marked as local HTTP rehearsal. Backend public startup validation also requires an HTTPS public frontend origin, rejects wildcard CORS, and requires configured CORS origins to include the public frontend URL.

`v17-email-provider-proof.ps1` records a sanitized `merhouse.v17.email-provider-proof.v1` artifact after the operator has observed provider-backed delivery for password recovery, access-request/account-ready, and notification email workflows. It requires HTTPS targets, a proven provider-status label, explicit confirmation, and meaningful short non-secret evidence references; it rejects vague placeholders, copied tokens, OTPs, passwords, credential-shaped values, message bodies, provider logs, SMTP transcripts, email headers, message IDs, raw email content, and recipient/operator email addresses. Attach its output with `-EmailProviderProofManifestPath` only after the backend SMTP path and staging mailbox/provider evidence have already been exercised.

`v17-alert-routing-proof.ps1` records a sanitized `merhouse.v17.alert-routing.v1` artifact after the operator has observed alert routing for API health, frontend health, and failed-provider-delivery signals. It requires HTTPS targets, explicit confirmation, and meaningful short non-secret evidence references; it rejects vague placeholders, provider credentials, endpoints, webhooks, token-shaped values, copied alert payloads, webhook bodies, request/response bodies, delivery transcripts, provider logs, and recipient/operator email addresses. Attach its output with `-AlertRoutingManifestPath` only after deployed monitoring and alert routing have already been exercised.

`v17-live-stakeholder-walkthrough-proof.ps1` records a sanitized `merhouse.v17.live-stakeholder-walkthrough.v1` artifact after the reviewer completes the real browser and installed-Android walkthroughs. It requires HTTPS targets, explicit manual-live-review confirmation, reviewer identity/reference, and meaningful short non-secret evidence references for browser, installed Android, and stakeholder coverage; use reviewer initials or a ticket reference rather than a personal email address. It rejects vague placeholders, copied deployment/browser/Android logs, stack traces, console output, private URLs, screenshot data, and base64 payloads, writes non-blank manual evidence fields, `proofMode=manual-live-review`, and the required owner, merchant, warehouse, support-admin, and auditor coverage, but it does not run the walkthrough or replace the live reviewer session.

When signed Android release, installed Android tour, backup restore drill, rollback rehearsal, provider-backed email proof, alert-routing proof, or final live stakeholder walkthrough proof has already run, pass those generated JSON paths through `-AndroidReleaseManifestPath`, `-InstalledAndroidTourReportPath`, `-BackupRestoreManifestPath`, `-RollbackManifestPath`, `-EmailProviderProofManifestPath`, `-AlertRoutingManifestPath`, and `-LiveStakeholderWalkthroughManifestPath`. The deployed evidence manifest validates and records each attached artifact path plus its expected proof schema only after rejecting unredacted token/password-shaped values. The human-entered email-provider, alert-routing, and live-walkthrough artifacts also reject email-shaped PII; provider artifacts reject copied message bodies, provider logs, SMTP transcripts, headers, and message IDs; alert artifacts reject copied alert payloads, webhook bodies, request/response bodies, and delivery transcripts; live-walkthrough artifacts reject copied browser/Android logs, stack traces, console output, and screenshot data. Android release `apiBaseUrl`, installed Android tour `apiUrl`, rollback post-monitoring URLs, email-provider `apiBaseUrl`/`frontendBaseUrl`/`providerStatus`, alert-routing `apiBaseUrl`/`frontendBaseUrl`, and live walkthrough `apiBaseUrl`/`frontendBaseUrl` must match the deployed targets before those items can clear `nextRequiredEvidence`. Android release evidence must also point to an existing APK/AAB whose SHA-256 digest, byte size, commit SHA, release cleartext policy, and external-keystore signing boundary match the sanitized release manifest and deployed commit; the cutover path should use a signed APK artifact so installed Android tour evidence proves the same APK fingerprint and byte size, plus checked timestamp, connected device serials, checked route count, route records, and empty bad-record list against the same deployed API URL. Backup/restore and rollback evidence must prove the same deployed commit SHA, env/Compose preflight, secret-handling policy, and the expected operation result; backup/restore must point to an existing backup file whose SHA-256 and byte size match the manifest and report restore status as true, while rollback must prove execution plus post-rollback monitoring against the same deployed frontend/API URLs, including a timestamped monitoring report whose own frontend/API URLs match the rollback manifest, is not a local HTTP rehearsal, has passing sample records, and stays within its recorded frontend/API health budgets. A rollback drill without monitoring, or with failed/local-rehearsal monitoring, is useful rehearsal output, but it does not clear V17 deployed or cutover rollback evidence. Email-provider evidence must prove password recovery, access-request/account-ready, and notification email workflows with per-workflow `SENT` provider statuses, delivery evidence, and a secret-handling policy. Alert-routing evidence must include routed signals, delivery evidence, and a secret-handling policy. Live walkthrough evidence must prove both browser and installed-Android walkthroughs across owner, merchant, warehouse, support-admin, and auditor roles, include browser, installed-Android, and stakeholder-coverage manual evidence, and declare `proofMode=manual-live-review`; script-only tour output cannot close this requirement. The manifest still records `productionClaim=false` until a deliberate cutover decision is made after reviewing remaining evidence.

When both Android release and installed-tour proof are supplied, `deployed-v17-proof.ps1` rejects mismatched APK SHA-256 or byte size before writing deployment evidence, so a mismatched release/tour pair cannot be packaged as attached V17 evidence.

Staging must also include a production-shaped load and operations rehearsal before the production claim:

- first-owner bootstrap through a private operator path, followed by proof that `MERHOUSE_AUTH_SEED_ADMIN_ENABLED=false` remains in the deployed backend environment
- browser and API smoke against seeded-but-realistic role data
- concurrent-user smoke for owner/admin, merchant, warehouse, support-admin, and auditor sessions
- provider failure rehearsal for email or any enabled external exchange
- migration rehearsal from an empty database and from a staging snapshot
- backup restore drill into a separate environment
- rollback rehearsal for the deployed frontend, backend, and database migration posture

Backup/restore and rollback rehearsal for the current managed lane depend on provider-specific Neon, Hugging Face, and Vercel capabilities and remain open proof items until the managed operations path is implemented. VPS/Compose rollback and backup scripts are VInfinite work, not current V17 progress.

If the Android app is part of the release claim, assemble the native shell against the staging API URL and run an installed-app tour on the staging backend:

```powershell
.\scripts\proof\android\native-mobile-check.ps1 -Assemble -ApiBaseUrl "https://<staging-api-origin>"
.\scripts\proof\android\native-android-tour.ps1 -ApiUrl "https://<staging-api-origin>"
.\scripts\proof\android\native-android-release-check.ps1 -ApiBaseUrl "https://<staging-api-origin>" -FrontendUrl "https://<staging-frontend-origin>" -OutputPath ".\reports\v17-android-release.json"
```

The default V17 preflight runs the Android release-shape check without needing signing secrets. That check also rejects Google/Firebase provider hooks while native OS push remains out of V17 scope. The signed release check requires external keystore and version environment variables, then writes a sanitized Android release manifest with commit SHA, API URL, artifact kind/path, SHA-256, byte size, version code, version name, cleartext policy, and external-keystore signing boundary. The broad V17 readiness path builds an APK rather than an AAB so the installed Android walkthrough can match the signed release fingerprint. Keep the manifest with deployment evidence; keep keystores outside Git.

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

`deployed-v17-proof.ps1` writes a sanitized `v17-deployment-evidence-*.json` manifest that covers the deployed commit SHA, public frontend/API URLs, proof-output paths, included proof slices including monitoring samples and optional load-smoke report, provider-status label, attached sibling proof schemas, `productionClaim=false`, and remaining required evidence. Provider status remains conservative: configured-only labels keep provider-backed recovery, access-request, and notification email proof in `nextRequiredEvidence`; proven provider labels require a matching `merhouse.v17.email-provider-proof.v1` attachment, while an explicit `email-disabled-by-policy` label closes that evidence item as a deliberate no-provider policy. Backup/restore and rollback readiness are also attachment-driven: schema alone is not enough, because the wrapper checks restore status, backup hash and byte size, rollback preflight, rollback execution, post-rollback monitoring proof, deployed target URLs, and redaction of secret-shaped proof fields before those items can close. Alert-routing and live stakeholder walkthrough readiness are also attachment-driven: health samples alone do not close alert routing, and scripted tours alone do not close the live reviewer walkthrough. The wrapper validates that deployed proof credentials were passed explicitly and are not the local demo defaults, but it never records those credentials in the manifest. Keep the manifest with release proof artifacts; do not add secrets, private env files, provider credentials, deployment logs, or backup archives to Git.

`v17-cutover-readiness.ps1` validates the sanitized deployment evidence manifest after all sibling proof artifacts are attached. It fails if required proof is missing, `nextRequiredEvidence` is nonempty, provider status is only configured, proven provider status lacks a matching email-provider proof artifact, included proof output reports are missing or unreadable, proof timestamps are missing or malformed, token/password-like proof fields are not redacted, email-provider/alert-routing/live-walkthrough artifacts contain email-shaped PII, copied provider material, copied alert material, copied operational logs, or screenshot data, API-smoke reports lack passed status, test-run provenance, API response evidence, or post-transaction table evidence, monitoring proof is a local HTTP rehearsal, has failed samples, lacks sample records, or exceeds recorded frontend/API health budgets, load-smoke proof is below the default V17 small-pilot floor of 25 concurrent users, 8 requests each, and 200 total requests, load-smoke budgets or aggregate timing do not match the per-request records, attached proof files are missing or unreadable, attached proof has the wrong schema or target URL, Android release artifact hashes/sizes/commit/policies do not match, installed Android tour provenance is missing APK fingerprint, device, route, timestamp, or clean-record evidence, signed-APK tour fingerprints do not match the signed APK, backup/restore commit, preflight, hashes, or restore status do not match, rollback commit, preflight, execution, monitoring report timestamp, target, pass, or budget evidence is incomplete, email-provider proof lacks per-workflow evidence or `SENT` provider statuses for recovery, access-request/account-ready, or notification email, alert-routing proof lacks per-signal evidence for API health, frontend health, or failed provider delivery, required live-walkthrough manual evidence fields are absent or do not declare `proofMode=manual-live-review`, or a manifest tries to set `productionClaim=true`. A passing cutover-readiness report means the evidence package is ready for a separate human production cutover decision; it is not itself a deployment, publication, or production claim.

## Production Acceptance Bar

V17 is complete only when:

- production deploy and rollback are repeatable from documented steps
- secrets are externalized and rotated outside Git
- CORS, HTTPS, Swagger/OpenAPI unavailability, seed admin, recovery token echo, and public startup validation match the production boundary
- database backup and restore have been proven
- provider-backed delivery either works with evidence or remains explicitly disabled and labeled as local/in-app only
- all non-agent product capabilities claimed for V17 are deployed or explicitly disabled by policy; the agent remains labeled as v1 read-plus-draft prototype behavior with deterministic fallback and no mutations
- monitoring and alerting detect API health, frontend reachability, backend errors, and failed background delivery/dispatch work
- capacity, load, soak, provider-exchange, and cross-platform proof meet the documented first-release target
- API smoke, frontend route proof, performance readiness, and live stakeholder walkthrough pass against the deployed environment
- remaining limitations are recorded in the roadmap, this page, or the affected architecture doc

## Current Status

As of 2026-06-11, V17 is in private implementation on a deployment branch, not publicly deployed. The selected first no-card lane is Neon PostgreSQL, Hugging Face Docker Space backend, Vercel React/Vite frontend, and GitHub Release APK distribution. This replaces the machine-hosted ngrok lane because live tunnel behavior degraded browser/API proof reliability. Earlier provider trials that required a card or exposed only temporary free URLs are no longer active deployment lanes. VPS/Compose, Oracle Cloud Always Free, Cloud Run, and sponsored professional hosting are VInfinite candidates, not current progress. The selected software target keeps the existing Spring Boot backend, React frontend, Flyway migrations, public-mode startup validation, deployed proof wrappers, deployed monitoring samples, deployed-evidence attachment rule validation, cutover-readiness guard fixtures, opt-in SMTP email attempts, sanitized email-provider, alert-routing, and manual live-walkthrough proof artifacts, signed internal Android release proof, and `scripts/quality/v17-production-readiness.ps1` preflight. The current proof contract requires public HTTPS deployment targets for deployed evidence, requires manual evidence fields for live walkthrough proof, and rejects secrets, credential-shaped values, provider logs, copied message bodies, copied alert payloads, copied operational logs, screenshot data, and email-shaped PII in human-entered V17 evidence attachments.

The following remain required before any production claim: Neon database URL/credentials, Hugging Face backend URL, Vercel frontend URL, deployment secret storage, Gmail or provider SMTP credentials for staging proof when email is enabled, Android signing keystore, monitoring/alerting configuration, deployed backup restore drill, deployed rollback rehearsal, load/soak proof, live browser walkthrough, and live installed-Android walkthrough against the deployed target.
