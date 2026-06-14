# V17 Portfolio Closure Status

> **Date:** 2026-06-14
>
> **Status:** Deployment is confirmed live. The three portfolio features in active V17 scope are implemented in the current codebase. AI Assistant Completion is deferred to Vinfinite. The remaining V17 work is closure convergence and deployed-proof execution.

## Purpose

This document replaces the earlier contradictory V17 re-evaluation with a single closure-status summary that matches the current repository state.

Use it to answer four questions only:

1. What is already implemented?
2. What is explicitly deferred?
3. What proof is still open?
4. Which tracked documents own the remaining closure work?

For the ordered closure checklist, use [`Closure_Plan.md`](./Closure_Plan.md). For roadmap policy and QC rules, use [`docs/architecture/roadmap.md`](../architecture/roadmap.md). For the historical audit foundation, use [`IMPLEMENTATION_SEQUENCE.md`](./IMPLEMENTATION_SEQUENCE.md).

## Verified Status Snapshot

| Item | Status | Repository-visible evidence |
| --- | --- | --- |
| Deployment lane | Confirmed live | Managed deployment docs, CI workflows, and deployed-proof scripts are present for Neon PostgreSQL, Hugging Face Docker Space, Vercel, GitHub Actions, and GitHub Release APK distribution. |
| Feature A: Access Request & Approve-and-Activate | Implemented | `AccessRequestService.java`, `AccessRequestController.java`, `AdminPages.tsx`, related backend/frontend tests. |
| Feature B: OTP Password Recovery | Implemented | `AuthRecoveryService.java`, `AuthController.java`, `AuthRecoveryPages.tsx`, related backend/frontend tests, OTP migration. |
| Feature C: How To Use Page | Implemented | `HowToUsePage.tsx`, `App.tsx`, `AppLayout.tsx`, `LoginPage.tsx`, related frontend tests. |
| Email console capture mode | Implemented | `EmailDeliveryService.java`, `application.properties`. |
| AI Assistant Completion with threading/chat UI | Deferred to Vinfinite | Not implemented; current deterministic assistant remains read-plus-draft, flat-history, non-threaded behavior. |
| Local quality baseline | Proven | V16.2 local certification and cross-surface evidence are tracked in `docs/quality/`. |
| Deployed closure evidence package | Still open | Scripts exist, but closure still requires fresh proof artifacts and attachment validation for the active live lane. |

## What V17 Means Now

V17 is no longer a feature-build phase.

The product-scope work that remained after deployment confirmation has already landed in the repository:

- Access Request & Approve-and-Activate exists end to end.
- OTP Password Recovery exists end to end.
- The How To Use page exists and is wired into public and authenticated navigation.
- Email console capture mode exists for local/demo recovery and activation flows.

AI Assistant Completion is not part of V17 closure. Conversation threading, chat-style UI, richer contextual awareness, and workflow-guidance completion remain deferred to Vinfinite unless the roadmap is deliberately changed.

The remaining V17 work is therefore closure work:

- update closure-critical browser and API proof to reflect the implemented identity-lifecycle flows
- align CI with those updated proof lanes
- align docs and diagrams with the implemented OTP, access-request, assistant, and deployment behavior
- validate the script inventory and deployed-proof attachment chain
- execute the remaining live-lane evidence collection for monitoring, browser proof, load smoke, backup/restore, rollback, Android release, provider proof, alert proof, and live walkthrough proof

## Repository-Visible Implementation Evidence

### Feature A: Access Request & Approve-and-Activate

The repository already contains:

- `AccessRequestService.approveAndActivate(...)`
- `POST /api/v1/access-requests/{id}/approve-and-activate`
- admin UI support for approve-and-activate in `frontend/src/pages/AdminPages.tsx`
- backend coverage in `backend/src/test/java/com/merhouse/service/AccessRequestServiceTest.java`
- frontend coverage in `frontend/src/pages/AdminManagement.test.tsx`

### Feature B: OTP Password Recovery

The repository already contains:

- `POST /api/v1/auth/recovery/request-otp`
- `POST /api/v1/auth/recovery/reset-with-otp`
- OTP generation and verification in `AuthRecoveryService.java`
- OTP browser flow in `frontend/src/pages/AuthRecoveryPages.tsx`
- backend coverage in `backend/src/test/java/com/merhouse/service/AuthRecoveryServiceTest.java`
- frontend coverage in `frontend/src/pages/AuthRecoveryPages.test.tsx`
- OTP storage migration in `backend/src/main/resources/db/migration/19__otp_password_recovery.sql`

