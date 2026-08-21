param([switch]$RequireCommit)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$expectedRemote = 'https://github.com/jsuasnavas5334/RHIA.git'
$checks = [Collections.Generic.List[string]]::new()

function Assert-RhiaCheck {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "REPOSITORY_BASELINE_FAILED: $Message" }
    $checks.Add($Message)
}

function Get-RhiaGit {
    $command = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidates = @(
        'C:\Program Files\Git\cmd\git.exe',
        (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd\git.exe')
    )
    return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

$git = Get-RhiaGit
Assert-RhiaCheck ([bool]$git) 'Git disponible'
Assert-RhiaCheck (Test-Path -LiteralPath (Join-Path $projectRoot '.git')) 'Repositorio local existente'

$remote = (& $git -C $projectRoot remote get-url origin).Trim()
Assert-RhiaCheck ($LASTEXITCODE -eq 0 -and $remote -eq $expectedRemote) 'Remoto origin esperado'
$branch = (& $git -C $projectRoot branch --show-current).Trim()
Assert-RhiaCheck ($LASTEXITCODE -eq 0 -and $branch -eq 'main') 'Rama main activa'

$required = @(
    'README.md',
    'PLAN_MAESTRO.md',
    'package.json',
    'package-lock.json',
    'docs\architecture\repository.md',
    'docs\architecture\stack.md',
    'docs\baseline\n8n\workflows\manifest.json',
    'scripts\test-repository-snapshot.ps1'
)
foreach ($relative in $required) {
    Assert-RhiaCheck (Test-Path -LiteralPath (Join-Path $projectRoot $relative)) "Archivo requerido: $relative"
}

$ignoredPaths = @(
    '.env',
    '.env.local',
    'secrets/token.txt',
    '.rhia-secrets/backup-passphrase',
    'RHIA-Backups/probe.dump.gpg',
    'backups/probe.dump'
)
foreach ($relative in $ignoredPaths) {
    & $git -C $projectRoot check-ignore --no-index --quiet -- $relative
    Assert-RhiaCheck ($LASTEXITCODE -eq 0) "Ruta sensible ignorada: $relative"
}

$versionable = @(
    & $git -C $projectRoot ls-files --cached --others --exclude-standard
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo enumerar archivos publicables.' }
)
Assert-RhiaCheck ($versionable.Count -gt 0) 'Archivos publicables enumerados'

$sensitiveName = '(?i)(^|/)(\.env($|\.)|secrets|credentials|cookies|backups|RHIA-Backups|\.rhia-secrets)(/|$)|\.(pem|key|p12|pfx|passphrase|dump|dump\.gpg)$'
$badNames = @($versionable | Where-Object { $_ -ne '.env.example' -and $_ -match $sensitiveName })
Assert-RhiaCheck ($badNames.Count -eq 0) 'Sin nombres sensibles publicables'

$signatures = @(
    '-----BEGIN ' + '(?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'AKIA' + '[0-9A-Z]{16}',
    '(?:ghp|gho|ghu|ghs|ghr)' + '_[A-Za-z0-9]{30,}',
    'xox' + '[baprs]-[A-Za-z0-9-]{10,}',
    'sk-' + '(?:proj-)?[A-Za-z0-9_-]{20,}'
)
$textExtensions = @('.bat', '.css', '.env', '.example', '.html', '.js', '.json', '.md', '.mjs', '.npmrc', '.prisma', '.ps1', '.sh', '.sql', '.toml', '.ts', '.txt', '.yaml', '.yml')
$signatureHits = [Collections.Generic.List[string]]::new()
foreach ($relative in $versionable) {
    $extension = [IO.Path]::GetExtension($relative).ToLowerInvariant()
    if ($textExtensions -notcontains $extension -and [IO.Path]::GetFileName($relative) -notin @('.gitignore', '.nvmrc')) { continue }
    $absolute = Join-Path $projectRoot ($relative -replace '/', '\')
    try { $content = [IO.File]::ReadAllText($absolute) } catch { continue }
    foreach ($signature in $signatures) {
        if ($content -match $signature) {
            $signatureHits.Add($relative)
            break
        }
    }
}
Assert-RhiaCheck ($signatureHits.Count -eq 0) 'Sin firmas de secretos en archivos publicables'

Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'data\project-status.json') | ConvertFrom-Json | Out-Null
Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'data\session-log.json') | ConvertFrom-Json | Out-Null
$checks.Add('JSON de monitor válido')

if ($RequireCommit) {
    & $git -C $projectRoot rev-parse --verify HEAD *> $null
    Assert-RhiaCheck ($LASTEXITCODE -eq 0) 'Commit baseline disponible'
}

Write-Output ("Repository baseline verificado: {0} controles; {1} archivos publicables; no se mostraron valores sensibles." -f $checks.Count, $versionable.Count)
