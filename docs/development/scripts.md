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
| `scripts/local/rebuild.ps1` | Rebuild and restart Docker Compose services with health check; supports `-BackendOnly`, `-FrontendOnly`, `-Full`, `-NoCache`, and `-PullImages` switches. |
| `scripts/quality/check.ps1` | Run backend, frontend, shared mobile shell, native sync, public-readiness, and Compose checks; use `-SkipMobile` only when a parent gate already ran mobile/native proof. Direct broad-gate runs accept `-NativeApiBaseUrl` for Android-bound sync. |
| `scripts/quality/backend-check.ps1` | Run backend Maven tests. |
| `scripts/quality/frontend-check.ps1` | Run frontend lint, build, deterministic unit tests, and optional Playwright checks. |
| `scripts/quality/markdown-check.ps1` | Validate tracked markdown links, including supported wiki-style links, outside generated dependency and report folders. |
| `scripts/quality/api-smoke.ps1` | Run the API smoke suite against a running backend or frontend proxy. |
| `scripts/quality/api-docs.ps1` | Check local OpenAPI availability with a validated HTTP(S) target and print local documentation URLs. |
| `scripts/proof/release/frontend-deploy-check.ps1` | Check the deployed frontend shell and API proxy with a validated local HTTP(S) target. |
| `scripts/proof/release/deployed-v17-proof.ps1` | Run deployed V17 proof against explicit frontend/API URLs, including frontend proxy smoke, direct API smoke, performance/API timing, optional load smoke, optional browser tour, and a sanitized deployment evidence manifest. |
| `scripts/proof/release/deployed-v17-proof-attachment-check.ps1` | Validate deployed V17 evidence attachment rules using local parser fixtures. |
| `scripts/proof/release/deployed-monitoring-proof.ps1` | Sample deployed HTTPS frontend shell and API health endpoints repeatedly with latency budgets and write a monitoring-style proof report; local HTTP requires an explicit rehearsal switch. |
| `scripts/proof/release/v17-email-provider-proof.ps1` | Write the sanitized V17 email-provider proof artifact after operator-confirmed SMTP delivery for recovery, access-request/account-ready, and notification email workflows. |
| `scripts/proof/release/v17-alert-routing-proof.ps1` | Write the sanitized V17 alert-routing proof artifact after operator-confirmed routing for API health, frontend health, and failed-provider-delivery signals. |
| `scripts/proof/release/v17-live-stakeholder-walkthrough-proof.ps1` | Write the sanitized V17 final live-walkthrough artifact after the reviewer completes the real browser and installed-Android walkthroughs. |
| `scripts/proof/release/v17-cutover-readiness.ps1` | Validate a sanitized V17 deployment evidence manifest before a separate human production cutover decision. |
| `scripts/proof/release/v17-cutover-readiness-check.ps1` | Prove the cutover-readiness validator with local complete/incomplete fixture manifests. |
| `scripts/proof/web/frontend-full-tour.ps1` | Run the browser tour against a running local stack. |
| `scripts/proof/android/mobile-shell-check.ps1` | Check shared mobile shell metadata, manifest, icon references, and service worker markers used by web and native packaging. |
| `scripts/proof/android/native-mobile-check.ps1` | Check the Capacitor Android wrapper, sync the frontend build into Android, and optionally assemble a debug APK. |
| `scripts/proof/android/native-android-tour.ps1` | Install the debug APK on a running emulator, authenticate seeded roles, visit native routes, capture APK screenshots, and write the `merhouse.native-android-tour.report.v1` proof schema. |
| `scripts/proof/android/native-android-release-shape-check.ps1` | Statically verify the Android release Gradle/manifest shape: release cleartext disabled, signing sourced from external env vars, and no hardcoded keystore material. |
| `scripts/proof/android/native-android-release-check.ps1` | Build a signed internal Android APK or AAB that wraps a deployed HTTPS frontend URL, uses an HTTPS API URL, sources keystore values outside Git, and writes a sanitized release manifest. |
| `scripts/proof/android/native-android-release-login-proof.ps1` | Install the signed release APK, drive the real Android login screen through ADB input, capture diagnostic launch/credential/dashboard evidence, and write signed-release login support output without requiring release WebView devtools. |
| `scripts/proof/android/native-android-release-visual-tour-proof.ps1` | Convert a visually reviewed signed-release login proof into a cutover-compatible installed Android tour report when release WebView devtools are unavailable. |
| `scripts/proof/release/cross-surface-tour-check.ps1` | Compare browser and installed-APK tour reports for clean records, provenance, valid native screenshot evidence, exact normalized role/path set equality, and traceable pass output. |
| `scripts/proof/release/performance-readiness.ps1` | Check local deployment-shaped performance readiness through frontend bundle budgets, paired browser/installed-APK report provenance and timing when reports are supplied, and optional API smoke timing. |
| `scripts/proof/release/load-smoke.ps1` | Run a small concurrent health-check smoke against a deployed or local API target and write a JSON proof report. |
| `scripts/quality/v17-production-readiness.ps1` | Run V17 preflight proof across script parsing, deployed HTTPS evidence guards, deployed-evidence attachment rules, cutover-readiness fixtures, markdown, public-readiness, performance readiness, and optional deployed load smoke or signed Android release proof. |
| `scripts/proof/lib/tour-report-lib.ps1` | Shared helper for reading, normalizing, and validating browser/native tour report records, including required role/path identity. |
| `scripts/proof/lib/url-guard-lib.ps1` | Shared helper for validating and normalizing non-blank absolute `http` or `https` local setup, native build, frontend proxy, OpenAPI docs, tour, smoke, performance, deployment, and report-provenance URLs. |
| `scripts/proof/web/frontend-ui-input-tour.ps1` | Run typed public-auth UI input proof against a running web target. |
| `scripts/quality/public-readiness.ps1` | Check the repository tree for local-only folders, unsafe runtime files, signed Android artifacts, no Actions artifact publishing, CI naming, and Compose config while excluding generated dependency/build/report folders. |
| `scripts/quality/deployment-readiness.ps1` | Run the V16.2 deployment-ready local certification gate with local/mock proof and optional timed API smoke. |
| `scripts/quality/v17-production-readiness.ps1` | Validate the selected no-card V17 Hugging Face Docker Space backend and Firebase Hosting frontend deployment configuration shape as part of V17 preflight proof. |
| `scripts/deploy/huggingface-space-sync.ps1` | Prepare or upload the self-contained Hugging Face Docker Space source from the tracked backend and an ignored private env file. |
| `scripts/maintenance/clean-reports.ps1` | Trim old local reports, logs, and screenshots. |
| `scripts/maintenance/syntax-check.ps1` | Parse all repository PowerShell scripts for syntax errors and report any failures with file, line, and message. |

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
$env:FRONTEND_TOUR_BASE_URL = "http://localhost:3001"
.\scripts\quality\frontend-check.ps1 -SkipInstall -IncludeE2E
Remove-Item Env:\FRONTEND_TOUR_BASE_URL
```

The full browser tour validates `-BaseUrl` and `-ApiUrl` as non-blank absolute `http` or `https` URLs and validates `-OutputPath` as a non-blank report path before Playwright starts. Its wrapper prints the browser app URL, API URL, resolved report path, coverage lane, route progress interval, and route concurrency before the tour runs, then writes a main route report and companion action-proof reports under `reports/`. `-Coverage Full` is the exhaustive local certification lane with detail-route discovery. `-Coverage Deployment` is the live V17 lane: it uses the supplied seeded stakeholder accounts, skips detail-route discovery churn, and covers public routes, authenticated role routes, desktop/narrow viewports, and active/empty stakeholder states without turning deployed proof into the local cross-surface matrix. During the route sweep, the spec inspects independent routes concurrently under the correct public or authenticated browser context, prints `[frontend-tour]` progress lines, and writes an interrupt-friendly `.partial.json` route report every `-ProgressEvery` route records. Route reports include browser provenance such as `appUrl`, `apiUrl`, `checkedAt`, `checkedRoutes`, and route records. Companion action reports include `checkedActions`, an acceptance standard, fixture context, and action records for hierarchy/denial proof, notification scope, notification preferences, and merchant/warehouse handoff workflows.

`frontend-ui-input-tour.ps1` runs the typed public-auth input proof without the broad route matrix. Use it when the target question is whether the live web UI accepts real form input and submission. It drives invalid login, valid owner login, password reset request, invalid reset confirmation, and public access-request submission through form controls and writes a `.ui-input.json` companion report.

`native-android-release-visual-tour-proof.ps1` is the release-mode companion to `native-android-release-login-proof.ps1`. Signed release WebViews may not expose debug targets or UIAutomator text. After the emulator/device window is visible and the signed-release dashboard screenshot has been visually reviewed, the visual-tour wrapper validates the release-login proof, APK hash, device serials, and PNG evidence, then writes a `merhouse.native-android-tour.report.v1` report with `proofMode=signed-release-visual-review`. Use the full `native-android-tour.ps1` route sweep whenever WebView devtools are intentionally available; use the visual release wrapper only for signed internal release proof where devtools are deliberately unavailable.

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
.\scripts\proof\android\mobile-shell-check.ps1
```

