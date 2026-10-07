import { getSupabase } from '../../lib/supabase';
import { queryClient } from '../../lib/query-client';

// Profile changes carry the caller's own data. Pair closure therefore remains observable after shared access ends.
export async function subscribePairSignals(accountId: string, pairId: string | null, revalidate: () => void): Promise<() => void> {
  const client = await getSupabase();
  let subscribed = false;
  const channel = client.channel(`core:${accountId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${accountId}` }, revalidate);
  // Event rows feed Calendar, Today, and event reminders only. Other pair queries keep their data.
  if (pairId) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `pair_id=eq.${pairId}` }, () => {
    for (const feature of ['calendar', 'today', 'notifications']) void queryClient.invalidateQueries({ queryKey: [feature, accountId, pairId] });
  });
  channel.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      if (subscribed) revalidate();
      subscribed = true;
      void queryClient.invalidateQueries();
    }
  });
  return () => { void client.removeChannel(channel); };
}
