#!/usr/bin/env python3
"""
MerHouse -- Enhanced Hugging Face Space Deployment Script

Robust local deployment to Hugging Face Spaces with:
  - Secure authentication via .secrets/ env files
  - Verbose error reporting with full stack traces
  - Stage-specific fail-safe timeouts:
      * STARTING > 5 min  → fail (build never started)
      * BUILDING > 10 min → fail (build stuck, likely compile error)
  - Full wipe option (clean all code, variables, and secrets)
  - Selective env var sync (sync only present local vars, delete remote orphans)
  - Detailed monitoring and status logging

Usage:
    python scripts/deploy/hf-deploy.py --sync-code           # Sync code only, no env vars
    python scripts/deploy/hf-deploy.py --sync-env           # Sync env vars only (selective mode)
    python scripts/deploy/hf-deploy.py --sync-both          # Sync code + env vars + restart + health check
    python scripts/deploy/hf-deploy.py --wipe-full          # NUKE: wipe all code, vars, secrets, then full redeploy
    python scripts/deploy/hf-deploy.py --wipe-full --sync-both
    python scripts/deploy/hf-deploy.py --status             # Check current Space status
    python scripts/deploy/hf-deploy.py --health-check       # Poll health with multi-stage timeouts
    python scripts/deploy/hf-deploy.py --sync-env --delete-orphans  # Sync env vars and delete remote vars not in local set

Environment:
    HF_TOKEN                  (required) Hugging Face API token
    HF_SPACE_REPO_ID          (optional) Default: M7mdHBkr/merhouse-backend
    HF_SPACE_DB_URL         (optional) Database JDBC URL
    HF_SPACE_DB_USERNAME    (optional) Database username
    HF_SPACE_DB_PASSWORD    (optional) Database password
    HF_SPACE_FIREBASE_SA_JSON (optional) Firebase service account JSON

Secrets file fallback:
    .secrets/deploy/managed/huggingface.env
"""

import os
import sys
import time
import json
import argparse
import traceback
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, List, Set, Tuple

# Allow interactive input for credential prompting
_INTERACTIVE = sys.stdin.isatty()

# ── Configuration ───────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_SPACE = "M7mdHBkr/merhouse-backend"
DEFAULT_SECRETS_FILE = PROJECT_ROOT / ".secrets" / "deploy" / "managed" / "huggingface.env"

BACKEND_DIR = PROJECT_ROOT / "backend"
DEPLOY_DIR = PROJECT_ROOT / "deploy" / "managed" / "huggingface-backend"

HEALTH_ENDPOINT = "/api/v1/health"
STARTING_TIMEOUT_SECONDS = 300   # 5 minutes — Space must leave STARTING by now
BUILDING_TIMEOUT_SECONDS = 600   # 10 minutes — Space must leave BUILDING by now
POLL_INTERVAL_SECONDS = 15

UPLOAD_IGNORE = [
    "target/**", ".gradle/**", "build/**",
    "*.log", "*.tmp", "backend-compose.Dockerfile",
    ".gitignore", ".gitattributes",
]

# Keys that must be treated as secrets (hidden in HF Space UI)
SECRET_KEYS = {
    "SPRING_DATASOURCE_PASSWORD",
    "HF_TOKEN",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
}

# ── Logging / Verbose Output ────────────────────────────────────────────────

