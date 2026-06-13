# MerHouse

MerHouse is a B2B fulfillment coordination system for merchants and warehouse providers.

This repository is prepared as a public-readable project with both local development and private V17 deployment paths. It includes application source, documentation, scripts, CI configuration, Docker Compose setup, managed deployment templates, GitHub Actions workflows, and agent guidance needed to understand and run MerHouse. Local-only and deployment-private working files stay outside Git.

It models the operating relationship between a brand or merchant and a warehouse partner: products, inventory expectations, inbound stock, customer orders, allocation, fulfillment progress, exceptions, shipment evidence, and service accountability all move through one role-aware workflow.

## Project Status

MerHouse is public-readable as source code, local product proof, and sanitized deployment automation. The current repository proves a local Docker Compose runtime, backend and frontend tests, browser route proof, native Android debug-APK proof, cross-surface parity checks, performance-readiness checks, and a recorded local live browser/installed-APK walkthrough.

V17 activation now uses a **confirmed live** private deployed footprint: Neon PostgreSQL, a Hugging Face Docker Space backend, a Vercel React/Vite frontend, GitHub Actions quality/release workflows, GitHub Release APK distribution, opt-in SMTP email delivery, signed Android release proof, and deployment preflight checks. The deployment infrastructure is complete and verified by CI. The remaining V17 work focuses on four portfolio features: Access Request & Approve-and-Activate, OTP Password Recovery, How To Use Page, and AI Assistant Completion with conversation threading. See [`V17-RE-EVALUATION.md`](docs/refactor/V17-RE-EVALUATION.md) for the full scope, acceptance criteria, and task ordering.

Routine CI is pass/fail only and intentionally publishes no GitHub Actions artifacts. The only intended public binary distribution lane is a deliberate GitHub Release APK asset.

## Product Surface

- Authenticated role-aware web app for platform, merchant, and warehouse users.
- Merchant workflows for inventory, inbound stock, order creation, order import history, allocation visibility, fulfillment status, service records, and operational detail pages.
- Warehouse workflows for receiving, pick/pack/ship progress, shipment package evidence, exception reporting, and warehouse inventory.
- Platform workflows for tenant management, user management, onboarding requests, role changes, account status, relationship governance, audit evidence, outbox diagnostics, and attention-first operational review.
- Service accountability for agreement setup, agreement proposal and acceptance, at-risk SLA work, service statements, disputes, claims, review requests, and import evidence.
- Account settings after sign-in for account context and current-password-verified self-service password changes.
- Deterministic operations assistant for scoped summaries, review-only suggestions, refusals, pending-decision review, and auditable interaction history.
- Notification action inbox for account lifecycle events, connected operational handoffs, service accountability updates, outbox health, per-user preferences, delivery history, app-shell alert counts, and optional SMTP-backed email attempts when V17 email delivery is enabled.
- REST API with validation, authorization, tenant-aware data access, Flyway migrations, PostgreSQL persistence, and OpenAPI metadata.
- Native Android packages the same frontend build through Capacitor, with the same MerHouse app icon identity and without a second product implementation.

## Local Workflow Truth

The app has been verified as a local, role-aware fulfillment coordination system:

- Platform owner/admin users review onboarding, govern tenants and relationships, manage accounts, inspect audit evidence, and monitor outbox reliability.
- Support admins can review and recover supported platform work without owner-only governance powers.
- Auditors can inspect governance, service, outbox, assistant, and audit evidence without mutation controls.
- Merchants can move from first-run setup into active work by creating stock, connecting a warehouse provider, sending inbound stock, creating orders, reading attention signals, and reviewing service accountability.
- Warehouse operators can move from first-run setup into active work by receiving inbound stock, picking/packing/shipping allocated orders, reporting exceptions, and reviewing service evidence.
- Every signed-in role can use `/account` for account context and current-password-verified password changes.

Fresh empty accounts and seeded active accounts are both expected states. Empty merchant and warehouse users should see guided first-run steps instead of blank panels; active users should see attention-first work queues before history, metrics, or diagnostics.

