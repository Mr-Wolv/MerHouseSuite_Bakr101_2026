# Scripts Guide

The `scripts/` directory contains PowerShell helpers for local development, verification, and repeatable project checks. These scripts are convenience wrappers around Docker Compose, Maven, npm, Playwright, and HTTP smoke flows.

## Script Layout

| Script | Purpose |
| --- | --- |
| `scripts/local/start.ps1` | Rebuild and start the local Docker Compose stack. |
| `scripts/local/stop.ps1` | Stop the local Docker Compose stack. |
| `scripts/local/seed-demo.ps1` | Create deterministic local demo data for review workflows. |
| `scripts/local/frontend-dev.ps1` | Start the Vite development server with a chosen host and port. |
| `scripts/local/wait-backend.ps1` | Wait until the local backend readiness endpoint answers before browser/API proof starts. |
| `scripts/quality/check.ps1` | Run backend, frontend, public-readiness, and Compose checks. |
| `scripts/quality/backend-check.ps1` | Run backend Maven tests. |
| `scripts/quality/frontend-check.ps1` | Run frontend lint, build, unit tests, and optional Playwright checks. |
| `scripts/quality/markdown-check.ps1` | Validate tracked markdown links, including supported wiki-style links, outside generated dependency and report folders. |
| `scripts/quality/api-smoke.ps1` | Run the API smoke suite against a running backend or frontend proxy. |
| `scripts/quality/api-docs.ps1` | Check local OpenAPI availability and print local documentation URLs. |
| `scripts/quality/frontend-deploy-check.ps1` | Check the deployed frontend shell and API proxy. |
| `scripts/quality/frontend-full-tour.ps1` | Run the browser tour against a running local stack. |
| `scripts/quality/public-readiness.ps1` | Check the repository tree for local-only folders, unsafe runtime files, CI naming, and Compose config. |
| `scripts/quality/deployment-readiness.ps1` | Run the V16 deployment-ready local certification gate with local/mock proof and optional API smoke. |
| `scripts/maintenance/clean-reports.ps1` | Trim old local reports, logs, and screenshots. |

## Typical Local Flow

Start the full stack:

```powershell
.\scripts\local\start.ps1
```

`start.ps1` waits for `http://localhost:8080/api/v1/health` before reporting the stack ready. Use the same readiness guard after rebuilding or restarting only the backend:

```powershell
docker compose up -d backend
.\scripts\local\wait-backend.ps1
```

Seed local review data when a live browser tour needs stable fake accounts for every stakeholder:

```powershell
.\scripts\local\seed-demo.ps1 -CreateReviewAccounts
```

The review accounts are local-only fake credentials for browser proof:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `admin@merhouse.local` | `local-owner-password` |
| Merchant | `review.merchant@merhouse.local` | `review-password` |
| Warehouse operator | `review.operator@merhouse.local` | `review-password` |
| Support admin | `review.support@merhouse.local` | `review-password` |
| Auditor | `review.auditor@merhouse.local` | `review-password` |

Do not reuse these credentials outside the local demo stack.

Run backend and frontend proof:

```powershell
cd backend
.\mvnw.cmd test

cd ..\frontend
npm test -- --run
npm run build
```

Run the full browser suite when the local backend stack is running and seeded:

```powershell
cd frontend
npm run test:e2e
```

Or use the repository wrapper:

```powershell
.\scripts\quality\frontend-check.ps1 -IncludeE2E
```

`frontend-check.ps1 -IncludeE2E` defaults the shared browser and API targets to the Docker frontend on port 3000 so every Playwright spec uses the same running app. To test another running frontend, override the shared browser target:

```powershell
$env:FRONTEND_TOUR_BASE_URL = "http://localhost:3000"
.\scripts\quality\frontend-check.ps1 -SkipInstall -IncludeE2E
Remove-Item Env:\FRONTEND_TOUR_BASE_URL
```

Password recovery proof has two local modes:

- default mode keeps `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN=false`; reset requests record local notification history and return a generic browser message without exposing a reset link
- complete local request/confirm proof requires `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN=true`, a backend restart or rebuild, and:

```powershell
.\scripts\quality\api-smoke.ps1 -ExpectRecoveryToken
```

Keep token echo disabled for production-shaped checks. V16 certifies the local/mock recovery boundary; provider-backed reset delivery remains a V17 real activation item.

Validate markdown links after documentation changes:

```powershell
.\scripts\quality\markdown-check.ps1
```

Run the V16 deployment-ready local certification gate when the stack is ready for heavier proof:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -SkipCompose
```

Add `-IncludeApiSmoke` when the seeded local stack should also prove API smoke scenarios. The gate stays local and mocked; it does not provision cloud infrastructure, provider setup, or production delivery.

Validate Compose configuration:

```powershell
docker compose --env-file .env.example config --quiet
```

Run the API smoke suite after the stack is running:

```powershell
.\scripts\quality\api-smoke.ps1
```

The API smoke suite includes the V14 assistant scenario. That scenario checks platform, merchant, and auditor assistant endpoints; assistant audit events; current-user history scoping; role and tenant refusals; read-only auditor behavior; and a smoke-scale concurrent assistant summary run.

## Script Families

`scripts/api/` contains the lower-level smoke runner, assertion helpers, HTTP helpers, report helpers, and scenario files. The `scripts/quality/api-smoke.ps1` wrapper is the normal entry point. The smoke suite is broad functional proof, not production load certification; maximum practical load and stress limits are reserved for the Pre-V16 release gate.

Frontend browser-flow scripts expect the local stack to be running and use the React app URL as the browser entry point. Playwright tests live under `frontend/tests/e2e/`, with configuration in `frontend/playwright.config.ts`. The Docker frontend target is controlled with `FRONTEND_TOUR_BASE_URL`.

Reports generated by scripts belong under `reports/`, which is ignored by Git.

## What Scripts Should Leave In Git

The scripts are local development and verification tooling. Runtime values come from ignored `.env` files, environment variables, command parameters, or explicit local files. Generated reports and local runtime files stay out of Git. Public-readiness checks scan the repository so app source, docs, scripts, CI, compose files, and root guidance stay useful to a developer who just cloned the project.
