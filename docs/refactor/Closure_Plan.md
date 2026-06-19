# MerHouse Closure Plan

## Executive Summary

MerHouse is in a convergence phase, not an architecture phase. Core backend, frontend, mobile shell, CI/CD, deployment scripts, and documentation lanes already exist. Local quality proof is strong enough to treat the product implementation as substantially present, but the repository is not yet closure-ready because the remaining gaps are concentrated in proof, synchronization, and trust:

- critical public identity-lifecycle flows are not yet proven by the hostile browser and API proof lanes that closure depends on
- V17 scope and status are not described consistently across tracked docs
- assistant and OTP recovery documentation have been updated to reflect codebase removal
- the main system diagram is behind the implementation
- deployment closure still depends on missing or unproven backup, rollback, Android release, and live proof artifacts

Remaining closure scope should stay limited to convergence work that aligns implementation, tests, CI/CD, deployment proof, scripts, documentation, and diagrams.

Estimated completion effort:

- `P0`: 2 to 4 focused execution passes
- `P1`: 1 to 2 follow-up hardening passes
- `P2`: post-closure cleanup only if desired

## Repository Completion Criteria

The repository is considered closed only when all of the following are true:

1. All `P0` tasks in this plan are complete.
2. Backend tests, frontend lint, frontend tests, frontend build, and closure-critical E2E/API proof all pass.
3. CI/CD validates the same closure-critical flows that the repository claims as complete.
4. Deployment proof exists for the current live lane, including browser proof, Android release proof, monitoring proof, backup proof, rollback proof, and cutover-manifest validation.
5. Tracked documentation describes the same V17 scope and runtime behavior as the implementation.
6. Tracked diagrams describe the same architecture, flows, and migration state as the implementation.
7. Tracked scripts required by docs either exist and execute successfully or are removed from claims.
8. The repository can be reviewed by an external engineer without resolving contradictions manually.

## Closure Workstreams

### Workstream A - Testing & Verification

#### A-01

- **ID:** `A-01`
- **Description:** Expand the hostile browser proof lane to comprehensively cover all 6 stakeholder roles (OWNER, ADMIN, SUPPORT_ADMIN, AUDITOR, MERCHANT, WAREHOUSE_OPERATOR), all state machine workflows, and all system routes — including `/how-to-use` and approve-and-activate flows.
- **Why it exists:** Deployed proof (Workstream C) is externally blocked by SMTP and live-infrastructure access constraints. Comprehensive local browser proof across every role and route strengthens local verification to the maximum feasible coverage without falsely substituting for deployed-lane artifacts.
- **Evidence:** `frontend/tests/e2e/full-tour.spec.ts` still drives the old reset-token flow and does not prove `/how-to-use` or approve-and-activate behavior. The existing tour already iterates routes per role but does not exercise closure-critical workflow transitions.
- **Files affected:** `frontend/tests/e2e/full-tour.spec.ts`, `frontend/src/pages/HowToUsePage.tsx`, `frontend/src/pages/AdminPages.tsx`, `scripts/proof/web/frontend-full-tour.ps1`, any supporting fixtures under `frontend/tests/e2e/`.
- **Dependencies:** None.
- **Acceptance criteria:**
- The browser tour runs successfully against the current application flow for all 6 authenticated roles plus public.
- The tour proves `/how-to-use` and approve-and-activate flows.
- Every state machine transition visible through the UI is exercised for at least one role that can trigger it.
- Every authenticated route is visited and its interactive surface recorded for each authorized role.
- The generated report is accepted by existing report-aware proof gates without manual exceptions.
- **Priority:** `P0`

#### A-02

