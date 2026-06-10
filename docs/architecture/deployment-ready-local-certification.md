# Deployment-Ready Local Certification

V16.2 prepares MerHouse for future deployment without deploying it now. The phase proves that the codebase, configuration, docs, scripts, and local runtime are shaped for deployment later while every external dependency remains local, mocked, or explicitly deferred.

## Boundary

V16.2 is not a SaaS launch. It does not provision cloud infrastructure, send email, SMS, phone OS push, lock-screen, notification-tray, or webhook traffic, activate realtime infrastructure, or claim production monitoring. Actual production activation is deferred to a later optional phase.

## Local Mock Contracts

| Dependency | Local proof | Future replacement |
| --- | --- | --- |
| Notification delivery | Recipient-scoped in-app delivery records, preferences, provider status, and action inbox proof. | Email, SMS, phone OS push, lock-screen, notification-tray, or webhook delivery with callbacks, bounce handling, and deliverability monitoring. |
| Password recovery delivery | Local reset records with token echo disabled by default; API smoke can enable token echo only for local proof. | Provider-backed reset delivery and recovery runbook. |
| Carrier/provider handoff | Local outbox events and carrier-dispatch records. | Real carrier or delivery-provider adapter with idempotent callbacks and retry policy. |
| Assistant/model behavior | Deterministic local review assistance and audit records. | Optional local or provider-backed model runtime with prompt/data boundary proof. |
| Monitoring-style health | Health endpoint, readiness checks, quality scripts, and local proof reports. | Production monitoring, alerting, log retention, and incident response. |
| Backup/restore | Local dry-run script path and schema/data proof against the Docker database when requested. | Production backup schedule, restore drill, rollback procedure, and retention policy. |

## Account Settings

Authenticated users have `/account` for self-service account context and password changes. The page is deliberately narrow: it shows email, role, tenant id, enabled state, created timestamp, local security notes, and links back to Alerts and Service Review. Users can change their own password only by providing the current password. Email, role, tenant, and enabled-state governance remain under platform account management.

## Proof Commands

Daily quality remains:

```powershell
.\scripts\quality\check.ps1 -IncludeE2E -SkipCompose
```

V16.2 deployment-ready proof uses the separate gate:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -SkipCompose
```

When browser and installed-APK tour reports are available, use the report-aware form so deployment readiness also proves cross-surface parity, clean report-backed performance readiness, and timed API smoke:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose `
  -NativeApiBaseUrl "http://10.0.2.2:8080" `
  -WebTourReportPath ".\reports\v16.2-loop-163-frontend-full-tour.json" `
  -NativeTourReportPath ".\reports\v16.2-loop-163-native-tour.json"
```

Local performance readiness proof uses frontend bundle budgets and optional timed smoke/tour report checks:

The deployment gate treats web and native report paths as paired evidence. Passing only one of `-WebTourReportPath` or `-NativeTourReportPath` fails before proof runs; omit both only for the default local gate when current paired reports are not part of the claim. When both are supplied, deployment readiness resolves and checks the report files before markdown, public-readiness, mobile shell, native sync, cross-surface comparison, performance readiness, or broad quality proof starts, then passes the resolved paths to downstream report-aware checks. `performance-readiness.ps1` uses the same all-or-none rule for `-WebReportPath` and `-NativeReportPath` so route timing cannot be claimed from one surface only. When both report paths are supplied, it resolves and checks them before the frontend build starts, then prints the resolved web/native report inputs and resolved performance report output path. Report-backed JSON and terminal output record the supplied and resolved web/native report paths plus validated browser and installed-APK provenance snapshots for traceability. Browser report provenance must include absolute HTTP(S) app/API URLs; installed-APK provenance must include an absolute HTTP(S) API URL and at least one nonblank device or emulator serial. Deployment readiness keeps host API smoke and native Android API routing separate: `-ApiBaseUrl` controls timed host-side API smoke, while `-NativeApiBaseUrl` is validated and passed to native sync so Android-bound assets use the emulator or device-reachable backend URL. The local and quality scripts share `url-guard-lib.ps1` for nonblank absolute HTTP(S) validation across local readiness and seed helpers, native build API bases, frontend proxy checks, OpenAPI docs, browser tours, installed-APK tours, API smoke, performance readiness, deployment readiness, and saved report provenance.

```powershell
.\scripts\quality\performance-readiness.ps1
```

Scripted proof is necessary but not sufficient for final V16.2 convergence. The final validation step must be a live walkthrough with the reviewer and product owner in the real browser and real installed Android app, covering supported stakeholder roles, active and empty states, workflow handoffs, performance feel, and local-provider boundaries. Use the [cross-surface convergence checklist and evidence template](cross-surface-convergence.md#final-live-walkthrough-checklist) to run and record that session.

When the seeded local stack is running and API smoke proof is desired, the deployment and performance gates validate the API smoke target as a non-blank absolute `http` or `https` URL before heavy proof starts:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose -NativeApiBaseUrl "http://10.0.2.2:8080"
```

