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
