param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$OutputPath = "",
    [int]$ConcurrentUsers = 25,
    [int]$RequestsPerUser = 8,
    [int]$MaxAverageMs = 750,
    [int]$MaxFailureCount = 0
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
. (Join-Path $PSScriptRoot "..\lib\url-guard-lib.ps1")

if ($ConcurrentUsers -lt 1) {
    throw "ConcurrentUsers must be at least 1."
}
if ($RequestsPerUser -lt 1) {
    throw "RequestsPerUser must be at least 1."
}
if ($MaxAverageMs -lt 1) {
    throw "MaxAverageMs must be at least 1."
}
if ($MaxFailureCount -lt 0) {
    throw "MaxFailureCount cannot be negative."
}

$target = Assert-AbsoluteHttpUrl -Name "BaseUrl" -Value $BaseUrl
$healthUrl = "$target/api/v1/health"
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = ".\reports\load-smoke-$timestamp.json"
}
$resolvedOutputPath = Resolve-MerHousePath -Path $OutputPath -ProjectRoot $projectRoot
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null

Write-Host "Running load smoke against $healthUrl"
Write-Host "Concurrent users: $ConcurrentUsers"
Write-Host "Requests per user: $RequestsPerUser"
Write-Host "Load smoke report output: $resolvedOutputPath"

$jobs = @()
for ($user = 0; $user -lt $ConcurrentUsers; $user++) {
    $jobs += Start-Job -ScriptBlock {
        param($Url, $Count)
        $results = @()
        for ($request = 0; $request -lt $Count; $request++) {
            $watch = [System.Diagnostics.Stopwatch]::StartNew()
            try {
                $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
                $watch.Stop()
                $results += [pscustomobject]@{ ok = $response.StatusCode -ge 200 -and $response.StatusCode -lt 300; ms = $watch.ElapsedMilliseconds }
            } catch {
                $watch.Stop()
                $results += [pscustomobject]@{ ok = $false; ms = $watch.ElapsedMilliseconds }
            }
        }
        $results
    } -ArgumentList $healthUrl, $RequestsPerUser
}

$records = $jobs | Receive-Job -Wait -AutoRemoveJob
$failures = @($records | Where-Object { -not $_.ok }).Count
$average = [math]::Round((($records | Measure-Object -Property ms -Average).Average), 2)
$max = ($records | Measure-Object -Property ms -Maximum).Maximum
$passed = $failures -le $MaxFailureCount -and $average -le $MaxAverageMs

$report = [ordered]@{
    schema = "merhouse.load-smoke.v1"
    checkedAt = (Get-Date).ToUniversalTime().ToString("o")
    baseUrl = $target
    healthUrl = $healthUrl
    concurrentUsers = $ConcurrentUsers
    requestsPerUser = $RequestsPerUser
    totalRequests = $records.Count
    budgets = [ordered]@{
        maxAverageMs = $MaxAverageMs
        maxFailureCount = $MaxFailureCount
    }
    result = [ordered]@{
        passed = $passed
        failures = $failures
        averageMs = $average
        maxMs = $max
    }
    records = $records
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding utf8

Write-Host "Load smoke requests: $($records.Count)"
Write-Host "Load smoke failures: $failures"
Write-Host "Load smoke average ms: $average"
Write-Host "Load smoke max ms: $max"
Write-Host "Load smoke report: $resolvedOutputPath"

if ($failures -gt $MaxFailureCount) {
    throw "Load smoke failures exceeded budget: $failures > $MaxFailureCount"
}
if ($average -gt $MaxAverageMs) {
    throw "Load smoke average exceeded budget: $average ms > $MaxAverageMs ms"
}

Write-Host "Load smoke passed."
