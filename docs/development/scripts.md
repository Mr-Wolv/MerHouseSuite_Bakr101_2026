# Scripts Guide

The `scripts/` directory contains PowerShell helpers for local development, verification, and repeatable project checks. These scripts are convenience wrappers around Docker Compose, Maven, npm, Playwright, and HTTP smoke flows.

## Script Layout

| Script | Purpose |
| --- | --- |
| `scripts/local/start.ps1` | Rebuild and start the local Docker Compose stack. |
| `scripts/local/stop.ps1` | Stop the local Docker Compose stack. |
| `scripts/local/seed-demo.ps1` | Create deterministic local demo data for review workflows against a validated local API base URL. |
| `scripts/local/frontend-dev.ps1` | Start the Vite development server with a chosen host and port. |
| `scripts/local/wait-backend.ps1` | Wait until the validated local backend readiness endpoint answers before browser/API proof starts. |
| `scripts/quality/check.ps1` | Run backend, frontend, shared mobile shell, native sync, public-readiness, and Compose checks; use `-SkipMobile` only when a parent gate already ran mobile/native proof. Direct broad-gate runs accept `-NativeApiBaseUrl` for Android-bound sync. |
| `scripts/quality/backend-check.ps1` | Run backend Maven tests. |
| `scripts/quality/frontend-check.ps1` | Run frontend lint, build, deterministic unit tests, and optional Playwright checks. |
| `scripts/quality/markdown-check.ps1` | Validate tracked markdown links, including supported wiki-style links, outside generated dependency and report folders. |
| `scripts/quality/api-smoke.ps1` | Run the API smoke suite against a running backend or frontend proxy. |
| `scripts/quality/api-docs.ps1` | Check local OpenAPI availability with a validated HTTP(S) target and print local documentation URLs. |
| `scripts/quality/frontend-deploy-check.ps1` | Check the deployed frontend shell and API proxy with a validated local HTTP(S) target. |
| `scripts/quality/deployed-v17-proof.ps1` | Run deployed V17 proof against explicit frontend/API URLs, including frontend proxy smoke, direct API smoke, performance/API timing, optional load smoke, optional browser tour, and a sanitized deployment evidence manifest. |
| `scripts/quality/deployed-v17-proof-attachment-check.ps1` | Validate deployed V17 evidence attachment rules using local parser fixtures. |
| `scripts/quality/deployed-monitoring-proof.ps1` | Sample deployed HTTPS frontend shell and API health endpoints repeatedly with latency budgets and write a monitoring-style proof report; local HTTP requires an explicit rehearsal switch. |
| `scripts/quality/v17-email-provider-proof.ps1` | Write the sanitized V17 email-provider proof artifact after operator-confirmed SMTP delivery for recovery, access-request/account-ready, and notification email workflows. |
| `scripts/quality/v17-alert-routing-proof.ps1` | Write the sanitized V17 alert-routing proof artifact after operator-confirmed routing for API health, frontend health, and failed-provider-delivery signals. |
| `scripts/quality/v17-live-stakeholder-walkthrough-proof.ps1` | Write the sanitized V17 final live-walkthrough artifact after the reviewer completes the real browser and installed-Android walkthroughs. |
| `scripts/quality/v17-cutover-readiness.ps1` | Validate a sanitized V17 deployment evidence manifest before a separate human production cutover decision. |
| `scripts/quality/v17-cutover-readiness-check.ps1` | Prove the cutover-readiness validator with local complete/incomplete fixture manifests. |
| `scripts/quality/frontend-full-tour.ps1` | Run the browser tour against a running local stack. |
| `scripts/quality/mobile-shell-check.ps1` | Check shared mobile shell metadata, manifest, icon references, and service worker markers used by web and native packaging. |
| `scripts/quality/native-mobile-check.ps1` | Check the Capacitor Android wrapper, sync the frontend build into Android, and optionally assemble a debug APK. |
| `scripts/quality/native-android-tour.ps1` | Install the debug APK on a running emulator, authenticate seeded roles, visit native routes, capture APK screenshots, and write the `merhouse.native-android-tour.report.v1` proof schema. |
| `scripts/quality/native-android-release-shape-check.ps1` | Statically verify the Android release Gradle/manifest shape: release cleartext disabled, signing sourced from external env vars, and no hardcoded keystore material. |
| `scripts/quality/native-android-release-check.ps1` | Build a signed internal Android APK or AAB against an HTTPS API URL using keystore values supplied outside Git and write a sanitized release manifest. |
| `scripts/quality/cross-surface-tour-check.ps1` | Compare browser and installed-APK tour reports for clean records, provenance, valid native screenshot evidence, exact normalized role/path set equality, and traceable pass output. |
| `scripts/quality/performance-readiness.ps1` | Check local deployment-shaped performance readiness through frontend bundle budgets, paired browser/installed-APK report provenance and timing when reports are supplied, and optional API smoke timing. |
| `scripts/quality/load-smoke.ps1` | Run a small concurrent health-check smoke against a deployed or local API target and write a JSON proof report. |
| `scripts/quality/v17-production-readiness.ps1` | Run V17 preflight proof across script parsing, env template audit, VPS/reverse-proxy deployment shape, Android release shape, deployed-evidence attachment rules, cutover-readiness fixtures, markdown, public-readiness, performance readiness, and optional deployed load smoke or signed Android release proof. |
| `scripts/quality/tour-report-lib.ps1` | Shared helper for reading, normalizing, and validating browser/native tour report records, including required role/path identity. |
| `scripts/quality/url-guard-lib.ps1` | Shared helper for validating and normalizing non-blank absolute `http` or `https` local setup, native build, frontend proxy, OpenAPI docs, tour, smoke, performance, deployment, and report-provenance URLs. |
| `scripts/quality/public-readiness.ps1` | Check the repository tree for local-only folders, unsafe runtime files, signed Android artifacts, CI naming, and Compose config. |
| `scripts/quality/deployment-readiness.ps1` | Run the V16.2 deployment-ready local certification gate with local/mock proof and optional timed API smoke. |
| `scripts/deploy/vps-check.ps1` | Validate the V17 VPS production Compose shape against the deployment env template or a private deployment env file. |
| `scripts/deploy/env-audit.ps1` | Audit V17 deployment env files for required values, HTTPS origins, loopback bind, absolute backup path, placeholder secrets, and SMTP requirements without printing secret values. |
| `scripts/deploy/reverse-proxy-check.ps1` | Validate the V17 nginx reverse-proxy template for HTTPS redirect, TLS protocols, security headers, public Swagger/API-doc blocking, and frontend proxy target. |
| `scripts/deploy/deploy-vps.ps1` | Apply the V17 VPS Compose stack from a private env file after explicit confirmation, optional image pull/build, and optional pre-deploy backup. |
| `scripts/deploy/bootstrap-owner.ps1` | Create the first deployed owner through the PostgreSQL service after strict env audit, Compose shape validation, and explicit confirmation, without enabling public seed-admin startup. |
| `scripts/deploy/backup-postgres.ps1` | Audit a private deployment env file, validate the Compose shape, refuse the example template, and create a PostgreSQL custom-format backup through the Compose postgres service. |
| `scripts/deploy/restore-postgres.ps1` | Audit a private deployment env file, validate the Compose shape, refuse the example template, and restore a PostgreSQL backup after explicit confirmation. |
| `scripts/deploy/backup-restore-drill.ps1` | Create a host-copied PostgreSQL backup, restore it into the selected drill/staging environment after explicit confirmation, and write a sanitized drill manifest. |
| `scripts/deploy/rollback-compose.ps1` | Audit a private deployment env, validate the Compose shape, and re-apply the selected Compose image/tag set after explicit rollback confirmation. |
| `scripts/deploy/rollback-drill.ps1` | Audit a private deployment env, validate the Compose shape, run a confirmed rollback/up through the guarded rollback primitive, optionally sample deployed health, and write a sanitized rollback rehearsal manifest. |
| `scripts/maintenance/clean-reports.ps1` | Trim old local reports, logs, and screenshots. |

