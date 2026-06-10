param(
    [string]$WebReportPath = ".\reports\v16.2-loop-163-frontend-full-tour.json",
    [string]$NativeReportPath = ".\reports\v16.2-loop-163-native-tour.json"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "tour-report-lib.ps1")

function Assert-ExactRoleCoverage {
    param(
        [string]$Surface,
        [object[]]$Records,
        [string[]]$Roles
    )

    foreach ($role in $Roles) {
        $count = @($Records | Where-Object { $_.role -eq $role }).Count
        if ($count -eq 0) {
            throw "$Surface tour report is missing exact role coverage for $role."
        }
    }
}

function Assert-RolePathCoverage {
    param(
        [string]$Surface,
        [object[]]$Records,
        [object[]]$RequiredPairs
    )

    $pairs = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($record in $Records) {
        [void]$pairs.Add("$($record.role)|$(Normalize-TourReportPath (Get-TourReportRecordPath $record))")
    }

    $missing = New-Object System.Collections.Generic.List[string]
    foreach ($pair in $RequiredPairs) {
        $key = "$($pair.role)|$($pair.path)"
        if (-not $pairs.Contains($key)) {
            $missing.Add($key)
        }
    }

    if ($missing.Count -gt 0) {
        $sample = $missing | Select-Object -First 12
        throw "$Surface tour report is missing required role/path coverage for $($missing.Count) pair(s): $($sample -join ', ')"
    }
}

function Assert-WebStakeholderStateCoverage {
    param(
        [object[]]$Records
    )

    $requiredPairs = @(
        [pscustomobject]@{ role = "merchant"; state = "active" },
        [pscustomobject]@{ role = "merchant"; state = "empty" },
        [pscustomobject]@{ role = "warehouse"; state = "active" },
        [pscustomobject]@{ role = "warehouse"; state = "empty" }
    )

    foreach ($pair in $requiredPairs) {
        $count = @($Records | Where-Object { $_.role -eq $pair.role -and $_.stakeholderState -eq $pair.state }).Count
        if ($count -eq 0) {
            throw "Web tour report is missing exact stakeholder state coverage for $($pair.role)|$($pair.state)."
        }
    }
}

function Assert-NativeStakeholderStateCoverage {
    param(
        [object[]]$Records
    )

    $requiredPairs = @(
        [pscustomobject]@{ role = "MERCHANT_ACTIVE"; state = "active" },
        [pscustomobject]@{ role = "MERCHANT_EMPTY"; state = "empty" },
        [pscustomobject]@{ role = "WAREHOUSE_ACTIVE"; state = "active" },
        [pscustomobject]@{ role = "WAREHOUSE_EMPTY"; state = "empty" }
    )

    foreach ($pair in $requiredPairs) {
        $count = @($Records | Where-Object { $_.role -eq $pair.role -and (Get-TourReportStakeholderState $_) -eq $pair.state }).Count
        if ($count -eq 0) {
            throw "Native Android tour report is missing exact stakeholder state coverage for $($pair.role)|$($pair.state)."
        }
    }
}

function Assert-NativeStakeholderPathCoverage {
    param(
        [object[]]$Records
    )

    $requiredPairs = @(
        [pscustomobject]@{ role = "MERCHANT_ACTIVE"; state = "active"; path = "/merchant" },
        [pscustomobject]@{ role = "MERCHANT_ACTIVE"; state = "active"; path = "/merchant/inventory" },
        [pscustomobject]@{ role = "MERCHANT_ACTIVE"; state = "active"; path = "/merchant/orders" },
        [pscustomobject]@{ role = "MERCHANT_EMPTY"; state = "empty"; path = "/merchant" },
        [pscustomobject]@{ role = "MERCHANT_EMPTY"; state = "empty"; path = "/merchant/inventory" },
        [pscustomobject]@{ role = "MERCHANT_EMPTY"; state = "empty"; path = "/merchant/orders" },
        [pscustomobject]@{ role = "WAREHOUSE_ACTIVE"; state = "active"; path = "/warehouse" },
        [pscustomobject]@{ role = "WAREHOUSE_EMPTY"; state = "empty"; path = "/warehouse" }
    )

    foreach ($state in @("active", "empty")) {
        foreach ($role in @("MERCHANT", "WAREHOUSE")) {
            $exactRole = "${role}_$($state.ToUpperInvariant())"
            foreach ($path in @("/service-accountability", "/assistant", "/notifications", "/account")) {
                $requiredPairs += [pscustomobject]@{ role = $exactRole; state = $state; path = $path }
            }
        }
    }

    $available = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($record in $Records) {
        $state = Get-TourReportStakeholderState $record
        if ($state) {
            [void]$available.Add("$($record.role)|$state|$(Normalize-TourReportPath (Get-TourReportRecordPath $record))")
        }
    }

    $missing = New-Object System.Collections.Generic.List[string]
    foreach ($pair in $requiredPairs) {
        $key = "$($pair.role)|$($pair.state)|$($pair.path)"
        if (-not $available.Contains($key)) {
            $missing.Add($key)
        }
    }

    if ($missing.Count -gt 0) {
        $sample = $missing | Select-Object -First 12
        throw "Native Android tour report is missing required role/state/path coverage for $($missing.Count) pair(s): $($sample -join ', ')"
    }
}

