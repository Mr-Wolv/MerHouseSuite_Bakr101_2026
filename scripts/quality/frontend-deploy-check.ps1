param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$OutputPath,
    [string]$AdminEmail = "admin@merhouse.local",
    [string]$AdminPassword = "local-owner-password",
    [switch]$ExpectOpenApiDocs = $true
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$smokeScript = Join-Path $PSScriptRoot "api-smoke.ps1"

. (Join-Path $PSScriptRoot "url-guard-lib.ps1")

$normalizedBaseUrl = Assert-AbsoluteHttpUrl -Name "BaseUrl" -Value $BaseUrl
$resolvedOutputPath = ""
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
        [System.IO.Path]::GetFullPath($OutputPath)
    } else {
        [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
    }
}

if (-not (Test-Path $smokeScript)) {
    throw "API smoke wrapper was not found at $smokeScript."
}

Write-Host "Checking deployed frontend at $normalizedBaseUrl"
if ($resolvedOutputPath) {
    Write-Host "Frontend proxy smoke output: $resolvedOutputPath"
} else {
    Write-Host "Frontend proxy smoke output: <timestamped reports/api-smoke-test-*.json>"
}

try {
    $response = Invoke-WebRequest -Uri $normalizedBaseUrl -UseBasicParsing
} catch {
    throw "Frontend did not respond at $normalizedBaseUrl. Start the Docker stack and try again. $($_.Exception.Message)"
}

if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
    throw "Frontend returned unexpected status $($response.StatusCode)."
}
Write-Host "Frontend shell status: $($response.StatusCode)"

if ($response.Content -notmatch '<div id="root"></div>') {
    throw "Frontend response did not look like the React app shell."
}
Write-Host "Frontend shell marker: <div id=`"root`"></div>"

Write-Host "Frontend shell responded. Running API smoke test through frontend proxy..."

$smokeArgs = @{
    BaseUrl = $normalizedBaseUrl
    AdminEmail = $AdminEmail
    AdminPassword = $AdminPassword
    ExpectOpenApiDocs = [bool]$ExpectOpenApiDocs
}
if ($resolvedOutputPath) {
    $smokeArgs.OutputPath = $resolvedOutputPath
}

$global:LASTEXITCODE = 0
& $smokeScript @smokeArgs
if ($LASTEXITCODE -ne 0) {
    throw "API smoke test through frontend proxy failed."
}

Write-Host "Frontend deployment check passed for $normalizedBaseUrl"
