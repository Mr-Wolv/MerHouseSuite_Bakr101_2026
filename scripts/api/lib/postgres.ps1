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
    $postgresContainer = if ([string]::IsNullOrWhiteSpace($env:MERHOUSE_POSTGRES_CONTAINER)) { "merhouse-postgres" } else { $env:MERHOUSE_POSTGRES_CONTAINER }
    $postgresUser = if ([string]::IsNullOrWhiteSpace($env:MERHOUSE_POSTGRES_USER)) { "merhouse_local" } else { $env:MERHOUSE_POSTGRES_USER }
    $postgresDatabase = if ([string]::IsNullOrWhiteSpace($env:MERHOUSE_POSTGRES_DB)) { "merhouse" } else { $env:MERHOUSE_POSTGRES_DB }
    $normalizedSql = (($Sql -split "\r?\n") | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join " "
    $result = & $docker exec $postgresContainer psql `
        -U $postgresUser `
        -d $postgresDatabase `
        --csv `
        -c $normalizedSql 2>&1

    if ($LASTEXITCODE -ne 0) {
        $result
        throw "PostgreSQL query failed: $Sql"
    }

    if ($result.Count -le 1) {
        return ,@()
    }

    return ,@($result | ConvertFrom-Csv)
}