function Assert-WebStakeholderPathCoverage {
    param(
        [object[]]$Records
    )

    $requiredPairs = @(
        [pscustomobject]@{ role = "merchant"; state = "active"; path = "/merchant" },
        [pscustomobject]@{ role = "merchant"; state = "active"; path = "/merchant/inventory" },
        [pscustomobject]@{ role = "merchant"; state = "active"; path = "/merchant/orders" },
        [pscustomobject]@{ role = "merchant"; state = "empty"; path = "/merchant" },
        [pscustomobject]@{ role = "merchant"; state = "empty"; path = "/merchant/inventory" },
        [pscustomobject]@{ role = "merchant"; state = "empty"; path = "/merchant/orders" },
        [pscustomobject]@{ role = "warehouse"; state = "active"; path = "/warehouse" },
        [pscustomobject]@{ role = "warehouse"; state = "empty"; path = "/warehouse" }
    )

    foreach ($state in @("active", "empty")) {
        foreach ($role in @("merchant", "warehouse")) {
            foreach ($path in @("/service-accountability", "/assistant", "/notifications", "/account")) {
                $requiredPairs += [pscustomobject]@{ role = $role; state = $state; path = $path }
            }
        }
    }

    $available = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($record in $Records) {
        if ($record.stakeholderState) {
            [void]$available.Add("$($record.role)|$($record.stakeholderState)|$(Normalize-TourReportPath (Get-TourReportRecordPath $record))")
        }
    }

    $missing = New-Object System.Collections.Generic.List[string]
    foreach ($pair in $requiredPairs) {
        $key = "$($pair.role)|$($pair.state)|$($pair.path)"
        if (-not $available.Contains($key)) {
            $missing.Add($key)
        }
    }

    if ($missing.Count -gt 0) {
        $sample = $missing | Select-Object -First 12
        throw "Web tour report is missing required role/state/path coverage for $($missing.Count) pair(s): $($sample -join ', ')"
    }
}

$webRecords = Read-TourReportRecords -ProjectRoot $projectRoot -Path $WebReportPath
$webReport = Read-TourReportDocument -ProjectRoot $projectRoot -Path $WebReportPath
$nativeReport = Read-TourReportDocument -ProjectRoot $projectRoot -Path $NativeReportPath
$nativeRecords = if ($nativeReport.records) { @($nativeReport.records) } else { @($nativeReport) }
$resolvedWebReportPath = Resolve-TourReportPath -ProjectRoot $projectRoot -Path $WebReportPath
$resolvedNativeReportPath = Resolve-TourReportPath -ProjectRoot $projectRoot -Path $NativeReportPath

Assert-CleanTourReportRecords -Surface "Web" -Records $webRecords -MinimumRecords 100
Assert-NoTopLevelBadRecords -Surface "Web" -Report $webReport
Assert-WebTourReportProvenance -Report $webReport -Records $webRecords
Assert-CleanTourReportRecords -Surface "Native Android" -Records $nativeRecords -MinimumRecords 80
Assert-NoTopLevelBadRecords -Surface "Native Android" -Report $nativeReport
Assert-NativeAndroidReportProvenance -Report $nativeReport -Records $nativeRecords
Assert-NativeScreenshotEvidence -ProjectRoot $projectRoot -Records $nativeRecords
Assert-WebStakeholderStateCoverage -Records $webRecords
Assert-WebStakeholderPathCoverage -Records $webRecords
Assert-NativeStakeholderStateCoverage -Records $nativeRecords
Assert-NativeStakeholderPathCoverage -Records $nativeRecords
Assert-ExactRoleCoverage -Surface "Native Android" -Records $nativeRecords -Roles @(
    "PUBLIC",
    "OWNER",
    "ADMIN",
    "SUPPORT",
    "AUDITOR",
    "MERCHANT_ACTIVE",
    "MERCHANT_EMPTY",
    "WAREHOUSE_ACTIVE",
    "WAREHOUSE_EMPTY"
)

