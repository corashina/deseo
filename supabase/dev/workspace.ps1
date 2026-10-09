function Resolve-DeseoPath {
    param([string]$Path)
    if (-not $Path -or -not [IO.Path]::IsPathRooted($Path)) { throw 'Use an absolute workspace path.' }
    return [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path -ErrorAction Stop).ProviderPath).TrimEnd('\', '/')
}

function Get-DeseoGitCommonDirectory {
    param([string]$Root)
    $directory = & git -C $Root rev-parse --path-format=absolute --git-common-dir 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $directory) { throw 'Could not verify the Git common directory.' }
    return Resolve-DeseoPath -Path $directory
}

function Assert-DeseoConfiguration {
    param([string]$SourceRoot, [string]$BackendRoot)
    $sourceConfig = Join-Path $SourceRoot 'supabase/config.toml'
    $backendConfig = Join-Path $BackendRoot 'supabase/config.toml'
    $config = Get-Content -LiteralPath $backendConfig -Raw
    if ($config -notmatch '(?m)^project_id = "deseo"\r?$' -or
        $config -notmatch '(?ms)^\[api\]\r?\n(?:(?!^\[).)*?^port = 55721\r?$' -or
        $config -notmatch '(?ms)^\[db\]\r?\n(?:(?!^\[).)*?^port = 55722\r?$' -or
        (Get-Content -LiteralPath $sourceConfig -Raw) -cne $config) {
        throw 'Use identical deseo backend configuration in both workspaces.'
    }
}

function Get-DeseoWorkspace {
    param([string]$SourceRoot)
    $source = Resolve-DeseoPath -Path $SourceRoot
    $common = Get-DeseoGitCommonDirectory -Root $source
    $lines = @(& git -c core.quotePath=false -C $source worktree list --porcelain)
    if ($LASTEXITCODE -ne 0) { throw 'Could not read registered Git worktrees.' }
    $records = @()
    $record = $null
    foreach ($line in $lines) {
        if ($line.StartsWith('worktree ')) {
            $record = [pscustomobject]@{ Root = $line.Substring(9); Prunable = $false; Bare = $false }
            $records += $record
        } elseif ($record -and $line -match '^prunable(?: |$)') { $record.Prunable = $true }
        elseif ($record -and $line -eq 'bare') { $record.Bare = $true }
    }
    if ($records.Count -eq 0 -or $records[0].Prunable -or $records[0].Bare) {
        throw 'Could not verify the primary registered worktree.'
    }
    $backend = Resolve-DeseoPath -Path $records[0].Root
    if ((Get-DeseoGitCommonDirectory -Root $backend) -ne $common) {
        throw 'The primary worktree has a different Git common directory.'
    }
    $roots = @()
    foreach ($item in $records) {
        if ($item.Prunable -or $item.Bare -or -not (Test-Path -LiteralPath $item.Root -PathType Container)) { continue }
        $root = Resolve-DeseoPath -Path $item.Root
        if ((Get-DeseoGitCommonDirectory -Root $root) -eq $common) { $roots += $root }
    }
    if ($source -notin $roots) { throw 'Use a current registered worktree from the same repository.' }
    Assert-DeseoConfiguration -SourceRoot $source -BackendRoot $backend
    return [pscustomobject]@{
        SourceRoot = $source; BackendRoot = $backend; WorktreeRoots = $roots
    }
}

function Assert-DeseoContainerOwner {
    param($Workspace, [string]$Name, [string]$Project, [string]$Workdir)
    if ($Name -notmatch '^supabase_[a-z0-9_]+_deseo$' -or $Project -ne 'deseo') {
        throw 'A deseo container has an unexpected identity.'
    }
    try { $owner = Resolve-DeseoPath -Path $Workdir }
    catch { throw 'A deseo container has an unexpected identity.' }
    if ($Name -eq 'supabase_edge_runtime_deseo') {
        if ($owner -notin $Workspace.WorktreeRoots) { throw 'The Edge container has an unexpected identity.' }
        Assert-DeseoConfiguration -SourceRoot $owner -BackendRoot $Workspace.BackendRoot
    } elseif ($owner -ne $Workspace.BackendRoot) {
        throw 'A persistent deseo container has an unexpected identity.'
    }
}

function Assert-DeseoBackendAction {
    param($Workspace, [string]$Action)
    if ($Action -in @('Start', 'Reset') -and $Workspace.SourceRoot -ne $Workspace.BackendRoot) {
        throw 'Run Start and Reset from the primary checkout.'
    }
}
