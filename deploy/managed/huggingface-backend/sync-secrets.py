#!/usr/bin/env python3
"""
MerHouse -- Secrets Sync: local .secrets/ -> Hugging Face Space + GitHub Secrets

Usage:
    python sync-secrets.py                          # Sync to both HF Space and GitHub Secrets
    python sync-secrets.py --hf-only                # Sync only to Hugging Face Space
    python sync-secrets.py --github-only            # Sync only to GitHub Secrets (requires gh CLI)
    python sync-secrets.py --validate               # Validate all secrets are present without syncing
    python sync-secrets.py --show-config            # Show what would be synced (redacts secrets)

Source of truth: .secrets/deploy/managed/huggingface.env
Or fallback: individual env vars (HF_TOKEN, HF_SPACE_DB_URL, etc.)

Secret categorization:
  - SECRETS (sensitive, hidden in UI): SPRING_DATASOURCE_PASSWORD, HF_TOKEN, FIREBASE_SERVICE_ACCOUNT_JSON
  - VARIABLES (visible app config): URLs, usernames, project IDs, feature flags

Requirements:
  - HF_TOKEN env var (for Hugging Face API auth)
  - gh CLI installed and authenticated (for GitHub Secrets sync)
  - huggingface_hub and requests packages
"""

import os
import sys
import argparse
import subprocess
from pathlib import Path
from huggingface_hub import HfApi

# -- Paths -----------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
SECRETS_FILE = PROJECT_ROOT / ".secrets" / "deploy" / "managed" / "huggingface.env"

# -- Categorization --------------------------------------------------------
# Keys that MUST be stored as Secrets (hidden in HF Space UI)
SECRET_KEYS = {
    "SPRING_DATASOURCE_PASSWORD",
    "HF_TOKEN",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
}

# Env var name (from .secrets file) -> GitHub secret name
ENV_TO_GITHUB_SECRET = {
    "HF_TOKEN": "HF_SPACE_TOKEN",
    "SPRING_DATASOURCE_URL": "HF_SPACE_DB_URL",
    "SPRING_DATASOURCE_USERNAME": "HF_SPACE_DB_USERNAME",
    "SPRING_DATASOURCE_PASSWORD": "HF_SPACE_DB_PASSWORD",
    "FIREBASE_SERVICE_ACCOUNT_JSON": "FIREBASE_SERVICE_ACCOUNT_JSON",
}

# GitHub repository
GITHUB_REPO = os.environ.get("GITHUB_REPOSITORY", "Mr-Wolv/MerHouseSuite_Bakr101_2026")


# -- Helpers ---------------------------------------------------------------
def msg(text):
    """Print with explicit UTF-8 encoding to avoid UnicodeEncodeError on Windows."""
    try:
        print(text)
    except UnicodeEncodeError:
        # Fall back to ASCII-safe output
        safe = text.encode("ascii", errors="replace").decode("ascii")
        print(safe)


# -- Secret Loader ---------------------------------------------------------
def load_from_env_file(filepath: Path) -> dict:
    """Parse a .env file and return a dict of key-value pairs."""
    if not filepath.exists():
        msg(f"  [INFO] Secrets file not found: {filepath}")
        return {}
    values = {}
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
    """
    Load secrets from the .secrets env file.
    Falls back to individual environment variables.
    Returns a dict of all resolved key-value pairs.
    """
    secrets = {}

    # First, try the .secrets file
    file_values = load_from_env_file(SECRETS_FILE)
    if file_values:
        msg(f"  Source: {SECRETS_FILE}")
        secrets.update(file_values)

    # Environment variables override file values (for CI/CD)
    env_override_keys = [
        "HF_TOKEN",
        "HF_SPACE_REPO_ID",
        "HF_SPACE_DB_URL",
        "HF_SPACE_DB_USERNAME",
        "HF_SPACE_DB_PASSWORD",
        "HF_SPACE_FIREBASE_SA_JSON",
        "SPRING_DATASOURCE_URL",
        "SPRING_DATASOURCE_USERNAME",
        "SPRING_DATASOURCE_PASSWORD",
        "FIREBASE_SERVICE_ACCOUNT_JSON",
        "FIREBASE_PROJECT_ID",
        "MERHOUSE_PUBLIC_FRONTEND_URL",
        "MERHOUSE_CORS_ALLOWED_ORIGINS",
        "MERHOUSE_DEPLOYMENT_PUBLIC",
        "MERHOUSE_AUTH_SEED_ADMIN_ENABLED",
        "MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN",
        "MERHOUSE_SWAGGER_ENABLED",
    ]

    for key in env_override_keys:
        val = os.environ.get(key)
        if val:
            # Map CI/CD env var names to application-level env var names
            mapped_key = key
            if key == "HF_SPACE_DB_URL":
                mapped_key = "SPRING_DATASOURCE_URL"
            elif key == "HF_SPACE_DB_USERNAME":
                mapped_key = "SPRING_DATASOURCE_USERNAME"
            elif key == "HF_SPACE_DB_PASSWORD":
                mapped_key = "SPRING_DATASOURCE_PASSWORD"
            elif key == "HF_SPACE_FIREBASE_SA_JSON":
                mapped_key = "FIREBASE_SERVICE_ACCOUNT_JSON"
            secrets[mapped_key] = val

    return secrets


