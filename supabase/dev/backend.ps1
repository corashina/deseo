param([ValidateSet('Start', 'Reset', 'Test', 'Status')][string]$Action = 'Start')
$ErrorActionPreference = 'Stop'
$backendRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$backendCli = Join-Path $backendRepo 'node_modules/.bin/supabase.cmd'
$backendConfig = Get-Content -LiteralPath (Join-Path $backendRepo 'supabase/config.toml') -Raw
if ($backendConfig -notmatch '(?m)^project_id = "deseo"$' -or
    $backendConfig -notmatch '(?m)^port = 55721$' -or $backendConfig -notmatch '(?m)^port = 55722$') {
    throw 'Use the deseo backend configuration.'
}
if (-not (Test-Path -LiteralPath $backendCli)) { throw 'Run npm ci first.' }
$backendContainers = & docker ps --all --format '{{json .}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker inspection failed.' }
$backendDatabaseVerified = $false
foreach ($backendLine in $backendContainers) {
    $backendContainer = $backendLine | ConvertFrom-Json
    if ($backendContainer.Names -match '^supabase_.+_deseo$') {
        $backendIdentity = & docker inspect $backendContainer.ID | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0 -or $backendIdentity[0].Config.Labels.'com.supabase.cli.project' -ne 'deseo' -or
            $backendIdentity[0].Config.Labels.'com.supabase.cli.workdir' -ne $backendRepo) {
            throw 'A deseo container has an unexpected identity.'
        }
        if ($backendContainer.Names -eq 'supabase_db_deseo') { $backendDatabaseVerified = $true }
    } elseif ($backendContainer.Ports -match ':5572[0-9]->') {
        throw 'Another Docker project uses a deseo port.'
    }
}
if ($Action -ne 'Start' -and -not $backendDatabaseVerified) { throw 'Start the verified deseo database first.' }
$env:DO_NOT_TRACK = '1'
$env:SUPABASE_TELEMETRY_DISABLED = 'true'
switch ($Action) {
    'Start' { & $backendCli --workdir $backendRepo start }
    'Reset' { & $backendCli --workdir $backendRepo db reset --local }
    'Test' { & $backendCli --workdir $backendRepo test db --local }
    'Status' { & $backendCli --workdir $backendRepo status }
}
if ($LASTEXITCODE -ne 0) { throw "Supabase $Action failed." }
if ($Action -in @('Start', 'Status')) {
    & node (Join-Path $PSScriptRoot 'save-status.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Could not save the backend status.' }
}
