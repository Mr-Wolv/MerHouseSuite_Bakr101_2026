param([hashtable]$Context)

Write-Host "32. Verifying V7.6 password recovery and access requests"

$resetEmail = $Context.MerchantUser.email
$resetPassword = "merchant-reset-$($Context.Suffix)"
$resetResponse = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/password-reset/request" -Body @{
    email = $resetEmail
}
Assert-NotBlank -Value $resetResponse.message -Message "Password reset response message was blank."
Assert-NotBlank -Value $resetResponse.resetToken -Message "Enabled user reset token was blank in local dev response."

$missingResetResponse = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/password-reset/request" -Body @{
    email = "missing-$($Context.Suffix)@merhouse.local"
}
Assert-NotBlank -Value $missingResetResponse.message -Message "Missing-account reset response message was blank."
if ($null -ne $missingResetResponse.resetToken) {
    throw "Missing-account reset leaked a token."
}

Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/password-reset/confirm" -Body @{
    token = $resetResponse.resetToken
    newPassword = $resetPassword
} | Out-Null

Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/auth/password-reset/confirm" -ExpectedStatus 409 -Body @{
    token = $resetResponse.resetToken
    newPassword = "another-password"
}

$Context.MerchantLoginAfterReset = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $resetEmail
    password = $resetPassword
}
Assert-Equal -Actual $Context.MerchantLoginAfterReset.user.email -Expected $resetEmail -Message "Merchant login after reset returned the wrong user."

$Context.AccessRequest = Invoke-Json -Context $Context -Method Post -Path "/api/v1/access-requests" -Body @{
    organizationName = "Smoke Merchant $($Context.Suffix)"
    requesterEmail = "access-merchant-$($Context.Suffix)@merhouse.local"
    requestedRole = "MERCHANT"
    notes = "Smoke access request"
}
Assert-Equal -Actual $Context.AccessRequest.status -Expected "PENDING" -Message "Access request did not start pending."

Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/access-requests" -ExpectedStatus 409 -Body @{
    organizationName = "Bad Admin $($Context.Suffix)"
    requesterEmail = "bad-admin-$($Context.Suffix)@merhouse.local"
    requestedRole = "ADMIN"
    notes = "Should be denied"
}

$Context.AccessRequests = Invoke-Json -Context $Context -Method Get -Path "/api/v1/access-requests"
$matchedAccessRequest = @($Context.AccessRequests | Where-Object { $_.id -eq $Context.AccessRequest.id })[0]
Assert-NotBlank -Value $matchedAccessRequest.id -Message "Admin access request list did not include the submitted request."

$Context.ApprovedAccessRequest = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/access-requests/$($Context.AccessRequest.id)/approve" -Body @{
    reviewNote = "Approved in smoke test"
}
Assert-Equal -Actual $Context.ApprovedAccessRequest.status -Expected "APPROVED" -Message "Access request was not approved."

Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/access-requests/$($Context.AccessRequest.id)/reject" -ExpectedStatus 409 -Headers $Context.AdminHeaders -Body @{
    reviewNote = "Cannot review twice"
}

$Context.RejectedAccessRequest = Invoke-Json -Context $Context -Method Post -Path "/api/v1/access-requests" -Body @{
    organizationName = "Rejected Warehouse $($Context.Suffix)"
    requesterEmail = "access-warehouse-$($Context.Suffix)@merhouse.local"
    requestedRole = "WAREHOUSE_OPERATOR"
    notes = "Smoke rejection path"
}
$Context.RejectedAccessRequest = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/access-requests/$($Context.RejectedAccessRequest.id)/reject" -Body @{
    reviewNote = "Rejected in smoke test"
}
Assert-Equal -Actual $Context.RejectedAccessRequest.status -Expected "REJECTED" -Message "Access request was not rejected."
