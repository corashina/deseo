import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Importance: 100. Reject foreign services before local backend actions.
const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const helper = join(sourceRoot, 'supabase/dev/workspace.ps1');
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const config = 'project_id = "deseo"\n[api]\nport = 55721\n[db]\nport = 55722\n';

function run(script) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$ErrorActionPreference = 'Stop'; . ${quote(helper)}; ${script}`],
  { encoding: 'utf8', windowsHide: true, cwd: sourceRoot });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function fixture(body) {
  const folder = realpathSync.native(mkdtempSync(join(tmpdir(), 'deseo-workspace-')));
  const primary = join(folder, 'primary');
  const linked = join(folder, 'linked');
  const foreign = join(folder, 'foreign');
  for (const root of [primary, linked, foreign]) {
    mkdirSync(join(root, 'supabase'), { recursive: true });
    mkdirSync(join(root, '.git'), { recursive: true });
    writeFileSync(join(root, 'supabase/config.toml'), config);
  }
  const setup = `
    $primary = ${quote(primary)}; $linked = ${quote(linked)}; $foreign = ${quote(foreign)};
    $global:fixtureCommon = Join-Path $primary '.git'; $global:fixtureForeignCommon = Join-Path $foreign '.git';
    $global:fixtureRecords = @("worktree $primary", 'HEAD abc', '', "worktree $linked", 'HEAD abc', '');
    function git {
      $global:LASTEXITCODE = 0;
      if ($args -contains 'worktree') { return $global:fixtureRecords }
      if ($args[1] -eq $foreign) { return $global:fixtureForeignCommon }
      return $global:fixtureCommon
    }
    function Expect-Rejection([scriptblock]$Call, [string]$Message) {
      try { & $Call } catch {
        if ($_.Exception.Message -notmatch $Message) { throw }
        return
      }
      throw 'Expected identity rejection.'
    }
  `;
  try { return body({ folder, primary, linked, foreign, setup }); }
  finally { rmSync(folder, { recursive: true, force: true }); }
}

function scriptFixture(body) {
  return fixture((value) => {
    const { primary, linked } = value;
    const dev = join(linked, 'supabase/dev');
    mkdirSync(dev);
    for (const name of ['backend.ps1', 'serve-web-functions.ps1', 'workspace.ps1']) {
      copyFileSync(join(sourceRoot, 'supabase/dev', name), join(dev, name));
    }
    mkdirSync(join(linked, 'node_modules/.bin'), { recursive: true });
    writeFileSync(join(linked, 'node_modules/.bin/supabase.cmd'), '@echo CLI %*\r\n@exit /b 0\r\n');
    const setup = `${value.setup}
      $global:fixtureContainers = @(
        @{ ID = 'db'; Names = 'supabase_db_deseo'; Ports = '0.0.0.0:55722->5432/tcp' },
        @{ ID = 'kong'; Names = 'supabase_kong_deseo'; Ports = '0.0.0.0:55721->8000/tcp' },
        @{ ID = 'edge'; Names = 'supabase_edge_runtime_deseo'; Ports = '' }
      );
      $global:fixtureProject = 'deseo'; $global:fixtureOwner = $primary;
      $global:fixtureEdgeOwner = $linked;
      $global:fixtureEdgeRunning = $true; $global:fixtureEdgeEnv = @('WEB_APP_ORIGIN=http://127.0.0.1:4174');
      function docker {
        $global:LASTEXITCODE = 0;
        if ($args[0] -eq 'ps') { return ($global:fixtureContainers | ForEach-Object { $_ | ConvertTo-Json -Compress }) }
        if ($args[0] -eq 'inspect') {
          $owner = if ($args[1] -eq 'edge') { $global:fixtureEdgeOwner } else { $global:fixtureOwner };
          return ConvertTo-Json -Depth 4 -Compress @(@{ State = @{ Running = $global:fixtureEdgeRunning }; Config = @{
            Env = $global:fixtureEdgeEnv; Labels = @{
            'com.supabase.cli.project' = $global:fixtureProject; 'com.supabase.cli.workdir' = $owner
          } } })
        }
        throw 'Tests permit only Docker reads.'
      }
      function node { $global:LASTEXITCODE = 0; Write-Output "STATUS $($args[1])" }
      $global:fixtureListener = $false; $global:fixturePort = 5174;
      function Get-NetTCPConnection {
        param($State, $LocalPort, $ErrorAction)
        if ($global:fixtureListener) { return [pscustomobject]@{ OwningProcess = 42; LocalPort = $global:fixturePort } }
      }
      function Get-CimInstance { throw 'Do not infer portal ownership from its executable.' }
    `;
    return body({ ...value, dev, setup });
  });
}

test('resolves the current checkout through real Git registration', () => {
  const value = JSON.parse(run(`Get-DeseoWorkspace -SourceRoot ${quote(sourceRoot)} | ConvertTo-Json -Compress`));
  assert.equal(value.SourceRoot.toLowerCase(), sourceRoot.replace(/[\\/]+$/, '').toLowerCase());
  assert.ok(value.WorktreeRoots.includes(value.SourceRoot));
  assert.ok(value.WorktreeRoots.includes(value.BackendRoot));
});

test('accepts primary services and registered Edge sources', () => fixture(({ setup }) => run(`${setup}
  $workspace = Get-DeseoWorkspace -SourceRoot $linked;
  foreach ($name in @('supabase_kong_deseo', 'supabase_db_deseo', 'supabase_auth_deseo')) {
    Assert-DeseoContainerOwner -Workspace $workspace -Name $name -Project 'deseo' -Workdir $primary;
  }
  Assert-DeseoContainerOwner -Workspace $workspace -Name 'supabase_edge_runtime_deseo' -Project 'deseo' -Workdir $linked;
  Assert-DeseoContainerOwner -Workspace $workspace -Name 'supabase_edge_runtime_deseo' -Project 'deseo' -Workdir $primary;
