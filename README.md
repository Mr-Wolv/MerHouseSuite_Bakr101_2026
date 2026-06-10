# MerHouse

MerHouse is a B2B fulfillment coordination system for merchants and warehouse providers.

This repository is prepared as a public local-development project. It includes the application source, documentation, scripts, CI configuration, Docker Compose setup, and agent guidance needed to understand and run MerHouse. Local-only working files stay outside Git.

It models the operating relationship between a brand or merchant and a warehouse partner: products, inventory expectations, inbound stock, customer orders, allocation, fulfillment progress, exceptions, shipment evidence, and service accountability all move through one role-aware workflow.

## Project Status

MerHouse is public-facing as a codebase and local product proof: it has a documented local runtime, tested backend and frontend workflows, browser route proof, native Android debug-APK proof, cross-surface parity checks, performance-readiness checks, and a recorded final live browser/installed-APK walkthrough. It is not yet a production SaaS deployment. Cloud infrastructure, real notification/recovery/carrier providers, app-store release, production monitoring, backup/restore operations, incident response, and provider-backed delivery remain explicit future activation work.

## Product Surface

- Authenticated role-aware web app for platform, merchant, and warehouse users.
- Merchant workflows for inventory, inbound stock, order creation, order import history, allocation visibility, fulfillment status, service records, and operational detail pages.
- Warehouse workflows for receiving, pick/pack/ship progress, shipment package evidence, exception reporting, and warehouse inventory.
- Platform workflows for tenant management, user management, onboarding requests, role changes, account status, relationship governance, audit evidence, outbox diagnostics, and attention-first operational review.
- Service accountability for agreement setup, agreement proposal and acceptance, at-risk SLA work, service statements, disputes, claims, review requests, and import evidence.
- Account settings after sign-in for account context and current-password-verified self-service password changes.
- Deterministic local operations assistant for scoped summaries, review-only suggestions, refusals, pending-decision review, and auditable interaction history.
- Local notification action inbox for account lifecycle events, connected operational handoffs, service accountability updates, outbox health, per-user preferences, delivery history, and app-shell alert counts without external provider delivery.
- REST API with validation, authorization, tenant-aware data access, Flyway migrations, PostgreSQL persistence, and OpenAPI metadata.
- Native mobile work packages the same frontend build as a local Android debug APK through Capacitor, with the same MerHouse app icon identity and without a second product implementation.

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
scripts/        Local development, quality, smoke-test, and maintenance helpers
docker-compose.yml
                Local full-stack runtime
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

The compose stack builds and runs PostgreSQL, the Spring Boot API, and the nginx-served frontend.
This repository is prepared for public local development and future deployment readiness. V16.2 certification uses local mocks, dry-run proof, and publication-boundary checks; it does not perform real cloud/provider deployment. Any later production activation still needs a separate deployment phase.

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
.\scripts\quality\mobile-shell-check.ps1
.\scripts\quality\native-mobile-check.ps1 -Sync
```

The shared shell check validates the web/native manifest, mobile metadata, MerHouse app icon identity, maskable icon, and online-first service worker markers, then prints the resolved frontend root, manifest identity, icon count, maskable status, and service worker path.

Run the full browser route tour after the local stack is running:

```powershell
.\scripts\quality\frontend-full-tour.ps1
```

The browser tour wrapper validates the app URL, API URL, and report path, then prints those resolved provenance fields before Playwright starts.

Build the local debug APK when Android SDK is installed:

```powershell
.\scripts\quality\native-mobile-check.ps1 -Assemble -ApiBaseUrl "http://10.0.2.2:8080"
```

The native script validates `-ApiBaseUrl` through the shared URL guard as a non-blank absolute `http` or `https` URL, applies the native build rule that it must not end with a trailing slash, defaults to `http://10.0.2.2:8080` unless you override it, then verifies that value is compiled into the Android-bound JavaScript assets and prints the compiled asset path. It also rejects wrapper-side product API paths, React route definitions, direct fetch logic, and frontend API-base wiring so Android stays a shell around the shared React app. APK assembly output prints the normalized API base plus APK SHA-256 and byte size. The script looks for Android SDK and JDK 17/21 through environment variables and standard Windows, macOS, and Linux install locations, reporting missing or incompatible tooling instead of relying on one workstation path.

Run the installed native APK tour after the local stack is running and an emulator is booted:

```powershell
.\scripts\quality\native-android-tour.ps1
```

The native tour wrapper validates the API URL, APK path, report path, and screenshot directory, then prints those resolved provenance fields before Android SDK and device discovery.

