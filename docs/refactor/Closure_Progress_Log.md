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
| `A-01` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `A-02` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `A-03` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `A-04` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `B-01` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `B-02` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `C-01` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Requires deployed proof inputs outside Git. |
| `C-02` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Requires signing material and deployed proof inputs outside Git. |
| `C-03` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `C-04` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Requires deployed provider/operator proof inputs outside Git. |
| `D-02` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `D-03` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `E-01` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `E-02` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `F-01` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Not started. |
| `F-02` | Pending | 2026-06-14T14:18:41.6039323+03:00 | Depends on deployed proof artifacts. |
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

## Resolved Blocking Issues

| Issue | Status | Last Updated | Evidence |
| --- | --- | --- | --- |
| Port conflict on localhost:3100 | Closed | 2026-06-14T15:10:00+03:00 | Checked netstat -ano; no process was using port 3100. |
| Local full‑stack deployment setup | Closed | 2026-06-14T15:25:00+03:00 | Created .env, updated docker‑compose.yml to use 8081 and 3001, updated wait‑backend.ps1; stack running successfully. |
| Unresponsive health check at http://localhost:8080/api/v1/health | Closed | 2026-06-14T15:25:00+03:00 | Backend now runs on port 8081; health check http://localhost:8081/api/v1/health returns status UP. |

## Resolved Blocking Issues Details

- **Issue**: Port conflict on localhost:3100  
  **Resolved**: `2026-06-14T15:10:00+03:00`  
  **Key findings**: Checked port 3100 with `netstat -ano`; no process was bound to that port.  
  **Verification**: Ran `netstat -ano | findstr :3100` and got no output.

- **Issue**: Local full‑stack deployment setup  
  **Resolved**: `2026-06-14T15:25:00+03:00`  
  **Key findings**: The project had a docker‑compose.yml but no .env file, and port 8080 was already in use by AgentService.  
  **Resolution implemented**: Created .env from .env.example, updated docker‑compose.yml to use host ports 8081 (backend) and 3001 (frontend), updated scripts/local/wait‑backend.ps1 to check port 8081, then started the stack with scripts/local/start.ps1.  
  **Verification**: Ran `docker ps` to confirm all three containers (postgres, backend, frontend) were running and healthy; verified backend health via http://localhost:8081/api/v1/health.

- **Issue**: Unresponsive health check at http://localhost:8080/api/v1/health  
  **Resolved**: `2026-06-14T15:25:00+03:00`  
  **Key findings**: Port 8080 was occupied by AgentService, so the backend container couldn't bind to it; we moved the backend to port 8081.  
  **Resolution implemented**: Modified docker‑compose.yml to map host port 8081 to container port 8080, updated .env's MERHOUSE_PUBLIC_FRONTEND_URL to http://localhost:3001, updated wait‑backend.ps1 to check http://localhost:8081/api/v1/health.  
  **Verification**: Confirmed the backend container was healthy via docker, then used `Invoke-RestMethod` to hit http://localhost:8081/api/v1/health and got {"status":"UP"}.
