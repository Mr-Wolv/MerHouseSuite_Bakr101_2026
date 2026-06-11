$ErrorActionPreference = "Stop"

function Test-AbsoluteHttpUrl {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $false
    }

    $uri = $null
    if (-not [System.Uri]::TryCreate($Value, [System.UriKind]::Absolute, [ref]$uri)) {
        return $false
    }

    return $uri.Scheme -in @("http", "https")
}

function Assert-AbsoluteHttpUrl {
    param(
        [Parameter(Mandatory = $true)] [string]$Name,
        [string]$Value
    )

    $trimmed = if ($null -eq $Value) { "" } else { $Value.TrimEnd("/") }
    if (-not (Test-AbsoluteHttpUrl $trimmed)) {
        if ([string]::IsNullOrWhiteSpace($trimmed)) {
            throw "$Name must be a non-blank absolute http or https URL."
        }
        throw "$Name must be a non-blank absolute http or https URL. Received: $Value"
    }

    return $trimmed
}
