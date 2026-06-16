# MerHouse Closure Progress Log

This file is the durable closure register for `docs/refactor/Closure_Plan.md`.

## Tracking Rules

- Update this file immediately after any task is completed or any identified issue is resolved.
- Record the task ID, completion timestamp, key findings, implemented resolution, and the verification used to confirm the success criteria.
- Keep unresolved or externally blocked items visible in the status table until closure evidence exists.

## Task Status

| Task | Status | Last Updated | Evidence |
| --- | --- | --- | --- |
| `D-01` | Closed | 2026-06-14T14:23:09.4942176+03:00 | Summary docs now consistently state that deployment is live, the three portfolio features are implemented, AI Assistant Completion is deferred, and remaining V17 work is closure convergence plus proof. |
| `D-04` | Closed | 2026-06-14T14:23:09.4942176+03:00 | `V17-RE-EVALUATION.md` rewritten as a single closure-status document with no duplicate/conflicting status claims. |
| `A-01` | In Progress | 2026-06-16T18:00:00+03:00 | Scope expanded to cover all 6 roles, all state machine workflows, and all routes (not just 3 closure-critical flows). Deployed proof is blocked; comprehensive local browser proof is the strongest feasible verification. |
| `A-02` | In Progress | 2026-06-16T18:00:00+03:00 | Scope expanded to cover every controller endpoint across role boundaries plus role-boundary enforcement checks. |
| `A-03` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `A-04` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `B-01` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `B-02` | Blocked | 2026-06-16T18:00:00+03:00 | Depends on C-02 and C-03 which are externally blocked. |
| `C-01` | Blocked | 2026-06-16T18:00:00+03:00 | Externally blocked: requires SMTP credentials and deployed HTTPS URLs outside Git. |
| `C-02` | Blocked | 2026-06-16T18:00:00+03:00 | Externally blocked: requires Android signing keystore and deployed HTTPS URLs outside Git. |
| `C-03` | Blocked | 2026-06-16T18:00:00+03:00 | Externally blocked: requires deployment boundary access for backup/restore and rollback proof. Doc/script alignment portion can proceed. |
| `C-04` | Blocked | 2026-06-16T18:00:00+03:00 | Externally blocked: requires SMTP provider (Brevo) credentials and operator for live walkthrough. |
| `D-02` | Closed | 2026-06-16T12:00:00+03:00 | Removed non-existent `verify-otp` endpoint reference from `account-lifecycle.md`; OTP recovery section now describes the actual two-step flow: `request-otp` generates and stores OTP, `reset-with-otp` accepts email + OTP code + new password. |
| `D-03` | Closed | 2026-06-16T12:00:00+03:00 | Replaced Feature D enhancement descriptions in `agentic-operations-assistance.md` with a deferral statement; conversation threading, chat UI, contextual awareness, and workflow guidance are deferred to Vinfinite per `V17-RE-EVALUATION.md`. |
| `E-01` | Closed | 2026-06-16T12:00:00+03:00 | Updated `system-diagrams.html` migration count from 18 to 19; added OTP recovery and approve-and-activate references to the identity lifecycle, AccessRequest UML card, and PasswordResetToken card. |
| `E-02` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `F-01` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `F-02` | Blocked | 2026-06-16T18:00:00+03:00 | Depends on C-01, C-02, C-03, C-04 which are externally blocked. |
| `F-03` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Runs after documentation and script convergence. |

## Closed Tasks

- **Task:** `D-01`  
  **Completed:** `2026-06-14T14:23:09.4942176+03:00`  
  **Key findings:** `README.md`, `docs/index.md`, `docs/quality/deployment-ready-local-certification.md`, `docs/operations/production-deployment-activation.md`, `docs/operations/v17-service-activation.md`, `docs/architecture/roadmap.md`, `AGENTS.md`, and `docs/refactor/IMPLEMENTATION_SEQUENCE.md` did not consistently describe V17 scope and remaining work. Several files still described AI Assistant Completion as remaining V17 scope and described the three portfolio features as unfinished despite the codebase already implementing them.  
  **Resolution implemented:** Updated the tracked summary docs so they now consistently state that deployment is confirmed live, the three portfolio features are implemented in the current codebase, AI Assistant Completion is deferred to Vinfinite, and the remaining V17 work is closure convergence plus deployed-proof execution.  
  **Verification:** Searched the tracked summary docs for the stale "four remaining features" and similar V17-scope wording after the edits; no remaining matches were found.

