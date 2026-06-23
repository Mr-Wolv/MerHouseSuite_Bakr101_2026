# V17 Portfolio Closure Status

> **Date:** 2026-06-14
>
> **Status:** Deployment is confirmed live. The V17 portfolio features are implemented in the current codebase: Access Request & Approve-and-Activate, Password Recovery (via Firebase Auth), and the How To Use Page. The OTP-specific password recovery flow was removed; Firebase Auth handles password-reset email delivery via built-in email templates. AI Assistant Completion is deferred to Vinfinite. The remaining V17 work is closure convergence and deployed-proof execution.

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
| Deployment lane | Confirmed live | Managed deployment docs, CI workflows, and deployed-proof scripts are present for Neon PostgreSQL, Hugging Face Docker Space, Firebase Hosting, GitHub Actions, and GitHub Release APK distribution. |
| Feature A: Access Request & Approve-and-Activate | Implemented | `AccessRequestService.java`, `AccessRequestController.java`, `AdminPages.tsx`, related backend/frontend tests. |
| Feature B: Password Recovery (Firebase Auth) | Implemented | Firebase Auth handles password-reset email delivery via built-in email templates (`sendPasswordResetEmail` on the frontend, synced via Firebase Admin SDK on the backend). The backend `AuthRecoveryService` supports token-based password reset with Firebase password sync. The OTP-specific flow (`request-otp`, `reset-with-otp`) was removed from the codebase. |
| Feature C: How To Use Page | Implemented | `HowToUsePage.tsx`, `App.tsx`, `AppLayout.tsx`, `LoginPage.tsx`, related frontend tests. |
| Email console capture mode | Removed | `EmailDeliveryService.java` was deleted — no SMTP or email delivery service is connected. Firebase Auth handles password-reset email delivery directly. Email delivery is local in-app records only. |
| AI Assistant (deterministic) | Removed | The deterministic assistant was removed from the codebase — all backend services, controller, entity, repository, DTOs, frontend page, and API client were cleaned up. Deferred indefinitely. |
| Local quality baseline | Proven | V16.2 local certification and cross-surface evidence are tracked in `docs/quality/`. |
| Deployed closure evidence package | Blocked | Scripts exist, but closure still requires fresh proof artifacts. Externally blocked by SMTP credentials, signing material, and deployed-infrastructure access. See `Closure_Progress_Log.md` for unblocking conditions. |

## What V17 Means Now

V17 is no longer a feature-build phase.

The product-scope work that remained after deployment confirmation has already landed in the repository:

- Access Request & Approve-and-Activate exists end to end.
- Password Recovery via Firebase Auth exists end to end (OTP flow removed; Firebase Auth handles password-reset email delivery).
- The How To Use page exists and is wired into public and authenticated navigation.

AI Assistant Completion is not part of V17 closure. Conversation threading, chat-style UI, richer contextual awareness, and workflow-guidance completion remain deferred to Vinfinite unless the roadmap is deliberately changed.

The remaining V17 work is therefore closure work:

- expand closure-critical browser and API proof to comprehensively cover all 6 roles, all state machine workflows, and all routes (scope expanded because deployed proof is externally blocked)
- align CI with those expanded proof lanes
- align docs and diagrams with the implemented password recovery, access-request, and deployment behavior
- validate the script inventory and make backup/rollback claims consistent with the actual repository state
- **when unblocked:** execute the remaining live-lane evidence collection for monitoring, browser proof, load smoke, backup/restore, rollback, Android release, provider proof, alert proof, and live walkthrough proof

> **Current constraint (2026-06-16):** Deployed proof tasks (C-01 through C-04) are externally blocked by SMTP credentials, signing material, and live-infrastructure access. Local proof lanes (A-01, A-02) have been expanded to provide the strongest feasible local verification across all roles, routes, and state machine workflows.

## Repository-Visible Implementation Evidence

### Feature A: Access Request & Approve-and-Activate

The repository already contains:

- `AccessRequestService.approveAndActivate(...)`
- `POST /api/v1/access-requests/{id}/approve-and-activate`
- admin UI support for approve-and-activate in `frontend/src/pages/AdminPages.tsx`
- backend coverage in `backend/src/test/java/com/merhouse/service/AccessRequestServiceTest.java`
- frontend coverage in `frontend/src/pages/AdminManagement.test.tsx`

