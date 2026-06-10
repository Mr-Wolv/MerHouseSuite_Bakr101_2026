param(
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = ".env.production",
    [string]$OutputDirectory = "backups",
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupName = if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    "merhouse-$timestamp.dump"
} else {
    Split-Path $OutputPath -Leaf
}
$containerPath = "/backups/$backupName"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$resolvedOutputPath = if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    [System.IO.Path]::GetFullPath((Join-Path (Join-Path $projectRoot $OutputDirectory) $backupName))
} elseif ([System.IO.Path]::IsPathRooted($OutputPath)) {
    [System.IO.Path]::GetFullPath($OutputPath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null

docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres sh -lc "pg_dump -Fc -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -f '$containerPath'"
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL backup failed."
}

docker compose --env-file $EnvFile -f $ComposeFile cp "postgres:$containerPath" $resolvedOutputPath
if ($LASTEXITCODE -ne 0) {
    throw "Copying PostgreSQL backup to host failed."
}

Write-Host "PostgreSQL backup created: $containerPath"
Write-Host "PostgreSQL backup copied to: $resolvedOutputPath"