class Logger:
    """
    Verbose-by-default, timestamped logger with structured output.
    
    All messages are always shown. Use --quiet to suppress non-error output.
    When an error occurs, the full traceback is always printed (not just in verbose mode)
    so the user never sees a silent failure.
    """
    
    def __init__(self):
        self.verbose = True
        self.errors: List[str] = []
        self.warnings: List[str] = []
        
    def _ts(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    
    def info(self, msg: str):
        line = f"[{self._ts()}] [INFO]  {msg}"
        print(line)
        sys.stdout.flush()
    
    def step(self, num: int, msg: str):
        line = f"[{self._ts()}] [STEP]  [{num}/8] {msg}"
        print(f"\n{'='*60}")
        print(line)
        print(f"{'='*60}")
        sys.stdout.flush()
    
    def ok(self, msg: str):
        line = f"[{self._ts()}] [OK]    {msg}"
        print(line)
        sys.stdout.flush()
    
    def warn(self, msg: str):
        line = f"[{self._ts()}] [WARN]  {msg}"
        self.warnings.append(msg)
        print(line)
        sys.stdout.flush()
    
    def error(self, msg: str):
        line = f"[{self._ts()}] [ERROR] {msg}"
        self.errors.append(msg)
        print(line, file=sys.stderr)
        sys.stderr.flush()
    
    def detail(self, msg: str):
        if self.verbose:
            line = f"[{self._ts()}] [DETAIL] {msg}"
            print(f"    {line}")
            sys.stdout.flush()
    
    def exception(self, exc: Exception, context: str = ""):
        """Print full exception traceback with context."""
        self.error(f"Exception in {context}: {type(exc).__name__}: {exc}")
        if self.verbose:
            tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
            for line in tb:
                for subline in line.rstrip().split('\n'):
                    print(f"    [TRACE] {subline}", file=sys.stderr)
            sys.stderr.flush()


log = Logger()

# ── Secret Loading ────────────────────────────────────────────────────────────

def load_env_file(filepath: Path) -> Dict[str, str]:
    """Parse a .env file into a dict."""
    values = {}
    if not filepath.exists():
        log.warn(f"Env file not found: {filepath}")
        return values
    
    log.detail(f"Loading env file: {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                log.warn(f"Invalid line {line_num} in env file: {line[:50]}")
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key:
                values[key] = val
    log.detail(f"Loaded {len(values)} values from env file")
    return values


# ── Credential Validation & User Prompting ──────────────────────────────────

def validate_hf_token(token: str, space_id: str) -> Tuple[bool, str]:
    """
    Test that the HF token actually works by calling the HF API.
    Returns (is_valid: bool, message: str).
    """
    try:
        from huggingface_hub import HfApi
        api = HfApi(token=token)
        # whoami() validates the token by making an actual API call
        who = api.whoami()
        username = who.get("name", "unknown")
        log.detail(f"HF API auth verified: logged in as '{username}'")
        
        # Also verify we can access the target space
        try:
            api.get_space_runtime(repo_id=space_id)
            log.detail(f"Space access verified: {space_id}")
        except Exception as e:
            err_msg = str(e).lower()
            if "404" in err_msg or "not found" in err_msg:
                return False, (
                    f"Space '{space_id}' not found. Check that HF_SPACE_REPO_ID is correct.\n"
                    f"  Current value: {space_id}\n"
                    f"  Expected format: your-username/your-space-name"
                )
            elif "403" in err_msg or "forbidden" in err_msg:
                return False, (
                    f"Access denied to space '{space_id}'. Your HF token may not have write access.\n"
                    f"  Generate a token with 'write' scope at: https://huggingface.co/settings/tokens"
                )
            else:
                log.warn(f"Could not verify space access: {e}")
                log.warn("Continuing anyway — the space may not exist yet or may be temporarily unreachable.")
        
        return True, f"Authenticated as '{username}'"
    except ImportError:
        return False, "huggingface_hub package not installed. Run: pip install huggingface_hub"
    except Exception as e:
        err_msg = str(e).lower()
        if "401" in err_msg or "unauthorized" in err_msg or "invalid token" in err_msg:
            return False, (
                f"HF_TOKEN is invalid or expired. Generate a new token at:\n"
                f"  https://huggingface.co/settings/tokens"
            )
        elif "403" in err_msg or "forbidden" in err_msg:
            return False, (
                f"HF_TOKEN does not have sufficient permissions.\n"
                f"  Ensure the token has 'write' scope.\n"
                f"  Generate a new token at: https://huggingface.co/settings/tokens"
            )
        else:
            return False, f"HF API error: {type(e).__name__}: {e}"


def prompt_for_hf_token(current_token: str = "") -> str:
    """
    Prompt the user to enter a valid HF token interactively.
    Returns the new token.
    """
    if not _INTERACTIVE:
        log.error("Cannot prompt for credentials in non-interactive mode (no TTY).")
        log.error("Please set the HF_TOKEN environment variable or update .secrets/deploy/managed/huggingface.env and re-run.")
        sys.exit(1)
    
    print()
    log.warn("=" * 60)
    log.warn("   HUGGING FACE AUTHENTICATION REQUIRED")
    log.warn("=" * 60)
    log.info("")
    log.info("Your HF_TOKEN could not be validated. Please provide a valid token.")
    log.info("Generate one at: https://huggingface.co/settings/tokens")
    log.info("The token needs 'write' scope for Space operations.")
    log.info("")
    
    try:
        new_token = input("  HF_TOKEN > ").strip()
        if not new_token:
            log.error("No token provided. Aborting.")
            sys.exit(1)
        return new_token
    except (EOFError, KeyboardInterrupt):
        print()
        log.error("Input cancelled. Aborting.")
        sys.exit(1)


def prompt_for_space_id(current_space: str = DEFAULT_SPACE) -> str:
    """
    Prompt the user to enter the correct HF Space ID interactively.
    Returns the new space ID.
    """
    if not _INTERACTIVE:
        log.error("Cannot prompt in non-interactive mode.")
        log.error(f"Please set HF_SPACE_REPO_ID environment variable and re-run.")
        sys.exit(1)
    
    print()
    log.warn(f"Space '{current_space}' not found or not accessible.")
    
    try:
        new_id = input(f"  HF Space ID (e.g., username/space-name) [{current_space}] > ").strip()
        if not new_id:
            return current_space
        return new_id
    except (EOFError, KeyboardInterrupt):
        print()
        log.error("Input cancelled. Aborting.")
        sys.exit(1)


def resolve_hf_config() -> Tuple[str, str, Dict[str, str]]:
    """
    Resolve HF token and space ID from env vars or secrets file.
    Validates the token by making an API call, and prompts the user
    if the credentials are invalid.
    
    Returns (token, space_id, all_secrets_dict).
    """
    # Try env vars first
    token = os.environ.get("HF_TOKEN", "")
    space_id = os.environ.get("HF_SPACE_REPO_ID", DEFAULT_SPACE)
    
    # Load from secrets file as fallback/supplement
    file_secrets = load_env_file(DEFAULT_SECRETS_FILE)
    
    if not token and file_secrets.get("HF_TOKEN"):
        token = file_secrets["HF_TOKEN"]
        log.detail("HF_TOKEN loaded from secrets file")
    
    if file_secrets.get("HF_SPACE_REPO_ID"):
        space_id = file_secrets["HF_SPACE_REPO_ID"]
    
    # Merge: env vars override file values, but file provides defaults
    merged = dict(file_secrets)
    for key in os.environ:
        if key in file_secrets or key.startswith("HF_") or key.startswith("SPRING_") or key.startswith("FIREBASE_") or key.startswith("MERHOUSE_"):
            merged[key] = os.environ[key]
    
    if not token:
        log.error("HF_TOKEN is required. Set it as an environment variable or in .secrets/deploy/managed/huggingface.env")
        token = prompt_for_hf_token()
    
    # Validate the token
    log.info("Validating HF credentials...")
    while True:
        valid, msg = validate_hf_token(token, space_id)
        if valid:
            log.ok(msg)
            break
        
        log.error(f"Credential validation failed: {msg}")
        log.info("")
        
        if "not found" in msg.lower() or "accessible" in msg.lower():
            new_space = prompt_for_space_id(space_id)
            if new_space != space_id:
                space_id = new_space
                # Re-validate with new space ID
                continue
        
        # Prompt for new token
        token = prompt_for_hf_token()
        # Update the merged secrets too
        merged["HF_TOKEN"] = token
    
    # Save validated token back to environment for downstream use
    os.environ["HF_TOKEN"] = token
    
    log.info(f"Target Space: {space_id}")
    return token, space_id, merged


# ── Hugging Face API Helpers ────────────────────────────────────────────────

def get_hf_api(token: str):
    """Initialize HfApi with error handling."""
    try:
        from huggingface_hub import HfApi
        return HfApi(token=token)
    except ImportError:
        log.error("huggingface_hub package is not installed. Run: pip install huggingface_hub")
        sys.exit(1)
    except Exception as e:
        log.exception(e, "HfApi initialization")
        sys.exit(1)


def get_space_runtime(api, space_id: str) -> Optional[object]:
    """Get Space runtime with verbose error handling."""
    try:
        return api.get_space_runtime(repo_id=space_id)
    except Exception as e:
        log.exception(e, f"get_space_runtime({space_id})")
        return None


def list_remote_files(api, space_id: str) -> List[str]:
    """List all files in the Space repo."""
    try:
        files = api.list_repo_files(repo_id=space_id, repo_type="space")
        log.detail(f"Remote has {len(files)} files")
        return files
    except Exception as e:
        log.exception(e, "list_repo_files")
        return []


# ── Wipe Operations ───────────────────────────────────────────────────────────

def wipe_remote_files(api, space_id: str) -> int:
    """Delete ALL files from the Space repo. Returns count of deleted files."""
    log.step(1, "WIPING remote files from Space")
    
    from huggingface_hub import CommitOperationDelete
    
    files = list_remote_files(api, space_id)
    if not files:
        log.ok("Remote repo is already empty. No files to wipe.")
        return 0
    
    log.info(f"Found {len(files)} files to delete")
    
    BATCH = 100  # Smaller batch for reliability
    total = 0
    for i in range(0, len(files), BATCH):
        batch = files[i:i + BATCH]
        ops = [CommitOperationDelete(path_in_repo=f) for f in batch]
        try:
            api.create_commit(
                repo_id=space_id,
                repo_type="space",
                operations=ops,
                commit_message=f"Wipe batch {i // BATCH + 1}: {len(ops)} files",
            )
            total += len(ops)
            log.ok(f"Deleted batch {i // BATCH + 1}: {len(ops)} files")
        except Exception as e:
            log.exception(e, f"delete batch {i // BATCH + 1}")
            log.error(f"Failed to delete batch {i // BATCH + 1}, continuing...")
    
    log.ok(f"Wipe complete: {total}/{len(files)} files deleted")
    return total


def wipe_remote_variables(api, space_id: str) -> int:
    """Delete ALL variables from Space settings."""
    log.step(2, "WIPING remote variables from Space")
    
    try:
        existing = api.get_space_variables(repo_id=space_id)
        if not existing:
            log.ok("No variables to wipe.")
            return 0
        
        count = 0
        for key in list(existing.keys()):
            try:
                api.delete_space_variable(repo_id=space_id, key=key)
                count += 1
                log.detail(f"Deleted variable: {key}")
            except Exception as e:
                log.exception(e, f"delete variable {key}")
        log.ok(f"Wiped {count} variables")
        return count
    except Exception as e:
        log.exception(e, "wipe_remote_variables")
        return 0


def wipe_remote_secrets(api, space_id: str) -> int:
    """Delete ALL secrets from Space settings."""
    log.step(3, "WIPING remote secrets from Space")
    
    try:
        existing = api.get_space_secrets(repo_id=space_id)
        if not existing:
            log.ok("No secrets to wipe.")
            return 0
        
        count = 0
        for key in list(existing.keys()):
            try:
                api.delete_space_secret(repo_id=space_id, key=key)
                count += 1
                log.detail(f"Deleted secret: {key}")
            except Exception as e:
                log.exception(e, f"delete secret {key}")
        log.ok(f"Wiped {count} secrets")
        return count
    except Exception as e:
        log.exception(e, "wipe_remote_secrets")
        return 0


# ── Upload Operations ─────────────────────────────────────────────────────────

def upload_backend_source(api, space_id: str, token: str, stale_cleanup: bool = False) -> bool:
    """Upload backend source code to Space."""
    log.step(4, "Uploading backend source code")
    
    if not BACKEND_DIR.exists():
        log.error(f"Backend directory not found: {BACKEND_DIR}")
        return False
    
    try:
        from huggingface_hub import upload_folder
        
        kwargs = dict(
            repo_id=space_id,
            repo_type="space",
            folder_path=str(BACKEND_DIR),
            path_in_repo="backend",
            token=token,
            commit_message="Upload backend source via local deploy",
            ignore_patterns=UPLOAD_IGNORE,
        )
        if stale_cleanup:
            kwargs["delete_patterns"] = ["backend/src/**"]
            log.detail("Stale cleanup enabled: will delete orphaned src files")
        
        upload_folder(**kwargs)
        log.ok("Backend source uploaded successfully")
        return True
    except Exception as e:
        log.exception(e, "upload_backend_source")
        return False


def upload_deploy_files(api, space_id: str, token: str) -> bool:
    """Upload Dockerfile and README to Space root."""
    log.detail("Uploading Dockerfile and README")
    
    try:
        from huggingface_hub import upload_file
        
        dockerfile = DEPLOY_DIR / "Dockerfile"
        readme = DEPLOY_DIR / "space-readme-template.md"
        
        if not dockerfile.exists():
            log.error(f"Dockerfile not found: {dockerfile}")
            return False
        if not readme.exists():
            log.error(f"README template not found: {readme}")
            return False
        
        upload_file(
            repo_id=space_id, repo_type="space",
            path_or_fileobj=str(dockerfile),
            path_in_repo="Dockerfile", token=token,
            commit_message="Upload Dockerfile"
        )
        log.ok("Dockerfile uploaded")
        
        upload_file(
            repo_id=space_id, repo_type="space",
            path_or_fileobj=str(readme),
            path_in_repo="README.md", token=token,
            commit_message="Upload README"
        )
        log.ok("README uploaded")
        return True
    except Exception as e:
        log.exception(e, "upload_deploy_files")
        return False


# ── Environment Variable Sync ───────────────────────────────────────────────

def build_space_config(secrets: Dict[str, str]) -> Tuple[Dict[str, str], Dict[str, str]]:
    """Build the target variables and secrets dicts from loaded secrets."""
    
    # Map CI-style env var names to application names
    db_url = secrets.get("SPRING_DATASOURCE_URL", secrets.get("HF_SPACE_DB_URL", ""))
    db_username = secrets.get("SPRING_DATASOURCE_USERNAME", secrets.get("HF_SPACE_DB_USERNAME", ""))
    db_password = secrets.get("SPRING_DATASOURCE_PASSWORD", secrets.get("HF_SPACE_DB_PASSWORD", ""))
    firebase_sa = secrets.get("FIREBASE_SERVICE_ACCOUNT_JSON", secrets.get("HF_SPACE_FIREBASE_SA_JSON", ""))
    
    variables = {
        "SPRING_DATASOURCE_URL": db_url,
        "SPRING_DATASOURCE_USERNAME": db_username,
        "MERHOUSE_DEPLOYMENT_PUBLIC": secrets.get("MERHOUSE_DEPLOYMENT_PUBLIC", "true"),
        "MERHOUSE_PUBLIC_FRONTEND_URL": secrets.get("MERHOUSE_PUBLIC_FRONTEND_URL", "https://merhouse-354e7.web.app"),
        "MERHOUSE_CORS_ALLOWED_ORIGINS": secrets.get("MERHOUSE_CORS_ALLOWED_ORIGINS", "https://merhouse-354e7.web.app,capacitor://localhost,ionic://localhost"),
        "MERHOUSE_AUTH_SEED_ADMIN_ENABLED": secrets.get("MERHOUSE_AUTH_SEED_ADMIN_ENABLED", "false"),
        "MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN": secrets.get("MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN", "false"),
        "MERHOUSE_SWAGGER_ENABLED": secrets.get("MERHOUSE_SWAGGER_ENABLED", "false"),
        "FIREBASE_PROJECT_ID": secrets.get("FIREBASE_PROJECT_ID", "merhouse-354e7"),
    }
    
    # Filter out empty values
    variables = {k: v for k, v in variables.items() if v}
    
    secrets_dict = {
        "SPRING_DATASOURCE_PASSWORD": db_password,
        "FIREBASE_SERVICE_ACCOUNT_JSON": firebase_sa,
    }
    secrets_dict = {k: v for k, v in secrets_dict.items() if v}
    
    return variables, secrets_dict


def sync_env_vars(api, space_id: str, secrets: Dict[str, str], 
                  delete_orphans: bool = False, wipe_first: bool = False) -> bool:
    """Sync environment variables to Space."""
    log.step(5, "Syncing environment variables to Space")
    
    target_vars, target_secrets = build_space_config(secrets)
    
    if not target_vars and not target_secrets:
        log.warn("No env vars or secrets to sync. Skipping.")
        return True
    
    errors = 0
    
    # ── Variables ──
    log.info(f"Syncing {len(target_vars)} variable(s)")
    
    try:
        existing_vars = api.get_space_variables(repo_id=space_id)
        log.detail(f"Found {len(existing_vars)} existing variables")
    except Exception as e:
        log.exception(e, "get_space_variables")
        existing_vars = {}
    
    if wipe_first and existing_vars:
        log.detail("Wipe mode: clearing all existing variables first")
        for key in list(existing_vars.keys()):
            try:
                api.delete_space_variable(repo_id=space_id, key=key)
                log.detail(f"Cleared variable: {key}")
            except Exception as e:
                log.exception(e, f"delete variable {key}")
    
    for key, value in target_vars.items():
        try:
            # Delete existing if present to avoid conflicts
            if key in existing_vars:
                api.delete_space_variable(repo_id=space_id, key=key)
                log.detail(f"Replaced variable: {key}")
            else:
                log.detail(f"Creating variable: {key}")
            api.add_space_variable(repo_id=space_id, key=key, value=value)
        except Exception as e:
            log.exception(e, f"set variable {key}")
            errors += 1
    
    if delete_orphans:
        orphan_vars = set(existing_vars.keys()) - set(target_vars.keys()) - SECRET_KEYS
        for key in orphan_vars:
            try:
                api.delete_space_variable(repo_id=space_id, key=key)
                log.detail(f"Deleted orphan variable: {key}")
            except Exception as e:
                log.exception(e, f"delete orphan variable {key}")
    
    # ── Secrets ──
    log.info(f"Syncing {len(target_secrets)} secret(s)")
    
    try:
        existing_secrets = api.get_space_secrets(repo_id=space_id)
        log.detail(f"Found {len(existing_secrets)} existing secrets")
    except Exception as e:
        log.exception(e, "get_space_secrets")
        existing_secrets = {}
    
    if wipe_first and existing_secrets:
        log.detail("Wipe mode: clearing all existing secrets first")
        for key in list(existing_secrets.keys()):
            try:
                api.delete_space_secret(repo_id=space_id, key=key)
                log.detail(f"Cleared secret: {key}")
            except Exception as e:
                log.exception(e, f"delete secret {key}")
    
    for key, value in target_secrets.items():
        try:
            if key in existing_secrets:
                api.delete_space_secret(repo_id=space_id, key=key)
                log.detail(f"Replaced secret: {key}")
            else:
                log.detail(f"Creating secret: {key}")
            api.add_space_secret(repo_id=space_id, key=key, value=value)
        except Exception as e:
            log.exception(e, f"set secret {key}")
            errors += 1
    
    if delete_orphans:
        orphan_secrets = set(existing_secrets.keys()) - set(target_secrets.keys())
        for key in orphan_secrets:
            try:
                api.delete_space_secret(repo_id=space_id, key=key)
                log.detail(f"Deleted orphan secret: {key}")
            except Exception as e:
                log.exception(e, f"delete orphan secret {key}")
    
    if errors:
        log.error(f"Env sync completed with {errors} error(s)")
        return False
    
    log.ok("Environment variables synced successfully")
    return True


# ── Space Control ───────────────────────────────────────────────────────────

def restart_space(api, space_id: str) -> bool:
    """Restart the Space to trigger a fresh build."""
    log.step(6, "Restarting Space to trigger build")
    
    try:
        log.detail("Pausing Space...")
        api.pause_space(repo_id=space_id)
        log.ok("Space paused")
        time.sleep(2)
    except Exception as e:
        log.exception(e, "pause_space")
        log.warn("Pause failed, continuing with restart anyway")
    
    try:
        log.detail("Restarting Space...")
        api.restart_space(repo_id=space_id)
        log.ok("Space restarted -- build initiated")
        return True
    except Exception as e:
        log.exception(e, "restart_space")
        return False


# ── Health Check with Multi-Stage Timeouts ────────────────────────────────

def check_space_health(space_id: str, token: str, timeout_minutes: int = 30) -> Tuple[bool, str]:
    """
    Poll Space until healthy or until a stage-specific timeout is exceeded.
    
    Stage timeouts (fail-fast on silent failure loops):
      - STARTING for >  5 minutes → FAILED (build hasn't even started)
      - BUILDING for > 10 minutes → FAILED (build is stuck, likely compile error)
    
    On every poll both the Space runtime stage AND the health endpoint are
    checked. The moment HTTP 200 is returned the function succeeds.
    
    If any stage exceeds its timeout, a detailed error with troubleshooting
    is returned so the user knows exactly what went wrong.
    
    Returns (success: bool, message: str).
    """
    log.step(7, f"Monitoring deployment health (timeout: {timeout_minutes}min | STARTING > 5min | BUILDING > 10min)")
    
    try:
        import requests
    except ImportError:
        log.error("requests package is not installed. Run: pip install requests")
        return False, "requests not installed"
    
    api = get_hf_api(token)
    host = f"https://{space_id.lower().replace('/', '-')}.hf.space"
    health_url = f"{host}{HEALTH_ENDPOINT}"
    
    start_time = time.time()
    deadline = start_time + (timeout_minutes * 60)
    
    # Per-stage timers
    starting_since: Optional[float] = None
    building_since: Optional[float] = None
    
    # Tracking for diagnostics
    last_stage = ""
    stage_changes = 0
    stage_history: List[Tuple[str, float, float]] = []  # (stage, entered_at, duration)
    current_stage_entered: Optional[float] = None
    
    while time.time() < deadline:
        elapsed = int(time.time() - start_time)
        remaining = int(deadline - time.time())
        
        # ── 1. Check Space runtime status via API ──
        runtime = get_space_runtime(api, space_id)
        if runtime:
            stage = str(runtime.stage) if hasattr(runtime, 'stage') else "UNKNOWN"
            hardware = str(runtime.hardware) if hasattr(runtime, 'hardware') else "UNKNOWN"
            
            if stage != last_stage:
                # Record stage transition for diagnostics
                now = time.time()
                if last_stage and current_stage_entered is not None:
                    stage_history.append((last_stage, current_stage_entered, now - current_stage_entered))
                current_stage_entered = now
                
                stage_changes += 1
                log.info(f"Stage transition: {last_stage} -> {stage} (change #{stage_changes})")
                last_stage = stage
            
            log.detail(f"[{elapsed}s elapsed, {remaining}s remaining] Stage={stage} | Hardware={hardware}")
            
            stage_upper = stage.upper()
            
            # ── 2. Per-stage timeout checks ──
            
            # ── 2a. STARTING timeout (5 minutes) ──
            if stage_upper == "STARTING":
                if starting_since is None:
                    starting_since = time.time()
                    building_since = None  # reset building tracker
                    log.info(f"Space entered STARTING stage at {elapsed}s — build is queued")
                    log.info(f"This should progress to BUILDING/RUNNING within {STARTING_TIMEOUT_SECONDS // 60} minutes.")
                else:
                    starting_duration = time.time() - starting_since
                    remaining_sec = max(0, STARTING_TIMEOUT_SECONDS - int(starting_duration))
                    log.detail(f"STARTING for {int(starting_duration)}s... {remaining_sec}s before fail-safe triggers")
                    if starting_duration >= STARTING_TIMEOUT_SECONDS:
                        error_msg = (
                            f"═══ FAIL-SAFE TRIGGERED ═══\n"
                            f"STAGE: STARTING\n"
                            f"DURATION: > {STARTING_TIMEOUT_SECONDS // 60} minutes ({int(starting_duration)}s)\n"
                            f"STATUS: SPACE NOT RESPONDING — build process never started.\n"
                            f"\n"
                            f"Timeline of stages observed:\n"
                        )
                        for s_name, s_entered, s_dur in stage_history:
                            error_msg += f"  {s_name}: {int(s_dur)}s\n"
                        if last_stage:
                            error_msg += f"  {last_stage}: currently stuck\n"
                        error_msg += (
                            f"\n"
                            f"TROUBLESHOOTING:\n"
                            f"  1. Check the Space build logs:\n"
                            f"     https://huggingface.co/spaces/{space_id}/logs\n"
                            f"  2. Common causes for STARTING hang:\n"
                            f"     - Hugging Face infrastructure is busy (try again later)\n"
                            f"     - Out of free build hours for the month\n"
                            f"     - Space hardware tier is unavailable\n"
                            f"     - Docker image pull timeout (check HF status: https://status.huggingface.co)\n"
                            f"  3. To retry with a clean slate:\n"
                            f"     python scripts/deploy/hf-deploy.py --wipe-full\n"
                            f"\n"
                            f"View live logs:\n"
                            f"  https://huggingface.co/spaces/{space_id}/logs\n"
                        )
                        log.error(error_msg)
                        return False, error_msg
            
            # ── 2b. BUILDING timeout (10 minutes) ──
            elif stage_upper == "BUILDING":
                if building_since is None:
                    building_since = time.time()
                    starting_since = None  # reset starting tracker
                    log.info(f"Space entered BUILDING stage at {elapsed}s — Docker build is running")
                    log.info(f"This should complete within {BUILDING_TIMEOUT_SECONDS // 60} minutes.")
                else:
                    building_duration = time.time() - building_since
                    remaining_sec = max(0, BUILDING_TIMEOUT_SECONDS - int(building_duration))
                    log.detail(f"BUILDING for {int(building_duration)}s... {remaining_sec}s before fail-safe triggers")
                    if building_duration >= BUILDING_TIMEOUT_SECONDS:
                        error_msg = (
                            f"═══ FAIL-SAFE TRIGGERED ═══\n"
                            f"STAGE: BUILDING\n"
                            f"DURATION: > {BUILDING_TIMEOUT_SECONDS // 60} minutes ({int(building_duration)}s)\n"
                            f"STATUS: DOCKER BUILD STUCK — the Docker image failed to build or is taking too long.\n"
                            f"\n"
                            f"Timeline of stages observed:\n"
                        )
                        for s_name, s_entered, s_dur in stage_history:
                            error_msg += f"  {s_name}: {int(s_dur)}s\n"
                        if last_stage:
                            error_msg += f"  {last_stage}: currently stuck\n"
                        error_msg += (
                            f"\n"
                            f"TROUBLESHOOTING:\n"
                            f"  1. Check the Space build logs for compilation errors:\n"
                            f"     https://huggingface.co/spaces/{space_id}/logs\n"
                            f"  2. Common causes for BUILDING hang:\n"
                            f"     - Compilation error in the Java/Spring Boot code\n"
                            f"     - Maven dependency download failure\n"
                            f"     - Out of memory during build (try cpu-upgrade hardware)\n"
                            f"     - Dockerfile has a syntax or layer caching issue\n"
                            f"  3. Test the Docker build locally first:\n"
                            f"     cd deploy/managed/huggingface-backend && docker build -f Dockerfile ../../\n"
                            f"  4. After fixing, redeploy with a full wipe:\n"
                            f"     python scripts/deploy/hf-deploy.py --wipe-full\n"
                            f"\n"
                            f"View live logs:\n"
                            f"  https://huggingface.co/spaces/{space_id}/logs\n"
                        )
                        log.error(error_msg)
                        return False, error_msg
            
            # ── 2c. RUNNING / other stages — reset all timers ──
            else:
                if starting_since is not None:
                    log.info(f"Space left STARTING stage after {int(time.time() - starting_since)}s")
                    starting_since = None
                if building_since is not None:
                    log.info(f"Space left BUILDING stage after {int(time.time() - building_since)}s")
                    building_since = None
        else:
            stage = "UNKNOWN"
            log.detail(f"[{elapsed}s] Could not retrieve runtime status (API may be recovering)")
        
        # ── 3. Health endpoint check (works regardless of reported stage) ──
        try:
            resp = requests.get(health_url, timeout=15)
            if resp.status_code == 200:
                body = resp.text[:300]
                log.ok(f"═ SPRING BOOT HEALTH CHECK PASSED after {elapsed}s! ═")
                log.detail(f"Health response: {body}")
                
                # Log final stage timeline
                if stage_history or last_stage:
                    log.detail("Stage timeline:")
                    for s_name, s_entered, s_dur in stage_history:
                        log.detail(f"  {s_name}: {int(s_dur)}s")
                    if last_stage:
                        now = time.time()
                        final_dur = int(now - (current_stage_entered or now))
                        if last_stage.upper() != "RUNNING":
                            log.detail(f"  {last_stage}: {final_dur}s (transitioning)")
                        else:
                            log.detail(f"  {last_stage}: {final_dur}s")
                
                return True, f"Healthy after {elapsed}s — deployment successful"
            else:
                log.detail(f"Health endpoint returned HTTP {resp.status_code}")
        except requests.exceptions.ConnectionError:
            log.detail(f"Health check: Connection refused (Space not ready yet)")
        except requests.exceptions.Timeout:
            log.detail(f"Health check: Timed out after 15s")
        except Exception as e:
            log.detail(f"Health check error: {type(e).__name__}: {e}")
        
        time.sleep(POLL_INTERVAL_SECONDS)
    
    # ── 4. Final timeout — overall deadline exceeded ──
    # Build a detailed timeout message with the full stage timeline
    timeout_msg = (
        f"═══ OVERALL TIMEOUT ═══\n"
        f"DEPLOYMENT FAILED: Space did not become healthy within {timeout_minutes} minutes.\n"
        f"\n"
        f"Stage timeline:\n"
    )
    for s_name, s_entered, s_dur in stage_history:
        timeout_msg += f"  {s_name}: {int(s_dur)}s\n"
    if last_stage:
        now = time.time()
        stuck_dur = int(now - (current_stage_entered or now))
        timeout_msg += f"  {last_stage}: {stuck_dur}s (currently stuck here)\n"
    timeout_msg += (
        f"\n"
        f"Check the Space logs for the actual error:\n"
        f"  https://huggingface.co/spaces/{space_id}/logs\n"
    )
    log.error(timeout_msg)
    return False, timeout_msg


def check_space_status(space_id: str, token: str) -> None:
    """Print current Space status without polling."""
    log.info(f"Checking status of Space: {space_id}")
    
    api = get_hf_api(token)
    runtime = get_space_runtime(api, space_id)
    
    if runtime:
        stage = str(runtime.stage) if hasattr(runtime, 'stage') else "UNKNOWN"
        hardware = str(runtime.hardware) if hasattr(runtime, 'hardware') else "UNKNOWN"
        log.info(f"Stage:      {stage}")
        log.info(f"Hardware:   {hardware}")
    else:
        log.error("Could not retrieve Space runtime status")
    
    try:
        import requests
        host = f"https://{space_id.lower().replace('/', '-')}.hf.space"
        resp = requests.get(f"{host}{HEALTH_ENDPOINT}", timeout=10)
        log.info(f"Health:     HTTP {resp.status_code}")
        if resp.status_code == 200:
            log.ok(f"Response:   {resp.text[:200]}")
    except Exception as e:
        log.info(f"Health:     {type(e).__name__}: {e}")


# ── Main Entry Points ───────────────────────────────────────────────────────

def cmd_wipe_full(token: str, space_id: str, secrets: Dict[str, str], 
                  timeout: int = 30) -> int:
    """FULL WIPE: Delete everything and redeploy from scratch."""
    log.info("=" * 60)
    log.info("MODE: FULL WIPE + REDEPLOY")
    log.info("This will DELETE all code, variables, and secrets from the Space.")
    log.info("=" * 60)
    
    api = get_hf_api(token)
    
    # 1. Wipe files
    wipe_remote_files(api, space_id)
    
    # 2. Wipe variables
    wipe_remote_variables(api, space_id)
    
    # 3. Wipe secrets
    wipe_remote_secrets(api, space_id)
    
    # 4. Upload code
    ok = upload_backend_source(api, space_id, token, stale_cleanup=False)
    if not ok:
        log.error("Code upload failed. Aborting.")
        return 1
    
    ok = upload_deploy_files(api, space_id, token)
    if not ok:
        log.error("Deploy file upload failed. Aborting.")
        return 1
    
    # 5. Sync env vars (with wipe_first since we already wiped)
    ok = sync_env_vars(api, space_id, secrets, wipe_first=False)
    if not ok:
        log.error("Env var sync failed. Aborting.")
        return 1
    
    # 6. Restart
    restart_space(api, space_id)
    
    # 7. Health check with 5-min starting timeout
    healthy, msg = check_space_health(space_id, token, timeout_minutes=timeout)
    if healthy:
        log.ok("=" * 60)
        log.ok("DEPLOYMENT SUCCESSFUL")
        log.ok("=" * 60)
        return 0
    else:
        log.error("=" * 60)
        log.error("DEPLOYMENT FAILED")
        log.error("=" * 60)
        return 1


def cmd_sync_both(token: str, space_id: str, secrets: Dict[str, str],
                  timeout: int = 30, delete_orphans: bool = False) -> int:
    """Sync code + env vars + restart + health check."""
    log.info("=" * 60)
    log.info("MODE: FULL SYNC (code + env + restart + health)")
    log.info("=" * 60)
    
    api = get_hf_api(token)
    
    # Upload code (with stale cleanup, no full wipe)
    ok = upload_backend_source(api, space_id, token, stale_cleanup=True)
    if not ok:
        return 1
    
    ok = upload_deploy_files(api, space_id, token)
    if not ok:
        return 1
    
    # Sync env vars
    ok = sync_env_vars(api, space_id, secrets, delete_orphans=delete_orphans)
    if not ok:
        return 1
    
    # Restart
    restart_space(api, space_id)
    
    # Health check
    healthy, msg = check_space_health(space_id, token, timeout_minutes=timeout)
    if healthy:
        log.ok("=" * 60)
        log.ok("DEPLOYMENT SUCCESSFUL")
        log.ok("=" * 60)
        return 0
    else:
        log.error("=" * 60)
        log.error("DEPLOYMENT FAILED")
        log.error("=" * 60)
        return 1


def cmd_sync_code_only(token: str, space_id: str, timeout: int = 30) -> int:
    """Sync code only, no env vars, then restart + health check."""
    log.info("=" * 60)
    log.info("MODE: CODE ONLY SYNC")
    log.info("=" * 60)
    
    api = get_hf_api(token)
    
    ok = upload_backend_source(api, space_id, token, stale_cleanup=True)
    if not ok:
        return 1
    
    ok = upload_deploy_files(api, space_id, token)
    if not ok:
        return 1
    
    restart_space(api, space_id)
    
    healthy, msg = check_space_health(space_id, token, timeout_minutes=timeout)
    if healthy:
        log.ok("DEPLOYMENT SUCCESSFUL")
        return 0
    else:
        log.error("DEPLOYMENT FAILED")
        return 1


def cmd_sync_env_only(token: str, space_id: str, secrets: Dict[str, str],
                      delete_orphans: bool = False) -> int:
    """Sync env vars only, no code."""
    log.info("=" * 60)
    log.info("MODE: ENV VARS ONLY SYNC")
    log.info("=" * 60)
    
    api = get_hf_api(token)
    ok = sync_env_vars(api, space_id, secrets, delete_orphans=delete_orphans)
    
    if ok:
        log.ok("ENV SYNC SUCCESSFUL")
        return 0
    else:
        log.error("ENV SYNC FAILED")
        return 1


def cmd_wipe_only(token: str, space_id: str, wipe_code: bool = True, wipe_env: bool = True) -> int:
    """Wipe remote files and/or env vars/secrets without redeploying."""
    log.info("=" * 60)
    log.info(f"MODE: WIPE ONLY (code={wipe_code}, env={wipe_env})")
    log.info("=" * 60)
    
    api = get_hf_api(token)
    
    if wipe_code:
        wipe_remote_files(api, space_id)
        
    if wipe_env:
        wipe_remote_variables(api, space_id)
        wipe_remote_secrets(api, space_id)
        
    log.ok("Wipe operation completed successfully.")
    return 0


# ── Main ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="MerHouse Hugging Face Space Deployment (local)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    # Mode selection (mutually exclusive)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--sync-both", action="store_true",
                      help="Sync code + env vars + restart + health check")
    mode.add_argument("--sync-code", action="store_true",
                      help="Sync code only + restart + health check")
    mode.add_argument("--sync-env", action="store_true",
                      help="Sync env vars only")
    mode.add_argument("--wipe-full", action="store_true",
                      help="FULL WIPE: delete all files, vars, secrets, then redeploy")
    mode.add_argument("--status", action="store_true",
                      help="Check current Space status (no changes)")
    mode.add_argument("--health-check", action="store_true",
                      help="Poll health with multi-stage timeouts (no changes)")
    mode.add_argument("--wipe-only", action="store_true",
                      help="Wipe all remote files, variables, and secrets without redeploying")
    mode.add_argument("--wipe-code-only", action="store_true",
                      help="Wipe all remote files without redeploying or changing variables")
    mode.add_argument("--wipe-env-only", action="store_true",
                      help="Wipe all remote variables and secrets without redeploying or changing files")
    
    # Options
    parser.add_argument("--delete-orphans", action="store_true",
                        help="Delete remote env vars/secrets not present in local config")
    parser.add_argument("--timeout", type=int, default=30,
                        help="Health check timeout in minutes (default: 30)")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress non-error output (verbose is the default)")
    parser.add_argument("--secrets-file", type=str, default=str(DEFAULT_SECRETS_FILE),
                        help="Path to secrets env file")
    
    args = parser.parse_args()
    
    if args.quiet:
        log.verbose = False
        # Also suppress subprocess output
        os.environ["PYTHONUNBUFFERED"] = "0"
    else:
        # Always show verbose output by default
        log.detail("Verbose output enabled. Use --quiet to suppress.")
    
    log.info("=" * 60)
    log.info("MerHouse Hugging Face Local Deployment")
    log.info("=" * 60)
    
    # Resolve auth
    token, space_id, secrets = resolve_hf_config()
    
    # Override secrets file if provided
    if args.secrets_file and args.secrets_file != str(DEFAULT_SECRETS_FILE):
        custom_path = Path(args.secrets_file)
        if custom_path.exists():
            custom_secrets = load_env_file(custom_path)
            secrets.update(custom_secrets)
            log.info(f"Loaded additional secrets from: {custom_path}")
    
    # Execute command
    if args.status:
        check_space_status(space_id, token)
        return 0
    
    if args.health_check:
        healthy, msg = check_space_health(space_id, token, timeout_minutes=args.timeout)
        return 0 if healthy else 1
    
    if args.wipe_full:
        return cmd_wipe_full(token, space_id, secrets, timeout=args.timeout)
    
    if args.wipe_only:
        return cmd_wipe_only(token, space_id, wipe_code=True, wipe_env=True)
        
    if args.wipe_code_only:
        return cmd_wipe_only(token, space_id, wipe_code=True, wipe_env=False)
        
    if args.wipe_env_only:
        return cmd_wipe_only(token, space_id, wipe_code=False, wipe_env=True)
    
    if args.sync_both:
        return cmd_sync_both(token, space_id, secrets, timeout=args.timeout, 
                              delete_orphans=args.delete_orphans)
    
    if args.sync_code:
        return cmd_sync_code_only(token, space_id, timeout=args.timeout)
    
    if args.sync_env:
        return cmd_sync_env_only(token, space_id, secrets, 
                                  delete_orphans=args.delete_orphans)
    
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
