# Cross-Surface V&V Bug-Hunt Convergence

MerHouse V16.2 used this focused bug-hunting convergence track for the shared web and native Android product surface. The local-development closeout completed on 2026-06-10 after live browser and installed-APK walkthrough evidence found and fixed the final admin overview loading blocker in `BH-052`.

This page is the durable evidence ledger for that track. Read it with the [roadmap](../architecture/roadmap.md), [native Android local certification](native-android-local-certification.md), [deployment-ready local certification](deployment-ready-local-certification.md), and [system diagrams](../architecture/system-diagrams.html).

## Reset Rule

The previous numbered loop history was cleared from this active ledger on 2026-06-10 because it had become too easy to keep polishing proof wording or report references instead of hunting defects. Prior scripted evidence still matters as local context, but it is no longer the operating loop.

New convergence entries start at `BH-001`. Each entry must name a concrete suspected bug or risk, the evidence that makes it worth investigating, the user-facing impact, the fix or decision, and the proof that closed or narrowed it.

## Wrap-Up Certification Directive

As of 2026-06-10, V16.2 convergence must stop micromanaged loop expansion. The operating target is to wrap up local-only deployment readiness through visible browser and installed-APK behavior, V&V/QC/QA gates, and real-world performance checks.

Use this directive before opening another bug hunt:

- Run the live browser route/workflow proof and inspect what the rendered product actually does.
- Run the APK assembly, install, and Android route tour when Android SDK plus a running emulator or device are available; if unavailable, record that exact local blocker and continue only with non-blocked browser/API/docs readiness work.
- Fix only defects surfaced by live browser behavior, installed-APK behavior, certification gates, report inspection, or clear code/runtime contradictions.
- Do not add speculative edge-case work just because it can be imagined. If the case is not valid for local deployment-ready V16.2, document the boundary or leave it for V17/VInfinite.
- Prefer one wrap-up checkpoint with clean proof over many small loop entries. Keep the tree clean after each wrap-up pass.

## Operating Definition

Every action possible means every meaningful stakeholder workflow, route, state transition, empty and active state, error or denial boundary, and cross-role handoff. It does not mean mechanically clicking duplicate utility controls after the durable workflow contract is already covered.

The track uses V&V, QC, and QA as separate checks:

- Verification: prove the implementation matches the documented contract through tests, scripts, builds, screenshots, and reports.
- Validation: live-test whether real local users can complete stakeholder workflows without confusing states, stale copy, broken handoffs, hidden assumptions, or bad performance feel.
- Quality control: close concrete defects found in a bug hunt before expanding scope.
- Quality assurance: improve focused tests, scripts, docs, or diagrams only when doing so prevents the same defect class from returning.

## Bug-Hunt Order

1. Read the roadmap QC rules and the latest bug-hunt entry.
2. Pick one high-value file group or workflow surface from current evidence: stakeholder workflow, dense data, state transition, permission boundary, web/native mismatch, frontend/backend contract, performance smell, or local-provider boundary.
3. Inspect current code and runtime evidence before assuming prior loops already proved it.
4. Reproduce or reason to a concrete failing contract. If no bug is found, record the evidence briefly and move to a different target.
5. Fix only the evidenced gap. Do not refactor broadly unless the bug proves coupling, redundancy, scalability, separability, or performance risk.
6. Add focused proof first, then run the matching broader gate required by the roadmap change quality rule.
7. Validate the affected stakeholder workflow visually before calling the iteration done. Use a live browser pass for web/shared React behavior and an installed-APK pass when the changed behavior affects native Android proof or shared mobile parity. The iteration is not done until the tests and the relevant live surface behavior show the intended effect; if a live surface cannot be run in the loop, record the exact blocker, keep the remaining risk visible, and move to the next non-blocked bug target instead of looping forever.
8. Add a concise bug-hunt ledger entry with remaining risk and the next best target.

Each iteration should converge quickly: close the evidenced defect, prove it through tests and live surface behavior, clean runtime residue, then advance to the next high-value target. Do not keep expanding the same loop into adjacent refactors unless tests or live browser/APK behavior expose that adjacent defect. The target is local-development, deployment-ready, real-world V&V/QC/QA behavior, not indefinite polishing.

## Working Tree Hygiene Rule

Each bug-hunt iteration must keep the working tree scoped and reviewable:

- Start by checking the current dirty state and naming which dirty files are in scope for the selected target.
- Treat pre-existing broad dirty state as baseline context only; do not edit unrelated dirty files to make a new iteration look tidy.
- If closing a target would require many unrelated files, stop and record the need for a commit, staging, revert, or split strategy before expanding.
- Before closeout, run scoped status for the files touched in the iteration, remove runtime logs and temporary proof data, and record any intentionally retained report artifacts.
- A ledger entry may not be called done until the touched source, test, script, doc, and diagram files are named, the matching proof has run, live browser or APK behavior has been validated when relevant, and generated residue has been cleaned.

## File-By-File Audit Queue

Use this queue to avoid wandering. Each pass chooses one row, audits the named files from code outward, closes evidenced bugs and test gaps, updates durable docs and `system-diagrams.html` when behavior changes, then records the result as a `BH-*` entry before moving on.

| Queue | File group | Audit focus | Status |
| --- | --- | --- | --- |
| 1 | Notification backend, frontend, tests, and docs | Recipient scoping, unread/action/history state, source routes, dense records, local-provider boundary, web/native shared rendering | Covered through `BH-001` to `BH-003` and `BH-034`; live walkthrough evidence closed in `BH-052` |
| 2 | Auth, account lifecycle, password reset, and access requests | Public routes, local reset boundary, account-ready handoff, validation, denial, fake credential repeatability | Covered through `BH-004` to `BH-008`; live browser sign-in CORS bug under `BH-035`; live walkthrough evidence closed in `BH-052` |
| 3 | Admin governance pages and services | Dense tenants/users, access-request conversion, support/auditor boundaries, relationship governance, outbox diagnostics | Covered through `BH-009` to `BH-012`; final live walkthrough admin loading defect closed in `BH-052` |
| 4 | Merchant operations pages and services | Inventory, inbound stock, order create/import, allocation visibility, backorders, notification handoffs | In progress through `BH-013` to `BH-016` |
| 5 | Warehouse operations pages and services | Receiving, pick/pack/ship/deliver/fail/return, package evidence, exceptions, stock adjustments | In progress through `BH-017` to `BH-019`; receiving and shipment evidence validation closed in `BH-039` to `BH-041` |
| 6 | Service accountability pages and services | Agreements, statements, disputes, claims, reviews, SLA risk, cross-party alerts | In progress through `BH-020` to `BH-024`, `BH-036`, `BH-045`, and `BH-046` |
| 7 | Operational detail routes | Route permissions, linked timelines, source-route parity, empty/not-found/denied states | In progress through `BH-025` to `BH-027`; platform-safe inventory recovery closed in `BH-042` |
| 8 | Native Android shell and shared mobile proof | Shell-only boundary, API base sync, installed APK route behavior, screenshots, no duplicate product code | In progress through `BH-028` to `BH-029`; fresh web paired with latest native evidence in `BH-037`; refreshed APK/API-base proof in `BH-038`; cross-surface screenshot evidence proof tightened in `BH-047`; final live browser/APK walkthrough recorded in `BH-052` |
| 9 | Quality scripts and CI | Proof target validation, paired report rules, performance budgets, broad gate determinism | In progress through `BH-030` to `BH-031` and `BH-047` |
| 10 | Architecture docs and diagrams | Roadmap, README, docs index, scripts docs, system diagram agreement with code and local boundaries | In progress through `BH-032` to `BH-033` |

## Coverage Priorities

| Priority | What to hunt |
| --- | --- |
| Cross-surface correctness | Shared React routes, API client behavior, role permissions, labels, empty states, active-state summaries, notification badges, account actions, assistant refusals, service accountability handoffs, and local-boundary copy must mean the same thing on web and native Android. |
| Stakeholder workflows | Public auth/recovery/access request, owner/admin governance, support/auditor review, merchant inventory/orders/inbound/service review, warehouse receiving/pick/pack/ship/evidence, account settings, notifications, assistant, and operational details. |
| Dense and edge states | Empty users, accumulated local proof data, pagination, capped lists, validation errors, denied actions, stale sessions, slow routes, local proof database drift, and bounded result sets. |
| Frontend/backend sync | Visible UI state must reflect backend counts, permissions, transitions, and source-route ownership. Native differences must stay shell-only unless documented. |
| Performance readiness | Route responsiveness, backend/API smoke timing, obvious transactional or N+1 risks, Android WebView readiness, screenshot-complete timing, and clear local-only limits. |

## Proof Commands

Use the smallest proof that matches the bug first.

Android local proof:

```powershell
.\scripts\proof\android\mobile-shell-check.ps1
.\scripts\proof\android\native-mobile-check.ps1 -Sync
.\scripts\proof\android\native-mobile-check.ps1 -Assemble -ApiBaseUrl "http://10.0.2.2:8080"
.\scripts\proof\android\native-android-tour.ps1
```

Web local proof:

```powershell
.\scripts\quality\frontend-check.ps1 -IncludeE2E -SkipInstall
.\scripts\proof\web\frontend-full-tour.ps1
```

Broad proof:

```powershell
.\scripts\quality\check.ps1 -IncludeE2E -SkipCompose
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose
.\scripts\quality\markdown-check.ps1
.\scripts\quality\public-readiness.ps1 -SkipCompose
.\scripts\proof\release\cross-surface-tour-check.ps1
.\scripts\proof\release\performance-readiness.ps1
```

Do not claim future convergence from scripts alone. Later releases that change stakeholder workflows, native packaging, local-provider boundaries, or performance-critical routes must repeat a live walkthrough in the real browser and real installed Android app.

## Final Live Walkthrough Checklist

Use this checklist only after the current scripted full gate is green. The goal is validation by real use, not another automated route sweep.

1. Confirm local stack and installed APK readiness: API health is up, browser app opens, debug APK is installed, and the Android app points at the local backend through the validated native API base used for APK assembly.
2. Start in the real installed Android app. Visit public login, password recovery, reset, and access-request routes; confirm local-only recovery and notification wording, including that no phone OS push, lock-screen, notification-tray, email, SMS, webhook, or provider delivery is claimed.
3. In Android, sign in as owner, generated admin, support-admin, auditor, active merchant, empty merchant, active warehouse, and empty warehouse. For each role, confirm navigation, denied boundaries, account settings, alerts, service review, assistant scope, empty-state guidance, and active-state summaries.
4. In Android, walk at least one merchant-to-warehouse handoff end to end: relationship or inbound request, warehouse approval/receiving, merchant review, notification source route, and relevant operational detail route.
5. In Android, walk order allocation and warehouse fulfillment states: create or inspect allocation, pick/pack/ship/deliver or failure/return evidence, shipment package evidence, exception handling, and timeline visibility.
6. In Android, confirm performance feel while moving between high-traffic routes, including dashboard, inventory/orders, warehouse queue, notifications, service accountability, assistant, and operational details.
7. Repeat the same meaningful paths in the real browser, including desktop and narrow viewport checks where layout or control density matters.
8. Compare web and Android together: labels, empty states, permissions, local-provider boundary copy, attention counts, notification badges, account actions, assistant refusals, and service accountability state should mean the same thing on both surfaces.
9. Record every mismatch as a bug-hunt entry before closing the session. Fix high-impact gaps before expanding scope.
10. Close V16.2 only when the reviewer and product owner agree that the real browser and real installed Android app behave coherently for the supported local workflows, and any remaining limitation is documented as a local boundary, V17 activation, or VInfinite backlog.

## Manual Walkthrough Evidence Template

Copy this template into a new top-of-ledger `BH-*` entry when the final live walkthrough starts. Keep the evidence short, factual, and tied to what the reviewer and product owner actually observed.

```markdown
### BH-XXX: Final Live Browser And Installed-APK Walkthrough

Date:
Reviewer:
Product owner:
Local stack:
- Browser app URL:
- API URL:
- Native API base used for APK assembly:
- APK path:
- APK SHA-256:
- Android device or emulator:

Scripted gate prerequisite:
- Frontend browser tour report:
- Native Android tour report:
- Cross-surface comparison:
- Performance readiness:
- Deployment readiness:

Android walkthrough evidence:
- Public auth/recovery/access-request routes:
- Owner/admin/support/auditor role boundaries:
- Active merchant workflow:
- Empty merchant state:
- Active warehouse workflow:
- Empty warehouse state:
- Merchant-to-warehouse handoff:
- Allocation/fulfillment/shipment evidence:
- Notifications, account, assistant, and service review:
- Performance feel:
- Local-provider boundary wording:

Browser walkthrough evidence:
- Desktop routes and workflows:
- Narrow viewport routes and workflows:
- Role/permission parity with Android:
- Labels, empty states, badges, alerts, and local-boundary copy:
- Performance feel:

Mismatches found:
- None, or link each mismatch to a new `BH-*` entry.

Fixes completed during walkthrough:
- None, or link each fix to proof.

Decision:
- Converged / not converged.
- Reviewer/product-owner notes:
- Remaining limitations recorded as local boundary, V17 activation, or VInfinite backlog:
```

## Bug-Hunt Entry Template

Each entry should include:

- Date and bug-hunt id.
- Target and suspected bug.
- Why this target matters.
- Surfaces, roles, states, and workflows inspected.
- Evidence found.
- Fix or decision.
- Proof run.
- Remaining risk and next target.

## Current Bug-Hunt Ledger

### BH-052: Final Live Walkthrough Found Android Admin Overview Blocking On Slow Ledgers

Date: 2026-06-10.

Reviewer/product owner mode: the reviewer asked the agent to drive the live browser and installed Android APK directly, observe the visible behavior, fix only actual defects, and stop once local V&V/QC/QA evidence converges.

Local stack:

- Browser app URL: `http://localhost:3000`
- API URL: `http://localhost:8080`
- Native API base used for APK assembly: `http://10.0.2.2:8080`
- APK path: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
- Latest installed APK SHA-256 after the fix: `190ca192ff8f29d5dc1c87670f13a6b891c67373bf598c74bf2b2a2e670e0f20`
- Android emulator: `emulator-5554`

Evidence:

- Installed Android APK was opened visibly on the `Pixel_7` emulator. The login, forgot-password, access-request, owner/admin, support-admin, auditor, active merchant, empty merchant, active warehouse, empty warehouse, notification, service-accountability, assistant, and account surfaces were driven through the WebView and checked with screenshots under `reports/final-live-walkthrough/android`.
- Browser live proof drove the same shared React surface at `http://localhost:3000` for public routes, owner/admin, active/empty merchant, active/empty warehouse, notifications, service accountability, assistant, and account routes with screenshots under `reports/final-live-walkthrough/browser`.
- The browser pass recorded 21 visible screens, 0 console errors, and no suspicious loading/error/overflow findings.
- The first installed-APK pass recorded 37 visible screens, but manual screenshot review showed owner/support/auditor `/admin` remained on the full-page `Loading admin overview` card after the rest of the app was usable.

Observed bug:

- The admin overview required `api.orders`, `api.adminSummary`, and `api.adminTenantHealth` to finish together before rendering any admin content.
- In the dense local proof database, orders and tenant-health ledgers could take seconds in Android WebView, so the primary admin attention queue looked stuck even though `adminSummary` returned quickly and the user could already act on platform attention elsewhere.
- This affected web and Android because both surfaces use the same React route; Android made the defect obvious through the real installed APK.

Fix:

- `AdminOverviewPage` now renders the primary admin overview from `adminSummary` only.
- Recent operational orders and tenant health now load as independent secondary ledgers with their own loading and error states.
- The route still shares one React implementation across web and native Android; no native-only workaround was added.

Proof:

- `npm --prefix frontend run test -- AdminManagement.test.tsx` passed with 31 tests, including a regression that leaves orders and tenant health unresolved while proving the admin summary renders and the full-page `Loading admin overview` card is gone.
- `npm --prefix frontend run build` passed before rebuilding the APK.
- `.\scripts\proof\android\native-mobile-check.ps1 -Assemble -ApiBaseUrl "http://10.0.2.2:8080"` passed and produced APK SHA-256 `190ca192ff8f29d5dc1c87670f13a6b891c67373bf598c74bf2b2a2e670e0f20`.
- The rebuilt APK was installed, opened, and rechecked on `/admin`; `reports/final-live-walkthrough/android/04-owner-admin-fixed-final.png` and `reports/final-live-walkthrough/android/04-owner-admin-fixed-viewport.png` show the real admin overview with only secondary ledger loading.
- `.\scripts\quality\frontend-check.ps1 -IncludeE2E -SkipInstall` passed after the fix, covering lint, build, Vitest, and Playwright E2E.

