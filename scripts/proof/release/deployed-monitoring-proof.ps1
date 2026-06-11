param(
    [Parameter(Mandatory = $true)] [string]$FrontendBaseUrl,
    [Parameter(Mandatory = $true)] [string]$ApiBaseUrl,
    [string]$OutputPath = "",
    [int]$Samples = 3,
    [int]$MaxApiHealthMs = 2000,
    [int]$MaxFrontendMs = 3000,
    [switch]$AllowLocalHttpRehearsal
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
. (Join-Path $PSScriptRoot "..\lib\url-guard-lib.ps1")

$normalizedFrontendBaseUrl = Assert-AbsoluteHttpUrl -Name "FrontendBaseUrl" -Value $FrontendBaseUrl
$normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
if (-not $AllowLocalHttpRehearsal -and -not $normalizedFrontendBaseUrl.StartsWith("https://")) {
    throw "FrontendBaseUrl must be an HTTPS deployment URL for deployed monitoring proof."
}
if (-not $AllowLocalHttpRehearsal -and -not $normalizedApiBaseUrl.StartsWith("https://")) {
    throw "ApiBaseUrl must be an HTTPS deployment URL for deployed monitoring proof."
}
if ($Samples -lt 1) {
    throw "Samples must be at least 1."
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = ".\reports\v17-deployed-monitoring-$timestamp.json"
}
$resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    [System.IO.Path]::GetFullPath($OutputPath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null

function Invoke-TimedWebRequest {
    param(
        [string]$Uri,
        [string]$ExpectedContentPattern = ""
    )

    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 15
        $watch.Stop()
        $contentOk = $true
        if (-not [string]::IsNullOrWhiteSpace($ExpectedContentPattern)) {
            $contentOk = $response.Content -match $ExpectedContentPattern
        }
        return [pscustomobject]@{
            ok = $response.StatusCode -ge 200 -and $response.StatusCode -lt 300 -and $contentOk
            statusCode = $response.StatusCode
            ms = $watch.ElapsedMilliseconds
            error = $null
        }
    } catch {
        $watch.Stop()
        return [pscustomobject]@{
            ok = $false
            statusCode = $null
            ms = $watch.ElapsedMilliseconds
            error = $_.Exception.Message
        }
    }
}

function Invoke-TimedJsonHealth {
    param([string]$Uri)

    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-RestMethod -Method Get -Uri $Uri -TimeoutSec 15
        $watch.Stop()
        return [pscustomobject]@{
            ok = $response.status -eq "UP"
            status = $response.status
            ms = $watch.ElapsedMilliseconds
            error = $null
        }
    } catch {
        $watch.Stop()
        return [pscustomobject]@{
            ok = $false
            status = $null
            ms = $watch.ElapsedMilliseconds
            error = $_.Exception.Message
        }
    }
}

$apiHealthUrl = "$normalizedApiBaseUrl/api/v1/health"
$frontendSamples = @()
$apiSamples = @()

Write-Host "Running deployed monitoring proof."
Write-Host "Frontend target: $normalizedFrontendBaseUrl"
Write-Host "API health target: $apiHealthUrl"
Write-Host "Samples: $Samples"

for ($index = 1; $index -le $Samples; $index++) {
    $frontendSamples += Invoke-TimedWebRequest -Uri $normalizedFrontendBaseUrl -ExpectedContentPattern '<div id="root"></div>'
    $apiSamples += Invoke-TimedJsonHealth -Uri $apiHealthUrl
}

$frontendFailures = @($frontendSamples | Where-Object { -not $_.ok })
$apiFailures = @($apiSamples | Where-Object { -not $_.ok })
$frontendMax = ($frontendSamples | Measure-Object -Property ms -Maximum).Maximum
$apiMax = ($apiSamples | Measure-Object -Property ms -Maximum).Maximum

$report = [ordered]@{
    schema = "merhouse.v17.deployed-monitoring.v1"
    checkedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = $normalizedFrontendBaseUrl
    apiBaseUrl = $normalizedApiBaseUrl
    localHttpRehearsal = [bool]$AllowLocalHttpRehearsal
    samples = $Samples
    budgets = [ordered]@{
        maxFrontendMs = $MaxFrontendMs
        maxApiHealthMs = $MaxApiHealthMs
    }
    frontend = [ordered]@{
        failures = $frontendFailures.Count
        maxMs = $frontendMax
        records = $frontendSamples
    }
    apiHealth = [ordered]@{
        failures = $apiFailures.Count
        maxMs = $apiMax
        records = $apiSamples
    }
}

$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding utf8

Write-Host "Monitoring frontend failures: $($frontendFailures.Count)"
Write-Host "Monitoring frontend max ms: $frontendMax"
Write-Host "Monitoring API health failures: $($apiFailures.Count)"
Write-Host "Monitoring API health max ms: $apiMax"
Write-Host "Monitoring proof report: $resolvedOutputPath"

if ($frontendFailures.Count -gt 0) {
    throw "Frontend monitoring samples had $($frontendFailures.Count) failure(s)."
}
if ($apiFailures.Count -gt 0) {
    throw "API health monitoring samples had $($apiFailures.Count) failure(s)."
}
if ($frontendMax -gt $MaxFrontendMs) {
    throw "Frontend monitoring max latency exceeded budget: $frontendMax ms > $MaxFrontendMs ms."
}
if ($apiMax -gt $MaxApiHealthMs) {
    throw "API health monitoring max latency exceeded budget: $apiMax ms > $MaxApiHealthMs ms."
}

Write-Host "Deployed monitoring proof passed."