- **ID:** `A-02`
- **Description:** Expand the API smoke/scenario lane so every controller endpoint is exercised across role boundaries, with particular depth on approve-and-activate and all state machine transitions.
- **Why it exists:** Deployed proof (Workstream C) is externally blocked. Comprehensive local API proof across all endpoints and roles provides the strongest feasible runtime verification. The existing scenario suite still proves legacy recovery and older access-request handling, leaving current runtime paths under-proven.
- **Evidence:** `scripts/api/scenarios/14-auth-recovery-access.ps1` covers reset-token proof and approve/reject behavior but not approve-and-activate; `scripts/api/scenarios/05-admin-control-plane.ps1` does not prove approve-and-activate. Several controllers (notifications, assistant, service accountability, shipment lifecycle) have scenario coverage but lack role-boundary enforcement checks.
- **Files affected:** `scripts/api/scenarios/14-auth-recovery-access.ps1`, `scripts/api/scenarios/05-admin-control-plane.ps1`, `scripts/quality/api-smoke.ps1`, supporting helpers under `scripts/api/`, potentially new scenario files for under-covered endpoints.
- **Dependencies:** None.
- **Acceptance criteria:**
- API smoke passes against a seeded local stack covering approve-and-activate and all controller endpoints.
- API smoke proves approve-and-activate through the current controller/service behavior.
- Every public API endpoint has at least one scenario that exercises it with correct role authorization.
- Role-boundary enforcement is verified: unauthorized roles receive 403 on privileged endpoints.
- Smoke output is suitable for reuse by deployment-shaped proof without custom branching.
- **Priority:** `P0`

#### A-03

- **ID:** `A-03`
- **Description:** Add or strengthen focused automated tests for closure-critical public identity flows where proof currently relies too heavily on component or service tests alone.
- **Why it exists:** Closure depends on a stronger automated contract around OTP recovery and approve-and-activate than component-only or service-only coverage provides.
- **Evidence:** Approve-and-activate currently has partial service/component coverage but no matching hostile browser and API proof convergence.
- **Files affected:** `backend/src/test/java/com/merhouse/service/AccessRequestServiceTest.java`, controller/web-layer test files under `backend/src/test/java/com/merhouse/web/`, `frontend/src/pages/AdminManagement.test.tsx`.
- **Dependencies:** `A-01`, `A-02`
- **Acceptance criteria:**
- Tests assert the approve-and-activate contract at the web/service boundaries.
- The tests fail if the public workflow regresses while component markup remains superficially correct.
- No redundant low-value tests are added outside closure-critical behavior.
- **Priority:** `P1`

#### A-04

- **ID:** `A-04`
- **Description:** The deterministic assistant was removed from the codebase. No verification slice is needed. This task is superseded.
- **Status:** Superseded (feature removed).
- **Priority:** `P1` (removed)

- **ID:** `A-04`
- **Description:** Add a focused verification slice for the deterministic assistant contract so docs and proof rely on the actual implemented behavior, not implied threading features.
- **Why it exists:** Assistant behavior is currently oversold in docs; closure needs a stable, explicit tested contract for the implemented read-plus-draft assistant.
- **Evidence:** `docs/architecture/agentic-operations-assistance.md` describes richer context/threading than the request DTO and UI implement.
- **Files affected:** assistant tests under `backend/src/test/java/com/merhouse/service/` and `backend/src/test/java/com/merhouse/web/`, `frontend/src/pages/AssistantPage.test.tsx` if needed.
- **Dependencies:** None.
- **Acceptance criteria:**
- Assistant tests reflect the real request/response and history-scoping contract.
- No test or doc implies `parentInteractionId` or threaded conversations unless implemented.
- **Priority:** `P1`

### Workstream B - CI/CD Validation

#### B-01

- **ID:** `B-01`
- **Description:** Align CI validation with the updated closure-critical browser and API proof lanes.
- **Why it exists:** Current workflows pass without proving the strongest public closure claims.
- **Evidence:** `.github/workflows/merhouse-quality-gate.yml` validates local quality, but current browser/API proof does not cover `/how-to-use` and approve-and-activate.
- **Files affected:** `.github/workflows/merhouse-quality-gate.yml`, `scripts/quality/check.ps1`, `scripts/quality/frontend-check.ps1`, `scripts/quality/api-smoke.ps1`.
- **Dependencies:** `A-01`, `A-02`
- **Acceptance criteria:**
- The quality gate fails when any closure-critical browser or API proof regresses.
- CI logs show the updated proof slices running as part of normal quality validation.
- No duplicate heavy proof is added without clear closure value.
- **Priority:** `P0`

