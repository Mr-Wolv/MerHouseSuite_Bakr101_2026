function Invoke-Json {
    param(
        [Parameter(Mandatory = $true)] [hashtable] $Context,
        [Parameter(Mandatory = $true)] [string] $Method,
        [Parameter(Mandatory = $true)] [string] $Path,
        $Body = $null,
        [hashtable] $Headers = @{}
    )

    $uri = "$($Context.BaseUrl)$Path"
    $effectiveHeaders = @{}
    if ($Context.DefaultHeaders) {
        foreach ($key in $Context.DefaultHeaders.Keys) {
            $effectiveHeaders[$key] = $Context.DefaultHeaders[$key]
        }
    }
    foreach ($key in $Headers.Keys) {
        $effectiveHeaders[$key] = $Headers[$key]
    }

    $parameters = @{
        Method = $Method
        Uri = $uri
    }

    if ($effectiveHeaders.Count -gt 0) {
        $parameters.Headers = $effectiveHeaders
    }

    if ($null -ne $Body) {
        $parameters.ContentType = "application/json"
        $parameters.Body = $Body | ConvertTo-Json -Depth 8
    }

    Invoke-RestMethod @parameters
}

function Invoke-ExpectedHttpFailure {
    param(
        [Parameter(Mandatory = $true)] [string] $Method,
        [Parameter(Mandatory = $true)] [string] $Path,
        $Body = $null,
        [hashtable] $Headers = @{},
        [int] $ExpectedStatus = 0,
        [int[]] $ExpectedStatuses = @()
    )

    $acceptedStatuses = @($ExpectedStatuses)
    if ($acceptedStatuses.Count -eq 0 -and $ExpectedStatus -gt 0) {
        $acceptedStatuses = @($ExpectedStatus)
    }
    if ($acceptedStatuses.Count -eq 0) {
        throw "Expected at least one HTTP status for $Method $Path."
    }
    $expectedStatusText = $acceptedStatuses -join " or "

    $uri = "$($Context.BaseUrl)$Path"
    $effectiveHeaders = @{}
    if ($Context.DefaultHeaders) {
        foreach ($key in $Context.DefaultHeaders.Keys) {
            $effectiveHeaders[$key] = $Context.DefaultHeaders[$key]
        }
    }
    foreach ($key in $Headers.Keys) {
        $effectiveHeaders[$key] = $Headers[$key]
    }

    $parameters = @{
        Method = $Method
        Uri = $uri
    }
    if ($effectiveHeaders.Count -gt 0) {
        $parameters.Headers = $effectiveHeaders
    }
    if ($null -ne $Body) {
        $parameters.ContentType = "application/json"
        $parameters.Body = $Body | ConvertTo-Json -Depth 8
    }

    try {
        Invoke-RestMethod @parameters | Out-Null
        throw "Expected HTTP $expectedStatusText for $Method $Path, but request succeeded."
    } catch {
        if (-not $_.Exception.Response) {
            throw
        }
        $actualStatus = [int]$_.Exception.Response.StatusCode
        if ($acceptedStatuses -notcontains $actualStatus) {
            throw "Unexpected status for $Method $Path. Expected HTTP $expectedStatusText, got HTTP $actualStatus."
        }
    }
}