$requiredNativePairs = @(
    [pscustomobject]@{ role = "PUBLIC"; path = "/login" },
    [pscustomobject]@{ role = "PUBLIC"; path = "/forgot-password" },
    [pscustomobject]@{ role = "PUBLIC"; path = "/reset-password" },
    [pscustomobject]@{ role = "PUBLIC"; path = "/request-access" },
    [pscustomobject]@{ role = "OWNER"; path = "/admin" },
    [pscustomobject]@{ role = "OWNER"; path = "/admin/users" },
    [pscustomobject]@{ role = "ADMIN"; path = "/admin" },
    [pscustomobject]@{ role = "ADMIN"; path = "/admin/access-requests" },
    [pscustomobject]@{ role = "SUPPORT"; path = "/admin" },
    [pscustomobject]@{ role = "SUPPORT"; path = "/admin/outbox" },
    [pscustomobject]@{ role = "AUDITOR"; path = "/admin" },
    [pscustomobject]@{ role = "AUDITOR"; path = "/admin/audit" },
    [pscustomobject]@{ role = "MERCHANT_ACTIVE"; path = "/merchant" },
    [pscustomobject]@{ role = "MERCHANT_ACTIVE"; path = "/merchant/inventory" },
    [pscustomobject]@{ role = "MERCHANT_ACTIVE"; path = "/merchant/orders" },
    [pscustomobject]@{ role = "MERCHANT_EMPTY"; path = "/merchant" },
    [pscustomobject]@{ role = "MERCHANT_EMPTY"; path = "/merchant/inventory" },
    [pscustomobject]@{ role = "MERCHANT_EMPTY"; path = "/merchant/orders" },
    [pscustomobject]@{ role = "WAREHOUSE_ACTIVE"; path = "/warehouse" },
    [pscustomobject]@{ role = "WAREHOUSE_EMPTY"; path = "/warehouse" }
)

foreach ($role in @("OWNER", "ADMIN", "SUPPORT", "AUDITOR", "MERCHANT_ACTIVE", "MERCHANT_EMPTY", "WAREHOUSE_ACTIVE", "WAREHOUSE_EMPTY")) {
    foreach ($path in @("/service-accountability", "/assistant", "/notifications", "/account")) {
        $requiredNativePairs += [pscustomobject]@{ role = $role; path = $path }
    }
}

Assert-RolePathCoverage -Surface "Native Android" -Records $nativeRecords -RequiredPairs $requiredNativePairs

$requiredRoles = @("public", "owner", "admin", "support", "auditor", "merchant", "warehouse")
foreach ($role in $requiredRoles) {
    $webCount = @($webRecords | Where-Object { (Normalize-TourReportRole $_.role) -eq $role }).Count
    $nativeCount = @($nativeRecords | Where-Object { (Normalize-TourReportRole $_.role) -eq $role }).Count
    if ($webCount -eq 0 -or $nativeCount -eq 0) {
        throw "Missing cross-surface role coverage for $role. Web=$webCount Native=$nativeCount"
    }
}

$webPairs = [System.Collections.Generic.HashSet[string]]::new()
foreach ($record in $webRecords) {
    [void]$webPairs.Add("$(Normalize-TourReportRole $record.role)|$(Normalize-TourReportPath (Get-TourReportRecordPath $record))")
}

$nativePairs = [System.Collections.Generic.HashSet[string]]::new()
foreach ($record in $nativeRecords) {
    [void]$nativePairs.Add("$(Normalize-TourReportRole $record.role)|$(Normalize-TourReportPath (Get-TourReportRecordPath $record))")
}

$nativeOnlyPairs = New-Object System.Collections.Generic.List[string]
foreach ($pair in $nativePairs) {
    if (-not $webPairs.Contains($pair)) {
        $nativeOnlyPairs.Add($pair)
    }
}
if ($nativeOnlyPairs.Count -gt 0) {
    $sample = $nativeOnlyPairs | Select-Object -First 10
    throw "Native Android route coverage has $($nativeOnlyPairs.Count) normalized role/path pair(s) without matching web records: $($sample -join ', ')"
}

$webOnlyPairs = New-Object System.Collections.Generic.List[string]
foreach ($pair in $webPairs) {
    if (-not $nativePairs.Contains($pair)) {
        $webOnlyPairs.Add($pair)
    }
}
if ($webOnlyPairs.Count -gt 0) {
    $sample = $webOnlyPairs | Select-Object -First 10
    throw "Web route coverage has $($webOnlyPairs.Count) normalized role/path pair(s) without matching native Android records: $($sample -join ', ')"
}

Write-Host "Cross-surface tour check passed."
Write-Host "Web report: $resolvedWebReportPath"
Write-Host "Web app URL: $($webReport.appUrl)"
Write-Host "Web API URL: $($webReport.apiUrl)"
Write-Host "Web checked at: $($webReport.checkedAt)"
Write-Host "Native report: $resolvedNativeReportPath"
Write-Host "Native API URL: $($nativeReport.apiUrl)"
Write-Host "Native APK SHA-256: $($nativeReport.apkSha256)"
Write-Host "Native device serials: $(@($nativeReport.deviceSerials) -join ', ')"
Write-Host "Native checked at: $($nativeReport.checkedAt)"
Write-Host "Web records: $($webRecords.Count)"
Write-Host "Native Android records: $($nativeRecords.Count)"
Write-Host "Normalized role/path pairs: $($webPairs.Count)"
