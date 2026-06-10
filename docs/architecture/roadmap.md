# MerHouse Roadmap

This roadmap is the project planning and quality source of truth. It should stay short enough for a new maintainer to read before changing code, docs, scripts, CI, database migrations, or repository shape.

## Current Status

MerHouse is a local-development fulfillment coordination system for merchants, warehouse providers, and platform operators. It is deployment-ready as a desktop web app and has a native Android local-certification path that packages the same frontend shell through Capacitor: Docker Compose, local mocks, proof scripts, tests, docs, and CI are in place. It is not a SaaS production deployment or app-store release.

The repository is intended to be public-readable. Keep source, docs, scripts, CI, compose files, and root guidance useful to a developer who just cloned the project. Runtime values belong in environment variables, ignored local files, explicit external files, or templates.

## Implemented Product Scope

- Spring Boot API with tenant-aware auth, roles, validation, persistence, Flyway migrations, and OpenAPI metadata.
- React/Vite operations console for platform, support, auditor, merchant, and warehouse users.
- Merchant workflows for inventory, inbound stock, order creation/import, allocation visibility, fulfillment review, notifications, service records, and detail pages.
- Warehouse workflows for receiving, pick/pack/ship, shipment package evidence, exceptions, inventory adjustment, and service evidence.
- Platform workflows for tenants, users, access requests, relationship governance, audit, outbox diagnostics, attention queues, and support/auditor boundaries.
- Service accountability for agreements, proposals, SLA review, service statements, disputes, claims, reviews, and import evidence.
- Account settings with account context and current-password-verified password change.
- Native Android wrapper that packages the same frontend build through Capacitor without duplicating product code.
- Shared mobile shell metadata with manifest, app icon, and online-first service worker used by the web runtime and native package input.
- Local notification records, preferences, action inbox, and delivery history without external provider delivery.
- Deterministic local operations assistant with scoped summaries, review-only suggestions, refusals, decision audit, and no operational mutation.
- Local deployment-readiness harness for checks, smoke flows, browser proof, bundle/performance budgets, publication readiness, and mock-provider boundaries.

## Recent Certification

### V16.1: Native Android Local Certification

Status: native wrapper implemented; APK assembly and installed-APK route tour are proven locally when Android SDK and a running emulator are available.

Goal: package the existing MerHouse React app as a literal Android debug APK for local proof without creating a second product implementation.

Native mobile in V16.1 means a Capacitor Android wrapper under `frontend/android` that consumes `frontend/dist`, uses the existing API client and role workflows, and points local emulator builds at the local backend through `VITE_API_BASE_URL`. Shared manifest, service worker, mobile metadata, and icon files remain as frontend shell support for web and native packaging; they are not a second mobile product track. It is not an app-store release, native OS notification delivery, push provider rollout, barcode/camera API workflow, or offline sync implementation.

Acceptance bar:

- native wrapper source exists under the same frontend package
- no duplicated frontend pages, routes, API clients, auth model, or role workflows are introduced
- shared mobile shell checks pass
- native structural check passes
- native sync check builds the React app and syncs it into Android
- Android debug APK assembly passes on a machine or CI runner with Android SDK
- installed-APK route tour passes on a running Android emulator
- docs state that mobile local certification is native Android packaging backed by one shared frontend shell

### V16.2: Cross-Surface Real-World Usage Convergence

Status: complete for local-development certification on 2026-06-10; future changes should rerun the matching proof instead of reopening an indefinite loop.

Goal: hunt and close concrete cross-surface bugs until the app behaves coherently for real local users across supported roles, states, and surfaces. The track must prioritize stakeholder-facing defects, dense-state failures, permission mistakes, workflow handoff gaps, frontend/backend state mismatches, performance regressions, and local-boundary drift over repetitive proof-reference cleanup or broad aimless refactoring.

Operating ledger: [Cross-surface V&V convergence](cross-surface-convergence.md) records the completed bug-hunt entries, proof commands, tested stakeholder states, gaps, fixes, remaining risks, final live walkthrough evidence, and the rule that future broad refactoring starts only after bug evidence identifies concrete coupling, redundancy, scalability, separability, or performance issues.

Scope:

- Android native live tour through the installed debug APK, using public auth routes, seeded active owner, merchant, warehouse, support-admin, and auditor accounts, a generated admin account, generated empty merchant and warehouse accounts, and operational detail routes discovered from the APK.
- Web browser live tour through public auth, authenticated role workspaces, account settings, notifications, service accountability, assistant, platform governance, and operational detail routes.
- Real-world usage review for empty-state stakeholders, active stakeholders, role handoffs, attention-first work, local-only provider boundaries, and route-level clarity.
- Documentation, tests, scripts, CI, and system diagrams updated from code and proof results, especially `docs/architecture/system-diagrams.html`.

Acceptance bar:

- Android tour screenshots show route-specific content across all supported stakeholder roles and empty/active states, not loading shells or browser-only simulations.
- Web tour passes desktop and narrow viewports without console errors, horizontal overflow, unlabeled controls, or stale route assumptions.
- Cross-surface report comparison passes with exact active/empty stakeholder coverage on both web and native Android plus exact normalized web/native route-set equality.
- Local performance readiness proof passes frontend bundle budgets, required per-record timed web/native route readiness, required per-record native screenshot-complete timing, and timed API smoke when the seeded local stack and current reports are part of the claim.
- `system-diagrams.html`, README, development docs, scripts docs, and roadmap agree with current backend/frontend/mobile behavior.
- Any remaining limitation is documented as a local boundary, V17 production activation work, or VInfinite product expansion.

## Local Boundaries

- Notification and password recovery delivery are local records, not real email, SMS, phone OS push, lock-screen, notification-tray, or webhook sends.
- Carrier/provider handoff is represented by local outbox and carrier-dispatch records.
- Assistant behavior is deterministic local review assistance, not provider-backed AI.
- Service statements are local service-unit records, not invoices or payment collection.
- Dispute evidence is stored as notes and linked local records, not uploaded legal attachment packets.
- Failed and returned shipments are delivery-state evidence, not full customer RMA/refund/inspection/disposition workflows.
- Health, backup/restore, dependency, and publication-readiness proof are local or dry-run checks.
- Native Android support is a local debug APK wrapper backed by the shared frontend shell, not app-store deployment.

## Next Work

### V17: Production Deployment Activation

V17 should begin only when MerHouse is intentionally being deployed to real infrastructure.

Planned scope:

- production deployment architecture recorded in [Production deployment activation](production-deployment-activation.md)
- external service activation recorded in [V17 external service activation](v17-service-activation.md)
- deployment configuration infrastructure
- professional product proof for performance, load, concurrent users, provider exchanges, cross-platform release behavior, and operations readiness
- provider-backed notification, recovery, carrier, monitoring, backup, rollback, and incident-response operations
- public operational runbooks
- final production validation

### VInfinite: Product Expansion Backlog

These are useful future ideas, not blockers for local readiness:

- customer RMA intake, refund, inspection, and disposition
- bin, lot, serial, expiry, hold, and cycle-count depth
- real carrier labels, manifests, pickups, tracking webhooks, and claims
- uploaded evidence packets and statement-correction ledgers
- legal/business-calendar dispute windows
- payments, banking, tax, accounting, and marketplace workflows
- realtime infrastructure beyond current polling
- provider-backed AI assistant runtime

## Repository Rules

- Keep the repository readable by a new developer: source, docs, scripts, CI, compose files, and root guidance should explain the current system without relying on local working notes.
- Keep local material out of Git: use environment variables, ignored local files, or templates for values that belong to one machine or deployment.
- Keep generated proof local unless a small summary is deliberately documented.
- Keep markdown connected with working local links.
- Update README, docs index, roadmap, scripts docs, and affected architecture docs when behavior or workflow ownership changes.
- Record future work in this roadmap or the affected architecture doc before closing a task.

## Change Quality Rule

Every meaningful change needs matching proof:

- Backend behavior: run backend tests and add focused tests when behavior changes.
- Frontend behavior: run lint, build, and Vitest; run Playwright when routed workflows change.
- Database changes: prove Flyway migrations from an empty database.
- Script changes: parse scripts and update script documentation.
- Documentation changes: keep links current and run markdown proof.
- Repository/publication changes: run the public-readiness script.
- Browser/user-flow changes: run the browser tour or the relevant Playwright route proof.

Normal broad check:

```powershell
.\scripts\quality\check.ps1
```

Heavy local certification:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose
```

When browser and installed-APK reports are available, include both report paths so heavy certification also proves cross-surface parity and report-backed performance readiness. Report paths are paired evidence: pass both web and native paths for report-backed claims, or omit both for the default local gate.

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose `
  -NativeApiBaseUrl "http://10.0.2.2:8080" `
  -WebTourReportPath ".\reports\wrapup-frontend-full-tour.json" `
  -NativeTourReportPath ".\reports\wrapup-native-android-tour.json"
```

## Closeout Bar

Do not call the project closed unless:

- docs, scripts, tests, CI, and code describe the same current system
- public-readiness passes
- markdown links pass
- backend and frontend tests pass
- shared mobile shell checks pass
- native Android sync or APK assembly passes for the local proof level being claimed
- the installed Android APK tour passes when an emulator or device is part of the claim
- the browser tour passes for the supported local roles and routes
- cross-surface tour comparison passes when both browser and installed-APK reports are available
- local performance readiness proof passes
- a final live walkthrough is completed with the reviewer and product owner in the real browser and real installed Android app, covering supported roles, empty/active states, workflows, performance feel, and local-provider boundaries
- any remaining limitation is documented as a local boundary, V17 work, or VInfinite expansion