- **Task**: `D-04`  
  **Completed**: `2026-06-14T14:23:09.4942176+03:00`  
  **Key findings**: The prior `docs/refactor/V17-RE-EVALUATION.md` simultaneously described the same portfolio features as both implemented and still missing, which made the closure story internally contradictory.  
  **Resolution implemented**: Replaced the contradictory re-evaluation content with a concise closure-status document that separates implemented scope, deferred scope, open proof work, and closure rules, and points ordered execution back to `Closure_Plan.md`.  
  **Verification**: Re-read the rewritten file and searched it for stale contradiction markers such as "features A-C are missing", "current state", and "remaining code work is"; no contradiction matches remain.

- **Task:** `D-02`
  **Completed:** `2026-06-16T12:00:00+03:00`
  **Key findings:** `docs/architecture/account-lifecycle.md` described a `verify-otp` endpoint that does not exist in `AuthController.java`; the actual OTP recovery flow is a two-step process: `request-otp` then `reset-with-otp`.
  **Resolution implemented:** Removed the `verify-otp` reference and rewrote the OTP recovery bullet list to describe the actual implemented endpoints and flow.
  **Verification:** Grep confirmed `verify-otp` no longer appears in any tracked doc or source file; the updated text matches `AuthController.java` and `OtpResetRequest.java`.

- **Task:** `D-03`
  **Completed:** `2026-06-16T12:00:00+03:00`
  **Key findings:** `docs/architecture/agentic-operations-assistance.md` described Feature D enhancements (conversation threading, contextual awareness, chat-like UI, workflow guidance) as V17 work, but these are deferred to Vinfinite.
  **Resolution implemented:** Replaced the Feature D enhancement list with a deferral statement pointing to `V17-RE-EVALUATION.md`; kept the current deterministic behavior description intact.
  **Verification:** Searched the file for `parentInteractionId` implementation claims and chat-like UI descriptions as current V17 work; none remain.

- **Task:** `E-01`
  **Completed:** `2026-06-16T12:00:00+03:00`
  **Key findings:** `docs/architecture/system-diagrams.html` reported 18 Flyway migrations; the repository contains 19. The diagram also did not reference OTP recovery, approve-and-activate, or the `otp_code` column on `password_reset_tokens`.
  **Resolution implemented:** Updated the migration count pill to 19; added OTP and approve-and-activate references to the Access And Account Lifecycle card, AccessRequest UML card, and PasswordResetToken card.
  **Verification:** Counted migrations via filesystem listing (19 `.sql` files); confirmed 37 tables remain correct.

## Open Blocking Issues

| Issue | Status | Last Updated | Evidence |
| --- | --- | --- | --- |
| Port conflict on localhost:8080 | Closed - live on 8081 | 2026-06-14T17:02:00+03:00 | Host port 8080 remains occupied by AgentService; MerHouse local stack binds backend to host 8081 instead. |
| Local full-stack deployment setup | Closed | 2026-06-14T17:02:00+03:00 | Created .env from .env.example, aligned docker-compose.yml ports to 8081 and 3001, and confirmed containers are running and healthy. |
| Unresponsive health check at http://localhost:8080/api/v1/health | Closed - live on http://localhost:8081/api/v1/health | 2026-06-14T17:02:00+03:00 | Backend is reachable at http://localhost:8081/api/v1/health; `docker compose ps` shows merhouse-backend healthy. |
| SMTP credentials not configured for deployment proof | Open | 2026-06-16T18:00:00+03:00 | Brevo SMTP credentials are not configured in the proof execution environment, blocking C-01 (deployed evidence), C-04 (email-provider proof, alert-routing proof, live walkthrough). Unblocking condition: configure Brevo SMTP in the deployment environment. |
| Android signing material and deployed URLs not available for proof | Open | 2026-06-16T18:00:00+03:00 | Keystores exist in `.secrets/android/keystores/` but proof scripts require deployed HTTPS target URLs and signing passwords in the execution environment. Blocks C-02. Unblocking condition: signing passwords and deployed URLs available. |
| Deployment boundary access not available for backup/rollback proof | Open | 2026-06-16T18:00:00+03:00 | No access to the real Neon PostgreSQL or Hugging Face Space for backup/restore and rollback execution. Blocks C-03 (live portion). Unblocking condition: operator with deployment boundary access available. |

