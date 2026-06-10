param(
    [string]$BaseUrl = "http://localhost:8080",
    [int]$ConcurrentUsers = 25,
    [int]$RequestsPerUser = 8,
    [int]$MaxAverageMs = 750,
    [int]$MaxFailureCount = 0
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "url-guard-lib.ps1")

$target = Assert-AbsoluteHttpUrl -Name "BaseUrl" -Value $BaseUrl
$healthUrl = "$target/api/v1/health"

Write-Host "Running load smoke against $healthUrl"
Write-Host "Concurrent users: $ConcurrentUsers"
Write-Host "Requests per user: $RequestsPerUser"

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

Write-Host "Load smoke requests: $($records.Count)"
Write-Host "Load smoke failures: $failures"
Write-Host "Load smoke average ms: $average"
Write-Host "Load smoke max ms: $max"

if ($failures -gt $MaxFailureCount) {
    throw "Load smoke failures exceeded budget: $failures > $MaxFailureCount"
}
if ($average -gt $MaxAverageMs) {
    throw "Load smoke average exceeded budget: $average ms > $MaxAverageMs ms"
}

Write-Host "Load smoke passed."