### Feature B: Password Recovery (Firebase Auth)

Password recovery uses Firebase Auth's built-in email templates (`sendPasswordResetEmail` on the frontend, synced via Firebase Admin SDK on the backend). The backend `AuthRecoveryService` supports token-based password reset with Firebase password sync. Rate limiting, throttling, and generic public responses are in place.

The OTP-specific password recovery flow was removed from the codebase:
- `POST /api/v1/auth/recovery/request-otp` endpoint removed
- `POST /api/v1/auth/recovery/reset-with-otp` endpoint removed
- `OtpResetRequest` DTO removed
- OTP browser flow from `AuthRecoveryPages.tsx` removed
- `PasswordResetToken.otpCode` column removed (dead field)
- `19__otp_password_recovery.sql` migration is inert (column still exists on deployed databases)

### Feature C: How To Use Page

The repository already contains:

- `/how-to-use` route in `frontend/src/App.tsx`
- the page component in `frontend/src/pages/HowToUsePage.tsx`
- authenticated navigation entries in `frontend/src/components/AppLayout.tsx`
- public login-page navigation in `frontend/src/pages/LoginPage.tsx`
- focused rendering/navigation coverage in `frontend/src/pages/HowToUsePage.test.tsx` and `frontend/src/pages/LoginPage.test.tsx`

## Deferred Scope

- AI Assistant (deterministic read-plus-draft) — removed from codebase; deferred indefinitely
- assistant conversation threading, chat-like UI, model-backed runtime — all deferred indefinitely
- Email console capture mode — removed; no SMTP or email delivery service is connected. Firebase Auth handles password-reset emails directly. In-app notification records remain the default delivery channel.

## Open Closure Work

The remaining closure work is tracked by `docs/refactor/Closure_Plan.md`.

### P0 closure tracks

- `D-01` and `D-04`: normalize V17 scope/status docs and keep one internally consistent closure story — **closed**
- `A-01`, `A-02`, `B-01`: expand browser proof and API smoke to cover all 6 roles, all routes, all state machines; align CI — **in progress** (scope expanded due to blocked deployed proof)
- `D-02`, `D-03`, `E-01`: align password recovery, assistant, and diagram docs with the implemented code — **closed**
- `C-03`, `F-01`: reconcile backup/rollback proof claims and script inventory with the actual repository state — **blocked** (live execution); doc/script alignment can proceed
- `C-01`, `C-02`, `C-04`, `F-02`: execute the live-lane evidence package and validate the attachment chain — **blocked** (SMTP, signing, infrastructure access)
- `F-03`: rerun markdown and script-validation proof after convergence edits — pending

### P1 hardening tracks

- `A-03`: strengthen focused automated tests only where closure-critical workflows still depend too heavily on broad proof
- `A-04`: add a focused assistant contract verification slice
- `E-02`: re-check any changed diagrams for residual drift

## Proof Status

| Proof area | Current status | Notes |
| --- | --- | --- |
| Backend tests / frontend lint / frontend tests / frontend build | Repository-run local QC exists | Re-run after closure-critical proof and doc updates. |
| Closure-critical browser proof | In progress — expanded scope | Existing tour refreshed for password recovery, `/how-to-use`, and approve-and-activate; scope expanded to cover all 6 roles, all routes, and all state machine transitions while deployed proof is blocked. |
| Closure-critical API smoke | In progress — expanded scope | Existing smoke scenarios being updated for password recovery and approve-and-activate; scope expanded to cover every endpoint across role boundaries. |
| Deployed monitoring, load smoke, browser proof, and cutover validation | **Blocked** | Scripts exist; fresh live-lane artifacts cannot be generated until SMTP credentials and deployed URLs are available. |
| Signed Android release and installed-app proof | **Blocked** | Workflow and proof scripts exist; signing passwords and deployed HTTPS target URLs are not available in the execution environment. |
| Backup/restore and rollback proof | **Blocked** (live execution) | Closure depends on matching repository claims, implemented scripts/mechanisms, and current live-lane evidence. Doc/script alignment can proceed. |
| Email-provider, alert-routing, and live stakeholder walkthrough proof | **Blocked** | Proof recorders exist; artifacts cannot be generated until SMTP provider credentials and operator are available. |

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