This also checks that the app icon still uses the MerHouse brand mark identity colors.
The pass output prints the resolved frontend root, manifest identity, icon count, maskable-icon status, and service worker path for QC traceability.

Validate the native Android wrapper without requiring Android SDK:

```powershell
.\scripts\proof\android\native-mobile-check.ps1
```

The structural check verifies the Capacitor wrapper, native manifest, launcher identity, and Android source boundary. It also rejects wrapper-side product API paths, React route definitions, direct fetch logic, or `VITE_API_BASE_URL` wiring so mobile stays a shell around the shared frontend instead of becoming a second workflow implementation.

Build and sync the React app into the Android wrapper:

```powershell
.\scripts\proof\android\native-mobile-check.ps1 -Sync
```

The sync check validates and normalizes `-ApiBaseUrl` through the shared URL guard as a non-blank absolute `http` or `https` URL, applies the native build rule that it must not end with a trailing slash, defaults it to `http://10.0.2.2:8080` unless overridden, builds with `VITE_API_BASE_URL` set from the normalized value, verifies that the normalized backend base URL is present in the compiled JavaScript assets, prints the compiled asset path that proved the value, and then copies the same built frontend into the Android wrapper. This keeps web and native API routing explicit: the web build can use the frontend proxy, while the native APK uses the emulator or device-reachable backend URL without a second API client.

