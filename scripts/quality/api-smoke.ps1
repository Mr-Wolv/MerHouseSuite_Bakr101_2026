param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$OutputPath = "",
    [string]$AdminEmail = "admin@merhouse.local",
    [string]$AdminPassword = "local-owner-password",
    [switch]$ExpectRecoveryToken,
    [switch]$ExpectOpenApiDocs = $true
)

. (Join-Path $PSScriptRoot "..\proof\lib\url-guard-lib.ps1")

$normalizedBaseUrl = Assert-AbsoluteHttpUrl -Name "BaseUrl" -Value $BaseUrl
. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$resolvedOutputPath = ""
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $resolvedOutputPath = Resolve-MerHousePath -Path $OutputPath -ProjectRoot $projectRoot
}

Write-Host "API smoke wrapper target: $normalizedBaseUrl"
if ($resolvedOutputPath) {
    Write-Host "API smoke wrapper output: $resolvedOutputPath"
} else {
    Write-Host "API smoke wrapper output: <timestamped reports/api-smoke-test-*.json>"
}

$runnerOutputPath = if ($resolvedOutputPath) { $resolvedOutputPath } else { $OutputPath }
& (Join-Path $PSScriptRoot "..\api\run-all.ps1") -BaseUrl $normalizedBaseUrl -OutputPath $runnerOutputPath -AdminEmail $AdminEmail -AdminPassword $AdminPassword -ExpectRecoveryToken:$ExpectRecoveryToken -ExpectOpenApiDocs:$ExpectOpenApiDocs
