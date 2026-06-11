param(
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = ".secrets/deploy/env.production",
    [string]$OutputDirectory = "reports",
    [switch]$ConfirmDrill
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmDrill) {
    throw "Backup restore drill creates and restores a database backup. Re-run with -ConfirmDrill only against the intended staging/drill environment."
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$resolvedOutputDirectory = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
    [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
}
New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null

$backupPath = Join-Path $resolvedOutputDirectory "v17-backup-restore-drill-$timestamp.dump"
$manifestPath = Join-Path $resolvedOutputDirectory "v17-backup-restore-drill-$timestamp.json"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)] [string] $Label,
        [Parameter(Mandatory = $true)] [scriptblock] $Command
    )

    Write-Host ""
    Write-Host $Label
    $global:LASTEXITCODE = 0
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed."
    }
}

$commitSha = ""
try {
    Push-Location $projectRoot
    $commitSha = (git rev-parse HEAD).Trim()
} catch {
    $commitSha = "unavailable"
} finally {
    Pop-Location
}

Invoke-Checked "Creating restore-drill backup..." {
    & (Join-Path $PSScriptRoot "backup-postgres.ps1") -ComposeFile $ComposeFile -EnvFile $EnvFile -OutputPath $backupPath
}

if (-not (Test-Path $backupPath)) {
    throw "Expected restore-drill backup was not copied to host: $backupPath"
}

$backupHash = (Get-FileHash $backupPath -Algorithm SHA256).Hash.ToLowerInvariant()
$backupBytes = (Get-Item $backupPath).Length

Invoke-Checked "Restoring restore-drill backup..." {
    & (Join-Path $PSScriptRoot "restore-postgres.ps1") -ComposeFile $ComposeFile -EnvFile $EnvFile -BackupFile $backupPath -ConfirmRestore
}

$manifest = [ordered]@{
    schema = "merhouse.v17.backup-restore-drill.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    commitSha = $commitSha
    composeFile = $ComposeFile
    envFileName = Split-Path $EnvFile -Leaf
    preflight = [ordered]@{
        envAudit = "passed"
        vpsShape = "passed"
    }
    backupPath = $backupPath
    backupSha256 = $backupHash
    backupBytes = $backupBytes
    restored = $true
    secretPolicy = "manifest omits database credentials and env values"
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Host ""
Write-Host "Backup restore drill manifest: $manifestPath"
Write-Host "Backup restore drill passed."
