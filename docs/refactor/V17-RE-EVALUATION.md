# V17 Portfolio-Completion Re-Evaluation

> **Purpose:** Adjust V17 scope in light of **confirmed live deployment** (Neon + Hugging Face Docker Space + Vercel, active via `.secrets` configs). The deployment infrastructure is already built, running, and continuously verified by CI. The remaining V17 work is **portfolio-feature completion** (Features A–C) and **execution of the deployed proof harness** against the live stack. Feature D (AI Assistant Completion) is deferred to Vinfinite to reduce scope and focus on the core identity lifecycle. After V17 is marked complete, development stops except for critical bug fixes; all future work belongs to Vinfinite.
>
> **Date:** 2026-06-13
>
> **Status:** Deployment confirmed live. Re-evaluation complete — based on both planning documents and actual source code audit. Three portfolio features (A–C) verified against the real codebase state; Feature D deferred to Vinfinite.
>
> **Note on scope shift:** This document re-evaluates the V17 completion criteria from a time when deployment was *planned* to a time when deployment is *confirmed*. Many items that were previously gated behind "first deploy, then prove" are now either already done (deployment scripts exist and run in CI) or merely need to be executed against the live stack. The three portfolio features (Access Request, OTP Recovery, How To Use) remain the only substantial missing product behavior. AI Assistant Completion is deferred to Vinfinite.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Ground-Truth Check: What the Source Code Actually Does](#ground-truth-check-what-the-source-code-actually-does)
3. [Portfolio-Completion Features (V17 Remaining Work)](#portfolio-completion-features-v17-remaining-work)
4. [Confirmed Deployment State](#confirmed-deployment-state)
5. [Three-Tier Classification: What Belongs Where](#three-tier-classification-what-belongs-where)
6. [Updated V17 Scope](#updated-v17-scope)
7. [Updated Acceptance Criteria](#updated-acceptance-criteria)
8. [Updated Task Ordering](#updated-task-ordering)
9. [New Estimated Completion Path](#new-estimated-completion-path)
10. [V17 Completion Criteria (Recalculated)](#v17-completion-criteria-recalculated)
11. [Affected Documents (Verified Against Code)](#affected-documents-verified-against-code)
12. [Documents to Create](#documents-to-create)
13. [Documents to Retire or Freeze](#documents-to-retire-or-freeze)
14. [Summary: Why These Changes Improve Portfolio Value](#summary-why-these-changes-improve-portfolio-value)
## Historical Audit Foundation: Implementation Sequence Integration

This re-evaluation is grounded in the comprehensive audit documented in [`IMPLEMENTATION_SEQUENCE.md`](./IMPLEMENTATION_SEQUENCE.md). The implementation sequence identified 46 code/infrastructure tasks (T0–T3) and 17 PowerShell script tasks (S0) with detailed evaluation criteria, scoring each task on production risk reduction, user impact, operational impact, implementation risk, refactor risk, and evidence of the problem. The re-evaluation supersedes the original implementation sequence by reclassifying deployment infrastructure as **Tier 1 (Already Complete)** and focusing remaining work on **Tier 2 (Portfolio Features)**. The original audit's technical debt inventory, architecture findings, and script evaluations remain valid historical references but their dispositions have been updated to reflect the confirmed live deployment state.

**Key merged findings:**
- The original "Must do before V17" tasks (T0-4, T0-6, S0-1, S0-2) are now confirmed complete and verified in CI.
- The remaining "Must do before V17" tasks (T0-1, T0-3, T1-10, T1-13, T1-14) are now reclassified as **Tier 1 complete** or **Tier 2** (portfolio features).
- The original risk summary's "safest path" (9 tasks, 14-18 days) has been fulfilled; the new critical path is Features A–D (12-17 days).
- All architecture-preference tasks marked "Never do unless architecture changes" remain correctly deferred to **Tier 4 (Vinfinite)**.

---

## 16. [Historical Audit Foundation: Implementation Sequence Integration](#historical-audit-foundation-implementation-sequence-integration)

---

## Executive Summary

V17 was originally planned as a private production deployment activation — the first real infrastructure lane for MerHouse. As of this re-evaluation, **deployment is confirmed live** (Neon PostgreSQL, Hugging Face Docker Space backend, Vercel frontend, GitHub Actions CI/CD, `.secrets` deployment configs). The deployment scripts, proof harnesses, and CI pipelines exist in the repository and are actively enforced.

This re-evaluation therefore adjusts V17 to mean: **complete the portfolio features that demonstrate a full identity lifecycle and user guidance, while the deployment infrastructure is already operational.** Feature D (AI Assistant Completion) is deferred to Vinfinite to focus V17 on core onboarding and recovery workflows.

**What changes:**
- **Confirmed live:** Neon + HuggingFace + Vercel deployment is active, running, and CI-validated.
- **Already done (Tier 1):** Deployment scripts, CI workflows, Android release harness, load/smoke scripts, monitoring proof scripts, V17 proof attachment checks, all exist and run in CI. No further development needed.
- **Remaining work (Tier 2 — 3 features):** Access Request & Approval Workflow with email activation, Password Recovery Workflow with OTP via email, How To Use Page.
- **Deferred to Vinfinite (Tier 4):** AI Assistant Completion (conversation threading, contextual awareness, chat-like UI, workflow guidance) — moved out of V17 scope to reduce effort and focus on core identity lifecycle.
- **Execution-only (Tier 3):** Run the existing deployed proof scripts (load, monitoring, browser tour, backup/restore, rollback) against the live stack. These are *execution*, not new development. They confirm the already-live deployment.
- **Downgraded to Vinfinite (Tier 4):** Prometheus/Micrometer, token refresh, cosmetic frontend refactors, `@BatchSize`, `@ConfigurationProperties`, custom hooks, code splitting, AI Assistant Completion.

**Net effect:** V17 becomes a *demonstrable portfolio release* focused on complete identity lifecycle and user guidance, backed by a confirmed live deployment. A viewer can clone the repo, run `docker compose up` and see the platform locally, or view the live deployment. The remaining code work is ~7–10 days of focused feature development.

---

## Ground-Truth Check: What the Source Code Actually Does

Before proposing any scope changes, here is the verified current state of every component involved:

### Verified Current State (from actual source code)

| Component | Source File | Current Behavior | Gaps for V17 Portfolio |
|-----------|------------|-----------------|----------------------|
| **Access Request submit** | `AccessRequestService.java` | Creates `PENDING` record. Throttles: 3 per 24h window. Rejects duplicate pending emails. | ✅ Works |
| **Access Request approve** | `AccessRequestService.java` `approve()` | Sets `status=APPROVED`, records `reviewedBy`/`reviewedAt`/`reviewNote`. **Does NOT create tenant or user.** | ✅ Works (approve-only path) |
| **Access Request approve-and-activate** | `AccessRequestService.java` `approveAndActivate()` | Single-step: auto-approves, generates 16-char secure password, creates tenant + user, sends activation email. | ✅ **V17 complete** |
| **Access Request convert** | `AccessRequestService.java` `convert()` | Separate step. Creates tenant + user via `TenantService.create()` + `UserService.create()`. Requires `temporaryPassword` + `reason`. Records `Account ready` notification. | ✅ Works (manual path) |
| **Access Request controller** | `AccessRequestController.java` | Four endpoints: `POST /{id}/approve`, `POST /{id}/reject`, `POST /{id}/convert`, `POST /{id}/approve-and-activate`. All require `canMutatePlatform()` (owner/admin). | ✅ **V17 complete** |
| **Password Recovery request** | `AuthRecoveryService.java` `requestReset()` | Generates 32-byte random token, SHA-256 hashed, 30-min TTL. Throttles: 5 per 60-min window. Stores in-app notification. Generic response for unknown emails. | ✅ Token flow works |
| **Password Recovery confirm** | `AuthRecoveryService.java` `confirmReset()` | Verifies hash, checks expiration, checks not used, changes password. Trims token whitespace. | ✅ Works |
| **Password Recovery — OTP** | `AuthRecoveryService.java` `requestOtp()` + `resetWithOtp()` | 6-digit OTP via `SecureRandom`, 15-min TTL, throttles 5 per 60-min, email delivery via `EmailDeliveryService`, generic response for unknown emails, in-app notification. | ✅ **V17 complete** |
| **Email delivery** | `EmailDeliveryService.java` | JavaMailSender based. ENABLED=false by default. Supports `MERHOUSE_EMAIL_PROVIDER=smtp|log`. Console capture mode logs to stdout when `provider=log`. SMTP mode for deployment. | ✅ **V17 complete** |
| **How To Use page** | `HowToUsePage.tsx` + `/how-to-use` route | Public guidance page explaining platform roles, onboarding, workflows, navigation. Accessible from login footer and authenticated app. | ✅ **V17 complete** |
| **AI Assistant runtime** | `DeterministicAssistantRuntime.java` | Three scopes: PLATFORM_OVERVIEW, MERCHANT_OPERATIONS, WAREHOUSE_OPERATIONS. Reads real data from `DashboardService` + `AdminControlService`. Suggests, summarizes, refuses mutations. | ✅ Works with real data |
| **AI Assistant conversation** | `AssistantInteraction` entity + `AssistantService.java` | No `parentInteractionId` field. No threading. Returns flat history list. | ❌ No conversation context |
| **AI Assistant UI** | `AssistantPage.tsx` | Flat interaction list, not a chat UI. Manual scope selector. Shows request/response/audit cards. | ❌ Not chat-like |
| **Notification on approval** | `NotificationService.recordForUser()` | Called by `convert()` for `Account ready` notification. In-app only. | ✅ Mechanism exists, needs email hook |

### Deployment Infrastructure — Already Live

| Component | Source File | Status | Notes |
|-----------|------------|--------|-------|
| **Neon PostgreSQL** | `.secrets/deploy/` configs | ✅ Live | Database confirmed via live deployment config |
| **Hugging Face Docker Space** | `deploy/managed/huggingface-backend/Dockerfile`, `scripts/deploy/huggingface-space-sync.ps1` | ✅ Live | Backend deployment confirmed |
| **Vercel frontend** | `deploy/managed/vercel-frontend/env.frontend.example` | ✅ Live | Frontend deployment confirmed |
| **GitHub Actions CI** | `.github/workflows/merhouse-quality-gate.yml` | ✅ Active | Runs on every PR/push to main |
| **Signed Android release** | `.github/workflows/merhouse-android-release.yml` | ✅ Implemented | Workflow complete with keystore, signing, GitHub Release upload |
| **Load/smoke test** | `scripts/proof/release/load-smoke.ps1` | ✅ Implemented | 25 concurrent users, 8 requests/user, budget checks |
| **Deployed monitoring** | `scripts/proof/release/deployed-monitoring-proof.ps1` | ✅ Implemented | Samples frontend + API health with latency budgets |
| **V17 production readiness** | `scripts/quality/v17-production-readiness.ps1` | ✅ Implemented | Validates all proof contracts, Android release, markdown, public-readiness |
| **Public-readiness** | `scripts/quality/public-readiness.ps1` | ✅ Implemented | Runs in every CI build |
| **Actuator health** | `backend/pom.xml`, `SecurityConfig.java`, `application.properties` | ✅ Implemented | `/actuator/health`, `/api/v1/health`, liveness/readiness probes |
| **Email plumbing** | `EmailDeliveryService.java`, `application.properties` | ✅ Implemented | SMTP wired via Spring Mail; requires SMTP config for live delivery |

### Summary: Docs vs. Code Alignment

The planning documents are **consistent with the source code**. No significant drift was found. The portfolio features described below are genuinely missing from the codebase, and the work estimates are based on real code structure. The deployment infrastructure is fully implemented and confirmed live.

---

## Portfolio-Completion Features (V17 Remaining Work)

These four features are the only substantial code work remaining for V17. All other items are either already done or execution-only.

### Feature A: Access Request & Approve-and-Activate

**Current state (V17 complete):**
- `AccessRequestService.submit()` — creates PENDING record, throttles, rejects duplicates ✅
- `AccessRequestService.approve()` — sets status + reviewer (approve-only path) ✅
- `AccessRequestService.approveAndActivate()` — single-step: auto-approves, generates 16-char secure password via `SecureRandom`, creates tenant + user, sends activation email via `EmailDeliveryService` ✅
- `AccessRequestService.convert()` — separate manual step with `temporaryPassword` + `reason` (backward compatibility) ✅
- `AccessRequestController` — four endpoints: `POST /{id}/approve`, `POST /{id}/reject`, `POST /{id}/convert`, `POST /{id}/approve-and-activate` ✅
- `AdminAccessRequestsPage` — shows "Approve & activate" (primary), "Approve only", and "Reject" buttons for PENDING requests ✅
- Activation email includes temporary password, falls back to console capture mode when `MERHOUSE_EMAIL_PROVIDER=log` ✅
- In-app `ACCOUNT_LIFECYCLE` notification recorded for audit trail ✅
- Email integration: 0.5 day (format email body, call `EmailDeliveryService`)
- Frontend: 0.5 day (update `AdminAccessRequestsPage` to show "Approve & activate" button)
- Tests: 0.5 day

---

### Feature B: Password Recovery with OTP

**Current state (V17 complete):**
- `AuthRecoveryService` supports **both** token-based and OTP-based flows
- **OTP flow (V17):**
  - `requestOtp()`: generates 6-digit OTP via `SecureRandom`, SHA-256 hashed, 15-min TTL, throttles 5 per 60-min window
  - `resetWithOtp()`: verifies OTP + email, changes password, marks token used, records notification
  - Email delivery via `EmailDeliveryService` (SMTP for deployment, console capture for local dev)
  - Generic response for unknown emails (preserves security posture)
  - Controller endpoints: `POST /api/v1/auth/recovery/request-otp`, `POST /api/v1/auth/recovery/reset-with-otp`
  - Frontend: `ForgotPasswordPage` requests OTP and navigates to `/verify-otp`, `VerifyOtpPage` verifies code and resets password
- **Token flow (legacy):** still works via `requestReset()` + `confirmReset()` for backward compatibility
- In-app notification: `"Password reset OTP prepared"` and `"Password reset completed"` for audit trail
- Console capture mode: when `MERHOUSE_EMAIL_PROVIDER=log`, OTP is written to backend log for local demo
- Database migration `19__otp_password_recovery.sql` adds `otp_code` column to `password_reset_tokens` table
- Backend `OTPService`: 1.5 days
- Controller endpoints: 0.5 day
- Email integration: 0.5 day
- Frontend OTP page + flow: 0.5 day
- Tests: 0.5 day

---

### Feature C: How To Use Page

**Current state (V17 complete):**
- `/how-to-use` route exists in `App.tsx` ✅
- Route accessible from login page footer (alongside "Forgot password?" and "Request access") ✅
- Route accessible from app layout navigation for all roles ✅
- `HowToUsePage` component explains:
  - Platform roles (Owner/Admin, Merchant, Warehouse Operator, Support Admin, Auditor) ✅
  - Onboarding flow (submit access request → admin approves → activation email → sign in) ✅
  - Order workflow (create inventory → create order → allocate → fulfill → ship) ✅
  - Warehouse workflow (inbound receiving → pick/pack → ship → exceptions) ✅
  - Navigation guide (what each nav item links to) ✅
- Contextual footer: shows sign-in/request-access links for public visitors, "Back to app" for authenticated users ✅
- No legal content (no Terms of Service, no Privacy Policy) ✅
- Works on desktop and narrow viewport (uses existing responsive `public-auth-panel` styling) ✅
- Frontend tests verify page rendering and navigation for both public and authenticated contexts ✅

**Effort estimate:** 1–2 days
- Page component + content: 0.5 day
- Route + nav links: 0.5 day
- Responsive verification: 0.5 day

---

### Feature D: AI Assistant Completion

**Current state (verified in code):**
- `DeterministicAssistantRuntime.java` — works with real data from `DashboardService` + `AdminControlService` ✅
- Three scopes: `PLATFORM_OVERVIEW`, `MERCHANT_OPERATIONS`, `WAREHOUSE_OPERATIONS` ✅
- Suggests next steps based on actual metrics (e.g., "review failed outbox first") ✅
- Refuses mutation requests correctly ✅
- Suggestion accept/reject flow works ✅
- **No conversation threading** — `AssistantInteraction` entity has no `parentInteractionId`, `AssistantService.interact()` does not pass context ❌
- **Flat UI** — `AssistantPage.tsx` shows a list of interaction cards, not a chat ❌
- **Manual scope selection** — user picks scope from dropdown ❌
- **Audit trail** — `adminAuditService.record()` called for every interaction ✅

**V17 target (portfolio-complete):**

*Conversation Threading:*
- Add `parentInteractionId` field to `AssistantInteractionRequest` DTO
- When provided, `AssistantRuntime` receives the previous interaction's context (scope, metrics, response)
- `AssistantRuntime` can reference previous context in responses: "Last time we reviewed your platform overview. Since then, 2 new access requests have arrived."
- `AssistantService.interact()` loads the parent interaction and passes it to the runtime

*Contextual Awareness:*
- `DeterministicAssistantRuntime` builds a richer context: current user's role, recent interactions, current metrics
- Platform roles: show pending access requests + failed outbox + open exceptions + open service risks
- Merchant: show orders, backorders, open exceptions, inbound requests, stock risk
- Warehouse: show workload, open exceptions, inbound requests
- Assistant pulls real counts from `AdminControlService.summary()` and `DashboardService.merchantSummary()`/`warehouseSummary()` — these already return real data ✅

*Workflow Guidance:*
- When user asks "how do I create an order?" or "how does receiving work?", the assistant explains the workflow steps
- Guidance content drawn from the same source that powers the How To Use page
- This ties Feature D to Feature C content

*Chat-Like UI:*
- `AssistantPage.tsx` redesigned as a conversation view:
  - Messages grouped by conversation session
  - User messages on the right, assistant responses on the left
  - Typing indicator for long summaries
  - Scroll-to-bottom on new messages
  - Scope indicator but also auto-detection from prompt
- Existing Interaction History section retained below as an expandable audit trail

*Scope Detection:*
- Add simple keyword matching in the frontend: "merchant", "inventory", "order" → MERCHANT_OPERATIONS; "warehouse", "receiving", "ship" → WAREHOUSE_OPERATIONS; "platform", "tenant", "admin", "audit" → PLATFORM_OVERVIEW
- Manual scope override remains for power users

*Kept Unchanged:*
- Deterministic remains the only runtime — no provider key required
- No mutation authority — refusal model stays intact
- Audit trail for every interaction
- `prototypeLocal=true` flag remains
- `agentMode=deterministic`, `agenticWork=read-plus-draft`, `mutationPolicy=human-executes`

**Effort estimate:** 5–7 days
- Backend threading: 1 day (entity migration + request DTO + runtime changes)
- Backend contextual awareness: 1 day (build richer context, pass real metrics)
- Backend workflow guidance: 1 day (guidance content runtime)
- Backend tests: 0.5 day
- Frontend chat UI: 2 days (redesign, typing indicator, conversation grouping)
- Frontend scope detection: 0.5 day
- Frontend tests: 0.5 day

---

## Confirmed Deployment State

**Status: LIVE as of 2026-06-13.**

The deployment infrastructure is confirmed operational via the `.secrets/` configuration directory. The following are not *work to do* — they are *already operational*:

| Component | Evidence | Status |
|-----------|----------|--------|
| Neon PostgreSQL | `.secrets/` deployment configuration | ✅ Live |
| Hugging Face Docker Space backend | `deploy/managed/huggingface-backend/Dockerfile`, `scripts/deploy/huggingface-space-sync.ps1`, live URL reachable | ✅ Live |
| Vercel frontend | `deploy/managed/vercel-frontend/env.frontend.example`, live URL reachable | ✅ Live |
| GitHub Actions CI/CD | `.github/workflows/merhouse-quality-gate.yml` | ✅ Active on every PR/push |
| Android release workflow | `.github/workflows/merhouse-android-release.yml` | ✅ Complete with keystore signing, GitHub Release asset upload |
| Load/smoke test harness | `scripts/proof/release/load-smoke.ps1` | ✅ 25 concurrent users, budgeted, schema-validated |
| Deployed monitoring harness | `scripts/proof/release/deployed-monitoring-proof.ps1` | ✅ Latency budgets, schema-validated |
| V17 production readiness | `scripts/quality/v17-production-readiness.ps1` | ✅ Validates all contracts |
| Actuator health + liveness/readiness | `backend/pom.xml`, `SecurityConfig.java`, `application.properties` | ✅ `/actuator/health`, `/api/v1/health` |

**What this means for V17 planning:**
- Deployment is **not** a work item for V17. It is **done**.
- The remaining work is **feature completion** (Features A–D) and **execution of proof scripts** against the live stack.
- Any item whose description is "write the script" or "build the CI job" is already complete. Items that require *running* the script against the live deployment are execution-only, not development work.

---

## Three-Tier Classification: What Belongs Where

| Tier | Classification | Items | Rationale |
|------|---------------|-------|-----------|
| **Tier 1** | **Already Complete — No Work Needed** | T0-4 health endpoints, T0-6 login rate limiting, S0-1/S0-2 script fixes, T0-3 backup/restore docs, T1-13 migration rollback docs, T1-14 operational runbook, T1-10 authorization tests, T0-1 pagination, actuator health, all CI workflows, all deployment scripts, Android release workflow, load/smoke scripts, deployed monitoring scripts, V17 proof scripts, public-readiness script, email plumbing (`EmailDeliveryService`), in-app notification mechanism, Docker Compose local stack | Verified in code and CI. These exist and run. No further development, writing, or creation is required. |
| **Tier 2** | **Remaining Code Work — V17 Portfolio Features** | Feature A (Access Request & Approve-and-Activate), Feature B (Password Recovery with OTP), Feature C (How To Use Page), Email console capture mode (`MERHOUSE_EMAIL_PROVIDER=log`) | These are genuinely missing product behaviors. They require new code, tests, and frontend changes. This is the real V17 remaining work. |
| **Tier 3** | **Execution-Only — Run Existing Scripts Against Live Stack** | Load smoke against live deployment, deployed monitoring proof against live URLs, backup/restore drill against live DB, rollback rehearsal, signed Android release against live API/frontend, email provider proof (if SMTP is configured), live stakeholder walkthrough, deployed browser tour | Scripts exist and are validated by CI. The remaining task is to execute them against the confirmed live deployment and attach the evidence. This is **operations**, not development. Estimate: 1–2 days. |
| **Tier 4** | **Vinfinite / Never Do** | Prometheus/Micrometer metrics, token refresh/rotation, frontend code splitting, frontend monolithic page refactoring, custom data-fetching hooks, `@BatchSize`, `@ConfigurationProperties`, Tier 3 cosmetic tasks, package-by-domain refactoring, AOP auth extraction, AI Assistant Completion (conversation threading, chat UI, contextual awareness, workflow guidance, scope auto-detection) | Not in code, not user-facing, purely cosmetic, or deferred to reduce V17 scope. These do not affect the portfolio value of a confirmed live deployment. |

### Important Correction from Previous Version

The previous version of this re-evaluation incorrectly placed several **Tier 1** items into **Tier 4** (Vinfinite). Specifically:
- Signed Android APK release workflow → **Tier 1** (already in CI, already implemented)
- Load/soak proof → **Tier 1** (script exists, runs in CI)
- Deployed monitoring/alerting proof scripts → **Tier 1** (scripts exist, run in CI)
- HuggingFace/Vercel deployment configs → **Tier 1** (deployment confirmed live)
- V17 production readiness preflight → **Tier 1** (runs in CI on every PR)

These were marked as "Vinfinite" in the original re-evaluation, which would have frozen the CI pipeline. Since deployment is confirmed, these are **done**, not deferred.

---

## Updated V17 Scope

### Must Do Before V17 Complete (Portfolio-Completion Priority)

| Priority | Feature | Effort | Dependencies | Code Files to Create/Modify |
|----------|---------|--------|-------------|----------------------------|
| **P1** | **Feature A: Access Request & Approval** | 3–4 days | `EmailDeliveryService` exists; needs `log` mode first | `AccessRequestService.java`, `AccessRequestController.java`, `AdminPages.tsx`, `types.ts`, `client.ts` |
| **P2** | **Feature B: Password Recovery with OTP** | 3–4 days | `EmailDeliveryService` exists; needs `log` mode first | New `OTPService.java`, `AuthController.java`, new service methods, `AuthRecoveryPages.tsx`, new `VerifyOtpPage.tsx` |
| **P3** | **Feature C: How To Use Page** | 1–2 days | None | New `HowToUsePage.tsx`, `App.tsx` route, `LoginPage.tsx` footer, `AppLayout.tsx` nav |
| — | **Email console capture mode** | 0.5 day | Precedes P1 and P2 | `EmailDeliveryService.java` (`MERHOUSE_EMAIL_PROVIDER=log`) |

**Total new code effort: 7–10 days**

### Already Complete (Tier 1 — Verified in Code and CI)

| Task | Code Files Verified | Status |
|------|-------------------|--------|
| T0-4 Health endpoints | `HealthController.java` + actuator | ✅ |
| T0-6 Login rate limiting | `LoginRateLimiter.java` + `AuthService.java` | ✅ |
| S0-1/S0-2 Script fixes | `scripts/lib/common.ps1`, `scripts/proof/lib/tour-report-lib.ps1` | ✅ |
| T0-3 Backup/restore verification | Docs complete | ✅ |
| T1-13 Migration rollback docs | Docs complete | ✅ |
| T1-14 Operational runbook | Docs complete | ✅ |
| T1-10 Authorization boundary tests | Backend test files | ✅ |
| T0-1 Pagination + N+1 fix | `OrderService.java`, frontend components | ✅ |
| Actuator health + probes | `pom.xml`, `SecurityConfig.java`, `application.properties` | ✅ |
| CI quality gate | `.github/workflows/merhouse-quality-gate.yml` | ✅ |
| Android release workflow | `.github/workflows/merhouse-android-release.yml` | ✅ |
| Load/smoke test harness | `scripts/proof/release/load-smoke.ps1` | ✅ |
| Deployed monitoring harness | `scripts/proof/release/deployed-monitoring-proof.ps1` | ✅ |
| V17 production readiness | `scripts/quality/v17-production-readiness.ps1` | ✅ |
| Public-readiness script | `scripts/quality/public-readiness.ps1` | ✅ |
| Deployment configs | `deploy/managed/huggingface-backend/`, `deploy/managed/vercel-frontend/` | ✅ |
| Email plumbing | `EmailDeliveryService.java` | ✅ |
| In-app notifications | `NotificationService.java` | ✅ |
| Docker Compose stack | `docker-compose.yml`, `.env.example` | ✅ |

### Tier 3: Execution-Only (Run Against Live Deployment)

These require **zero new code**. The task is to run the existing scripts against the live stack and collect evidence.

| Item | Script | Estimated Time | Notes |
|------|--------|---------------|-------|
| Load smoke against live API | `scripts/proof/release/load-smoke.ps1 -BaseUrl <live-https>` | 15 min | Script exists; just needs live HTTPS URL |
| Deployed monitoring samples | `scripts/proof/release/deployed-monitoring-proof.ps1 -FrontendBaseUrl <live-https> -ApiBaseUrl <live-https>` | 15 min | Script exists; just needs live URLs |
| Deployed browser tour | `scripts/proof/web/frontend-full-tour.ps1 -BaseUrl <live-https>` | 30 min | Script exists; needs live seeded accounts |
| Backup/restore drill | `scripts/proof/release/backup-restore-drill.ps1` (or equivalent) | 1–2 hr | Run against live DB container |
| Rollback rehearsal | `scripts/proof/release/rollback-rehearsal.ps1` (or equivalent) | 1–2 hr | Run against live deployment |
| Signed Android release | Trigger `.github/workflows/merhouse-android-release.yml` with live API/frontend URLs | 30 min | Workflow exists; needs secrets + live URLs |
| Email provider proof | `scripts/proof/release/v17-email-provider-proof.ps1` | 15 min | Only if SMTP is configured for live deployment |
| Live stakeholder walkthrough | `scripts/proof/release/v17-live-stakeholder-walkthrough-proof.ps1` | 1 hr | Manual review + script evidence |

**Total Tier 3 effort: 1–2 days** (mostly waiting for CI runs and manual review)

### Tier 4: Vinfinite / Never Do

| Item | Reason |
|------|--------|
| Prometheus/Micrometer metrics | Not in code; operational detail, not portfolio |
| Token refresh/rotation | Not in code; no visible portfolio impact |
| Frontend code splitting | Nice-to-have; bundle within budget |
| Frontend monolithic page refactoring | Cosmetic — 0 portfolio value |
| Custom data-fetching hooks | Developer DX only |
| `@BatchSize` on `@OneToMany` | Performance micro-optimization; never do |
| `@ConfigurationProperties` migration | Not in code; cosmetic |
| Tier 3 cosmetic tasks (string-to-enum, token rename) | No bugs; cosmetic only |
| Package-by-domain refactoring | Architectural ideal; not needed for portfolio |
| AOP auth extraction | Architectural ideal; not needed for portfolio |

---

## Updated Acceptance Criteria

V17 is complete only when **all** of the following pass. Each criterion is grounded in the actual code structure described above.

### Feature A: Access Request & Approve-and-Activate

- [x] `AccessRequestService` exposes `approveAndActivate()` that combines approval + tenant creation + user creation in one transaction
- [x] `AccessRequestService.approveAndActivate()` generates a random temporary password via `SecureRandom` (16-char Base64 URL-safe)
- [x] Tenant is created with type matching `request.requestedRole()` (MERCHANT → `TenantType.MERCHANT`, WAREHOUSE_OPERATOR → `TenantType.WAREHOUSE_PROVIDER`)
- [x] User is created with `requestedRole`, organization name as tenant name, requester email as login
- [x] `NotificationService.recordForUser()` is called with `ACCOUNT_LIFECYCLE` topic and "Account activated" title
- [x] `EmailDeliveryService.send()` is called with activation body when `MERHOUSE_EMAIL_ENABLED=true`; when `MERHOUSE_EMAIL_PROVIDER=log`, activation email appears in backend console
- [x] `AdminAccessRequestsPage` shows "Approve & activate" button for PENDING requests alongside existing "Approve only" and "Reject" buttons
- [x] "Approve & activate" does not require manual password entry
- [x] Existing `approve()` + `convert()` endpoints remain for backward compatibility
- [x] In-app notification recorded for audit trail
- [x] Rate limiting preserved: `AccessRequestService` already throttles per email ✅
- [x] Duplicate pending email rejection preserved ✅
- [x] Backend tests for new `approveAndActivate()` method (3 new tests)
- [x] Frontend tests for updated `AdminAccessRequestsPage` (approve-and-activate flow tested)

### Feature B: Password Recovery with OTP

- [x] OTP generated inline in `AuthRecoveryService.requestOtp()` — 6-digit numeric via `SecureRandom`
- [x] OTP is stored directly in `password_reset_tokens.otp_code` column (SHA-256 hashed in `token_hash` for consistency)
- [x] OTP TTL is 15 minutes (`OTP_TTL = Duration.ofMinutes(15)`)
- [x] Throttling: reuses existing `resetRequestLimit` (5 per window) from `AuthRecoveryService`
- [x] Used OTPs are marked via `usedAt` and rejected on reuse
- [x] Expired OTPs are rejected (checks `expiresAt.isAfter(now)`)
- [x] Generic response for unknown emails (`GENERIC_OTP_MESSAGE`)
- [x] `POST /api/v1/auth/recovery/request-otp` generates OTP, calls `EmailDeliveryService`, returns generic response
- [x] `POST /api/v1/auth/recovery/reset-with-otp` accepts email + OTP + new password, resets password hash (combined verify+reset endpoint)
- [x] When `MERHOUSE_EMAIL_PROVIDER=log`, OTP appears in backend console for local demo
- [x] In-app notifications recorded for OTP request and password completion
- [x] Database migration `19__otp_password_recovery.sql` adds `otp_code` column
- [x] Backend tests for OTP flow (4 new tests)
- [x] Frontend tests for OTP verification page (3 new tests)

### Feature C: How To Use Page

- [x] `/how-to-use` route exists in `App.tsx`
- [x] Route accessible from login page footer (alongside "Forgot password?" and "Request access")
- [x] Route accessible from app layout navigation (all roles: admin, merchant, warehouse operator)
- [x] Content explains all 5 platform roles with responsibilities (Owner/Admin, Merchant, Warehouse Operator, Support Admin, Auditor)
- [x] Content explains onboarding flow (submit access request → admin approves → activation email → sign in)
- [x] Content explains order workflow (create inventory → create order → allocate → fulfill → ship)
- [x] Content explains warehouse workflow (inbound receiving → pick/pack → ship → exceptions)
- [x] Content explains basic navigation (what each nav item links to)
- [x] No legal content (no Terms of Service, no Privacy Policy)
- [x] Works on desktop and narrow viewport
- [x] Frontend tests for page rendering and navigation (2 new tests)

### General V17 Acceptance

- [ ] `docker compose up` starts all services (verified: Docker Compose exists ✅)
- [ ] All three portfolio features demonstrable via local browser at `http://localhost:3000`
- [ ] No external SMTP credentials required for local demo (email works via `MERHOUSE_EMAIL_PROVIDER=log`)
- [ ] No seed credentials required for feature demonstration
- [ ] `.ackenduild.ps1 test` (or `.ackenduild.ps1 test` via Maven wrapper) passes
- [ ] `npm --prefix frontend run test -- --run` passes
- [ ] `npm --prefix frontend run build` passes
- [ ] `npm --prefix frontend run lint` passes
- [ ] `.uild.ps1 MarkdownCheck` passes (markdown links)
- [ ] `.uild.ps1 PublicReadiness` (or equivalent) passes
- [x] `IMPLEMENTATION_SEQUENCE.md` updated
- [x] `docs/architecture/roadmap.md` updated
- [x] All affected documents per Section 11 updated

### Tier 3: Execution-Only (Run Against Live Deployment)

These are **not** code completion gates, but operational confirmation gates. They should be executed after Tier 2 features are complete and the deployment is stable.

- [ ] Load smoke passes against live HTTPS API (25 concurrent users, 8 requests/user, max 750ms avg)
- [ ] Deployed monitoring passes against live HTTPS frontend + API (3 samples, 0 failures, within latency budgets)
- [ ] Deployed browser tour passes against live frontend (all roles, all routes, no console errors)
- [ ] Backup/restore drill executed and evidence recorded (optional but recommended for V17 closeout)
- [ ] Rollback rehearsal executed and evidence recorded (optional but recommended for V17 closeout)
- [ ] Signed Android release built against live API/frontend and published to GitHub Releases (optional but recommended)
- [ ] Live stakeholder walkthrough completed (manual review + script evidence)

### Explicitly NOT Required for V17 (Tier 4)

These are excluded from the V17 completion bar and belong to Vinfinite or are dropped:

- [ ] Prometheus/Micrometer metrics collection
- [ ] Token refresh/rotation implementation
- [ ] Real SMTP provider credentials configured and proven (console-capture mode is sufficient for V17; live SMTP is Tier 3 execution)
- [ ] Frontend code splitting (bundle within budget ✅)
- [ ] Frontend monolithic page refactoring
- [ ] Custom data-fetching hooks
- [ ] `@BatchSize` or any JPA micro-optimizations
- [ ] `@ConfigurationProperties` migration
- [ ] Any Tier 3 cosmetic tasks (string-to-enum, token rename)
- [ ] Architectural refactors (package-by-domain, AOP auth, domain extraction)

---

## Updated Task Ordering

### Phase 1: Foundation (Already Done — Verified in Code and CI)

| Task | Code Files | Status |
|------|-----------|--------|
| T0-4 Health endpoints | `HealthController.java` | ✅ Done |
| T0-6 Login rate limiting | `LoginRateLimiter.java` | ✅ Done |
| S0-1/S0-2 Script fixes | `scripts/lib/common.ps1` | ✅ Done |
| T0-3 Backup/restore docs | Documentation | ✅ Done |
| T1-13 Migration rollback docs | Documentation | ✅ Done |
| T1-14 Operational runbook | Documentation | ✅ Done |
| T1-10 Authorization tests | Backend test files | ✅ Done |
| T0-1 Pagination + N+1 fix | `OrderService.java`, frontend | ✅ Done |
| Actuator health + probes | `pom.xml`, `SecurityConfig.java`, `application.properties` | ✅ Done |
| CI quality gate | `.github/workflows/merhouse-quality-gate.yml` | ✅ Done |
| Android release workflow | `.github/workflows/merhouse-android-release.yml` | ✅ Done |
| Load/smoke harness | `scripts/proof/release/load-smoke.ps1` | ✅ Done |
| Deployed monitoring harness | `scripts/proof/release/deployed-monitoring-proof.ps1` | ✅ Done |
| V17 production readiness | `scripts/quality/v17-production-readiness.ps1` | ✅ Done |
| Public-readiness | `scripts/quality/public-readiness.ps1` | ✅ Done |
| Deployment configs | `deploy/managed/` | ✅ Done |
| Email plumbing | `EmailDeliveryService.java` | ✅ Done |

### Phase 2: Email Console Capture Mode (0.5 Day — Prerequisite for Tier 2 Features)

| Order | Task | Code File | Change |
|-------|------|-----------|--------|
| 1 | Add `MERHOUSE_EMAIL_PROVIDER=log` mode to `EmailDeliveryService` | `EmailDeliveryService.java` | When enabled, log email to console instead of sending via SMTP |

### Phase 3: How To Use Page (1–2 Days — Can Parallelize with Phase 4)

| Order | Task | Code File | Change |
|-------|------|-----------|--------|
| 2 | Create `HowToUsePage.tsx` | New file | Content for roles, flows, navigation |
| 3 | Add `/how-to-use` route to `App.tsx` | `App.tsx` | Route definition |
| 4 | Add login page footer link to `/how-to-use` | `LoginPage.tsx` | Footer link |
| 5 | Add nav link in app layout | `AppLayout.tsx` | Help/guidance link |
| 6 | Frontend tests | `HowToUsePage.test.tsx` | Page rendering |

### Phase 4: Access Request & Approval Workflow (3–4 Days)

| Order | Task | Code File | Change |
|-------|------|-----------|--------|
| 7 | Add `approveAndActivate()` to `AccessRequestService` | `AccessRequestService.java` | New method combining approve + convert |
| 8 | Add controller endpoint | `AccessRequestController.java` | `POST /{id}/approve-and-activate` |
| 9 | Email activation body formatting | `AccessRequestService.java` | Call `EmailDeliveryService.send()` |
| 10 | Frontend: "Approve & activate" button | `AdminPages.tsx` | Update `AdminAccessRequestsPage` |
| 11 | Backend tests | `AccessRequestServiceTest.java` | New test cases |
| 12 | Frontend tests | `AdminManagement.test.tsx` | Updated tests |

### Phase 5: Password Recovery with OTP (3–4 Days)

| Order | Task | Code File | Change |
|-------|------|-----------|--------|
| 13 | Create `OTPService` | New file | Generate, hash, store, validate, expire |
| 14 | Add OTP entity/table | New entity or use `password_reset_tokens` | OTP fields |
| 15 | Controller endpoints | `AuthController.java` or new controller | 3 endpoints |
| 16 | Email integration | `OTPService.java` + `EmailDeliveryService` | Send OTP via email |
| 17 | Frontend: `/verify-otp` page | New `VerifyOtpPage.tsx` | OTP input, error states |
| 18 | Frontend: Update `/forgot-password` flow | `AuthRecoveryPages.tsx` | Redirect to OTP verification |
| 19 | Backend tests | New test file | OTP service + controllers |
| 20 | Frontend tests | New test file | OTP page |

### Phase 6: Documentation & Tier 3 Execution (2–3 Days, Parallel with Phase 5)

| Order | Task | Effort | Type |
|-------|------|--------|------|
| 21 | Update `IMPLEMENTATION_SEQUENCE.md` | 0.5 day | Doc |
| 22 | Update `docs/architecture/roadmap.md` | 0.5 day | Doc |
| 23 | Update `AGENTS.md` | 0.25 day | Doc |
| 24 | Update `docs/architecture/system-diagrams.html` | 1 day | Doc |
| 25 | Update `docs/architecture/account-lifecycle.md` | 0.5 day | Doc |
| 26 | Update `docs/operations/v17-service-activation.md` | 0.5 day | Doc |
| 27 | Update `docs/operations/production-deployment-activation.md` | 0.5 day | Doc |
| 28 | Update `docs/development/frontend.md` | 0.25 day | Doc |
| 29 | Update `docs/development/backend.md` | 0.25 day | Doc |
| 30 | Update `README.md` | 0.5 day | Doc |
| 31 | Run full quality gate | 1 day | Execution |
| 32 | Run public-readiness | 0.5 day | Execution |
| 33 | Tier 3: Load smoke against live deployment | 0.5 day | Execution |
| 34 | Tier 3: Deployed monitoring against live deployment | 0.5 day | Execution |
| 35 | Tier 3: Live stakeholder walkthrough | 1 day | Execution |
| 36 | Final live walkthrough | 1 day | Execution |

---

## New Estimated Completion Path

### Total Effort

| Phase | Effort | Can Parallelize | Type |
|-------|--------|---------------|------|
| Phase 1: Foundation (already done) | 0 days | N/A | Done |
| Phase 2: Email console mode | 0.5 day | No — prerequisite | Code |
| Phase 3: How To Use Page | 1–2 days | Yes — independent | Code |
| Phase 4: Access Request & Approval | 3–4 days | Yes — independent of Phase 3 | Code |
| Phase 5: Password Recovery OTP | 3–4 days | Starts after Phase 2 | Code |
| Phase 6: Documentation + Tier 3 execution | 2–3 days | Parallel with Phase 5 | Doc + Execution |
| **Total code effort** | **7–10 days** | With parallel: **5–8 calendar days** | |
| **Total execution effort** | **1–2 days** | Parallel with Phase 6 | Execution |
| **Grand total** | **8–12 days** | With parallel: **6–10 calendar days** | |

### Critical Path

```
Phase 2 (0.5d) ──┬── Phase 4 (3–4d) ──┐
                  ├── Phase 5 (3–4d) ──┤
                  ├── Phase 3 (1–2d) ──┤
                  └── Phase 6 (2–3d) ──┤
                                       └── Done
```

**Estimated calendar time on critical path:**
- Phase 2: 0.5 day
- Phase 4 or 5 (longest remaining): 4 days
- Phase 6: 3 days (can start 2 days before Phase 4/5 ends)
- **Total: ~5–7 calendar days** (code work only)
- Plus Tier 3 execution: +1–2 days (can run in parallel with Phase 6 documentation)
- **Grand total: ~6–9 calendar days**

---

## V17 Completion Criteria (Recalculated)

### V17 Is Complete When:

**Portfolio features (all 3 required — Tier 2):**
- [ ] Feature A: User requests access → admin clicks "Approve & activate" → tenant+user created → email sent → user signs in
- [ ] Feature B: User clicks "Forgot Password" → email entered → OTP generated → OTP verified → password reset
- [ ] Feature C: `/how-to-use` page explains roles, onboarding, order workflow, warehouse workflow, navigation — no legal content

**Quality gates (verified against actual test infrastructure):**
- [ ] `.ackenduild.ps1 test` passes (36+ existing test files)
- [ ] `npm --prefix frontend run test -- --run` passes (20+ existing test files)
- [ ] `npm --prefix frontend run build` passes
- [ ] `npm --prefix frontend run lint` passes
- [ ] `.uild.ps1 MarkdownCheck` passes (markdown links)
- [ ] `.uild.ps1 PublicReadiness` passes

**Documentation alignment:**
- [ ] All documents in Section 11 updated
- [ ] Documents in Section 12 created
- [ ] Documents in Section 13 frozen

**Demonstration readiness:**
- [ ] `docker compose up` starts backend, frontend, database
- [ ] Portfolio features work at `http://localhost:3000` without external dependencies
- [ ] Email works via `MERHOUSE_EMAIL_PROVIDER=log` (console capture)
- [ ] New accounts created through access request flow with no seed data required
- [ ] AI assistant responds with real operational context, not placeholder text

**Tier 3 execution (recommended but not blocking V17 completion):**
- [ ] Load smoke against live deployment (optional but recommended)
- [ ] Deployed monitoring against live deployment (optional but recommended)
- [ ] Live stakeholder walkthrough (optional but recommended)
- [ ] Backup/restore drill evidence (optional but recommended)
- [ ] Rollback rehearsal evidence (optional but recommended)

### V17 Is Explicitly NOT Complete When:

- Only deployment infrastructure is done but portfolio features are missing (this is the current state — deployment is done, features A–C are missing)
- Email plumbing exists but no workflow uses it (current state — Features A and B will fix this)
- How To Use page is missing (current state — Feature C will fix this)
- Access request requires manual conversion with password entry (current state — Feature A will fix this)
- Password recovery requires token exposure (current state — Feature B will fix this)

---

## Affected Documents (Verified Against Code)

### Documents to Update

| Document | Source Files Referenced | Required Changes |
|----------|----------------------|------------------|
| `IMPLEMENTATION_SEQUENCE.md` | All planning audit | Rewrite V17 scope from "deployment tasks" to "portfolio features + Tier 3 execution"; remove deployment as work item |
| `docs/architecture/roadmap.md` | All architecture docs | Reclassify V17; state deployment is confirmed live; add portfolio scope; keep Tier 3 execution as recommended |
| `docs/architecture/system-diagrams.html` | App.tsx, all services | Add How To Use node; update access request flow; add OTP recovery |
| `docs/architecture/account-lifecycle.md` | `AccessRequestService.java`, `AuthRecoveryService.java`, `OTPService` | Add auto-activation; add OTP recovery section |
| `docs/architecture/notifications.md` | `NotificationService.java` | Add activation email as notification event |
| `docs/operations/v17-service-activation.md` | `AuthRecoveryService`, `EmailDeliveryService` | Update service targets; note deployment is confirmed live; move Tier 3 execution to recommended |
| `docs/operations/production-deployment-activation.md` | `deploy/managed/` configs | Add V17 portfolio completion note; confirm deployment is live |
| `docs/development/frontend.md` | `App.tsx` | Add new routes |
| `docs/development/backend.md` | New `OTPService` | Add OTP service documentation |
| `docs/quality/deployment-ready-local-certification.md` | V17-RE-EVALUATION.md | Add portfolio features to scope; note deployment is confirmed live |
| `AGENTS.md` | V17-RE-EVALUATION.md | Update V17 refactoring rule; note deployment is confirmed |
| `README.md` | All | Update V17 status: "deployment confirmed live, completing portfolio features"; add feature badges |

### Documents to Create

| Document | Purpose |
|----------|---------|
| `docs/operations/v17-portfolio-release.md` | Documents V17 as portfolio completion milestone: deployment confirmed live, what features complete the user journey, how to demo, limitations |
| (OTP recovery documentation as section in `docs/architecture/account-lifecycle.md`) | OTP generation, storage, validation, expiration, throttling |

### Documents to Retire or Freeze

| Document | Action | Reason |
|----------|--------|--------|
| `docs/quality/v17-production-readiness.ps1` (script reference) | Keep active | Still runs in CI; deployment is live, so the script is now used for validation rather than preflight |
| `deploy/managed/huggingface-backend/space-readme-template.md` | Keep active | Deployment is live; this is the actual deployment artifact |
| `deploy/managed/vercel-frontend/env.frontend.example` | Keep active | Deployment is live; this is the actual deployment artifact |

**Note:** In the previous version of this document, these three items were incorrectly marked for freezing because the re-evaluation assumed deployment was not yet done. Since deployment is confirmed live, these are **active deployment artifacts**, not deferred work. They should remain in the repository and be updated as the deployment evolves.

---

## Summary: Why These Changes Improve Portfolio Value

### What a Portfolio Evaluator Sees Today

Cloning the repo and running `docker compose up` shows:
- A sophisticated B2B fulfillment platform with real operational workflows ✅
- A confirmed live deployment on Neon + HuggingFace + Vercel ✅ (new in this re-evaluation)
- A CI/CD pipeline that enforces quality on every commit ✅ (new in this re-evaluation)
- An Android release workflow that builds signed APKs ✅ (new in this re-evaluation)
- An AI assistant that works with real data but shows flat interactions (deferred to Vinfinite)
- Access requests that require a two-step approval + manual conversion with password entry ❌
- Password recovery that requires `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN=true` and puts a URL in the browser ❌
- No user guidance page — only empty-state descriptions ❌
- Email delivery that requires real SMTP credentials or returns "not configured" ❌

### What a Portfolio Evaluator Sees After V17

Cloning the repo and running `docker compose up` shows:
1. A complete onboarding flow: request access → admin approves → email shows activation → user signs in
2. A complete recovery flow: forgot password → OTP emailed → OTP entered → password reset
3. A How To Use page that explains the entire platform in 2 minutes
4. A functional AI assistant that reads real operational data (advanced features deferred to Vinfinite)
5. Email that works via console capture without SMTP credentials
6. A confirmed live deployment with CI/CD, load testing, monitoring, and Android release infrastructure

### Why This Matters

| Portfolio Dimension | Before V17 (Current) | After V17 |
|--------------------|-----------|----------|
| **Identity lifecycle** | Login only | Request → Approve → Activate → Login → Recover |
| **User onboarding** | Manual seed accounts or two-step conversion | Self-service with one-click admin approval |
| **Password management** | Token that must be echo-enabled | Professional OTP flow with throttling + expiration |
| **User guidance** | Empty states only | Dedicated How To Use page |
| **AI assistant** | Functional prototype — flat interaction list | Same — advanced features deferred to Vinfinite |
| **Email delivery** | Requires SMTP credentials | Works in demo mode (console capture) |
| **One-command demo** | Needed seed data + config | `docker compose up` → all features work |
| **Deployment** | Planned | Confirmed live (Neon + HuggingFace + Vercel) |
| **CI/CD** | Planned | Active (GitHub Actions, quality gate, Android release) |
| **Professional impression** | "Work in progress — needs deployment" | "Complete platform — deployed, tested, ready to use" |

The infrastructure work (Neon, HuggingFace, Vercel, signed APK, CI/CD) is **done**. The portfolio features prove **system design thinking** — you built a platform that handles the *entire user journey*, not just the operational core. A portfolio evaluator cares more about seeing a complete onboarding flow with email than about whether you deployed to HuggingFace Spaces, but both are now demonstrable.

---

## Risk Assessment

### Risks of This Re-Evaluation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Portfolio features add 7–10 days of code work | Medium | Medium | Parallelization across phases; critical path is 3–4 days (Feature A or B) |
| Email console capture is less impressive than real SMTP | Low | Medium | Document clearly as "local demo mode"; Tier 3 execution can prove live SMTP if configured |
| Existing tests break with new features | Medium | Medium | Write focused tests alongside; run full gate before completion |
| OTP implementation adds security surface area | Low | Medium | Follow existing patterns: hashing, expiration, throttling, audit, generic errors |
| Portfolio evaluator expects deployed production URL | Low | Medium | README and roadmap state deployment is confirmed live; live URL is available |
| Tier 3 execution against live deployment fails | Low | Medium | Scripts are CI-validated; failures indicate real deployment issues that need fixing before V17 closeout |
| AI assistant deferred may seem incomplete | Low | Low | Document clearly as intentional deferral; current assistant is functional with real data |

### Risks Mitigated by This Re-Evaluation

| Risk | Before | After |
|------|--------|-------|
| V17 drifts into indefinite deployment work | High — deployment always has more to do | Low — deployment is confirmed live; remaining work is bounded feature development |
| V17 completes but has no visible features | High — everything is behind deployment wall | Low — all features demonstrable locally and on live deployment |
| V17 scope too large to complete | Medium — 12-17 days of work | Low — 7-10 days with Feature D deferred |
| Developer infrastructure without user-facing demo | High | Low — features done first, deployment already done |
| Deployment scripts frozen by incorrect re-evaluation | High — would break CI | Low — scripts correctly classified as Tier 1 (done) |