# -- Hugging Face Space Sync -----------------------------------------------
def get_hf_config(secrets: dict) -> tuple:
    """Extract HF configuration from secrets dict."""
    hf_token = secrets.get("HF_TOKEN") or os.environ.get("HF_TOKEN", "")
    space_id = secrets.get("HF_SPACE_REPO_ID", "M7mdHBkr/merhouse-backend")
    return hf_token, space_id


def sync_hf_space(secrets: dict, dry_run: bool = False) -> bool:
    """Sync env vars to Hugging Face Space with proper categorization."""
    hf_token, space_id = get_hf_config(secrets)
    errors: list[str] = []

    if not hf_token:
        msg("  [ERROR] HF_TOKEN not available - cannot sync to Hugging Face Space.")
        return False

    msg(f"\n  Hugging Face Space: {space_id}")

    # Variables (non-sensitive app config) - keep only what we manage
    space_variables = {
        "SPRING_DATASOURCE_URL": secrets.get("SPRING_DATASOURCE_URL", ""),
        "SPRING_DATASOURCE_USERNAME": secrets.get("SPRING_DATASOURCE_USERNAME", ""),
        "MERHOUSE_DEPLOYMENT_PUBLIC": secrets.get("MERHOUSE_DEPLOYMENT_PUBLIC", "true"),
        "MERHOUSE_PUBLIC_FRONTEND_URL": secrets.get("MERHOUSE_PUBLIC_FRONTEND_URL", "https://merhouse-354e7.web.app"),
        "MERHOUSE_CORS_ALLOWED_ORIGINS": secrets.get("MERHOUSE_CORS_ALLOWED_ORIGINS", "https://merhouse-354e7.web.app,capacitor://localhost,ionic://localhost"),
        "MERHOUSE_AUTH_SEED_ADMIN_ENABLED": secrets.get("MERHOUSE_AUTH_SEED_ADMIN_ENABLED", "false"),
        "MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN": secrets.get("MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN", "false"),
        "MERHOUSE_SWAGGER_ENABLED": secrets.get("MERHOUSE_SWAGGER_ENABLED", "false"),
        "FIREBASE_PROJECT_ID": secrets.get("FIREBASE_PROJECT_ID", "merhouse-354e7"),
    }

    # Secrets (sensitive, hidden in UI)
    space_secrets = {
        "SPRING_DATASOURCE_PASSWORD": secrets.get("SPRING_DATASOURCE_PASSWORD", ""),
        "FIREBASE_SERVICE_ACCOUNT_JSON": secrets.get("FIREBASE_SERVICE_ACCOUNT_JSON", ""),
    }

    if dry_run:
        msg("  [DRY RUN] Would sync:")
        msg("    Variables:")
        for k, v in space_variables.items():
            display = v[:50] + "..." if len(v) > 50 else v
            msg(f"      {k}={display}")
        msg("    Secrets (hidden):")
        for k in space_secrets:
            has_val = "[SET]" if space_secrets.get(k) else "[MISSING]"
            msg(f"      {k} {has_val}")
        return not errors

    api = HfApi(token=hf_token)

    # -- Sync Variables --
    msg("  Variables:")
    try:
        existing_vars = api.get_space_variables(repo_id=space_id)
        for key in list(existing_vars.keys()):
            if key not in space_variables or key in SECRET_KEYS:
                try:
                    api.delete_space_variable(repo_id=space_id, key=key)
                    msg(f"    Removed variable: {key}")
                except Exception as e:
                    errors.append(f"remove variable {key}: {e}")
                    msg(f"    [ERR] remove variable {key}: {e}")
    except Exception as e:
        errors.append(f"list variables: {e}")
        msg(f"    [ERR] listing variables: {e}")

    for key, value in space_variables.items():
        if not value:
            errors.append(f"empty variable {key}")
            msg(f"    [ERR] {key}: empty value")
            continue
        try:
            api.add_space_variable(repo_id=space_id, key=key, value=value)
            msg(f"    [OK] {key}")
        except Exception as e:
            errors.append(f"set variable {key}: {e}")
            msg(f"    [ERR] {key}: {e}")

    # -- Sync Secrets --
    msg("  Secrets:")
    try:
        existing_secrets = api.get_space_secrets(repo_id=space_id)
        for key in list(existing_secrets.keys()):
            if key not in space_secrets:
                try:
                    api.delete_space_secret(repo_id=space_id, key=key)
                    msg(f"    Removed secret: {key}")
                except Exception as e:
                    errors.append(f"remove secret {key}: {e}")
                    msg(f"    [ERR] remove secret {key}: {e}")
    except Exception as e:
        errors.append(f"list secrets: {e}")
        msg(f"    [ERR] listing secrets: {e}")

    for key, value in space_secrets.items():
        if not value:
            errors.append(f"empty secret {key}")
            msg(f"    [ERR] {key}: empty value")
            continue
        try:
            api.add_space_secret(repo_id=space_id, key=key, value=value)
            msg(f"    [OK] {key}")
        except Exception as e:
            errors.append(f"set secret {key}: {e}")
            msg(f"    [ERR] {key}: {e}")

    if errors:
        msg(f"  [ERROR] Hugging Face Space sync failed with {len(errors)} error(s).")
        return False

    msg("  [OK] Hugging Face Space env vars synced.")
    return True


