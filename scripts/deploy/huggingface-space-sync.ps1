param(
    [string]$EnvFile = ".secrets/deploy/managed/huggingface.env",
    [string]$CheckoutPath = "",
    [string]$PythonPath = "python",
    [switch]$ConfirmUpload,
    [switch]$PushEnv
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$envPath = Resolve-MerHousePath -Path $EnvFile -ProjectRoot $projectRoot

if (-not (Test-Path $envPath)) {
    throw "Deployment env file was not found: $envPath"
}

function Read-EnvFile {
    param([string]$Path)

    $values = @{}
    $lineNumber = 0
    foreach ($line in Get-Content -LiteralPath $Path) {
        $lineNumber += 1
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }
        if ($trimmed -notmatch '^[A-Za-z_][A-Za-z0-9_]*=') {
            throw "Invalid env assignment at $Path line ${lineNumber}."
        }
        $parts = $trimmed -split "=", 2
        $values[$parts[0]] = $parts[1].Trim().Trim('"').Trim("'")
    }
    return $values
}

$values = Read-EnvFile -Path $envPath
foreach ($required in @("HF_SPACE_REPO_ID", "HF_TOKEN")) {
    if (-not $values.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($values[$required])) {
        throw "$required must be present in the private env file."
    }
}
$spaceRepoId = $values["HF_SPACE_REPO_ID"]

