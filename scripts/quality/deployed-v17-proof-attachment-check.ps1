param(
    [string]$OutputDirectory = "reports"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$resolvedOutputDirectory = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
    [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
}
New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null

$validAlertPath = Join-Path $resolvedOutputDirectory "v17-alert-routing-proof-check-valid.json"
$wrongAlertPath = Join-Path $resolvedOutputDirectory "v17-alert-routing-proof-check-wrong.json"

@{
    schema = "merhouse.v17.alert-routing.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://api.example.com"
    routedSignals = @("api-health", "frontend-health", "failed-provider-delivery")
    deliveryEvidence = "operator-confirmed-alert-routing-fixture"
    secretPolicy = "No provider credentials or alert endpoints are stored in this parser proof fixture."
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $validAlertPath -Encoding utf8

@{
    schema = "merhouse.load-smoke.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $wrongAlertPath -Encoding utf8

$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $PSScriptRoot "deployed-v17-proof.ps1"),
    [ref]$tokens,
    [ref]$parseErrors
)
if ($parseErrors.Count -gt 0) {
    throw "deployed-v17-proof.ps1 has parse errors."
}
$resolverFunction = $ast.Find({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq "Resolve-EvidenceAttachment"
}, $true)
if ($null -eq $resolverFunction) {
    throw "Could not find Resolve-EvidenceAttachment in deployed-v17-proof.ps1."
}
$validationFunctions = $resolverFunction.Extent.Text

function Invoke-AttachmentResolver {
    param(
        [string]$Name,
        [string]$Path
    )

    $escapedRoot = $projectRoot.Path.Replace("'", "''")
    $escapedPath = $Path.Replace("'", "''")
    $scriptBlock = [scriptblock]::Create(@"
`$projectRoot = Resolve-Path '$escapedRoot'
$validationFunctions
Resolve-EvidenceAttachment -Name '$Name' -Path '$escapedPath' | ConvertTo-Json -Depth 6
"@)
    & $scriptBlock
}

$resolved = Invoke-AttachmentResolver -Name "AlertRoutingManifestPath" -Path $validAlertPath | ConvertFrom-Json
if ($resolved.schema -ne "merhouse.v17.alert-routing.v1") {
    throw "Valid alert-routing attachment did not resolve with the expected schema."
}
if ($resolved.frontendBaseUrl -ne "https://app.example.com" -or $resolved.apiBaseUrl -ne "https://api.example.com") {
    throw "Valid alert-routing attachment did not preserve deployed target URLs."
}

$failedAsExpected = $false
try {
    Invoke-AttachmentResolver -Name "AlertRoutingManifestPath" -Path $wrongAlertPath | Out-Null
} catch {
    if ($_.Exception.Message -match "AlertRoutingManifestPath schema must be one of") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Wrong-schema alert-routing attachment was accepted."
}

Write-Host "Deployed V17 proof attachment schema check passed."
