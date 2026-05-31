# V15 Frontend Finish Audit

## Purpose

This document is the tracked V15 frontend audit record. It converts the V15 roadmap into route-by-route work so frontend polish, accessibility, responsive behavior, theme support, and proof do not live only in chat or private notes.

V15 should make the local MerHouse console feel professional, accessible, predictable, and efficient for repeated operational work. It is not a production SaaS phase; production deployment, monitoring, backups, and external-provider certification remain V16 work.

## Baseline Proof

Latest starting proof before V15 implementation:

- `.\scripts\quality\check.ps1 -IncludeE2E -SkipCompose` passed on 2026-05-30 after V14 live testing.
- `reports/latest-frontend-full-tour.json` was generated on 2026-05-30 and covered 136 route, role, and viewport records.
- The route tour reported 0 horizontal-overflow records, 0 console-error records, 0 unlabeled visible form-control records, and 0 empty visible interactive-control label records.
- `reports/api-smoke-test-20260530-142704.summary.md` passed after V14 live testing, including assistant API, audit, history scoping, refusal, auditor read-only behavior, and 12 concurrent assistant requests with 0 failures.

The baseline is healthy enough to begin V15, but it is not the V15 finish bar.

## Audit Dimensions

Every row below should be evaluated through these dimensions before V15 closes:

- visual system: spacing, type, color, density, surfaces, buttons, forms, badges, tables, cards, and destructive or privileged actions
- accessibility: semantic headings, explicit labels, keyboard reachability, focus visibility, contrast, status text, interactive state announcements, and reduced-motion behavior where relevant
- responsive behavior: desktop, tablet/narrow, and mobile-sized widths without clipped controls, hidden critical actions, incoherent overlap, or horizontal page overflow
- operational UX: scanability, primary and secondary action clarity, bulk/dense state readability, loading/error/empty states, and repeated-work efficiency
- theme readiness: light and dark theme compatibility, persistent preference, system preference handling, and proof that dense screens remain readable in both themes
- publication boundary: no private data, credentials, internal endpoints, private prompts, or remote visual assets required for local rendering under `backend/` or `frontend/`

## Route Matrix

