param(
    [switch]$IncludeLoadSmoke,
    [switch]$IncludeAndroidRelease,
    [string]$ApiBaseUrl = "",
    [int]$ConcurrentUsers = 25,
    [int]$RequestsPerUser = 8
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

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

function Assert-ScriptParse {
    $parseFailed = $false
    Get-ChildItem -Path (Join-Path $projectRoot "scripts") -Recurse -Filter *.ps1 | ForEach-Object {
        $tokens = $null
        $parseErrors = $null
        $null = [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$parseErrors)
        if ($parseErrors.Count -gt 0) {
            $parseFailed = $true
            Write-Host $_.FullName
            $parseErrors | ForEach-Object { Write-Host $_.Message }
        }
    }
    if ($parseFailed) {
        throw "PowerShell script parser check failed."
    }
    Write-Host "PowerShell script parser check passed."
}

function Assert-PostgresBackupNameGuards {
    foreach ($relativePath in @("scripts\deploy\backup-postgres.ps1", "scripts\deploy\restore-postgres.ps1")) {
        $scriptPath = Join-Path $projectRoot $relativePath
        $scriptText = Get-Content -Raw -LiteralPath $scriptPath
        if ($scriptText -notmatch 'function\s+Assert-SafePostgresBackupName') {
            throw "$relativePath must define Assert-SafePostgresBackupName before composing container backup paths."
        }
        if ($scriptText -notmatch 'Assert-SafePostgresBackupName\s+-Name\s+\$backupName') {
            throw "$relativePath must validate backupName before using it in docker compose operations."
        }
        if ($scriptText -notmatch '\^\[A-Za-z0-9\]\[A-Za-z0-9\._-\]\{0,127\}\\\.dump\$') {
            throw "$relativePath must restrict PostgreSQL backup filenames to simple .dump names."
        }
    }
    Write-Host "PostgreSQL backup filename guard check passed."
}

Push-Location $projectRoot
try {
    Invoke-Checked "Checking PowerShell script parsing..." { Assert-ScriptParse }
    Invoke-Checked "Checking PostgreSQL backup filename guards..." { Assert-PostgresBackupNameGuards }
    Invoke-Checked "Checking V17 env template audit..." { & ".\scripts\deploy\env-audit.ps1" -EnvFile "deploy/vps/env.production.example" -AllowTemplate }
    Invoke-Checked "Checking V17 VPS deployment shape..." { & ".\scripts\deploy\vps-check.ps1" }
    Invoke-Checked "Checking V17 reverse proxy template..." { & ".\scripts\deploy\reverse-proxy-check.ps1" }
    Invoke-Checked "Checking V17 Android release shape..." { & ".\scripts\quality\native-android-release-shape-check.ps1" }
    Invoke-Checked "Checking V17 deployed evidence attachment rules..." { & ".\scripts\quality\deployed-v17-proof-attachment-check.ps1" }
    Invoke-Checked "Checking V17 cutover readiness guard..." { & ".\scripts\quality\v17-cutover-readiness-check.ps1" }
    Invoke-Checked "Checking markdown links..." { & ".\scripts\quality\markdown-check.ps1" }
    Invoke-Checked "Checking public-facing repository readiness..." { & ".\scripts\quality\public-readiness.ps1" -SkipCompose }
    Invoke-Checked "Checking frontend performance readiness..." { & ".\scripts\quality\performance-readiness.ps1" }

    if ($IncludeLoadSmoke) {
        if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
            throw "-ApiBaseUrl is required when -IncludeLoadSmoke is supplied."
        }
        Invoke-Checked "Running V17 load smoke..." {
            & ".\scripts\quality\load-smoke.ps1" -BaseUrl $ApiBaseUrl -ConcurrentUsers $ConcurrentUsers -RequestsPerUser $RequestsPerUser
        }
    } else {
        Write-Host ""
        Write-Host "Skipping V17 load smoke. Pass -IncludeLoadSmoke -ApiBaseUrl <https://target> when staging or production is reachable."
    }

    if ($IncludeAndroidRelease) {
        if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
            throw "-ApiBaseUrl is required when -IncludeAndroidRelease is supplied."
        }
        Invoke-Checked "Building signed Android release proof..." {
            & ".\scripts\quality\native-android-release-check.ps1" -ApiBaseUrl $ApiBaseUrl -Bundle -OutputPath ".\reports\v17-android-release.json"
        }
    } else {
        Write-Host ""
        Write-Host "Skipping signed Android release proof. Pass -IncludeAndroidRelease -ApiBaseUrl <https://target> when keystore env vars are available."
    }

    Write-Host ""
    Write-Host "V17 production readiness preflight passed."
} finally {
    Pop-Location
}
