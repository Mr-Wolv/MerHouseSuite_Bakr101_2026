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
$validWalkthroughPath = Join-Path $resolvedOutputDirectory "v17-live-walkthrough-proof-check-valid.json"
$wrongWalkthroughPath = Join-Path $resolvedOutputDirectory "v17-live-walkthrough-proof-check-wrong.json"
$validAndroidReleasePath = Join-Path $resolvedOutputDirectory "v17-android-release-proof-check-valid.json"
$wrongAndroidReleasePath = Join-Path $resolvedOutputDirectory "v17-android-release-proof-check-wrong.json"
$validAndroidArtifactPath = Join-Path $resolvedOutputDirectory "v17-android-release-proof-check.aab"
$wrongAndroidArtifactPath = Join-Path $resolvedOutputDirectory "v17-android-release-proof-check-wrong.aab"

Set-Content -LiteralPath $validAndroidArtifactPath -Value "fixture signed Android artifact" -Encoding utf8
Set-Content -LiteralPath $wrongAndroidArtifactPath -Value "changed Android artifact" -Encoding utf8
$validAndroidArtifactHash = (Get-FileHash -LiteralPath $validAndroidArtifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
$validAndroidArtifactBytes = (Get-Item -LiteralPath $validAndroidArtifactPath).Length

@{
    schema = "merhouse.v17.android-release.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    apiBaseUrl = "https://api.example.com"
    artifactKind = "aab"
    artifactPath = $validAndroidArtifactPath
    sha256 = $validAndroidArtifactHash
    bytes = $validAndroidArtifactBytes
    cleartextTraffic = "disabled-for-release"
    signing = "external-keystore-env"
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $validAndroidReleasePath -Encoding utf8

@{
    schema = "merhouse.v17.android-release.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    apiBaseUrl = "https://api.example.com"
    artifactKind = "aab"
    artifactPath = $wrongAndroidArtifactPath
    sha256 = $validAndroidArtifactHash
    bytes = $validAndroidArtifactBytes
    cleartextTraffic = "true"
    signing = "embedded-keystore"
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $wrongAndroidReleasePath -Encoding utf8

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

@{
    schema = "merhouse.v17.live-stakeholder-walkthrough.v1"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://api.example.com"
    browserWalkthroughCompleted = $true
    installedAndroidWalkthroughCompleted = $true
    rolesCovered = @("owner", "merchant", "warehouse", "support-admin", "auditor")
    reviewer = "local-proof-fixture"
    secretPolicy = "No smoke credentials, screenshots, or private endpoint tokens are stored in this parser proof fixture."
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $validWalkthroughPath -Encoding utf8

@{
    schema = "merhouse.v17.live-stakeholder-walkthrough.v1"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://api.example.com"
    browserWalkthroughCompleted = $true
    installedAndroidWalkthroughCompleted = $false
    rolesCovered = @("owner", "merchant")
    reviewer = "local-proof-fixture"
    secretPolicy = "No smoke credentials are stored."
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $wrongWalkthroughPath -Encoding utf8

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

$androidRelease = Invoke-AttachmentResolver -Name "AndroidReleaseManifestPath" -Path $validAndroidReleasePath | ConvertFrom-Json
if ($androidRelease.schema -ne "merhouse.v17.android-release.v1") {
    throw "Valid Android release attachment did not resolve with the expected schema."
}
if ($androidRelease.apiBaseUrl -ne "https://api.example.com" -or $androidRelease.artifactKind -ne "aab") {
    throw "Valid Android release attachment did not preserve release target metadata."
}
if ($androidRelease.sha256 -ne $validAndroidArtifactHash -or [long]$androidRelease.bytes -ne $validAndroidArtifactBytes) {
    throw "Valid Android release attachment did not preserve artifact hash and size."
}

$resolved = Invoke-AttachmentResolver -Name "AlertRoutingManifestPath" -Path $validAlertPath | ConvertFrom-Json
if ($resolved.schema -ne "merhouse.v17.alert-routing.v1") {
    throw "Valid alert-routing attachment did not resolve with the expected schema."
}
if ($resolved.frontendBaseUrl -ne "https://app.example.com" -or $resolved.apiBaseUrl -ne "https://api.example.com") {
    throw "Valid alert-routing attachment did not preserve deployed target URLs."
}

$walkthrough = Invoke-AttachmentResolver -Name "LiveStakeholderWalkthroughManifestPath" -Path $validWalkthroughPath | ConvertFrom-Json
if ($walkthrough.schema -ne "merhouse.v17.live-stakeholder-walkthrough.v1") {
    throw "Valid live walkthrough attachment did not resolve with the expected schema."
}
if ($walkthrough.frontendBaseUrl -ne "https://app.example.com" -or $walkthrough.apiBaseUrl -ne "https://api.example.com") {
    throw "Valid live walkthrough attachment did not preserve deployed target URLs."
}

$failedAsExpected = $false
try {
    Invoke-AttachmentResolver -Name "AndroidReleaseManifestPath" -Path $wrongAndroidReleasePath | Out-Null
} catch {
    if ($_.Exception.Message -match "sha256 must match artifactPath content") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Wrong Android release artifact attachment was accepted."
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

$failedAsExpected = $false
try {
    Invoke-AttachmentResolver -Name "LiveStakeholderWalkthroughManifestPath" -Path $wrongWalkthroughPath | Out-Null
} catch {
    if ($_.Exception.Message -match "installedAndroidWalkthroughCompleted") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Incomplete live walkthrough attachment was accepted."
}

Write-Host "Deployed V17 proof attachment schema check passed."
