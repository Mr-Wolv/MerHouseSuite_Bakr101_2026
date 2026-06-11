$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "url-guard-lib.ps1")

function Resolve-TourReportPath {
    param(
        [Parameter(Mandatory = $true)] [string]$ProjectRoot,
        [Parameter(Mandatory = $true)] [string]$Path
    )

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }
    return [System.IO.Path]::GetFullPath((ooin-Path $ProjectRoot $Path))
}

function Resolve-TourReportEvidencePath {
    param(
        [Parameter(Mandatory = $true)] [string]$ProjectRoot,
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }
    return [System.IO.Path]::GetFullPath((ooin-Path $ProjectRoot $Path))
}

function Read-TourReportRecords {
    param(
        [Parameter(Mandatory = $true)] [string]$ProjectRoot,
        [Parameter(Mandatory = $true)] [string]$Path
    )

    $parsed = Read-TourReportDocument -ProjectRoot $ProjectRoot -Path $Path
    if ($parsed.records) {
        return @($parsed.records)
    }
    return @($parsed)
}

function Read-TourReportDocument {
    param(
        [Parameter(Mandatory = $true)] [string]$ProjectRoot,
        [Parameter(Mandatory = $true)] [string]$Path
    )

    $resolved = Resolve-TourReportPath -ProjectRoot $ProjectRoot -Path $Path
    if (-not (Test-Path $resolved)) {
        throw "Tour report was not found: $resolved"
    }

    $json = Get-Content -Path $resolved -Raw -Encoding UTF8
    if ($json.Length -gt 0 -and [int][char]$json[0] -eq 0xFEFF) {
        $json = $json.Substring(1)
    }
    return $json | ConvertFrom-oson
}

function Normalize-TourReportRole {
    param([string]$Role)

    switch ($Role) {
        "supportAdmin" { return "support" }
        "SUPPORT" { return "support" }
        "MERCHANT_ACTIVE" { return "merchant" }
        "MERCHANT_EMPTY" { return "merchant" }
        "WAREHOUSE_ACTIVE" { return "warehouse" }
        "WAREHOUSE_EMPTY" { return "warehouse" }
        default { return $Role.ToLowerInvariant() }
    }
}

function Normalize-TourReportPath {
    param([string]$Path)

    return ($Path -replace "/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "/:id")
}

function Get-TourReportRecordPath {
    param([object]$Record)

    if ($Record.path) {
        return $Record.path
    }
    return $Record.route
}

function Get-TourReportStakeholderState {
    param([object]$Record)

    if ($Record.stakeholderState) {
        return [string]$Record.stakeholderState
    }

    switch ([string]$Record.role) {
        "MERCHANT_ACTIVE" { return "active" }
        "MERCHANT_EMPTY" { return "empty" }
        "WAREHOUSE_ACTIVE" { return "active" }
        "WAREHOUSE_EMPTY" { return "empty" }
        default { return "" }
    }
}

function Get-TourReportArrayCount {
    param([object]$Value)

    if ($null -eq $Value) {
        return 0
    }
    return @($Value).Count
}

function Get-NonBlankTourReportArrayCount {
    param([object]$Value)

    if ($null -eq $Value) {
        return 0
    }

    return @($Value | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }).Count
}

function Get-TourReportNumericValue {
    param([object]$Value)

    if ($null -eq $Value) {
        return $null
    }

    $text = ([string]$Value).Trim()
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }

    $number = 0.0
    if ([double]::TryParse($text, [System.Globalization.NumberStyles]::Integer, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
        return $number
    }

    return $null
}

function Test-PngScreenshotFile {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path $Path)) {
        return $false
    }

    $file = Get-Item -LiteralPath $Path
    if ($file.Length -lt 24) {
        return $false
    }

    $stream = [System.IO.File]::OpenRead($file.FullName)
    try {
        $header = New-Object byte[] 24
        [void]$stream.Read($header, 0, 24)
        $pngHeader = [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
        for ($i = 0; $i -lt $pngHeader.Length; $i++) {
            if ($header[$i] -ne $pngHeader[$i]) {
                return $false
            }
        }

        $ihdrLength = ($header[8] -shl 24) -bor ($header[9] -shl 16) -bor ($header[10] -shl 8) -bor $header[11]
        $ihdrType = [Text.Encoding]::ASCII.GetString($header, 12, 4)
        $width = ($header[16] -shl 24) -bor ($header[17] -shl 16) -bor ($header[18] -shl 8) -bor $header[19]
        $height = ($header[20] -shl 24) -bor ($header[21] -shl 16) -bor ($header[22] -shl 8) -bor $header[23]

        return $ihdrLength -eq 13 -and $ihdrType -eq "IHDR" -and $width -gt 0 -and $height -gt 0
    } finally {
        $stream.Dispose()
    }
}

function Assert-NativeAndroidReportProvenance {
    param(
        [object]$Report,
        [object[]]$Records
    )

    $missing = New-Object System.Collections.Generic.List[string]
    if (-not (Test-AbsoluteHttpUrl ([string]$Report.apiUrl))) {
        $missing.Add("apiUrl")
    }
    if ([string]::IsNullOrWhiteSpace([string]$Report.apkPath)) {
        $missing.Add("apkPath")
    }
    if ([string]::IsNullOrWhiteSpace([string]$Report.apkSha256) -or -not ([string]$Report.apkSha256 -match "^[0-9a-f]{64}$")) {
        $missing.Add("apkSha256")
    }
    if ($null -eq $Report.apkBytes -or [long]$Report.apkBytes -le 0) {
        $missing.Add("apkBytes")
    }
    if ((Get-NonBlankTourReportArrayCount $Report.deviceSerials) -lt 1) {
        $missing.Add("deviceSerials")
    }
    if ([string]::IsNullOrWhiteSpace([string]$Report.checkedAt)) {
        $missing.Add("checkedAt")
    } else {
        try {
            [datetime]::Parse([string]$Report.checkedAt) | Out-Null
        } catch {
            $missing.Add("checkedAt")
        }
    }
    if ($null -eq $Report.checkedRoutes -or [int]$Report.checkedRoutes -ne $Records.Count) {
        $missing.Add("checkedRoutes")
    }

    if ($missing.Count -gt 0) {
        throw "Native Android tour report is missing required installed-APK provenance field(s): $($missing -join ', ')"
    }
}