#### B-02

- **ID:** `B-02`
- **Description:** Define and validate the minimum CI path required before declaring V17 closure, including the Android release lane and deployment preflight lane.
- **Why it exists:** Closure requires a clear answer to which workflows must pass before the repository can be declared closed.
- **Evidence:** The Android release workflow is separate and manual; `v17-production-readiness.ps1` can pass while optional release slices remain unexecuted.
- **Files affected:** `.github/workflows/merhouse-quality-gate.yml`, `.github/workflows/merhouse-android-release.yml`, `scripts/quality/v17-production-readiness.ps1`, related operations docs.
- **Dependencies:** `C-02`, `C-03`
- **Acceptance criteria:**
- Closure docs and workflows identify the mandatory CI/workflow pass set for closure.
- The Android release lane is validated at least once against the deployed target URLs and current signing boundary.
- Preflight documentation no longer implies closure from a default preflight pass alone.
- **Priority:** `P0`

### Workstream C - Deployment Proof

#### C-01

> **Status:** Externally blocked. Unblocking condition: SMTP credentials and deployed HTTPS URLs configured in the proof execution environment.

- **ID:** `C-01`
- **Description:** Produce a current deployed V17 evidence package with browser tour, monitoring proof, load smoke, and cutover-readiness validation.
- **Why it exists:** Deployment cannot be considered closed until the current live lane has fresh, schema-valid evidence rather than only script availability.
- **Evidence:** The repository contains the proof scripts, but clone-visible execution evidence for the current live lane is not part of the tracked closure story.
- **Files affected:** ignored `reports/` outputs, `scripts/proof/release/deployed-v17-proof.ps1`, `scripts/proof/release/deployed-monitoring-proof.ps1`, `scripts/proof/release/load-smoke.ps1`, `scripts/proof/release/v17-cutover-readiness.ps1`, operations docs that record the proof status.
- **Dependencies:** `A-01`, `A-02`, access to real deployed URLs and proof credentials outside Git.
- **Acceptance criteria:**
- A fresh deployed evidence manifest is generated for the current deployed commit.
- Monitoring, load smoke, and browser proof artifacts validate against the cutover-readiness checker.
- Operations docs record the proof as completed without exposing private secrets or artifacts in Git.
- **Priority:** `P0`

#### C-02

> **Status:** Externally blocked. Unblocking condition: Android signing keystore and deployed HTTPS target URLs available in the proof execution environment.

- **ID:** `C-02`
- **Description:** Produce signed Android release proof tied to the same deployed lane, then link it to installed-Android evidence.
- **Why it exists:** Android architecture exists, but closure requires proof that the release lane works against the deployed target and that the installed walkthrough matches the signed artifact.
- **Evidence:** The repository has release scripts and a manual workflow, but closure evidence is incomplete without a fresh signed release manifest plus installed-app proof.
- **Files affected:** ignored `reports/` outputs, `scripts/proof/android/native-android-release-check.ps1`, `scripts/proof/android/native-android-release-login-proof.ps1`, `scripts/proof/android/native-android-release-visual-tour-proof.ps1`, `.github/workflows/merhouse-android-release.yml`, operations docs that record release proof status.
- **Dependencies:** `B-02`, access to signing material and deployed HTTPS URLs outside Git.
- **Acceptance criteria:**
- A signed APK manifest is produced for the deployed target URLs.
- Installed-Android proof references the same APK fingerprint.
- Closure docs record Android release proof as completed and no longer open.
- **Priority:** `P0`

#### C-03

> **Status:** Externally blocked. Unblocking condition: deployment boundary access available for backup/restore and rollback proof execution.

