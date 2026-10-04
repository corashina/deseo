import { getSupabase } from '../../lib/supabase';
import { captureQueryScope } from '../../lib/query-client';

type Connection = { listeners: Map<symbol, () => void>; assertCurrent(): void; dispose(): void };
const connections = new Map<string, Promise<Connection>>();

// Payloads only invalidate queries. Authenticated durable reads supply screen content.
export async function subscribeMessages(accountId: string, pairId: string, refresh: () => void): Promise<() => void> {
  const key = `${accountId}:${pairId}`;
  let pending = connections.get(key);
  if (!pending) {
    const scope = captureQueryScope();
    pending = (async () => {
      const client = await getSupabase();
      scope.assertCurrent();
      const listeners = new Map<symbol, () => void>();
      let active = true;
      const notify = () => {
        if (active && !scope.signal.aborted) listeners.forEach(listener => listener());
      };
      const channel = client.channel(`messages:${accountId}:${pairId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `pair_id=eq.${pairId}` }, notify)
        .subscribe(status => { if (status === 'SUBSCRIBED') notify(); });
      const dispose = () => {
        if (!active) return;
        active = false; listeners.clear(); void client.removeChannel(channel);
        scope.signal.removeEventListener('abort', dispose);
        if (connections.get(key) === pending) connections.delete(key);
      };
      scope.signal.addEventListener('abort', dispose, { once: true });
      return { listeners, assertCurrent: scope.assertCurrent, dispose };
    })();
    connections.set(key, pending);
  }
  let connection: Connection;
  try { connection = await pending; }
  catch (error) { if (connections.get(key) === pending) connections.delete(key); throw error; }
  connection.assertCurrent();
  const listener = Symbol(); connection.listeners.set(listener, refresh);
  return () => { connection.listeners.delete(listener); if (!connection.listeners.size) connection.dispose(); };
}
