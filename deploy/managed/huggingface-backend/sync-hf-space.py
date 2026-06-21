#!/usr/bin/env python3
"""
MerHouse -- Hugging Face Space Sync & Reset Script

Usage:
    python sync-hf-space.py                         # Full sync: wipe remote, upload fresh, sync env vars
    python sync-hf-space.py --wipe                   # Full reset: wipe, upload, sync env, restart + wait
    python sync-hf-space.py --upload-only            # Quick sync: upload changed files, stale cleanup, no wipe
    python sync-hf-space.py --env-only               # Only sync environment variables
    python sync-hf-space.py --status                 # Check Space build status
    python sync-hf-space.py --health                 # Poll health endpoint until ready (exits 0/1)

Secrets source: .secrets/deploy/managed/huggingface.env (single source of truth).
No env var overrides. In CI/CD, write a temporary .secrets file."""

import os
import sys
import time
import argparse
from pathlib import Path
from huggingface_hub import HfApi, upload_folder, upload_file, CommitOperationDelete

# -- Paths -----------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
SECRETS_FILE = PROJECT_ROOT / ".secrets" / "deploy" / "managed" / "huggingface.env"
BACKEND_DIR = PROJECT_ROOT / "backend"
DEPLOY_DIR = PROJECT_ROOT / "deploy" / "managed" / "huggingface-backend"


# -- Secret Loader ---------------------------------------------------------
def load_env_file(filepath: Path) -> dict:
    """Parse a .env file and return key-value pairs."""
    values = {}
    if not filepath.exists():
        return values
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key:
                    values[key] = val
    return values


def load_secrets() -> dict:
    """Load secrets ONLY from .secrets file. No env var overrides.

    The .secrets file is the single source of truth. If you need to
    inject values in CI/CD, write a temporary .secrets file.
    """
    secrets = load_env_file(SECRETS_FILE)
    if not secrets:
        print(f"  [WARN] No secrets found in {SECRETS_FILE}")
    return secrets


# -- Configuration (loaded from secrets + env) -----------------------------
SECRETS = load_secrets()

SPACE = SECRETS.get("HF_SPACE_REPO_ID", "M7mdHBkr/merhouse-backend")
HF_TOKEN = SECRETS.get("HF_TOKEN", "")
if not HF_TOKEN:
    print("ERROR: HF_TOKEN not found in .secrets/deploy/managed/huggingface.env", file=sys.stderr)
    print("       Ensure this file exists with HF_TOKEN=<your-token>", file=sys.stderr)
    sys.exit(1)

SPACE_VARIABLES = {
    "SPRING_DATASOURCE_URL": SECRETS.get("SPRING_DATASOURCE_URL", ""),
    "SPRING_DATASOURCE_USERNAME": SECRETS.get("SPRING_DATASOURCE_USERNAME", ""),
    "MERHOUSE_DEPLOYMENT_PUBLIC": SECRETS.get("MERHOUSE_DEPLOYMENT_PUBLIC", "true"),
    "MERHOUSE_PUBLIC_FRONTEND_URL": SECRETS.get("MERHOUSE_PUBLIC_FRONTEND_URL", "https://merhouse-354e7.web.app"),
    "MERHOUSE_CORS_ALLOWED_ORIGINS": SECRETS.get("MERHOUSE_CORS_ALLOWED_ORIGINS", "https://merhouse-354e7.web.app,capacitor://localhost,ionic://localhost"),
    "MERHOUSE_AUTH_SEED_ADMIN_ENABLED": SECRETS.get("MERHOUSE_AUTH_SEED_ADMIN_ENABLED", "false"),
    "MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN": SECRETS.get("MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN", "false"),
    "MERHOUSE_SWAGGER_ENABLED": SECRETS.get("MERHOUSE_SWAGGER_ENABLED", "false"),
    "FIREBASE_PROJECT_ID": SECRETS.get("FIREBASE_PROJECT_ID", "merhouse-354e7"),
}

SPACE_SECRETS = {
    "SPRING_DATASOURCE_PASSWORD": SECRETS.get("SPRING_DATASOURCE_PASSWORD", ""),
    "FIREBASE_SERVICE_ACCOUNT_JSON": SECRETS.get("FIREBASE_SERVICE_ACCOUNT_JSON", ""),
}

STALE_CLEANUP_PATTERNS = [
    "backend/src/**",
]

UPLOAD_IGNORE = [
    "target/**", ".gradle/**", "build/**",
    "*.log", "*.tmp", "backend-compose.Dockerfile",
    ".gitignore", ".gitattributes",
]


# -- Helpers ---------------------------------------------------------------
def api():
    return HfApi(token=HF_TOKEN)