## Current Scripted Certification Proof

The latest scripted V16.2 local certification proof uses the rebuilt local Docker stack and does not perform real deployment. This proof is current for scripted V&V/QC/QA, but final V16.2 convergence still requires the live browser and installed-Android walkthrough recorded through the cross-surface checklist.

- `.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose -WebTourReportPath ".\reports\v16.2-loop-163-frontend-full-tour.json" -NativeTourReportPath ".\reports\v16.2-loop-163-native-tour.json"` passed before `-NativeApiBaseUrl` was made explicit, covering markdown proof, public-readiness proof, shared mobile shell proof, native sync proof through the default `http://10.0.2.2:8080`, cross-surface parity, report-backed performance readiness, timed API smoke, backend tests, frontend lint/build/Vitest, Playwright E2E, and broad quality proof.
- API smoke passed against the running local stack inside performance readiness and wrote `reports/performance-api-smoke.summary.md`.
- Live browser QC checked 188 routed desktop/narrow records across public auth, owner/platform, support-admin, auditor, active and empty merchant, active and empty warehouse, service review, assistant, notifications, account settings, and operational detail routes with 0 horizontal overflow findings, 0 unnamed buttons or links, 0 unlabeled form controls, 0 real forbidden/unauthorized app states, and 0 console errors.
- Live action proof covered fresh local stakeholders and operating records through relationship setup, inbound receiving, stock readiness, order allocation, notifications, warehouse fulfillment, account settings, and service review.
- The 2026-06-10 V16.2 cross-surface loop refreshed a 100-record installed Android APK tour across public routes, owner, generated admin, support-admin, auditor, active merchant, empty merchant, active warehouse, empty warehouse, and discovered operational detail routes. The current native report records APK SHA-256 `34a1549b2b9370779f958839ede8a9d004d62a23cced53ad6c5dafedfb1aabd7`, APK byte size `4457642`, API URL `http://localhost:8080`, connected emulator/device serial `emulator-5554`, checked timestamp, and checked-route count. The report recorded 0 bad route records, 0 horizontal overflow findings, 0 unnamed controls, and 0 unlabeled form controls.
- `.\scripts\quality\cross-surface-tour-check.ps1` passed against the browser and installed-APK tour reports, proving browser report provenance with absolute HTTP(S) app/API URLs, installed-APK API/device provenance, valid native PNG screenshot evidence, exact normalized web/native role/path set equality, and that both reports are free of loading shells, bad statuses, overflow, unnamed controls, and unlabeled controls. The pass log now also prints the resolved web/native report paths, browser/native targets, APK SHA-256, device serials, checked timestamps, and record counts so the QC transcript can be traced to the exact paired evidence.
- Earlier report-aware gates passed against `reports/v16.2-loop-016-native-timed-tour.json`; those runs proved timed web/native route readiness before APK fingerprint, device, and checked-route provenance were required.
- The current full report-aware command shape is `.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose -NativeApiBaseUrl "http://10.0.2.2:8080" -WebTourReportPath ".\reports\v16.2-loop-163-frontend-full-tour.json" -NativeTourReportPath ".\reports\v16.2-loop-163-native-tour.json"`. The latest historical full report-aware pass used the same native default before that parameter was surfaced explicitly.
- API smoke in the current full gate ran inside `performance-readiness.ps1`, proving the API-smoke timing budget is recorded with the same performance report surface as frontend build timing and web/native route timing.
- `.\scripts\quality\performance-readiness.ps1` passed local frontend build, bundle budgets, required browser report provenance with absolute HTTP(S) app/API URLs, required native APK/nonblank-device/timestamp/checked-route provenance with an absolute HTTP(S) API URL, required native PNG screenshot file evidence with positive image dimensions, required per-record web route-ready timing, required per-record native route-ready timing, required per-record native screenshot-complete timing, and timed API smoke when supplied the current timed reports and seeded local stack. The latest full report-aware gate recorded 8.86-second build time, 139.65 KB total gzipped JS/CSS, 188 web route records with slowest `routeReadyMs` 1067 ms, 100 native route records with slowest `routeReadyMs` 7292 ms, slowest native `screenshotMs` 2482 ms, and 29.29-second API smoke timing under the 120-second smoke budget. This remains deployment-shaped local proof, not production load, monitoring, autoscaling, or provider-delivery certification.
- The GitHub quality gate runs the default performance readiness proof in the frontend job so bundle budgets are checked in CI.

## Future Activation Checklist

- Replace local notification and recovery delivery with configured providers.
- Replace local carrier/provider records with real provider adapters.
- Keep assistant behavior deterministic unless an explicit V17 or VInfinite activation chooses local-model-backed or provider-backed behavior with prompt/data boundary proof.
- Add production monitoring, alerting, logs, backup/restore, rollback, and incident-response runbooks.
- Re-run public-readiness certification before publishing the repository.