## Tech Stack

- Java 21, Spring Boot, Spring Security, Spring Data JPA, Flyway
- PostgreSQL
- React, TypeScript, Vite, Vitest, Capacitor Android wrapper
- Docker Compose, nginx

## Repository Layout

```text
backend/        Spring Boot API, domain services, repositories, migrations, and tests
frontend/       React application, API client, pages, shared components, and tests
docs/           Architecture and development documentation
scripts/        Local development, deployment, proof, quality, and maintenance helpers
docker-compose.yml
                Local full-stack runtime
backend/backend-compose.Dockerfile
frontend/frontend-compose.Dockerfile
                Local Docker Compose images only
deploy/managed/
                Sanitized Hugging Face backend and Vercel frontend deployment templates
```

## Local Development

Requirements:

- Docker Desktop
- PowerShell

Create an environment file:

```powershell
Copy-Item .env.example .env
```

Set local values in `.env`, then start the stack:

```powershell
docker compose up --build
```

Local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`

The compose stack builds and runs PostgreSQL, the Spring Boot API, and the nginx-served frontend. Compose uses `backend/backend-compose.Dockerfile` and `frontend/frontend-compose.Dockerfile`; managed deployment templates live under `deploy/managed/`. Local development does not require Neon, Hugging Face, Vercel, SMTP, or Android signing secrets.

## Development Commands

Backend:

```powershell
cd backend
.\mvnw.cmd test
```

Frontend:

```powershell
cd frontend
npm test -- --run
npm run build
```

Shared mobile shell and native Android wrapper:

```powershell
.\scripts\proof\android\mobile-shell-check.ps1
.\scripts\proof\android\native-mobile-check.ps1 -Sync
```

The shared shell check validates the web/native manifest, mobile metadata, MerHouse app icon identity, maskable icon, and online-first service worker markers, then prints the resolved frontend root, manifest identity, icon count, maskable status, and service worker path.

Run the full browser route tour after the local stack is running:

```powershell
.\scripts\proof\web\frontend-full-tour.ps1
```

The browser tour wrapper validates the app URL, API URL, and report path, then prints those resolved provenance fields before Playwright starts.

Build the local debug APK when Android SDK is installed:

```powershell
.\scripts\proof\android\native-mobile-check.ps1 -Assemble -ApiBaseUrl "http://10.0.2.2:8080"
```

The native script validates `-ApiBaseUrl` through the shared URL guard as a non-blank absolute `http` or `https` URL, applies the native build rule that it must not end with a trailing slash, defaults to `http://10.0.2.2:8080` unless you override it, then verifies that value is compiled into the Android-bound JavaScript assets and prints the compiled asset path. It also rejects wrapper-side product API paths, React route definitions, direct fetch logic, and frontend API-base wiring so Android stays a shell around the shared React app. APK assembly output prints the normalized API base plus APK SHA-256 and byte size. The script looks for Android SDK and JDK 17/21 through environment variables and standard Windows, macOS, and Linux install locations, reporting missing or incompatible tooling instead of relying on one workstation path.

Run the installed native APK tour after the local stack is running and an emulator is booted:

```powershell
.\scripts\proof\android\native-android-tour.ps1
```

The native tour wrapper validates the API URL, APK path, report path, and screenshot directory, then prints those resolved provenance fields before Android SDK and device discovery.

Compare the latest browser and installed-APK tour reports after both have run:

```powershell
.\scripts\proof\release\cross-surface-tour-check.ps1
```

The comparison fails closed on missing browser provenance, installed-APK provenance, loading shells, bad route records, missing active/empty stakeholder coverage, and route-set mismatches. A passing run prints the resolved web/native report paths, browser/native targets, APK SHA-256, device serials, checked timestamps, record counts, and normalized role/path pair count so the QC transcript identifies the exact paired evidence.