| Surface | Roles | Routes | Workflow criticality | Current automated baseline | V15 audit status |
| --- | --- | --- | --- | --- | --- |
| Public auth and recovery | Public | `/login`, `/forgot-password`, `/reset-password`, `/request-access` | High: entry, recovery, onboarding | Full-tour proof passes in desktop and narrow viewports | Shared public-auth panel now gives consistent heading hierarchy, light/dark theme control, prototype-local recovery and delivery guardrails, labeled forms, status/error announcements, safe note guidance, and icon-backed primary actions. Focused tests cover the public guardrails and live proof is recorded in `reports/v15-public-auth-polish/public-auth-live-check.json`. |
| Platform overview | Owner, admin, support admin, auditor | `/admin` | High: platform scan and triage | Full-tour proof passes in desktop and narrow viewports | In progress: shared shell/sidebar tokens, metric/table surface polish, row hover states, and light/dark screenshot proof captured under `reports/v15-admin-polish/` |
| Tenant governance | Owner, admin | `/admin/tenants` | High: privileged tenant state changes | Full-tour proof passes in desktop and narrow viewports | In progress: privileged-action guidance, suspension reason scanability, warning styling for suspension actions, and narrow light/dark browser proof recorded under `reports/v15-admin-polish/admin-guidance-live-check.json` |
| User governance | Owner, admin, support admin | `/admin/users` | High: account lifecycle and role safety | Full-tour and admin-console proof pass | Shared table/form/theme polish, privileged-action guidance, pagination framing, reset readiness narration, protected-action cues, warning/destructive styling, and narrow light/dark action proof are recorded under `reports/v15-admin-residue-polish/admin-residue-live-check.json`. |
| Access requests | Owner, admin, support admin | `/admin/access-requests` | High: onboarding control | Full-tour and admin-console proof pass | Shared table/form/theme polish, onboarding review guidance, note scanability, status narration, review/conversion timeline, narrow action review, and light/dark proof are recorded under `reports/v15-admin-residue-polish/admin-residue-live-check.json`. |
| Relationship governance | Owner, admin, support admin, auditor | `/admin/relationships` | High: merchant-provider operating boundary | Full-tour proof passes in desktop and narrow viewports | In progress: operating-boundary guidance, lifecycle timestamp scanability, support/auditor read-only cueing, distinct suspend/end action styling, and narrow light/dark browser proof recorded under `reports/v15-admin-polish/admin-guidance-live-check.json` |
| Outbox diagnostics | Owner, admin, support admin, auditor | `/admin/outbox` | Medium-high: local reliability diagnostics | Full-tour and admin-console proof pass | Shared metric/table/theme polish, diagnostic action grouping, dead-letter reason guidance, timestamp cells, failure details, retry schedules, severity hierarchy, live refresh feedback, and narrow light/dark proof are recorded under `reports/v15-admin-residue-polish/admin-residue-live-check.json`. |
| Audit explorer | Owner, admin, support admin, auditor | `/admin/audit` | High: privileged action review | Full-tour proof passes; V14 live assistant filtering passed | Shared metric/table/theme polish, audit filter guidance, live event-count narration, note/timestamp scanability, focusable keyboard table region, and narrow light/dark proof are recorded under `reports/v15-admin-residue-polish/admin-residue-live-check.json`. |
| Merchant overview | Merchant | `/merchant` | High: merchant operations scan | Full-tour proof passes in desktop and narrow viewports | In progress: operations-scan guidance, backorder/stock-risk emphasis, and narrow light/dark live proof captured under `reports/v15-merchant-polish/`; remaining work is detail-route review |
| Merchant inventory | Merchant | `/merchant/inventory`, `/inventory/items/:inventoryItemId` | High: stock and item operations | Full-tour proof passes in desktop and narrow viewports | In progress: inbound-readiness guidance, stock quantity chips, relationship note scanability, archive/cancel action styling, inventory-detail evidence guidance, and narrow light/dark live proof captured under `reports/v15-merchant-polish/` |
| Merchant orders | Merchant | `/merchant/orders`, `/orders/:orderId` | High: order lifecycle | Full-tour proof passes in desktop and narrow viewports | In progress: order-queue guidance, backorder risk card emphasis, warning treatment for cancel actions, quantity/status scanability, order-detail lifecycle guidance, and narrow light/dark live proof captured under `reports/v15-merchant-polish/` |
| Warehouse operations | Warehouse operator | `/warehouse`, `/shipments/:shipmentId`, `/fulfillment-allocations/:allocationId`, `/inbound-stock-requests/:inboundStockRequestId` | High: receiving, pick/pack/ship, exceptions | Full-tour and admin-console proof pass | In progress: warehouse-console execution guidance, scan/pick-sheet evidence chips, receiving and inventory quantity chips, exception note scanability, warning/destructive action styling, inbound receiving evidence, shipment handoff/package evidence, and allocation pick/ship evidence now have focused tests and narrow light/dark proof under `reports/v15-warehouse-polish/`. |
| Service accountability | Owner, admin, support admin, auditor, merchant, warehouse operator | `/service-accountability` | High: agreements, statements, disputes, claims, reviews, imports | Full-tour and admin-console proof pass | In progress: accountability guidance, clearer risk metrics, SLA breach emphasis, agreement scope/SLA chips, statement/import quantity chips, issue evidence table, review-request coverage, and narrow light/dark live proof are recorded under `reports/v15-service-accountability-polish/`. |
| Assistant | Owner, admin, support admin, auditor, merchant, warehouse operator | `/assistant` | Medium-high: V14 review-only operations assistance | Full-tour and V14 live proof pass | In progress: prototype-local review boundary guidance, local-record/pending/refusal counts, role-aware audit trail link or cue, safer suggestion decision controls, pending-card emphasis, scan-friendly request/response/audit sections, and owner/merchant/warehouse/auditor narrow light/dark proof are recorded under `reports/v15-assistant-polish/`. |
| Notifications | Owner, admin, support admin, auditor, merchant, warehouse operator | `/notifications` | Medium-high: delivery state review | Full-tour and notification E2E proof pass | In progress: prototype-local delivery-boundary guidance, enabled/provider-ready summary metrics, preference timestamps and warning disable actions, unread delivery emphasis, provider-ready warning chips, source id chips, note-cell delivery bodies, and merchant/warehouse narrow light/dark delivery-card proof are recorded under `reports/v15-notifications-polish/`. |
| Relationship details | Owner, admin, support admin, auditor, merchant, warehouse operator | `/merchant-warehouse/relationships/:relationshipId` | Medium-high: operating boundary detail | Full-tour detail-path proof passes | Relationship-boundary guidance, merchant/provider cues, service-note scanability, lifecycle timestamps, activation warnings, richer linked inbound/allocation metadata, timeline, and outbox evidence counts now have focused tests and narrow light/dark live proof in `reports/v15-relationship-detail-polish/relationship-detail-live-check.json`. |

## Initial V15 Gap List

