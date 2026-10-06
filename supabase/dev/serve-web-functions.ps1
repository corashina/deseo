param([ValidateSet('Development', 'Test')][string]$Mode = 'Development')
$ErrorActionPreference = 'Stop'
$webRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$webStack = Join-Path $webRepo '.superpowers/web-backend'
$webConfig = Get-Content -LiteralPath (Join-Path $webStack 'supabase/config.toml') -Raw
if ($webConfig -notmatch '(?m)^project_id = "deseo-web"$' -or $webConfig -notmatch '(?m)^port = 55721$') {
    throw 'Prepare the dedicated deseo-web backend first.'
}
$webDocker = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $webDocker) { $webDocker = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe' }
$webIdentity = & $webDocker inspect supabase_kong_deseo-web | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $webIdentity[0].Config.Labels.'com.supabase.cli.project' -ne 'deseo-web' -or
    $webIdentity[0].Config.Labels.'com.supabase.cli.workdir' -ne $webStack) { throw 'The web API container identity changed.' }
$webOrigin = if ($Mode -eq 'Test') { 'http://127.0.0.1:4174' } else { 'http://127.0.0.1:5174' }
$webOtherPort = if ($Mode -eq 'Test') { 5174 } else { 4174 }
if (Get-NetTCPConnection -State Listen -LocalPort $webOtherPort -ErrorAction SilentlyContinue) {
    throw "Stop the portal on port $webOtherPort before changing the Edge origin."
}
$webEnvPath = Join-Path $webStack 'functions.local.env'
Set-Content -LiteralPath $webEnvPath -Value "WEB_APP_ORIGIN=$webOrigin`nPUBLIC_SUPABASE_URL=http://127.0.0.1:55721"
Write-Output "Serving deseo-web functions for $webOrigin. Stop this process before switching modes."
$env:DO_NOT_TRACK = '1'
$env:SUPABASE_TELEMETRY_DISABLED = 'true'
& (Join-Path $webRepo 'node_modules/.bin/supabase.cmd') --workdir $webStack functions serve --env-file $webEnvPath
if ($LASTEXITCODE -ne 0) { throw 'The dedicated web Edge runtime failed.' }
