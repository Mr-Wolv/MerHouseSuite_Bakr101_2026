#!/usr/bin/env python3
"""
MerHouse — Hugging Face Space Sync & Reset Script

Usage:
    python sync-hf-space.py                         # Quick sync (stale cleanup + upload + env vars)
    python sync-hf-space.py --wipe                   # Full reset (pause, stale cleanup, upload, env vars, restart)
    python sync-hf-space.py --env-only               # Only sync environment variables
    python sync-hf-space.py --status                 # Check Space build status

Requires HF_TOKEN environment variable.
Optional: HF_SPACE_DB_URL, HF_SPACE_DB_USERNAME, HF_SPACE_DB_PASSWORD for env sync.
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from huggingface_hub import HfApi, upload_folder, upload_file

# ── Configuration ──────────────────────────────────────────────
SPACE = os.environ.get("HF_SPACE_REPO_ID", "M7mdHBkr/merhouse-backend")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
if not HF_TOKEN:
    print("ERROR: HF_TOKEN environment variable is not set.", file=sys.stderr)
    print("Set it via: export HF_TOKEN='your_token'", file=sys.stderr)
    sys.exit(1)

# Project root: script is at deploy/managed/huggingface-backend/sync-hf-space.py
# Need to go up 4 levels to reach project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
DEPLOY_DIR = PROJECT_ROOT / "deploy" / "managed" / "huggingface-backend"

# ── Environment Variables (MUST be set via env vars for security) ──
# These are read from environment variables to avoid leaking credentials in Git.
# Set them before running:
#   export HF_SPACE_DB_URL='jdbc:postgresql://...'
#   export HF_SPACE_DB_USERNAME='user'
#   export HF_SPACE_DB_PASSWORD='password'
# If not set, --env-only and --wipe will warn and skip credential sync.
DB_URL = os.environ.get("HF_SPACE_DB_URL", "")
DB_USERNAME = os.environ.get("HF_SPACE_DB_USERNAME", "")
DB_PASSWORD = os.environ.get("HF_SPACE_DB_PASSWORD", "")

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
}


# ── Stale files known to be removed from source but lingering on HF Space ──
STALE_FILES = [
    "backend/src/main/java/com/merhouse/config/MailConfig.java",
    "backend/src/main/java/com/merhouse/service/EmailDeliveryService.java",
    "backend/src/main/java/com/merhouse/service/SmtpHealthMonitor.java",
    "backend/src/main/java/com/merhouse/service/EmailDeliveryResult.java",
    "backend/src/main/java/com/merhouse/service/AssistantDraft.java",
    "backend/src/main/java/com/merhouse/service/AssistantRuntime.java",
    "backend/src/main/java/com/merhouse/service/AssistantRuntimeRequest.java",
    "backend/src/main/java/com/merhouse/service/AssistantService.java",
    "backend/src/main/java/com/merhouse/service/DeterministicAssistantRuntime.java",
    "backend/src/test/java/com/merhouse/service/EmailDeliveryServiceTest.java",
    "backend/src/test/java/com/merhouse/service/AssistantServiceTest.java",
    "backend/Dockerfile",
]


# ── Helpers ────────────────────────────────────────────────────
def api():
    return HfApi(token=HF_TOKEN)


def check_status():
    """Check and print current Space build status."""
    runtime = api().get_space_runtime(repo_id=SPACE)
    print(f"Stage:      {runtime.stage}")
    print(f"Hardware:   {runtime.hardware}")

    import requests as req
    try:
        resp = req.get(f"https://{SPACE.lower().replace('/', '-')}.hf.space/api/v1/health", timeout=10)
        print(f"Health:     HTTP {resp.status_code}")
        if resp.status_code == 200:
            print(f"Response:   {resp.text[:200]}")
    except Exception as e:
        print(f"Health:     {type(e).__name__}")


def delete_stale_files():
    """Delete specific known-stale files from the Space."""
    api_obj = api()
    deleted = 0
    for path_in_repo in STALE_FILES:
        try:
            api_obj.delete_file(
                repo_id=SPACE, repo_type="space",
                path_in_repo=path_in_repo,
                commit_message=f"Remove stale: {path_in_repo.split('/')[-1]}",
            )
            deleted += 1
            print(f"  Deleted: {path_in_repo}")
        except Exception:
            pass  # Already deleted or doesn't exist
    print(f"Stale files cleaned: {deleted} deleted.")
    return deleted


def upload_backend_source():
    """Upload the full backend source directory with delete_patterns to catch any other stale files."""
    upload_folder(
        repo_id=SPACE, repo_type="space",
        folder_path=str(BACKEND_DIR), path_in_repo="backend",
        token=HF_TOKEN,
        commit_message="Sync backend source",
        ignore_patterns=["target/**", ".gradle/**", "build/**", "*.log", "*.tmp", "backend-compose.Dockerfile"],
        delete_patterns=["backend/src/**"],
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
    """Sync environment variables and secrets to Space settings via raw REST API.
    Validates that required DB credentials are non-empty before syncing.
    """
    # Validate required credentials
    missing = []
    if not DB_URL:
        missing.append("HF_SPACE_DB_URL")
    if not DB_USERNAME:
        missing.append("HF_SPACE_DB_USERNAME")
    if not DB_PASSWORD:
        missing.append("HF_SPACE_DB_PASSWORD")
    if missing:
        print(f"WARNING: Skipping env var sync. Missing required env vars: {', '.join(missing)}")
        print("  Set them before running or use --env-only with proper credentials.")
        return

    headers = {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"}
    base = f"https://huggingface.co/api/spaces/{SPACE}"
    import requests

    # ── Variables ──
    try:
        resp = requests.get(f"{base}/variables", headers=headers, timeout=10)
        if resp.status_code == 200:
            existing = [v["key"] for v in resp.json()]
            for key in existing:
                requests.delete(f"{base}/variables/{key}", headers=headers, timeout=10)
            print(f"Cleared {len(existing)} existing variables.")
    except Exception as e:
        print(f"  Warning clearing variables: {e}")

    for key, value in SPACE_VARIABLES.items():
        try:
            resp = requests.post(f"{base}/variables", headers=headers,
                json={"key": key, "value": value}, timeout=10)
            if resp.status_code == 200:
                print(f"  Variable: {key}")
        except Exception as e:
            print(f"  Variable {key}: {e}")

    # ── Secrets ──
    try:
        resp = requests.get(f"{base}/secrets", headers=headers, timeout=10)
        if resp.status_code == 200:
            existing = [s["key"] for s in resp.json()]
            for key in existing:
                requests.delete(f"{base}/secrets/{key}", headers=headers, timeout=10)
            print(f"Cleared {len(existing)} existing secrets.")
    except Exception as e:
        print(f"  Warning clearing secrets: {e}")

    for key, value in SPACE_SECRETS.items():
        try:
            resp = requests.post(f"{base}/secrets", headers=headers,
                json={"key": key, "value": value}, timeout=10)
            if resp.status_code == 200:
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
    print("Space restarted — build initiated.")


def wait_for_space(timeout_minutes=30):
    """Poll the Space until the health endpoint responds 200."""
    import requests as req
    start = time.time()
    deadline = start + timeout_minutes * 60
    host = f"https://{SPACE.lower().replace('/', '-')}.hf.space"

    print(f"Waiting for Space ({host}) — timeout: {timeout_minutes}min")
    while time.time() < deadline:
        elapsed = int(time.time() - start)

        try:
            runtime = api().get_space_runtime(repo_id=SPACE)
            if runtime.stage == "RUNNING":
                try:
                    resp = req.get(f"{host}/api/v1/health", timeout=10)
                    if resp.status_code == 200:
                        print(f"\n✅ BACKEND IS UP after {elapsed}s!")
                        print(f"   Health: {resp.text[:200]}")
                        return True
                except Exception:
                    pass
            print(f"  [{elapsed}s] Stage={runtime.stage}, Hardware={runtime.hardware}")
        except Exception as e:
            print(f"  [{elapsed}s] Status check: {e}")

        time.sleep(30)

    print(f"\n❌ Timeout after {timeout_minutes} minutes.")
    return False


# ── Entry Points ──────────────────────────────────────────────
def cmd_wipe():
    """Full wipe: delete stale files, upload fresh, sync env, restart."""
    print("=== WIPE: Full Space reset ===")
    print("\n1) Deleting stale files...")
    delete_stale_files()

    print("\n2) Uploading backend source...")
    upload_backend_source()

    print("\n3) Uploading Dockerfile & README...")
    upload_dockerfile_and_readme()

    print("\n4) Syncing environment variables...")
    sync_env_vars()

    print("\n5) Restarting Space...")
    restart_space()
    print("\n✅ Wipe complete. Build initiated.")


def cmd_quick_sync():
    """Comprehensive sync: clean stale files, upload changes, sync env vars.
    Does NOT restart the Space — CI/CD handles restart separately."""
    print("=== Quick Sync ===")
    print("\n1) Cleaning stale files...")
    delete_stale_files()

    print("\n2) Uploading backend source...")
    upload_backend_source()

    print("\n3) Uploading Dockerfile & README...")
    upload_dockerfile_and_readme()

    print("\n4) Syncing environment variables...")
    sync_env_vars()

    print("\n✅ Quick sync complete.")


# ── Main ───────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sync/reset MerHouse Hugging Face Space"
    )
    parser.add_argument("--wipe", action="store_true",
        help="Full wipe: clean, upload, sync env, restart")
    parser.add_argument("--env-only", action="store_true",
        help="Only sync environment variables")
    parser.add_argument("--status", action="store_true",
        help="Check Space build status")
    parser.add_argument("--wait", action="store_true",
        help="Wait for Space to become ready after sync")
    args = parser.parse_args()

    if args.status:
        check_status()
    elif args.env_only:
        sync_env_vars()
    elif args.wipe:
        cmd_wipe()
        if args.wait:
            wait_for_space()
    else:
        cmd_quick_sync()
