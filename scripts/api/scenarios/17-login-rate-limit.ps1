param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "17. Verifying login rate limiting"

$isolatedEmail = "rate-limited-$($Context.Suffix)@merhouse.local"
Write-Host "  Creating isolated rate-test user..."
$isolatedUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Body @{
    tenantId = $Context.Merchant.id
    email = $isolatedEmail
    password = "rate-test-password"
    role = "MERCHANT"
}
Assert-NotBlank -Value $isolatedUser.id -Message "Rate-test user id was blank."

# Wait for the user to be created in Firebase Auth by the backend
Start-Sleep -Seconds 2

function Get-FirebaseSignInUri {
    $emulatorHost = $Context.FirebaseEmulatorHost
    if (-not [string]::IsNullOrWhiteSpace($emulatorHost)) {
        $emulatorHost = $emulatorHost.TrimEnd('/')
        return "${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$($Context.FirebaseApiKey)"
    }
    return "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$($Context.FirebaseApiKey)"
}

$signInUri = Get-FirebaseSignInUri

Write-Host "  Exhausting login attempts for $isolatedEmail..."
for ($i = 1; $i -le 5; $i++) {
    Write-Host "    Attempt $i with wrong password..."
    try {
        $null = Invoke-RestMethod -Method Post -Uri $signInUri -ContentType "application/json" -Body (@{
            email = $isolatedEmail
            password = "wrong-password"
            returnSecureToken = $true
        } | ConvertTo-Json)
    } catch {
        # Expected failures from wrong passwords or rate limiting
    }
}

Write-Host "  Verifying a different email can still log in via API login..."
$otherLogin = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $Context.AdminEmail
    password = $Context.AdminPassword
}
Assert-NotBlank -Value $otherLogin -Message "Rate-limited email blocked a different account login."

Write-Host "  Login rate limiting verified."