# -- GitHub Secrets Sync ----------------------------------------------------
def sync_github_secrets(secrets: dict, dry_run: bool = False, repo: str = GITHUB_REPO) -> bool:
    """Sync secrets to GitHub repository secrets using gh CLI."""
    errors: list[str] = []

    try:
        subprocess.run(["gh", "--version"], capture_output=True, check=True)
    except (subprocess.FileNotFoundError, subprocess.CalledProcessError):
        msg("  [ERROR] gh CLI not available - cannot sync to GitHub Secrets.")
        return False

    try:
        result = subprocess.run(
            ["gh", "auth", "status"],
            capture_output=True, text=True, check=False
        )
        if result.returncode != 0:
            msg("  [ERROR] gh CLI not authenticated. Run: gh auth login")
            return False
    except Exception as e:
        msg(f"  [ERROR] gh CLI check failed: {e}")
        return False

    msg(f"  GitHub repository: {repo}")

    for env_key, gh_secret_name in ENV_TO_GITHUB_SECRET.items():
        value = secrets.get(env_key, "")

        # Also check CI/CD env var names
        if not value:
            alt_map = {
                "HF_TOKEN": "HF_TOKEN",
                "SPRING_DATASOURCE_URL": "HF_SPACE_DB_URL",
                "SPRING_DATASOURCE_USERNAME": "HF_SPACE_DB_USERNAME",
                "SPRING_DATASOURCE_PASSWORD": "HF_SPACE_DB_PASSWORD",
                "FIREBASE_SERVICE_ACCOUNT_JSON": "HF_SPACE_FIREBASE_SA_JSON",
            }
            alt_key = alt_map.get(env_key)
            if alt_key:
                value = secrets.get(alt_key, "")

        if not value:
            errors.append(f"no value available for {gh_secret_name}")
            msg(f"    [ERR] {gh_secret_name}: no value available for {env_key}")
            continue

        if dry_run:
            msg(f"    [DRY RUN] Would set {gh_secret_name}")
            continue

        try:
            result = subprocess.run(
                ["gh", "secret", "set", gh_secret_name, "--repo", repo, "--body", value],
                capture_output=True, text=True, check=False
            )
            if result.returncode == 0:
                msg(f"    [OK] {gh_secret_name}")
            else:
                errors.append(f"set {gh_secret_name}: {result.stderr.strip()}")
                msg(f"    [ERR] {gh_secret_name}: {result.stderr.strip()}")
        except Exception as e:
            errors.append(f"set {gh_secret_name}: {e}")
            msg(f"    [ERR] {gh_secret_name}: {e}")

    if errors:
        msg(f"  [ERROR] GitHub Secrets sync failed with {len(errors)} error(s).")
        return False

    msg("  [OK] GitHub Secrets synced.")
    return True