Remaining risk:

- The earlier 100-record scripted native tour remains valid for broad cross-surface coverage before this fix, while the latest APK proof is targeted to the live defect and rebuilt APK. Regenerate the full paired browser/native scripted reports only if the next release needs a new report-aware transcript; do not keep looping solely to refresh report fingerprints.
- Production push notifications, email/SMS delivery, app-store release, monitoring, autoscaling, and real provider delivery remain outside local V16.2 and belong to later activation.

### BH-051: Final Walkthrough Evidence Template Was Promised But Missing

Date: 2026-06-10.

Target and suspected bug:

- Final live walkthrough closeout documentation in `docs/quality/cross-surface-convergence.md`.
- The docs index and scripts guide referenced a manual walkthrough evidence template, but the convergence ledger only had a checklist.

Why this target matters:

- The remaining V16.2 closeout blocker is the live reviewer/product-owner walkthrough, not more speculative refactoring.
- Without a structured template, the final session could become another chat promise instead of durable V&V/QC/QA evidence.

Working-tree scope for this iteration:

- `docs/quality/cross-surface-convergence.md`

Evidence found:

- `docs/index.md` described the convergence page as containing a manual walkthrough evidence template.
- `docs/development/scripts.md` instructed maintainers to record reviewer/product-owner results with that template.
- No `Manual Walkthrough Evidence Template` section existed in the convergence page.

Fix or decision:

- Added a `Manual Walkthrough Evidence Template` section directly after the final live walkthrough checklist.
- The template records local stack details, APK fingerprint/device evidence, scripted gate prerequisites, Android and browser walkthrough observations, mismatches, fixes, convergence decision, and remaining limitations.

Proof run:

- `.\scripts\quality\markdown-check.ps1` passed.
- `git diff --check` passed.
- `rg -n "Manual Walkthrough Evidence Template|manual walkthrough evidence template|Final Live Browser And Installed-APK Walkthrough" docs README.md -S` confirmed the docs index and scripts guide references now resolve to the template section in this ledger.

Remaining risk and next target:

- Final human live walkthrough remains required before the active goal can be completed.

### BH-050: Current Proof References Drifted Across Docs And Script Defaults

Date: 2026-06-10.

Target and suspected bug:

- README, script docs, deployment certification docs, roadmap command examples, system diagrams, and `cross-surface-tour-check.ps1` defaults after the wrap-up proof.
- The risk was cross-file drift: future proof runs could silently use old loop-163 report names while current certification evidence lives in the wrap-up reports.

Why this target matters:

- V16.2 closeout requires docs, scripts, tests, and diagrams to describe the same current local certification state.
- Report-aware proof is paired evidence, so stale default paths can turn a current QC claim into an accidental historical rerun.

Working-tree scope for this iteration:

- `README.md`
- `docs/quality/cross-surface-convergence.md`
- `docs/quality/deployment-ready-local-certification.md`
- `docs/architecture/roadmap.md`
- `docs/architecture/system-diagrams.html`
- `docs/development/scripts.md`
- `scripts/proof/release/cross-surface-tour-check.ps1`

Evidence found:

- README, roadmap, script docs, deployment certification docs, and the cross-surface script defaults still referenced `v16.2-loop-163` report paths after the current wrap-up reports had replaced them.
- README and deployment certification docs still referenced an older installed-APK fingerprint instead of `b252a277e01ca00370491a95a8873262acf6fa76d2dca3869a154d15792e995d`.
- `system-diagrams.html` described focused bug hunts, but not the current wrap-up rule that live browser/APK behavior and gate output should drive only evidenced fixes.

Fix or decision:

- Current command examples and `cross-surface-tour-check.ps1` defaults now use `reports/wrapup-frontend-full-tour.json` and `reports/wrapup-native-android-tour.json`.
- Current certification prose now records the wrap-up APK fingerprint and byte size.
- The historical BH-037 ledger entry keeps its old report artifact references but now says they were the then-latest reports at that point.
- The system diagram convergence card now states that browser behavior, installed-APK behavior, reports, or gate output drive bug fixes; `BH-052` later records the completed live reviewer/product-owner walkthrough evidence.

Proof run:

- `.\scripts\proof\release\cross-surface-tour-check.ps1` passed with its default report paths, proving the script now resolves `reports/wrapup-frontend-full-tour.json` and `reports/wrapup-native-android-tour.json` by default. The pass printed 188 web records, 100 native Android records, 82 normalized role/path pairs, native API URL `http://localhost:8080`, and native APK SHA-256 `b252a277e01ca00370491a95a8873262acf6fa76d2dca3869a154d15792e995d`.
- `.\scripts\quality\markdown-check.ps1` passed.
- `git diff --check` passed.

Remaining risk and next target:

- Final human live walkthrough remains required before the active goal can be completed.
- If proof passes, the next target should be the live walkthrough preparation or any new surfaced gate/runtime blocker, not broad speculative refactoring.

### BH-049: Wrap-Up Certification Replaced Micromanaged Looping

Date: 2026-06-10.

Target and suspected bug:

- V16.2 wrap-up readiness across live browser, installed APK, cross-surface parity, performance, API smoke, and deployment-ready local gates.
- The risk was process drift: continuing small speculative loop work instead of proving the real local product surfaces and fixing only surfaced blockers.

Why this target matters:

- The project goal is local-only deployment readiness with V&V/QC/QA evidence, not endless theoretical refactoring.
- Browser and installed Android behavior are the authoritative validation surfaces for the shared React product.
- Performance readiness and deployment certification need to prove the same web/native reports, not separate partial claims.

Working-tree scope for this iteration:

- `docs/quality/cross-surface-convergence.md`
- `frontend/src/index.css`
- `frontend/tests/e2e/admin-console.spec.ts`
- `frontend/tests/e2e/full-tour.spec.ts`
- `scripts/api/scenarios/12-backorder-status.ps1`

Surfaces, roles, states, and workflows inspected:

- Live Docker frontend at `http://localhost:3000` and backend at `http://localhost:8080`.
- Browser tour across public routes, owner, admin, support-admin, auditor, active merchant, empty merchant, active warehouse, and empty warehouse states.
- Installed Android debug APK on `Pixel_7` emulator, device serial `emulator-5554`.
- Native public/auth, admin, service-accountability, assistant, notifications, account, merchant, warehouse, and operational detail routes.
- Cross-surface web/native report comparison.
- Performance readiness with bundle budgets, route-readiness timing, screenshot timing, and timed API smoke.
- Deployment-ready local certification gate.

Evidence found:

- Browser full tour passed with 188 route records, zero console-error records, zero overflow records, and zero unlabeled-control records.
- Native Android APK assembled successfully for `http://10.0.2.2:8080`; refreshed APK SHA-256 is `b252a277e01ca00370491a95a8873262acf6fa76d2dca3869a154d15792e995d`.
- Installed-APK tour passed with 100 native records and 100 pulled PNG screenshots.
- Manual visual inspection of `reports/wrapup-native-android-tour/96-warehouse_empty-warehouse.png` found a real mobile layout defect first, then confirmed the fixed empty-warehouse screen no longer stretched the sidebar/header into a large blank region before page content.
- Cross-surface tour check passed with 188 web records, 100 native records, and 82 normalized role/path pairs.
- Performance readiness initially found a real proof blocker: API smoke expected a fulfilled all-backorder order to become `ALLOCATED`, while backend service tests and behavior keep the order `BACKORDERED` because fulfilling a backorder does not synthesize a fulfillment allocation.
- Browser route proof found stale receiving workflow assumptions in two Playwright flows: they expected the retired `Receive all` shortcut instead of the current `Start receiving` and `Post receipt` flow used by the warehouse UI and component tests.

Fix:

- `scripts/api/scenarios/12-backorder-status.ps1` now expects the fulfilled all-backorder order to remain `BACKORDERED`, matching `OrderServiceTest` and current backend behavior.
- `frontend/src/index.css` now keeps the mobile app shell and sidebar aligned to the top so short mobile states do not stretch navigation into visual dead space in the Android WebView.
- `frontend/tests/e2e/full-tour.spec.ts` now proves the harmonic inbound workflow by clicking `Post receipt` after `RECEIVING`.
- `frontend/tests/e2e/admin-console.spec.ts` now proves the older V8 operating loop through the actual `APPROVED` -> `RECEIVING` -> `Post receipt` -> `RECEIVED` transition.
- The wrap-up directive above now requires live browser/APK proof first and forbids speculative micromanaged loop expansion unless a live surface, gate, report, or clear runtime contradiction exposes the defect.

Proof run:

- `.\scripts\proof\web\frontend-full-tour.ps1 -BaseUrl "http://localhost:3000" -ApiUrl "http://localhost:8080" -OutputPath ".\reports\wrapup-frontend-full-tour.json"` passed 5 Playwright tests and wrote the browser tour report plus action reports.
- `.\scripts\proof\android\native-mobile-check.ps1 -Assemble -ApiBaseUrl "http://10.0.2.2:8080"` passed and built `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.
- `.\scripts\proof\android\native-android-tour.ps1 -ApiUrl "http://localhost:8080" -OutputPath ".\reports\wrapup-native-android-tour.json" -ScreenshotDirectory ".\reports\wrapup-native-android-tour"` passed on `emulator-5554`.
- `.\scripts\proof\release\cross-surface-tour-check.ps1 -WebReportPath ".\reports\wrapup-frontend-full-tour.json" -NativeReportPath ".\reports\wrapup-native-android-tour.json"` passed.
- `.\scripts\proof\release\performance-readiness.ps1 -IncludeApiSmoke -ApiBaseUrl "http://localhost:8080" -WebReportPath ".\reports\wrapup-frontend-full-tour.json" -NativeReportPath ".\reports\wrapup-native-android-tour.json" -OutputPath ".\reports\wrapup-performance-readiness.json"` passed after the smoke expectation fix.
- `Push-Location frontend; npm exec -- playwright test tests/e2e/admin-console.spec.ts --project=chromium -g "merchant and warehouse complete the V8 operating loop through the UI"; Pop-Location` passed the targeted stale E2E workflow after the `Post receipt` update.
- `.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose -WebTourReportPath ".\reports\wrapup-frontend-full-tour.json" -NativeTourReportPath ".\reports\wrapup-native-android-tour.json" -NativeApiBaseUrl "http://10.0.2.2:8080"` passed.

Remaining risk and next target:

- Final human live walkthrough with the reviewer/product owner remains the closeout validation ceremony before calling the full convergence goal complete.
- Keep future work to surfaced live/gate blockers only; do not reopen speculative bug loops without new observed evidence.

### BH-048: Notification Load-More Failure Kept Stale Success Feedback

Date: 2026-06-10.

Target and suspected bug:

- Shared web/native notification center feedback state after a successful preference update followed by a failed load-more action.

Why this target matters:

- The notification center is the shared stakeholder alert surface for web and native Android.
- Dense local proof data can expose pagination and retry paths that are easy to miss in route-load tests.
- Showing a success message beside a newer failure makes the actual state ambiguous for merchants, warehouse users, support, and owners reviewing alerts.

Working-tree scope for this iteration:

- `frontend/src/features/notifications/NotificationCenterPage.tsx`
- `frontend/src/pages/NotificationsRoutePage.test.tsx`
- `docs/quality/cross-surface-convergence.md`

Surfaces, roles, states, and workflows inspected:

- Notification center action inbox dense state with more unread alerts than the first loaded page.
- Preference update success feedback.
- Load-more alert failure feedback.
- Shared React route behavior used by browser and Android WebView.

Evidence found:

- `loadMoreActions()` and `loadMoreHistory()` cleared the previous error before retrying, but did not clear the previous success message.
- A user could disable a notification preference, see `Account lifecycle in app updated.`, then click `Load more alerts`; if the page request failed, the failure message appeared while the stale success remained visible.

Fix:

- `loadMoreActions()` and `loadMoreHistory()` now clear stale success feedback before starting the paged request.
- `NotificationsRoutePage.test.tsx` now proves a failed `Load more alerts` request removes the previous preference-update success message before showing the load-more error.

Proof run:

- `npm --prefix .\frontend run test -- NotificationsRoutePage.test.tsx` passed with 10 tests.
- `.\scripts\quality\markdown-check.ps1` passed.
- Cleanup checkpoint proof: `.\scripts\quality\check.ps1 -SkipCompose` passed backend tests, frontend lint/build/Vitest, shared mobile shell check, native mobile sync, markdown, repository shape, CI naming, local-folder/runtime boundary, and token-shaped value scan.

Remaining risk and next target:

- Live browser validation for the same visible feedback transition is required before calling this iteration fully closed.
- Installed Android APK proof remains blocked until an emulator or device is connected; because this route is shared React behavior, it must be rechecked during the required final APK walkthrough.
- Runtime residue should be cleaned before advancing.

### BH-047: Cross-Surface Report Check Did Not Enforce Native Screenshot Evidence

Date: 2026-06-10.

Target and suspected bug:

- `scripts/proof/release/cross-surface-tour-check.ps1` paired browser/installed-APK report proof.

Why this target matters:

- The Android acceptance bar requires route-specific installed-APK screenshots, not just JSON route records.
- `performance-readiness.ps1` already validates native PNG screenshot evidence, but cross-surface parity is the gate that reviewers naturally run to compare web and installed APK reports.
- If screenshot files were moved, deleted, blank placeholders, or invalid, cross-surface comparison could still claim role/path parity from stale JSON records.

Surfaces, roles, states, and workflows inspected:

- Cross-surface report parser and clean-record checks in `tour-report-lib.ps1`.
- Cross-surface role/path comparison in `cross-surface-tour-check.ps1`.
- Performance readiness native screenshot evidence validation.
- Script documentation and native/deployment certification docs.

Evidence found:

- `cross-surface-tour-check.ps1` called native provenance and clean-record checks, but did not call `Assert-NativeScreenshotEvidence`.
- `performance-readiness.ps1` did call `Assert-NativeScreenshotEvidence`, so the two report-aware gates disagreed on whether native screenshots were required.
- Documentation described installed-APK proof as screenshot-backed, so the cross-surface gate was weaker than the documented Android V&V bar.

Fix:

- `cross-surface-tour-check.ps1` now calls `Assert-NativeScreenshotEvidence -ProjectRoot $projectRoot -Records $nativeRecords` after native report provenance validation.
- `docs/development/scripts.md`, `docs/quality/deployment-ready-local-certification.md`, and `docs/quality/native-android-local-certification.md` now state that cross-surface report proof validates native PNG screenshot evidence.

Proof run:

- Negative synthetic report proof failed as expected: `.\scripts\proof\release\cross-surface-tour-check.ps1 -WebReportPath reports\runtime\bh-047\web.json -NativeReportPath reports\runtime\bh-047\native-missing.json` rejected the native report with `Native Android tour report is missing valid PNG screenshot evidence for 1 record(s): PUBLIC /login`.
- Positive synthetic report proof passed: `.\scripts\proof\release\cross-surface-tour-check.ps1 -WebReportPath reports\runtime\bh-047\web.json -NativeReportPath reports\runtime\bh-047\native-valid.json` checked 100 web records, 80 native records, and 40 normalized role/path pairs.
- PowerShell parser proof passed for `scripts/proof/release/cross-surface-tour-check.ps1`.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Installed Android APK live proof remains blocked until an emulator or device is connected; this fix tightens report validation when native reports are available.
- Continue Queue 9 script proof-target validation, then return to user-facing workflow bugs.

### BH-046: Pending Service Review Alerts Looked Like Passive Review

Date: 2026-06-10.

Target and suspected bug:

- Shared web/native notification severity for service-accountability review-request alerts.

Why this target matters:

- A service review request is an approve/reject handoff between counterparties.
- Backend notification summaries already expose unread non-outbox alerts as `ACTION_NEEDED` attention signals.
- The notification card severity should not understate a pending service review as passive history when a stakeholder needs to act.

Surfaces, roles, states, and workflows inspected:

- Backend service-accountability alert fanout for merchant, warehouse, and platform actors.
- Backend notification summary source-route mapping for service-accountability sources.
- Frontend notification source links and severity classification used by the shared web/native React route.
- Existing notification page route and severity tests.

Evidence found:

- `ServiceAccountabilityAlertService` correctly sends merchant-created service review requests to the warehouse side and platform actions to both service parties.
- Backend `NotificationService` routes `ServiceReviewRequest` attention signals to `/service-accountability`.
- Frontend `notificationSourceHref` also routes `ServiceReviewRequest` cards to `/service-accountability`.
- Frontend `notificationSeverity` did not classify `Service review requested` as action-needed because its service-accountability action terms covered disputes and claims, but not review requests.

Fix:

- `notificationSeverity` now treats `review requested` as an action-needed term.
- `NotificationsRoutePage.test.tsx` now proves an unread `SERVICE_ACCOUNTABILITY` delivery titled `Service review requested` renders as an action card while ordinary service preference/history text remains review severity.
- `docs/architecture/notifications.md` and `docs/architecture/system-diagrams.html` now describe pending service-review-request alerts as action-needed local inbox work.

Proof run:

- `npm --prefix .\frontend run test -- NotificationsRoutePage.test.tsx` passed with 9 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and 164 Vitest tests.
- `.\scripts\quality\markdown-check.ps1` passed.
- Live browser proof signed in as `review.operator@merhouse.local`, opened `/notifications`, and verified the warehouse recipient saw the BH-046 `Service review requested` card as `Action needed` with source type `ServiceReviewRequest`, source id prefix `e54b2b90`, and `Open source` linked to `/service-accountability`.
- Cleanup approved the live proof review through the warehouse service-review API and marked both the warehouse request delivery and merchant resolution delivery read.
- Installed Android APK proof remains blocked until an emulator or device is connected; the notification route is shared by the Android WebView and must be rechecked in the required final APK walkthrough.

Remaining risk and next target:

- Continue service-accountability alert parity only if live proof exposes another mismatch; otherwise move to the next queue target.

### BH-045: Service Review Retry Could Show Stale Success Beside Failure

Date: 2026-06-10.

Target and suspected bug:

- Shared `/service-accountability` review-request action feedback.

Why this target matters:

- Service review requests are stakeholder-facing handoffs between merchants, warehouses, and platform roles.
- A retry failure must not leave a previous success banner visible, or live V&V can falsely imply that a new review was created.
- The route is shared by web and Android WebView, so transient feedback correctness is a cross-surface contract.

Surfaces, roles, states, and workflows inspected:

- Merchant service-accountability route with an active agreement.
- `Request review` success state followed by a failed retry.
- Existing service statement, issue-resolution, agreement, read-only auditor, dense-ledger, and empty-state tests.
- Backend mutation permissions for service agreements, statements, disputes, claims, and reviews.

Evidence found:

- `handleRequestReview` cleared errors before submission but did not clear the previous success message.
- Other service-accountability mutation handlers already cleared `message` before attempting their next action.
- A failed retry could therefore render `Review request created.` beside `Unable to create review request.`, making local validation misleading.

Fix:

- `handleRequestReview` now clears the previous success message before creating a review request.
- `ServiceAccountabilityPage.test.tsx` now proves a successful review request followed by a failed retry removes the stale success message and shows only the failure state.
- `docs/architecture/service-accountability.md` and `docs/architecture/system-diagrams.html` document that service-accountability transient feedback must not preserve stale success after failed review retries.

Proof run:

- `npm --prefix .\frontend run test -- ServiceAccountabilityPage.test.tsx` passed with 12 tests.
- The first attempted focused command used unsupported Vitest option `--runInBand`; it failed before exercising code and was replaced by the valid command above.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and 164 Vitest tests.
- `.\scripts\quality\markdown-check.ps1` passed.
- Live browser proof signed in as `review.merchant@merhouse.local`, opened `/service-accountability`, verified the active-agreement `Request review` action was available, clicked it, and observed exactly one `Review request created.` success banner with no `Unable to create review request.` error banner while remaining on the shared service-accountability route.
- Cleanup resolved the newly created pending review through the authorized owner API path with outcome note `Closed after BH-045 live browser feedback proof.`.
- Installed Android APK proof remains blocked until an emulator or device is connected; this route is shared by the Android WebView and must be rechecked in the required final APK walkthrough.

Remaining risk and next target:

- The failed-retry stale-success state is covered by focused Vitest because the live local backend does not provide a safe browser-only way to force the second review request to fail without altering shared runtime state; keep this as a final live-tour stress case if a controlled API-failure mode is added.
- Continue Queue 6 bug hunting around service-accountability alert parity, then move to the next high-value frontend/backend contract target if no service bug remains.

### BH-044: Merchant Integer Quantities Could Submit Decimal Values

Date: 2026-06-10.

Target and suspected bug:

- Merchant inbound stock and merchant order creation quantity controls in the shared React route tree.

Why this target matters:

- Inbound stock requests and order item requests use integer backend DTO fields.
- The shared web/native merchant UI used browser number inputs with `Number(...)`, which can hold decimal values.
- Decimal merchant quantities would either fail at the API boundary or create confusing local validation behavior after the user already tried to submit stock or demand.

Surfaces, roles, states, and workflows inspected:

- `MerchantInventoryPage` inbound stock draft/submit controls.
- `MerchantOrdersPage` single-order and draft-line controls.
- Backend `CreateInboundStockRequest` and `CreateOrderItemRequest` integer quantity contracts.
- Merchant workflow docs and `system-diagrams.html`.
- Live browser route state as the local merchant user.

Evidence found:

- `MerchantInventoryPage` allowed `requestedQuantity` to become a decimal and used that same value in draft and submitted inbound payloads.
- `MerchantOrdersPage` allowed the single order quantity and draft line quantity to become decimal values before calling `api.createOrder`.
- Pasted order imports already had positive whole-number validation, but the interactive merchant forms did not match that contract.

Fix:

- Inbound stock quantity now requires a positive whole number before `Save draft` or `Submit inbound` can call the API.
- Order quantity now requires a positive whole number before `Add line` or `Create order` can proceed.
- Quantity inputs use `step="1"` and visible helper copy when decimal values are present.
- The create-order submit handler also guards the same contract so keyboard submission cannot bypass the disabled button state.
- `MerchantPages.test.tsx` now proves decimal inbound and order quantities are blocked before API calls.
- `docs/architecture/merchant-warehouse-operating-loop.md` and `docs/architecture/system-diagrams.html` document the merchant positive whole-number quantity contract.

Proof run:

- `npm --prefix .\frontend test -- src/pages/MerchantPages.test.tsx --run --no-file-parallelism` passed with 19 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed lint, production build, and 163 Vitest tests.
- `.\scripts\quality\markdown-check.ps1` passed before ledger closeout.
- Live browser proof signed in as `review.merchant@merhouse.local`; on `/merchant/inventory`, a decimal inbound quantity showed `Inbound quantity must be a positive whole number.` once and disabled `Save draft` and `Submit inbound`; on `/merchant/orders`, a decimal order quantity showed `Order quantity must be a positive whole number.`, removed `Add line`, and disabled `Create order`.

Remaining risk and next target:

- Installed Android APK proof remains blocked until an emulator or device is connected; the fixed merchant routes are shared by web and native Android and should be rechecked during the final APK tour.
- Continue merchant/warehouse frontend-backend contract hunting around remaining state transitions and service-accountability numeric forms.

### BH-043: Shared Warehouse-Work Detail Recovery Copy Was Warehouse-Only

Date: 2026-06-10.

Target and suspected bug:

- Shared operational detail recovery states for orders, inbound stock, shipments, and fulfillment allocations.

Why this target matters:

- Inbound, shipment, allocation, and order detail routes are shared by merchant, warehouse, and platform roles.
- Merchant pages, warehouse pages, notifications, and platform review surfaces can all link into the same detail route tree.
- A recoverable denied, missing, or stale state must give copy and actions that agree with the signed-in stakeholder.

Surfaces, roles, states, and workflows inspected:

- `OrderDetailPage`, `InboundStockRequestDetailPage`, `ShipmentDetailPage`, and `FulfillmentAllocationDetailPage` recoverable error and unavailable states.
- Merchant shipment recovery and auditor allocation recovery tests.
- Operational detail docs and `system-diagrams.html`.
- Live browser route state as the local auditor user.

Evidence found:

- The recovery links were role-aware, but several shared warehouse-work detail pages still told users to return to Warehouse or a warehouse queue.
- Merchant users could reach shipment detail from merchant order surfaces and see warehouse-only recovery copy.
- Platform/support/auditor users could reach allocation detail from governance or alert paths and see copy that contradicted the `Back to Relationships` action.

Fix:

- Shared operational-detail recovery copy now says to return to a role-appropriate workspace instead of naming a warehouse-only destination.
- Order, inbound, shipment, and allocation unavailable/error states now describe the relevant current record link to reopen for the signed-in role.
- `OperationalDetailPages.test.tsx` now proves merchant shipment recovery has no warehouse-only copy and auditor allocation recovery returns to relationship governance with role-appropriate copy.
- `docs/architecture/operational-details-timelines.md` and `docs/architecture/system-diagrams.html` document that shared detail routes require role-aware recovery links and role-appropriate recovery copy.

Proof run:

- `npm --prefix .\frontend test -- src/pages/OperationalDetailPages.test.tsx --run --no-file-parallelism` passed with 14 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed lint, production build, and 161 Vitest tests.
- Live browser proof signed in as `review.auditor@merhouse.local`, opened `/fulfillment-allocations/00000000-0000-0000-0000-000000000043`, and verified the missing allocation detail state rendered role-appropriate copy, `Back to Relationships` with `href="/admin/relationships"`, and no `Return to Warehouse` text.

Remaining risk and next target:

- Installed Android APK proof remains blocked until an emulator or device is connected; the fixed route is shared by web and native Android and should be rechecked during the final APK tour.
- Continue Queue 7 with remaining source-route parity and denied/not-found detail states, then move to the next concrete merchant or warehouse workflow gap.

### BH-042: Platform Inventory Detail Recovery Linked To Merchant-Only Stock

Date: 2026-06-10.

Target and suspected bug:

- Operational inventory-item detail denied/not-found states in the shared React route tree.

Why this target matters:

- Inventory item detail routes are available to owner/admin/support-admin/auditor and merchant roles.
- Stale, denied, or missing detail links appear during browser and Android tours when generated or seeded data changes.
- Recovery from an error state must land on a route the current role can actually use.

Surfaces, roles, states, and workflows inspected:

- `InventoryItemDetailPage` recoverable error and unavailable states.
- `detailRecovery` role mapping.
- Auditor/platform operational-detail recovery tests.
- Operational detail docs and `system-diagrams.html`.

Evidence found:

- `InventoryItemDetailPage` hard-coded `Back to Stock` with `/merchant/inventory` for every error/unavailable inventory detail state.
- Platform/support/auditor roles can access inventory detail routes but cannot use the merchant-only stock workspace.
- A denied or missing inventory detail could therefore strand platform reviewers on a recovery link outside their allowed route set.

Fix:

- `InventoryItemDetailPage` now uses role-aware detail recovery.
- Merchant users still recover to `/merchant/inventory` with `Back to Stock`.
- Owner/admin/support-admin/auditor users recover to `/admin/relationships` with `Back to Relationships`.
- Inventory detail recovery guidance now says to return to a role-appropriate workspace instead of always saying Stock.
- `OperationalDetailPages.test.tsx` now proves auditor inventory denial recovers to relationship governance.
- `docs/architecture/operational-details-timelines.md` and `docs/architecture/system-diagrams.html` document role-safe detail recovery.

Proof run:

- `npm --prefix .\frontend test -- src/pages/OperationalDetailPages.test.tsx --run --no-file-parallelism` passed with 12 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed lint, production build, and 159 Vitest tests.
- `.\scripts\quality\markdown-check.ps1` passed after the documentation updates.
- Live browser proof signed in as `review.auditor@merhouse.local`, opened `/inventory/items/00000000-0000-0000-0000-000000000042`, and verified the missing inventory detail state rendered `Back to Relationships` with `href="/admin/relationships"` and no `Back to Stock` link.

Remaining risk and next target:

- Installed Android APK proof remains blocked until an emulator or device is connected; the shared React route behavior is covered by browser proof and will be rechecked in the APK tour when mobile live testing resumes.
- Continue Queue 7 with linked route coverage and denied/not-found parity on the next concrete route bug.

### BH-041: Decimal Shipment Package Evidence Could Reach Integer API Fields

Date: 2026-06-10.

Target and suspected bug:

- Warehouse shipment evidence in the shared React route used by web and native Android.

Why this target matters:

- `CreateShipmentRequest` accepts `Integer` package count and package dimensions, while package weight is the intentionally decimal field.
- Browser `type="number"` controls can still hold decimal values.
- Without a visible whole-number guard, the shared route could send decimal package count or dimension values and rely on backend deserialization or validation failure during the ship handoff.

Surfaces, roles, states, and workflows inspected:

- Shared `WarehousePage` shipment evidence controls for packed allocations.
- Backend `CreateShipmentRequest` integer package-count and dimension fields.
- Warehouse page shipment tests.
- Warehouse operating-loop docs and `system-diagrams.html`.

Evidence found:

- `WarehousePage` used `numberValue` for package count, length, width, and height without checking integer-ness.
- The `Ship` button stayed enabled even if a package count or dimension draft was decimal.
- Backend shipment creation expects integer `packageCount`, `packageLengthCm`, `packageWidthCm`, and `packageHeightCm`; only `packageWeightKg` is decimal-capable.

Fix:

- Shipment package count and dimension inputs now use `step="1"`.
- The shared route disables `Ship` unless package count and package dimensions are positive whole numbers and package weight is at least `0.01`.
- The visible helper states: `Package count and dimensions must be whole numbers, and weight must be at least 0.01 kg.`
- `WarehousePage.test.tsx` now proves decimal package evidence is blocked before `api.createShipment` is called.
- `docs/architecture/merchant-warehouse-operating-loop.md` and `docs/architecture/system-diagrams.html` now document whole-number package evidence validation.

Proof run:

- `npm --prefix .\frontend test -- src/pages/WarehousePage.test.tsx --run --no-file-parallelism` passed with 15 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and all 158 Vitest tests.
- `.\scripts\quality\markdown-check.ps1` passed.
- Live browser proof on `http://127.0.0.1:5173/warehouse` used the documented local warehouse operator session and an existing packed allocation. Entering a decimal package-count value produced the visible shipment evidence helper, and the `Ship` button was disabled, so invalid decimal package evidence could not submit to the backend.

Remaining risk and next target:

- Fresh installed-APK validation remains blocked until an emulator or device is connected, but the fixed route is shared by web and native Android.
- Continue warehouse operations or operational-detail bug hunting after this UI/backend contract gap.

### BH-040: Decimal Receiving Quantities Could Reach An Integer Backend Contract

Date: 2026-06-10.

Target and suspected bug:

- The new shared warehouse receiving evidence controls from `BH-039`.

Why this target matters:

- Backend inbound receiving quantities are integer values.
- Browser `type="number"` controls can still hold decimal values such as `2.5`.
- Without a visible whole-number guard, the shared web/native route could send a decimal receipt payload and rely on backend deserialization or validation failure instead of preventing the bad state at the operator workflow boundary.

Surfaces, roles, states, and workflows inspected:

- Shared `WarehousePage` receiving controls for `APPROVED` and `RECEIVING` inbound rows.
- Frontend receipt draft state and post-button validation.
- Backend `ReceiveInboundStockRequest` integer payload contract.
- Warehouse operating-loop docs and `system-diagrams.html`.

Evidence found:

- `BH-039` added received and damaged quantity fields, but their draft parser preserved decimal numeric values.
- The post-button validity check only checked total range, not integer-ness.
- A value like received `2.5`, damaged `0` could be treated as locally valid even though the backend receives integer fields.

Fix:

- The shared receiving controls now use `step="1"` and keep the post button disabled unless both received and damaged values are whole numbers.
- The visible helper text now states that received plus damaged must be whole numbers between 1 and the requested quantity.
- `WarehousePage.test.tsx` now proves decimal receiving quantities are blocked before `api.receiveInboundStock` is called.
- `docs/architecture/merchant-warehouse-operating-loop.md` and `docs/architecture/system-diagrams.html` now describe whole-number receiving quantity proof.