## Resolved Blocking Issues Details

- **Issue**: Port conflict on localhost:8080  
  **Resolved**: `2026-06-14T17:02:00+03:00`  
  **Key findings**: Host port 8080 is held by AgentService (PID 5356), so MerHouse uses host port 8081 instead. No other service is freeing 8080 at this time.  
  **Resolution implemented**: Documented local host port convention: MerHouse Docker stack is reachable on 8081 (backend) and 3001 (frontend) while AgentService retains 8080.  
  **Verification**: Ran `docker compose ps`; backend is healthy on `0.0.0.0:8081->8080/tcp`, frontend on `0.0.0.0:3001->80/tcp`.

- **Issue**: Local full-stack deployment setup
  **Resolved**: `2026-06-14T17:02:00+03:00`  
  **Key findings**: `.env` was missing and docker-compose port mapping was out of sync with local script expectations.  
  **Resolution implemented**: Created `.env` from `.env.example`, updated `docker-compose.yml` to publish backend on 8081 and frontend on 3001, updated `scripts/local/wait-backend.ps1`, `scripts/local/seed-demo.ps1`, and `frontend/vite.config.ts` to use the same ports, then rebuilt and started the stack with `docker compose up -d`.  
  **Verification**: `docker compose ps` shows all three containers running and backend healthy; `Invoke-RestMethod http://localhost:8081/api/v1/health` returns `{"status":"UP"}`.

- **Issue**: Unresponsive health check at http://localhost:8080/api/v1/health  
  **Resolved**: `2026-06-14T17:02:00+03:00`  
  **Key findings**: Backend container itself was starting after a fresh volume, but the old exported path attempted port 8081 and had a stale Postgres password on the old volume.  
  **Resolution implemented**: Re-created the Postgres volume to accept the password in `.env`, corrected docker-compose healthcheck to use container-local `localhost:8080` while keeping host mapping on 8081, and restarted backend/frontend.  
  **Verification**: Confirmed backend container healthy via `docker compose ps`; confirmed health endpoint returns `{"status":"UP"}` from host.

## Blocked Tasks

- **Task:** `C-01` — Deployed V17 evidence package
  **Blocked since:** `2026-06-16T18:00:00+03:00`
  **Blocker:** SMTP credentials and deployed HTTPS URLs are not available in the proof execution environment.
  **Unblocking condition:** Configure Brevo SMTP credentials and provide deployed Hugging Face/Vercel URLs for proof scripts.
  **Impact:** Also blocks F-02 (attachment chain validation).

- **Task:** `C-02` — Signed Android release proof
  **Blocked since:** `2026-06-16T18:00:00+03:00`
  **Blocker:** Signing passwords and deployed HTTPS target URLs are not available despite keystores existing in `.secrets/android/keystores/`.
  **Unblocking condition:** Provide signing keystore passwords and deployed target URLs for the Android release workflow.
  **Impact:** Also blocks B-02 (minimum CI path for closure).

- **Task:** `C-03` — Backup/restore and rollback proof
  **Blocked since:** `2026-06-16T18:00:00+03:00`
  **Blocker:** No access to real Neon PostgreSQL or Hugging Face Space for backup/restore and rollback execution.
  **Unblocking condition:** Operator with deployment boundary access available to execute backup/restore/rollback commands.
  **Partial progress possible:** The doc/script alignment portion (making claims match reality) can proceed without live access.
  **Impact:** Also blocks B-02 and F-01 (script inventory validation).

- **Task:** `C-04` — Email-provider, alert-routing, and live walkthrough proof
  **Blocked since:** `2026-06-16T18:00:00+03:00`
  **Blocker:** Brevo SMTP credentials not configured; operator not available for live stakeholder walkthrough.
  **Unblocking condition:** Configure Brevo SMTP in the deployment environment and schedule operator walkthrough.
  **Impact:** Also blocks F-02 (attachment chain validation).
