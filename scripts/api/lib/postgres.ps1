function Get-DockerCommand {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if ($docker) {
        return $docker.Source
    }

    $dockerPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
    if (Test-Path $dockerPath) {
        return $dockerPath
    }

    throw "Docker CLI was not found on PATH or at $dockerPath."
}

function Invoke-PostgresTableQuery {
    param(
        [Parameter(Mandatory = $true)] [string] $Sql
    )

    $docker = Get-DockerCommand
    $normalizedSql = (($Sql -split "\r?\n") | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join " "
    $result = & $docker exec merhouse-postgres psql `
        -U warehouse `
        -d merhouse `
        --csv `
        -c $normalizedSql

    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL query failed: $Sql"
    }

    if ($result.Count -le 1) {
        return ,@()
    }

    return ,@($result | ConvertFrom-Csv)
}
