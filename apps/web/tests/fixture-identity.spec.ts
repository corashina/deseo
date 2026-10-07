import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { mock } from 'node:test';
import { test, expect } from '@playwright/test';
import { expireEntryCode } from './support/entry-fixtures';
import { resolveFixtureDatabase, type FixtureContainer } from './support/fixture-backend';

const accountId = '11111111-1111-4111-8111-111111111111';
const apiId = 'a'.repeat(64);
const databaseId = 'b'.repeat(64);
function backend(project: string): FixtureContainer[] {
  return [
    { id: apiId, name: '/supabase_kong_' + project, running: true, project, workdir: 'C:/fixtures/' + project,
      ports: { '8000/tcp': [{ HostIp: '0.0.0.0', HostPort: '55721' }] } },
    { id: databaseId, name: '/supabase_db_' + project, running: true, project, workdir: 'C:/fixtures/' + project,
      ports: { '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '55722' }] } },
  ];
}
function withDocker(containers: FixtureContainer[], check: (sql: string[][]) => void, result = accountId + '\n') {
  const sql: string[][] = [];
  const intercepted = mock.method(childProcess, 'execFileSync', ((_file: unknown, args: string[]) => {
    if (args[0] === 'ps') return containers.map(container => container.id).join('\n');
    if (args[0] === 'inspect') return containers.map(container => JSON.stringify(container)).join('\n');
    if (args[0] === 'exec') { sql.push(args); return result; }
    throw new Error('Unexpected Docker command.');
  }) as typeof childProcess.execFileSync);
  syncBuiltinESMExports();
  try { check(sql); }
  finally { intercepted.mock.restore(); syncBuiltinESMExports(); }
}

// Importance 100: expiry must mutate only the database that owns the fixture API.
test('fixture database resolves the documented deseo-web identity before SQL', () => {
  withDocker(backend('deseo-web'), sql => {
    expireEntryCode(accountId);
    expect(sql).toHaveLength(1);
    expect(sql[0][1]).toBe(databaseId);
    expect(sql[0].at(-1)).toContain("email like 'entry-%@example.test'");
    expect(sql[0].at(-1)).toContain(accountId);
  });
});

// Importance 100: API/database project mismatch must prevent SQL.
test('fixture database rejects a different API and database project before SQL', () => {
  const containers = backend('deseo-web');
  containers[1] = backend('other-project')[1];
  withDocker(containers, sql => {
    expect(() => expireEntryCode(accountId)).toThrow(/identity|project/i);
    expect(sql).toHaveLength(0);
  });
});

// Importance 100: equal project names cannot authorize different source directories.
test('fixture database rejects different project directories before SQL', () => {
  const containers = backend('deseo-web');
  containers[1].workdir = 'C:/different-project';
  withDocker(containers, sql => {
    expect(() => expireEntryCode(accountId)).toThrow(/identity/i);
    expect(sql).toHaveLength(0);
  });
});

// Importance 100: multiple endpoint owners cannot select a safe SQL target.
test('fixture database rejects ambiguous database bindings before SQL', () => {
  const containers = backend('deseo-web');
  containers.push({ ...backend('other-project')[1], id: 'c'.repeat(64) });
  withDocker(containers, sql => {
    expect(() => expireEntryCode(accountId)).toThrow(/ambiguous/i);
    expect(sql).toHaveLength(0);
  });
});

// Importance 100: unavailable or mislabeled containers cannot authorize a fixture mutation.
for (const invalid of ['stopped', 'missing-project', 'wrong-role'] as const) {
  test('fixture database rejects ' + invalid + ' identity before SQL', () => {
    const containers = backend('deseo-web');
    if (invalid === 'stopped') containers[1].running = false;
    if (invalid === 'missing-project') containers[1].project = null;
    if (invalid === 'wrong-role') containers[1].name = '/supabase_auth_deseo-web';
    withDocker(containers, sql => {
      expect(() => expireEntryCode(accountId)).toThrow(/identity/i);
      expect(sql).toHaveLength(0);
    });
  });
}

// Importance 100: a missing guarded account must fail instead of claiming code expiry.
test('fixture database rejects an unmatched disposable account result', () => {
  withDocker(backend('deseo-web'), sql => {
    expect(() => expireEntryCode(accountId)).toThrow(/disposable fixture/i);
    expect(sql).toHaveLength(1);
  }, '');
});

// Importance 100: status credentials must never route expiry outside loopback endpoints.
test('fixture database rejects hosted API and database endpoints', () => {
  const containers = backend('deseo-web');
  expect(() => resolveFixtureDatabase('https://project.supabase.co', 'postgresql://postgres:test@127.0.0.1:55722/postgres', containers)).toThrow(/local API and database/);
  expect(() => resolveFixtureDatabase('http://127.0.0.1:55721', 'postgresql://postgres:test@project.supabase.co:5432/postgres', containers)).toThrow(/local API and database/);
});
