import { getSupabase } from '../../lib/supabase';
import { captureQueryScope } from '../../lib/query-client';

// Payloads only invalidate queries. Authenticated durable reads supply screen content.
export async function subscribeMessages(accountId: string, pairId: string, refresh: () => void): Promise<() => void> {
  const scope = captureQueryScope();
  const client = await getSupabase();
  scope.assertCurrent();
  const channel = client.channel(`messages:${accountId}:${pairId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `pair_id=eq.${pairId}` }, refresh)
    .subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
  return () => { void client.removeChannel(channel); };
}
