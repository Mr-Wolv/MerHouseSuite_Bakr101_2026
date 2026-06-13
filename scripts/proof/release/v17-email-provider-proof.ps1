param(
    [Parameter(Mandatory = $true)] [string]$FrontendBaseUrl,
    [Parameter(Mandatory = $true)] [string]$ApiBaseUrl,
    [Parameter(Mandatory = $true)] [string]$ProviderStatus,
    [Parameter(Mandatory = $true)] [string]$PasswordRecoveryEvidence,
    [Parameter(Mandatory = $true)] [string]$AccessRequestEvidence,
    [Parameter(Mandatory = $true)] [string]$NotificationEmailEvidence,
    [Parameter(Mandatory = $true)] [string]$DeliveryEvidence,
    [string]$OutputPath = "",
    [switch]$ConfirmProviderProof
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmProviderProof) {
    throw "Re-run with -ConfirmProviderProof only after staging or production email delivery was observed without storing tokens, credentials, or message bodies."
}

. (Join-Path $PSScriptRoot "..\..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
. (Join-Path $PSScriptRoot "..\lib\url-guard-lib.ps1")

function Assert-ProvenProviderStatus {
    param([string]$Value)

    $normalized = if ($null -eq $Value) { "" } else { $Value.Trim().ToLowerInvariant() }
    if ($normalized -notin @("smtp-staging-proven", "smtp-production-proven", "email-provider-proven")) {
        throw "ProviderStatus must be smtp-staging-proven, smtp-production-proven, or email-provider-proven."
    }
    return $normalized
}

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
        throw "$Name is too vague for V17 proof; use a short non-secret ticket, mailbox, provider, or operator-confirmed evidence reference."
    }
    if ($trimmed.Length -gt 240) {
        throw "$Name must be a short proof reference, not a copied message body or log."
    }
    if ($trimmed -match '(?i)(password|reset[_ -]?token|otp|one[_ -]?time|authorization|bearer|api[_ -]?key|secret|credential|smtp[_ -]?pass)') {
        throw "$Name must not include secret, token, credential, OTP, password, or message-body values."
    }
    if ($trimmed -match '(?i)(message[_ -]?body|provider[_ -]?log|smtp[_ -]?log|smtp[_ -]?transcript|email[_ -]?header|message[_ -]?id|raw[_ -]?email)') {
        throw "$Name must not include copied message bodies, provider logs, SMTP transcripts, email headers, message IDs, or raw email content."
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
    throw "FrontendBaseUrl must be an HTTPS deployment URL for V17 email provider proof."
}
if (-not $normalizedApiBaseUrl.StartsWith("https://")) {
    throw "ApiBaseUrl must be an HTTPS deployment URL for V17 email provider proof."
}
$normalizedProviderStatus = Assert-ProvenProviderStatus -Value $ProviderStatus

$passwordRecoveryEvidenceText = Assert-SafeEvidenceText -Name "PasswordRecoveryEvidence" -Value $PasswordRecoveryEvidence
$accessRequestEvidenceText = Assert-SafeEvidenceText -Name "AccessRequestEvidence" -Value $AccessRequestEvidence
$notificationEmailEvidenceText = Assert-SafeEvidenceText -Name "NotificationEmailEvidence" -Value $NotificationEmailEvidence
$deliveryEvidenceText = Assert-SafeEvidenceText -Name "DeliveryEvidence" -Value $DeliveryEvidence

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = ".\reports\v17-email-provider-proof-$timestamp.json"
}
$resolvedOutputPath = Resolve-MerHousePath -Path $OutputPath -ProjectRoot $projectRoot
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null

$report = [ordered]@{
    schema = "merhouse.v17.email-provider-proof.v1"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = $normalizedFrontendBaseUrl
    apiBaseUrl = $normalizedApiBaseUrl
    providerStatus = $normalizedProviderStatus
    workflowsProven = @("password-recovery", "access-request", "notification-email")
    workflowEvidence = [ordered]@{
        "password-recovery" = $passwordRecoveryEvidenceText
        "access-request" = $accessRequestEvidenceText
        "notification-email" = $notificationEmailEvidenceText
    }
    workflowProviderStatuses = [ordered]@{
        "password-recovery" = "SENT"
        "access-request" = "SENT"
        "notification-email" = "SENT"
    }
    deliveryEvidence = $deliveryEvidenceText
    secretPolicy = "No SMTP credentials, reset tokens, OTPs, invitation passwords, message bodies, provider logs, or deployment env values are stored in this proof artifact."
}

$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resolvedOutputPath -Encoding utf8

Write-Host "V17 email provider proof manifest: $resolvedOutputPath"
Write-Host "Provider status: $normalizedProviderStatus"
Write-Host "V17 email provider proof completed."