| ID | Gap | Why it matters | First action | Proof needed |
| --- | --- | --- | --- | --- |
| V15-FE-001 | No real light/dark theme system exists yet. | V15 explicitly requires professional theme support with persistent preference and contrast proof. | Closed for V15: theme provider, document `data-theme`, localStorage persistence, system preference default, theme tokens, visible controls, route-level dark-mode polish, and representative screenshots are in place. | `npm run lint`, `npm run build`, `npm test -- --run`, the full route-tour E2E, and `npm run test:e2e -- tests/e2e/v15-accessibility-closeout.spec.ts` pass. Closeout proof records persistent theme preference plus light/dark token contrast in `reports/v15-closeout/v15-accessibility-proof.json`; representative dense light/dark screenshots are referenced through the V15 proof bundle. |
| V15-FE-002 | The visual system is mostly one large stylesheet with many page-specific classes and hard-coded colors. | Professional polish is difficult to apply consistently when colors, status tones, spacing, and surfaces are not fully tokenized. | In progress: sidebar, brand, nav, status, error, row-hover, table, metric, field, and theme tokens were expanded; admin dense routes received the first shared surface polish. Remaining work is broader page-specific hard-coded color cleanup and component extraction where useful. | `npm run lint`, `npm run build`, `npm test -- --run`, and the full route-tour E2E passed after the admin polish slice. Browser screenshots were captured in light/dark for `/admin`, `/admin/audit`, `/admin/users`, `/admin/access-requests`, and `/admin/outbox`. |
| V15-FE-003 | Current E2E proves labels and overflow, but not contrast, focus order depth, live-region behavior, reduced motion, or theme regressions. | V15 accessibility acceptance requires more than the current route-tour checks. | Closed for V15: targeted accessibility closeout now covers keyboard focus visibility, persistent theme preference, light/dark token contrast, public recovery live-region announcements, reduced-motion audit rendering, and focusable dense audit table reachability. | `npm run test:e2e -- tests/e2e/v15-accessibility-closeout.spec.ts` writes `reports/v15-closeout/v15-accessibility-proof.json` and `.summary.md`; latest run passed with focus outline, live-region, reduced-motion, and contrast checks. |
| V15-FE-004 | Dense operational pages pass mechanically, but need human UX review for scanability and repeated-use efficiency. | MerHouse is an operations console; professional quality depends on fast scanning, predictable action grouping, and clear status hierarchy. | In progress: admin users, access requests, tenants, relationships, outbox, audit, merchant overview/inventory/orders/detail evidence views, warehouse console, warehouse detail workflows, service accountability, assistant, notifications, relationship details, and public auth/recovery now have visible guidance, clearer action grouping, and scan-friendly note/timestamp/quantity/evidence treatment. Continue through final V15 proof bundle and accessibility closeout rows. | Route-by-route audit rows updated with before/after notes and screenshots for desktop and narrow viewports; focused admin, merchant, warehouse, service-accountability, assistant, notification, relationship-detail, and public-auth tests passed for the guidance/action grouping slices; live narrow light/dark route checks are recorded in `reports/v15-admin-polish/admin-guidance-live-check.json`, `reports/v15-admin-residue-polish/admin-residue-live-check.json`, `reports/v15-merchant-polish/merchant-live-check.json`, `reports/v15-merchant-polish/merchant-detail-live-check.json`, `reports/v15-warehouse-polish/warehouse-live-check.json`, `reports/v15-warehouse-polish/warehouse-detail-live-check.json`, `reports/v15-service-accountability-polish/service-accountability-live-check.json`, `reports/v15-assistant-polish/assistant-live-check.json`, `reports/v15-assistant-polish/assistant-auditor-live-check.json`, `reports/v15-notifications-polish/notifications-live-check.json`, `reports/v15-relationship-detail-polish/relationship-detail-live-check.json`, and `reports/v15-public-auth-polish/public-auth-live-check.json`. |
| V15-FE-005 | Assistant UX is functionally proven but still prototype-shaped. | V14 behavior is safe, but V15 should make review-only assistant interactions easier to trust and audit. | In progress: assistant review-boundary guidance, pending suggestion emphasis, decision reason framing, role-aware audit link/cue, request/response/audit card sections, and deterministic risk-ranked suggestion copy are implemented. | `.\mvnw.cmd -Dtest=AssistantServiceTest clean test` from `backend/`, `npm test -- --run src/pages/AssistantPage.test.tsx`, full frontend proof, and owner/merchant/warehouse/auditor narrow light/dark browser proof passed under `reports/v15-assistant-polish/`. |
| V15-FE-006 | Screenshot proof exists in scattered reports, not a V15-specific evidence set. | V15 closeout needs a deliberate professional-frontend proof bundle. | Closed for V15: `reports/v15-closeout/v15-accessibility-proof.json` references the generated V15 evidence set under `reports/v15-*`, verifies each referenced report exists, and proves the bundle stays outside the future public app source boundary. | `reports/v15-closeout/v15-accessibility-proof.summary.md` lists the V15 closeout checks, while the JSON report records every referenced screenshot/report path for admin, merchant, warehouse, service accountability, assistant, notifications, relationship detail, and public auth/recovery proof. |

