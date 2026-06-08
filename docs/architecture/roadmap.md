# MerHouse Roadmap

This roadmap is the project planning and quality source of truth. It should stay short enough for a new maintainer to read before changing code, docs, scripts, CI, database migrations, or repository shape.

## Current Status

MerHouse is a local-development fulfillment coordination system for merchants, warehouse providers, and platform operators. It is deployment-ready as a desktop web app and is being certified as an installable mobile web app in the local-certification sense: Docker Compose, local mocks, proof scripts, tests, docs, and CI are in place. It is not a SaaS production deployment.

The repository is intended to be public-readable. Keep source, docs, scripts, CI, compose files, and root guidance useful to a developer who just cloned the project. Runtime values belong in environment variables, ignored local files, explicit external files, or templates.

## Implemented Product Scope

- Spring Boot API with tenant-aware auth, roles, validation, persistence, Flyway migrations, and OpenAPI metadata.
- React/Vite operations console for platform, support, auditor, merchant, and warehouse users.
- Merchant workflows for inventory, inbound stock, order creation/import, allocation visibility, fulfillment review, notifications, service records, and detail pages.
- Warehouse workflows for receiving, pick/pack/ship, shipment package evidence, exceptions, inventory adjustment, and service evidence.
- Platform workflows for tenants, users, access requests, relationship governance, audit, outbox diagnostics, attention queues, and support/auditor boundaries.
- Service accountability for agreements, proposals, SLA review, service statements, disputes, claims, reviews, and import evidence.
- Account settings with account context and current-password-verified password change.
- Installable mobile web app foundation with PWA manifest, app icon, mobile metadata, online-first service worker, and mobile proof script.
- Local notification records, preferences, action inbox, and delivery history without external provider delivery.
- Deterministic local operations assistant with scoped summaries, review-only suggestions, refusals, decision audit, and no operational mutation.
- Local deployment-readiness harness for checks, smoke flows, browser proof, publication readiness, and mock-provider boundaries.

## Active Work

### V16.1: Mobile-Ready Local Certification

Goal: make MerHouse locally proven as both a desktop web app and an installable mobile web app while keeping one React codebase, one backend, one auth model, and one role-aware product surface.

Mobile in V16.1 means a progressive web app that can be opened from a phone browser, added to the home screen, launched from an app icon, and used across the same local roles and workflows. It does not mean native app-store packaging, native push delivery, offline sync, barcode hardware integration, or a second mobile codebase.

Planned scope:

- PWA install foundation: manifest, app icons, theme/background colors, mobile metadata, routing fallback, and installability proof.
- Mobile app shell: touch-safe navigation, compact account access, safe-area padding, mobile-friendly menus, and no desktop-sidebar dependence.
- Mobile workflow fit: merchant inventory/orders/service review, warehouse receiving/fulfillment/exceptions, notifications, assistant, account settings, and admin/support/auditor routes remain usable on phone viewports.
- Mobile states: first-run empty state, active operating state, blocked/error state, attention/action-needed state, and resolved/history state.
- Mobile proof: Playwright mobile route tour, manifest/installability checks, no horizontal overflow, no clipped controls, no unnamed controls, stable login/session behavior, and no console errors.
- CI/CD proof: keep desktop quality gates and add mobile/PWA checks with uploaded proof reports.
- Documentation: README, docs index, frontend/scripts docs, and this roadmap must explain the mobile boundary and local certification commands.

Acceptance bar:

- local desktop browser tour still passes
- local mobile browser tour passes
- installability/PWA checks pass
- backend/frontend tests still pass
- API smoke still passes
- GitHub Actions quality gate passes
- remaining native-only/mobile-provider work is documented as V17 or VInfinite work

## Local Boundaries

- Notification and password recovery delivery are local records, not real email, SMS, push, or webhook sends.
- Carrier/provider handoff is represented by local outbox and carrier-dispatch records.
- Assistant behavior is deterministic local review assistance, not provider-backed AI.
- Service statements are local service-unit records, not invoices or payment collection.
- Dispute evidence is stored as notes and linked local records, not uploaded legal attachment packets.
- Failed and returned shipments are delivery-state evidence, not full customer RMA/refund/inspection/disposition workflows.
- Health, backup/restore, dependency, and publication-readiness proof are local or dry-run checks.
- V16.1 mobile support is an installable web app, not native app-store deployment.

## Next Work

### V17: Production Deployment Activation

V17 should begin only when MerHouse is intentionally being deployed to real infrastructure.

Planned scope:

- production deployment architecture
- deployment configuration infrastructure
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

## Closeout Bar

Do not call the project closed unless:

- docs, scripts, tests, CI, and code describe the same current system
- public-readiness passes
- markdown links pass
- backend and frontend tests pass
- PWA/mobile installability checks pass
- the browser tour passes for the supported local roles and routes
- any remaining limitation is documented as a local boundary, V17 work, or VInfinite expansion