Build the literal local Android debug APK when Android SDK is installed:

```powershell
.\scripts\proof\android\native-mobile-check.ps1 -Assemble -ApiBaseUrl "http://10.0.2.2:8080"
```

Use `http://10.0.2.2:8080` for the Android emulator. Use your computer LAN address for a physical phone on the same network. The script prefers `ANDROID_HOME` or `ANDROID_SDK_ROOT`, then standard Windows, macOS, and Linux Android SDK locations. For APK assembly, it uses `java` on `PATH`, a compatible `JAVA_HOME`, or common JDK 17/21 install locations. Newer unsupported Java runtimes are rejected with a setup message instead of producing a brittle local-only build. Successful assembly output prints the normalized API base, APK SHA-256, and APK byte size.

Build the signed internal Android release artifact only with an HTTPS API URL and keystore values supplied outside Git:

```powershell
.\scripts\proof\android\native-android-release-shape-check.ps1

$env:MERHOUSE_ANDROID_KEYSTORE_PATH = "D:\secure\merhouse-release.jks"
$env:MERHOUSE_ANDROID_KEYSTORE_PASSWORD = "<secret>"
$env:MERHOUSE_ANDROID_KEY_ALIAS = "merhouse"
$env:MERHOUSE_ANDROID_KEY_PASSWORD = "<secret>"
$env:MERHOUSE_ANDROID_VERSION_CODE = "17"
$env:MERHOUSE_ANDROID_VERSION_NAME = "17.0.0-internal"
.\scripts\proof\android\native-android-release-check.ps1 -ApiBaseUrl "https://api.example.com" -FrontendUrl "https://app.example.com" -OutputPath ".\reports\v17-android-release.json"
```