## Working Order

1. Build the V15 audit and proof harness from this baseline.
2. Establish design tokens and theme infrastructure.
3. Polish shared shell, navigation, buttons, forms, tables, cards, badges, empty/error/loading states, and focus treatment.
4. Work route groups in priority order: public auth, platform admin, merchant, warehouse, service accountability, assistant, notifications, details.
5. Capture screenshots and route evidence as each route group closes.
6. Run full proof: lint, build, Vitest, Playwright, markdown, publication boundary, sensitive scans, and any V15-specific screenshot/a11y proof.

## Status

V15 frontend finish is ready for owner acceptance. The route matrix, theme infrastructure, dense workflow polish, public auth/recovery polish, targeted accessibility proof, and V15 generated evidence bundle are now tracked here. The roadmap quality gate passed with `.\scripts\quality\check.ps1 -IncludeE2E -SkipCompose`, and the final live acceptance sweep is recorded in `reports/v15-closeout/final-live/v15-final-live-acceptance.json` with 11 routes, 0 unexpected console errors, 0 horizontal overflow failures, 0 unlabeled controls, 0 unnamed buttons, 0 horizontally offscreen controls outside intentional scroll regions, and 0 missing expected-content checks before moving into Pre-V16.

## V15.3 Human Comprehension Gate

The 2026-05-31 live owner review found a real product-quality gap: MerHouse can pass route, accessibility, and workflow checks while still feeling difficult for a fresh human to understand. V15.3 owns that gap before AI-agent or Pre-V16 expansion.

Human-comprehension acceptance means a first-time but capable user can tell:

- which role mode they are in
- what each navigation item means without decoding internal shorthand
- which alerts require action and which are only history
- which empty state blocks progress and what prerequisite comes next
- which copy is essential guidance and which copy should be shortened or removed
- which icons identify different workflows rather than repeating one visual metaphor

Quality-of-life actions from the live review:

| ID | User-facing problem | Action | Proof needed |
| --- | --- | --- | --- |
| V15.3-HC-001 | Navigation labels such as `Relations` and `Service` are too insider-ish for new users. | Replace shorthand with plain workflow labels and keep visible labels aligned with role tasks. | App layout tests and live route tour. |
| V15.3-HC-002 | Some guidance panels over-tell while some empty states still under-guide. | Shorten repeated explanation, keep one concrete next step, and avoid long boundary language on daily surfaces. | Focused page tests and fresh-account browser proof. |
| V15.3-HC-003 | Service accountability and partner relationships share too much icon language. | Split service review, partner relationship, access, and governance icons into distinct visual meanings. | Component/app-shell tests and visual live pass. |
| V15.3-HC-004 | Alert severity reads improved but still needs sharper action language. | Use critical, action-needed, review, and cleared language consistently in summary metrics and cards. | Notification tests and live notification proof. |
| V15.3-HC-005 | The app needs a new-user quality-of-life audit, not just engineering proof. | Maintain a route-by-route add/delete/change list before closing V15.3. | Updated audit row plus live closeout report. |

First V15.3 slice proof on 2026-05-31:

- `npm test -- --run AppLayout NotificationCenterPage MerchantPages WarehousePage`
- `npm run lint`
- `npm run build`
- `.\scripts\quality\markdown-check.ps1`
- Docker frontend rebuild and in-app browser role cycle across owner, merchant, and warehouse accounts. The pass verified the new navigation labels, notification wording, no visible notification `prototype` wording, merchant `Start with risk` guidance, warehouse `Work queue` label, and no captured browser console errors. One exact text assertion for `Start with today's work` was rechecked by visible DOM excerpt because apostrophe serialization made the first automated boolean too brittle.
- `.\scripts\quality\check.ps1 -IncludeE2E -SkipCompose` passed after aligning Playwright expectations with the new human-facing labels and notification severity names.

Second V15.3 slice:

- Merchant inventory now shows a compact `Merchant setup path` checklist for first SKU, warehouse partner, inbound stock, and first order readiness.
- Merchant inbound and order forms now explain missing prerequisites beside disabled actions instead of relying only on disabled button state.
- Warehouse console now shows a compact `Warehouse setup path` checklist for partner access, inbound receiving, queue work, and exceptions.
- Warehouse relationship and inbound rows now explain why actions are locked after activation, receipt, cancellation, rejection, or draft-only states.
- Focused proof passed with `npm test -- --run MerchantPages WarehousePage`, `npm run lint`, `npm run build`, `.\scripts\quality\markdown-check.ps1`, and an in-app browser proof of the merchant and warehouse checklist surfaces after rebuilding the Docker frontend.

User-perspective V15.3 quality-of-life backlog:

| Change type | What to change | Why it matters |
| --- | --- | --- |
| Add | A first-run checklist per role: merchant should see stock, partner, inbound, and order prerequisites; warehouse should see partner activation, receiving, queue, and exception prerequisites. | Empty accounts need momentum without requiring a builder's knowledge of the system. |
| Add | Stronger page-local action hierarchy: one primary next action, secondary utilities, and disabled-button reasons near the blocked action. | New users should not scan every table to infer what to do next. |
| Add | Plain-language status glossary in compact tooltips or inline help for domain-heavy states like `REQUESTED`, `PREPARED`, `LOCAL_RECORDED`, and service review types. | Operational status names are necessary, but they should not feel like backend enum leakage. |
| Delete | Repeated boundary/proof copy from daily workflow pages once the user has enough context. | Over-telling makes the console feel less professional and slows repeated use. |
| Delete | Duplicate visual metaphors where unrelated workflows share the same icon or severity styling. | Icons should help recognition; repeated symbols make the app feel unfinished. |
| Change | Rename insider shorthand in visible navigation and headings before deeper feature expansion. | Navigation is the user's mental model; unclear labels make every page feel harder. |
| Change | Treat alert severity as a work queue, not a delivery log: critical, action needed, review, and cleared. | The notification center must tell users what deserves attention now. |

## V15.1 UI Signature Start

The V15.1 pass begins with shared user-facing polish before deeper Pre-V16 hardening. The first slice removes customer-facing "prototype" wording from public auth, assistant, and notification surfaces while keeping release-boundary truth in the roadmap and engineering documentation; replaces the default favicon with a MerHouse-owned local mark; upgrades the shell brand mark and alert icon behavior; gives notification cards severity language; and expands shared empty states into role-aware next-step guidance instead of dead-end blank panels.

The first proof set is focused frontend coverage for app-shell unread badge behavior, public auth wording, assistant review language and empty guidance, notification alert language and empty guidance, plus the standard route-tour and accessibility proof required before V15.1 can close.

The first-run empty-state proof is now tracked in `reports/v15-1-ui-signature/empty-state-live-check.json`. It creates fresh merchant and warehouse accounts with no operational history, then proves guided empty states for merchant overview, inventory, orders, service accountability, assistant, notifications, warehouse console, and warehouse service/assistant/notification surfaces. Screenshot evidence lives beside the report under `reports/v15-1-ui-signature/`.

Notification alerting is now split into distinct critical, needs-action, for-review, and resolved visual lanes instead of a single broad warning treatment. The focused proof covers unread count behavior, severity rendering, resolved/read quieting, and a live notification-center route with realistic delivery records; evidence is tracked in `reports/v15-1-ui-signature/notification-alert-live-check.json` with screenshots in the same report folder.

The icon and state consistency sweep now centralizes MerHouse's shared icon language for navigation, auth, workflow states, alerts, assistant, inventory, orders, warehouse execution, service, audit, and not-found cases. Shared loading, error, and empty states now render accessible, purpose-specific symbols instead of a single generic state treatment, with focused component proof in `frontend/src/components/DataState.test.tsx`.

V15.1 closeout proof passed on 2026-05-31 with `.\scripts\quality\check.ps1 -IncludeE2E -SkipCompose`. The gate covered backend tests, frontend lint, frontend build, Vitest, the full Playwright suite, markdown links, publication-boundary checks, CI naming, sensitive-file checks, and sensitive-pattern scans. During closeout the Playwright suite was made serial at the worker level because these E2E tests intentionally share one seeded local stack; this avoids connection-refused cascades and state races while preserving the route-tour and workflow proof.

The final live browser sweep checked `/login`, `/admin`, `/assistant`, `/notifications`, `/service-accountability`, and a stale inventory-detail URL. The authenticated routes showed the shared icon language, no visible customer-facing "prototype" wording, no stuck loading state, and real unread alert labeling; the stale inventory-detail URL landed in the intentional error/not-found treatment instead of a broken page.
