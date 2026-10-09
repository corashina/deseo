param([ValidateSet('Start', 'Reset', 'Test', 'Status')][string]$Action = 'Start')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'workspace.ps1')
$backendWorkspace = Get-DeseoWorkspace -SourceRoot (Join-Path $PSScriptRoot '../..')
Assert-DeseoBackendAction -Workspace $backendWorkspace -Action $Action
$backendRepo = $backendWorkspace.BackendRoot
$backendSource = $backendWorkspace.SourceRoot
$backendCli = Join-Path $backendSource 'node_modules/.bin/supabase.cmd'
if (-not (Test-Path -LiteralPath $backendCli)) { throw 'Run npm ci first.' }
$backendContainers = & docker ps --all --format '{{json .}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker inspection failed.' }
$backendDatabaseVerified = $false
foreach ($backendLine in $backendContainers) {
    $backendContainer = $backendLine | ConvertFrom-Json
    if ($backendContainer.Names -match '^supabase_.+_deseo$') {
        $backendIdentity = & docker inspect $backendContainer.ID | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw 'Docker inspection failed.' }
        Assert-DeseoContainerOwner -Workspace $backendWorkspace -Name $backendContainer.Names `
            -Project $backendIdentity[0].Config.Labels.'com.supabase.cli.project' `
            -Workdir $backendIdentity[0].Config.Labels.'com.supabase.cli.workdir'
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
    'Test' { & $backendCli --workdir $backendSource test db --local }
    'Status' { & $backendCli --workdir $backendRepo status }
}
if ($LASTEXITCODE -ne 0) { throw "Supabase $Action failed." }
if ($Action -in @('Start', 'Status')) {
    & node (Join-Path $PSScriptRoot 'save-status.mjs') $backendRepo
    if ($LASTEXITCODE -ne 0) { throw 'Could not save the backend status.' }
}
