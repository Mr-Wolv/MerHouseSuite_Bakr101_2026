param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$OutputPath = "",
    [string]$AdminEmail = "admin@merhouse.local",
    [string]$AdminPassword = "local-owner-password",
    [switch]$ExpectRecoveryToken
)

. (Join-Path $PSScriptRoot "url-guard-lib.ps1")

$normalizedBaseUrl = Assert-AbsoluteHttpUrl -Name "BaseUrl" -Value $BaseUrl
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$resolvedOutputPath = ""
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
        [System.IO.Path]::GetFullPath($OutputPath)
    } else {
        [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
    }
}

Write-Host "API smoke wrapper target: $normalizedBaseUrl"
if ($resolvedOutputPath) {
    Write-Host "API smoke wrapper output: $resolvedOutputPath"
} else {
    Write-Host "API smoke wrapper output: <timestamped reports/api-smoke-test-*.json>"
}

$runnerOutputPath = if ($resolvedOutputPath) { $resolvedOutputPath } else { $OutputPath }
& (Join-Path $PSScriptRoot "..\api\run-all.ps1") -BaseUrl $normalizedBaseUrl -OutputPath $runnerOutputPath -AdminEmail $AdminEmail -AdminPassword $AdminPassword -ExpectRecoveryToken:$ExpectRecoveryToken
