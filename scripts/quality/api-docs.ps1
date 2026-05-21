param(
    [string] $BaseUrl = "http://localhost:8080",
    [switch] $Login,
    [string] $AdminEmail = "admin@merhouse.local",
    [string] $AdminPassword = "local-owner-password",
    [switch] $Deploy,
    [switch] $NoOpen
)

$ErrorActionPreference = "Stop"

function Join-Url {
    param(
        [Parameter(Mandatory = $true)] [string] $Root,
        [Parameter(Mandatory = $true)] [string] $Path
    )

    "$($Root.TrimEnd('/'))/$($Path.TrimStart('/'))"
}

$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$swaggerUrl = Join-Url -Root $normalizedBaseUrl -Path "/swagger-ui.html"
$jsonUrl = Join-Url -Root $normalizedBaseUrl -Path "/v3/api-docs"
$yamlUrl = Join-Url -Root $normalizedBaseUrl -Path "/v3/api-docs.yaml"
$groupedJsonUrl = Join-Url -Root $normalizedBaseUrl -Path "/v3/api-docs/merhouse-v1"

if ($Deploy) {
    Write-Host "Deploying the Docker stack before opening API docs..."
    & (Join-Path $PSScriptRoot "..\local\start.ps1")
    Write-Host ""
}

Write-Host "Checking API docs at $jsonUrl"

try {
    Invoke-WebRequest -Uri $jsonUrl -Method Get -UseBasicParsing -TimeoutSec 10 | Out-Null
} catch {
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $statusCode = [int] $_.Exception.Response.StatusCode
    }

    if ($statusCode -eq 403) {
        Write-Error @"
The backend responded with 403 for $jsonUrl.

That usually means an older backend is still running without the Swagger security permit.
Restart or rebuild it, or let this helper do it:
  .\scripts\quality\api-docs.ps1 -Deploy

Original error:
$($_.Exception.Message)
"@
    }

    Write-Error @"
Could not reach the OpenAPI endpoint at $jsonUrl.

Make sure the backend is running first. For the full local stack:
  .\scripts\local\start.ps1

Or run this helper with:
  .\scripts\quality\api-docs.ps1 -Deploy

Original error:
$($_.Exception.Message)
"@
}

Write-Host ""
Write-Host "Swagger UI:       $swaggerUrl"
Write-Host "OpenAPI JSON:     $jsonUrl"
Write-Host "OpenAPI YAML:     $yamlUrl"
Write-Host "V1 grouped JSON:  $groupedJsonUrl"
Write-Host ""
if ($Login) {
    $loginUrl = Join-Url -Root $normalizedBaseUrl -Path "/api/v1/auth/login"
    Write-Host "Logging in as $AdminEmail..."

    $loginResponse = Invoke-RestMethod `
        -Uri $loginUrl `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{
            email = $AdminEmail
            password = $AdminPassword
        } | ConvertTo-Json)

    if ([string]::IsNullOrWhiteSpace($loginResponse.accessToken)) {
        throw "Login succeeded but did not return an accessToken."
    }

    Write-Host ""
    Write-Host "Swagger bearer token:"
    Write-Host $loginResponse.accessToken
    Write-Host ""
    Write-Host "In Swagger UI, click Authorize and paste this token into bearerAuth."
    Write-Host "This helper prints the token only; it does not copy or write it."
} else {
    Write-Host "For protected endpoints, run with -Login to print a token for Swagger Authorize:"
    Write-Host "  .\scripts\quality\api-docs.ps1 -Login"
    Write-Host "This helper does not copy or write tokens."
}

if (-not $NoOpen) {
    Write-Host ""
    Write-Host "Opening Swagger UI..."
    Start-Process $swaggerUrl
}