Cross-surface convergence work is tracked in [Cross-surface V&V convergence](docs/quality/cross-surface-convergence.md). That ledger records the completed V16.2 bug-hunt closeout, the live browser/installed-APK evidence, the final admin overview loading fix, and the rule that future broad refactoring must be driven by live evidence of concrete coupling, redundancy, scalability, or performance issues.

Compose configuration:

```powershell
docker compose --env-file .env.example config --quiet
```

Full local quality check:

```powershell
.\scripts\quality\check.ps1
```

Direct broad quality runs use `http://10.0.2.2:8080` for native sync by default. Pass `-NativeApiBaseUrl` when Android-bound assets need a physical-device LAN URL or another reachable local backend.

Deployment-ready local certification gate:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -SkipCompose
```

Full report-aware deployment-ready certification when browser and installed-APK tour reports are available:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose `
  -NativeApiBaseUrl "http://10.0.2.2:8080" `
  -WebTourReportPath ".\reports\wrapup-frontend-full-tour.json" `
  -NativeTourReportPath ".\reports\wrapup-native-android-tour.json"
```

With `-IncludeApiSmoke`, the deployment gate times API smoke inside `performance-readiness.ps1` and records the result in `reports/performance-readiness.json`. The gate keeps host API smoke and Android API routing separate: `-ApiBaseUrl` controls host-side smoke, while `-NativeApiBaseUrl` controls the backend URL compiled into Android-bound assets during native sync.

Report-aware deployment proof is paired evidence: pass both `-WebTourReportPath` and `-NativeTourReportPath`, or omit both for the default local gate. Supplying only one report path fails before the gate can make a partial cross-surface claim. Supplying missing paired report paths fails before markdown, public-readiness, mobile shell, native sync, cross-surface comparison, performance readiness, or broad quality proof starts.

Local performance readiness proof:

```powershell
.\scripts\proof\release\performance-readiness.ps1
```

When using tour reports directly with `performance-readiness.ps1`, pass both `-WebReportPath` and `-NativeReportPath`, or omit both for bundle/API-only proof. A single report path fails before the frontend build starts. When both are supplied, the script resolves and checks both report paths before building, then prints the resolved web/native report inputs and performance report output path. Report-backed JSON and terminal output record the supplied and resolved web/native report paths plus the validated browser and installed-APK provenance snapshots so timing evidence can be traced back to the exact paired reports.

Heavy local certification with API smoke, without supplying existing tour reports:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose -NativeApiBaseUrl "http://10.0.2.2:8080"
```

V17 deployment preflight before staging or production rollout:

```powershell
.\scripts\quality\v17-production-readiness.ps1
```

The default preflight parses scripts, validates the managed Hugging Face/Vercel deployment shape, checks Android release configuration, proves deployed-evidence attachment rules, exercises the cutover-readiness guard with fixtures, runs markdown/public-readiness checks, and rebuilds the frontend for performance budgets. It does not contact real providers, publish CI artifacts, or build a signed APK unless explicit target URLs and signing values are supplied.

When a staging target plus Android signing and version inputs are available, add deployed smoke and signed internal release proof:

```powershell
.\scripts\quality\v17-production-readiness.ps1 -IncludeLoadSmoke -IncludeAndroidRelease -ApiBaseUrl "https://api.example.com" -FrontendUrl "https://app.example.com"
```

Managed rollout and deployed proof stay separate so deployment and verification remain auditable:

```powershell
.\scripts\deploy\huggingface-space-sync.ps1 -EnvFile ".secrets/deploy/managed/huggingface-vercel.env"
.\scripts\deploy\huggingface-space-sync.ps1 -EnvFile ".secrets/deploy/managed/huggingface-vercel.env" -ConfirmUpload
.\scripts\proof\release\deployed-v17-proof.ps1 `
  -FrontendBaseUrl "https://app.example.com" `
  -ApiBaseUrl "https://api.example.com" `
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