git -C $projectRoot check-ignore -q -- ($envPath.Substring($projectRoot.Length).TrimStart("\", "/")) 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "The supplied env file must be ignored by Git before it can be used for Space sync."
}
$global:LASTEXITCODE = 0

if ([string]::IsNullOrWhiteSpace($CheckoutPath)) {
    $CheckoutPath = Join-Path $env:TEMP "merhouse-hf-space"
}
$checkoutFullPath = [System.IO.Path]::GetFullPath($CheckoutPath)
$backendSource = Join-Path $projectRoot "backend"
$spaceReadme = Join-Path $projectRoot "deploy\managed\huggingface-backend\space-readme-template.md"
$spaceDockerfile = Join-Path $projectRoot "deploy\managed\huggingface-backend\Dockerfile"

$protectedPaths = @(
    $projectRoot,
    $backendSource,
    (Join-Path $projectRoot "deploy"),
    (Join-Path $projectRoot "scripts"),
    ([System.IO.Path]::GetPathRoot($projectRoot))
) | ForEach-Object { [System.IO.Path]::GetFullPath($_).TrimEnd("\", "/") }
$normalizedCheckoutPath = $checkoutFullPath.TrimEnd("\", "/")
if ($protectedPaths -contains $normalizedCheckoutPath) {
    throw "CheckoutPath points at a protected project path and cannot be removed: $checkoutFullPath"
}
if ([string]::IsNullOrWhiteSpace($normalizedCheckoutPath) -or $normalizedCheckoutPath.Length -le 3) {
    throw "CheckoutPath is too broad to remove safely: $checkoutFullPath"
}

foreach ($path in @($backendSource, $spaceReadme, $spaceDockerfile)) {
    if (-not (Test-Path $path)) {
        throw "Required Space sync source was not found: $path"
    }
}

if (Test-Path $checkoutFullPath) {
    Remove-Item -LiteralPath $checkoutFullPath -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $checkoutFullPath | Out-Null

Copy-Item -LiteralPath $spaceReadme -Destination (Join-Path $checkoutFullPath "README.md") -Force
Copy-Item -LiteralPath $spaceDockerfile -Destination (Join-Path $checkoutFullPath "Dockerfile") -Force
Write-Host "Copying backend source into temporary Space checkout..."
robocopy $backendSource (Join-Path $checkoutFullPath "backend") /E /R:2 /W:2 /NP /XD target .gradle build /XF *.log *.tmp | Out-Host
if ($LASTEXITCODE -gt 7) {
    throw "Backend source copy failed with robocopy exit code $LASTEXITCODE."
}
$global:LASTEXITCODE = 0

$backendCheckout = Join-Path $checkoutFullPath "backend"
foreach ($requiredFile in @("mvnw", "pom.xml")) {
    if (-not (Test-Path (Join-Path $backendCheckout $requiredFile))) {
        throw "Backend copy is incomplete: $requiredFile was not found in $backendCheckout."
    }
}
if (-not (Test-Path (Join-Path $backendCheckout "src"))) {
    throw "Backend copy is incomplete: src/ directory was not found in $backendCheckout."
}

$pythonScript = @'
from huggingface_hub import upload_folder, HfApi
import json
import os
import sys

repo_id = os.environ["HF_SPACE_REPO_ID"]
folder_path = os.environ["HF_SPACE_FOLDER"]
token = os.environ["HF_TOKEN"]
commit_message = os.environ.get("HF_COMMIT_MESSAGE", "Sync MerHouse backend Space")

upload_folder(
    repo_id=repo_id,
    repo_type="space",
    folder_path=folder_path,
    token=token,
    commit_message=commit_message,
    ignore_patterns=[
        "backend/target/**",
        "backend/.gradle/**",
        "backend/build/**",
        "**/*.log",
        "**/*.tmp",
    ],
)
print("hf_space_sync_uploaded=true")

# ── Push environment variables and secrets to Space Settings ──
push_env = os.environ.get("HF_PUSH_ENV", "") == "true"
env_json = os.environ.get("HF_ENV_PAYLOAD", "")

if push_env and env_json:
    api = HfApi(token=token)
    payload = json.loads(env_json)
    secrets_pushed = 0
    variables_pushed = 0
    failures = []

    # Delete existing secrets/variables that conflict with new ones
    try:
        existing_secrets = {s.key for s in api.list_secrets(repo_id=repo_id)}
        existing_variables = {v.key for v in api.list_variables(repo_id=repo_id)}
    except Exception:
        existing_secrets = set()
        existing_variables = set()

    new_secret_keys = {s["key"] for s in payload.get("secrets", [])}
    new_variable_keys = {v["key"] for v in payload.get("variables", [])}

    for key in existing_secrets & new_secret_keys:
        try:
            api.delete_space_secret(repo_id=repo_id, key=key)
            print(f"  deleted existing secret: {key}")
        except Exception as e:
            print(f"  warning: could not delete secret {key}: {e}")

    for key in existing_variables & new_variable_keys:
        try:
            api.delete_space_variable(repo_id=repo_id, key=key)
            print(f"  deleted existing variable: {key}")
        except Exception as e:
            print(f"  warning: could not delete variable {key}: {e}")

    for secret in payload.get("secrets", []):
        try:
            api.add_space_secret(repo_id=repo_id, key=secret["key"], value=secret["value"])
            secrets_pushed += 1
            print(f"  secret pushed: {secret['key']}")
        except Exception as e:
            failures.append(f"secret {secret['key']}: {e}")
            print(f"  FAILED secret {secret['key']}: {e}")

    for variable in payload.get("variables", []):
        try:
            api.add_space_variable(repo_id=repo_id, key=variable["key"], value=variable["value"])
            variables_pushed += 1
            print(f"  variable pushed: {variable['key']}")
        except Exception as e:
            failures.append(f"variable {variable['key']}: {e}")
            print(f"  FAILED variable {variable['key']}: {e}")

    print(f"hf_env_pushed_secrets={secrets_pushed}")
    print(f"hf_env_pushed_variables={variables_pushed}")
    if failures:
        print(f"hf_env_push_failures={len(failures)}")
        for f in failures:
            print(f"  failure: {f}", file=sys.stderr)
        sys.exit(1)
'@

Write-Host "Hugging Face Space sync prepared."
Write-Host "Space repo: $spaceRepoId"
Write-Host "Checkout path: $checkoutFullPath"
if ($PushEnv) {
    Write-Host "Env push: enabled (will push runtime variables and secrets to Space Settings)."
} else {
    Write-Host "Env push: skipped (pass -PushEnv to also push runtime env vars to Space Settings)."
}
Write-Host "Secrets: read from ignored env file; values not printed."

if (-not $ConfirmUpload) {
    Write-Host "Dry run only. Pass -ConfirmUpload to upload the Space source."
    exit 0
}

$env:HF_SPACE_REPO_ID = $values["HF_SPACE_REPO_ID"]
$env:HF_TOKEN = $values["HF_TOKEN"]
$env:HF_SPACE_FOLDER = $checkoutFullPath
$env:HF_COMMIT_MESSAGE = "Sync MerHouse backend Space"

# Build the env-push payload when -PushEnv is requested.
# Keys that are local-only tooling values (HF_TOKEN, HF_SPACE_REPO_ID) are excluded.
$hfLocalOnlyKeys = @("HF_TOKEN", "HF_SPACE_REPO_ID")
$secretKeys = @(
    "SPRING_DATASOURCE_PASSWORD"
)

if ($PushEnv) {
    $secretsList = @()
    $variablesList = @()
    foreach ($key in $values.Keys) {
        if ($hfLocalOnlyKeys -contains $key) { continue }
        $entry = @{ key = $key; value = $values[$key] }
        if ($secretKeys -contains $key) {
            $secretsList += $entry
        } else {
            $variablesList += $entry
        }
    }
    $payload = @{ secrets = $secretsList; variables = $variablesList } | ConvertTo-Json -Depth 4 -Compress
    $env:HF_PUSH_ENV = "true"
    $env:HF_ENV_PAYLOAD = $payload
    Write-Host "Env payload prepared: $($secretsList.Count) secret(s), $($variablesList.Count) variable(s)."
} else {
    $env:HF_PUSH_ENV = "false"
    $env:HF_ENV_PAYLOAD = ""
}

$envVarsToClean = @("Env:\HF_SPACE_REPO_ID", "Env:\HF_TOKEN", "Env:\HF_SPACE_FOLDER", "Env:\HF_COMMIT_MESSAGE", "Env:\HF_PUSH_ENV", "Env:\HF_ENV_PAYLOAD")
try {
    $pythonTempFile = Join-Path ([System.IO.Path]::GetTempPath()) "merhouse-hf-space-sync-$([Guid]::NewGuid().ToString('N')).py"
    Set-Content -LiteralPath $pythonTempFile -Value $pythonScript -Encoding UTF8
    try {
        & $PythonPath $pythonTempFile
        if ($LASTEXITCODE -ne 0) {
            throw "Hugging Face Space sync failed with Python exit code $LASTEXITCODE."
        }
    } finally {
        Remove-Item -LiteralPath $pythonTempFile -ErrorAction SilentlyContinue
    }
} finally {
    Remove-Item $envVarsToClean -ErrorAction SilentlyContinue
}

Write-Host "Hugging Face Space sync completed."