`)));

test('rejects foreign project labels and names', () => fixture(({ setup }) => run(`${setup}
  $workspace = Get-DeseoWorkspace -SourceRoot $linked;
  Expect-Rejection { Assert-DeseoContainerOwner $workspace 'supabase_db_deseo' 'other' $primary } 'identity';
  Expect-Rejection { Assert-DeseoContainerOwner $workspace 'supabase_db_other' 'deseo' $primary } 'identity';
`)));

test('rejects worktree ownership for persistent services', () => fixture(({ setup }) => run(`${setup}
  $workspace = Get-DeseoWorkspace -SourceRoot $linked;
  Expect-Rejection { Assert-DeseoContainerOwner $workspace 'supabase_db_deseo' 'deseo' $linked } 'identity';
  Expect-Rejection { Assert-DeseoContainerOwner $workspace 'supabase_kong_deseo' 'deseo' $linked } 'identity';
`)));

test('rejects unregistered and unrelated Edge sources', () => fixture(({ setup }) => run(`${setup}
  $workspace = Get-DeseoWorkspace -SourceRoot $linked;
  Expect-Rejection { Assert-DeseoContainerOwner $workspace 'supabase_edge_runtime_deseo' 'deseo' $foreign } 'identity';
  $global:fixtureRecords = @("worktree $primary", 'HEAD abc', '');
  Expect-Rejection { Get-DeseoWorkspace -SourceRoot $linked } 'registered';
`)));

test('rejects unrelated Git common directories', () => fixture(({ setup }) => run(`${setup}
  $global:fixtureRecords += @("worktree $foreign", 'HEAD abc', '');
  Expect-Rejection { Get-DeseoWorkspace -SourceRoot $foreign } 'common|registered';
`)));

test('rejects prunable and missing source worktrees', () => fixture(({ setup }) => run(`${setup}
  $global:fixtureRecords = @("worktree $primary", 'HEAD abc', '', "worktree $linked", 'HEAD abc', 'prunable stale', '');
  Expect-Rejection { Get-DeseoWorkspace -SourceRoot $linked } 'registered|prunable';
  Expect-Rejection { Get-DeseoWorkspace -SourceRoot (Join-Path $primary 'missing') } 'path|exist|resolve';
`)));

test('normalizes source paths before matching registration', () => fixture(({ setup }) => run(`${setup}
  $workspace = Get-DeseoWorkspace -SourceRoot (Join-Path $linked 'supabase/..');
  if ($workspace.SourceRoot -ne $linked) { throw 'Source path was not canonical.' }
`)));

test('rejects different source configuration', () => fixture(({ setup, linked }) => {
  writeFileSync(join(linked, 'supabase/config.toml'), `${config}# Different source\n`);
  run(`${setup} Expect-Rejection { Get-DeseoWorkspace -SourceRoot $linked } 'configuration';`);
}));

test('rejects invalid API and database ports', () => fixture(({ setup, primary, linked }) => {
  for (const root of [primary, linked]) writeFileSync(join(root, 'supabase/config.toml'), config.replace('55722', '55723'));
  run(`${setup} Expect-Rejection { Get-DeseoWorkspace -SourceRoot $linked } 'configuration';`);
}));