The Hugging Face sync script reads only an ignored private env file, prepares the Space source from tracked backend/template files, prints paths and repo IDs only, and requires `-ConfirmUpload` before pushing. Keep current managed deployment values under `.secrets/deploy/managed/`; keep provider CLI state under `.secrets/providers/`, Android signing material under `.secrets/android/keystores/`, and obsolete private material under `.secrets/archive/`.

The deployed proof script checks frontend reachability, frontend-proxy API smoke, direct API smoke, repeated monitoring samples, performance/API timing, optional report-backed load smoke, optional browser tour evidence, and writes a private deployment evidence manifest. Deployed proof requires HTTPS frontend/API targets plus explicit staging or production smoke credentials, and rejects local demo defaults. Detailed attachment and cutover evidence rules live in [Production deployment activation](docs/operations/production-deployment-activation.md).

Start or stop the local stack:

```powershell
.\scripts\local\start.ps1
.\scripts\local\stop.ps1
```

## Runtime Configuration

The backend reads configuration from environment variables. `.env.example` contains the local Docker Compose template.

| Variable | Purpose |
| --- | --- |
| `MERHOUSE_POSTGRES_DB` | PostgreSQL database name |
| `MERHOUSE_POSTGRES_USER` | PostgreSQL user |
| `MERHOUSE_POSTGRES_PASSWORD` | PostgreSQL password |
| `MERHOUSE_AUTH_JWT_SECRET` | HMAC secret for API access tokens |
| `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN` | Development switch for returning recovery tokens in API responses |
| `MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT` | Per-account reset-token preparation limit inside the recovery window |
| `MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES` | Rolling window for password-recovery throttling |
| `MERHOUSE_ACCESS_REQUEST_LIMIT` | Per-email public access-request submission limit inside the access-request window |
| `MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS` | Rolling window for public access-request throttling |
| `MERHOUSE_AUTH_SEED_ADMIN_ENABLED` | Development switch for creating an initial owner account |
| `MERHOUSE_AUTH_SEED_ADMIN_EMAIL` | Initial owner email when seeding is enabled |
| `MERHOUSE_AUTH_SEED_ADMIN_PASSWORD` | Initial owner password when seeding is enabled |
| `MERHOUSE_SWAGGER_ENABLED` | Enables OpenAPI JSON and Swagger UI |
| `MERHOUSE_DEPLOYMENT_PUBLIC` | Enables stricter startup validation for public deployment-shaped environments |
| `MERHOUSE_PUBLIC_FRONTEND_URL` | Public HTTPS frontend origin used for provider-backed account/recovery email links; public startup validation rejects HTTP or placeholder origins |
| `MERHOUSE_CORS_ALLOWED_ORIGINS` | Browser/native origins accepted by the backend; public startup validation rejects wildcard CORS and requires the public frontend origin |
| `MERHOUSE_FRONTEND_PUBLIC_API_URL` | Optional frontend container build-time API URL; leave blank for same-origin reverse-proxy deployments |
| `MERHOUSE_EMAIL_ENABLED` | Enables SMTP-backed email delivery attempts for configured email channels |
| `MERHOUSE_EMAIL_FROM` | Sender address for provider-backed email delivery |
| `MERHOUSE_EMAIL_REPLY_TO` | Optional reply-to address; deployment checks reject placeholders or malformed values when email is enabled |
| `MERHOUSE_SMTP_HOST` / `MERHOUSE_SMTP_PORT` | SMTP provider target, such as Gmail/Google Workspace SMTP for staging proof |
| `MERHOUSE_SMTP_USERNAME` / `MERHOUSE_SMTP_PASSWORD` | SMTP provider account and private credential; required when email delivery is enabled |
| `MERHOUSE_AGENT_MODE` | Agent runtime mode; V17 public/deployment checks currently accept only `deterministic` read-plus-draft behavior |
| `MERHOUSE_AGENT_TIMEOUT_SECONDS` | Agent runtime timeout guard; deployment checks require 1-60 seconds |

## Local Development And Runtime Boundaries

V16.2 proved deployment readiness locally. V17 now carries the private deployed lane, while local Docker Compose remains the reproducible development and regression-proof path.

