param(
    [string]$EnvFile = ".secrets/deploy/managed/huggingface-vercel.env",
    [string]$CheckoutPath = "",
    [string]$PythonPath = "python",
    [switch]$ConfirmUpload
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
from huggingface_hub import upload_folder
import os

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
'@

Write-Host "Hugging Face Space sync prepared."
Write-Host "Space repo: $spaceRepoId"
Write-Host "Checkout path: $checkoutFullPath"
Write-Host "Secrets: read from ignored env file; values not printed."

if (-not $ConfirmUpload) {
    Write-Host "Dry run only. Pass -ConfirmUpload to upload the Space source."
    exit 0
}

$env:HF_SPACE_REPO_ID = $values["HF_SPACE_REPO_ID"]
$env:HF_TOKEN = $values["HF_TOKEN"]
$env:HF_SPACE_FOLDER = $checkoutFullPath
$env:HF_COMMIT_MESSAGE = "Sync MerHouse backend Space"
try {
    $pythonTempFile = Join-Path ([System.IO.Path]::GetTempPath()) "merhouse-hf-space-sync-$([Guid]::NewGuid().ToString('N')).py"
    Set-Content -LiteralPath $pythonTempFile -Value $pythonScript -Encoding UTF8
    try {
        & $PythonPath $pythonTempFile
        if ($LASTEXITCODE -ne 0) {
            throw "Hugging Face Space upload failed with Python exit code $LASTEXITCODE."
        }
    } finally {
        Remove-Item -LiteralPath $pythonTempFile -ErrorAction SilentlyContinue
    }
} finally {
    Remove-Item Env:\HF_SPACE_REPO_ID, Env:\HF_TOKEN, Env:\HF_SPACE_FOLDER, Env:\HF_COMMIT_MESSAGE -ErrorAction SilentlyContinue
}

Write-Host "Hugging Face Space sync completed."
