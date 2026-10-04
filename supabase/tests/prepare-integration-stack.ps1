$ErrorActionPreference = 'Stop'
$integrationRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$integrationStack = Join-Path $integrationRepo '.superpowers/integration-backend'
$integrationConfigDirectory = Join-Path $integrationStack 'supabase'
$integrationPorts = @(55620, 55621, 55622, 55623, 55624, 55627, 55628, 55629)
$integrationListeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $integrationPorts }
if ($integrationListeners) {
    throw 'An integration stack port is in use. Stop this setup and inspect the listener.'
}

New-Item -ItemType Directory -Path $integrationConfigDirectory -Force | Out-Null
$integrationConfig = Get-Content -LiteralPath (Join-Path $integrationRepo 'supabase/config.toml') -Raw
$integrationConfig = $integrationConfig -replace '(?m)^project_id = "deseo"$', 'project_id = "deseo-integration"'
foreach ($integrationPort in @(54320, 54321, 54322, 54323, 54324, 54327, 54329)) {
    $integrationConfig = $integrationConfig -replace "(?m)^(port|shadow_port) = $integrationPort`$", ('${1} = ' + ($integrationPort + 1300))
}
$integrationConfig = $integrationConfig -replace '(?m)^inspector_port = 8083$', 'inspector_port = 55628'
if (-not (Test-Path -LiteralPath (Join-Path $integrationRepo 'supabase/seed.sql'))) {
    $integrationConfig = $integrationConfig -replace '(?s)(\[db\.seed\].*?)enabled = true', '${1}enabled = false'
}
$integrationConfig | Set-Content -LiteralPath (Join-Path $integrationConfigDirectory 'config.toml')

foreach ($integrationFolder in @('migrations', 'functions', 'tests')) {
    $integrationSource = Join-Path $integrationRepo ('supabase/' + $integrationFolder)
    if (-not (Test-Path -LiteralPath $integrationSource)) { continue }
    $integrationLink = Join-Path $integrationConfigDirectory $integrationFolder
    if (Test-Path -LiteralPath $integrationLink) {
        $integrationItem = Get-Item -LiteralPath $integrationLink
        if ($integrationItem.LinkType -ne 'Junction' -or $integrationItem.Target -ne $integrationSource) {
            throw "Unexpected directory at $integrationLink."
        }
    } else {
        New-Item -ItemType Junction -Path $integrationLink -Target $integrationSource | Out-Null
    }
}
$integrationTemplates = Join-Path $integrationConfigDirectory 'templates'
$integrationTemplateSource = Join-Path $integrationRepo 'supabase/templates'
if (Test-Path -LiteralPath $integrationTemplateSource) {
    if (Test-Path -LiteralPath $integrationTemplates) {
        $integrationTemplateItem = Get-Item -LiteralPath $integrationTemplates
        if ($integrationTemplateItem.LinkType) {
            if ($integrationTemplateItem.LinkType -ne 'Junction' -or $integrationTemplateItem.Target -ne $integrationTemplateSource) {
                throw "Unexpected link at $integrationTemplates."
            }
            # Remove only this checked junction. Preserve its source directory.
            Remove-Item -LiteralPath $integrationTemplates
        }
    }
    New-Item -ItemType Directory -Path $integrationTemplates -Force | Out-Null
    # The CLI requires Auth template files to resolve inside its isolated project.
    Get-ChildItem -LiteralPath $integrationTemplateSource -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $integrationTemplates $_.Name) -Force
    }
}
if (Test-Path -LiteralPath (Join-Path $integrationRepo 'supabase/seed.sql')) {
    Copy-Item -LiteralPath (Join-Path $integrationRepo 'supabase/seed.sql') -Destination (Join-Path $integrationConfigDirectory 'seed.sql')
}
Write-Output 'Prepared deseo-integration. No database has started.'
Write-Output ('Run: npx supabase --workdir "' + $integrationStack + '" start')
