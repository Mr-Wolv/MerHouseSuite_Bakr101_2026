param(
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = ".env.production",
    [switch]$Build,
    [switch]$Pull,
    [switch]$BackupBeforeDeploy,
    [switch]$ConfirmDeploy
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmDeploy) {
    throw "Deployment changes the running VPS stack. Re-run with -ConfirmDeploy after selecting the intended env file, image tags, and backup posture."
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$composePath = if ([System.IO.Path]::IsPathRooted($ComposeFile)) {
    [System.IO.Path]::GetFullPath($ComposeFile)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $ComposeFile))
}
$envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
    [System.IO.Path]::GetFullPath($EnvFile)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $EnvFile))
}

if (-not (Test-Path $composePath)) {
    throw "Compose file was not found: $composePath"
}
if (-not (Test-Path $envPath)) {
    throw "Deployment env file was not found: $envPath"
}
if ((Split-Path $envPath -Leaf) -eq "env.production.example") {
    throw "Refusing to deploy with the example env template. Copy it to an ignored private env file and fill real values first."
}

$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "env-audit.ps1") -EnvFile $envPath
if ($LASTEXITCODE -ne 0) {
    throw "Deployment env audit failed before deploy."
}

$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "vps-check.ps1") -ComposeFile $composePath -EnvFile $envPath
if ($LASTEXITCODE -ne 0) {
    throw "VPS deployment shape check failed before deploy."
}

$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "frontend-nginx-check.ps1")
if ($LASTEXITCODE -ne 0) {
    throw "Frontend nginx proxy shape check failed before deploy."
}

$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "reverse-proxy-check.ps1")
if ($LASTEXITCODE -ne 0) {
    throw "Reverse proxy template check failed before deploy."
}

if ($BackupBeforeDeploy) {
    Write-Host "Creating pre-deploy database backup..."
    & (Join-Path $PSScriptRoot "backup-postgres.ps1") -ComposeFile $composePath -EnvFile $envPath
    if ($LASTEXITCODE -ne 0) {
        throw "Pre-deploy backup failed."
    }
} else {
    Write-Host "Skipping pre-deploy backup. Pass -BackupBeforeDeploy when updating an environment with important data."
}

if ($Pull) {
    Write-Host "Pulling configured images..."
    docker compose --env-file $envPath -f $composePath pull
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose pull failed."
    }
}

$upArgs = @("compose", "--env-file", $envPath, "-f", $composePath, "up", "-d", "--remove-orphans")
if ($Build) {
    $upArgs += "--build"
}

Write-Host "Applying VPS deployment..."
docker @upArgs
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose deployment failed."
}

Write-Host "VPS deployment command completed. Run deployed V17 proof before declaring the rollout healthy."
