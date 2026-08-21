$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$snapshot = Join-Path $tempRoot ("rhia-repository-snapshot-{0}" -f [guid]::NewGuid().ToString('N'))
$serverProcess = $null
$serverPidFile = Join-Path $snapshot '.snapshot-server.pid'
$port = Get-Random -Minimum 43000 -Maximum 45000

function Get-RhiaGit {
    $command = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidates = @('C:\Program Files\Git\cmd\git.exe', (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd\git.exe'))
    return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

try {
    $git = Get-RhiaGit
    if (-not $git) { throw 'Git no está disponible.' }
    New-Item -ItemType Directory -Path $snapshot | Out-Null

    $versionable = @(& $git -C $projectRoot ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0 -or $versionable.Count -eq 0) { throw 'No se pudo crear el snapshot publicable.' }
    foreach ($relative in $versionable) {
        $source = Join-Path $projectRoot ($relative -replace '/', '\')
        $target = Join-Path $snapshot ($relative -replace '/', '\')
        $targetDirectory = Split-Path -Parent $target
        if (-not (Test-Path -LiteralPath $targetDirectory)) { New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null }
        Copy-Item -LiteralPath $source -Destination $target
    }

    foreach ($forbidden in @('.env', '.rhia-secrets', 'RHIA-Backups', 'node_modules')) {
        if (Test-Path -LiteralPath (Join-Path $snapshot $forbidden)) { throw "El snapshot incluyó una ruta prohibida: $forbidden" }
    }

    if ($snapshot -notmatch '^([A-Za-z]):\\(.*)$') { throw 'La ruta temporal no tiene formato de unidad Windows.' }
    $wslSnapshot = '/mnt/' + $Matches[1].ToLowerInvariant() + '/' + ($Matches[2] -replace '\\', '/')
    $dockerArguments = @(
        '-d', 'Ubuntu', '--', 'docker', 'run', '--rm', '--network', 'bridge',
        '-v', "${wslSnapshot}:/workspace", '-w', '/workspace',
        'node:24.19.0-bookworm-slim', 'bash', '-lc',
        'npm ci --ignore-scripts && npm run typecheck && npm run build'
    )
    & wsl.exe @dockerArguments
    if ($LASTEXITCODE -ne 0) { throw 'Falló npm ci/typecheck/build en el snapshot.' }

    $startScript = Join-Path $snapshot 'scripts\start-local.ps1'
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $startScript, '-Port', $port, '-PidFile', $serverPidFile)
    $serverProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru
    $healthy = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 1
            if ($health.status -eq 'ok') { $healthy = $true; break }
        } catch {}
    }
    if (-not $healthy) { throw 'El Control Center del snapshot no respondió health.' }
    $expectedProject = Get-Content -Raw -LiteralPath (Join-Path $snapshot 'data\project-status.json') | ConvertFrom-Json
    $status = Invoke-RestMethod -Uri "http://localhost:$port/api/status" -TimeoutSec 2
    if ($status.project.version -ne $expectedProject.version) { throw 'El snapshot no expuso la versión esperada.' }

    Write-Output ("Snapshot publicable verificado: {0} archivos; npm ci/typecheck/build y endpoints health/status aprobados." -f $versionable.Count)
} finally {
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
        $serverProcess.WaitForExit()
    }
    $resolvedSnapshot = [IO.Path]::GetFullPath($snapshot)
    if ($resolvedSnapshot.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($resolvedSnapshot).StartsWith('rhia-repository-snapshot-')) {
        if (Test-Path -LiteralPath $resolvedSnapshot) { Remove-Item -LiteralPath $resolvedSnapshot -Recurse -Force }
    } else {
        throw 'Se bloqueó la limpieza porque el directorio temporal no pasó la validación de ruta.'
    }
}