Proof run:

- `npm --prefix .\frontend test -- src/pages/WarehousePage.test.tsx --run --no-file-parallelism` passed with 14 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and all 157 Vitest tests.
- `.\scripts\quality\markdown-check.ps1` passed.
- Live browser proof on `http://127.0.0.1:5173/warehouse` used the documented local warehouse operator session and an existing receiving row. Entering a decimal receiving value produced the visible helper text, and the `Post receipt` button was disabled, so the invalid decimal state could not submit to the backend.

Remaining risk and next target:

- Fresh installed-APK validation remains blocked until an emulator or device is connected, but the fixed route is shared by web and native Android.
- Continue warehouse operations or operational-detail bug hunting after this UI/backend contract gap.

### BH-039: Warehouse Receiving UI Forced Full Clean Receipt

Date: 2026-06-10.

Target and suspected bug:

- Warehouse inbound receiving in the shared React route used by web and native Android.

Why this target matters:

- The backend supports received quantity, damaged quantity, and receiving-note evidence.
- Real warehouse receiving includes partial and damaged arrivals, and the final live walkthrough needs to validate good and bad receiving states.
- The shared web/native UI previously exposed only a `Receive all` action, so operators could not exercise the backend-supported damaged or partial receipt workflow from either surface.

Surfaces, roles, states, and workflows inspected:

- Shared warehouse page for `WAREHOUSE_OPERATOR`.
- Backend `ReceiveInboundStockRequest` and `MerchantWarehouseService.receiveInboundStock`.
- Warehouse page tests for relationship activation, inbound approval, receiving, and dashboard refresh.
- Architecture operating-loop docs and `system-diagrams.html`.

Evidence found:

- `MerchantWarehouseService.receiveInboundStock` accepts separate `receivedQuantity`, `damagedQuantity`, and `receivingNote`, rejects totals above the requested quantity, and adds only received quantity to inventory.
- Backend tests already covered `8 received / 1 damaged` and quantity-over-request rejection.
- `WarehousePage.receiveAll` always submitted `receivedQuantity: request.requestedQuantity`, `damagedQuantity: 0`, and a fixed note.
- The table button label was `Receive all`, leaving no shared web/native route path for partial or damaged receiving evidence.

Fix:

- `WarehousePage` now keeps per-inbound receiving drafts with received quantity, damaged quantity, and receiving note.
- `InboundRequestsTable` now renders receipt evidence controls for `APPROVED` and `RECEIVING` rows and posts the operator-entered values through the existing API client.
- The post button is disabled when received plus damaged is zero or above the requested quantity.
- Successful receipt clears the per-row draft and still refreshes inventory and dashboard state.
- `docs/architecture/merchant-warehouse-operating-loop.md` and `docs/architecture/system-diagrams.html` now document shared web/native receiving evidence controls.

Proof run:

- `npm --prefix .\frontend test -- src/pages/WarehousePage.test.tsx --run --no-file-parallelism` passed with 13 tests, including partial/damaged receiving evidence and the default clean receipt path.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and all 156 Vitest tests.
- `.\scripts\quality\markdown-check.ps1` passed.
- Live browser proof on `http://127.0.0.1:5173/warehouse` signed in as the documented local `review.operator@merhouse.local` warehouse operator, approved one submitted demo inbound row, and verified the shared route rendered exactly one `Received` field, one `Damaged` field, one `Receiving note` field, and one enabled `Post receipt` button. The visible default evidence state was received `30`, damaged `0`, and note `Received from warehouse console`.

Remaining risk and next target:

- Fresh installed-APK validation remains blocked until an emulator or device is connected, but the fixed route is shared by web and native Android.
- The live browser proof approved one local demo inbound row to reach the receiving state; this is local proof data only. Continue warehouse operations or operational-detail bug hunting without expanding this fix into unrelated receiving refactors.

### BH-038: Refreshed APK Build Proved API Base, Installed Tour Blocked By No Device

Date: 2026-06-10.

Target and suspected bug:

- Native Android proof freshness after the web-side route and CORS fixes from `BH-035` and `BH-036`.

Why this target matters:

- At this point in the ledger, the final convergence bar still required a real installed Android walkthrough with the reviewer/product owner; `BH-052` later records that live evidence.
- Before returning to non-Android bug hunting, the current APK artifact should at least be refreshed and checked for the emulator backend API base.
- A missing Android device should be recorded as a proof blocker once, not allowed to become an aimless loop.

Surfaces, roles, states, and workflows inspected:

- Native Android debug APK assembly output artifact.
- Android-bound WebView assets under `frontend/android/app/src/main/assets/public`.
- Android SDK platform-tools device discovery.
- Installed-APK tour wrapper provenance and hard stop behavior.

Evidence found:

- `frontend/android/app/build/outputs/apk/debug/app-debug.apk` was refreshed on 2026-06-10 at 1:01:03 PM with byte size `4460445`.
- The refreshed APK SHA-256 is `8C14B3354687522E2797C05C4F2B262ECCB0F909A9795FA530CEDF41F355C53C`.
- The Android-bound compiled asset `frontend/android/app/src/main/assets/public/assets/index-C7gxrBNm.js` contains `http://10.0.2.2:8080`.
- The Android-bound public assets do not contain `localhost:8080`.
- Android SDK `adb.exe devices` returned no connected emulator or USB-debug device.
- `native-android-tour.ps1` printed the resolved API URL, APK path, report path, and screenshot directory, then stopped before installation because no Android device or emulator was connected.

Fix or decision:

- No product code change was needed.
- The native APK/API-base proof is refreshed for the current code state.
- Fresh installed visual proof remains blocked on attaching or booting a device; this is recorded as a remaining risk rather than repeated.

Proof run:

- `.\scripts\proof\android\native-mobile-check.ps1 -Assemble -ApiBaseUrl "http://10.0.2.2:8080"` exited successfully.
- `Get-FileHash -Algorithm SHA256 frontend/android/app/build/outputs/apk/debug/app-debug.apk` recorded the refreshed APK hash above.
- `rg -l "10\.0\.2\.2:8080" frontend/android/app/src/main/assets/public frontend/dist` found the Android-bound compiled asset and the web build asset.
- `rg -l "localhost:8080" frontend/android/app/src/main/assets/public frontend/dist` found no built public asset matches.
- `.\scripts\proof\android\native-android-tour.ps1 -ApiUrl "http://localhost:8080" -OutputPath ".\reports\bh-038-native-tour.json" -ScreenshotDirectory ".\reports\bh-038-native-tour"` stopped with `No running Android device or emulator is connected`.
- Markdown proof is rerun at close.

Remaining risk and next target:

- Fresh installed-APK screenshots, route records, stakeholder-state proof, and final live Android walkthrough remain pending until an emulator or physical device is connected.
- Move to the next non-blocked bug-hunt target instead of repeating Android device discovery.

### BH-037: Fresh Browser Tour Paired Cleanly With Then-Latest Installed-APK Evidence

Date: 2026-06-10.

Target and suspected bug:

- Report-backed cross-surface and performance readiness after `BH-036` fixed the support-admin service-accountability route.

Why this target matters:

- The browser tour was newly refreshed after a real route bug, but convergence requires web/native evidence to agree.
- The performance gate must not claim route timing from one surface only; it requires paired browser and installed-APK reports for route-timing claims.
- This iteration checked whether the fresh web evidence created a cross-surface mismatch against the then-latest installed-APK report before moving to another target.

Surfaces, roles, states, and workflows inspected:

- Fresh web browser report: `reports/bh-036-frontend-full-tour.json`.
- Then-latest installed Android APK report: `reports/v16.2-loop-163-native-tour.json`.
- Cross-surface normalized role/path coverage, active/empty stakeholder coverage, route cleanliness, report provenance, and report-backed route timing.

Evidence found:

- The fresh web report contains 188 checked routes across public, owner, admin, support-admin, auditor, active/empty merchant, active/empty warehouse, shared review surfaces, account settings, notifications, assistant, and operational detail routes.
- That installed-APK report contains 100 native route records with APK SHA-256, API URL, checked timestamp, and emulator device provenance.
- No new cross-surface route-set, role, stakeholder-state, timing, screenshot, overflow, unlabeled-control, bad-status, or console-error mismatch was found by the paired checks.

Fix or decision:

- No code change was needed in this iteration.
- The fresh web report was accepted as the current web-side evidence paired with the then-latest available installed-APK report for scripted parity/performance proof.
- This does not replace the required final live installed-APK walkthrough with the reviewer/product owner.

Proof run:

- `.\scripts\proof\release\cross-surface-tour-check.ps1 -WebReportPath ".\reports\bh-036-frontend-full-tour.json" -NativeReportPath ".\reports\v16.2-loop-163-native-tour.json"` passed with 188 web records, 100 native Android records, and 82 normalized role/path pairs.
- `.\scripts\proof\release\performance-readiness.ps1 -WebReportPath ".\reports\bh-036-frontend-full-tour.json" -NativeReportPath ".\reports\v16.2-loop-163-native-tour.json" -OutputPath ".\reports\bh-037-performance-readiness.json"` passed. The report-backed proof recorded 20.12-second build time, 141.92 KB total gzipped JS/CSS, slowest web `routeReadyMs` 2278 ms, slowest native `routeReadyMs` 7292 ms, and slowest native `screenshotMs` 2482 ms.
- Markdown proof is rerun at close.

Remaining risk and next target:

- The native report was the latest available installed-APK evidence at that point, not a fresh APK rerun from this iteration. A final live installed-APK walkthrough is still required before convergence can close.
- The next target should either attach/boot Android and rerun installed-APK proof, or continue bug-hunting a code/report area that is not yet covered by the fresh web plus latest native evidence.

### BH-036: Support-Admin Service Review Route Used Mutation Authorization For SLA Reads

Date: 2026-06-10.

Target and suspected bug:

- Full browser route tour after `BH-035` restored Vite browser sign-in.

Why this target matters:

- The final web proof requires all supported roles to reach their routed work surfaces in a real browser.
- Support-admin users should inspect service evidence and SLA status without mutation authority.
- A read-only support route failing with a mutation-denial message blocks both validation and cross-surface confidence.

Surfaces, roles, states, and workflows inspected:

- `supportAdmin` browser route discovery for `/service-accountability`.
- Backend `GET /api/v1/service-accountability/agreements/{agreementId}/sla-statuses`.
- Shared web/native React service-accountability page loading agreement, statement, dispute, claim, review, relationship, and SLA read models.

Evidence found:

- `.\scripts\proof\web\frontend-full-tour.ps1 -BaseUrl "http://127.0.0.1:5173" -ApiUrl "http://localhost:8080" -OutputPath ".\reports\bh-036-frontend-full-tour.json"` initially failed.
- The captured browser context showed support-admin navigation and an alert: `You cannot mutate service records for another relationship.`
- `ServiceAccountabilityService.findSlaStatuses` was a read-only method exposed to support-admin and auditor roles by the controller, but it called `requireAgreementPartyMutation`.

Fix:

- `findSlaStatuses` now uses `requireAgreementPartyAccess`, preserving cross-tenant platform read access for support-admin/auditor while keeping mutation gates on write actions.
- `ServiceAccountabilityServiceTest` now proves support-admin can read SLA statuses without mutation authority.
- `docs/architecture/service-accountability.md` now states that support-admin and auditor evidence review includes SLA status read models.

Proof run:

- `backend\mvnw.cmd -q "-Dtest=ServiceAccountabilityServiceTest" test` passed.
- `npm --prefix .\frontend test -- src/pages/ServiceAccountabilityPage.test.tsx --run --no-file-parallelism` passed with 11 tests.
- The backend container was rebuilt and restarted from current source with `docker compose build backend`, `docker compose up -d backend`, and `.\scripts\local\wait-backend.ps1`.
- The full browser tour then passed: `.\scripts\proof\web\frontend-full-tour.ps1 -BaseUrl "http://127.0.0.1:5173" -ApiUrl "http://localhost:8080" -OutputPath ".\reports\bh-036-frontend-full-tour.json"` passed 5 Playwright tests in 4.6 minutes and wrote a report with 188 checked routes.
- Markdown proof is rerun at close.

Remaining risk and next target:

- Installed Android route proof remains pending until an emulator/device is attached.
- The next target should use the fresh `reports/bh-036-frontend-full-tour.json` as the web-side evidence and either compare it to native proof when available or continue with the next browser/native mismatch surfaced by report analysis.

### BH-035: Vite Browser Sign-In Was Rejected By Backend CORS

Date: 2026-06-10.

Target and suspected bug:

- Browser sign-in reliability for the local Vite development and Playwright tour origin.

Why this target matters:

- Final convergence requires a real browser tour and live browser walkthrough, not only API smoke.
- During `BH-034` visual validation, the login form showed `Forbidden` even though direct API login succeeded.
- A developer or reviewer using the documented Vite dev/tour origin would be blocked at the first public auth workflow.

Surfaces, roles, states, and workflows inspected:

- Public `/login` route in a clean Playwright browser.
- `POST /api/v1/auth/login` through the Vite dev proxy at `http://127.0.0.1:5173`.
- Backend security/CORS configuration and local environment template.

Evidence found:

- Clean Playwright browser login posted to `http://127.0.0.1:5173/api/v1/auth/login` and received HTTP 403, rendering the visible `Forbidden` alert.
- Direct API login without a browser `Origin` succeeded.
- The frontend Playwright config and local frontend dev script use `http://127.0.0.1:5173`, but the backend default CORS origins did not include `http://127.0.0.1:5173` or `http://localhost:5173`.

Fix:

- Backend default `merhouse.cors.allowed-origins` now includes Docker nginx, Vite dev/tour origins, and native local origins.
- `SecurityConfigTest` now asserts the Vite dev/tour origins are present.
- `.env.example`, `docs/development/frontend.md`, `docs/development/backend.md`, and `docs/architecture/system-diagrams.html` now document the local CORS origin boundary.

Proof run:

- `backend\mvnw.cmd -q "-Dtest=SecurityConfigTest" test` passed.
- `backend\mvnw.cmd -q "-Dtest=SecurityConfigTest,AuthControllerTest" test` passed.
- `.\scripts\quality\markdown-check.ps1` passed.
- The backend container was rebuilt and restarted from the current source with `docker compose build backend`, `docker compose up -d backend`, and `.\scripts\local\wait-backend.ps1`; health returned ready.
- Live browser sign-in through `http://127.0.0.1:5173/login` passed in a clean Playwright browser: `/api/v1/auth/login` returned 200, `/api/v1/auth/me` returned 200, the route navigated to `/admin`, and `Admin Overview` finished loading.
- The Codex in-app Browser reloaded the fixed Vite login page without the prior `Forbidden` alert; its field-fill automation then hit a virtual-clipboard tooling issue, so the product proof for this loop is the clean Playwright browser pass and the final manual in-app/browser walkthrough remains pending.
- Browser screenshots were saved locally at `reports/runtime/bh-035-browser-login-after.png` and `reports/runtime/bh-035-browser-login-admin-loaded.png`.

Remaining risk and next target:

- Installed Android sign-in still needs live APK validation when an emulator/device is attached.
- Continue broader route-tour work only after keeping this browser sign-in path green; the next high-value target should be the first post-login route-tour mismatch or native installed-APK blocker rather than another CORS pass.

### BH-034: Dense Notification Inbox Hid Unread Work After First Page

Date: 2026-06-10.

Target and suspected bug:

- Notification center dense unread action state after `BH-001` through `BH-003`.

Why this target matters:

- The backend summary could correctly report more unread records than the first loaded action page.
- The shared web/native React page showed `Showing 50 of 73 active` but, before this fix, provided no stakeholder action to reach the remaining 23 records.
- This was a frontend/backend sync and validation gap: tests could prove counts while the visible workflow still stranded unread work.

Surfaces, roles, states, and workflows inspected:

- Recipient-scoped notification delivery API.
- Shared React `/notifications` action inbox used by web and native Android.
- Dense local proof state with 73 unread action records and a 50-record first page.
- Local-provider boundary stayed unchanged: this is local in-app delivery history, not phone OS push, lock-screen, notification-tray, email, SMS, webhook, or provider delivery.

Evidence found:

- `NotificationService` bounded delivery queries to the requested limit, but the controller and API client did not expose a page argument.
- `NotificationCenterPage` detected the count mismatch but stopped at the first unread action page.
- The previous ledger still named explicit pagination or load-more behavior as remaining risk for live validation.

Fix:

- `GET /api/v1/notifications/deliveries` now accepts zero-based `page` alongside `limit` and optional `status`.
- `NotificationService.deliveriesForUser` applies safe page and limit values to recipient-scoped mixed history and status-filtered action queries.
- The frontend API client can request later delivery pages.
- `NotificationCenterPage` shows a load-more action when backend unread count exceeds the visible action page, appends unique records, and keeps delivery-history pagination separate.
- `docs/architecture/notifications.md` and `docs/architecture/system-diagrams.html` now document paged local delivery records and dense-state load-more behavior.

Proof run:

- `backend\mvnw.cmd -q "-Dtest=NotificationServiceTest,NotificationControllerTest" test` passed.
- `npm --prefix .\frontend test -- src/pages/NotificationsRoutePage.test.tsx src/api/client.test.ts --run --no-file-parallelism` passed with 17 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 156 tests.
- `.\scripts\proof\android\native-mobile-check.ps1 -Sync -ApiBaseUrl "http://10.0.2.2:8080"` passed, proving the updated shared frontend build syncs into the Android wrapper.
- `.\scripts\quality\markdown-check.ps1` passed before the final operating-rule edit and is rerun at close.
- Live browser route proof against the real local backend passed after rebuilding the backend container from current source: API summary reported 448 unread records, page 0 and page 1 returned different 50-record pages, `/notifications` showed `Showing 50 of 448 active`, `Load more alerts` was visible, and clicking it advanced the page to `Showing 100 of 448 active`.
- Browser screenshots were saved locally at `reports/runtime/bh-034-notifications-before-load-more.png` and `reports/runtime/bh-034-notifications-after-load-more.png`.

Remaining risk and next target:

- The in-app Browser login form returned `Forbidden` in this local browser session even though the same dev-origin login endpoint succeeded from HTTP proof; BH-034 therefore used real API authentication plus the real React notification route for visual proof. The final full live walkthrough must still exercise normal sign-in in the real browser.
- No Android emulator/device was attached (`adb devices` was empty), so installed-APK visual validation for this notification route remains pending for the final Android walkthrough.
- After this loop closes, the next target should move away from notification dense-state repetition unless browser/APK validation finds a new notification-specific mismatch.

### BH-033: Certification Snapshot Overstated Which Full Gate Command Had Passed

Date: 2026-06-10.

Target and suspected bug:

- README and deployment-ready certification proof wording after command examples were updated for `-NativeApiBaseUrl`.

Why this target matters:

- The V&V ledger must not convert a current recommended command into a claim that an older historical full E2E/report-aware gate was rerun.
- We did run focused/light proof with explicit `-NativeApiBaseUrl`, but not the full report-aware E2E deployment gate in this turn.
- Certification docs should clearly separate historical evidence from current command shape.

Surfaces, roles, states, and workflows inspected:

- README latest scripted local QC snapshot.
- `docs/quality/deployment-ready-local-certification.md` current scripted certification proof.
- Queue 9 proof entries for explicit native API-base script behavior.

Evidence found:

- The full report-aware historical pass used the native sync default `http://10.0.2.2:8080` before `-NativeApiBaseUrl` was explicit.
- After BH-032, some bullets could be read as claiming that the full report-aware E2E deployment gate itself had already been rerun with `-NativeApiBaseUrl`.

Fix:

- README and deployment-ready certification docs now distinguish the latest historical full-gate pass from the current recommended command shape.
- The docs say the historical pass used the same native default and that current reruns should pass `-NativeApiBaseUrl "http://10.0.2.2:8080"` for transcript clarity.

Proof run:

- `.\scripts\quality\markdown-check.ps1` passed.
- A targeted search for full report-aware `deployment-readiness.ps1` pass claims that also included `-NativeApiBaseUrl` returned no over-claimed historical pass entries; remaining explicit-parameter pass claims are focused/light proof entries from BH-030.

Remaining risk and next target:

- The next full report-aware gate with fresh browser/native reports should be run with explicit `-NativeApiBaseUrl` before updating the historical certification snapshot again.

### BH-032: Deployment Certification Docs Still Showed Old Native API-Base Command

Date: 2026-06-10.

Target and suspected bug:

- README and deployment-ready certification command examples after `-NativeApiBaseUrl` became explicit in Queue 9.

Why this target matters:

- V16.2 closeout requires docs, scripts, tests, CI, and code to describe the same current system.
- The roadmap and scripts docs described separate host API-smoke and native Android API-base targets, but the deployment certification doc and README current-proof bullets still showed the older command shape.
- A copied full-gate command without `-NativeApiBaseUrl` would still work through the default, but it would hide the Android backend target from the operator transcript.

Surfaces, roles, states, and workflows inspected:

- `README.md`.
- `docs/quality/deployment-ready-local-certification.md`.
- `docs/architecture/roadmap.md`, `docs/development/scripts.md`, and `docs/architecture/system-diagrams.html` as comparison sources.

Evidence found:

- `roadmap.md` already showed the report-aware command with `-NativeApiBaseUrl "http://10.0.2.2:8080"`.
- `deployment-ready-local-certification.md` still showed report-aware and current-proof commands without `-NativeApiBaseUrl`.
- READMEâ€™s current proof bullets also omitted the explicit native API base even though the usage section explained it.

Fix:

- README and deployment-ready certification docs now show explicit `-NativeApiBaseUrl "http://10.0.2.2:8080"` in broad and report-aware deployment proof examples.
- Current-proof bullets now name native sync with an explicit Android API base as part of the local proof contract.

Proof run:

- `.\scripts\quality\markdown-check.ps1` passed.
- A targeted PowerShell command-block scan over `README.md`, `docs/quality/deployment-ready-local-certification.md`, `docs/development/scripts.md`, and `docs/architecture/roadmap.md` passed, proving report-aware `deployment-readiness.ps1` examples that include tour report paths also include `-NativeApiBaseUrl`.

Remaining risk and next target:

- Continue Queue 10 with docs index, system diagram, CI, and README agreement checks before moving back into code-level bug hunting.

### BH-031: Direct Broad Quality Gate Could Not Override Native API Base

Date: 2026-06-10.

Target and suspected bug:

- `scripts/quality/check.ps1` direct broad-gate native sync behavior.

Why this target matters:

- `check.ps1` is the repositoryâ€™s broad local quality entry point and can be run directly outside the deployment gate.
- Before this entry, deployment readiness could pass an explicit native API base to native sync, but direct broad quality runs still had no parameter for physical-device or custom local backend URLs.
- That left one quality-script entry point less explicit than the rest of the web/mobile/backend synchronization proof.

Surfaces, roles, states, and workflows inspected:

- Broad quality gate mobile proof.
- Native Android sync and compiled backend-base verification.
- README, scripts docs, and system diagram proof descriptions.

Evidence found:

- `check.ps1` called `native-mobile-check.ps1 -Sync` without `-ApiBaseUrl`.
- The native script default still worked for emulator proof, but direct broad-gate users could not make the Android-bound backend URL visible at the broad-gate command line.

Fix:

- `check.ps1` now accepts `-NativeApiBaseUrl`, defaults it to `http://10.0.2.2:8080`, and passes it through to `native-mobile-check.ps1 -Sync`.
- README, scripts docs, and the system diagram now document direct broad-gate native API-base control.

Proof run:

- PowerShell parser check passed for `scripts/quality/check.ps1` and `native-mobile-check.ps1`.
- `.\scripts\quality\check.ps1 -SkipBackend -SkipFrontend -SkipCompose -NativeApiBaseUrl "http://10.0.2.2:8080"` passed, including shared mobile shell proof, explicit native sync with compiled backend-base verification, markdown proof, and public-readiness proof.

Remaining risk and next target:

- CI still uses the explicit native assembly command directly. Continue Queue 9 by checking report-aware gates and CI command drift for concrete mismatches.

### BH-030: Deployment Readiness Did Not Expose Native API Base Synchronization

Date: 2026-06-10.

Target and suspected bug:

- `scripts/quality/deployment-readiness.ps1` native sync proof and frontend/backend API-base synchronization.

Why this target matters:

- Host-side API smoke and Android WebView API routing can need different backend URLs in the same local proof run.
- The host normally reaches the backend at `http://localhost:8080`, while the Android emulator normally reaches the same host backend at `http://10.0.2.2:8080`.
- The deployment gate accepted `-ApiBaseUrl` for API smoke but always invoked `native-mobile-check.ps1 -Sync` without an explicit native API base, so the Android-bound build depended on the native script default instead of visible deployment-gate input.

Surfaces, roles, states, and workflows inspected:

- Deployment readiness broad local gate.
- Native mobile sync proof and compiled `VITE_API_BASE_URL` verification.
- Performance readiness timed API-smoke handoff.
- Docs and system diagram proof-target descriptions.

Evidence found:

- `deployment-readiness.ps1` validated `-ApiBaseUrl` only when `-IncludeApiSmoke` was supplied and passed it to `performance-readiness.ps1`.
- The same gate ran `native-mobile-check.ps1 -Sync` without `-ApiBaseUrl`, hiding the native Android backend target used for compiled assets.
- This could confuse physical-device proof or custom local network proof where the native API base must be a LAN URL rather than the emulator default.

Fix:

- `deployment-readiness.ps1` now accepts `-NativeApiBaseUrl`, defaults it to `http://10.0.2.2:8080`, validates it through `url-guard-lib.ps1`, prints it, and passes it to `native-mobile-check.ps1 -Sync`.
- Documentation now distinguishes host-side `-ApiBaseUrl` for API smoke from `-NativeApiBaseUrl` for Android-bound frontend/backend synchronization.
- `docs/architecture/system-diagrams.html` now records the separate host/native API-base deployment proof contract.

Proof run:

- PowerShell parser check passed for `scripts/quality/deployment-readiness.ps1`, `native-mobile-check.ps1`, `performance-readiness.ps1`, and `check.ps1`.
- `.\scripts\proof\android\native-mobile-check.ps1 -Sync -ApiBaseUrl "http://10.0.2.2:8080"` passed and proved the explicit native backend base was compiled into the Android-bound JavaScript asset.
- `.\scripts\quality\markdown-check.ps1` passed.
- `.\scripts\quality\deployment-readiness.ps1 -SkipCompose -NativeApiBaseUrl "http://10.0.2.2:8080"` passed, including markdown, public-readiness, mobile shell, explicit native sync, default performance readiness, backend tests, frontend lint/build/Vitest, markdown, and public-readiness through the broad local gate.

Remaining risk and next target:

- Fresh full deployment readiness should pass the explicit `-NativeApiBaseUrl` used for the next installed-APK tour. Continue Queue 9 with report/proof determinism bugs before broad refactoring.

### BH-029: Native Tour Reports Did Not Carry Active/Empty Stakeholder State

Date: 2026-06-10.

Target and suspected bug:

- Installed Android tour report metadata and cross-surface active/empty stakeholder proof.

Why this target matters:

- Web tour records include `stakeholderState` for active and empty merchant/warehouse users.
- Native tour records used distinct role names such as `MERCHANT_ACTIVE` and `MERCHANT_EMPTY`, but did not carry the same state field.
- That made exact web/native state coverage harder to audit and left a small script gap between the documented active/empty stakeholder proof and the native report shape.

Surfaces, roles, states, and workflows inspected:

- `scripts/proof/android/native-android-tour.ps1` route records for active merchant, empty merchant, active warehouse, and empty warehouse users.
- `scripts/proof/release/cross-surface-tour-check.ps1` role/path and state/path coverage checks.
- `scripts/proof/lib/tour-report-lib.ps1` shared tour-report normalization helpers.

Evidence found:

- Browser route records had `stakeholderState: active|empty` for merchant and warehouse cases.
- Native records only exposed active/empty through exact role names, while docs promised exact native active/empty stakeholder coverage.
- Cross-surface comparison required native exact roles and paths, but it did not validate native role/state/path coverage through a shared state helper.

Fix:

- Native route records now include `stakeholderState` for merchant and warehouse active/empty roles.
- `tour-report-lib.ps1` exposes `Get-TourReportStakeholderState`, with fallback inference for legacy native role names.
- `cross-surface-tour-check.ps1` now validates native active/empty role/state/path coverage alongside the existing web stakeholder-state checks.
- Native certification docs, scripts docs, and the system diagram now describe stakeholder-state report provenance.

Proof run:

- PowerShell parser check passed for `scripts/proof/android/native-android-tour.ps1`, `tour-report-lib.ps1`, `cross-surface-tour-check.ps1`, and `native-mobile-check.ps1`.
- `.\scripts\proof\android\native-mobile-check.ps1` passed the structural native Android shell check.
- `.\scripts\proof\android\mobile-shell-check.ps1` passed.
- `.\scripts\proof\release\cross-surface-tour-check.ps1` passed against the current paired browser/native reports, proving the strengthened native state/path checks remain compatible with existing evidence while future native reports can carry explicit `stakeholderState`.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Fresh paired browser and installed-APK reports should be regenerated before claiming final cross-surface convergence so the native JSON carries explicit stakeholder-state fields. Continue Queue 8 with APK/API-base provenance and then the later live installed-app walkthrough.

### BH-028: Installed Android Tour Did Not Validate Screenshot Files Before Passing

Date: 2026-06-10.

Target and suspected bug:

- `scripts/proof/android/native-android-tour.ps1` installed-APK screenshot evidence.

Why this target matters:

- Queue 8 is the native Android proof layer for the same React workflows used by web.
- A passing installed-APK route record must prove real visible Android evidence, not only that `adb pull` returned a path.
- `performance-readiness.ps1` later checks PNG screenshots, but the native tour should reject corrupt, empty, or placeholder screenshot files before writing passing proof.

Surfaces, roles, states, and workflows inspected:

- Native Android tour screenshot capture for public routes, authenticated stakeholder routes, generated empty stakeholder routes, and discovered detail routes.
- Shared tour report helper coverage for PNG dimension validation.
- Documentation for native local certification, scripts, and system diagrams.

Evidence found:

- `Capture-Screenshot` verified that `adb shell screencap` and `adb pull` completed, then returned the local path.
- The route report could therefore reference an unvalidated file even though `tour-report-lib.ps1` already had `Test-PngScreenshotFile`.
- The later performance gate would catch invalid screenshots only if paired report-aware performance proof was run, which left the native tour itself too trusting.

Fix:

- `native-android-tour.ps1` now imports `tour-report-lib.ps1`.
- Each pulled screenshot is validated with `Test-PngScreenshotFile` immediately after `adb pull`; invalid PNG evidence with missing or zero dimensions throws before the route can pass.
- Native certification docs, scripts docs, and the system diagram now describe the screenshot validity gate.

Proof run:

- PowerShell parser check passed for `scripts/proof/android/native-android-tour.ps1`, `tour-report-lib.ps1`, `mobile-shell-check.ps1`, and `native-mobile-check.ps1`.
- `.\scripts\proof\android\mobile-shell-check.ps1` passed.
- `.\scripts\proof\android\native-mobile-check.ps1` passed the structural native Android shell check.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- At this point in the ledger, the installed APK tour still required a running emulator/device and seeded local stack for live Android evidence; later entries closed native report provenance, API-base synchronization, and the final live installed-app walkthrough.

### BH-027: Outbox Health Notification Summaries Lost Diagnostics Route Without Source Ids

Date: 2026-06-10.

Target and suspected bug:

- Backend notification summary source-route parity with the frontend notification display rules.

Why this target matters:

- Notification action inbox entries are a cross-surface route source for web and Android users.
- Outbox-health alerts are platform diagnostics, so they should always send users to `/admin/outbox`, even if the local alert does not carry a concrete source record id.
- Queue 7 includes source-route parity, and backend summary actions must agree with frontend notification-center links.

Surfaces, roles, states, and workflows inspected:

- Backend notification summary attention signals.
- Frontend notification display source-link mapping.
- Outbox-health local notification boundary.

Evidence found:

- Frontend `notificationSourceHref` routed every `OUTBOX_HEALTH` delivery to `/admin/outbox`.
- Backend `NotificationService.notificationRoute` returned `/notifications` before checking topic when either `sourceType` or `sourceId` was missing.
- An outbox-health unread summary without a source id could therefore send the header/action inbox to the generic notification page instead of diagnostics.

