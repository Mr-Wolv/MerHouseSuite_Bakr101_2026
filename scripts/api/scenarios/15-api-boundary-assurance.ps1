param([hashtable]$Context)

Write-Host "33. Verifying API boundary checks"

$boundaryOrganization = "<img src=x onerror=alert(1)> Boundary Merchant $($Context.Suffix)"
$boundaryNotes = "' OR '1'='1 <script>alert(1)</script>"
$boundaryEmail = "boundary-$($Context.Suffix)@merhouse.local"

$Context.BoundaryAccessRequest = Invoke-Json -Context $Context -Method Post -Path "/api/v1/access-requests" -Body @{
    organizationName = $boundaryOrganization
    requesterEmail = $boundaryEmail
    requestedRole = "MERCHANT"
    notes = $boundaryNotes
}
Assert-Equal -Actual $Context.BoundaryAccessRequest.status -Expected "PENDING" -Message "Boundary access request did not start pending."
Assert-Equal -Actual $Context.BoundaryAccessRequest.organizationName -Expected $boundaryOrganization -Message "Injection-shaped organization text was not round-tripped as data."
Assert-Equal -Actual $Context.BoundaryAccessRequest.notes -Expected $boundaryNotes -Message "Injection-shaped access request notes were not round-tripped as data."

Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/access-requests" -Headers $Context.MerchantHeaders -ExpectedStatus 403
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/admin/outbox/summary" -Headers $Context.MerchantHeaders -ExpectedStatus 403
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/auth/password-reset/confirm" -ExpectedStatus 409 -Body @{
    token = "' OR '1'='1"
    newPassword = "boundary-password"
}

$Context.OpenApiContract = Invoke-Json -Context $Context -Method Get -Path "/v3/api-docs/merhouse-v1"
$paths = @($Context.OpenApiContract.paths.PSObject.Properties.Name)
if ($paths -notcontains "/api/v1/access-requests") {
    throw "OpenAPI contract did not include /api/v1/access-requests."
}
if ($paths -notcontains "/api/v1/auth/login") {
    throw "OpenAPI contract did not include /api/v1/auth/login."
}
if (-not $Context.OpenApiContract.components.securitySchemes.bearerAuth) {
    throw "OpenAPI contract did not expose the bearerAuth security scheme."
}
