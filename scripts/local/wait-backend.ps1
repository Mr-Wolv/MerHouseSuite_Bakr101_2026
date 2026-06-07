param(
    [string]$Url = "http://localhost:8080/api/v1/health",
    [int]$TimeoutSeconds = 90,
    [int]$IntervalSeconds = 2
)

$ErrorActionPreference = "Stop"

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$lastError = $null

Write-Host "Waiting for backend readiness at $Url..."
while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 5
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