test('rejects Edge worktrees with different backend configuration', () => fixture(({ setup, linked }) => run(`${setup}
  $workspace = Get-DeseoWorkspace -SourceRoot $primary;
  Set-Content -LiteralPath ${quote(join(linked, 'supabase/config.toml'))} -Value 'changed';
  Expect-Rejection { Assert-DeseoContainerOwner $workspace 'supabase_edge_runtime_deseo' 'deseo' $linked } 'configuration';
`)));

test('rejects linked Start and Reset before Docker inspection', () => scriptFixture(({ setup, dev }) => {
  for (const action of ['Start', 'Reset']) {
    const value = run(`${setup} function docker { throw 'Docker must not run.' }
      try { & ${quote(join(dev, 'backend.ps1'))} -Action ${action}; throw 'Action was not rejected.' }
      catch { if ($_.Exception.Message -notmatch 'primary checkout') { throw }; Write-Output 'rejected' }`);
    assert.equal(value, 'rejected');
  }
}));

test('allows Test and Status for a verified linked worktree', () => fixture(({ setup }) => run(`${setup}
  $workspace = Get-DeseoWorkspace -SourceRoot $linked;
  Assert-DeseoBackendAction $workspace 'Test'; Assert-DeseoBackendAction $workspace 'Status';
  $workspace = Get-DeseoWorkspace -SourceRoot $primary;
  Assert-DeseoBackendAction $workspace 'Start'; Assert-DeseoBackendAction $workspace 'Reset';
`)));

test('dispatches worktree Test to source and Status to the primary backend', () => scriptFixture(({ setup, dev, primary, linked }) => {
  const backend = quote(join(dev, 'backend.ps1'));
  const output = run(`${setup} & ${backend} -Action Test; & ${backend} -Action Status;`);
  assert.ok(output.includes(`--workdir ${linked} test db --local`), output);
  assert.ok(output.includes(`--workdir ${primary} status`), output);
  assert.ok(output.includes(`STATUS ${primary}`), output);
}));

// Importance: 100. Reload bypass needs a running owned Edge with one exact origin.
test('reloads source functions with one attested Test origin despite other-port listeners', () => scriptFixture(({ setup, dev, linked }) => {
  const output = run(`${setup} $global:fixtureListener = $true;
    function Get-NetTCPConnection { throw 'A same-origin reload does not inspect portal listeners.' }
    & ${quote(join(dev, 'serve-web-functions.ps1'))} -Mode Test;`);
  assert.ok(output.includes(`--workdir ${linked} functions serve --env-file`), output);
  assert.equal(readFileSync(join(linked, '.superpowers/backend/functions.local.env'), 'utf8').trim(),
    'WEB_APP_ORIGIN=http://127.0.0.1:4174\nPUBLIC_SUPABASE_URL=http://127.0.0.1:55721');
}));

test('rejects a foreign Vite executable with a Deseo working directory during an origin change', () => scriptFixture(({ setup, dev, foreign, linked }) => {
  mkdirSync(join(foreign, 'node_modules/vite/bin'), { recursive: true });
  writeFileSync(join(foreign, 'node_modules/vite/bin/vite.js'), '');
  writeFileSync(join(foreign, 'package.json'), JSON.stringify({ name: 'another-project' }));
  writeFileSync(join(foreign, 'vite.config.mjs'), `export default { root: ${JSON.stringify(linked)} };`);
  const command = `node "${join(foreign, 'node_modules/vite/bin/vite.js')}" --port 5174`;
  run(`${setup} $global:fixtureListener = $true;
    $global:fixtureEdgeEnv = @('WEB_APP_ORIGIN=http://127.0.0.1:5174');
    function Get-CimInstance { return [pscustomobject]@{ CommandLine = ${quote(command)}; WorkingDirectory = ${quote(linked)} } }
    Expect-Rejection { & ${quote(join(dev, 'serve-web-functions.ps1'))} -Mode Test } 'listener';
    if (Test-Path (Join-Path $linked '.superpowers/backend/functions.local.env')) { throw 'Serving began before listener rejection.' }`);
}));

test('rejects changed Kong, database, and existing Edge identity before serving', () => scriptFixture(({ setup, dev }) => {
  const serve = quote(join(dev, 'serve-web-functions.ps1'));
  for (const change of ["$global:fixtureProject = 'foreign'", '$global:fixtureOwner = $linked', '$global:fixtureEdgeOwner = $foreign']) {
    run(`${setup} ${change}; Expect-Rejection { & ${serve} -Mode Test } 'identity';`);
  }
}));