Release builds force Android cleartext traffic off. The script prefers `ANDROID_HOME` or `ANDROID_SDK_ROOT`, then standard Windows, macOS, and Linux Android SDK locations before invoking Gradle. By default it builds a signed APK so the installed-Android tour can prove the same installable release fingerprint; pass `-Bundle` only when an AAB artifact is deliberately needed in addition to APK walkthrough proof. It prints the artifact path, SHA-256, byte size, and manifest path. The manifest records commit SHA, API URL, artifact kind/path, SHA-256, byte size, version code, version name, cleartext policy, WebView debugging posture, and external-keystore signing boundary without recording keystore details. Keep the manifest as private release proof unless a later publication decision deliberately sanitizes and publishes it. Keep keystores and credentials outside Git. `MERHOUSE_ANDROID_PROOF_WEBVIEW_DEBUG=true` may be set only for an internal signed proof APK so the installed-app tour can drive the release build through WebView devtools; leave it unset for ordinary distributed release APKs.

The manual `MerHouse Android Release` GitHub Actions workflow builds the same signed internal APK for the V17 release lane and publishes only the APK to a GitHub Release. Run it only after the deployed backend URL is stable enough to compile into the APK. GitHub Actions cannot read ignored local `.secrets/` files; copy the private deployed target URLs into GitHub Actions secrets as `MERHOUSE_ANDROID_API_BASE_URL` and `MERHOUSE_ANDROID_FRONTEND_URL`, and copy signing material into GitHub Actions secrets as `MERHOUSE_ANDROID_KEYSTORE_BASE64`, `MERHOUSE_ANDROID_KEYSTORE_PASSWORD`, `MERHOUSE_ANDROID_KEY_ALIAS`, and `MERHOUSE_ANDROID_KEY_PASSWORD`. The workflow fails fast when any required deployed URL or signing secret is absent instead of producing a local/debug APK. Reruns update the existing release, replace the APK asset with `--clobber`, and apply the requested prerelease flag instead of failing when the tag already exists. Routine CI intentionally publishes no GitHub Actions artifacts; debug APKs, tour reports, API smoke output, and proof JSON stay in the job workspace or ignored local `reports/` unless a separate release/publication decision says otherwise.

For signed release APK login proof, use a real HTTPS API target and a private proof account whose password is supplied outside Git:

```powershell
.\scripts\proof\android\native-android-release-login-proof.ps1 `
  -ApiUrl "https://api.example.com" `
  -ApkPath ".\frontend\android\app\build\outputs\apk\release\app-release.apk" `
  -Email $env:MERHOUSE_V17_APK_EMAIL `
  -Password $env:MERHOUSE_V17_APK_PASSWORD `
  -OutputPath ".\reports\native-android-release-login-proof.json"
```

This support proof is intentionally separate from `native-android-tour.ps1`: debug APK tours use WebView devtools for route coverage, while signed release APKs keep WebView debugging unavailable. The release login proof therefore preflights the credential against the API, installs and clears the signed APK, enters the email by sending letters plus `KEYCODE_AT` for `@`, hides the keyboard with Android Back, waits for the post-login app state to settle, and captures diagnostic evidence. UIAutomator cannot reliably read text inside a signed release WebView, so this output is only a support record; the V17 release decision still depends on live reviewer inspection of the installed Android app and deployed web app.

Run the native Android APK tour after the local stack is running, seeded, and an emulator is booted:

```powershell
.\scripts\proof\android\native-android-tour.ps1
```

The tour validates `-ApiUrl` as a non-blank absolute `http` or `https` URL and validates `-ApkPath`, `-OutputPath`, and `-ScreenshotDirectory` as non-blank paths before Android tooling starts. Its wrapper prints the native API URL, resolved APK path, resolved report path, and resolved screenshot directory before SDK and device discovery. It then finds `adb` from `ANDROID_HOME`, `ANDROID_SDK_ROOT`, standard SDK locations, or `PATH`, installs `frontend/android/app/build/outputs/apk/debug/app-debug.apk`, checks public auth routes, authenticates seeded active owner, merchant, warehouse, support-admin, and auditor users, creates generated admin, empty merchant, and empty warehouse accounts, seeds platform relationship and inbound-stock detail routes where those roles are allowed, discovers additional operational detail routes from inside the APK, and writes screenshots plus a JSON report under `reports/`. Each pulled screenshot must be valid PNG evidence with positive dimensions before the route can pass, and protected routes that land on `/login` after token injection are bad records. The report records the API URL, APK path, APK SHA-256, APK byte size, checked timestamp, connected device serials, and active or empty stakeholder state for merchant and warehouse records so the installed-app proof can be tied back to a specific local artifact, runtime, proof time, and stakeholder-state coverage.

Use the [cross-surface V&V convergence ledger](../quality/cross-surface-convergence.md) when Android and web proof are being compared. The ledger records the completed V16.2 installed-APK and browser evidence, the gaps and fixes found during closeout, and the rule that future broad refactoring starts only after evidence identifies concrete coupling, redundancy, scalability, separability, or performance problems.

Compare the latest browser and native tour reports after both have run:

```powershell
.\scripts\proof\release\cross-surface-tour-check.ps1 `
  -WebReportPath ".\reports\wrapup-frontend-full-tour.json" `
  -NativeReportPath ".\reports\wrapup-native-android-tour.json"