Fix:

- Backend notification route mapping now checks `OUTBOX_HEALTH` before requiring source metadata.
- Added a backend regression proving outbox-health summaries route to `/admin/outbox` without a source id.
- Re-ran the frontend notification display test to prove the browser-side mapping remains aligned.
- `docs/architecture/system-diagrams.html` now documents outbox-health diagnostics routing.

Proof run:

- `backend\mvnw.cmd -q "-Dtest=NotificationServiceTest" test` passed.
- `npm --prefix .\frontend test -- src/features/notifications/display.test.ts --run --no-file-parallelism` passed with 4 tests.
- `backend\mvnw.cmd -q test` passed.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Run broader backend and markdown proof, then continue Queue 7 with source links from attention queues and native route-tour readiness.

### BH-026: Detail Route Errors Were Not Recoverable Across Stakeholder Roles

Date: 2026-06-10.

Target and suspected bug:

- Operational detail route denied/not-found states in the shared React web/native route tree.

Why this target matters:

- Detail pages are opened from notification source routes, merchant/warehouse queues, platform review, and live Android/browser tours.
- A stale, denied, or missing detail link should not strand the user on a generic error page, especially in Android WebView.
- Queue 7 explicitly requires empty, not-found, and denied detail states to remain navigable and role-aware.

Surfaces, roles, states, and workflows inspected:

- Order, inbound stock, shipment, fulfillment allocation, inventory item, and merchant-warehouse relationship detail pages.
- Merchant recovery paths.
- Warehouse recovery paths.
- Auditor/platform recovery paths.

Evidence found:

- Inventory item detail already used `RecoverableDetailState` with a back link.
- Order, inbound, shipment, allocation, and relationship detail errors returned a plain `ErrorState` with no workflow return action.
- A first-pass generic relationship recovery path could send merchant users toward admin-only relationship governance, so recovery needed to be role-aware.

Fix:

- All operational detail pages now use recoverable states for missing or denied records.
- Recovery actions route warehouse users to Warehouse, merchant users to Merchant or Orders, and platform/support/auditor users to relationship governance.
- Focused route tests prove warehouse order denial recovery, merchant relationship recovery, and auditor relationship governance recovery.
- `docs/architecture/system-diagrams.html` now documents role-aware detail recovery behavior.

Proof run:

- `npm --prefix .\frontend test -- src/pages/OperationalDetailPages.test.tsx --run --no-file-parallelism` passed with 11 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 155 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Run broader frontend and markdown proof, then continue Queue 7 with linked route/source parity checks.

### BH-025: Relationship Detail Scanned All Fulfillment Allocations

Date: 2026-06-10.

Target and suspected bug:

- Operational relationship detail backend query behavior.

Why this target matters:

- Relationship detail is part of the live web/native operational evidence tour and can be opened from merchant, warehouse, notification, and platform review flows.
- Local proof databases can accumulate allocations across many relationships; scanning every allocation and filtering in Java makes the detail route slower and less deployment-shaped.
- Queue 7 is specifically about route permissions, linked timelines, source-route parity, empty/not-found/denied states, and performance-ready operational detail behavior.

Surfaces, roles, states, and workflows inspected:

- `OperationalDetailService.relationshipDetail`.
- Fulfillment allocation repository query boundaries.
- Relationship detail frontend route proof remained unchanged because the response contract stayed the same.

Evidence found:

- Relationship detail used `allocationRepository.findAll()` and filtered by merchant and warehouse-provider tenant in memory.
- Fulfillment allocations already had entity-graph repository methods for scoped warehouse views, but no scoped merchant/provider relationship lookup.

Fix:

- Added `findByOrderMerchantIdAndWarehouseTenantIdOrderByCreatedAtDesc` with the existing allocation entity graph.
- Relationship detail now loads only allocations for the selected merchant/provider pair.
- Added a focused service regression proving the scoped repository method is used and `findAll()` is not called.
- `docs/architecture/system-diagrams.html` now documents scoped relationship-detail allocation lookup.

Proof run:

- `backend\mvnw.cmd -q "-Dtest=OperationalDetailServiceTest,DatabaseRepositoryIntegrationTest" test` passed.
- `npm --prefix .\frontend test -- src/pages/OperationalDetailPages.test.tsx --run --no-file-parallelism` passed with 8 tests.
- `backend\mvnw.cmd -q test` passed.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Run broader backend and markdown proof, then continue Queue 7 with denied/not-found detail state parity and linked route coverage.

### BH-024: Service Statement Lifecycle Had Backend Actions But No Shared Route Action Path

Date: 2026-06-10.

Target and suspected bug:

- Service statement lifecycle actions on the shared service-accountability route.

Why this target matters:

- The backend and frontend API client already supported finalizing draft statements and marking finalized statements settled.
- The shared web/native route displayed statement status and totals but did not expose those lifecycle actions, leaving allowed stakeholders unable to complete statement review from the main service surface.
- Statement lifecycle records are local service-unit coordination records, not payment collection, so the UI must make the local boundary and available state transitions clear.

Surfaces, roles, states, and workflows inspected:

- Merchant service-accountability route with DRAFT and FINALIZED statement states.
- Auditor read-only service evidence review mode.
- Shared statement table used by web and native Android.

Evidence found:

- `ServiceStatementsTable` displayed all statement rows without an action path for DRAFT or FINALIZED records.
- API-client methods existed for finalize and mark-settled, but only direct API tests exercised them.
- Read-only roles needed to keep evidence-review chips rather than hidden mutation buttons.

Fix:

- Added statement action controls to finalize DRAFT statements and mark FINALIZED statements settled from the shared route.
- Kept support-admin/auditor statement rows in read-only evidence review mode.
- Focused service-accountability route tests now prove finalize, mark-settled, and read-only denial behavior.
- `docs/architecture/service-accountability.md` and `docs/architecture/system-diagrams.html` now document statement lifecycle actions.

Proof run:

- `npm --prefix .\frontend test -- src/pages/ServiceAccountabilityPage.test.tsx --run --no-file-parallelism` passed with 11 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 152 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Run broader proof, then continue Queue 6 with final cross-party alert and live-tour readiness review.

### BH-023: Service Issue Resolution Had Backend Actions But No Shared Route Action Path

Date: 2026-06-10.

Target and suspected bug:

- Service-accountability web/native route and frontend API client action parity.

Why this target matters:

- The backend supports resolving or rejecting disputes and claims, and approving or rejecting pending service reviews.
- The shared `/service-accountability` route displayed open issues but did not expose the resolution actions, so real web and Android users could accumulate open service records with no visible closure path.
- Support-admin and auditor must remain read-only reviewers while allowed stakeholder roles can close the workflow.

Surfaces, roles, states, and workflows inspected:

- Merchant, warehouse, owner/admin allowed issue-resolution states.
- Auditor read-only evidence review mode.
- Frontend API client paths for dispute, claim, and review resolution.
- Shared service-accountability issue table for open and closed records.

Evidence found:

- `frontend/src/api/client.ts` had create/finalize/settle service methods but no dispute, claim, or review resolution client methods.
- `ServiceAccountabilityPage` showed open issue records without any action column.
- Existing tests proved review creation and read-only auditor mode, but not service issue closure from the shared route.

Fix:

- Added frontend API client methods and payload types for resolving disputes, resolving claims, and resolving reviews.
- Added service issue action controls for allowed stakeholders: resolve/reject disputes and claims, approve/reject pending reviews.
- Auditor/support read-only surface remains buttonless for service issue mutations.
- Focused route and API-client tests now prove the new action path and read-only denial at the shared frontend surface.
- `docs/architecture/service-accountability.md` and `docs/architecture/system-diagrams.html` now document issue resolution actions and read-only service review roles.

Proof run:

- `npm --prefix .\frontend test -- src/pages/ServiceAccountabilityPage.test.tsx --run --no-file-parallelism` passed with 9 tests.
- `npm --prefix .\frontend test -- src/api/client.test.ts --run --no-file-parallelism` passed with 8 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 150 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Run broader proof, then continue Queue 6 with service statement lifecycle action parity and final route review.

### BH-022: Service Mutations Trusted Broad Platform Read Roles In The Service Layer

Date: 2026-06-10.

Target and suspected bug:

- Service-accountability backend mutation permissions.

Why this target matters:

- Support-admin and auditor users are platform review roles; they should inspect service evidence but not mutate agreements, statements, disputes, claims, or reviews.
- Controller annotations already block support/auditor mutation endpoints, but service methods still used broad platform-admin access helpers, which could become a bypass through future internal callers or refactors.
- Backend mutation boundaries must match the shared web/native routeâ€™s visible read-only service review behavior.

Surfaces, roles, states, and workflows inspected:

- Service-accountability agreement, statement, dispute, claim, and review mutation methods.
- Owner/admin platform mutation authority.
- Support-admin and auditor read-only platform review roles.
- Merchant and warehouse tenant-party mutation authority.

Evidence found:

- `CurrentUserService.isAdmin()` intentionally treats owner, admin, support-admin, and auditor as platform read roles.
- `ServiceAccountabilityService` reused broad read access helpers on mutation paths such as finalize statement and resolve service issues.
- The UI hid mutation controls for auditor, and controller annotations excluded support/auditor, but the service boundary was less explicit than the route/API contract.

Fix:

- Added `CurrentUserService.requireMutatingAdminOrTenant` for owner/admin or matching-tenant mutation checks.
- Split service-accountability read access from mutation access for agreement and statement owned records.
- Service-accountability mutation paths now require owner/admin platform authority or the merchant/warehouse tenant that owns the service record.
- Focused backend regression proves support-admin and auditor cannot mutate service records through the service layer.
- `docs/architecture/service-accountability.md` and `docs/architecture/system-diagrams.html` now document support/auditor read-only service review behavior.

Proof run:

- `backend\mvnw.cmd -q "-Dtest=ServiceAccountabilityServiceTest" test` passed.
- `backend\mvnw.cmd -q test` passed.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Run broader backend and markdown proof, then continue Queue 6 with service alert handoffs and route/action parity.

### BH-021: Dense Service Ledgers Rendered Every Evidence Row At Once

Date: 2026-06-10.

Target and suspected bug:

- Service-accountability dense ledgers on the shared React web/native route.

Why this target matters:

- Local proof databases accumulate service statements, disputes, claims, reviews, and merchant import batches quickly during merchant/warehouse live tours.
- Rendering every ledger row at once slows narrow browser and Android WebView review and makes later service evidence hard to find.
- Statements and dispute/claim/review records are local evidence, so dense-state disclosure must stay explicit rather than silently hiding records.

Surfaces, roles, states, and workflows inspected:

- Merchant service-accountability route with dense statement history, open dispute records, and order import history.
- Shared service ledger rendering used by both web and native Android.
- Empty-state behavior for statements and issue records remains unchanged.

Evidence found:

- Statement, issue, and import tables rendered all rows in memory without a visible count or reveal control.
- Other high-traffic queues already had bounded disclosure after recent bug-hunt fixes, so this route lagged behind the current performance-readiness pattern.

Fix:

- Service statements now show "Showing X of Y statements" and reveal later rows with a "Show N more statements" control.
- Dispute, claim, and review records now show "Showing X of Y issue records" and reveal later records explicitly.
- Merchant import history now shows "Showing X of Y import batches" and reveal control behavior.
- `docs/architecture/service-accountability.md` and `docs/architecture/system-diagrams.html` now document dense service ledger disclosure.

Proof run:

- `npm --prefix .\frontend test -- src/pages/ServiceAccountabilityPage.test.tsx --run --no-file-parallelism` passed with 8 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 149 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Run broader proof, then continue Queue 6 with role-action and cross-party alert gaps.

### BH-020: Service Accountability Copied Evidence Normalized Too Late

Date: 2026-06-10.

Target and suspected bug:

- Service-accountability request DTOs and the shared `/service-accountability` React route.

Why this target matters:

- Agreements, statements, disputes, claims, reviews, and SLA policies carry copied operator evidence that appears in web, Android WebView, audits, and local alerts.
- The service layer trimmed many fields before persistence, but bean validation runs before service code, so harmless surrounding whitespace could still trip max-length validation or produce inconsistent frontend/backend payloads.
- The same shared route powers web and native Android, so submit-time behavior must match before final live tours.

Surfaces, roles, states, and workflows inspected:

- Merchant agreement drafting on the shared service-accountability route.
- Backend DTO boundaries for agreement terms, statement keys and notes, statement line descriptions, dispute/claim/review reasons and evidence, resolution outcomes, rate-card notes, and SLA pause notes.
- Local provider boundary copy for statement and dispute evidence records.

Evidence found:

- `ServiceAccountabilityService` trimmed fields such as agreement title, notes, dispute reason, evidence notes, and outcomes after controller validation.
- Service-accountability request records did not normalize copied text in compact constructors, unlike newer auth, admin, merchant, and warehouse request DTOs.
- The frontend agreement form submitted raw title and note state even though the service-accountability route is shared by web and native.

Fix:

- Service-accountability request DTOs now trim copied text before validation and convert optional whitespace-only notes to null.
- The shared route now trims agreement title and notes before submitting a draft and trims those fields on blur.
- `docs/architecture/service-accountability.md` and `docs/architecture/system-diagrams.html` now document service text normalization as part of the web/native/API boundary.

Proof run:

- `backend\mvnw.cmd -q "-Dtest=ServiceAccountabilityRequestNormalizationTest,ServiceAccountabilityServiceTest" test` passed.
- `npm --prefix .\frontend test -- src/pages/ServiceAccountabilityPage.test.tsx --run --no-file-parallelism` passed with 7 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 148 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Run proof, then continue Queue 6 with dense service evidence and role-action gaps.

### BH-019: Dense Warehouse Fulfillment Queues Rendered Every Allocation At Once

Date: 2026-06-10.

Target and suspected bug:

- Warehouse fulfillment queue density on the shared React web/native route.

Why this target matters:

- Proof databases and real local pilots can accumulate many active allocations during merchant order and warehouse pick/pack tours.
- Rendering every queue card at once can degrade route responsiveness and make later work hard to reach on narrow or Android WebView surfaces.
- The warehouse queue owns pick, pack, ship, exception, scan, and workload controls, so dense-state behavior must stay ergonomic and explicit.

Surfaces, roles, states, and workflows inspected:

- Shared `WarehousePage` fulfillment queue.
- Warehouse operator pending, picking, packed, shipped, exception, scan, and shipment evidence controls.
- Dense active allocation states in web and Android-shared UI.

Evidence found:

- `AllocationsTable` rendered every allocation in the filtered set.
- Unlike merchant orders and recent shipments, it had no bounded first page, total count, or reveal control.

Fix:

- Fulfillment queue now shows "Showing X of Y" and a "Show N more allocations" control until all matching allocation work is visible.
- The focused WarehousePage test now proves allocation work after the first page is reachable.
- `docs/architecture/merchant-warehouse-operating-loop.md` and `docs/architecture/system-diagrams.html` now document bounded dense fulfillment queue disclosure.

Proof run:

- `npm --prefix .\frontend test -- src/pages/WarehousePage.test.tsx --run --no-file-parallelism` passed with 13 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 147 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue warehouse receiving edge states, then move to service accountability workflows.

### BH-018: Dense Warehouse Shipment History Hid Terminal Evidence After Eight Rows

Date: 2026-06-10.

Target and suspected bug:

- Warehouse recent shipment history on the shared React web/native route.

Why this target matters:

- Failed, returned, and delivered shipment records are local delivery-state evidence for operational and service review.
- Local proof tours can create more than eight shipments quickly, and hidden terminal evidence makes warehouse review incomplete even when detail routes exist.
- The same route is packaged into native Android, so the dense-state behavior must be explicit on both surfaces.

Surfaces, roles, states, and workflows inspected:

- Shared `WarehousePage` recent shipment history.
- Shipment terminal states `FAILED`, `RETURNED`, and `DELIVERED`.
- Shipment detail route rendering for status, package evidence, carrier dispatch, outbox, allocation, and order links.

Evidence found:

- `RecentShipmentsPanel` rendered only `rows.slice(0, 8)`.
- The section did not show the total shipment count or provide a way to reveal hidden terminal-state records.

Fix:

- Recent shipment history now shows "Showing X of Y" and a "Show N more shipments" control until all shipment evidence rows are visible.
- The focused WarehousePage test now proves terminal shipment evidence after the first page is reachable.
- `docs/architecture/merchant-warehouse-operating-loop.md` and `docs/architecture/system-diagrams.html` now document explicit dense shipment disclosure.

Proof run:

- `npm --prefix .\frontend test -- src/pages/WarehousePage.test.tsx --run --no-file-parallelism` passed with 12 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 146 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue warehouse operations with fulfillment queue density, terminal shipment detail route permissions, and receiving edge states.

### BH-017: Warehouse Evidence Text Was Not Normalized Consistently Across Forms And DTOs

Date: 2026-06-10.

Target and suspected bug:

- Warehouse shipment evidence, workload scan codes, stock adjustments, fulfillment exceptions, inbound receiving notes, and rejection reasons.

Why this target matters:

- Warehouse operators paste tracking numbers, scan codes, packing notes, stock-adjustment reasons, exception descriptions, and receiving notes while working dense local proof queues.
- Copied whitespace should not fail validation, violate tracking patterns, pollute audit evidence, or diverge between the shared web route and Android WebView.
- Numbers, dimensions, priorities, statuses, and ids must remain structured values rather than string-normalized text.

Surfaces, roles, states, and workflows inspected:

- Backend warehouse DTO records for shipment creation, workload update, stock adjustment, exception reporting, inbound receiving, and inbound rejection.
- Shared React `WarehousePage` shipment evidence, scan-code blur, and inventory adjustment workflows.
- Warehouse receiving, pick/pack/ship, exception, and inventory evidence docs.

Evidence found:

- Warehouse DTO validation saw raw copied text for carrier, tracking number, packing note, scan code, reason codes, reason notes, descriptions, receiving notes, and rejection reasons.
- The shared route submitted raw tracking, packing, scan, and stock-adjustment note text.
- Tracking validation could reject a copied value with surrounding whitespace even though the visible value was otherwise valid.

Fix:

- Warehouse DTO records now trim copied evidence text during construction before Jakarta validation.
- The shared warehouse route submits trimmed shipment carrier/tracking/packing note, scan code, stock-adjustment reason code/note, and generated exception text.
- `docs/architecture/merchant-warehouse-operating-loop.md` and `docs/architecture/system-diagrams.html` now document the warehouse copied-evidence boundary.

Proof run:

- `.\mvnw.cmd -q "-Dtest=WarehouseRequestNormalizationTest,FulfillmentServiceTest,MerchantWarehouseServiceTest,InventoryServiceTest" test` passed from `backend`.
- `npm --prefix .\frontend test -- src/pages/WarehousePage.test.tsx --run --no-file-parallelism` passed with 11 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 145 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue warehouse operations with shipment terminal-state detail routes, dense fulfillment queues, and receiving edge states.

### BH-016: Fulfilled Backorders Could Masquerade As Allocated Warehouse Work

Date: 2026-06-10.

Target and suspected bug:

- Merchant order allocation and backorder state transitions in `OrderService`.

Why this target matters:

- The roadmap and allocation docs define `ALLOCATED` as reserved warehouse stock with fulfillment allocation rows.
- A fully backordered order has no reservation and no warehouse work, so moving it to `ALLOCATED` after a backorder row is marked fulfilled misleads merchant queues, warehouse handoff expectations, operational detail routes, and notification review.
- Web and Android render the same order status, so the backend state must preserve the domain meaning.

Surfaces, roles, states, and workflows inspected:

- Backend `OrderService.allocate`, `OrderService.cancel`, and `OrderService.updateBackorder`.
- `OrderServiceTest` allocation, cancellation, and backorder transition coverage.
- Merchant order queue, operational detail status display, and allocation/backorder architecture docs.

Evidence found:

- `updateBackorder` set a fully `BACKORDERED` order to `ALLOCATED` when all backorder rows were closed by a `FULFILLED` transition.
- That status change happened without creating fulfillment allocation rows or reserving stock.
- Existing docs already defined `ALLOCATED` as all requested units reserved.

Fix:

- Backorder fulfillment now updates the backorder row and emits the backorder event without changing the order to `ALLOCATED`.
- The focused backend test now proves a fulfilled fully backordered order keeps `BACKORDERED` status and has no allocation rows.
- `docs/architecture/allocation-strategy.md`, `docs/architecture/partial-allocation.md`, and `docs/architecture/system-diagrams.html` now document that fulfilled backorders do not synthesize allocation state.

Proof run:

- `.\mvnw.cmd -q "-Dtest=OrderServiceTest" test` passed from `backend`.
- `.\mvnw.cmd -q test` passed from `backend`, including the empty-database Flyway integration path.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue merchant notification handoffs, then move to warehouse receiving and fulfillment queue state transitions.

### BH-015: Dense Merchant Order Queues Hid Work After The First 20 Cards

Date: 2026-06-10.

Target and suspected bug:

- Merchant order queue dense state on the shared React web/native route.

Why this target matters:

- Local proof databases can accumulate more than 20 orders quickly during Android and browser tours.
- A hidden cap without a reveal control can make active orders, backorders, and allocation links unreachable from the stakeholder queue.
- The issue affects both web and Android because the native APK packages the same route.

Surfaces, roles, states, and workflows inspected:

- Shared `MerchantOrdersPage` filtering and `OrdersTable` rendering.
- Active merchant dense order queues after import/create/allocation work.
- Status-filtered order queue state.

Evidence found:

- `OrdersTable` rendered only `orders.slice(0, 20)`.
- The header said how many were shown but did not state the total or provide a way to reveal additional matching orders.

Fix:

- Filtered orders are memoized so the dense-list state resets when the matching order set changes.
- `OrdersTable` now shows "Showing X of Y" and a "Show N more orders" control until all matching orders are visible.
- `docs/architecture/merchant-warehouse-operating-loop.md` and `docs/architecture/system-diagrams.html` now document explicit dense order disclosure.

Proof run:

- `npm --prefix .\frontend test -- src/pages/MerchantPages.test.tsx --run --no-file-parallelism` passed with 17 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 144 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue merchant operations with allocation/backorder/notification handoffs, then move to warehouse operations.

### BH-014: Pasted Order Imports Could Silently Turn Bad Quantities Into One-Unit Orders

Date: 2026-06-10.

Target and suspected bug:

- Merchant audited order import on the shared React web/native route.

Why this target matters:

- Merchant users paste order rows from external systems during dense intake work.
- A malformed copied quantity should stop the user with a visible validation error instead of creating accidental one-unit demand.
- The same route is packaged into native Android, so this front-end contract must be deterministic across web and mobile.

Surfaces, roles, states, and workflows inspected:

- Shared `MerchantOrdersPage` CSV import parsing.
- Backend import DTO and service boundary for audited import batches.
- Merchant active order-import workflow, malformed pasted row state, and valid partial-accept import state.

Evidence found:

- The pasted CSV importer used `Number(qty) || 1`.
- Blank, nonnumeric, zero, and other invalid quantities therefore became `1` before the API saw the batch.
- The backend import API validates positive quantities and records accepted or rejected rows, but this UI fallback mutated the pasted evidence first.

Fix:

- The shared merchant order-import route now requires each pasted quantity to be a positive whole number before submission.
- Invalid pasted quantities show a route-level validation error and do not call the import API.
- `docs/architecture/merchant-warehouse-operating-loop.md` and `docs/architecture/system-diagrams.html` now document the import quantity boundary.

Proof run:

- `npm --prefix .\frontend test -- src/pages/MerchantPages.test.tsx --run --no-file-parallelism` passed with 16 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 143 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue merchant operations with allocation/backorder/notification handoffs and dense order queue visibility.

### BH-013: Merchant Copied Text Was Not Normalized Consistently Across Forms And DTOs

Date: 2026-06-10.

Target and suspected bug:

- Merchant inventory, warehouse-service request, inbound stock, customer contact, order creation, and order-import text inputs.

Why this target matters:

- Merchant users often paste SKUs, customer addresses, ASN references, contact details, and CSV rows from external systems.
- Whitespace-padded text should not fail validation or pollute stored operational evidence.
- Web and native Android share these React routes, so frontend payloads and backend DTO validation must agree.

Surfaces, roles, states, and workflows inspected:

- Backend merchant DTO records for inventory create/update, relationship request notes, inbound stock, customer orders, customer contacts, and order imports.
- Shared React `MerchantInventoryPage` and `MerchantOrdersPage`.
- Merchant create SKU, request service, submit inbound stock, save contact, create order, and import-order workflows.

Evidence found:

- CSV parsing trimmed pasted cells, and several services trimmed fields after validation.
- DTO validation could still see raw copied text first.
- Shared merchant forms submitted raw text for SKU/name, service notes, inbound reference/note, customer address, and contact fields.

Fix:

- Merchant DTO records now trim copied text during construction before validation.
- Shared React merchant forms now submit trimmed text fields for inventory, relationship, inbound, order, and reusable contact workflows.
- Structured ids and quantities remain unchanged.
- `docs/architecture/merchant-warehouse-operating-loop.md` and `docs/architecture/system-diagrams.html` now document merchant copied-text normalization.

Proof run:

- `.\mvnw.cmd -q "-Dtest=MerchantRequestNormalizationTest,MerchantWarehouseServiceTest" test` passed from `backend`.
- `npm --prefix .\frontend test -- src/pages/MerchantPages.test.tsx --run --no-file-parallelism` passed with 15 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 142 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue merchant operations with allocation/backorder/notification handoffs and dense order states, then move to warehouse operations.

### BH-012: Admin Copied Text Could Fail Validation Or Pollute Audit Reasons

Date: 2026-06-10.

Target and suspected bug:

- Admin tenant, warehouse, user, relationship, tenant-toggle, password-reset, role-change, and outbox dead-letter text inputs.

Why this target matters:

- Admin workflows are high-impact governance paths. Copied whitespace should not make an otherwise valid email, tenant name, warehouse name, address, or reason fail validation or create noisy audit/history text.
- Password values must stay exact because trimming secrets can silently change operator intent.
- The same React admin forms serve web and native Android, so frontend/backend normalization must agree.

Surfaces, roles, states, and workflows inspected:

- Backend admin DTO records for user creation, tenant creation, warehouse creation, action reasons, role changes, and admin password resets.
- Shared React admin users, tenants, relationships, and outbox pages.
- Owner/admin mutation and support-admin password recovery/read-only diagnostic flows.

Evidence found:

- Backend services often trimmed after validation, but DTO validation happens at the request boundary first.
- Admin UI submitted raw copied text for create-user email, tenant and warehouse fields, governance reasons, support reset reasons, relationship reasons, tenant toggle reasons, and dead-letter reasons.
- Password and reset-password fields need to remain untrimmed.

Fix:

- Admin DTO records now trim public/governance text fields during construction before Jakarta validation.
- Password and temporary reset password fields remain unchanged.
- Shared React admin forms now submit trimmed text fields and exact password values for user creation, tenant/warehouse creation, tenant and relationship governance, support password reset, role changes, and outbox dead-letter actions.
- `docs/architecture/admin-auth.md` and `docs/architecture/system-diagrams.html` now document the copied-admin-input boundary.

Proof run:

- `.\mvnw.cmd -q "-Dtest=AdminRequestNormalizationTest,UserServiceTest,TenantServiceTest,MerchantWarehouseServiceTest" test` passed from `backend`.
- `npm --prefix .\frontend test -- src/pages/AdminManagement.test.tsx src/pages/AdminOutboxPage.test.tsx --run --no-file-parallelism` passed with 36 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 141 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Admin governance now has concrete fixes for route guards, outbox attention, relationship service guards, dense pagination, and copied-input boundaries. Next pass should either inspect remaining tenant-service edge cases or move to merchant operations if no high-impact admin gaps are found.

### BH-011: Relationship Governance Service Guard Was Broader Than Route/UI Contract

Date: 2026-06-10.

Target and suspected bug:

- Merchant-warehouse relationship governance for owner/admin, support-admin, auditor, merchant, and warehouse roles.

Why this target matters:

- Relationship status controls determine whether merchant stock, inbound work, allocation, and service accountability can proceed.
- The shared React admin page and controller expose suspend/reactivate/end as owner/admin-only platform governance.
- The service still used broad `isAdmin()` checks, which include support-admin and auditor roles, so a future controller path or direct service use could bypass the intended mutation boundary.

Surfaces, roles, states, and workflows inspected:

- `MerchantWarehouseController`, `MerchantWarehouseService`, `AdminRelationshipsPage`, and admin relationship tests.
- Active, suspended, and ended relationship transitions.
- Support/auditor read-only review state and owner/admin governance state.

Evidence found:

- Controller routes for suspend/reactivate/end already used `@currentUserService.canMutatePlatform()`.
- The service methods checked only `currentUserService.isAdmin()`, which is true for support-admin and auditor users.
- The UI correctly hid relationship mutation controls from support-admin and auditor users, leaving the service guard broader than the visible and routed contract.

Fix:

- `MerchantWarehouseService` now requires `canMutatePlatform()` for suspend, reactivate, and end relationship actions.
- Added service tests proving non-mutating platform roles cannot suspend relationships and owner/admin users can suspend, reactivate, and end with trimmed governance reasons.
- `docs/architecture/merchant-warehouse-operating-loop.md`, `docs/architecture/admin-auth.md`, and `docs/architecture/system-diagrams.html` now document the relationship governance permission split.

Proof run:

- `.\mvnw.cmd -q "-Dtest=MerchantWarehouseServiceTest,AdminUserControllerTest" test` passed from `backend`.
- `npm --prefix .\frontend test -- src/pages/AdminManagement.test.tsx --run --no-file-parallelism -t "Admin relationship governance"` passed with 4 tests and 26 skipped tests in the selected file.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue admin governance with dense tenant/user pagination and tenant mutation boundaries before moving to merchant operations.

### BH-010: Outbox Attention Asked Read-Only Roles To Retry Failed Work

Date: 2026-06-10.

Target and suspected bug:

- Admin outbox diagnostics and attention signals for owner/admin, support-admin, and auditor roles.

Why this target matters:

- `/admin/outbox` is shared by web and native Android through the same React route.
- Owner/admin users can process, retry, and dead-letter outbox events. Support-admin and auditor users can review diagnostics but cannot mutate reliability state.
- The attention queue must not ask read-only roles to perform forbidden actions.

Surfaces, roles, states, and workflows inspected:

- Backend `OutboxAdminService.summary`, `AdminOutboxController`, and outbox service tests.
- Shared React `AdminOutboxPage` attention queue, read-only support-admin mode, failed/retryable event state, and carrier dispatch diagnostics.

Evidence found:

- `OutboxAdminService.summary` generated failed-outbox attention with owner role `ADMIN` and next action `Retry failed work` for every platform role.
- Support-admin and auditor users could read the outbox summary, but retry/dead-letter/process endpoints are owner/admin-only.
- The React page already hid mutation controls from support-admin, creating a mismatch between the top attention queue and row-level controls.

Fix:

- `OutboxAdminService` now reads the current role and emits retry language only for owner/admin users.
- Support-admin and auditor summaries keep the failed-work signal but use the current role, `Review diagnostics`, and escalation wording for owner/admin retry or dead-letter handling.
- `AdminOutboxPage.test.tsx` now proves support-admin sees read-only controls and review/escalation attention language.
- `docs/architecture/outbox.md`, `docs/architecture/admin-auth.md`, and `docs/architecture/system-diagrams.html` now document role-aware outbox diagnostics.

Proof run:

- `.\mvnw.cmd -q "-Dtest=OutboxAdminServiceTest,AdminControlServiceTest" test` passed from `backend`.
- `npm --prefix .\frontend test -- src/pages/AdminOutboxPage.test.tsx --run --no-file-parallelism` passed with 5 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 140 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue admin governance bug hunting with relationship governance and dense tenant/user state, then move to merchant operations once the admin file group no longer shows high-impact gaps.

### BH-009: Admin User Mutations Relied On Service Conflicts Instead Of Route Guards

Date: 2026-06-10.

Target and suspected bug:

- Admin user-management permission boundaries for owner/admin, support-admin, and auditor roles.

Why this target matters:

