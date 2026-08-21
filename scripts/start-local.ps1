param(
    [int]$Port = 4173,
    [string]$PidFile
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $PidFile) {
    $PidFile = Join-Path $projectRoot '.rhia-server.pid'
}
$pidFile = [IO.Path]::GetFullPath($PidFile)
$allowedFiles = @{
    '/' = 'index.html'
    '/index.html' = 'index.html'
    '/assets/styles.css' = 'assets\styles.css'
    '/assets/app.js' = 'assets\app.js'
    '/data/project-status.json' = 'data\project-status.json'
    '/data/session-log.json' = 'data\session-log.json'
}

function Get-GitExecutable {
    $command = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidates = @(
        'C:\Program Files\Git\cmd\git.exe',
        (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd\git.exe')
    )
    return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

function Get-LiveStatus {
    $project = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $projectRoot 'data\project-status.json') | ConvertFrom-Json
    $gitExecutable = Get-GitExecutable
    $changes = @()
    $branch = 'main'
    $commit = $null
    $gitAvailable = [bool]$gitExecutable -and (Test-Path -LiteralPath (Join-Path $projectRoot '.git'))

    if ($gitAvailable) {
        $previousErrorPreference = $ErrorActionPreference
        $ErrorActionPreference = 'SilentlyContinue'
        try {
            $branchValue = & $gitExecutable -C $projectRoot branch --show-current 2>$null
            if ($branchValue) { $branch = [string]$branchValue }
            $commitValue = & $gitExecutable -C $projectRoot rev-parse --short HEAD 2>$null
            if ($LASTEXITCODE -eq 0) { $commit = [string]$commitValue }
            $statusLines = @(& $gitExecutable -C $projectRoot status --porcelain=v1 2>$null)
        } finally {
            $ErrorActionPreference = $previousErrorPreference
        }
        foreach ($line in $statusLines) {
            if ($line.Length -ge 4) {
                $changes += [pscustomobject]@{
                    code = $line.Substring(0, 2).Trim()
                    path = $line.Substring(3)
                }
            }
        }
    }

    $files = @(Get-ChildItem -LiteralPath $projectRoot -File -Recurse | Where-Object {
        $_.FullName -notlike "$projectRoot\.git\*" -and
        $_.Name -ne '.rhia-server.pid' -and
        $_.Extension -ne '.zip'
    })

    return [pscustomobject]@{
        generatedAt = [DateTimeOffset]::Now.ToString('o')
        project = $project
        git = [pscustomobject]@{
            available = $gitAvailable
            branch = $branch
            commit = $commit
            changes = $changes
        }
        files = [pscustomobject]@{ count = $files.Count }
    }
}

function Send-Response {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [int]$StatusCode,
        [string]$ContentType,
        [byte[]]$Body
    )
    $Response.StatusCode = $StatusCode
    $Response.ContentType = $ContentType
    $Response.ContentLength64 = $Body.Length
    $Response.Headers['Cache-Control'] = 'no-store'
    if ($Body.Length) { $Response.OutputStream.Write($Body, 0, $Body.Length) }
    $Response.OutputStream.Close()
}

$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
try {
    [IO.File]::WriteAllText($pidFile, [string]$PID)
    $listener.Start()
    while ($true) {
        $context = $listener.GetContext()
        try {
            $path = $context.Request.Url.AbsolutePath

            if ($path -eq '/health') {
                $body = [Text.Encoding]::UTF8.GetBytes('{"status":"ok"}')
                Send-Response -Response $context.Response -StatusCode 200 -ContentType 'application/json; charset=utf-8' -Body $body
            } elseif ($path -eq '/api/status') {
                $json = Get-LiveStatus | ConvertTo-Json -Depth 10 -Compress
                $body = [Text.Encoding]::UTF8.GetBytes($json)
                Send-Response -Response $context.Response -StatusCode 200 -ContentType 'application/json; charset=utf-8' -Body $body
            } elseif ($allowedFiles.ContainsKey($path)) {
                $file = Join-Path $projectRoot $allowedFiles[$path]
                $extension = [IO.Path]::GetExtension($file).ToLowerInvariant()
                $contentType = switch ($extension) {
                    '.html' { 'text/html; charset=utf-8' }
                    '.css' { 'text/css; charset=utf-8' }
                    '.js' { 'text/javascript; charset=utf-8' }
                    '.json' { 'application/json; charset=utf-8' }
                    default { 'application/octet-stream' }
                }
                Send-Response -Response $context.Response -StatusCode 200 -ContentType $contentType -Body ([IO.File]::ReadAllBytes($file))
            } else {
                Send-Response -Response $context.Response -StatusCode 404 -ContentType 'text/plain; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes('No encontrado'))
            }
        } catch {
            if ($context.Response.OutputStream) { $context.Response.OutputStream.Close() }
        }
    }
} finally {
    $listener.Stop()
    if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile -Force }
}