## Typical Local Flow

Start the full stack:

```powershell
.\scripts\local\start.ps1
```

`start.ps1` waits for `http://localhost:8080/api/v1/health` before reporting the stack ready. Use the same validated readiness guard after rebuilding or restarting only the backend:

```powershell
docker compose up -d backend
.\scripts\local\wait-backend.ps1
```

Seed local review data when a live browser tour needs stable fake accounts for every stakeholder:

```powershell
.\scripts\local\seed-demo.ps1 -CreateReviewAccounts
```

The review accounts are local-only fake credentials for browser proof:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `admin@merhouse.local` | `local-owner-password` |
| Merchant | `review.merchant@merhouse.local` | `review-password` |
| Warehouse operator | `review.operator@merhouse.local` | `review-password` |
| Support admin | `review.support@merhouse.local` | `review-password` |
| Auditor | `review.auditor@merhouse.local` | `review-password` |

Do not reuse these credentials outside the local demo stack.

Run backend and frontend proof:

```powershell
cd backend
.\mvnw.cmd test

cd ..\frontend
npm test -- --run
npm run build
```

Run the full browser suite when the local backend stack is running and seeded:

```powershell
cd frontend
npm run test:e2e
```

Or use the repository wrapper:

```powershell
.\scripts\quality\frontend-check.ps1 -IncludeE2E
```

The wrapper runs Vitest with `--no-file-parallelism` so the heavier jsdom route tests stay deterministic inside broad local gates after backend, native sync, parity, and performance proof have already consumed local worker and Docker resources. Direct `npm test -- --run` remains useful for fast local development, but wrapper output is the QC evidence used by repository gates.

`frontend-check.ps1 -IncludeE2E` defaults the shared browser and API targets to the Docker frontend on port 3000 so every Playwright spec uses the same running app. To test another running frontend, override the shared browser target:

```powershell
$env:FRONTEND_TOUR_BASE_URL = "http://localhost:3000"
.\scripts\quality\frontend-check.ps1 -SkipInstall -IncludeE2E
Remove-Item Env:\FRONTEND_TOUR_BASE_URL
```

The full browser tour validates `-BaseUrl` and `-ApiUrl` as non-blank absolute `http` or `https` URLs and validates `-OutputPath` as a non-blank report path before Playwright starts. Its wrapper prints the browser app URL, API URL, and resolved report path before the tour runs, then writes a main route report and companion action-proof reports under `reports/`. Route reports include browser provenance such as `appUrl`, `apiUrl`, `checkedAt`, `checkedRoutes`, and route records. Companion action reports include `checkedActions`, an acceptance standard, fixture context, and action records for hierarchy/denial proof, notification scope, notification preferences, and merchant/warehouse handoff workflows.

`frontend-deploy-check.ps1` validates its frontend `-BaseUrl`, prints the normalized target, the frontend-proxy API smoke output destination, the frontend HTTP status, and the React shell marker before running API smoke through the frontend proxy.

Password recovery proof has two local modes:

- default mode keeps `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN=false`; reset requests record local notification history and return a generic browser message without exposing a reset link
- complete local request/confirm proof requires `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN=true`, a backend restart or rebuild, and:

```powershell
.\scripts\quality\api-smoke.ps1 -ExpectRecoveryToken
```

Keep token echo disabled for production-shaped checks. V16.2 certifies the local/mock recovery boundary; provider-backed reset delivery remains a V17 real activation item.

Validate markdown links after documentation changes:

```powershell
.\scripts\quality\markdown-check.ps1
```

Validate shared mobile shell metadata after frontend shell changes:

```powershell
.\scripts\quality\mobile-shell-check.ps1
```

This also checks that the app icon still uses the MerHouse brand mark identity colors.
The pass output prints the resolved frontend root, manifest identity, icon count, maskable-icon status, and service worker path for QC traceability.

Validate the native Android wrapper without requiring Android SDK:

```powershell
.\scripts\quality\native-mobile-check.ps1
```

The structural check verifies the Capacitor wrapper, native manifest, launcher identity, and Android source boundary. It also rejects wrapper-side product API paths, React route definitions, direct fetch logic, or `VITE_API_BASE_URL` wiring so mobile stays a shell around the shared frontend instead of becoming a second workflow implementation.

Build and sync the React app into the Android wrapper:

```powershell
.\scripts\quality\native-mobile-check.ps1 -Sync
```

The sync check validates and normalizes `-ApiBaseUrl` through the shared URL guard as a non-blank absolute `http` or `https` URL, applies the native build rule that it must not end with a trailing slash, defaults it to `http://10.0.2.2:8080` unless overridden, builds with `VITE_API_BASE_URL` set from the normalized value, verifies that the normalized backend base URL is present in the compiled JavaScript assets, prints the compiled asset path that proved the value, and then copies the same built frontend into the Android wrapper. This keeps web and native API routing explicit: the web build can use the frontend proxy, while the native APK uses the emulator or device-reachable backend URL without a second API client.

Build the literal local Android debug APK when Android SDK is installed:

```powershell
.\scripts\quality\native-mobile-check.ps1 -Assemble -ApiBaseUrl "http://10.0.2.2:8080"
```

Use `http://10.0.2.2:8080` for the Android emulator. Use your computer LAN address for a physical phone on the same network. The script prefers `ANDROID_HOME` or `ANDROID_SDK_ROOT`, then standard Windows, macOS, and Linux Android SDK locations. For APK assembly, it uses `java` on `PATH`, a compatible `JAVA_HOME`, or common JDK 17/21 install locations. Newer unsupported Java runtimes are rejected with a setup message instead of producing a brittle local-only build. Successful assembly output prints the normalized API base, APK SHA-256, and APK byte size.

Build the signed internal Android release artifact only with an HTTPS API URL and keystore values supplied outside Git:

```powershell
.\scripts\quality\native-android-release-shape-check.ps1

$env:MERHOUSE_ANDROID_KEYSTORE_PATH = "D:\secure\merhouse-release.jks"
$env:MERHOUSE_ANDROID_KEYSTORE_PASSWORD = "<secret>"
$env:MERHOUSE_ANDROID_KEY_ALIAS = "merhouse"
$env:MERHOUSE_ANDROID_KEY_PASSWORD = "<secret>"
$env:MERHOUSE_ANDROID_VERSION_CODE = "17"
$env:MERHOUSE_ANDROID_VERSION_NAME = "17.0.0-internal"
.\scripts\quality\native-android-release-check.ps1 -ApiBaseUrl "https://api.example.com" -OutputPath ".\reports\v17-android-release.json"
```

Release builds force Android cleartext traffic off. The script prefers `ANDROID_HOME` or `ANDROID_SDK_ROOT`, then standard Windows, macOS, and Linux Android SDK locations before invoking Gradle. By default it builds a signed APK so the installed-Android tour can prove the same installable release fingerprint; pass `-Bundle` only when an AAB artifact is deliberately needed in addition to APK walkthrough proof. It prints the artifact path, SHA-256, byte size, and manifest path. The manifest records commit SHA, API URL, artifact kind/path, SHA-256, byte size, version code, version name, cleartext policy, and external-keystore signing boundary without recording keystore details. Keep keystores and credentials outside Git.

Run the native Android APK tour after the local stack is running, seeded, and an emulator is booted:

```powershell
.\scripts\quality\native-android-tour.ps1
```

The tour validates `-ApiUrl` as a non-blank absolute `http` or `https` URL and validates `-ApkPath`, `-OutputPath`, and `-ScreenshotDirectory` as non-blank paths before Android tooling starts. Its wrapper prints the native API URL, resolved APK path, resolved report path, and resolved screenshot directory before SDK and device discovery. It then finds `adb` from `ANDROID_HOME`, `ANDROID_SDK_ROOT`, standard SDK locations, or `PATH`, installs `frontend/android/app/build/outputs/apk/debug/app-debug.apk`, checks public auth routes, authenticates seeded active owner, merchant, warehouse, support-admin, and auditor users, creates generated admin, empty merchant, and empty warehouse accounts, seeds platform relationship and inbound-stock detail routes where those roles are allowed, discovers additional operational detail routes from inside the APK, and writes screenshots plus a JSON report under `reports/`. Each pulled screenshot must be valid PNG evidence with positive dimensions before the route can pass, and protected routes that land on `/login` after token injection are bad records. The report records the API URL, APK path, APK SHA-256, APK byte size, checked timestamp, connected device serials, and active or empty stakeholder state for merchant and warehouse records so the installed-app proof can be tied back to a specific local artifact, runtime, proof time, and stakeholder-state coverage.

