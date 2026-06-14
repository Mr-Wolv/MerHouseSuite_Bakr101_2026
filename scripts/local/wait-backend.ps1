param(
    [string]$Url = "",
    [int]$TimeoutSeconds = 90,
    [int]$IntervalSeconds = 2
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\lib\common.ps1")
. (Join-Path $PSScriptRoot "..\proof\lib\url-guard-lib.ps1")

if ([string]::IsNullOrWhiteSpace($Url)) {
    $Url = Join-Path (Get-MerHouseDefaultApiUrl) "/api/v1/health"
}

$readinessUrl = Assert-AbsoluteHttpUrl -Name "Url" -Value $Url

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$lastError = $null

Write-Host "Waiting for backend readiness at $readinessUrl..."
while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-RestMethod -Method Get -Uri $readinessUrl -TimeoutSec 5
        if ($response.status -eq "UP") {
            Write-Host "Backend is ready."
            return
        }
        $lastError = "Unexpected readiness response: $($response | ConvertTo-Json -Compress)"
    } catch {
        $lastError = $_.Exception.Message
    }

    Start-Sleep -Seconds $IntervalSeconds
}

throw "Backend did not become ready within $TimeoutSeconds seconds. Last error: $lastError"
