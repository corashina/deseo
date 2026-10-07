param([ValidateSet('Development', 'Test')][string]$Mode = 'Development')
$ErrorActionPreference = 'Stop'
$webRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$webStack = $webRepo
$webConfig = Get-Content -LiteralPath (Join-Path $webStack 'supabase/config.toml') -Raw
if ($webConfig -notmatch '(?m)^project_id = "deseo"$' -or $webConfig -notmatch '(?m)^port = 55721$') {
    throw 'Start the deseo backend first.'
}
$webDocker = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $webDocker) { $webDocker = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe' }
$webIdentity = & $webDocker inspect supabase_kong_deseo | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $webIdentity[0].Config.Labels.'com.supabase.cli.project' -ne 'deseo' -or
    $webIdentity[0].Config.Labels.'com.supabase.cli.workdir' -ne $webStack) { throw 'The web API container identity changed.' }
$webOrigin = if ($Mode -eq 'Test') { 'http://127.0.0.1:4174' } else { 'http://127.0.0.1:5174' }
$webOtherPort = if ($Mode -eq 'Test') { 5174 } else { 4174 }
if (Get-NetTCPConnection -State Listen -LocalPort $webOtherPort -ErrorAction SilentlyContinue) {
    throw "Stop the portal on port $webOtherPort before changing the Edge origin."
}
$webEnvDirectory = Join-Path $webRepo '.superpowers/backend'
New-Item -ItemType Directory -Path $webEnvDirectory -Force | Out-Null
$webEnvPath = Join-Path $webEnvDirectory 'functions.local.env'
Set-Content -LiteralPath $webEnvPath -Value "WEB_APP_ORIGIN=$webOrigin`nPUBLIC_SUPABASE_URL=http://127.0.0.1:55721"
Write-Output "Serving deseo functions for $webOrigin. Stop this process before switching modes."
$env:DO_NOT_TRACK = '1'
$env:SUPABASE_TELEMETRY_DISABLED = 'true'
& (Join-Path $webRepo 'node_modules/.bin/supabase.cmd') --workdir $webStack functions serve --env-file $webEnvPath
if ($LASTEXITCODE -ne 0) { throw 'The dedicated web Edge runtime failed.' }