Use the [cross-surface V&V convergence ledger](../architecture/cross-surface-convergence.md) when Android and web proof are being compared. The ledger records the completed V16.2 installed-APK and browser evidence, the gaps and fixes found during closeout, and the rule that future broad refactoring starts only after evidence identifies concrete coupling, redundancy, scalability, separability, or performance problems.

Compare the latest browser and native tour reports after both have run:

```powershell
.\scripts\quality\cross-surface-tour-check.ps1 `
  -WebReportPath ".\reports\wrapup-frontend-full-tour.json" `
  -NativeReportPath ".\reports\wrapup-native-android-tour.json"
```

The comparison normalizes role names and generated detail-route ids, then fails if either report has loading shells, missing expected route content, overflow, unlabeled controls, unnamed controls, bad HTTP states, missing exact web and native active/empty stakeholder coverage, missing required role/path coverage, missing web browser provenance with absolute HTTP(S) app/API URLs, missing native APK/nonblank-device/timestamp/checked-route provenance with an absolute HTTP(S) API URL, or if the normalized web and native role/path sets do not match exactly. On success, it prints the resolved web/native report paths plus browser app/API URL, native API URL, APK SHA-256, device serials, checked timestamps, record counts, and normalized role/path pair count so the QC log can be traced back to the exact paired evidence.

`cross-surface-tour-check.ps1` and `performance-readiness.ps1` both use `tour-report-lib.ps1` so tour-report parsing, role/path identity checks, absolute HTTP(S) web browser provenance checks, native APK/nonblank-device/timestamp/checked-route provenance checks, native PNG screenshot evidence checks, route normalization, and clean-record checks stay consistent across gates. Clean-record validation treats numeric HTTP status values of 400 or higher as bad records regardless of whether JSON parsing produced a narrow integer, wider number, or numeric string, and report-backed gates reject nonempty top-level `badRecords` arrays even if individual route records otherwise look clean.

Run local performance readiness proof after frontend or deployment-shape changes:

```powershell
.\scripts\quality\performance-readiness.ps1
```

The default proof builds the frontend and enforces a 30-second local build budget plus raw and gzipped JavaScript/CSS bundle budgets. When supplied tour reports are checked, the proof requires timing fields on every relevant route record, requires browser target and checked-route provenance with absolute HTTP(S) app/API URLs for web reports, requires native APK/nonblank-device/timestamp/checked-route provenance with an absolute HTTP(S) API URL for installed-APK reports, requires each native route record to reference an existing PNG screenshot file with positive image dimensions, and enforces web route-ready, native route-ready, and native screenshot-complete timing budgets. When a seeded local stack is running, add API smoke timing:

```powershell
.\scripts\quality\performance-readiness.ps1 -IncludeApiSmoke -ApiBaseUrl "http://localhost:8080"
```

When browser and installed-APK tour reports are available, include them so the performance readiness pass also verifies paired route timing, route-report cleanliness, browser provenance, and installed-APK provenance:

```powershell
.\scripts\quality\performance-readiness.ps1 `
  -WebReportPath ".\reports\wrapup-frontend-full-tour.json" `
  -NativeReportPath ".\reports\wrapup-native-android-tour.json"
```

This is local deployment-shaped proof, not production load, monitoring, autoscaling, or provider-delivery certification.

Run the first V17 small-pilot load smoke against a deployed or local API health endpoint:

```powershell
.\scripts\quality\load-smoke.ps1 -BaseUrl "https://app.example.com" -ConcurrentUsers 25 -RequestsPerUser 8
```

The script validates the target URL, runs concurrent health traffic, enforces failure and average-latency budgets, and writes a `load-smoke-*.json` report with the target, budgets, aggregate timing, failure count, and per-request records. This is a smoke budget for release confidence, not a substitute for full load or soak testing.

Run the V17 deployment preflight before a staging or production rollout:

```powershell
.\scripts\quality\v17-production-readiness.ps1
```

The default preflight parses PowerShell scripts, audits the deployment env template, validates the rendered VPS Compose output including public-mode safety flags, checks the reverse-proxy template, checks the Android release Gradle/manifest shape, proves deployed-evidence attachment rules, exercises the cutover-readiness validator with complete and incomplete fixtures, checks markdown, checks public-facing repository boundaries, and rebuilds the frontend for performance budgets. It intentionally skips live load smoke and signed Android artifact proof until a real HTTPS target and external signing secrets exist. When a staging or production target is reachable, include those proof slices:

```powershell
.\scripts\quality\v17-production-readiness.ps1 `
  -IncludeLoadSmoke `
  -IncludeAndroidRelease `
  -ApiBaseUrl "https://api.example.com"
```

The default Android release-shape check proves the release build is configured to disable cleartext traffic, source signing/versioning from external `MERHOUSE_ANDROID_KEYSTORE_*` and `MERHOUSE_ANDROID_VERSION_*` values without requiring the secrets, and keep Google/Firebase provider hooks out while native push remains outside V17 scope. The signed Android slice requires those environment variables and writes the sanitized APK artifact manifest, giving the installed-Android tour an installable release fingerprint to match. The lower-level release script still supports `-Bundle` for a deliberate AAB artifact, but AAB output by itself is not enough to prove the installed walkthrough used the same release APK. The load-smoke slice uses the same HTTPS `-ApiBaseUrl`, `-ConcurrentUsers`, and `-RequestsPerUser` values to record a small-pilot readiness signal against the deployed API health endpoint.

Performance report paths are paired evidence. `performance-readiness.ps1` rejects a lone `-WebReportPath` or lone `-NativeReportPath` before building the frontend so report-backed route timing cannot be claimed from one surface only. When both are supplied, it resolves and checks both report paths before the frontend build starts, then prints the resolved web/native report inputs and resolved performance report output path. Omit both only for bundle/API-only proof. Report-backed JSON and terminal output record the supplied and resolved web/native report paths plus validated browser and installed-APK provenance snapshots so timing evidence can be traced back to the exact paired reports.

The GitHub quality gate runs the default performance readiness proof in the frontend job so bundle budgets stay enforced in CI as well as local heavy certification.

Run the V16.2 deployment-ready local certification gate when the stack is ready for heavier proof:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -SkipCompose
```