```

The comparison normalizes role names and generated detail-route ids, then fails if either report has loading shells, missing expected route content, overflow, unlabeled controls, unnamed controls, bad HTTP states, missing exact web and native active/empty stakeholder coverage, missing required role/path coverage, missing web browser provenance with absolute HTTP(S) app/API URLs, missing native APK/nonblank-device/timestamp/checked-route provenance with an absolute HTTP(S) API URL, or if the normalized web and native role/path sets do not match exactly. On success, it prints the resolved web/native report paths plus browser app/API URL, native API URL, APK SHA-256, device serials, checked timestamps, record counts, and normalized role/path pair count so the QC log can be traced back to the exact paired evidence.

`cross-surface-tour-check.ps1` and `performance-readiness.ps1` both use `tour-report-lib.ps1` so tour-report parsing, role/path identity checks, absolute HTTP(S) web browser provenance checks, native APK/nonblank-device/timestamp/checked-route provenance checks, native PNG screenshot evidence checks, route normalization, and clean-record checks stay consistent across gates. Clean-record validation treats numeric HTTP status values of 400 or higher as bad records regardless of whether JSON parsing produced a narrow integer, wider number, or numeric string, and report-backed gates reject nonempty top-level `badRecords` arrays even if individual route records otherwise look clean.

Run local performance readiness proof after frontend or deployment-shape changes:

```powershell
.\scripts\proof\release\performance-readiness.ps1
```

The default proof builds the frontend and enforces a 30-second local build budget plus raw and gzipped JavaScript/CSS bundle budgets. When supplied tour reports are checked, the proof requires timing fields on every relevant route record, requires browser target and checked-route provenance with absolute HTTP(S) app/API URLs for web reports, requires native APK/nonblank-device/timestamp/checked-route provenance with an absolute HTTP(S) API URL for installed-APK reports, requires each native route record to reference an existing PNG screenshot file with positive image dimensions, and enforces web route-ready, native route-ready, and native screenshot-complete timing budgets. When a seeded local stack is running, add API smoke timing:

```powershell
.\scripts\proof\release\performance-readiness.ps1 -IncludeApiSmoke -ApiBaseUrl "http://localhost:8080"
```

When browser and installed-APK tour reports are available, include them so the performance readiness pass also verifies paired route timing, route-report cleanliness, browser provenance, and installed-APK provenance:

```powershell
.\scripts\proof\release\performance-readiness.ps1 `
  -WebReportPath ".\reports\wrapup-frontend-full-tour.json" `
  -NativeReportPath ".\reports\wrapup-native-android-tour.json"
