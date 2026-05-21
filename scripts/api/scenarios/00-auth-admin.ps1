param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "0. Logging in as seeded admin"
$adminEmail = if ([string]::IsNullOrWhiteSpace($Context.AdminEmail)) { "admin@merhouse.local" } else { $Context.AdminEmail }
$adminPassword = if ([string]::IsNullOrWhiteSpace($Context.AdminPassword)) { "local-owner-password" } else { $Context.AdminPassword }
$Context.AdminLogin = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $adminEmail
    password = $adminPassword
}
Assert-NotBlank -Value $Context.AdminLogin.accessToken -Message "Admin access token was blank."
Assert-Equal -Actual $Context.AdminLogin.user.role -Expected "OWNER" -Message "Seeded owner role mismatch."

$Context.AdminHeaders = @{ Authorization = "Bearer $($Context.AdminLogin.accessToken)" }
$Context.DefaultHeaders = $Context.AdminHeaders

$Context.AdminMe = Invoke-Json -Context $Context -Method Get -Path "/api/v1/auth/me"
Assert-Equal -Actual $Context.AdminMe.user.email -Expected $adminEmail -Message "Current admin email mismatch."