### Feature C: How To Use Page

The repository already contains:

- `/how-to-use` route in `frontend/src/App.tsx`
- the page component in `frontend/src/pages/HowToUsePage.tsx`
- authenticated navigation entries in `frontend/src/components/AppLayout.tsx`
- public login-page navigation in `frontend/src/pages/LoginPage.tsx`
- focused rendering/navigation coverage in `frontend/src/pages/HowToUsePage.test.tsx` and `frontend/src/pages/LoginPage.test.tsx`

## Deferred Scope

The following remains explicitly out of V17 closure scope and belongs to Vinfinite unless a later tracked decision says otherwise:

- assistant conversation threading
- chat-like assistant UI
- automatic scope detection beyond the current deterministic scope selection model
- richer assistant context chaining through parent interactions
- provider-backed or tool-authorized assistant runtime work

Current assistant truth:

- deterministic
- read-plus-draft only
- non-mutating
- audit-backed
- flat interaction history scoped to the authenticated actor

## Open Closure Work

The remaining closure work is tracked by `docs/refactor/Closure_Plan.md`.

### P0 closure tracks

- `D-01` and `D-04`: normalize V17 scope/status docs and keep one internally consistent closure story
- `A-01`, `A-02`, `B-01`: update browser proof, API smoke, and CI to prove OTP recovery, `/how-to-use`, and approve-and-activate
- `D-02`, `D-03`, `E-01`: align OTP, assistant, and diagram docs with the implemented code
- `C-03`, `F-01`: reconcile backup/rollback proof claims and script inventory with the actual repository state
- `C-01`, `C-02`, `C-04`, `F-02`: execute the live-lane evidence package and validate the attachment chain
- `F-03`: rerun markdown and script-validation proof after convergence edits

### P1 hardening tracks

- `A-03`: strengthen focused automated tests only where closure-critical workflows still depend too heavily on broad proof
- `A-04`: add a focused assistant contract verification slice
- `E-02`: re-check any changed diagrams for residual drift

## Proof Status

| Proof area | Current status | Notes |
| --- | --- | --- |
| Backend tests / frontend lint / frontend tests / frontend build | Repository-run local QC exists | Re-run after closure-critical proof and doc updates. |
| Closure-critical browser proof | Open convergence task | Existing main tour still needs the OTP, `/how-to-use`, and approve-and-activate slices refreshed. |
| Closure-critical API smoke | Open convergence task | Existing smoke scenarios still need the current OTP and approve-and-activate paths. |
| Deployed monitoring, load smoke, browser proof, and cutover validation | Open execution task | Scripts exist; fresh live-lane artifacts still need to be generated and validated. |
| Signed Android release and installed-app proof | Open execution task | Workflow and proof scripts exist; fresh deployed-lane evidence is still required. |
| Backup/restore and rollback proof | Open execution and inventory task | Closure depends on matching repository claims, implemented scripts/mechanisms, and current live-lane evidence. |
| Email-provider, alert-routing, and live stakeholder walkthrough proof | Open execution task | Proof recorders exist; artifacts still need operator-completed execution. |

## Closure Rule

V17 is not closed merely because deployment is live or because the three portfolio features are implemented.

V17 closes only when:

- all `P0` tasks in `Closure_Plan.md` are complete
- closure-critical browser and API proof pass against the current implementation
- docs, diagrams, scripts, CI, and tracked closure status agree with the codebase
- deployed evidence is complete for the active live lane
- markdown and proof-script validation pass after the final convergence edits

## Source Of Truth

Use these documents together:

- [`docs/architecture/roadmap.md`](../architecture/roadmap.md): roadmap policy, QC rules, repository rules, and change-quality rule
- [`docs/refactor/Closure_Plan.md`](./Closure_Plan.md): ordered closure tasks and acceptance criteria
- [`docs/refactor/V17-RE-EVALUATION.md`](./V17-RE-EVALUATION.md): this clean closure-status summary
- [`docs/refactor/IMPLEMENTATION_SEQUENCE.md`](./IMPLEMENTATION_SEQUENCE.md): historical audit context only