```

This is local deployment-shaped proof, not production load, monitoring, autoscaling, or provider-delivery certification.

Run the first V17 small-pilot load smoke against a deployed or local API health endpoint:

```powershell
.\scripts\proof\release\load-smoke.ps1 -BaseUrl "https://app.example.com" -ConcurrentUsers 25 -RequestsPerUser 8
```

The script validates the target URL, runs concurrent health traffic, enforces failure and average-latency budgets, and writes a `load-smoke-*.json` report with the target, budgets, aggregate timing, failure count, and per-request records. This is a smoke budget for release confidence, not a substitute for full load or soak testing.

Run the V17 deployment preflight before a staging or production rollout:

```powershell
.\scripts\quality\v17-production-readiness.ps1
```

The default preflight parses PowerShell scripts, checks deployed HTTPS evidence guards, proves deployed-evidence attachment rules, exercises the cutover-readiness validator with complete and incomplete fixtures, checks markdown, checks public-facing repository boundaries, and rebuilds the frontend for performance budgets. It intentionally skips live load smoke and Android release proof until a real HTTPS target and external signing secrets exist. When a staging or production target is reachable, include those proof slices:

```powershell
.\scripts\quality\v17-production-readiness.ps1 `
  -IncludeLoadSmoke `
  -IncludeAndroidRelease `
  -ApiBaseUrl "https://api.example.com" `
  -FrontendUrl "https://app.example.com"
