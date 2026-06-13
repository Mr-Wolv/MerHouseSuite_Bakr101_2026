param(
    [int]$MaxBuildSeconds = 30,
    [int]$MaxLargestJsKb = 700,
    [int]$MaxLargestJsGzipKb = 180,
    [int]$MaxLargestCssKb = 90,
    [int]$MaxLargestCssGzipKb = 35,
    [int]$MaxTotalAssetGzipKb = 260,
    [int]$MaxWebRouteReadyMs = 20000,
    [int]$MaxNativeRouteReadyMs = 25000,
    [int]$MaxNativeScreenshotMs = 10000,
    [switch]$IncludeApiSmoke,
    [string]$ApiBaseUrl = "http://localhost:8080",
    [string]$ApiSmokeAdminEmail = "admin@merhouse.local",
    [string]$ApiSmokeAdminPassword = "local-owner-password",
    [switch]$ExpectOpenApiDocs = $true,
    [int]$MaxApiSmokeSeconds = 120,
    [string]$WebReportPath = "",
    [string]$NativeReportPath = "",
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$frontendRoot = Join-Path $projectRoot "frontend"
$distRoot = Join-Path $frontendRoot "dist"
$assetRoot = Join-Path $distRoot "assets"
. (Join-Path $PSScriptRoot "..\lib\tour-report-lib.ps1")

$hasWebReport = -not [string]::IsNullOrWhiteSpace($WebReportPath)
$hasNativeReport = -not [string]::IsNullOrWhiteSpace($NativeReportPath)
if ($hasWebReport -ne $hasNativeReport) {
    throw "Pass both -WebReportPath and -NativeReportPath so performance readiness can prove web/native route timing together, or omit both for bundle/API-only proof."
}

. (Join-Path $PSScriptRoot "..\lib\url-guard-lib.ps1")

$normalizedApiBaseUrl = $ApiBaseUrl
if ($IncludeApiSmoke) {
    $normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
}

function ConvertTo-Kb {
    param([long]$Bytes)
    return [Math]::Round($Bytes / 1kb, 2)
}

function Get-GzipLength {
    param([string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $target = New-Object System.IO.MemoryStream
    try {
        $gzip = New-Object System.IO.Compression.GZipStream($target, [System.IO.Compression.CompressionMode]::Compress, $true)
        try {
            $gzip.Write($bytes, 0, $bytes.Length)
        } finally {
            $gzip.Dispose()
        }
        return $target.Length
    } finally {
        $target.Dispose()
    }
}

function Assert-Budget {
    param(
        [string]$Name,
        [double]$Actual,
        [double]$Maximum,
        [string]$Unit = "KB"
    )

    if ($Actual -gt $Maximum) {
        throw "$Name exceeded budget. Actual=$Actual $Unit Budget=$Maximum $Unit"
    }
}

function Resolve-PerformancePath {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }
    return Resolve-MerHousePath -Path $Path -ProjectRoot $projectRoot
}

$webReportResolvedPath = $null
$nativeReportResolvedPath = $null
if ($hasWebReport) {
    $webReportResolvedPath = Resolve-PerformancePath $WebReportPath
    if (-not (Test-Path $webReportResolvedPath)) {
        throw "Performance web tour report was not found: $webReportResolvedPath"
    }
    Write-Host "Performance web report input: $webReportResolvedPath"
}
if ($hasNativeReport) {
    $nativeReportResolvedPath = Resolve-PerformancePath $NativeReportPath
    if (-not (Test-Path $nativeReportResolvedPath)) {
        throw "Performance native tour report was not found: $nativeReportResolvedPath"
    }
    Write-Host "Performance native report input: $nativeReportResolvedPath"
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = ".\reports\performance-readiness.json"
}
$resolvedOutput = Resolve-PerformancePath $OutputPath
Write-Host "Performance readiness report output: $resolvedOutput"

function Get-OptionalNumericProperty {
    param(
        [object]$Record,
        [string]$Property
    )

    $valueProperty = $Record.PSObject.Properties[$Property]
    if ($null -eq $valueProperty -or $null -eq $valueProperty.Value) {
        return $null
    }
    return [double]$valueProperty.Value
}

function Assert-TourTimingBudget {
    param(
        [string]$Surface,
        [object[]]$Records,
        [string]$Property,
        [int]$MaximumMs
    )

    $timedRecords = @($Records | Where-Object { $null -ne (Get-OptionalNumericProperty -Record $_ -Property $Property) })
    if ($timedRecords.Count -ne $Records.Count) {
        $missing = @($Records | Where-Object { $null -eq (Get-OptionalNumericProperty -Record $_ -Property $Property) })
        $sample = $missing | Select-Object -First 5 | ForEach-Object { "$($_.role) $(Get-TourReportRecordPath $_)" }
        throw "$Surface report is missing required $Property timing for $($missing.Count) record(s): $($sample -join ', ')"
    }

    $slowest = $timedRecords | Sort-Object { Get-OptionalNumericProperty -Record $_ -Property $Property } -Descending | Select-Object -First 1
    $slowestMs = Get-OptionalNumericProperty -Record $slowest -Property $Property
    if ($slowestMs -gt $MaximumMs) {
        throw "$Surface $Property exceeded timing budget. Actual=$slowestMs ms Budget=$MaximumMs ms Route=$(Get-TourReportRecordPath $slowest) Role=$($slowest.role)"
    }

    return [pscustomobject]@{
        surface = $Surface
        property = $Property
        checkedRecords = $timedRecords.Count
        maximumMs = $MaximumMs
        slowestMs = $slowestMs
    }
}

if (-not (Test-Path (Join-Path $frontendRoot "package.json"))) {
    throw "Frontend package.json was not found at $frontendRoot."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found on PATH. Install Node.js or add npm to PATH before running performance readiness proof."
}

$buildTimer = [System.Diagnostics.Stopwatch]::StartNew()
Push-Location $frontendRoot
try {
    Write-Host "Building frontend for performance readiness..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed."
    }
} finally {
    Pop-Location
    $buildTimer.Stop()
}

if (-not (Test-Path $assetRoot)) {
    throw "Frontend build assets were not found at $assetRoot."
}

$assets = @(Get-ChildItem -Path $assetRoot -File | Where-Object { $_.Extension -in @(".js", ".css") })
if ($assets.Count -eq 0) {
    throw "Frontend build produced no JavaScript or CSS assets."
}

$assetMetrics = @($assets | ForEach-Object {
    $gzipBytes = Get-GzipLength $_.FullName
    [pscustomobject]@{
        path = $_.FullName.Substring($projectRoot.Length + 1)
        type = $_.Extension.TrimStart(".")
        bytes = $_.Length
        kb = ConvertTo-Kb $_.Length
        gzipBytes = $gzipBytes
        gzipKb = ConvertTo-Kb $gzipBytes
    }
})

$jsAssets = @($assetMetrics | Where-Object { $_.type -eq "js" })
$cssAssets = @($assetMetrics | Where-Object { $_.type -eq "css" })

if ($jsAssets.Count -eq 0) {
    throw "Frontend build produced no JavaScript asset."
}
if ($cssAssets.Count -eq 0) {
    throw "Frontend build produced no CSS asset."
}

$largestJs = $jsAssets | Sort-Object kb -Descending | Select-Object -First 1
$largestJsGzip = $jsAssets | Sort-Object gzipKb -Descending | Select-Object -First 1
$largestCss = $cssAssets | Sort-Object kb -Descending | Select-Object -First 1
$largestCssGzip = $cssAssets | Sort-Object gzipKb -Descending | Select-Object -First 1
$totalAssetGzipKb = [Math]::Round((($assetMetrics | Measure-Object -Property gzipBytes -Sum).Sum) / 1kb, 2)
$buildSeconds = [Math]::Round($buildTimer.Elapsed.TotalSeconds, 2)

Assert-Budget -Name "Frontend build time" -Actual $buildSeconds -Maximum $MaxBuildSeconds -Unit "seconds"
Assert-Budget -Name "Largest JS asset" -Actual $largestJs.kb -Maximum $MaxLargestJsKb
Assert-Budget -Name "Largest gzipped JS asset" -Actual $largestJsGzip.gzipKb -Maximum $MaxLargestJsGzipKb
Assert-Budget -Name "Largest CSS asset" -Actual $largestCss.kb -Maximum $MaxLargestCssKb
Assert-Budget -Name "Largest gzipped CSS asset" -Actual $largestCssGzip.gzipKb -Maximum $MaxLargestCssGzipKb
Assert-Budget -Name "Total gzipped JS/CSS assets" -Actual $totalAssetGzipKb -Maximum $MaxTotalAssetGzipKb

$apiSmokeSeconds = $null
if ($IncludeApiSmoke) {
    $apiOutput = Join-Path $projectRoot "reports\performance-api-smoke.json"
    New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot "reports") | Out-Null

    $apiTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Host "Running timed API smoke proof..."
    & (Join-Path $PSScriptRoot "..\..\quality\api-smoke.ps1") `
        -BaseUrl $normalizedApiBaseUrl `
        -OutputPath $apiOutput `
        -AdminEmail $ApiSmokeAdminEmail `
        -AdminPassword $ApiSmokeAdminPassword `
        -ExpectOpenApiDocs:$ExpectOpenApiDocs
    $apiTimer.Stop()
    $apiSmokeSeconds = [Math]::Round($apiTimer.Elapsed.TotalSeconds, 2)
    if ($apiSmokeSeconds -gt $MaxApiSmokeSeconds) {
        throw "API smoke exceeded timing budget. Actual=$apiSmokeSeconds seconds Budget=$MaxApiSmokeSeconds seconds"
    }
}

$webRecordCount = $null
$tourTiming = @()
$webReportProvenance = $null
if (-not [string]::IsNullOrWhiteSpace($WebReportPath)) {
    $webReport = Read-TourReportDocument -ProjectRoot $projectRoot -Path $WebReportPath
    $webRecords = if ($webReport.records) { @($webReport.records) } else { @($webReport) }
    Assert-CleanTourReportRecords -Surface "Web tour" -Records $webRecords -MinimumRecords 100
    Assert-NoTopLevelBadRecords -Surface "Web tour" -Report $webReport
    Assert-WebTourReportProvenance -Report $webReport -Records $webRecords
    $webReportProvenance = [pscustomobject]@{
        appUrl = $webReport.appUrl
        apiUrl = $webReport.apiUrl
        checkedAt = $webReport.checkedAt
        checkedRoutes = $webReport.checkedRoutes
    }
    $tourTiming += Assert-TourTimingBudget -Surface "Web tour" -Records $webRecords -Property "routeReadyMs" -MaximumMs $MaxWebRouteReadyMs
    $webRecordCount = $webRecords.Count
}

$nativeRecordCount = $null
$nativeReportProvenance = $null
if (-not [string]::IsNullOrWhiteSpace($NativeReportPath)) {
    $nativeReport = Read-TourReportDocument -ProjectRoot $projectRoot -Path $NativeReportPath
    $nativeRecords = if ($nativeReport.records) { @($nativeReport.records) } else { @($nativeReport) }
    Assert-CleanTourReportRecords -Surface "Native Android tour" -Records $nativeRecords -MinimumRecords 80
    Assert-NoTopLevelBadRecords -Surface "Native Android tour" -Report $nativeReport
    Assert-NativeAndroidReportProvenance -Report $nativeReport -Records $nativeRecords
    Assert-NativeScreenshotEvidence -ProjectRoot $projectRoot -Records $nativeRecords
    $nativeReportProvenance = [pscustomobject]@{
        apiUrl = $nativeReport.apiUrl
        apkPath = $nativeReport.apkPath
        apkSha256 = $nativeReport.apkSha256
        apkBytes = $nativeReport.apkBytes
        checkedAt = $nativeReport.checkedAt
        checkedRoutes = $nativeReport.checkedRoutes
        deviceSerials = @($nativeReport.deviceSerials)
    }
    $tourTiming += Assert-TourTimingBudget -Surface "Native Android tour" -Records $nativeRecords -Property "routeReadyMs" -MaximumMs $MaxNativeRouteReadyMs
    $tourTiming += Assert-TourTimingBudget -Surface "Native Android tour" -Records $nativeRecords -Property "screenshotMs" -MaximumMs $MaxNativeScreenshotMs
    $nativeRecordCount = $nativeRecords.Count
}

$result = [pscustomobject]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    status = "PASSED"
    budgets = [pscustomobject]@{
        maxBuildSeconds = $MaxBuildSeconds
        maxLargestJsKb = $MaxLargestJsKb
        maxLargestJsGzipKb = $MaxLargestJsGzipKb
        maxLargestCssKb = $MaxLargestCssKb
        maxLargestCssGzipKb = $MaxLargestCssGzipKb
        maxTotalAssetGzipKb = $MaxTotalAssetGzipKb
        maxWebRouteReadyMs = $MaxWebRouteReadyMs
        maxNativeRouteReadyMs = $MaxNativeRouteReadyMs
        maxNativeScreenshotMs = $MaxNativeScreenshotMs
        maxApiSmokeSeconds = $MaxApiSmokeSeconds
    }
    buildSeconds = $buildSeconds
    largestJs = $largestJs
    largestJsGzip = $largestJsGzip
    largestCss = $largestCss
    largestCssGzip = $largestCssGzip
    totalAssetGzipKb = $totalAssetGzipKb
    apiSmokeSeconds = $apiSmokeSeconds
    webReportPath = if ($hasWebReport) { $WebReportPath } else { $null }
    webReportResolvedPath = $webReportResolvedPath
    webReportProvenance = $webReportProvenance
    nativeReportPath = if ($hasNativeReport) { $NativeReportPath } else { $null }
    nativeReportResolvedPath = $nativeReportResolvedPath
    nativeReportProvenance = $nativeReportProvenance
    webRecordCount = $webRecordCount
    nativeRecordCount = $nativeRecordCount
    tourTiming = @($tourTiming)
    note = "Local readiness proof only; production load, provider delivery, monitoring, and autoscaling certification remain V17 or later."
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutput) | Out-Null
$result | ConvertTo-Json -Depth 8 | Set-Content -Path $resolvedOutput -Encoding UTF8

Write-Host "Performance readiness proof passed."
Write-Host "Build seconds: $buildSeconds"
Write-Host "Largest JS: $($largestJs.kb) KB / gzip $($largestJsGzip.gzipKb) KB"
Write-Host "Largest CSS: $($largestCss.kb) KB / gzip $($largestCssGzip.gzipKb) KB"
Write-Host "Total gzipped JS/CSS: $totalAssetGzipKb KB"
if ($apiSmokeSeconds) {
    Write-Host "API smoke seconds: $apiSmokeSeconds"
}
if ($webRecordCount) {
    Write-Host "Web report: $webReportResolvedPath"
    Write-Host "Web app URL: $($webReportProvenance.appUrl)"
    Write-Host "Web API URL: $($webReportProvenance.apiUrl)"
    Write-Host "Web checked at: $($webReportProvenance.checkedAt)"
    Write-Host "Web checked routes: $($webReportProvenance.checkedRoutes)"
    Write-Host "Web route records checked: $webRecordCount"
}
if ($nativeRecordCount) {
    Write-Host "Native report: $nativeReportResolvedPath"
    Write-Host "Native API URL: $($nativeReportProvenance.apiUrl)"
    Write-Host "Native APK SHA-256: $($nativeReportProvenance.apkSha256)"
    Write-Host "Native device serials: $(@($nativeReportProvenance.deviceSerials) -join ', ')"
    Write-Host "Native checked at: $($nativeReportProvenance.checkedAt)"
    Write-Host "Native checked routes: $($nativeReportProvenance.checkedRoutes)"
    Write-Host "Native Android route records checked: $nativeRecordCount"
}
foreach ($timing in @($tourTiming | Where-Object { $_.checkedRecords -gt 0 })) {
    Write-Host "$($timing.surface) $($timing.property): checked $($timing.checkedRecords), slowest $($timing.slowestMs) ms, budget $($timing.maximumMs) ms"
}
Write-Host "Performance readiness report: $resolvedOutput"