def check_status():
    """Check and print current Space build status."""
    runtime = api().get_space_runtime(repo_id=SPACE)
    print(f"Stage:      {runtime.stage}")
    print(f"Hardware:   {runtime.hardware}")

    import requests as req
    host = f"https://{SPACE.lower().replace('/', '-')}.hf.space"
    try:
        resp = req.get(f"{host}/api/v1/health", timeout=10)
        print(f"Health:     HTTP {resp.status_code}")
        if resp.status_code == 200:
            print(f"Response:   {resp.text[:200]}")
    except Exception as e:
        print(f"Health:     {type(e).__name__}")


def wipe_remote():
    """Delete ALL files from the Space repo to guarantee a clean slate.

    This is the nuclear option: after this, the Space repo is empty.
    We then upload fresh source, which means there is zero chance of
    stale files (like removed classes) surviving the sync.
    """
    api_obj = api()
    try:
        files = api_obj.list_repo_files(repo_id=SPACE, repo_type="space")
    except Exception as e:
        print(f"  Could not list remote files: {e}")
        return 0

    if not files:
        print("  Remote repo is already empty.")
        return 0

    # Build batch delete operations (max ~500 per commit to stay under limits)
    BATCH = 500
    total = 0
    for i in range(0, len(files), BATCH):
        batch = files[i:i + BATCH]
        ops = [CommitOperationDelete(path_in_repo=f) for f in batch]
        try:
            api_obj.create_commit(
                repo_id=SPACE,
                repo_type="space",
                operations=ops,
                commit_message=f"Wipe batch {i // BATCH + 1}: {len(ops)} files",
            )
            total += len(ops)
            print(f"  Deleted batch {i // BATCH + 1}: {len(ops)} files")
        except Exception as e:
            print(f"  Warning batch {i // BATCH + 1}: {e}")

    print(f"  Total wiped: {total} files.")
    return total


def upload_backend_source(stale_cleanup=False):
    """Upload backend source to the Space.

    Args:
        stale_cleanup: If True, use delete_patterns to remove stale files
                       from the remote that don't exist locally.
                       Skips full wipe but still cleans up.
    """
    kwargs = dict(
        repo_id=SPACE, repo_type="space",
        folder_path=str(BACKEND_DIR), path_in_repo="backend",
        token=HF_TOKEN,
        commit_message="Upload backend source",
        ignore_patterns=UPLOAD_IGNORE,
    )
    if stale_cleanup:
        kwargs["delete_patterns"] = STALE_CLEANUP_PATTERNS
    upload_folder(**kwargs)
    print("Backend source uploaded.")


def upload_dockerfile_and_readme():
    """Upload Dockerfile and README to Space root."""
    upload_file(repo_id=SPACE, repo_type="space",
        path_or_fileobj=str(DEPLOY_DIR / "Dockerfile"),
        path_in_repo="Dockerfile", token=HF_TOKEN)
    print("Dockerfile uploaded.")

    upload_file(repo_id=SPACE, repo_type="space",
        path_or_fileobj=str(DEPLOY_DIR / "space-readme-template.md"),
        path_in_repo="README.md", token=HF_TOKEN)
    print("README uploaded.")


def sync_env_vars():
    """Sync env vars to Space settings. Loads from .secrets file and env vars."""
    api_obj = api()

    # Log any empty values but proceed anyway (secrets like DB password may be set directly on HF)
    empty_vars = [k for k, v in SPACE_VARIABLES.items() if not v]
    empty_sec = [k for k, v in SPACE_SECRETS.items() if not v]
    if empty_vars:
        print(f"  Warning: empty variables: {', '.join(empty_vars)}")
    if empty_sec:
        print(f"  Warning: empty secrets: {', '.join(empty_sec)}")

    # Variables
    try:
        existing = api_obj.get_space_variables(repo_id=SPACE)
        for key in list(existing.keys()):
            try:
                api_obj.delete_space_variable(repo_id=SPACE, key=key)
            except Exception:
                pass
        print(f"Cleared {len(existing)} existing variables.")
    except Exception as e:
        print(f"  Warning clearing variables: {e}")

    for key, value in SPACE_VARIABLES.items():
        if not value:
            print(f"  Skipping {key} (empty)")
            continue
        try:
            api_obj.add_space_variable(repo_id=SPACE, key=key, value=value)
            print(f"  Variable: {key}")
        except Exception as e:
            print(f"  Variable {key}: {e}")

    # Secrets
    try:
        existing = api_obj.get_space_secrets(repo_id=SPACE)
        for key in list(existing.keys()):
            try:
                api_obj.delete_space_secret(repo_id=SPACE, key=key)
            except Exception:
                pass
        print(f"Cleared {len(existing)} existing secrets.")
    except Exception as e:
        print(f"  Warning clearing secrets: {e}")

    for key, value in SPACE_SECRETS.items():
        if not value:
            print(f"  Skipping {key} (empty)")
            continue
        try:
            api_obj.add_space_secret(repo_id=SPACE, key=key, value=value)
            print(f"  Secret: {key}")
        except Exception as e:
            print(f"  Secret {key}: {e}")

    print("Environment sync complete.")


