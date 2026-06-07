# Structural Stabilization

## Purpose

MerHouse has reached the point where adding more product behavior without structural cleanup increases risk. This stabilization track exists to make the codebase easier to reason about, split, test, document, and publish before deeper roadmap work continues.

This is not a rewrite. Stabilization should preserve current behavior while reducing large-file pressure, unclear ownership, duplicated workflow glue, and script/proof drift.

## Current Structural Risks

- Backend services are organized by technical layer, but several services now own multiple workflow concerns. `ServiceAccountabilityService`, `MerchantWarehouseService`, `OperationalDetailService`, and `FulfillmentService` are the highest-risk examples.
- Backend package names describe implementation layer more than product capability. That makes it harder to see the boundary around relationships, inbound work, fulfillment, notifications, service accountability, assistant behavior, and admin governance.
- Frontend route files group too many workflows into broad role pages. `AdminPages.tsx`, `MerchantPages.tsx`, and `WarehousePage.tsx` are difficult to change safely because data loading, forms, action handlers, table rendering, empty states, and workflow copy live together.
- Frontend API types and client calls are centralized in large files. That keeps early development simple, but it weakens ownership as domains grow.
- Playwright route tours and demo seed scripts encode important product truth, but they are large and hard to audit by workflow.
- Documentation describes the current layout, but it does not yet define structural rules for future code movement.

## Stabilization Principles

- Preserve user-facing behavior unless a refactor explicitly fixes a documented bug or gap.
- Move code by capability boundary, not by aesthetic preference.
- Keep each slice small enough to prove with focused backend tests, frontend tests, route proof, or script proof.
- Extract shared utilities only when they remove real duplication or clarify ownership.
- Avoid moving private or sensitive material into `backend/` or `frontend/`.
- Update docs and tests in the same slice as the structural change.
- Do not close a slice while generated proof, scripts, docs, and roadmap language disagree.

## Target Boundaries

### Backend

Backend code should gradually move from broad layer-only ownership toward capability ownership while keeping Spring Boot conventions readable.

Candidate capability boundaries:

- `admin`: platform summary, tenants, users, access requests, audit, outbox diagnostics
- `auth`: login, current user, recovery, access request public entry points
- `inventory`: inventory items, warehouse stock, adjustment evidence
- `merchantwarehouse`: merchant-provider relationships, inbound stock, authorized stock
- `fulfillment`: allocations, workload, shipment creation, package evidence, exceptions
- `serviceaccountability`: agreements, statements, disputes, claims, reviews, SLA calculations
- `notifications`: preferences, deliveries, connected alert fan-out, source navigation contracts
- `assistant`: deterministic assistant interactions and audit behavior
- `details`: operational detail/timeline readers
- `outbox`: outbox publishing, processing, adapter behavior

The first backend cleanup should extract orchestration helpers from large services before moving packages. Package moves should come after tests clearly identify stable contracts.

### Frontend

Frontend code should move from broad role pages toward feature modules.

Candidate feature module shape:

```text
frontend/src/features/<feature>/
  api.ts
  components/
  pages/
  tests/
  types.ts
```

Initial feature candidates:

- `admin`
- `merchant`
- `warehouse`
- `notifications`
- `service-accountability`
- `assistant`
- `operational-details`
- `auth`

Shared UI should stay under `frontend/src/components` only when it is truly cross-feature. Role-specific tables, forms, and guidance panels should live near the feature that owns them.

### Scripts

Scripts should have clear roles:

- `scripts/local`: start, stop, wait, seed, and developer runtime helpers
- `scripts/quality`: proof gates and report-generating checks
- `scripts/api`: scenario smoke tests and reusable API helpers
- `scripts/maintenance`: cleanup and housekeeping

Large scripts should be split only when the split improves proof ownership. The seed script is a prime candidate for helper extraction by scenario or fixture family.

### Documentation

Docs should state the boundary being changed before code moves.

Structural changes should update:

- `README.md` when repository layout or common commands change
- `docs/index.md` when durable docs are added, removed, or renamed
- development guides when code organization, test commands, or script behavior changes
- architecture docs when product workflow ownership changes
- the roadmap when phase ownership or proof gates change

## Suggested Work Sequence

1. Stabilization baseline
   - Finish or park the current V15.5 connected-alert work.
   - Confirm the dirty tree is coherent.
   - Run backend, frontend, markdown, and publication-boundary proof.

2. Backend service seams
   - Extract repeated notification and alert fan-out helpers.
   - Extract service-accountability calculation/building helpers where tests already cover behavior.
   - Extract fulfillment shipment/package/exception helpers where behavior is already tested.
   - Keep controller routes and DTO names stable.

3. Frontend feature seams
   - Split route files by exported page first, without changing routes.
   - Move role-specific tables/forms/guidance panels next to their page.
   - Extract shared route data hooks only after duplicate data-loading patterns are visible.
   - Keep route names and visible copy stable unless the slice explicitly closes a documented UX gap.

