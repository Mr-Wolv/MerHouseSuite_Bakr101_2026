# MerHouse Deployment

Robust deployment scripts for deploying MerHouse to **Hugging Face Spaces** (backend) and **Firebase Hosting** (frontend).

## Why These Scripts?

The GitHub Actions CI/CD workflow has a known issue where the Hugging Face Spaces deployment stage hangs in a `"starting"` status for more than five minutes, indicating a silent failure loop. These scripts give you:

- **Full control** over the deployment process
- **5-minute fail-fast detection** for HF "starting" loops with detailed troubleshooting
- **Verbose-by-default error reporting** with full stack traces (use `--quiet` to suppress)
- **Credential validation** — tests your tokens before deploying and prompts for correct ones
- **Wipe and selective env var sync** options
- **Secure secret handling** via `.secrets/` directory (git-ignored)

## Prerequisites

### Common
- **PowerShell 7+** (`pwsh`) — Install from [Microsoft](https://docs.microsoft.com/powershell/scripting/install/installing-powershell)
- **Git** — For project path resolution

### Backend (Hugging Face)
- **Python 3.10+** — [python.org](https://python.org)
- **huggingface_hub** — `pip install huggingface_hub`
- **requests** — `pip install requests`
- **HF Token** — Generate at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

### Frontend (Firebase)
- **Node.js 24+** — [nodejs.org](https://nodejs.org)
- **npm** — Comes with Node.js
- **Firebase CLI** — `npm install -g firebase-tools`
- **Firebase login** — Run `firebase login` once
- **Firebase project** — Spark plan (free) configured

## Quick Setup

### 1. Install Python dependencies
```powershell
pip install huggingface_hub requests
```

### 2. Set up secrets
Create the required secret files in `.secrets/` (which is already git-ignored):

```powershell
# Copy the template and fill in your real values
Copy-Item .secrets/deploy/.env.template .secrets/deploy/managed/huggingface.env
Copy-Item .secrets/deploy/.env.template .secrets/deploy/firebase/firebase-spark.env
```

Edit these files with your actual credentials. **Never commit them to Git.**

### 3. Verify prerequisites
```powershell
# Check all tools are available
python --version
node --version
npm --version
firebase --version
```

## Verbose-by-Default

All scripts are **verbose by default**. Every step is logged with timestamps, and full stack traces are shown on errors. To suppress non-error output:

```powershell
python scripts/deploy/hf-deploy.py --sync-both --quiet
.\scripts\deploy\firebase-deploy.ps1 -Quiet
```

## Credential Validation & Prompting

All scripts **validate credentials before doing anything**. If a credential is invalid:

- **HF_TOKEN**: The script tests the token via the Hugging Face API (`whoami()`). If invalid, it prompts you to enter a new one interactively. It also verifies access to the target Space ID.
- **Firebase CLI**: The script runs `firebase projects:list` to verify it can access the target project. If authentication fails, it prompts you to run `firebase login`.
- **If you're in non-interactive mode** (e.g., piped input), the script will exit with a clear error message instead of hanging silently.

### Example: Invalid HF Token
```
[2025-06-21 14:30:00 UTC] [INFO]  Validating HF credentials...
[2025-06-21 14:30:01 UTC] [ERROR] Credential validation failed: HF_TOKEN is invalid or expired.
[2025-06-21 14:30:01 UTC] [INFO]

============================================================
   HUGGING FACE AUTHENTICATION REQUIRED
============================================================

Your HF_TOKEN could not be validated. Please provide a valid token.
Generate one at: https://huggingface.co/settings/tokens
The token needs 'write' scope for Space operations.

  HF_TOKEN >
```

### Example: Firebase Not Authenticated
```
[2025-06-21 14:30:00 UTC] [INFO]  Validating Firebase credentials for project 'merhouse-354e7'...

============================================================
   FIREBASE AUTHENTICATION REQUIRED
============================================================

Your Firebase CLI is not authenticated or cannot access the target project.
You need to run 'firebase login' to authenticate.

  Log in to Firebase now? (Y/N, default: Y) >
```

## Usage

### Backend: `scripts/deploy/hf-deploy.py`

```powershell
# Full sync: code + env vars + restart + health check
python scripts/deploy/hf-deploy.py --sync-both

# Code only sync + restart + health check
python scripts/deploy/hf-deploy.py --sync-code

# Env vars only sync (selective mode)
python scripts/deploy/hf-deploy.py --sync-env

# Sync env vars and delete remote orphans
python scripts/deploy/hf-deploy.py --sync-env --delete-orphans

# FULL WIPE: delete everything, then redeploy
python scripts/deploy/hf-deploy.py --wipe-full --sync-both

# Check status without making changes
python scripts/deploy/hf-deploy.py --status

# Health check only (no changes)
python scripts/deploy/hf-deploy.py --health-check

# Custom timeout
python scripts/deploy/hf-deploy.py --sync-both --timeout 45

# Use custom secrets file
python scripts/deploy/hf-deploy.py --sync-both --secrets-file .secrets/custom.env
```

### Frontend: `scripts/deploy/firebase-deploy.ps1`

```powershell
# Standard deploy (build + deploy)
.\scripts\deploy\firebase-deploy.ps1

# Preview
.\scripts\deploy\firebase-deploy.ps1 -WhatIf

# Skip build, deploy existing dist/
.\scripts\deploy\firebase-deploy.ps1 -SkipBuild

# Build only, no deploy
.\scripts\deploy\firebase-deploy.ps1 -SkipDeploy

# Suppress detail output
.\scripts\deploy\firebase-deploy.ps1 -Quiet

# Custom env file
.\scripts\deploy\firebase-deploy.ps1 -EnvFile .secrets/custom/firebase.env
```

## Authentication

All scripts support authentication via **environment variables** (checked first) or **`.secrets/` files** (fallback). This dual approach lets you:

- Use `.secrets/` files for regular local development
- Use environment variables for CI/CD or one-off operations
- Never commit credentials to Git

### Credential Validation Flow

1. **Load** from environment variables (highest priority)
2. **Fall back** to `.secrets/` env files
3. **Validate** by making real API calls (not just checking for non-empty values)
4. **Prompt** if validation fails — the script will ask you for the correct value interactively

#### Validation Checks Performed

| Credential | Validation Method |
|------------|-------------------|
| `HF_TOKEN` | `api.whoami()` — verifies token is valid and active |
| HF Space | `api.get_space_runtime(space_id)` — verifies you can access the Space |
| Firebase CLI | `firebase projects:list` — verifies you can see the target project |
| Firebase secrets | Checks all `VITE_FIREBASE_*` values are non-empty |
| DB credentials | Validates URL, username, password are all present |

### Environment Variables for Backend
```powershell
$env:HF_TOKEN = "hf_your_token"
$env:HF_SPACE_REPO_ID = "your-username/merhouse-backend"
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://..."
$env:SPRING_DATASOURCE_USERNAME = "..."
$env:SPRING_DATASOURCE_PASSWORD = "..."
$env:FIREBASE_SERVICE_ACCOUNT_JSON = '{"type":"service_account",...}'
# ... etc
```

### Environment Variables for Frontend
```powershell
$env:VITE_FIREBASE_API_KEY = "..."
$env:VITE_FIREBASE_PROJECT_ID = "..."
$env:VITE_API_BASE_URL = "https://..."
# ... etc
```

## Monitoring

### What Gets Monitored

All scripts log every step with timestamps:

```
[2025-06-21 14:30:00 UTC] [INFO]  MerHouse Hugging Face Local Deployment
[2025-06-21 14:30:01 UTC] [STEP]  [1/8] WIPING remote files from Space
[2025-06-21 14:30:05 UTC] [OK]    Deleted batch 1: 47 files
[2025-06-21 14:30:10 UTC] [STEP]  [4/8] Uploading backend source code
[2025-06-21 14:30:45 UTC] [OK]    Backend source uploaded successfully
[2025-06-21 14:30:46 UTC] [STEP]  [7/8] Monitoring deployment health (timeout: 30min, starting-timeout: 5min)
[2025-06-21 14:31:01 UTC] [DETAIL] [61s elapsed, 1739s remaining] Stage=RUNNING | Hardware=cpu-basic
[2025-06-21 14:31:16 UTC] [OK]    Health check PASSED after 76s!
```

### The 5-Minute Starting Timeout

If the HF Space stays in `STARTING` stage for more than 5 minutes, the script **fails immediately** with a descriptive error:

```
[2025-06-21 14:35:00 UTC] [ERROR] DEPLOYMENT FAILED: Space has been in STARTING stage for > 5 minutes (301s).
This indicates a silent failure loop. Common causes:
  (1) build error in Dockerfile
  (2) missing env vars
  (3) port binding issue
  (4) out of memory
Check HF Space logs at https://huggingface.co/spaces/your-username/merhouse-backend/logs
```

This is the key feature that addresses the CI/CD hang issue.

### Verbose Error Reporting

When something fails, you get the full stack trace:

```
[2025-06-21 14:30:00 UTC] [ERROR] Exception in upload_backend_source: FileNotFoundError: [Errno 2] ...
    [TRACE] Traceback (most recent call last):
    [TRACE]   File "scripts/deploy/hf-deploy.py", line 234, in upload_backend_source
    [TRACE]     from huggingface_hub import upload_folder
    [TRACE] ModuleNotFoundError: No module named 'huggingface_hub'
```

## Troubleshooting

### Hugging Face Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `ModuleNotFoundError: huggingface_hub` | Package not installed | `pip install huggingface_hub` |
| `HF_TOKEN is required` | Token missing | Set in env var or `.secrets/deploy/managed/huggingface.env` |
| `starting` for > 5 min | Build error, missing env vars, OOM | Check HF logs, verify env vars, try `--wipe-full` |
| `Connection refused` on health check | Space not ready yet | Normal during startup; script will retry |
| `Could not list remote files` | Token lacks permissions | Regenerate HF token with `write` scope |

### Firebase Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `firebase: command not found` | Firebase CLI not installed | `npm install -g firebase-tools` |
| `Not authenticated` | Firebase not logged in | `firebase login` |
| `Missing required secrets` | Env file incomplete | Fill all `VITE_FIREBASE_*` values |
| `Build failed` | Frontend code error | Check `npm run build` manually in `frontend/` |
| `Deploy failed` | Wrong project ID | Verify `VITE_FIREBASE_PROJECT_ID` matches `.firebaserc` |

### General Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Script exits immediately | PowerShell execution policy | `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| `Python not found` | Python not in PATH | Install Python or specify full path |

## Script Reference

### `scripts/deploy/hf-deploy.py` (Backend)

| Flag | Description |
|------|-------------|
| `--sync-both` | Sync code + env vars + restart + health check |
| `--sync-code` | Sync code only + restart + health check |
| `--sync-env` | Sync env vars only |
| `--wipe-full` | FULL WIPE: delete all, then redeploy |
| `--wipe-only` | Wipe all remote files, variables, and secrets (do not redeploy) |
| `--wipe-code-only` | Wipe all remote files (do not redeploy or change env) |
| `--wipe-env-only` | Wipe all remote variables and secrets (do not redeploy or change files) |
| `--status` | Check current status (no changes) |
| `--health-check` | Run health check only (no changes) |
| `--delete-orphans` | Delete remote vars not in local config |
| `--timeout` | Health check timeout (minutes) |
| `--quiet` | Suppress non-error output (verbose is the default) |
| `--secrets-file` | Custom secrets file path |

### `scripts/deploy/firebase-deploy.ps1` (Frontend)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `-EnvFile` | Path to Firebase env file | `.secrets/deploy/firebase/firebase-spark.env` |
| `-WhatIf` | Preview without changes | `$false` |
| `-SkipBuild` | Skip build, deploy existing dist | `$false` |
| `-SkipDeploy` | Build only, no deploy | `$false` |
| `-Quiet` | Suppress non-error output (verbose is the default) | `$false` |

## Security Notes

1. **Never commit `.secrets/`** — The directory is already in `.gitignore`, but double-check with:
   ```bash
   git check-ignore -q .secrets/deploy/managed/huggingface.env
   echo $?
   # Should be 0
   ```

2. **Use environment variables for CI** — If running in a CI environment, prefer environment variables over files.

3. **Rotate tokens regularly** — HF tokens and Firebase service account keys should be rotated periodically.

4. **The `.env.template` file** contains only placeholder values — safe to commit as documentation.

## Maintenance

### When to use `--wipe-full`

Use full wipe when:
- You've deleted files from the backend that may still exist remotely
- The Space is in a broken state and partial syncs don't fix it
- You've changed the Dockerfile or project structure significantly
- You suspect stale files are causing build issues

**Warning:** This deletes ALL code, variables, and secrets from the Space. The script will re-upload everything, but any manually-set variables you added outside these scripts will be lost.

### When to use `--delete-orphans`

Use selective orphan deletion when:
- You've removed env vars from your local config and want them gone from the remote
- You want the remote Space to exactly match your local config
- You're cleaning up after renaming or reorganizing variables
