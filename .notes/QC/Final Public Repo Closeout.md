# Final Public Repo Closeout

This note records the final goodbye gate so the work is not only a chat promise. Durable phase ownership lives in `docs/architecture/roadmap.md` under `Final Public-Repo Closeout Gate`.

## Required Sequence

1. Run one last whole-app live browser QC tour across every role, route, workflow state, account settings, notifications, assistant, service accountability, outbox, audit, and operational detail page.
2. Include both seeded/busy data and fresh/empty stakeholders. Fresh merchant and warehouse users must be guided from empty state into active workflow participation.
3. Check desktop and narrow viewports. No real-world user-facing clunk, confusion, misleading copy, inaccessible control, stiff empty state, secret leakage, redundant panel, or unrealistic workflow can remain.
4. Iterate fixes until live browser results and automated proof converge.
5. Run final proof: backend tests, frontend lint/build/Vitest, Playwright E2E, API smoke, markdown check, public-readiness, deployment-readiness, script parser, and any closeout drift scans.
6. After proof passes, inspect the working tree and merge intentionally to `main`.
7. After the merge, update `README.md` based on the final live-tour truth: product purpose, roles, local workflow, setup, test commands, local mocks, and non-deployed boundaries.
8. Delete only files that are clearly obsolete, duplicate, generated, unrelated, or useless. Record every deletion with the reason.
9. Prepare the public repository boundary so a future public repo contains only developer/user-relevant material and no secrets, private nuance, private prompts, generated sensitive reports, internal endpoints, or production-deployment assumptions.

## Closeout Evidence To Record

- Browser route/role/viewport coverage.
- Bugs or UX issues found and how they were closed.
- Final command results.
- README sections changed.
- Deleted files and reasons.
- Public-boundary inventory.
- Merge branch, target branch, commit id, and proof that `main` contains the result.

## 2026-06-07 Live Browser QC Evidence

- Desktop route sweep at 1366x850 covered public auth/recovery/access/reset routes; owner/admin routes; merchant routes; warehouse routes; support-admin routes; auditor routes; shared account, notifications, assistant, service-accountability, outbox, audit, and operational detail routes. Result after fixes: 56 checked route-role entries, 0 visible QC issues.
- Narrow route sweep at 390x820 covered the same route-role matrix. Result after fixes: 56 checked route-role entries, 0 visible QC issues.
- Fresh empty stakeholder tour created disposable local accounts:
  - Merchant: `final.empty.merchant.final-mq428vgh@merhouse.local`
  - Warehouse operator: `final.empty.operator.final-mq428vgh@merhouse.local`
- Fresh empty-state browser routes checked merchant `/merchant`, `/merchant/inventory`, `/merchant/orders`, `/service-accountability`, `/assistant`, `/notifications`, `/account`; warehouse `/warehouse`, `/service-accountability`, `/assistant`, `/notifications`, `/account`. Result: 12 checked entries, 0 visible QC issues.
- Empty-to-active activation was proven with the same disposable accounts: relationship became `ACTIVE`, inbound became `RECEIVED`, and order became `ALLOCATED`.
- Active-state browser routes checked merchant overview/inventory/orders/order detail/inbound detail/relationship detail/notifications and warehouse console/inbound detail/notifications. Result: 10 checked entries, 0 visible QC issues.
- Account settings browser action changed the disposable merchant password through `/account`, cleared all password fields on success, and logged in again with the new password. Result: 0 visible QC issues.

## 2026-06-07 Convergence Fixes

- Replaced the framework default route failure screen with authenticated MerHouse route fallbacks:
  - `frontend/src/pages/NotFoundPage.tsx`
  - `RouteErrorPage`
  - authenticated `*` catch-all under the rooted router
- Added focused frontend coverage in `frontend/src/pages/NotFoundPage.test.tsx`.
- Made table last columns sticky inside `.table-wrap` so visible action/detail columns stay reachable while dense tables remain horizontally scrollable.
- Updated `docs/architecture/system-diagrams.html` to record 25 business frontend routes plus `/` and `*` guard paths, and to describe the route-unavailable fallback.

## 2026-06-07 Command Proof

- `npm run test -- --run src/pages/NotFoundPage.test.tsx src/components/AppLayout.test.tsx`: passed, 13 tests.
- `npm run test -- --run src/pages/NotFoundPage.test.tsx`: passed, 2 tests.
- `docker compose build frontend; docker compose up -d frontend`: passed after route fallback and sticky table changes.
- `.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose`: passed.
  - Backend tests: 150 passed.
  - Frontend lint/build/Vitest: 21 files, 127 tests passed.
  - Playwright E2E: 18 passed.
  - Markdown check: passed.
  - Public-readiness: passed.
  - API smoke: passed; latest report `reports/api-smoke-test-20260607-204120.summary.md`.
- Script parser proof over `scripts/**/*.ps1`: exit 0.
- Route/table/controller drift proof: 37 Flyway tables, 25 business frontend routes, 27 total router paths including `/` and `*`, 17 REST controllers.
- `git diff --check`: passed.

## 2026-06-07 Cleanup And Public Boundary

- Cleanup performed: `.\scripts\maintenance\clean-reports.ps1 -KeepLatest 3` removed older duplicate API smoke report runs and kept latest proof artifacts.
- Kept ignored local/runtime material because it is not part of the future public boundary and remains useful locally:
  - `.env`
  - `.obsidian/`
  - `.vscode/`
  - `backend/target/`
  - `frontend/dist/`
  - `frontend/node_modules/`
  - `frontend/test-results/`
  - current `reports/` proof artifacts
- Future public repository boundary remains `backend/` and `frontend/` only. Private notes, `private/`, generated reports, local `.env`, editor folders, and deployment-only local proof material stay outside that boundary.

## Merge And README Follow-Up

- Pending: commit closeout branch, merge `codex/v15-8-structural-stabilization` into `main`, then update `README.md` on `main` with the final live-tour truth and record the exact README sections changed.
