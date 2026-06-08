param(
    [switch]$IncludeE2E,
    [switch]$IncludeApiSmoke,
    [switch]$SkipCompose
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$dossierPath = Join-Path $projectRoot "docs\architecture\deployment-ready-local-certification.md"

function Assert-FileContains {
    param(
        [Parameter(Mandatory = $true)] [string] $Path,
        [Parameter(Mandatory = $true)] [string] $Pattern,
        [Parameter(Mandatory = $true)] [string] $Message
    )

    if (-not (Select-String -Path $Path -Pattern $Pattern -Quiet)) {
        throw $Message
    }
}

Write-Host "Checking V16 deployment-ready local certification dossier..."
if (-not (Test-Path $dossierPath)) {
    throw "Missing deployment-ready local certification dossier at $dossierPath"
}

Assert-FileContains -Path $dossierPath -Pattern "V16 is not a SaaS launch" -Message "Dossier must state that V16 is not a SaaS launch."
Assert-FileContains -Path $dossierPath -Pattern "Local Mock Contracts" -Message "Dossier must define local mock contracts."
Assert-FileContains -Path $dossierPath -Pattern "Account Settings" -Message "Dossier must include account settings scope."
Assert-FileContains -Path $dossierPath -Pattern "Future Activation Checklist" -Message "Dossier must include future activation checklist."

Write-Host "Running markdown proof..."
& (Join-Path $PSScriptRoot "markdown-check.ps1")

Write-Host "Running publication/readiness boundary proof..."
& (Join-Path $PSScriptRoot "public-readiness.ps1") -SkipCompose:$SkipCompose

Write-Host "Running mobile/PWA installability proof..."
& (Join-Path $PSScriptRoot "pwa-check.ps1")

Write-Host "Running broad local quality gate..."
& (Join-Path $PSScriptRoot "check.ps1") -IncludeE2E:$IncludeE2E -SkipCompose:$SkipCompose

if ($IncludeApiSmoke) {
    Write-Host "Running API smoke proof..."
    & (Join-Path $PSScriptRoot "api-smoke.ps1")
} else {
    Write-Host "Skipping API smoke proof. Pass -IncludeApiSmoke when the seeded local stack is available."
}

Write-Host "Deployment-ready local certification gate passed."