When browser and installed-APK tour reports are available, pass both report paths so the deployment gate also runs cross-surface comparison, report-aware performance readiness, and API smoke in the same full local certification pass:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose `
  -NativeApiBaseUrl "http://10.0.2.2:8080" `
  -WebTourReportPath ".\reports\wrapup-frontend-full-tour.json" `
  -NativeTourReportPath ".\reports\wrapup-native-android-tour.json"
```

When `-IncludeApiSmoke` is supplied, deployment readiness validates `-ApiBaseUrl` as a non-blank absolute `http` or `https` URL, then passes it into `performance-readiness.ps1` so API smoke is timed against the local performance budget and recorded in `reports/performance-readiness.json`. Deployment readiness also validates `-NativeApiBaseUrl` and passes it into `native-mobile-check.ps1 -Sync` so the Android-bound JavaScript is compiled against the emulator or device-reachable backend URL instead of relying on an implicit native default. `-ApiBaseUrl` and `-NativeApiBaseUrl` are intentionally separate because host-side smoke often uses `http://localhost:8080` while the Android emulator normally uses `http://10.0.2.2:8080`. Omit API smoke only for a focused rerun when the seeded local stack is unavailable or API smoke is not part of the current claim. The gate stays local and mocked; it does not provision cloud infrastructure, provider setup, or production delivery.

Report paths are all-or-none. `deployment-readiness.ps1` rejects a lone `-WebTourReportPath` or lone `-NativeTourReportPath` before running the gate so cross-surface parity and performance readiness cannot be claimed from one surface only. When both are supplied, it resolves and checks both report paths before markdown, public-readiness, mobile shell, native sync, cross-surface comparison, performance readiness, or broad quality proof starts, then passes the resolved paths to downstream report-aware checks.

`deployment-readiness.ps1` runs shared mobile shell and native sync proof before the broad local quality gate, then calls `check.ps1 -SkipMobile` so those same mobile/native checks are not repeated in the same run. Running `check.ps1` directly still includes mobile shell and native sync proof by default, and direct broad-gate runs can pass `-NativeApiBaseUrl` when the Android build must target a physical-device LAN URL instead of the emulator default.

