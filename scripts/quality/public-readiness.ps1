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
    Write-Host "Checking publication-shaped CI naming..."
    $workflowPath = Join-Path $projectRoot ".github\workflows\ci.yml"
    if (Test-Path -LiteralPath $workflowPath) {
        $workflowText = Get-Content -Raw -LiteralPath $workflowPath
        if ($workflowText -notmatch '(?m)^name:\s*MerHouse Quality Gate\s*$') {
            throw "GitHub Actions workflow name must be 'MerHouse Quality Gate'."
        }
        if ($workflowText -notmatch '(?m)^run-name:\s*MerHouse Quality Gate\b') {
            throw "GitHub Actions visible run title must begin with 'MerHouse Quality Gate'."
        }
    }
    Write-Host "CI naming check passed."

    Write-Host ""
    Write-Host "Checking backend/ and frontend/ for forbidden sensitive files..."
    $forbiddenFiles = Get-ChildItem -Path backend, frontend -Recurse -Force -File |
        Where-Object {
            $_.FullName -notmatch "\\frontend\\node_modules\\" -and
            $_.FullName -notmatch "\\frontend\\dist\\" -and
            $_.FullName -notmatch "\\backend\\target\\" -and
            (
                $_.Name -match '^\.env(\..*)?$' -or
                $_.Extension -in @(".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".kubeconfig")
            )
        }
    if ($forbiddenFiles) {
        $forbiddenFiles | ForEach-Object { $_.FullName }
        throw "Forbidden sensitive files found inside backend/ or frontend/."
    }
    Write-Host "Sensitive-file boundary check passed."

    Write-Host ""
    Write-Host "Scanning backend/ and frontend/ publication boundary for high-confidence sensitive patterns..."
    $patterns = @(
        'AKIA[0-9A-Z]{16}',
        'AIza[0-9A-Za-z_-]{35}',
        'ghp_[0-9A-Za-z]{36,}',
        'github_pat_[0-9A-Za-z_]{80,}',
        'glpat-[0-9A-Za-z_-]{20,}',
        'sk-[A-Za-z0-9_-]{24,}',
        'sk-ant-api[0-9A-Za-z_-]{20,}',
        'xai-[A-Za-z0-9_-]{20,}',
        'gsk_[A-Za-z0-9_-]{20,}',
        'hf_[A-Za-z0-9]{30,}',
        'sk_live_[0-9A-Za-z]{20,}',
        'rk_live_[0-9A-Za-z]{20,}',
        'SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}',
        'xox[baprs]-[0-9A-Za-z-]{20,}',
        'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}',
        '-----BEGIN (RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----',
        '(?i)(mongodb(\+srv)?|mysql|mariadb|sqlserver|redis|amqp|kafka|postgres(ql)?)://[^\s''"]+:[^\s''"]+@',
        'postgres(ql)?://[^\s]+:[^\s]+@',
        '(?i)(OPENAI|ANTHROPIC|GEMINI|GOOGLE_AI|GROQ|MISTRAL|COHERE|HUGGINGFACE|HF|XAI|AZURE_OPENAI|STRIPE|PAYPAL|TWILIO|SENDGRID|MAILGUN|SLACK|AWS|AZURE|GCP|GOOGLE|SENTRY|DATADOG)[A-Z0-9_.-]*(API[_-]?KEY|TOKEN|SECRET|KEY|PASSWORD)\s*[:=]\s*[''"][^''"]{8,}[''"]',
        '(?i)(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|webhook[_-]?secret|private[_-]?key|signing[_-]?secret)\s*[:=]\s*[''"][A-Za-z0-9_./+=:-]{16,}[''"]',
        '\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b',
        '\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b'
    )
    $matches = @()
    foreach ($pattern in $patterns) {
        $result = rg -n --pcre2 --glob '!frontend/node_modules/**' --glob '!backend/target/**' --glob '!frontend/dist/**' -- $pattern backend frontend 2>$null
        if ($LASTEXITCODE -eq 0) {
            $matches += $result
        } elseif ($LASTEXITCODE -eq 1) {
            $global:LASTEXITCODE = 0
        } else {
            throw "Sensitive-pattern scan failed while checking pattern: $pattern"
        }
    }
    if ($matches.Count -gt 0) {
        $matches | Sort-Object -Unique
        throw "Sensitive-pattern scan found publication-boundary matches that need review."
    }
    Write-Host "Sensitive-pattern scan passed."

    if (-not $SkipCompose) {
        Invoke-Checked "Validating Docker Compose config..." { docker compose --env-file .env.example config --quiet }
    }
} finally {
    Pop-Location
}

exit 0
