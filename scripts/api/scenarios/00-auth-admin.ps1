param([Parameter(Mandatory = $true)] [hashtable] $Context)

function Get-FirebaseSignInUri {
    $emulatorHost = $Context.FirebaseEmulatorHost
    if (-not [string]::IsNullOrWhiteSpace($emulatorHost)) {
        $emulatorHost = $emulatorHost.TrimEnd('/')
        return "${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$($Context.FirebaseApiKey)"
    }
    return "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$($Context.FirebaseApiKey)"
}

Write-Host "0. Authenticating via Firebase Auth as admin"
$adminEmail = if ([string]::IsNullOrWhiteSpace($Context.AdminEmail)) { "admin@merhouse.local" } else { $Context.AdminEmail }
$adminPassword = if ([string]::IsNullOrWhiteSpace($Context.AdminPassword)) { "local-owner-password" } else { $Context.AdminPassword }

$signInUri = Get-FirebaseSignInUri
$firebaseResponse = Invoke-RestMethod -Method Post -Uri $signInUri -ContentType "application/json" -Body (@{
    email = $adminEmail
    password = $adminPassword
    returnSecureToken = $true
} | ConvertTo-Json)

$idToken = $firebaseResponse.idToken
if ([string]::IsNullOrWhiteSpace($idToken)) {
    throw "Firebase Auth did not return an idToken for admin."
}

$Context.AdminIdToken = $idToken
$Context.AdminHeaders = @{ Authorization = "Bearer $idToken" }
$Context.DefaultHeaders = $Context.AdminHeaders

$Context.AdminMe = Invoke-Json -Context $Context -Method Get -Path "/api/v1/auth/me"
Assert-Equal -Actual $Context.AdminMe.user.email -Expected $adminEmail -Message "Current admin email mismatch."