- Notification delivery and password recovery delivery are in-app records by default, with per-account recovery throttling. V17 can make opt-in SMTP email attempts when email configuration is enabled and proven; SMS, phone OS push, lock-screen, notification-tray, webhook, and push-provider delivery remain outside the current scope.
- Carrier/provider handoff is represented by outbox and carrier-dispatch records unless a later provider adapter is deliberately implemented and proven.
- Assistant behavior is deterministic read-plus-draft review assistance. Public/deployment checks reject non-deterministic agent modes until a provider-backed runtime is implemented, authorized, audited, and proven.
- Health, dependency, and public-readiness proof have local checks; V17 backup/restore, rollback, monitoring, load, deployed browser, and installed-Android proof must be recorded with sanitized private evidence before release claims.
- Service statements are local service-unit records, not invoices or payment collection; dispute evidence is stored as notes and linked local records, not uploaded legal attachment packets.
- Failed and returned shipments are delivery-state evidence, not a full customer RMA, refund, inspection, disposition, or accounting workflow.
- Native Android support means a Capacitor wrapper around the same frontend build. Local proof uses a debug APK. V17 distribution uses a signed APK published as a deliberate GitHub Release asset.
- App-store packaging, native OS notification delivery, native push provider rollout, camera/barcode APIs, and offline sync are later work.
- Runtime-only values belong in `.env`, your shell environment, or ignored repo-local private workspaces such as `private/`, `.secrets/`, or `deploy/private/`. Keep generated proof reports, local data, deployment env files, provider credentials, provider CLI binding state such as Vercel link metadata, Android keystores, and signed APK/AAB build outputs out of Git.

Production activation is now the private V17 deployment lane and must finish replacing local-only assumptions with real provider contracts, deployment configuration, monitoring, backup/restore operations, load/performance proof, cross-platform release proof, provider-exchange reliability, and deployment-specific operations proof.
The tracked activation checklist lives in [Production deployment activation](docs/operations/production-deployment-activation.md).
Service-specific activation notes for email recovery, account invitations, email notifications, and real agentic work live in [V17 external service activation](docs/operations/v17-service-activation.md).

V17 private deployment work uses the selected Neon + Hugging Face Spaces + Vercel + GitHub Release lane. It includes deployment scripts under `scripts/deploy/`, deployed proof wrappers, SMTP-backed email delivery hooks, alert-routing and manual live-walkthrough proof helpers, a read-plus-draft deterministic agent boundary, load-smoke proof, Android release-shape proof, and signed Android release checks with private release manifests. Keep detailed deployment values, provider credentials, Android keystores, proof logs, and non-APK proof artifacts private until the deployment is proven and intentionally published.

Deployment lanes are tracked in the activation doc: current V17 uses Neon PostgreSQL plus Hugging Face Docker Space backend plus Vercel frontend plus GitHub Release APK distribution. VPS/Compose hosting and machine-hosted tunnel deployment are not current progress lanes.

## Latest Scripted Local QC Snapshot

The latest scripted V16.2 QC pass on 2026-06-10 verified:

- Live browser tour across 188 routed records for public auth/recovery/access/reset, owner/admin, support-admin, auditor, active and empty merchant, active and empty warehouse, account settings, notifications, assistant, service accountability, outbox, audit, and operational detail routes.
- Desktop and narrow viewport sweeps with no visible horizontal page overflow, clipped visible controls, missing accessible names, framework error residue, or confusing route fallback.
- Fresh merchant and warehouse accounts from empty state into active relationship, inbound receiving, stock, order allocation, notifications, and detail-page workflows.
- Account settings password change for a disposable user, including form clearing and login with the new password.
- `.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose -NativeApiBaseUrl "http://10.0.2.2:8080" -WebTourReportPath ".\reports\wrapup-frontend-full-tour.json" -NativeTourReportPath ".\reports\wrapup-native-android-tour.json"` passed the report-aware local certification gate with the Android backend target visible in the proof transcript.
- Mobile-native proof includes shared mobile shell metadata, app icon, online-first service worker, mobile shell navigation, Capacitor Android wrapper source, APK assembly, and a 100-record installed-APK route tour with APK fingerprint `b252a277e01ca00370491a95a8873262acf6fa76d2dca3869a154d15792e995d`, device, timestamp, and checked-route provenance across public routes, owner, generated admin, support-admin, auditor, active merchant, empty merchant, active warehouse, empty warehouse, and discovered operational detail routes.
- `.\scripts\proof\release\cross-surface-tour-check.ps1` passed against the browser and installed-APK tour reports, confirming browser report provenance, exact normalized web/native role/path set equality, and no loading shells, bad statuses, overflow, unnamed controls, or unlabeled controls.
- `.\scripts\proof\release\cross-surface-tour-check.ps1 -WebReportPath ".\reports\wrapup-frontend-full-tour.json" -NativeReportPath ".\reports\wrapup-native-android-tour.json"` passed with the fresh browser report and fresh installed-APK report, browser target provenance, exact normalized role/path equality, APK fingerprint/device/timestamp/checked-route provenance, and no bad route records.
- `.\scripts\proof\release\performance-readiness.ps1 -IncludeApiSmoke -ApiBaseUrl "http://localhost:8080" -WebReportPath ".\reports\wrapup-frontend-full-tour.json" -NativeReportPath ".\reports\wrapup-native-android-tour.json" -OutputPath ".\reports\wrapup-performance-readiness.json"` passed local bundle/performance budgets, required browser report provenance, required native APK/device/timestamp/checked-route provenance, required per-record web/native route timing, required per-record native screenshot timing, and 44.16-second timed API smoke under the 120-second budget; the full deployment gate then recorded 37.82-second timed API smoke in `reports/performance-readiness.json`. Production load, monitoring, autoscaling, and provider-backed delivery remain later activation work.
- Final live browser and installed-APK walkthrough evidence is recorded in [BH-052](docs/quality/cross-surface-convergence.md#bh-052-final-live-walkthrough-found-android-admin-overview-blocking-on-slow-ledgers). That live pass found and fixed the shared admin overview full-page loading defect, then rebuilt and installed the APK with SHA-256 `190ca192ff8f29d5dc1c87670f13a6b891c67373bf598c74bf2b2a2e670e0f20` for targeted Android recheck.

Generated proof reports stay local through `.gitignore`.

Scripted proof is not enough by itself for future release claims. Repeat the live browser and installed-Android walkthrough when a later release changes stakeholder workflows, native packaging, local-provider boundaries, or performance-critical routes.

## What Belongs In Git

The repository is intended to contain developer/user-relevant project material:

- `backend/`
- `frontend/`
- `docs/`
- `scripts/`
- `.github/`
- root configuration such as `README.md`, `AGENTS.md`, `.env.example`, `.gitattributes`, `.gitignore`, `docker-compose.yml`, and `pom.xml`

Local notes, generated reports, environment files, editor state, dependency output, build output, and deployment-specific run material are excluded.

## Documentation

- [Documentation index](docs/index.md)
- [Roadmap](docs/architecture/roadmap.md)
- [Development docs](docs/development/development-docs.md)
- [Architecture docs](docs/architecture/architecture-docs.md)
- [Quality docs](docs/quality/quality-docs.md)
- [Operations docs](docs/operations/operations-docs.md)
- [Backend guide](docs/development/backend.md)
- [Frontend guide](docs/development/frontend.md)
- [Cross-surface V&V convergence](docs/quality/cross-surface-convergence.md)
- [Native Android local certification](docs/quality/native-android-local-certification.md)
- [Deployment-ready local certification](docs/quality/deployment-ready-local-certification.md)
- [System diagrams](docs/architecture/system-diagrams.html)
- [Production deployment activation](docs/operations/production-deployment-activation.md)
- [V17 external service activation](docs/operations/v17-service-activation.md)
