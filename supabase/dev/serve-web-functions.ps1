param([ValidateSet('Development', 'Test')][string]$Mode = 'Development')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'workspace.ps1')
$webWorkspace = Get-DeseoWorkspace -SourceRoot (Join-Path $PSScriptRoot '../..')
$webRepo = $webWorkspace.SourceRoot
$webOrigin = if ($Mode -eq 'Test') { 'http://127.0.0.1:4174' } else { 'http://127.0.0.1:5174' }
$webOtherPort = if ($Mode -eq 'Test') { 5174 } else { 4174 }
$webOriginVerified = $false
$webDocker = (Get-Command docker -ErrorAction SilentlyContinue).Name
if (-not $webDocker) { $webDocker = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe' }
$webContainers = & $webDocker ps --all --format '{{json .}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker inspection failed.' }
$webVerified = @()
foreach ($webLine in $webContainers) {
    $webContainer = $webLine | ConvertFrom-Json
    if ($webContainer.Names -match '^supabase_.+_deseo$') {
        $webIdentity = & $webDocker inspect $webContainer.ID | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw 'Docker inspection failed.' }
        Assert-DeseoContainerOwner -Workspace $webWorkspace -Name $webContainer.Names `
            -Project $webIdentity[0].Config.Labels.'com.supabase.cli.project' `
            -Workdir $webIdentity[0].Config.Labels.'com.supabase.cli.workdir'
        if ($webContainer.Names -eq 'supabase_edge_runtime_deseo') {
            $webOrigins = @($webIdentity[0].Config.Env | Where-Object { $_ -match '^\s*WEB_APP_ORIGIN\s*(?:=|$)' })
            $webOriginVerified = $webIdentity[0].State.Running -eq $true -and $webOrigins.Count -eq 1 -and
                $webOrigins[0] -ceq "WEB_APP_ORIGIN=$webOrigin"
        }
        $webVerified += $webContainer.Names
    } elseif ($webContainer.Ports -match ':5572[0-9]->') {
        throw 'Another Docker project uses a deseo port.'
    }
}
if ('supabase_kong_deseo' -notin $webVerified -or 'supabase_db_deseo' -notin $webVerified) {
    throw 'Start the verified deseo backend first.'
}
if (-not $webOriginVerified) {
    $webListeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
        Where-Object { $_.LocalPort -eq $webOtherPort })
    if ($webListeners.Count -gt 0) {
        throw "Stop the listener on port $webOtherPort before changing the Edge origin."
    }
}
$webEnvDirectory = Join-Path $webRepo '.superpowers/backend'
New-Item -ItemType Directory -Path $webEnvDirectory -Force | Out-Null
$webEnvPath = Join-Path $webEnvDirectory 'functions.local.env'
Set-Content -LiteralPath $webEnvPath -Value "WEB_APP_ORIGIN=$webOrigin`nPUBLIC_SUPABASE_URL=http://127.0.0.1:55721"
Write-Output "Serving deseo functions for $webOrigin. Stop this process before switching modes."
$env:DO_NOT_TRACK = '1'
$env:SUPABASE_TELEMETRY_DISABLED = 'true'
& (Join-Path $webRepo 'node_modules/.bin/supabase.cmd') --workdir $webRepo functions serve --env-file $webEnvPath
if ($LASTEXITCODE -ne 0) { throw 'The dedicated web Edge runtime failed.' }