function Assert-WebTourReportProvenance {
    param(
        [object]$Report,
        [object[]]$Records
    )

    $missing = New-Object System.Collections.Generic.List[string]
    if (-not (Test-AbsoluteHttpUrl ([string]$Report.appUrl))) {
        $missing.Add("appUrl")
    }
    if (-not (Test-AbsoluteHttpUrl ([string]$Report.apiUrl))) {
        $missing.Add("apiUrl")
    }
    if ([string]::IsNullOrWhiteSpace([string]$Report.checkedAt)) {
        $missing.Add("checkedAt")
    } else {
        try {
            [datetime]::Parse([string]$Report.checkedAt) | Out-Null
        } catch {
            $missing.Add("checkedAt")
        }
    }
    if ($null -eq $Report.checkedRoutes -or [int]$Report.checkedRoutes -ne $Records.Count) {
        $missing.Add("checkedRoutes")
    }

    if ($missing.Count -gt 0) {
        throw "Web tour report is missing required browser provenance field(s): $($missing -join ', ')"
    }
}

function Assert-CleanTourReportRecords {
    param(
        [Parameter(Mandatory = $true)] [string]$Surface,
        [Parameter(Mandatory = $true)] [object[]]$Records,
        [int]$MinimumRecords = 1
    )

    if ($Records.Count -lt $MinimumRecords) {
        throw "$Surface tour report contained $($Records.Count) record(s), expected at least $MinimumRecords."
    }

    $missingIdentity = @($Records | Where-Object {
        [string]::IsNullOrWhiteSpace([string]$_.role) -or
        [string]::IsNullOrWhiteSpace([string](Get-TourReportRecordPath $_))
    })
    if ($missingIdentity.Count -gt 0) {
        $sample = $missingIdentity | Select-Object -First 5 | ForEach-Object {
            $role = if ([string]::IsNullOrWhiteSpace([string]$_.role)) { "<missing-role>" } else { $_.role }
            $path = Get-TourReportRecordPath $_
            if ([string]::IsNullOrWhiteSpace([string]$path)) { $path = "<missing-path>" }
            "$role $path"
        }
        throw "$Surface tour report has $($missingIdentity.Count) record(s) missing required role or path identity: $($sample -join ', ')"
    }

    $bad = @($Records | Where-Object {
        $statusCode = Get-TourReportNumericValue $_.status
        $_.overflow -eq $true -or
        $_.hasOverflow -eq $true -or
        $_.hasExpectedText -eq $false -or
        $_.hasUnableToSignIn -eq $true -or
        $_.hasLoading -eq $true -or
        $_.hasRestoringSession -eq $true -or
        $_.hasBlankBody -eq $true -or
        ($null -ne $statusCode -and $statusCode -ge 400) -or
        (Get-TourReportArrayCount $_.consoleErrors) -gt 0 -or
        (Get-TourReportArrayCount $_.emptyControlLabels) -gt 0 -or
        (Get-TourReportArrayCount $_.unlabeledFormControls) -gt 0 -or
        "$($_.title) $($_.heading)".ToLowerInvariant().Contains("loading")
    })
    if ($bad.Count -gt 0) {
        $sample = $bad | Select-Object -First 5 | ForEach-Object { "$($_.role) $(Get-TourReportRecordPath $_)" }
        throw "$Surface tour report has $($bad.Count) bad record(s): $($sample -join ', ')"
    }
}

function Assert-NoTopLevelBadRecords {
    param(
        [Parameter(Mandatory = $true)] [string]$Surface,
        [Parameter(Mandatory = $true)] [object]$Report
    )

    $badRecordsProperty = $Report.PSObject.Properties["badRecords"]
    if ($null -eq $badRecordsProperty -or $null -eq $badRecordsProperty.Value) {
        return
    }

    $badRecords = @($badRecordsProperty.Value)
    if ($badRecords.Count -gt 0) {
        throw "$Surface tour report contains $($badRecords.Count) top-level badRecords entry(ies)."
    }
}

function Assert-NativeScreenshotEvidence {
    param(
        [Parameter(Mandatory = $true)] [string]$ProjectRoot,
        [Parameter(Mandatory = $true)] [object[]]$Records
    )

    $missing = @($Records | Where-Object {
        $path = Resolve-TourReportEvidencePath -ProjectRoot $ProjectRoot -Path ([string]$_.screenshot)
        -not (Test-PngScreenshotFile -Path $path)
    })
    if ($missing.Count -gt 0) {
        $sample = $missing | Select-Object -First 5 | ForEach-Object {
            $path = if ([string]::IsNullOrWhiteSpace([string]$_.screenshot)) { "<missing-screenshot>" } else { [string]$_.screenshot }
            "$($_.role) $(Get-TourReportRecordPath $_) $path"
        }
        throw "Native Android tour report is missing valid PNG screenshot evidence for $($missing.Count) record(s): $($sample -join ', ')"
    }
}