# -- Validation -------------------------------------------------------------
def validate_secrets(secrets: dict, require_hf_token: bool = True) -> bool:
    """Validate that all required secrets are available."""
    required = [
        ("SPRING_DATASOURCE_URL", "Database JDBC URL"),
        ("SPRING_DATASOURCE_USERNAME", "Database username"),
        ("SPRING_DATASOURCE_PASSWORD", "Database password"),
        ("FIREBASE_SERVICE_ACCOUNT_JSON", "Firebase Admin SDK service account JSON"),
        ("FIREBASE_PROJECT_ID", "Firebase project ID"),
        ("MERHOUSE_PUBLIC_FRONTEND_URL", "Public frontend URL"),
        ("MERHOUSE_CORS_ALLOWED_ORIGINS", "CORS allowed origins"),
    ]
    if require_hf_token:
        required.insert(0, ("HF_TOKEN", "HF Token for Hugging Face API"))

    all_ok = True
    for key, description in required:
        value = secrets.get(key, "")
        if not value:
            alt_map = {
                "HF_TOKEN": "HF_TOKEN",
                "SPRING_DATASOURCE_URL": "HF_SPACE_DB_URL",
                "SPRING_DATASOURCE_USERNAME": "HF_SPACE_DB_USERNAME",
                "SPRING_DATASOURCE_PASSWORD": "HF_SPACE_DB_PASSWORD",
            }
            alt_key = alt_map.get(key)
            if alt_key:
                value = os.environ.get(alt_key, "")
            elif key == "FIREBASE_SERVICE_ACCOUNT_JSON":
                value = os.environ.get("HF_SPACE_FIREBASE_SA_JSON", "")

        if value:
            display = value[:50] + "..." if len(value) > 50 else value
            msg(f"  [OK] {key:45s} ({description})")
        else:
            msg(f"  [MISSING] {key:45s} ({description})")
            all_ok = False

    msg("")
    if all_ok:
        msg("  [OK] All required secrets are present.")
    else:
        msg("  [WARN] Some required secrets are missing.")
    return all_ok


def show_config(secrets: dict):
    """Display what would be synced (redacts sensitive values)."""
    msg("\n  === Configuration to sync ===\n")
    msg("  Hugging Face Space Variables (visible):")
    for key, val in sorted(secrets.items()):
        if key in SECRET_KEYS:
            continue
        display = val[:60] + "..." if len(val) > 60 else val
        msg(f"    {key:45s} = {display}")

    msg("\n  Hugging Face Space Secrets (hidden):")
    for key in sorted(SECRET_KEYS):
        val = secrets.get(key, "")
        status = "[SET]" if val else "[MISSING]"
        msg(f"    {key:45s} {status}")

    msg("\n  GitHub Secrets to sync:")
    for env_key, gh_name in sorted(ENV_TO_GITHUB_SECRET.items()):
        val = secrets.get(env_key, "")
        status = "[SET]" if val else "[MISSING]"
        msg(f"    {gh_name:40s} <- {env_key}  ({status})")


# -- Main -------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Sync .secrets/ to Hugging Face Space + GitHub Secrets"
    )
    parser.add_argument("--hf-only", action="store_true",
                        help="Sync only to Hugging Face Space")
    parser.add_argument("--github-only", action="store_true",
                        help="Sync only to GitHub Secrets")
    parser.add_argument("--validate", action="store_true",
                        help="Validate secrets without syncing")
    parser.add_argument("--show-config", action="store_true",
                        help="Show configuration without syncing")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be done without making changes")
    parser.add_argument("--quiet", "-q", action="store_true",
                        help="Suppress non-error output")
    args = parser.parse_args()

    # Suppress banner in quiet mode
    if not args.quiet:
        msg("\n  === Syncing MerHouse Deployment Secrets ===\n")

    # Load secrets
    secrets = load_secrets()

    if not secrets:
        msg("[ERROR] No secrets found. Create .secrets/deploy/managed/huggingface.env")
        msg("         or set the required environment variables.")
        sys.exit(1)

    # Show config
    if args.show_config:
        show_config(secrets)
        return

    # Validate
    if args.validate:
        msg("  Validating secrets...\n")
        ok = validate_secrets(secrets)
        sys.exit(0 if ok else 1)

    # Sync modes
    sync_hf = args.hf_only or (not args.github_only)
    sync_gh = args.github_only or (not args.hf_only)
    require_hf_token = args.validate or sync_hf

    # Always validate first
    if not args.quiet:
        msg("  Validating secrets...\n")
    ok = validate_secrets(secrets, require_hf_token=require_hf_token)
    if not ok:
        if args.dry_run:
            msg("  [WARN] Dry run completed with missing secrets.\n")
        else:
            msg("  [ERROR] Required secrets are missing. Refusing to sync.\n")
            sys.exit(1)

    if sync_hf:
        msg("  -- Syncing to Hugging Face Space --")
        if not sync_hf_space(secrets, dry_run=args.dry_run):
            sys.exit(1)

    if sync_gh:
        msg("\n  -- Syncing to GitHub Secrets --")
        if not sync_github_secrets(secrets, dry_run=args.dry_run):
            sys.exit(1)

    msg("\n  === Done ===")


if __name__ == "__main__":
    main()
