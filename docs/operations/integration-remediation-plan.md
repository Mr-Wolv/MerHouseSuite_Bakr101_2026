# Production Integration Remediation Plan

## Purpose

This plan captures the active remediation path for production integration failures across Firebase Authentication, Hugging Face Spaces backend hosting, and configuration/secrets synchronization. It is aligned with the V17 closure rules in `docs/architecture/roadmap.md` and the V17 scope boundary in `docs/refactor/V17-RE-EVALUATION.md`.

Runtime values must remain outside Git. Use `.secrets/deploy/`, GitHub repository or environment secrets, Hugging Face Space variables/secrets, and Firebase Hosting build-time secrets instead of committing credentials.

## Completion Criteria

The remediation is complete only when all three conditions are verified:

1. CI/CD is operational, monitored, and all repository-visible jobs complete successfully.
2. Hugging Face Spaces, Firebase Hosting, and GitHub Actions consume synchronized code and required secrets.
3. Application workflows are verified across supported stakeholders, state machines, routes, and deployed/local proof paths.

## Current Repository Truths

- `.secrets/` is ignored by `.gitignore`.
- `deploy/managed/huggingface-backend/sync-secrets.py` is the local `.secrets/` to Hugging Face Space and GitHub Secrets sync path.
- `.github/workflows/merhouse-backend-sync.yml` syncs backend source and environment variables to the Hugging Face Docker Space, restarts the Space, and waits for health.
- `.github/workflows/merhouse-hosting-deploy.yml` builds the frontend with Firebase build secrets and deploys to Firebase Hosting live.
- `backend/src/main/java/com/merhouse/config/FirebaseConfig.java` initializes Firebase Admin SDK from `FIREBASE_SERVICE_ACCOUNT_JSON` or emulator credentials.
- `frontend/src/lib/firebase.ts` initializes the client Firebase SDK from `VITE_FIREBASE_*`.
- `frontend/src/api/client.ts` sends API calls to `VITE_API_BASE_URL`.

## Iterative Execution Loop

Repeat until all completion criteria are verified or an external blocker is recorded.

### 1. Stabilize

- Stop non-emergency deploys.
- Confirm `.secrets/` remains ignored and untracked.
- Capture the current commit, workflow run IDs, hosting URLs, and failing symptoms without logging secret values.

Checks:

```powershell
git status --short
git check-ignore -v .secrets\deploy\managed\huggingface.env
git ls-files .secrets deploy/private private
```

### 2. Validate Firebase Authentication

- Verify frontend Firebase project config and production API base URL.
- Verify backend Firebase Admin SDK JSON shape and IAM role.
- Run Firebase Auth sign-in smoke, then call backend `/api/v1/auth/me` with the Firebase ID token.
- Verify CORS allows only the production frontend origin.

Checks:

```powershell
npm run build
firebase projects:list
firebase hosting:channel:list --project "<firebase-project-id>"
```

```powershell
$body = @{
  email = "<staging-or-production-test-user>"
  password = "<masked-test-password>"
  returnSecureToken = $true
} | ConvertTo-Json

$auth = Invoke-RestMethod `
  -Method Post `
  -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<VITE_FIREBASE_API_KEY>" `
  -ContentType "application/json" `
  -Body $body

Invoke-RestMethod `
  -Method Get `
  -Uri "https://<hf-space>.hf.space/api/v1/auth/me" `
  -Headers @{ Authorization = "Bearer $($auth.idToken)" }
