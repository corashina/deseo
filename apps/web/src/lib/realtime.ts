import { useEffect } from 'react';
import type { PairContext } from '@deseo/domain/pair';
import { getSupabase } from './supabase';
import { queryClient } from './query-client';
type Channel = { topic: string; private: boolean; table?: string };
// Signals carry no content. Any authorized signal invalidates the feature queries and Today.
// Authenticated reads then supply the data.
export function usePairSignals(feature: string, accountId: string, pair: PairContext | null, channel: Channel) {
  const pairId = pair?.status === 'active' ? pair.pairId : null;
  const { topic, private: isPrivate, table } = channel;
  useEffect(() => {
    if (!pairId) return;
    const client = getSupabase();
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: [feature, accountId, pairId] });
      void queryClient.invalidateQueries({ queryKey: ['today', accountId, pairId] });
    };
    const subscription = client.channel(topic, { config: { private: isPrivate } });
    if (isPrivate) subscription.on('broadcast', { event: 'changed' }, refresh);
    if (table) subscription.on('postgres_changes', { event: '*', schema: 'public', table, filter: 'pair_id=eq.' + pairId }, refresh);
    let active = true;
    // Read after each subscribe to catch changes made while the channel was closed.
    void client.realtime.setAuth().then(() => {
      if (active) subscription.subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
    }).catch(() => {});
    return () => { active = false; void client.removeChannel(subscription); };
  }, [feature, accountId, pairId, topic, isPrivate, table]);
}