- The shared UI hides account-status and role-mutation controls from support-admin and auditor users.
- The backend service rejected unsupported mutations, but the controller boundary for enable, disable, and role changes inherited the broader `isAdmin()` class guard. Direct API calls from support-admin or auditor users could reach service conflict handling instead of being denied at the route authorization layer.
- V&V needs denied states to be coherent across web, Android, and direct API behavior.

Surfaces, roles, states, and workflows inspected:

- `AdminUserController`, `UserService`, admin user-management UI permissions, and existing role-navigation tests.
- Owner/admin account mutation, support-admin account recovery, and auditor read-only review boundaries.

Evidence found:

- `AdminUserController.create` already required `@currentUserService.canMutatePlatform()`.
- `disable`, `enable`, and `changeRole` lacked method-level `canMutatePlatform()` guards even though the UI and service contract treated them as owner/admin-only.
- `resetPassword` is intentionally broader because support-admin can recover supported user accounts.

Fix:

- Added method-level `@PreAuthorize("@currentUserService.canMutatePlatform()")` to admin user enable, disable, and role-change endpoints.
- Left support password reset below platform-mutation permission.
- Added `AdminUserControllerTest` to lock the route annotation contract.
- `docs/architecture/admin-auth.md` and `docs/architecture/system-diagrams.html` now document the owner/admin mutation, support recovery, and auditor read-only split.

Proof run:

- `.\mvnw.cmd -q "-Dtest=AdminUserControllerTest,UserServiceTest" test` passed from `backend`.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue admin governance bug hunting with tenant/relationship/outbox dense states and route permission parity.

### BH-008: Copied Public Account Email Whitespace Failed Before Normalization

Date: 2026-06-10.

Target and suspected bug:

- Public login, password-reset request, and public access-request validation boundaries.

Why this target matters:

- Public auth and onboarding routes are used before a stakeholder can recover, request access, or enter the operating workspace.
- Services normalized email and access-request text, but Jakarta validation runs at the controller boundary first. A copied value like ` merchant@merhouse.local ` could fail `@Email` before the service reached its normalization path.
- Web and native Android share the same React forms, so the UI and backend should agree about copied whitespace handling.

Surfaces, roles, states, and workflows inspected:

- Backend `LoginRequest`, `PasswordResetRequest`, and `AccessRequestCreateRequest` DTO validation.
- Auth and access-request controllers.
- Shared React login, password recovery, and request-access pages.
- Public copied-input state before authentication.

Evidence found:

- Backend services trimmed email or access-request text after validation.
- DTO fields used `@Email`, `@NotBlank`, and `@Size`, so whitespace-padded emails could be rejected before service normalization.
- Frontend forms submitted raw copied values for login email, password-reset email, organization name, requester email, and access-request notes.

Fix:

- `LoginRequest`, `PasswordResetRequest`, and `AccessRequestCreateRequest` now trim public text fields in record construction before validation.
- Password and new-password values remain untrimmed.
- Shared React login, password-recovery, and request-access forms now submit trimmed public text fields while preserving password values exactly.
- `docs/architecture/account-lifecycle.md` and `docs/architecture/system-diagrams.html` now document the copied-whitespace normalization boundary.

Proof run:

- `.\mvnw.cmd -q "-Dtest=AuthControllerTest,AccessRequestControllerTest,AuthServiceTest,AuthRecoveryServiceTest,AccessRequestServiceTest" test` passed from `backend`.
- `npm --prefix .\frontend test -- src/pages/LoginPage.test.tsx src/pages/AuthRecoveryPages.test.tsx --run --no-file-parallelism` passed with 8 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 140 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue queue item 2 by checking remaining public validation and denial states, then move to admin governance files without broad refactoring.

### BH-007: Stale Stored Token Restore Lacked Frontend Proof

Date: 2026-06-10.

Target and suspected bug:

- Disabled-account and stale-token behavior during shared React session restore.

Why this target matters:

- Web and native Android share the same `AuthProvider`, so stale token handling must be identical on both surfaces.
- Disabled accounts are filtered by backend request authentication. The frontend must clear the stored token after `/me` rejects it so users do not remain trapped in a restoring-session or half-authenticated state.

Surfaces, roles, states, and workflows inspected:

- Backend login, JWT authentication filter, current-user lookup, and disabled-account checks.
- Shared frontend `AuthProvider` restore flow used by browser and Android WebView.
- Stale local token state after account disablement or token invalidation.

Evidence found:

- Backend login already rejects disabled users with the generic bad-credentials boundary.
- The JWT request filter reloads the persisted user and sets authentication only when the user remains enabled.
- `AuthProvider` already called `/me` for stored tokens and logged out on restore failure, but no focused frontend test guarded that web/native shared behavior.

Fix or decision:

- Added a focused `AuthProvider` regression test that seeds `warehouse-console-token`, makes `/me` reject the restore, and asserts local storage, user state, token state, and loading state all return to logged-out idle.
- No product behavior or system diagram change was needed because the existing documented disabled-account contract already matched the implementation.

Proof run:

- `npm --prefix .\frontend test -- src/auth/AuthContext.test.tsx --run --no-file-parallelism` passed with 1 test.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 23 files and 140 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Queue item 2 should continue with public auth/access-request route validation and then move to admin governance rather than revisiting stale-token restore.

### BH-006: Access-Request Conversion Allowed Blank Reason In UI

Date: 2026-06-10.

Target and suspected bug:

- Admin access-request conversion readiness in the shared React UI.

Why this target matters:

- Backend conversion requires a temporary setup password and nonblank conversion reason.
- The UI should prevent known-invalid conversion attempts before an operator clicks `Convert`, especially in live validation where confusing avoidable errors slow review.

Surfaces, roles, states, and workflows inspected:

- `AdminAccessRequestsPage` conversion form and row actions.
- Backend `AccessRequestConvertRequest` validation contract.
- Admin owner/admin approved-request conversion workflow.

Evidence found:

- The UI showed `Convert` when only the temporary password was ready.
- If the conversion reason was cleared or whitespace-only, the UI could submit an invalid backend request and then surface a validation error.
- The disabled-state chip also said `Enter setup password` even when the password was ready and the missing field was the reason.

Fix:

- `AdminAccessRequestsPage` now requires both a temporary setup password and nonblank conversion reason before showing `Convert`.
- Conversion submits the trimmed reason while preserving the temporary password exactly.
- The waiting chip now says `Enter conversion reason` when the password is ready but the reason is blank.
- `AdminManagement.test.tsx` covers the no-call bad state and the trimmed successful payload.
- `docs/architecture/account-lifecycle.md` now documents the setup-password plus conversion-reason contract.

Proof run:

- `npm --prefix .\frontend test -- src/pages/AdminManagement.test.tsx --run --no-file-parallelism` passed with 30 tests.
- `.\mvnw.cmd -q "-Dtest=AccessRequestServiceTest" test` passed.

Remaining risk and next target:

- Continue queue item 2 by auditing disabled-account/stale-token behavior and public route validation.

### BH-005: Access-Request Conversion Overwrote Approval Reviewer

Date: 2026-06-10.

Target and suspected bug:

- Access-request conversion audit trail after an approved public onboarding request is converted into a tenant and user.

Why this target matters:

- The access-request record carries the original approve/reject decision trail: reviewer, review note, and review time.
- Conversion is a separate platform mutation with its own `ACCESS_REQUEST_CONVERTED` admin audit event.
- Overwriting the original reviewer during conversion makes the API response pair the original approval timestamp and note with the wrong user.

Surfaces, roles, states, and workflows inspected:

- Backend `AccessRequestService.convert`.
- Public request to platform approve to account conversion lifecycle.
- Account lifecycle docs and system diagram entity summary.

Evidence found:

- `AccessRequestService.convert` fetched the conversion actor and assigned it to `accessRequest.reviewedBy`.
- The request still retained the original `reviewedAt` and `reviewNote`, so the response could report a conversion actor as if they had made the approval decision.

Fix:

- `AccessRequestService.convert` now preserves the existing approval reviewer, review time, and review note.
- The conversion actor remains represented by the controller's `ACCESS_REQUEST_CONVERTED` admin audit event.
- `AccessRequestServiceTest` now asserts conversion leaves the original review trail intact.
- `docs/architecture/account-lifecycle.md` and `docs/architecture/system-diagrams.html` now document the split between approval review trail and conversion audit actor.

Proof run:

- `.\mvnw.cmd -q "-Dtest=AccessRequestServiceTest" test` passed.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- Continue queue item 2 by auditing public access-request validation and admin UI conversion bad states.

### BH-004: Copied Reset Token Whitespace Rejected

Date: 2026-06-10.

Target and suspected bug:

- Password reset confirmation in the public account lifecycle flow.

Why this target matters:

- The reset flow is a public route used in both browser and the shared Android WebView shell.
- Local proof can expose a reset token deliberately, and real users often copy tokens with surrounding spaces or newlines.
- The system should normalize the token boundary without changing the new password value.

Surfaces, roles, states, and workflows inspected:

- Backend `AuthRecoveryService` token confirmation.
- Public React `ResetPasswordPage`.
- Account lifecycle docs and system diagram public-route summary.

Evidence found:

- `AuthRecoveryService.confirmReset` hashed the submitted token string exactly.
- `ResetPasswordPage` passed the token input exactly as typed.
- A valid token copied as `  token\r\n` would hash differently and return the generic invalid-or-expired result.

Fix:

- `AuthRecoveryService.confirmReset` now trims surrounding whitespace before hashing the reset token.
- `ResetPasswordPage` trims the token before calling the API.
- The new password value is intentionally not trimmed.
- `docs/architecture/account-lifecycle.md` and `docs/architecture/system-diagrams.html` now document the copied-token normalization boundary.

Proof run:

- `.\mvnw.cmd -q "-Dtest=AuthRecoveryServiceTest,AccessRequestServiceTest" test` passed.
- `npm --prefix .\frontend test -- src/pages/AuthRecoveryPages.test.tsx --run --no-file-parallelism` passed with 6 tests.

Remaining risk and next target:

- Continue the auth/account lifecycle/access-request file group by auditing request conversion, denial boundaries, local owner credential repeatability, and public validation behavior.

### BH-003: Action Inbox Hidden Behind Recent Delivery History

Date: 2026-06-10.

Target and suspected bug:

- Notification center action inbox and delivery history under dense mixed read/unread local records.

Why this target matters:

- `BH-001` fixed the unread metric and `BH-002` fixed backend summary attention signals, but the page still loaded one mixed delivery list and filtered it client-side into action/history sections.
- If newer read or skipped records filled the bounded mixed list, older unread alerts could be absent from the action inbox even though the backend unread count said work remained.

Surfaces, roles, states, and workflows inspected:

- Backend `NotificationController`, `NotificationService`, and `NotificationDeliveryRepository`.
- Frontend API client and shared React notification center used by web and native Android.
- Dense recipient-scoped alert state with newer read history and older unread action work.

Evidence found:

- `GET /api/v1/notifications/deliveries?limit=50` returned mixed recent delivery records.
- `NotificationCenterPage` used that mixed list for both the action inbox and delivery history.
- The UI could show unread count or summary attention work while the action inbox failed to render older unread records hidden behind recent read history.

Fix:

- `GET /api/v1/notifications/deliveries` now accepts optional `status`, including `status=RECORDED`, while preserving the existing unfiltered list.
- `NotificationService.deliveriesForUser` can query recipient deliveries by status through `findByRecipientIdAndStatusOrderByCreatedAtDesc`.
- The frontend API client can request status-filtered delivery records.
- `NotificationCenterPage` now loads unread `RECORDED` action records separately from recent mixed delivery history and defensively filters action cards to unread records.
- `docs/architecture/notifications.md` and `docs/architecture/system-diagrams.html` now document the split between unread action deliveries and mixed delivery history.

Proof run:

- `npm --prefix .\frontend test -- src/pages/NotificationsRoutePage.test.tsx src/api/client.test.ts --run --no-file-parallelism` passed with 16 tests.
- `.\mvnw.cmd -q "-Dtest=NotificationServiceTest,NotificationControllerTest" test` passed.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 22 files and 137 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- The notification file-group audit had covered unread count, backend attention signals, and action/history list separation. `BH-034` later closed the explicit pagination/load-more risk for dense unread action pages.
- Next file-audit target should move to auth/account lifecycle/access request files rather than repeating notification count/list bugs unless live proof finds a new notification-specific mismatch.

### BH-002: Unread Attention Signals Hidden By Recent Read History

Date: 2026-06-10.

Target and suspected bug:

- Backend notification summary attention signals under dense mixed read/unread delivery history.

Why this target matters:

- The app shell, notification center, and future live walkthrough all depend on `/api/v1/notifications/summary` to tell a stakeholder whether alert work still needs attention.
- Dense local proof data can contain many read or skipped records. The unread count and attention signals must describe the same actionable queue.

Surfaces, roles, states, and workflows inspected:

- Backend notification summary for any authenticated stakeholder.
- App-shell alert badge and notification attention signal state consumed by the shared web/native frontend.
- Dense alert history with newer read records and older unread records.

Evidence found:

- `NotificationService.summaryForUser` counted unread deliveries with `countByRecipientIdAndStatus(..., RECORDED)`.
- It then fetched the latest five deliveries regardless of status and filtered unread records in memory.
- If the latest five records were read or skipped while older unread records existed, the summary could return `unreadCount > 0` with no attention signals.

Fix:

- `NotificationDeliveryRepository` now exposes `findByRecipientIdAndStatusOrderByCreatedAtDesc(...)`.
- `NotificationService.summaryForUser` now builds attention signals from the latest unread `RECORDED` deliveries directly.
- `NotificationServiceTest` now covers the dense mixed-history case where newer read history must not crowd older unread work out of the summary.

Proof run:

- `.\mvnw.cmd -q "-Dtest=NotificationServiceTest" test` passed.

Remaining risk and next target:

- This closes the backend summary mismatch. Future bug hunts should inspect whether bounded notification delivery lists need pagination or load-more behavior for real operators.
- Native OS push, lock-screen, notification-tray, email, SMS, webhook, and provider delivery remain out of local V16.2 scope unless a later roadmap phase explicitly activates real providers.

### BH-001: Dense Alert Count Mismatch

Date: 2026-06-10.

Target and suspected bug:

- Notification center unread counts under dense local alert history.

Why this target matters:

- Notifications are shared by web and native Android through the same React page.
- The app shell badge uses backend summary state, while the notification center previously derived its `Unread` metric from only the first loaded delivery page.
- Stakeholders use alert counts to decide whether the queue is clear. A dense-state mismatch undermines web/mobile trust and frontend/backend sync.

Surfaces, roles, states, and workflows inspected:

- Shared React notification center used by web and native Android.
- Authenticated stakeholder alert center for any role with notification access.
- Dense alert history where more unread records exist than the first loaded delivery page.

Evidence found:

- `AppLayout` reads `api.notificationSummary(token)` and shows the backend unread count.
- `NotificationCenterPage` loaded only preferences and the first 50 deliveries, then computed `Unread` from that bounded list.
- With 73 unread backend records and 50 loaded delivery cards, the shell badge could show 73 while the notification page metric showed 50.

Fix:

- `frontend/src/features/notifications/NotificationCenterPage.tsx` now loads `api.notificationSummary(token)` alongside preferences and the first 50 delivery records.
- The page `Unread` metric now uses the backend summary count, falling back to the visible delivery count only when summary data is unavailable.
- Marking a visible unread delivery read decrements the page summary count optimistically and still dispatches the existing unread-count event for the app shell.
- `frontend/src/pages/NotificationsRoutePage.test.tsx` covers the dense-alert case: 50 loaded delivery cards and 73 unread records in the backend summary.

Proof run:

- `npm --prefix .\frontend test -- src/pages/NotificationsRoutePage.test.tsx --run --no-file-parallelism` passed with 7 tests.
- `.\scripts\quality\frontend-check.ps1 -SkipInstall` passed frontend lint, production build, and Vitest with 22 files and 136 tests.
- `.\scripts\quality\markdown-check.ps1` passed.

Remaining risk and next target:

- `BH-003` later separated unread action records from mixed history, and `BH-034` later added load-more behavior for dense unread action pages.
- Native OS push, lock-screen, notification-tray, email, SMS, webhook, and provider delivery remain out of local V16.2 scope unless a later roadmap phase explicitly activates real providers.
- Next target should stay bug-focused: source-route permission mismatches, stale-session state, or web/native state-copy disagreement.