```

Android release proof is not part of the default quality gate. The signed Android slice requires external `MERHOUSE_ANDROID_KEYSTORE_*` and `MERHOUSE_ANDROID_VERSION_*` environment variables, the deployed backend `-ApiBaseUrl`, and the deployed frontend `-FrontendUrl`; the APK wraps the frontend URL and records both URLs in the private APK proof manifest, giving the installed-Android tour an installable release fingerprint to match without publishing target details as CI artifacts. The lower-level release script still supports `-Bundle` for a deliberate AAB artifact, but AAB output by itself is not enough to prove the installed walkthrough used the same release APK. The load-smoke slice uses the same HTTPS `-ApiBaseUrl`, `-ConcurrentUsers`, and `-RequestsPerUser` values to record a small-pilot readiness signal against the deployed API health endpoint.

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

After future browser tours, installed-APK tours, cross-surface comparisons, and full deployment gates are green for workflow, packaging, local-boundary, or performance-sensitive changes, repeat the [final live walkthrough checklist](../quality/cross-surface-convergence.md#final-live-walkthrough-checklist). Record reviewer/product-owner results with the manual walkthrough evidence template in that ledger; do not treat script output alone as a new convergence claim.

Validate Compose configuration:

```powershell
docker compose --env-file .env.example config --quiet
```

After rollout, run deployed proof against the public HTTPS frontend and API targets. Local HTTP URLs belong to local development gates and explicit local rollback rehearsals, not deployed V17 evidence:

```powershell
.\scripts\proof\release\deployed-v17-proof.ps1 `
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

The default deployed proof checks the frontend shell, frontend-proxy API smoke, direct API smoke, repeated monitoring samples, and performance/API timing. `-IncludeLoadSmoke` adds concurrent health traffic and attaches the generated load-smoke report path to the deployment evidence manifest; `-IncludeBrowserTour` requires seeded stakeholder data and runs the browser tour against the deployed frontend with `-Coverage Deployment`. Every run writes `v17-deployment-evidence-*.json` with the deployment label, commit SHA, public frontend/API URLs, provider status label, proof-output paths, included proof slices, and remaining required evidence without storing secrets. Cutover readiness reopens the package if API-smoke reports do not include passed status, test-run provenance, representative API response evidence, and post-transaction table evidence. Provider status is an evidence label, not an automatic claim: `not-recorded`, `smtp-staging-configured`, `smtp-configured`, and `email-configured` keep provider-backed recovery/access-request/notification email proof open in `nextRequiredEvidence`; `smtp-staging-proven`, `smtp-production-proven`, and `email-provider-proven` also require `-EmailProviderProofManifestPath`, while `email-disabled-by-policy` closes the item as an explicit no-provider release policy. The wrapper requires explicit staging or production smoke credentials and rejects local demo values such as `admin@merhouse.local`, `local-owner-password`, and `review-password`.

When sibling V17 proof already exists, pass `-AndroidReleaseManifestPath`, `-InstalledAndroidTourReportPath`, `-BackupRestoreManifestPath`, `-RollbackManifestPath`, `-EmailProviderProofManifestPath`, `-AlertRoutingManifestPath`, and `-LiveStakeholderWalkthroughManifestPath`. The wrapper validates that each supplied path exists, is free of unredacted token/password-shaped proof values, and is the expected JSON proof artifact schema for that attachment, rather than accepting any schema-shaped file. The human-entered email-provider, alert-routing, and live-walkthrough artifacts also reject email-shaped PII; provider artifacts reject copied message bodies, provider logs, SMTP transcripts, headers, and message IDs; alert artifacts reject copied alert payloads, webhook bodies, request/response bodies, and delivery transcripts; live-walkthrough artifacts reject copied browser/Android logs, stack traces, console output, and screenshot data. Android release `apiBaseUrl`, installed Android tour `apiUrl`, rollback post-monitoring URLs, email-provider `apiBaseUrl`/`frontendBaseUrl`/`providerStatus`, alert-routing `apiBaseUrl`/`frontendBaseUrl`, and live walkthrough `apiBaseUrl`/`frontendBaseUrl` must match the deployed URLs before the proof can clear those evidence items. Android release evidence must also point to an existing APK/AAB whose SHA-256 digest, byte size, commit SHA, version code, version name, release cleartext policy, and external-keystore signing boundary match the sanitized release manifest and deployed commit. Installed Android tour evidence must include the APK SHA-256, APK byte size, checked timestamp, connected device serials, checked route count, at least one installed-app route record, and no bad route records; the V17 cutover path should use a signed APK artifact so the installed tour fingerprint matches the signed release APK. Backup/restore and rollback evidence must prove the same deployed commit SHA, env/Compose preflight, and secret-handling policy; backup/restore must also prove an existing backup file with matching SHA-256 and byte size plus restore status, while rollback must prove execution and post-rollback monitoring against the same deployed frontend/API URLs, including a timestamped monitoring report whose own frontend/API URLs match the rollback manifest, is not a local HTTP rehearsal, has passing sample records, and stays within its recorded frontend/API health budgets. A no-monitoring or failed-monitoring rollback rehearsal remains a drill artifact, not cutover-ready rollback evidence. Email-provider evidence must prove password recovery, access-request/account-ready, and notification email workflows with per-workflow evidence, per-workflow `SENT` provider statuses, summary delivery evidence, and a secret-handling policy. Alert-routing evidence must prove API health, frontend health, and failed-provider-delivery signals with per-signal evidence, summary delivery evidence, and a secret-handling policy. Live walkthrough evidence must prove both browser and installed-Android walkthroughs across owner, merchant, warehouse, support-admin, and auditor roles, include non-blank browser, installed-Android, and stakeholder-coverage manual evidence fields, and declare `proofMode=manual-live-review`; scripted tour output by itself remains separate proof. It then records the sanitized path, schema, API target fields, and Android release version fields under `attachedEvidence`. Attached evidence removes that item from `nextRequiredEvidence`. The deployment evidence manifest records `productionClaim=false` so smoke proof cannot be mistaken for a completed release or cutover decision.

When both Android release and installed-tour proof are supplied, `deployed-v17-proof.ps1` rejects mismatched APK SHA-256 or byte size before writing deployment evidence.

After staging SMTP proof has been observed, write the provider artifact without storing credentials, reset tokens, OTPs, invitation passwords, message bodies, provider logs, or deployment env values:

```powershell
.\scripts\proof\release\v17-email-provider-proof.ps1 `
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
.\scripts\proof\release\v17-alert-routing-proof.ps1 `
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
.\scripts\proof\release\v17-live-stakeholder-walkthrough-proof.ps1 `
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
.\scripts\proof\release\deployed-monitoring-proof.ps1 `
  -FrontendBaseUrl "https://app.example.com" `
  -ApiBaseUrl "https://api.example.com"
```

This proof checks repeated frontend shell responses and `/api/v1/health` responses with latency budgets. It is release evidence for reachability and health detection only for HTTPS staging/production targets; `-AllowLocalHttpRehearsal` output stays local rehearsal evidence. It is not a replacement for external uptime monitoring, paging, incident routing, or log/error aggregation.

After deployed proof and sibling artifacts are complete, validate the sanitized deployment evidence manifest before any separate cutover decision:

