param(
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = ".env.production",
    [string]$OutputDirectory = "backups"
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupName = "merhouse-$timestamp.dump"
$containerPath = "/backups/$backupName"

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres sh -lc "pg_dump -Fc -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -f '$containerPath'"
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL backup failed."
}

Write-Host "PostgreSQL backup created: $containerPath"