- **ID:** `C-03`
- **Description:** Close the backup/restore and rollback proof gap by making the repository claims and script inventory consistent, then executing the required proof path.
- **Why it exists:** Closure cannot survive review while deployment docs claim backup/rollback proof capability that is missing or unverified in the repository.
- **Evidence:** tracked docs describe backup/restore and rollback proof expectations, but matching scripts or completed proof are not currently part of the verified repository state.
- **Files affected:** `scripts/proof/release/` or `scripts/quality/` for the chosen proof implementation, `docs/operations/production-deployment-activation.md`, `docs/refactor/V17-RE-EVALUATION.md`, `docs/development/scripts.md`, any deployment-manifest attachment checks that require these artifacts.
- **Dependencies:** access to the real deployment boundary and operator proof inputs outside Git.
- **Acceptance criteria:**
- The repository either contains the backup/restore and rollback proof scripts it claims, or the docs are updated to the exact implemented mechanism.
- A real proof artifact exists for both backup/restore and rollback for the current deployment lane.
- `deployed-v17-proof.ps1` attachment validation accepts those artifacts without special-case handling.
- **Priority:** `P0`

#### C-04

> **Status:** Externally blocked. Unblocking condition: SMTP provider (Brevo) credentials configured and operator available for live walkthrough.

- **ID:** `C-04`
- **Description:** Record email-provider, alert-routing, and final live stakeholder walkthrough proof for the current deployed lane.
- **Why it exists:** The deployment architecture includes these proof contracts; closure requires executing them, not only shipping the proof recorders.
- **Evidence:** The scripts exist and the docs depend on these artifacts to clear deployment evidence, but current closure depends on operator-completed proof.
- **Files affected:** ignored `reports/` outputs, `scripts/proof/release/v17-email-provider-proof.ps1`, `scripts/proof/release/v17-alert-routing-proof.ps1`, `scripts/proof/release/v17-live-stakeholder-walkthrough-proof.ps1`, operations docs that record completion state.
- **Dependencies:** `C-01`, `C-02`, real provider/operator observations outside Git.
- **Acceptance criteria:**
- Each proof recorder emits a valid sanitized artifact for the deployed URLs.
- The artifacts are accepted by `deployed-v17-proof.ps1` and `v17-cutover-readiness.ps1`.
- Operations docs move these items from required evidence to completed evidence.
- **Priority:** `P0`

### Workstream D - Documentation Convergence

#### D-01

- **ID:** `D-01`
- **Description:** Normalize the repository-wide statement of V17 scope and current remaining work to one consistent source of truth.
- **Why it exists:** Closure is blocked when README, docs index, ops docs, and re-evaluation docs disagree about whether V17 is three features or four and whether AI completion is in scope.
- **Evidence:** `README.md`, `docs/index.md`, `docs/quality/deployment-ready-local-certification.md`, and ops docs still describe four remaining V17 features including AI Assistant Completion, while roadmap guidance defers AI and narrows V17 portfolio closure.
- **Files affected:** `README.md`, `docs/index.md`, `docs/quality/deployment-ready-local-certification.md`, `docs/operations/production-deployment-activation.md`, `docs/operations/v17-service-activation.md`, `docs/refactor/V17-RE-EVALUATION.md`, and any related landing docs that summarize V17 scope.
- **Dependencies:** None.
- **Acceptance criteria:**
- All tracked summary docs describe the same V17 scope and the same closure status.
- AI Assistant Completion is either explicitly deferred everywhere or explicitly implemented and proven before being claimed.
- No tracked doc describes both three and four remaining V17 features.
- **Priority:** `P0`

#### D-02 (Completed — OTP docs updated)

- **ID:** `D-02`
- **Description:** OTP password recovery documentation was aligned — OTP feature has been removed from the codebase. Firebase Auth handles password reset via built-in email templates. `docs/architecture/account-lifecycle.md` has been updated to remove OTP references.
- **Status:** Completed.

#### D-03 (Completed — assistant docs updated)