def restart_space():
    """Pause then restart the Space to trigger a fresh build."""
    try:
        api().pause_space(repo_id=SPACE)
        print("Space paused.")
        time.sleep(2)
    except Exception as e:
        print(f"  Pause: {e} (continuing)")

    api().restart_space(repo_id=SPACE)
    print("Space restarted -- build initiated.")


def wait_for_space(timeout_minutes=30):
    """Poll the Space until the health endpoint responds 200."""
    import requests as req
    start = time.time()
    deadline = start + timeout_minutes * 60
    host = f"https://{SPACE.lower().replace('/', '-')}.hf.space"

    print(f"Waiting for Space ({host}) -- timeout: {timeout_minutes}min")
    while time.time() < deadline:
        elapsed = int(time.time() - start)

        try:
            runtime = api().get_space_runtime(repo_id=SPACE)
            # Always try health check regardless of stage -- HF sometimes
            # reports APP_STARTING while the app is already responding.
            try:
                resp = req.get(f"{host}/api/v1/health", timeout=10)
                if resp.status_code == 200:
                    print(f"\n[OK] BACKEND IS UP after {elapsed}s!")
                    print(f"     Health: {resp.text[:200]}")
                    return True
            except Exception:
                pass
            print(f"  [{elapsed}s] Stage={runtime.stage}, Hardware={runtime.hardware}")
        except Exception as e:
            print(f"  [{elapsed}s] Status check: {e}")

        time.sleep(30)

    print(f"\n[FAIL] Timeout after {timeout_minutes} minutes.")
    return False


# -- Entry Points ----------------------------------------------------------
def cmd_full_sync(do_restart=False, do_wait=False):
    """Full sync: wipe remote, upload fresh source, sync env vars.
    Optionally restart and wait for health.
    """
    print("=== Full Sync: wipe + upload + env ===")
    print("\n1) Wiping remote repo...")
    wipe_remote()
    print("\n2) Uploading backend source...")
    upload_backend_source()
    print("\n3) Uploading Dockerfile and README...")
    upload_dockerfile_and_readme()
    print("\n4) Syncing environment variables...")
    sync_env_vars()
    if do_restart:
        print("\n5) Restarting Space...")
        restart_space()
        if do_wait:
            wait_for_space()
    print("\n[OK] Full sync complete.")


def cmd_upload_only():
    """Quick sync: upload changed files only, no wipe.

    Uses delete_patterns to clean stale files that exist
    remotely but not locally -- non-destructive, fast.
    Skips env var sync (handled separately by sync-secrets.py).
    """
    print("=== Quick Sync: upload only (no wipe) ===")
    print("\n1) Uploading backend source with stale cleanup...")
    upload_backend_source(stale_cleanup=True)
    print("\n2) Uploading Dockerfile and README...")
    upload_dockerfile_and_readme()
    print("\n[OK] Quick sync complete. Restart the Space to apply.")


# -- Main ------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync/reset MerHouse Hugging Face Space")
    parser.add_argument("--wipe", action="store_true",
        help="Full reset: wipe, upload, sync env, restart, wait")
    parser.add_argument("--upload-only", action="store_true",
        help="Quick sync: upload changed files + stale cleanup, no wipe, no env sync")
    parser.add_argument("--quick-sync", action="store_true",
        help="Alias for --upload-only")
    parser.add_argument("--env-only", action="store_true",
        help="Only sync environment variables")
    parser.add_argument("--status", action="store_true",
        help="Check Space build status")
    parser.add_argument("--health", action="store_true",
        help="Poll health endpoint until ready (exits 0/1)")
    parser.add_argument("--timeout", type=int, default=30,
        help="Timeout in minutes for --health/--wait (default: 30)")
    parser.add_argument("--wait", action="store_true",
        help="Wait for Space to become ready after sync")
    args = parser.parse_args()

    if args.status:
        check_status()
    elif args.health:
        ok = wait_for_space(timeout_minutes=args.timeout)
        sys.exit(0 if ok else 1)
    elif args.upload_only or args.quick_sync:
        cmd_upload_only()
    elif args.env_only:
        sync_env_vars()
    elif args.wipe:
        cmd_full_sync(do_restart=True, do_wait=args.wait)
    else:
        cmd_full_sync(do_restart=False, do_wait=False)
