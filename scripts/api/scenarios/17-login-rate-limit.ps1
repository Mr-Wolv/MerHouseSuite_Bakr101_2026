param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "36. Verifying login rate limiting"

$rateLimitEmail = "rate-limit-probe-$($Context.Suffix)@merhouse.local"

Write-Host "  Sending 5 failed login attempts for $rateLimitEmail"
for ($i = 1; $i -le 5; $i++) {
    Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/auth/login" -ExpectedStatus 401 -Body @{
        email = $rateLimitEmail
        password = "deliberately-wrong-password-$i"
    }
}

Write-Host "  Verifying 6th attempt returns 429 with Retry-After"
$uri = "$($Context.BaseUrl)/api/v1/auth/login"
$rateLimited = $false
try {
    Invoke-WebRequest -Method Post -Uri $uri -ContentType "application/json" -Body (@{
        email = $rateLimitEmail
        password = "deliberately-wrong-password-6"
    } | ConvertTo-Json)
} catch {
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        if ($statusCode -ne 429) {
            throw "Expected HTTP 429 after 6 failed logins, got HTTP $statusCode."
        }
        $retryAfter = $_.Exception.Response.Headers["Retry-After"]
        if (-not $retryAfter) {
            throw "HTTP 429 response is missing Retry-After header."
        }
        Write-Host "  Rate limit enforced: HTTP 429, Retry-After: $retryAfter s"
        $rateLimited = $true
    } else {
        throw
    }
}
if (-not $rateLimited) {
    throw "Expected HTTP 429 after 6 failed logins, but request succeeded."
}

Write-Host "  Verifying rate limit is per-email (different email still works)"
$isolatedLogin = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $Context.MerchantUser.email
    password = "merchant-password"
}
Assert-NotBlank -Value $isolatedLogin.accessToken -Message "Rate-limited email blocked a different account login."

Write-Host "Login rate limiting verified."
