#!/usr/bin/env python3
"""
MerHouse -- Hugging Face Space Sync & Reset Script

Usage:
    python sync-hf-space.py                         # Full sync: wipe remote, upload fresh, sync env vars
    python sync-hf-space.py --wipe                   # Full reset: wipe, upload, sync env, restart + wait
    python sync-hf-space.py --env-only               # Only sync environment variables
    python sync-hf-space.py --status                 # Check Space build status
    python sync-hf-space.py --health                 # Poll health endpoint until ready (exits 0/1)

Requires HF_TOKEN environment variable.
Optional: HF_SPACE_DB_URL, HF_SPACE_DB_USERNAME, HF_SPACE_DB_PASSWORD for env sync.
"""

import os
import sys
import time
import argparse
from pathlib import Path
from huggingface_hub import HfApi, upload_folder, upload_file, CommitOperationDelete

# -- Configuration --------------------------------------------------------
SPACE = os.environ.get("HF_SPACE_REPO_ID", "M7mdHBkr/merhouse-backend")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
if not HF_TOKEN:
    print("ERROR: HF_TOKEN environment variable is not set.", file=sys.stderr)
    print("Set it via: export HF_TOKEN='your_token'", file=sys.stderr)
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
DEPLOY_DIR = PROJECT_ROOT / "deploy" / "managed" / "huggingface-backend"

# -- Environment Variables (MUST be set via env vars for security) ---------
DB_URL = os.environ.get("HF_SPACE_DB_URL", "")
DB_USERNAME = os.environ.get("HF_SPACE_DB_USERNAME", "")
DB_PASSWORD = os.environ.get("HF_SPACE_DB_PASSWORD", "")
FIREBASE_SA_JSON = os.environ.get("HF_SPACE_FIREBASE_SA_JSON", "")

SPACE_VARIABLES = {
    "SPRING_DATASOURCE_USERNAME": DB_USERNAME,
    "SPRING_DATASOURCE_URL": DB_URL,
    "MERHOUSE_DEPLOYMENT_PUBLIC": "true",
    "MERHOUSE_PUBLIC_FRONTEND_URL": "https://merhouse-354e7.web.app",
    "MERHOUSE_CORS_ALLOWED_ORIGINS": "https://merhouse-354e7.web.app,capacitor://localhost,ionic://localhost",
    "MERHOUSE_AUTH_SEED_ADMIN_ENABLED": "false",
    "MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN": "false",
    "MERHOUSE_SWAGGER_ENABLED": "false",
    "FIREBASE_PROJECT_ID": "merhouse-354e7",
}

SPACE_SECRETS = {
    "SPRING_DATASOURCE_PASSWORD": DB_PASSWORD,
    "FIREBASE_SERVICE_ACCOUNT_JSON": FIREBASE_SA_JSON,
}

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


def upload_backend_source():
    """Upload backend source to the Space (no delete_patterns needed after wipe)."""
    upload_folder(
        repo_id=SPACE, repo_type="space",
        folder_path=str(BACKEND_DIR), path_in_repo="backend",
        token=HF_TOKEN,
        commit_message="Upload backend source",
        ignore_patterns=UPLOAD_IGNORE,
    )
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
    """Sync env vars to Space settings. Validates DB credentials before syncing."""
    missing = []
    if not DB_URL:
        missing.append("HF_SPACE_DB_URL")
    if not DB_USERNAME:
        missing.append("HF_SPACE_DB_USERNAME")
    if not DB_PASSWORD:
        missing.append("HF_SPACE_DB_PASSWORD")
    if missing:
        print(f"WARNING: Skipping env var sync. Missing: {', '.join(missing)}")
        print("  Set env vars or use --env-only with proper credentials.")
        return

    api_obj = api()

    # Variables -- use huggingface_hub library for reliable CRUD
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
        try:
            api_obj.add_space_variable(repo_id=SPACE, key=key, value=value)
            print(f"  Variable: {key}")
        except Exception as e:
            print(f"  Variable {key}: {e}")

    # Secrets -- use huggingface_hub library for reliable CRUD
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
            if runtime.stage == "RUNNING":
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


# -- Main ------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync/reset MerHouse Hugging Face Space")
    parser.add_argument("--wipe", action="store_true",
        help="Full reset: wipe, upload, sync env, restart, wait")
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
    elif args.env_only:
        sync_env_vars()
    elif args.wipe:
        cmd_full_sync(do_restart=True, do_wait=args.wait)
    else:
        cmd_full_sync(do_restart=False, do_wait=False)
