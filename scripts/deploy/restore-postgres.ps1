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

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

function Resolve-ProjectPath {
    param(
        [Parameter(Mandatory = $true)] [string] $Path
    )

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $projectRoot $Path))
}

$composePath = Resolve-ProjectPath -Path $ComposeFile
$envPath = Resolve-ProjectPath -Path $EnvFile
$backupPath = Resolve-ProjectPath -Path $BackupFile
if (-not (Test-Path -LiteralPath $composePath)) {
    throw "Compose file was not found: $composePath"
}
if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Deployment env file was not found: $envPath"
}
if ((Split-Path $envPath -Leaf) -eq "env.production.example") {
    throw "Refusing to restore with the example env template. Use an ignored private env file."
}
if (-not (Test-Path -LiteralPath $backupPath)) {
    throw "Backup file was not found: $backupPath"
}

$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "env-audit.ps1") -EnvFile $envPath
if ($LASTEXITCODE -ne 0) {
    throw "Restore env audit failed."
}
$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "vps-check.ps1") -ComposeFile $composePath -EnvFile $envPath
if ($LASTEXITCODE -ne 0) {
    throw "Restore VPS shape check failed."
}

$backupName = Split-Path $backupPath -Leaf
docker compose --env-file $envPath -f $composePath cp $backupPath "postgres:/backups/$backupName"
if ($LASTEXITCODE -ne 0) {
    throw "Copying backup into postgres container failed."
}

docker compose --env-file $envPath -f $composePath exec -T postgres sh -lc "pg_restore --clean --if-exists -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" '/backups/$backupName'"
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL restore failed."
}

Write-Host "PostgreSQL restore completed from /backups/$backupName"