Compare the latest browser and installed-APK tour reports after both have run:

```powershell
.\scripts\quality\cross-surface-tour-check.ps1
```

The comparison fails closed on missing browser provenance, installed-APK provenance, loading shells, bad route records, missing active/empty stakeholder coverage, and route-set mismatches. A passing run prints the resolved web/native report paths, browser/native targets, APK SHA-256, device serials, checked timestamps, record counts, and normalized role/path pair count so the QC transcript identifies the exact paired evidence.

Cross-surface convergence work is tracked in [Cross-surface V&V convergence](docs/architecture/cross-surface-convergence.md). That ledger records the completed V16.2 bug-hunt closeout, the live browser/installed-APK evidence, the final admin overview loading fix, and the rule that future broad refactoring must be driven by live evidence of concrete coupling, redundancy, scalability, or performance issues.

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
.\scripts\quality\performance-readiness.ps1
```

When using tour reports directly with `performance-readiness.ps1`, pass both `-WebReportPath` and `-NativeReportPath`, or omit both for bundle/API-only proof. A single report path fails before the frontend build starts. When both are supplied, the script resolves and checks both report paths before building, then prints the resolved web/native report inputs and performance report output path. Report-backed JSON and terminal output record the supplied and resolved web/native report paths plus the validated browser and installed-APK provenance snapshots so timing evidence can be traced back to the exact paired reports.

Heavy local certification with API smoke, without supplying existing tour reports:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose -NativeApiBaseUrl "http://10.0.2.2:8080"
```

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
| `MERHOUSE_AUTH_SEED_ADMIN_ENABLED` | Development switch for creating an initial owner account |
| `MERHOUSE_AUTH_SEED_ADMIN_EMAIL` | Initial owner email when seeding is enabled |
| `MERHOUSE_AUTH_SEED_ADMIN_PASSWORD` | Initial owner password when seeding is enabled |
| `MERHOUSE_SWAGGER_ENABLED` | Enables OpenAPI JSON and Swagger UI |
| `MERHOUSE_DEPLOYMENT_PUBLIC` | Enables stricter startup validation for public deployment-shaped environments |
| `MERHOUSE_PUBLIC_FRONTEND_URL` | Public frontend origin used for provider-backed account/recovery email links |
| `MERHOUSE_EMAIL_ENABLED` | Enables SMTP-backed email delivery attempts for configured email channels |
| `MERHOUSE_EMAIL_FROM` | Sender address for provider-backed email delivery |
| `MERHOUSE_SMTP_HOST` / `MERHOUSE_SMTP_PORT` | SMTP provider target, such as Gmail/Google Workspace SMTP for staging proof |
| `MERHOUSE_AGENT_MODE` | Agent runtime mode; V17 keeps `deterministic` read-plus-draft behavior by default |

## Local Mocks And Non-Deployed Boundaries

V16.2 proves deployment readiness locally; it does not deploy MerHouse.

- Notification delivery and password recovery delivery are local records by default. V17 can make opt-in SMTP email attempts when email configuration is enabled and proven; SMS, phone OS push, lock-screen, notification-tray, webhook, and push-provider delivery remain outside the current scope.
- Carrier/provider handoff is represented by local outbox and carrier-dispatch records.
- Assistant behavior is deterministic local review assistance, not provider-backed AI.
- Health, backup/restore, dependency, and public-readiness proof are local/dry-run checks.
- Service statements are local service-unit records, not invoices or payment collection; dispute evidence is stored as notes and linked local records, not uploaded legal attachment packets.
- Failed and returned shipments are delivery-state evidence, not a full customer RMA, refund, inspection, disposition, or accounting workflow.
- Native Android support means a local debug APK wrapper around the same frontend build. The manifest, service worker, mobile metadata, and icon are shared shell support for that wrapper and the web runtime, not a second mobile product track.
- App-store packaging, native OS notification delivery, native push provider rollout, camera/barcode APIs, and offline sync are later work.
- Runtime-only values belong in `.env` or your shell environment. Keep generated proof reports, local data, and deployment-specific details out of Git.

Future production activation is a separate later phase and must replace local mocks with real provider contracts, deployment configuration, monitoring, backup/restore operations, load/performance proof, cross-platform release proof, provider-exchange reliability, and deployment-specific operations proof.
The tracked activation checklist lives in [Production deployment activation](docs/architecture/production-deployment-activation.md).
Service-specific activation notes for email recovery, account invitations, email notifications, and real agentic work live in [V17 external service activation](docs/architecture/v17-service-activation.md).

