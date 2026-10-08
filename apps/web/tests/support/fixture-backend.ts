export type FixtureContainer = {
  id: string; name: string; running: boolean; project: string | null; workdir: string | null;
  ports: Record<string, { HostIp: string; HostPort: string }[] | null>;
};

// Resolve both status endpoints before allowing a privileged fixture write.
export function resolveFixtureDatabase(apiUrl: string, databaseUrl: string, containers: readonly FixtureContainer[]): string {
  let api: URL; let database: URL;
  try { api = new URL(apiUrl); database = new URL(databaseUrl); }
  catch { throw new Error('Fixture backend endpoints are invalid.'); }
  if (api.protocol !== 'http:' || api.hostname !== '127.0.0.1' || api.port !== '55721'
    || api.username || api.password || api.pathname !== '/' || api.search || api.hash
    || !['postgres:', 'postgresql:'].includes(database.protocol) || database.hostname !== '127.0.0.1'
    || !database.port || database.pathname !== '/postgres' || database.search || database.hash) {
    throw new Error('Fixture backend endpoints must use the local API and database.');
  }
  function owner(port: string, containerPort: string): FixtureContainer {
    const matches = containers.filter(container => container.running && container.ports[containerPort]?.some(binding =>
      binding.HostPort === port && ['127.0.0.1', '0.0.0.0'].includes(binding.HostIp)));
    if (matches.length !== 1) throw new Error('Fixture backend endpoint identity is missing or ambiguous.');
    return matches[0];
  }
  const gateway = owner(api.port, '8000/tcp');
  const target = owner(database.port, '5432/tcp');
  if (!gateway.project || !/^[a-zA-Z0-9_-]+$/.test(gateway.project) || gateway.project !== target.project
    || !gateway.workdir || gateway.workdir !== target.workdir
    || gateway.name !== '/supabase_kong_' + gateway.project || target.name !== '/supabase_db_' + target.project
    || !/^[0-9a-f]{64}$/.test(gateway.id) || !/^[0-9a-f]{64}$/.test(target.id)) {
    throw new Error('Fixture API and database project identity do not match.');
  }
  return target.id;
}