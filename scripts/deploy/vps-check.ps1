param(
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = "deploy/vps/env.production.example"
)

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$composePath = Join-Path $projectRoot $ComposeFile
$envPath = Join-Path $projectRoot $EnvFile

if (-not (Test-Path $composePath)) {
    throw "Production compose file was not found: $composePath"
}
if (-not (Test-Path $envPath)) {
    throw "Production env template was not found: $envPath"
}

Write-Host "Validating VPS Compose file: $composePath"
docker compose --env-file $envPath -f $composePath config --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Production Compose validation failed."
}

Write-Host "VPS deployment shape check passed."
