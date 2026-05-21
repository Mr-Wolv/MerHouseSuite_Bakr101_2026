param(
    [switch]$SkipCompose
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host ""
    Write-Host $Label
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed."
    }
}

Push-Location $projectRoot
try {
    Invoke-Checked "Checking diff whitespace..." { git diff --check }

    Write-Host ""
    Write-Host "Checking publication boundaries..."
    $ignoreOutput = git check-ignore -v frontend/tests/e2e/full-tour.spec.ts frontend/playwright.config.ts 2>$null
    $frontendIgnored = $ignoreOutput | Where-Object { $_ -match "frontend/(tests/e2e|playwright\.config\.ts)" }
    if ($frontendIgnored) {
        throw "Frontend Playwright tests or config are still ignored."
    }
    Write-Host "Publication boundary check passed."

    Write-Host ""
    Write-Host "Scanning public source for high-confidence secret patterns..."
    $patterns = @(
        'AKIA[0-9A-Z]{16}',
        'AIza[0-9A-Za-z_-]{35}',
        'ghp_[0-9A-Za-z]{36,}',
        'github_pat_[0-9A-Za-z_]{80,}',
        '-----BEGIN (RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----',
        'postgres(ql)?://[^\s]+:[^\s]+@'
    )
    $matches = @()
    foreach ($pattern in $patterns) {
        $result = rg -n --pcre2 --glob '!frontend/node_modules/**' --glob '!backend/target/**' --glob '!frontend/dist/**' --glob '!reports/**' --glob '!.github/workflows/ci-proof-reports/**' -- $pattern . 2>$null
        if ($LASTEXITCODE -eq 0) {
            $matches += $result
        } elseif ($LASTEXITCODE -eq 1) {
            $global:LASTEXITCODE = 0
        } else {
            throw "Secret-pattern scan failed while checking pattern: $pattern"
        }
    }
    if ($matches.Count -gt 0) {
        $matches | Sort-Object -Unique
        throw "Secret-pattern scan found public-source matches that need review."
    }
    Write-Host "Secret-pattern scan passed."

    Write-Host ""
    Write-Host "Checking public docs for private/proof residue..."
    $docMatches = rg -n "(?i)(SECURITY\.md|CONTRIBUTING\.md|pre-v13|public-exposure-checkup|repository-publication-hardening|security-assurance|vulnerability report|do not publish)" README.md AGENTS.md docs .github 2>$null
    if ($LASTEXITCODE -eq 0) {
        $docMatches
        throw "Public docs contain stale private/proof wording."
    } elseif ($LASTEXITCODE -eq 1) {
        $global:LASTEXITCODE = 0
    } else {
        throw "Public doc residue scan failed."
    }
    Write-Host "Public doc residue scan passed."

    if (-not $SkipCompose) {
        Invoke-Checked "Validating Docker Compose config..." { docker compose --env-file .env.example config --quiet }
    }
} finally {
    Pop-Location
}

exit 0
