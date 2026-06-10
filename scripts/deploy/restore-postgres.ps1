param(
    [Parameter(Mandatory = $true)] [string]$BackupFile,
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = ".env.production",
    [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"
if (-not $ConfirmRestore) {
    throw "Restore is destructive. Re-run with -ConfirmRestore after verifying the target environment."
}
if (-not (Test-Path $BackupFile)) {
    throw "Backup file was not found: $BackupFile"
}

$backupName = Split-Path $BackupFile -Leaf
docker compose --env-file $EnvFile -f $ComposeFile cp $BackupFile "postgres:/backups/$backupName"
if ($LASTEXITCODE -ne 0) {
    throw "Copying backup into postgres container failed."
}

docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres sh -lc "pg_restore --clean --if-exists -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" '/backups/$backupName'"
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL restore failed."
}

Write-Host "PostgreSQL restore completed from /backups/$backupName"
