$ErrorActionPreference = 'Stop'
$memoryRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$memoryStack = Join-Path $memoryRepo '.superpowers/memories-backend'
$memoryConfigDirectory = Join-Path $memoryStack 'supabase'
$memoryPorts = @(55520, 55521, 55522, 55523, 55524, 55527, 55528, 55529)
$memoryListeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $memoryPorts }
if ($memoryListeners) {
    throw 'A memories stack port is in use. Stop this setup and inspect the listener.'
}

New-Item -ItemType Directory -Path $memoryConfigDirectory -Force | Out-Null
$memoryConfig = Get-Content -LiteralPath (Join-Path $memoryRepo 'supabase/config.toml') -Raw
$memoryConfig = $memoryConfig -replace '(?m)^project_id = "deseo"$', 'project_id = "deseo-memories"'
foreach ($memoryPort in @(54320, 54321, 54322, 54323, 54324, 54327, 54329)) {
    $memoryConfig = $memoryConfig -replace "(?m)^(port|shadow_port) = $memoryPort`$", ('${1} = ' + ($memoryPort + 1200))
}
$memoryConfig = $memoryConfig -replace '(?m)^inspector_port = 8083$', 'inspector_port = 55528'
if (-not (Test-Path -LiteralPath (Join-Path $memoryRepo 'supabase/seed.sql'))) {
    $memoryConfig = $memoryConfig -replace '(?s)(\[db\.seed\].*?)enabled = true', '${1}enabled = false'
}
$memoryConfig | Set-Content -LiteralPath (Join-Path $memoryConfigDirectory 'config.toml')

foreach ($memoryFolder in @('migrations', 'functions', 'tests')) {
    $memorySource = Join-Path $memoryRepo ('supabase/' + $memoryFolder)
    if (-not (Test-Path -LiteralPath $memorySource)) { continue }
    $memoryLink = Join-Path $memoryConfigDirectory $memoryFolder
    if (Test-Path -LiteralPath $memoryLink) {
        $memoryItem = Get-Item -LiteralPath $memoryLink
        if ($memoryItem.LinkType -ne 'Junction' -or $memoryItem.Target -ne $memorySource) {
            throw "Unexpected directory at $memoryLink."
        }
    } else {
        New-Item -ItemType Junction -Path $memoryLink -Target $memorySource | Out-Null
    }
}
$memoryTemplates = Join-Path $memoryConfigDirectory 'templates'
$memoryTemplateSource = Join-Path $memoryRepo 'supabase/templates'
if (Test-Path -LiteralPath $memoryTemplateSource) {
    if (Test-Path -LiteralPath $memoryTemplates) {
        $memoryTemplateItem = Get-Item -LiteralPath $memoryTemplates
        if ($memoryTemplateItem.LinkType) {
            if ($memoryTemplateItem.LinkType -ne 'Junction' -or $memoryTemplateItem.Target -ne $memoryTemplateSource) {
                throw "Unexpected link at $memoryTemplates."
            }
            # Remove only this checked junction. Preserve its source directory.
            Remove-Item -LiteralPath $memoryTemplates
        }
    }
    New-Item -ItemType Directory -Path $memoryTemplates -Force | Out-Null
    # The CLI requires Auth template files to resolve inside its isolated project.
    Get-ChildItem -LiteralPath $memoryTemplateSource -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $memoryTemplates $_.Name) -Force
    }
}
if (Test-Path -LiteralPath (Join-Path $memoryRepo 'supabase/seed.sql')) {
    Copy-Item -LiteralPath (Join-Path $memoryRepo 'supabase/seed.sql') -Destination (Join-Path $memoryConfigDirectory 'seed.sql')
}
Write-Output 'Prepared deseo-memories. No database has started.'
Write-Output ('Run: npx supabase --workdir "' + $memoryStack + '" start')
