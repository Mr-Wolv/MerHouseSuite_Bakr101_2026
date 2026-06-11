param(
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = ".env.production",
    [string]$OutputDirectory = "reports/backups",
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
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

function Assert-SafePostgresBackupName {
    param([Parameter(Mandatory = $true)] [string] $Name)

    if ($Name -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.dump$') {
        throw "Backup filename must be a simple .dump name containing only letters, numbers, dots, underscores, and hyphens."
    }
}

$composePath = Resolve-ProjectPath -Path $ComposeFile
$envPath = Resolve-ProjectPath -Path $EnvFile
if (-not (Test-Path -LiteralPath $composePath)) {
    throw "Compose file was not found: $composePath"
}
if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Deployment env file was not found: $envPath"
}
if ((Split-Path $envPath -Leaf) -eq "env.production.example") {
    throw "Refusing to back up with the example env template. Use an ignored private env file."
}

$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "env-audit.ps1") -EnvFile $envPath
if ($LASTEXITCODE -ne 0) {
    throw "Backup env audit failed."
}
$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "vps-check.ps1") -ComposeFile $composePath -EnvFile $envPath
if ($LASTEXITCODE -ne 0) {
    throw "Backup VPS shape check failed."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupName = if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    "merhouse-$timestamp.dump"
} else {
    Split-Path $OutputPath -Leaf
}
Assert-SafePostgresBackupName -Name $backupName
$containerPath = "/backups/$backupName"

$resolvedOutputPath = if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    [System.IO.Path]::GetFullPath((Join-Path (Join-Path $projectRoot $OutputDirectory) $backupName))
} elseif ([System.IO.Path]::IsPathRooted($OutputPath)) {
    [System.IO.Path]::GetFullPath($OutputPath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null

docker compose --env-file $envPath -f $composePath exec -T postgres sh -lc "pg_dump -Fc -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -f '$containerPath'"
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL backup failed."
}

docker compose --env-file $envPath -f $composePath cp "postgres:$containerPath" $resolvedOutputPath
if ($LASTEXITCODE -ne 0) {
    throw "Copying PostgreSQL backup to host failed."
}

Write-Host "PostgreSQL backup created: $containerPath"
Write-Host "PostgreSQL backup copied to: $resolvedOutputPath"