test('rejects failed TCP inspection without an attested origin', () => scriptFixture(({ setup, dev }) => {
  const serve = quote(join(dev, 'serve-web-functions.ps1'));
  run(`${setup} $global:fixtureEdgeEnv = @();
    function Get-NetTCPConnection { throw 'TCP inspection failed.' }
    Expect-Rejection { & ${serve} -Mode Test } 'TCP inspection failed';`);
}));

test('rejects missing persistent services and foreign Docker port use', () => scriptFixture(({ setup, dev }) => {
  const serve = quote(join(dev, 'serve-web-functions.ps1'));
  run(`${setup} $global:fixtureContainers = @($global:fixtureContainers | Where-Object { $_.ID -ne 'db' });
    Expect-Rejection { & ${serve} -Mode Test } 'verified deseo backend';`);
  run(`${setup} $global:fixtureContainers += @{ ID = 'foreign'; Names = 'supabase_db_foreign'; Ports = '0.0.0.0:55722->5432/tcp' };
    Expect-Rejection { & ${serve} -Mode Test } 'Another Docker project';`);
  run(`${setup} $global:fixtureContainers += @{ ID = 'foreign'; Names = 'supabase_db_foreign'; Ports = '0.0.0.0:55722->5432/tcp' };
    Expect-Rejection { & ${quote(join(dev, 'backend.ps1'))} -Action Test } 'Another Docker project';`);
}));

test('rejects missing, duplicate, malformed, and changed Edge origins with other-port listeners', () => scriptFixture(({ setup, dev }) => {
  const origins = [[], ['WEB_APP_ORIGIN'], ['WEB_APP_ORIGIN='],
    ['WEB_APP_ORIGIN=http://127.0.0.1:4174', 'WEB_APP_ORIGIN=http://127.0.0.1:4174'],
    ['WEB_APP_ORIGIN=http://127.0.0.1:4174', 'WEB_APP_ORIGIN=http://127.0.0.1:5174'],
    ['WEB_APP_ORIGIN=http://127.0.0.1:5174'], ['WEB_APP_ORIGIN=http://127.0.0.1:4174/'],
    ['WEB_APP_ORIGIN=http://127.0.0.1:4174,http://127.0.0.1:5174'],
    ['WEB_APP_ORIGIN =http://127.0.0.1:4174']];
  for (const origin of origins) {
    run(`${setup} $global:fixtureListener = $true;
      $global:fixtureEdgeEnv = @(${origin.map(quote).join(',')});
      Expect-Rejection { & ${quote(join(dev, 'serve-web-functions.ps1'))} -Mode Test } 'listener';
      if (Test-Path (Join-Path $linked '.superpowers/backend/functions.local.env')) { throw 'Serving began before origin rejection.' }`);
  }
}));

test('rejects stopped or absent Edge containers with other-port listeners', () => scriptFixture(({ setup, dev }) => {
  const serve = quote(join(dev, 'serve-web-functions.ps1'));
  run(`${setup} $global:fixtureListener = $true; $global:fixtureEdgeRunning = $false;
    Expect-Rejection { & ${serve} -Mode Test } 'listener';`);
  run(`${setup} $global:fixtureListener = $true;
    $global:fixtureContainers = @($global:fixtureContainers | Where-Object { $_.ID -ne 'edge' });
    Expect-Rejection { & ${serve} -Mode Test } 'listener';`);
}));

test('reloads an attested Development origin and checks the Test port on origin change', () => scriptFixture(({ setup, dev, linked }) => {
  const serve = quote(join(dev, 'serve-web-functions.ps1'));
  run(`${setup} $global:fixtureListener = $true; $global:fixturePort = 4174;
    $global:fixtureEdgeEnv = @('WEB_APP_ORIGIN=http://127.0.0.1:5174');
    & ${serve} -Mode Development;`);
  assert.equal(readFileSync(join(linked, '.superpowers/backend/functions.local.env'), 'utf8').trim(),
    'WEB_APP_ORIGIN=http://127.0.0.1:5174\nPUBLIC_SUPABASE_URL=http://127.0.0.1:55721');
  run(`${setup} $global:fixtureListener = $true; $global:fixturePort = 4174;
    Expect-Rejection { & ${serve} -Mode Development } 'listener';`);
}));

test('allows an origin change when the other-mode port has no listener', () => scriptFixture(({ setup, dev }) => {
  run(`${setup} $global:fixtureEdgeEnv = @('WEB_APP_ORIGIN=http://127.0.0.1:5174');
    & ${quote(join(dev, 'serve-web-functions.ps1'))} -Mode Test;`);
}));