- **ID:** `D-03`
- **Description:** Assistant feature documentation was aligned — the deterministic assistant has been removed from the codebase. `docs/architecture/agentic-operations-assistance.md` has been replaced with a removal stub.
- **Status:** Completed.

#### D-04

- **ID:** `D-04`
- **Description:** Rewrite `V17-RE-EVALUATION.md` into a single internally consistent closure-status document.
- **Why it exists:** Closure cannot depend on a tracked source that simultaneously marks the same features complete and incomplete.
- **Evidence:** `docs/refactor/V17-RE-EVALUATION.md` contains contradictory status statements for the same portfolio features and deployment closeout items.
- **Files affected:** `docs/refactor/V17-RE-EVALUATION.md`, any docs that summarize or deep-link to specific sections in that file.
- **Dependencies:** `D-01`, `C-01`, `C-02`, `C-03`, `C-04`
- **Acceptance criteria:**
- Each closure item appears once with one status.
- The file distinguishes completed proof from remaining proof without contradiction.
- A reviewer can read the document without reconciling conflicting sections manually.
- **Priority:** `P0`

### Workstream E - Diagram Convergence

#### E-01

- **ID:** `E-01`
- **Description:** Update the main system diagram layer to reflect the current migration count and current public identity-lifecycle flows.
- **Why it exists:** Closure requires the tracked diagram surface to match the implementation and current scope.
- **Evidence:** `docs/architecture/system-diagrams.html` still reports 18 Flyway migrations and does not reflect `/how-to-use` or the one-step approve-and-activate path.
- **Files affected:** `docs/architecture/system-diagrams.html`.
- **Dependencies:** `D-01`, `D-02`
- **Acceptance criteria:**
- Migration count matches the repository.
- Identity-lifecycle diagrams and labels reflect `/how-to-use` and approve-and-activate where those flows are diagrammed.
- Diagram text does not preserve superseded onboarding or recovery descriptions.
- **Priority:** `P0`

#### E-02

- **ID:** `E-02`
- **Description:** Re-check any architecture or auth flow diagrams touched by documentation convergence so no diagrammed flow contradicts the corrected narrative.
- **Why it exists:** Diagram drift often survives after prose is fixed; closure needs the diagram layer to be explicitly revalidated, not assumed.
- **Evidence:** Authentication and onboarding flow descriptions have already drifted from implementation once.
- **Files affected:** any diagram-bearing files changed during `D-02` and `E-01`.
- **Dependencies:** `D-02`, `E-01`
- **Acceptance criteria:**
- Every changed diagram is reviewed against current controllers, services, and routes.
- No diagram claims endpoints or states that are absent from the code.
- **Priority:** `P1`

### Workstream F - Script Validation

#### F-01

- **ID:** `F-01`
- **Description:** Validate the script inventory against the repository and remove unsupported claims or add the missing scripts required by closure proof.
- **Why it exists:** Closure fails if tracked script guides and ops docs refer to proof assets that do not exist.
- **Evidence:** backup/restore and rollback proof are part of the documented closure story, but the verified repository state does not currently provide matching proven scripts.
- **Files affected:** `docs/development/scripts.md`, `docs/operations/production-deployment-activation.md`, `docs/refactor/V17-RE-EVALUATION.md`, and any script files created or restored under `scripts/`.
- **Dependencies:** `C-03`
- **Acceptance criteria:**
- Every script named in closure-critical docs exists and matches its documented purpose.
- Every missing script claim is either implemented or removed.
- Markdown and script parsing checks pass after the update.
- **Priority:** `P0`

#### F-02

