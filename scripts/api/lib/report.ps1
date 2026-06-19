function Redact-AuthResponse {
    param($Response)

    if ($null -eq $Response) {
        return $null
    }

    [ordered]@{
        user = $Response.user
        tokenType = "Bearer"
        idToken = "[redacted]"
    }
}

function New-SmokeReport {
    param([hashtable]$Context)

    [ordered]@{
        status    = "passed"
        timestamp = (Get-Date -Format "o")
        target    = $Context.BaseUrl
        merchant  = $Context.Merchant.id
        warehouse = $Context.Warehouse.id
        item      = $Context.Item.id
        order     = $Context.Order.id
        suffix    = $Context.Suffix
    }
}

function New-SmokeSummary {
    param([hashtable]$Context, $Report)

    $lines = @(
        "# API Smoke Test Summary",
        "",
        "- **Status:** $($Report.status)",
        "- **Timestamp:** $($Report.timestamp)",
        "- **Target:** $($Report.target)",
        "- **Merchant Tenant:** $($Report.merchant)",
        "- **Warehouse:** $($Report.warehouse)",
        "- **Item:** $($Report.item)",
        "- **Order:** $($Report.order)",
        ""
    )
    $lines -join "`n"
}
