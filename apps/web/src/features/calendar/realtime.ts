import { useEffect } from 'react';
import type { PairContext } from '@deseo/domain/pair';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { calendarKeys } from './queries';
export function useCalendarSignals(accountId: string, pair: PairContext | null) {
  useEffect(() => {

    if (pair?.status !== 'active')
      return;

    const scope = captureQueryScope();

    const client = getSupabase();

    let active = true;

    const refresh = () => {

      if (!active)
        return;

      try {
        scope.assertCurrent();
      }
      catch {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: calendarKeys.all(accountId, pair.pairId) });

      void queryClient.invalidateQueries({ queryKey: ['today', accountId, pair.pairId] });

    };

    const channel = client.channel('calendar:' + pair.pairId, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: 'pair_id=eq.' + pair.pairId }, refresh);

    const close = () => { active = false; void client.removeChannel(channel); };

    scope.signal.addEventListener('abort', close, { once: true });

    void client.realtime.setAuth().then(() => {
      if (active)
        channel.subscribe(status => {
          if (status === 'SUBSCRIBED')
            refresh();
        });
    }).catch(() => { });

    return () => { scope.signal.removeEventListener('abort', close); close(); };

  }, [accountId, pair]);
}
