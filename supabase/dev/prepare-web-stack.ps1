param([ValidateSet('Prepare', 'Start', 'Reset', 'Test', 'Status')][string]$Action = 'Prepare')
$ErrorActionPreference = 'Stop'
$webRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$webStack = Join-Path $webRepo '.superpowers/web-backend'
$webSupabase = Join-Path $webStack 'supabase'
$webConfigPath = Join-Path $webSupabase 'config.toml'
$webCli = Join-Path $webRepo 'node_modules/.bin/supabase.cmd'
$webDocker = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $webDocker) {
    $webDocker = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
}
if (-not (Test-Path -LiteralPath $webDocker)) { throw 'Docker is required for stack identity checks.' }
if (-not (Test-Path -LiteralPath $webCli)) { throw 'Run npm ci before preparing the web backend.' }
foreach ($webDirectory in @($webStack, $webSupabase)) {
    if ((Test-Path -LiteralPath $webDirectory) -and (Get-Item -LiteralPath $webDirectory).LinkType) {
        throw "The backend directory must not be a link: $webDirectory."
    }
}

# Inspect all containers, including stopped containers, before changing this stack.
$webContainers = & $webDocker ps --all --format '{{json .}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker identity inspection failed.' }
$webOwnedContainers = @()
foreach ($webContainerLine in $webContainers) {
    $webContainer = $webContainerLine | ConvertFrom-Json
    if ($webContainer.Names -match '^supabase_.+_deseo-web$') {
        $webIdentity = & $webDocker inspect $webContainer.ID | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0 -or $webIdentity[0].Config.Labels.'com.supabase.cli.project' -ne 'deseo-web' -or
            $webIdentity[0].Config.Labels.'com.supabase.cli.workdir' -ne $webStack) {
            throw 'A deseo-web container has an unexpected project label.'
        }
        $webOwnedContainers += $webContainer
    } elseif ($webContainer.Ports -match ':5572[0-9]->') {
        throw 'Another Docker project uses a web backend port.'
    }
}
$webListeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -ge 55720 -and $_.LocalPort -le 55729 })
foreach ($webListener in $webListeners) {
    if (-not ($webOwnedContainers | Where-Object { $_.Ports -match (':' + $webListener.LocalPort + '->') })) {
        throw "Port $($webListener.LocalPort) belongs to an unexpected listener."
    }
}

if ($Action -in @('Prepare', 'Start')) {
    if (Test-Path -LiteralPath $webConfigPath) {
        if ((Get-Content -LiteralPath $webConfigPath -Raw) -notmatch '(?m)^project_id = "deseo-web"$') {
            throw 'The backend directory contains another project.'
        }
    }
    New-Item -ItemType Directory -Path $webSupabase -Force | Out-Null
    $webConfig = Get-Content -LiteralPath (Join-Path $webRepo 'supabase/config.toml') -Raw
    $webConfig = $webConfig -replace '(?m)^project_id = "deseo"$', 'project_id = "deseo-web"'
    foreach ($webPort in @(54320, 54321, 54322, 54323, 54324, 54327, 54329)) {
        $webConfig = $webConfig -replace "(?m)^(port|shadow_port) = $webPort`$", ('${1} = ' + ($webPort + 1400))
    }
    $webConfig = $webConfig -replace '(?m)^inspector_port = 8083$', 'inspector_port = 55728'
    $webConfig = $webConfig -replace '(?m)^site_url = .*$', 'site_url = "http://127.0.0.1:5174"'
    $webConfig = $webConfig -replace '(?m)^additional_redirect_urls = .*$', 'additional_redirect_urls = ["http://127.0.0.1:4174"]'
    if (-not (Test-Path -LiteralPath (Join-Path $webRepo 'supabase/seed.sql'))) {
        $webConfig = $webConfig -replace '(?s)(\[db\.seed\].*?)enabled = true', '${1}enabled = false'
    }
    Set-Content -LiteralPath $webConfigPath -Value $webConfig
    foreach ($webFolder in @('migrations', 'functions', 'tests')) {
        $webSource = Join-Path $webRepo ('supabase/' + $webFolder)
        $webLink = Join-Path $webSupabase $webFolder
        if (Test-Path -LiteralPath $webLink) {
            $webItem = Get-Item -LiteralPath $webLink
            if ($webItem.LinkType -ne 'Junction' -or $webItem.Target -ne $webSource) {
                throw "Unexpected directory at $webLink."
            }
        } else {
            New-Item -ItemType Junction -Path $webLink -Target $webSource | Out-Null
        }
    }
    $webTemplates = Join-Path $webSupabase 'templates'
    if ((Test-Path -LiteralPath $webTemplates) -and (Get-Item -LiteralPath $webTemplates).LinkType) {
        throw 'The template directory must not be a link.'
    }
    New-Item -ItemType Directory -Path $webTemplates -Force | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $webRepo 'supabase/templates') -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $webTemplates $_.Name) -Force
    }
    if (Test-Path -LiteralPath (Join-Path $webRepo 'supabase/seed.sql')) {
        Copy-Item -LiteralPath (Join-Path $webRepo 'supabase/seed.sql') -Destination (Join-Path $webSupabase 'seed.sql') -Force
    }
}

if (-not (Test-Path -LiteralPath $webConfigPath)) { throw 'Prepare the web backend first.' }
$webSavedConfig = Get-Content -LiteralPath $webConfigPath -Raw
if ($webSavedConfig -notmatch '(?m)^project_id = "deseo-web"$' -or
    $webSavedConfig -notmatch '(?m)^port = 55721$' -or
    $webSavedConfig -notmatch '(?m)^port = 55722$') {
    throw 'Refusing to use a backend outside the disposable deseo-web project.'
}
$env:DO_NOT_TRACK = '1'
$env:SUPABASE_TELEMETRY_DISABLED = 'true'
switch ($Action) {
    'Prepare' { Write-Output 'Prepared deseo-web. Run npm run start:web:backend.' }
    'Start' { & $webCli --workdir $webStack start }
    'Reset' {
        if (-not ($webOwnedContainers | Where-Object Names -eq 'supabase_db_deseo-web')) {
            throw 'Refusing reset without the verified deseo-web database container.'
        }
        & $webCli --workdir $webStack db reset --local
    }
    'Test' { & $webCli --workdir $webStack test db --local }
    'Status' { & $webCli --workdir $webStack status }
}
if ($Action -ne 'Prepare' -and $LASTEXITCODE -ne 0) { throw "Supabase $Action failed." }
