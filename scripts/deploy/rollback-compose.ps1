param(
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = ".env.production",
    [switch]$ConfirmRollback
)

$ErrorActionPreference = "Stop"
if (-not $ConfirmRollback) {
    throw "Rollback changes the running deployment. Re-run with -ConfirmRollback after selecting the intended image tags or commit."
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
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
    throw "Refusing to roll back with the example env template. Use an ignored private env file for deployed environments."
}

docker compose --env-file $envPath -f $composePath up -d --remove-orphans
if ($LASTEXITCODE -ne 0) {
    throw "Compose rollback/up failed."
}

Write-Host "Compose rollback/up completed. Run deployed smoke and live checks before declaring recovery complete."
