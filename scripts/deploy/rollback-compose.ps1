param(
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = ".env.production",
    [switch]$ConfirmRollback
)

$ErrorActionPreference = "Stop"
if (-not $ConfirmRollback) {
    throw "Rollback changes the running deployment. Re-run with -ConfirmRollback after selecting the intended image tags or commit."
}

docker compose --env-file $EnvFile -f $ComposeFile up -d --remove-orphans
if ($LASTEXITCODE -ne 0) {
    throw "Compose rollback/up failed."
}

Write-Host "Compose rollback/up completed. Run deployed smoke and live checks before declaring recovery complete."
