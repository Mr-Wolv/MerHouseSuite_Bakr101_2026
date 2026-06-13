param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "37. Verifying health endpoints"

$healthResponse = Invoke-Json -Context $Context -Method Get -Path "/api/v1/health" -Headers @{}
Assert-Equal -Actual $healthResponse.status -Expected "UP" -Message "Public health endpoint did not return UP."
Write-Host "  Public /api/v1/health: UP"

$actuatorHealth = Invoke-Json -Context $Context -Method Get -Path "/actuator/health"
$actuatorJson = $actuatorHealth | ConvertTo-Json -Depth 5
if ($actuatorJson -notmatch '"UP"') {
    throw "Actuator health endpoint did not report UP status."
}
if ($actuatorJson -notmatch '"db"') {
    throw "Actuator health endpoint is missing the database health indicator."
}
Write-Host "  Actuator /actuator/health: UP with database indicator"

Write-Host "Health endpoints verified."