```

### 3. Validate Hugging Face Integration

- Validate the Hugging Face token.
- Validate Space runtime, source files, variables, and secrets.
- Validate Neon database connectivity.
- Restart the Space after secret/code changes and wait for `/api/v1/health`.

Checks:

```powershell
python deploy\managed\huggingface-backend\sync-secrets.py --validate
python deploy\managed\huggingface-backend\sync-secrets.py --hf-only
python deploy\managed\huggingface-backend\sync-hf-space.py --status
python deploy\managed\huggingface-backend\sync-hf-space.py --health --timeout 25
curl.exe -sSf "https://<hf-space>.hf.space/api/v1/health"
```

### 4. Audit and Reconfigure Secrets

Inventory and reconcile:

- Hugging Face Space variables: `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `MERHOUSE_DEPLOYMENT_PUBLIC`, `MERHOUSE_PUBLIC_FRONTEND_URL`, `MERHOUSE_CORS_ALLOWED_ORIGINS`, `MERHOUSE_AUTH_SEED_ADMIN_ENABLED`, `MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN`, `MERHOUSE_SWAGGER_ENABLED`, `FIREBASE_PROJECT_ID`.
- Hugging Face Space secrets: `SPRING_DATASOURCE_PASSWORD`, `FIREBASE_SERVICE_ACCOUNT_JSON`.
- GitHub secrets: `HF_SPACE_TOKEN`, `HF_SPACE_REPO_ID`, `HF_SPACE_DB_URL`, `HF_SPACE_DB_USERNAME`, `HF_SPACE_DB_PASSWORD`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `VITE_FIREBASE_*`, `MERHOUSE_PUBLIC_BACKEND_URL`.
- Firebase Hosting build-time variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_API_BASE_URL`.

Checks:

```powershell
gh auth status
gh secret list --repo "<owner>/<repo>" | Select-String "HF_SPACE|FIREBASE|VITE_FIREBASE|MERHOUSE_PUBLIC_BACKEND_URL"
.\scripts\quality\public-readiness.ps1 -SkipCompose
```

### 5. Harden CI/CD

Repository-side improvements to apply:

- Add fail-closed secret validation before backend sync and Firebase Hosting deploy.
- Add Hugging Face Space variable/secret key drift checks after sync.
- Add Hugging Face Space source-file verification after code upload.
- Add Firebase build-secret verification before `npm run build`.
- Add `MERHOUSE_PUBLIC_BACKEND_URL` as the canonical backend URL for frontend builds.
- Keep `production-backend` and `production-frontend` as protected deployment environments.
- Keep deployment status creation after health checks pass.

### 6. Run Repository-Local Proof

Run the matching proof for changed files:

```powershell
.\scripts\quality\check.ps1
```

If CI/workflow-only changes are made:

```powershell
Get-ChildItem .github\workflows -Filter *.yml | ForEach-Object {
  $yaml = Get-Content -LiteralPath $_.FullName -Raw
  if (-not $yaml) { throw "Empty workflow: $($_.FullName)" }
}
```

If scripts change:

```powershell
Get-ChildItem scripts -Recurse -Filter *.ps1 | ForEach-Object {
  $tokens = $null
  $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$parseErrors) | Out-Null
  if ($parseErrors) { throw $parseErrors | Out-String }
}
```

If markdown changes:

```powershell
.\scripts\quality\markdown-check.ps1
```

### 7. Execute Deployed Proof

Only proceed when live credentials, URLs, and operator access are available.

Required checks:

```powershell
curl.exe -sSf "https://<hf-space>.hf.space/actuator/health"
curl.exe -sSf "https://<hf-space>.hf.space/api/v1/health"
curl.exe -I "https://<firebase-host>.web.app"
```

Required application proof:

- Firebase login, logout, password reset, email verification paths.
- Access request submit, approve, reject, approve-and-activate paths.
- Owner, support-admin, auditor, merchant, warehouse, and empty-state stakeholder routes.
- Inventory, inbound stock, order allocation, fulfillment, shipment, service accountability, notification preference, admin governance, audit, outbox, and exception workflows.
- Local Docker Compose smoke and browser tour when deployed proof is blocked.
- Signed Android release and installed-APK tour when signing secrets and deployed HTTPS target are available.

## Current Verification

Repository-local verification completed on 2026-06-21:

```powershell
python -m py_compile deploy\managed\huggingface-backend\sync-secrets.py deploy\managed\huggingface-backend\sync-hf-space.py
.\scripts\quality\backend-check.ps1
.\scripts\quality\frontend-check.ps1 -SkipInstall
.\scripts\quality\markdown-check.ps1
.\scripts\quality\public-readiness.ps1 -SkipCompose
git diff --check
```

Live reachability checks completed:

```powershell
curl.exe -sSf -o NUL -w "backend_health=%{http_code}\n" https://m7mdhbkr-merhouse-backend.hf.space/api/v1/health
curl.exe -sSf -o NUL -w "actuator=%{http_code}\n" https://m7mdhbkr-merhouse-backend.hf.space/actuator/health
curl.exe -sSf -o NUL -w "frontend=%{http_code}\n" https://merhouse-354e7.web.app/
```

Expected and observed result: all three returned HTTP `200`.

Recent GitHub workflow history checked with:

```powershell
gh run list --repo Mr-Wolv/MerHouseSuite_Bakr101_2026 --limit 10 --json databaseId,workflowName,conclusion,status,headBranch,event,createdAt,url
```

Observed recent completed runs for Quality Gate, Backend Sync, and Firebase Hosting Deploy include successful runs. The new repository-side hardening changes have not yet been pushed or executed by GitHub Actions.

## Remaining External Verification

The following cannot be completed from the current execution environment because it would require live credentials, test users, or protected deployment access:

- Firebase Auth end-to-end sign-in and `/api/v1/auth/me` smoke test.
- Full deployed stakeholder browser tour across owner, support-admin, auditor, merchant, warehouse, and empty-state roles.
- Full state-machine and workflow proof against production data.
- Hugging Face Space secret mutation through `sync-secrets.py --hf-only`.
- Firebase Hosting deploy through the updated workflow.
- GitHub Actions execution of the updated workflows.

## External Blocker Policy

If any completion criterion depends on credentials, deployed infrastructure access, SMTP/provider proof, Android signing material, or live stakeholder review that is not present in the execution environment, record the blocker explicitly instead of claiming completion.

Blocker template:

```markdown
## Blocker

- Area:
- Required access:
- Evidence needed:
- Repository-visible fix completed:
- Next owner/action:
```

## Change Log

| Date | Change | Proof | Status |
| --- | --- | --- | --- |
| 2026-06-21 | Created remediation plan and execution loop. | Roadmap and V17 re-evaluation reviewed. | In progress |
| 2026-06-21 | Hardened backend sync, Firebase Hosting deploy, and secret sync fail-closed behavior. | `python -m py_compile ...`; workflow YAML parsed with PyYAML; backend, frontend, markdown, public readiness, and diff whitespace checks passed. | Repository-local proof complete; deployed proof blocked by live credentials and access. |
| 2026-06-21 | Fixed local backend quality check to set `FIREBASE_EMULATOR_HOST=true` during tests. | `.\scripts\quality\backend-check.ps1` passed: 267 tests, 0 failures, 0 errors. | Complete |