V17 private deployment work adds a VPS + Docker Compose shape under `deploy/vps/`, deployment scripts under `scripts/deploy/`, SMTP-backed email delivery hooks, read-plus-draft agent runtime metadata, load-smoke proof, and signed internal Android release checks. Keep detailed deployment values, provider credentials, Android keystores, and proof logs private until the deployment is proven and intentionally published.

## Latest Scripted Local QC Snapshot

The latest scripted V16.2 QC pass on 2026-06-10 verified:

- Live browser tour across 188 routed records for public auth/recovery/access/reset, owner/admin, support-admin, auditor, active and empty merchant, active and empty warehouse, account settings, notifications, assistant, service accountability, outbox, audit, and operational detail routes.
- Desktop and narrow viewport sweeps with no visible horizontal page overflow, clipped visible controls, missing accessible names, framework error residue, or confusing route fallback.
- Fresh merchant and warehouse accounts from empty state into active relationship, inbound receiving, stock, order allocation, notifications, and detail-page workflows.
- Account settings password change for a disposable user, including form clearing and login with the new password.
- `.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose -NativeApiBaseUrl "http://10.0.2.2:8080" -WebTourReportPath ".\reports\wrapup-frontend-full-tour.json" -NativeTourReportPath ".\reports\wrapup-native-android-tour.json"` passed the report-aware local certification gate with the Android backend target visible in the proof transcript.
- Mobile-native proof includes shared mobile shell metadata, app icon, online-first service worker, mobile shell navigation, Capacitor Android wrapper source, APK assembly, and a 100-record installed-APK route tour with APK fingerprint `b252a277e01ca00370491a95a8873262acf6fa76d2dca3869a154d15792e995d`, device, timestamp, and checked-route provenance across public routes, owner, generated admin, support-admin, auditor, active merchant, empty merchant, active warehouse, empty warehouse, and discovered operational detail routes.
- `.\scripts\quality\cross-surface-tour-check.ps1` passed against the browser and installed-APK tour reports, confirming browser report provenance, exact normalized web/native role/path set equality, and no loading shells, bad statuses, overflow, unnamed controls, or unlabeled controls.
- `.\scripts\quality\cross-surface-tour-check.ps1 -WebReportPath ".\reports\wrapup-frontend-full-tour.json" -NativeReportPath ".\reports\wrapup-native-android-tour.json"` passed with the fresh browser report and fresh installed-APK report, browser target provenance, exact normalized role/path equality, APK fingerprint/device/timestamp/checked-route provenance, and no bad route records.
- `.\scripts\quality\performance-readiness.ps1 -IncludeApiSmoke -ApiBaseUrl "http://localhost:8080" -WebReportPath ".\reports\wrapup-frontend-full-tour.json" -NativeReportPath ".\reports\wrapup-native-android-tour.json" -OutputPath ".\reports\wrapup-performance-readiness.json"` passed local bundle/performance budgets, required browser report provenance, required native APK/device/timestamp/checked-route provenance, required per-record web/native route timing, required per-record native screenshot timing, and 44.16-second timed API smoke under the 120-second budget; the full deployment gate then recorded 37.82-second timed API smoke in `reports/performance-readiness.json`. Production load, monitoring, autoscaling, and provider-backed delivery remain later activation work.
- Final live browser and installed-APK walkthrough evidence is recorded in [BH-052](docs/architecture/cross-surface-convergence.md#bh-052-final-live-walkthrough-found-android-admin-overview-blocking-on-slow-ledgers). That live pass found and fixed the shared admin overview full-page loading defect, then rebuilt and installed the APK with SHA-256 `190ca192ff8f29d5dc1c87670f13a6b891c67373bf598c74bf2b2a2e670e0f20` for targeted Android recheck.

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
- [Backend guide](docs/development/backend.md)
- [Frontend guide](docs/development/frontend.md)
- [Scripts guide](docs/development/scripts.md)
- [Knowledge system](docs/development/knowledge-system.md)
- [Architecture notes](docs/architecture/merchant-warehouse-operating-loop.md)
- [Agentic operations assistance](docs/architecture/agentic-operations-assistance.md)
- [Cross-surface V&V convergence](docs/architecture/cross-surface-convergence.md)
- [Native Android local certification](docs/architecture/native-android-local-certification.md)
- [Notifications](docs/architecture/notifications.md)
- [Deployment-ready local certification](docs/architecture/deployment-ready-local-certification.md)
- [System diagrams](docs/architecture/system-diagrams.html)
- [V17 external service activation](docs/architecture/v17-service-activation.md)
