param(
    [Parameter(Mandatory = $true)] [string]$FrontendBaseUrl,
    [Parameter(Mandatory = $true)] [string]$ApiBaseUrl,
    [Parameter(Mandatory = $true)] [string]$ApiHealthEvidence,
    [Parameter(Mandatory = $true)] [string]$FrontendHealthEvidence,
    [Parameter(Mandatory = $true)] [string]$FailedProviderDeliveryEvidence,
    [Parameter(Mandatory = $true)] [string]$DeliveryEvidence,
    [string]$OutputPath = "",
    [switch]$ConfirmAlertRoutingProof
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmAlertRoutingProof) {
    throw "Re-run with -ConfirmAlertRoutingProof only after staging or production alert routing was observed without storing credentials, endpoints, or provider logs."
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "url-guard-lib.ps1")

function Assert-SafeEvidenceText {
    param(
        [string]$Name,
        [string]$Value,
        [int]$MinLength = 24
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "$Name must be non-blank evidence text."
    }
    $trimmed = $Value.Trim()
    if ($trimmed.Length -lt $MinLength -or $trimmed -match '(?i)^(ok|done|passed|tested|confirmed|yes|n/a|na|proof|verified)$') {
        throw "$Name is too vague for V17 proof; use a short non-secret ticket, monitor, route, or operator-confirmed evidence reference."
    }
    if ($trimmed.Length -gt 240) {
        throw "$Name must be a short proof reference, not a copied alert payload or log."
    }
    if ($trimmed -match '(?i)(password|authorization|bearer|api[_ -]?key|secret|credential|webhook|endpoint|smtp[_ -]?pass|private[_ -]?url)') {
        throw "$Name must not include secret, credential, endpoint, webhook, password, or copied provider-log values."
    }
    if ($trimmed -match '(?i)(provider[_ -]?log|alert[_ -]?payload|raw[_ -]?payload|webhook[_ -]?payload|webhook[_ -]?body|notification[_ -]?body|delivery[_ -]?transcript|http[_ -]?transcript|request[_ -]?body|response[_ -]?body)') {
        throw "$Name must not include copied provider logs, alert payloads, webhook bodies, delivery transcripts, or request/response bodies."
    }
    if ($trimmed -match '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b') {
        throw "$Name must not include recipient or operator email addresses."
    }
    if ($trimmed -match '(?i)\bBearer\s+[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+' -or
        $trimmed -match '(?i)[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}' -or
        $trimmed -match '(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|signing[_-]?secret)\s*[:=]\s*[''"]?[A-Za-z0-9_./+=:-]{16,}') {
        throw "$Name must not include token-shaped data."
    }
    return $trimmed
}

$normalizedFrontendBaseUrl = Assert-AbsoluteHttpUrl -Name "FrontendBaseUrl" -Value $FrontendBaseUrl
$normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
if (-not $normalizedFrontendBaseUrl.StartsWith("https://")) {
    throw "FrontendBaseUrl must be an HTTPS deployment URL for V17 alert routing proof."
}
if (-not $normalizedApiBaseUrl.StartsWith("https://")) {
    throw "ApiBaseUrl must be an HTTPS deployment URL for V17 alert routing proof."
}

$apiHealthEvidenceText = Assert-SafeEvidenceText -Name "ApiHealthEvidence" -Value $ApiHealthEvidence
$frontendHealthEvidenceText = Assert-SafeEvidenceText -Name "FrontendHealthEvidence" -Value $FrontendHealthEvidence
$failedProviderDeliveryEvidenceText = Assert-SafeEvidenceText -Name "FailedProviderDeliveryEvidence" -Value $FailedProviderDeliveryEvidence
$deliveryEvidenceText = Assert-SafeEvidenceText -Name "DeliveryEvidence" -Value $DeliveryEvidence

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = ".\reports\v17-alert-routing-proof-$timestamp.json"
}
$resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    [System.IO.Path]::GetFullPath($OutputPath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null

$report = [ordered]@{
    schema = "merhouse.v17.alert-routing.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = $normalizedFrontendBaseUrl
    apiBaseUrl = $normalizedApiBaseUrl
    routedSignals = @("api-health", "frontend-health", "failed-provider-delivery")
    signalEvidence = [ordered]@{
        "api-health" = $apiHealthEvidenceText
        "frontend-health" = $frontendHealthEvidenceText
        "failed-provider-delivery" = $failedProviderDeliveryEvidenceText
    }
    deliveryEvidence = $deliveryEvidenceText
    secretPolicy = "No alert provider credentials, endpoints, webhooks, provider logs, deployment env values, or copied alert payloads are stored in this proof artifact."
}

$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resolvedOutputPath -Encoding utf8

Write-Host "V17 alert routing proof manifest: $resolvedOutputPath"
Write-Host "V17 alert routing proof completed."
