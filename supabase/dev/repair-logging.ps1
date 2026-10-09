$ErrorActionPreference = 'Stop'
$loggerRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$loggerName = 'supabase_vector_deseo'
$loggerRows = & docker ps --all --filter "name=^/$loggerName$" --format '{{.ID}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker inspection failed.' }
if (-not $loggerRows) { return [pscustomobject]@{ Changed = $false; State = 'Absent' } }
$loggerOriginal = @(& docker inspect $loggerName | ConvertFrom-Json)[0]
if ($LASTEXITCODE -ne 0 -or
    $loggerOriginal.Config.Labels.'com.supabase.cli.project' -ne 'deseo' -or
    $loggerOriginal.Config.Labels.'com.supabase.cli.workdir' -ne $loggerRepo) {
    throw 'The logger has an unexpected project identity.'
}
$loggerSocketReady = @($loggerOriginal.Mounts | Where-Object Destination -eq '/var/run/docker.sock').Count -eq 1
if ($loggerSocketReady -and $loggerOriginal.Config.Env -contains 'DOCKER_HOST=unix:///var/run/docker.sock') {
    return [pscustomobject]@{ Changed = $false; State = $loggerOriginal.State.Status }
}
if (@($loggerOriginal.Mounts).Count -ne 0 -or @($loggerOriginal.Config.Entrypoint).Count -ne 1) {
    throw 'The logger configuration changed. Inspect it before repair.'
}
$loggerNetwork = @($loggerOriginal.NetworkSettings.Networks.PSObject.Properties.Name)
if ($loggerNetwork.Count -ne 1) { throw 'The logger must use one project network.' }
$loggerBackup = "$loggerName-repair-backup"
$loggerBackupId = & docker ps --all --filter "name=^/$loggerBackup$" --format '{{.ID}}'
if ($loggerBackupId) { throw 'A logger repair backup already exists.' }
$loggerArguments = @('run', '-d', '--name', $loggerName, '--network', $loggerNetwork[0],
    '--mount', 'type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock,readonly',
    '--restart', $loggerOriginal.HostConfig.RestartPolicy.Name,
    '--health-cmd', $loggerOriginal.Config.Healthcheck.Test[1],
    '--health-interval', '10s', '--health-timeout', '2s', '--health-retries', '3',
    '--entrypoint', $loggerOriginal.Config.Entrypoint[0])
foreach ($loggerVariable in $loggerOriginal.Config.Env) {
    if ($loggerVariable -match '^DOCKER_HOST=') { $loggerVariable = 'DOCKER_HOST=unix:///var/run/docker.sock' }
    $loggerArguments += @('--env', $loggerVariable)
}
foreach ($loggerLabel in $loggerOriginal.Config.Labels.PSObject.Properties) {
    $loggerArguments += @('--label', "$($loggerLabel.Name)=$($loggerLabel.Value)")
}
if ($loggerOriginal.Config.User) { $loggerArguments += @('--user', $loggerOriginal.Config.User) }
$loggerArguments += @($loggerOriginal.Image) + @($loggerOriginal.Config.Cmd)
$loggerRenamed = $false
try {
    & docker stop --time 15 $loggerName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop the failed logger.' }
    & docker rename $loggerName $loggerBackup
    if ($LASTEXITCODE -ne 0) { throw 'Could not preserve the previous logger.' }
    $loggerRenamed = $true
    $loggerNewId = & docker @loggerArguments
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the repaired logger.' }
    $loggerDeadline = (Get-Date).AddSeconds(60)
    do {
        Start-Sleep -Seconds 3
        $loggerCurrent = @(& docker inspect $loggerName | ConvertFrom-Json)[0]
        if ($loggerCurrent.State.Health.Status -eq 'healthy' -and $loggerCurrent.State.Running) { break }
    } while ((Get-Date) -lt $loggerDeadline)
    if ($loggerCurrent.State.Health.Status -ne 'healthy' -or -not $loggerCurrent.State.Running) {
        throw 'The repaired logger did not become healthy.'
    }
    Start-Sleep -Seconds 12
    $loggerCurrent = @(& docker inspect $loggerName | ConvertFrom-Json)[0]
    if (-not $loggerCurrent.State.Running -or $loggerCurrent.State.Health.Status -ne 'healthy' -or $loggerCurrent.RestartCount -ne 0) {
        throw 'The repaired logger did not remain stable.'
    }
    & docker rm $loggerBackup | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not remove the stopped logger backup.' }
    return [pscustomobject]@{ Changed = $true; State = 'Healthy'; Id = [string]$loggerNewId }
} catch {
    if ($loggerRenamed) {
        $loggerNew = & docker ps --all --filter "name=^/$loggerName$" --format '{{.ID}}'
        if ($loggerNew) { & docker rm --force $loggerName | Out-Null }
        & docker rename $loggerBackup $loggerName
        & docker start $loggerName | Out-Null
    }
    throw
}