After future browser tours, installed-APK tours, cross-surface comparisons, and full deployment gates are green for workflow, packaging, local-boundary, or performance-sensitive changes, repeat the [final live walkthrough checklist](../architecture/cross-surface-convergence.md#final-live-walkthrough-checklist). Record reviewer/product-owner results with the manual walkthrough evidence template in that ledger; do not treat script output alone as a new convergence claim.

Validate Compose configuration:

```powershell
docker compose --env-file .env.example config --quiet
```

Validate the VPS Compose deployment shape before copying private environment files to a server:

```powershell
.\scripts\deploy\vps-check.ps1
```

Use `deploy/vps/env.production.example` as a template only; real deployment env files, logs, backups, credentials, Android signing material, and signed APK/AAB artifacts stay outside Git. They may live in ignored repo-local workspaces such as `private/`, `.secrets/`, or `deploy/private/` so operators have one local project place for private deployment material. The shape check validates rendered public-mode safety flags plus PostgreSQL, backend HTTP readiness, and frontend shell healthchecks.

Audit the template in CI/preflight mode or audit a private env file before rollout:

```powershell
.\scripts\deploy\env-audit.ps1 -EnvFile "deploy/vps/env.production.example" -AllowTemplate
.\scripts\deploy\env-audit.ps1 -EnvFile ".env.production"
```

Strict mode rejects in-repository deployment env files unless Git ignores them, placeholder database/JWT/SMTP credentials, malformed or placeholder email sender/reply-to values when email delivery is enabled, non-HTTPS public origins, wildcard CORS or CORS values that omit the public frontend URL, non-loopback frontend binds, relative backup paths, incomplete SMTP settings when email delivery is enabled, unsupported agent modes, out-of-range recovery and access-request throttles, and out-of-range agent timeouts. `vps-check.ps1` then verifies that the rendered Compose file wires those audited throttle values into the backend while keeping public mode on, seed-admin off, recovery-token echo off, Swagger off, deterministic agent mode on, and a bounded agent timeout present. Backend public startup validation repeats the HTTPS public frontend URL, explicit CORS, and CORS-includes-frontend checks so a directly started public API cannot bypass the deployment env audit. Deployed API smoke treats public OpenAPI proof as unavailable when the endpoint returns either an authorization block or a disabled-route not-found response. The audit prints key names and paths only, not secret values; `public-readiness.ps1` allows ignored private deployment workspaces while keeping them out of public token scanning.

Validate the public nginx reverse-proxy template before installing it on the VPS:

```powershell
.\scripts\deploy\reverse-proxy-check.ps1
```

The check enforces HTTP-to-HTTPS redirect, TLS 1.2/1.3, HSTS, content-type/frame/referrer/permissions/content-security headers, public Swagger/API-doc blocking, forwarded HTTPS headers, and loopback proxying to the frontend container bind.

The VPS frontend image accepts `MERHOUSE_FRONTEND_PUBLIC_API_URL` through the `VITE_API_BASE_URL` build argument. Leave it blank when the public frontend reverse-proxies `/api` to the backend on the same origin; set it only for split frontend/API origin deployments where the browser must call a separate API origin.

Apply the VPS stack only from a private env file and only after choosing backup posture:

```powershell
.\scripts\deploy\deploy-vps.ps1 -EnvFile ".env.production" -Build -BackupBeforeDeploy -ConfirmDeploy
```

`deploy-vps.ps1` refuses `env.production.example`, runs the strict env audit, reruns the rendered VPS Compose boundary check, can create a pre-deploy database backup, can pull configured images, and then applies `docker compose up -d --remove-orphans` with optional `--build`. Direct `backup-postgres.ps1` and `restore-postgres.ps1` runs also refuse the example env template and run the same strict env audit plus Compose shape check before touching the database; backup output defaults under ignored `reports/backups/` unless an explicit external output path is supplied. Backup and restore filenames must be simple `.dump` names containing only letters, numbers, dots, underscores, and hyphens before they are copied into the postgres container.

Bootstrap the first owner only after the deployed database has migrated and only when no enabled owner exists:

```powershell
.\scripts\deploy\bootstrap-owner.ps1 `
  -EnvFile ".env.staging" `
  -OwnerEmail "<staging-owner-email>" `
  -OwnerPassword "<private-owner-password>" `
  -ConfirmBootstrap
```

The bootstrap script refuses `env.production.example`, runs strict env audit and Compose shape validation, inserts a platform owner with a PostgreSQL `crypt(..., gen_salt('bf', 12))` password hash, records an `OWNER_BOOTSTRAPPED` audit event, and fails if an enabled owner already exists. It sends the bootstrap SQL through stdin with escaped SQL literals instead of placing the owner password in `psql` process arguments. Keep the owner credential outside Git, then run deployed API/browser proof with that credential.

Run a restore drill only against the intended staging or drill environment:

```powershell
.\scripts\deploy\backup-restore-drill.ps1 -EnvFile ".env.staging" -OutputDirectory ".\reports" -ConfirmDrill
```

The drill wrapper creates a custom-format PostgreSQL backup through the Compose postgres service, copies the backup to the host, restores it with the existing restore script, and writes `v17-backup-restore-drill-*.json` with commit SHA, env/Compose preflight status, backup path, SHA-256, byte size, env file name only, and restore status. It omits database credentials and env values.

Run rollback rehearsal only against staging, a drill environment, or an explicitly selected production rollback window:

```powershell
.\scripts\deploy\rollback-drill.ps1 -EnvFile ".env.staging" -FrontendBaseUrl "https://<staging-frontend-origin>" -ApiBaseUrl "https://<staging-api-origin>" -ConfirmRollbackDrill
```

The rollback drill audits the private env file, validates the Compose shape, runs the guarded rollback/up primitive, optionally records deployed monitoring samples, and writes `v17-rollback-rehearsal-*.json` without secrets. The manifest uses `generatedAt`, matching the deployed-proof attachment contract. Local loopback rehearsals may use HTTP only with `-AllowLocalHttpRehearsal`, which is also passed through to the monitoring proof; staging and production proof must use HTTPS targets.

After rollout, run deployed proof against the public HTTPS frontend and API targets. Local HTTP URLs belong to local development gates and explicit local rollback rehearsals, not deployed V17 evidence:

```powershell
.\scripts\quality\deployed-v17-proof.ps1 `
  -FrontendBaseUrl "https://app.example.com" `
  -ApiBaseUrl "https://api.example.com" `
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

The default deployed proof checks the frontend shell, frontend-proxy API smoke, direct API smoke, repeated monitoring samples, and performance/API timing. `-IncludeLoadSmoke` adds concurrent health traffic and attaches the generated load-smoke report path to the deployment evidence manifest; `-IncludeBrowserTour` requires seeded stakeholder data and runs the browser tour against the deployed frontend. Every run writes `v17-deployment-evidence-*.json` with the deployment label, commit SHA, public frontend/API URLs, provider status label, proof-output paths, included proof slices, and remaining required evidence without storing secrets. Cutover readiness reopens the package if API-smoke reports do not include passed status, test-run provenance, representative API response evidence, and post-transaction table evidence. Provider status is an evidence label, not an automatic claim: `not-recorded`, `smtp-staging-configured`, `smtp-configured`, and `email-configured` keep provider-backed recovery/access-request/notification email proof open in `nextRequiredEvidence`; `smtp-staging-proven`, `smtp-production-proven`, and `email-provider-proven` also require `-EmailProviderProofManifestPath`, while `email-disabled-by-policy` closes the item as an explicit no-provider release policy. The wrapper requires explicit staging or production smoke credentials and rejects local demo values such as `admin@merhouse.local`, `local-owner-password`, and `review-password`.

When sibling V17 proof already exists, pass `-AndroidReleaseManifestPath`, `-InstalledAndroidTourReportPath`, `-BackupRestoreManifestPath`, `-RollbackManifestPath`, `-EmailProviderProofManifestPath`, `-AlertRoutingManifestPath`, and `-LiveStakeholderWalkthroughManifestPath`. The wrapper validates that each supplied path exists, is free of unredacted token/password-shaped proof values, and is the expected JSON proof artifact schema for that attachment, rather than accepting any schema-shaped file. The human-entered email-provider, alert-routing, and live-walkthrough artifacts also reject email-shaped PII; provider artifacts reject copied message bodies, provider logs, SMTP transcripts, headers, and message IDs; alert artifacts reject copied alert payloads, webhook bodies, request/response bodies, and delivery transcripts; live-walkthrough artifacts reject copied browser/Android logs, stack traces, console output, and screenshot data. Android release `apiBaseUrl`, installed Android tour `apiUrl`, rollback post-monitoring URLs, email-provider `apiBaseUrl`/`frontendBaseUrl`/`providerStatus`, alert-routing `apiBaseUrl`/`frontendBaseUrl`, and live walkthrough `apiBaseUrl`/`frontendBaseUrl` must match the deployed URLs before the proof can clear those evidence items. Android release evidence must also point to an existing APK/AAB whose SHA-256 digest, byte size, commit SHA, version code, version name, release cleartext policy, and external-keystore signing boundary match the sanitized release manifest and deployed commit. Installed Android tour evidence must include the APK SHA-256, APK byte size, checked timestamp, connected device serials, checked route count, at least one installed-app route record, and no bad route records; the V17 cutover path should use a signed APK artifact so the installed tour fingerprint matches the signed release APK. Backup/restore and rollback evidence must prove the same deployed commit SHA, env/Compose preflight, and secret-handling policy; backup/restore must also prove an existing backup file with matching SHA-256 and byte size plus restore status, while rollback must prove execution and post-rollback monitoring against the same deployed frontend/API URLs, including a timestamped monitoring report whose own frontend/API URLs match the rollback manifest, is not a local HTTP rehearsal, has passing sample records, and stays within its recorded frontend/API health budgets. A no-monitoring or failed-monitoring rollback rehearsal remains a drill artifact, not cutover-ready rollback evidence. Email-provider evidence must prove password recovery, access-request/account-ready, and notification email workflows with per-workflow evidence, per-workflow `SENT` provider statuses, summary delivery evidence, and a secret-handling policy. Alert-routing evidence must prove API health, frontend health, and failed-provider-delivery signals with per-signal evidence, summary delivery evidence, and a secret-handling policy. Live walkthrough evidence must prove both browser and installed-Android walkthroughs across owner, merchant, warehouse, support-admin, and auditor roles, include non-blank browser, installed-Android, and stakeholder-coverage manual evidence fields, and declare `proofMode=manual-live-review`; scripted tour output by itself remains separate proof. It then records the sanitized path, schema, API target fields, and Android release version fields under `attachedEvidence`. Attached evidence removes that item from `nextRequiredEvidence`. The deployment evidence manifest records `productionClaim=false` so smoke proof cannot be mistaken for a completed release or cutover decision.

After staging SMTP proof has been observed, write the provider artifact without storing credentials, reset tokens, OTPs, invitation passwords, message bodies, provider logs, or deployment env values:

```powershell
.\scripts\quality\v17-email-provider-proof.ps1 `
  -FrontendBaseUrl "https://app.example.com" `
  -ApiBaseUrl "https://api.example.com" `
  -ProviderStatus "smtp-staging-proven" `
  -PasswordRecoveryEvidence "staging mailbox accepted reset-link delivery for the recovery workflow" `
  -AccessRequestEvidence "staging mailbox accepted account-ready delivery for an approved requester" `
  -NotificationEmailEvidence "staging mailbox accepted notification delivery for an opted-in recipient" `
  -DeliveryEvidence "operator-confirmed SMTP staging delivery records match provider status fields" `
  -ConfirmProviderProof
```

The script requires HTTPS targets, a proven provider-status label, explicit confirmation, meaningful short non-secret evidence references, and emits `merhouse.v17.email-provider-proof.v1` for `-EmailProviderProofManifestPath`. It rejects vague placeholders, copied tokens, credentials, message bodies, provider logs, SMTP transcripts, email headers, message IDs, raw email content, and recipient/operator email addresses. It is a proof recorder, not an SMTP sender; the backend delivery path and staging mailbox/provider must already have been exercised.

After alert routing has been observed, write the alert artifact without storing alert-provider credentials, endpoints, webhooks, provider logs, deployment env values, or copied alert payloads:

```powershell
.\scripts\quality\v17-alert-routing-proof.ps1 `
  -FrontendBaseUrl "https://app.example.com" `
  -ApiBaseUrl "https://api.example.com" `
  -ApiHealthEvidence "staging operator acknowledged API health signal" `
  -FrontendHealthEvidence "staging operator acknowledged frontend health signal" `
  -FailedProviderDeliveryEvidence "staging operator acknowledged failed delivery signal" `
  -DeliveryEvidence "operator-confirmed alert records reached the staging operator" `
  -ConfirmAlertRoutingProof
```

The script requires HTTPS targets, explicit confirmation, and meaningful short non-secret evidence references, then emits `merhouse.v17.alert-routing.v1` for `-AlertRoutingManifestPath`. It rejects vague placeholders, provider credentials, endpoints, webhooks, provider logs, copied alert payloads, webhook bodies, request/response bodies, delivery transcripts, and recipient/operator email addresses. It is a proof recorder, not an alert provider; monitoring and alert routing must already have been exercised.

After the final live walkthrough has actually happened with the reviewer in the real browser and installed Android app, write the manual review artifact:

```powershell
.\scripts\quality\v17-live-stakeholder-walkthrough-proof.ps1 `
  -FrontendBaseUrl "https://app.example.com" `
  -ApiBaseUrl "https://api.example.com" `
  -Reviewer "release reviewer initials or ticket reference" `
  -BrowserWalkthroughEvidence "manual browser walkthrough completed across supported roles" `
  -InstalledAndroidWalkthroughEvidence "manual installed Android walkthrough completed across supported roles" `
  -StakeholderCoverageEvidence "owner merchant warehouse support-admin auditor active and empty states reviewed" `
  -ConfirmManualLiveReview
```

The script requires HTTPS targets, explicit manual-live-review confirmation, and meaningful short non-secret evidence references for browser, installed Android, and stakeholder coverage. Use reviewer initials or a ticket reference, not a personal email address. It rejects vague placeholders, copied deployment/browser/Android logs, stack traces, console output, private URLs, screenshot data, and base64 payloads, then emits `merhouse.v17.live-stakeholder-walkthrough.v1` with non-blank manual evidence fields for `-LiveStakeholderWalkthroughManifestPath`. It does not run the walkthrough; it records the already completed human review so scripted tours cannot close the live-review requirement.

Run only the lightweight deployed monitoring proof when a target needs a fast health/reachability sample. This standalone proof requires HTTPS targets unless the run is explicitly marked as a local HTTP rehearsal:

```powershell
.\scripts\quality\deployed-monitoring-proof.ps1 `
  -FrontendBaseUrl "https://app.example.com" `
  -ApiBaseUrl "https://api.example.com"
```

This proof checks repeated frontend shell responses and `/api/v1/health` responses with latency budgets. It is release evidence for reachability and health detection only for HTTPS staging/production targets; `-AllowLocalHttpRehearsal` output stays local rehearsal evidence. It is not a replacement for external uptime monitoring, paging, incident routing, or log/error aggregation.

After deployed proof and sibling artifacts are complete, validate the sanitized deployment evidence manifest before any separate cutover decision:

```powershell
.\scripts\quality\v17-cutover-readiness.ps1 -DeploymentEvidenceManifestPath ".\reports\v17-deployment-evidence-<timestamp>.json"
```

The cutover validator fails if `nextRequiredEvidence` is nonempty, provider status is only configured, load smoke or browser tour proof is missing, monitoring proof is a local HTTP rehearsal or has failed/out-of-budget samples, load smoke is below the V17 small-pilot floor of 25 concurrent users, 8 requests each, and 200 total requests, load-smoke budgets or aggregate timing do not match the per-request records, required sibling artifacts are absent, included proof output reports are missing or unreadable, proof timestamps are missing or malformed, token/password-like proof fields are not redacted, referenced artifact files are missing or unreadable, attached artifacts have the wrong schema/target URL, installed Android tour evidence is missing APK fingerprint, device, route, timestamp, or clean-record provenance, backup/restore preflight, hashes, or restore status do not match, rollback preflight/rollback/monitoring report timestamp, target, pass, or budget evidence is incomplete, email-provider proof lacks per-workflow `SENT` provider statuses or contains copied provider material, alert-routing proof lacks per-signal evidence or contains copied alert material, live walkthrough proof is incomplete, contains copied operational logs/screenshot data, lacks manual evidence fields, is missing required role coverage, or is not marked `manual-live-review`, or the manifest attempts to set `productionClaim=true`. Passing this check means the evidence package is ready for human cutover review; it does not itself deploy, publish, or claim production.

For deployed browser tours, pass the same stakeholder emails and passwords used to seed the staging or smoke tenant through the `-AdminEmail`, `-MerchantEmail`, `-WarehouseEmail`, `-SupportAdminEmail`, `-AuditorEmail`, and matching password parameters. The owner credential is required for deployed API smoke even when the browser tour is skipped; the stakeholder credentials are required when `-IncludeBrowserTour` is supplied. The wrapper keeps the frontend URL and API URL separate so same-origin proxy deployments and split frontend/API origin deployments are both explicit in proof output.

Run the API smoke suite after the stack is running:

```powershell
.\scripts\quality\api-smoke.ps1
```

The API smoke wrapper and lower-level scenario runner both validate and normalize `-BaseUrl` as a non-blank absolute `http` or `https` URL before any smoke scenario starts. The wrapper prints the normalized target and either the resolved output path or the timestamped report pattern before delegating to the lower-level runner. In public proof mode, `-ExpectOpenApiDocs:$false` accepts HTTP 403 or 404 from the grouped OpenAPI endpoint because either response keeps API documentation unavailable to the public target.

The API docs helper validates `-BaseUrl` the same way before checking or opening Swagger/OpenAPI URLs.

The API smoke suite includes the V14 assistant scenario. That scenario checks platform, merchant, and auditor assistant endpoints; assistant audit events; current-user history scoping; role and tenant refusals; read-only auditor behavior; and a smoke-scale concurrent assistant summary run.

## Script Families

`scripts/api/` contains the lower-level smoke runner, assertion helpers, HTTP helpers, report helpers, and scenario files. The lower-level runner keeps the same validated target URL contract as the quality wrapper so direct scenario runs and saved smoke report provenance cannot drift from wrapper proof. The `scripts/quality/api-smoke.ps1` wrapper is the normal entry point. The smoke suite is broad functional proof, not production load certification; maximum practical load and stress limits are reserved for V17 production activation or later.

Frontend browser-flow scripts expect the local stack to be running and use the React app URL as the browser entry point. Playwright tests live under `frontend/tests/e2e/`, with configuration in `frontend/playwright.config.ts`. The Docker frontend target is controlled with `FRONTEND_TOUR_BASE_URL`.

Reports generated by scripts belong under `reports/`, which is ignored by Git. Report-producing quality scripts normalize local output and report-input paths to canonical filesystem paths before passing them to downstream proof tools or writing provenance fields.

## What Scripts Should Leave In Git

The scripts are local development and verification tooling. Runtime values come from ignored `.env` files, environment variables, command parameters, or explicit local files. Generated reports and local runtime files stay out of Git. Public-readiness checks scan the repository so app source, docs, scripts, CI, compose files, and root guidance stay useful to a developer who just cloned the project.