- **ID:** `F-02`
- **Description:** Validate the deployed-proof attachment chain end-to-end using the actual closure artifacts.
- **Why it exists:** Closure depends on proof scripts interoperating correctly, not only parsing individually.
- **Evidence:** `deployed-v17-proof.ps1` and `v17-cutover-readiness.ps1` are designed to consume sibling artifacts, but closure requires one successful end-to-end artifact chain.
- **Files affected:** `scripts/proof/release/deployed-v17-proof.ps1`, `scripts/proof/release/v17-cutover-readiness.ps1`, attachment-check scripts and fixtures if required.
- **Dependencies:** `C-01`, `C-02`, `C-03`, `C-04`
- **Acceptance criteria:**
- The deployed evidence manifest references all required sibling artifacts without schema or target-mismatch failures.
- The cutover-readiness validator passes on the completed evidence package.
- Operations docs describe the completed attachment chain accurately.
- **Priority:** `P0`

#### F-03

- **ID:** `F-03`
- **Description:** Run markdown and script parsing validation after all documentation and script convergence work.
- **Why it exists:** Closure requires the corrected evidence layer to be mechanically valid, not only textually improved.
- **Evidence:** This plan introduces multiple doc and script touchpoints across root, docs, and script directories.
- **Files affected:** all changed markdown and PowerShell files.
- **Dependencies:** `D-01`, `D-02`, `D-03`, `D-04`, `E-01`, `F-01`, `F-02`
- **Acceptance criteria:**
- `.\scripts\quality\markdown-check.ps1` passes.
- Script parsing or preflight checks used by `v17-production-readiness.ps1` pass.
- No closure claim is blocked by malformed markdown or broken proof-script contracts.
- **Priority:** `P0`

## Priority Summary

### P0 - Required for Closure

- `A-01`
- `A-02`
- `B-01`
- `B-02`
- `C-01`
- `C-02`
- `C-03`
- `C-04`
- `D-01`
- `D-02`
- `D-03`
- `D-04`
- `E-01`
- `F-01`
- `F-02`
- `F-03`

### P1 - Strongly Recommended Before Closure

- `A-03`
- `E-02`

### P2 - Defer Until After Closure

- No `P2` tasks are currently justified by the verified closure gap set.

## Suggested Execution Order

> **Amendment (2026-06-16):** Deployed proof tasks (C-01, C-02, C-03, C-04) are externally blocked by SMTP, signing material, and live-infrastructure access constraints. Rather than substituting local evidence for deployed artifacts, the current strategy expands local proof lanes (A-01, A-02) to comprehensively cover all roles, routes, and state machine workflows — providing the strongest feasible local verification. Blocked tasks remain open until their unblocking conditions are met.

1. ~~Complete `D-01` and `D-04` first so the repository has one coherent closure story.~~ **(Done)**
2. Expand and complete `A-01` and `A-02` with comprehensive all-role, all-route, all-state-machine coverage so local proof is as strong as possible while deployed proof is blocked.
3. ~~Complete `D-02`, `D-03`, and `E-01` so docs and diagrams converge on the tested implementation.~~ **(Done)**
4. Complete `B-01` so CI validates the expanded browser and API proof lanes.
5. Complete `A-03` and `E-02` for targeted hardening.
6. Complete `C-03` (doc/script alignment portion only) and `F-01` so backup/rollback claims and script inventory are real and auditable.
7. **When unblocked:** Complete `C-01`, `C-02`, `C-03` (live execution), `C-04`, `B-02`, and `F-02` against the live deployed lane.
8. Run `F-03` and re-run the closure-critical quality and preflight gates.

## Closure Gate

The repository may only be considered closed when:

- all `P0` tasks are complete
- all critical inconsistencies identified by the audit are resolved
- closure-critical browser and API proof pass against the current implementation
- backend tests, frontend lint, frontend tests, frontend build, and closure-critical CI workflows pass
- deployment proof is complete for browser, Android release, monitoring, load smoke, backup, rollback, provider proof, alert proof, and live walkthrough proof
- documentation reflects implementation across README, docs index, architecture docs, quality docs, operations docs, and V17 status docs
- diagrams reflect implementation across the tracked system diagram layer
- scripts, script guides, and proof attachment validators agree with the implemented repository state
- the final closure claim can be defended from repository evidence without relying on contradictory prose