```powershell
.\scripts\proof\release\v17-cutover-readiness.ps1 -DeploymentEvidenceManifestPath ".\reports\v17-deployment-evidence-<timestamp>.json"
```

The cutover validator fails if `nextRequiredEvidence` is nonempty, provider status is only configured, load smoke or browser tour proof is missing, monitoring proof is a local HTTP rehearsal or has failed/out-of-budget samples, load smoke is below the V17 small-pilot floor of 25 concurrent users, 8 requests each, and 200 total requests, load-smoke budgets or aggregate timing do not match the per-request records, required sibling artifacts are absent, included proof output reports are missing or unreadable, proof timestamps are missing or malformed, token/password-like proof fields are not redacted, referenced artifact files are missing or unreadable, attached artifacts have the wrong schema/target URL, installed Android tour evidence is missing APK fingerprint, device, route, timestamp, or clean-record provenance, backup/restore preflight, hashes, or restore status do not match, rollback preflight/rollback/monitoring report timestamp, target, pass, or budget evidence is incomplete, email-provider proof lacks per-workflow `SENT` provider statuses or contains copied provider material, alert-routing proof lacks per-signal evidence or contains copied alert material, live walkthrough proof is incomplete, contains copied operational logs/screenshot data, lacks manual evidence fields, is missing required role coverage, or is not marked `manual-live-review`, or the manifest attempts to set `productionClaim=true`. Passing this check means the evidence package is ready for human cutover review; it does not itself deploy, publish, or claim production.

For deployed browser tours, pass the same stakeholder emails and passwords used to seed the staging or smoke tenant through the `-AdminEmail`, `-MerchantEmail`, `-WarehouseEmail`, `-SupportAdminEmail`, `-AuditorEmail`, and matching password parameters. The owner credential is required for deployed API smoke even when the browser tour is skipped; the stakeholder credentials are required when `-IncludeBrowserTour` is supplied. The wrapper keeps the frontend URL and API URL separate so same-origin proxy deployments and split frontend/API origin deployments are both explicit in proof output.

Run the API smoke suite after the stack is running:

```powershell
.\scripts\quality\api-smoke.ps1
```

The API smoke wrapper and lower-level scenario runner both validate and normalize `-BaseUrl` as a non-blank absolute `http` or `https` URL before any smoke scenario starts. The wrapper prints the normalized target and either the resolved output path or the timestamped report pattern before delegating to the lower-level runner. In public proof mode, `-ExpectOpenApiDocs:$false` accepts HTTP 403 or 404 from the grouped OpenAPI endpoint because either response keeps API documentation unavailable to the public target.

The API docs helper validates `-BaseUrl` the same way before checking or opening Swagger/OpenAPI URLs.

The API smoke suite covers platform, merchant, and auditor operational flows with role-boundary enforcement, read-only auditor behavior, and concurrent summary checks.

## Script Families

`scripts/api/` contains the lower-level smoke runner, assertion helpers, HTTP helpers, report helpers, and scenario files. The lower-level runner keeps the same validated target URL contract as the quality wrapper so direct scenario runs and saved smoke report provenance cannot drift from wrapper proof. The `scripts/quality/api-smoke.ps1` wrapper is the normal entry point. The smoke suite is broad functional proof, not production load certification; maximum practical load and stress limits are reserved for V17 production activation or later.

Frontend browser-flow scripts expect the local stack to be running and use the React app URL as the browser entry point. Playwright tests live under `frontend/tests/e2e/`, with configuration in `frontend/playwright.config.ts`. The Docker frontend target is controlled with `FRONTEND_TOUR_BASE_URL`.

Reports generated by scripts belong under `reports/`, which is ignored by Git. Report-producing quality scripts normalize local output and report-input paths to canonical filesystem paths before passing them to downstream proof tools or writing provenance fields.

## What Scripts Should Leave In Git

The scripts are local development and verification tooling. Runtime values come from ignored `.env` files, environment variables, command parameters, or explicit local files. Generated reports and local runtime files stay out of Git. Public-readiness checks scan the repository so app source, docs, scripts, CI, compose files, and root guidance stay useful to a developer who just cloned the project.