4. API client and type ownership
   - Split frontend API types by domain after page modules are split.
   - Keep a compatibility barrel if needed so imports can migrate gradually.
   - Avoid changing backend contracts during frontend-only organization work.

5. Script and proof cleanup
   - Give each quality script a documented responsibility and expected runtime condition.
   - Split seed-demo helpers by fixture family only when a slice proves the resulting script remains deterministic.
   - Keep broad `check.ps1` as the top-level gate.

6. Package/module cleanup
   - Move backend packages only after helper extraction has reduced large services.
   - Move tests with the code they prove.
   - Keep public API paths stable unless a roadmap item explicitly changes them.

## Proof Gates

Every stabilization slice needs at least one focused proof and one broad safety proof.

Use focused proof for the changed area:

- backend service extraction: affected service tests plus `backend-check.ps1`
- frontend page split: affected Vitest files plus `frontend-check.ps1`
- routed workflow split: affected Vitest files plus Playwright route proof when a seeded stack is available
- script split: execute the script in the documented mode, or parse plus document why full execution was not run
- docs-only stabilization: `markdown-check.ps1`

Use broad safety proof before closing a meaningful slice:

```powershell
.\scripts\quality\backend-check.ps1
.\scripts\quality\frontend-check.ps1
.\scripts\quality\markdown-check.ps1
.\scripts\quality\public-readiness.ps1
```

Run `.\scripts\quality\check.ps1 -IncludeE2E -SkipCompose` when a seeded local stack is available and routed workflows were affected.

## Non-Goals

- Do not rewrite the application architecture from scratch.
- Do not introduce production SaaS deployment behavior before V16.
- Do not move private notes, prompts, credentials, or operational context into `backend/` or `frontend/`.
- Do not change API routes, database schema, or UI behavior just to make files look cleaner.
- Do not close this stabilization track by file movement alone; the result must be easier to prove.

## Stabilization Log

Use this section to record structural slices before V15.8 closes.

| Slice | Boundary changed | Behavior contract | Proof | Status |
| --- | --- | --- | --- | --- |
| Connected alert fan-out | Introduced `ConnectedAlertService` so merchant, warehouse-provider, and platform notification recipient selection is not repeated across fulfillment, merchant-warehouse, outbox, and service-accountability services. | Existing V15.5 local in-app alert topics, titles, bodies, source types, and source ids remain unchanged. | `.\scripts\quality\backend-check.ps1`; `.\scripts\quality\frontend-check.ps1`; `.\scripts\quality\markdown-check.ps1`; `.\scripts\quality\public-readiness.ps1` | Started before V15.8 was added; ready for closeout once the active dirty tree is either committed or deliberately parked. |
| Notification feature seam | Moved the notification page implementation and display rules under `frontend/src/features/notifications/`, leaving `frontend/src/pages/NotificationCenterPage.tsx` as a route-level re-export. | `/notifications` keeps the same route import, visible alert cards, severity labels, source links, unread behavior, and prototype-wording cleanup. | `.\scripts\quality\frontend-check.ps1` | Completed as first V15.8 frontend seam. |
| Shared page chrome | Extracted repeated page headings, guidance panels, workflow dividers, first-run checklists, quantity cells, and short-id formatting into `frontend/src/components/PageChrome.tsx` and `frontend/src/components/format.ts`. | Admin, merchant, warehouse, assistant, operational detail, service-accountability, and notification surfaces keep the same class names, headings, checklist markup, and dense quantity display. | `.\scripts\quality\frontend-check.ps1` | Completed. |
| Service-accountability alert routing | Moved agreement, statement, dispute, claim, and review counterparty alert routing into `ServiceAccountabilityAlertService`. | Service-accountability transitions keep the same alert topics, titles, bodies, source types, and source ids; actor-aware counterparty fan-out is now tested separately from workflow state transitions. | `.\scripts\quality\backend-check.ps1` | Completed. |
| Outbox alert routing | Moved retry, dead-letter, and processor-failure health alert routing into `OutboxAlertService`. | Outbox health alerts keep the same `OUTBOX_HEALTH` topic, platform-recipient fan-out, titles, bodies, source types, and source ids while admin and processor services depend on an outbox-specific seam. | `.\scripts\quality\backend-check.ps1` | Completed. |
| Operations alert topic routing | Introduced `OperationsAlertService` and moved merchant-warehouse plus fulfillment operations alerts onto it. | Relationship, inbound, allocation, shipment, and fulfillment-exception alerts keep the same `OPERATIONS` topic, recipient side, titles, bodies, source types, and source ids while workflow services no longer choose notification topics directly. | `.\scripts\quality\backend-check.ps1` | Completed. |
| Admin feature page seams | Moved admin outbox and audit page implementations under `frontend/src/features/admin/`, leaving `frontend/src/pages/AdminPages.tsx` as the stable route/test export barrel. | `/admin/outbox` and `/admin/audit` keep the same route exports, loading states, actions, tables, labels, filtering, and empty-state copy while their feature-specific API calls and table components live outside the broad admin role page. | `.\scripts\quality\frontend-check.ps1` | Completed. |
