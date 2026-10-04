import { useEffect } from 'react';
import { AppState } from 'react-native';
import { usePairGate } from '../features/pair';
import { connectCalendarSignals } from '../features/calendar';
import { connectTaskSignals } from '../features/tasks';
import { messageKeys, subscribeMessages } from '../features/messages';
import { ensureMemoryLifecycle } from '../features/memories';
import { captureQueryScope, queryClient } from '../lib/query-client';

// Keep Today and tab badges current before their feature screens have opened.
export function FeatureLifecycle() {
  const { account, pair, refresh } = usePairGate();
  const accountId = account?.id;
  const pairId = pair?.status === 'active' ? pair.pairId : undefined;
  useEffect(() => { ensureMemoryLifecycle(); }, []);
  useEffect(() => {
    if (!accountId || !pairId) return;
    const stopTasks = connectTaskSignals(accountId, pairId, refresh);
    const stopCalendar = connectCalendarSignals(accountId, pairId, refresh);
    const scope = captureQueryScope();
    let current = true; let generation = 0; let stopMessages: (() => void) | undefined;
    const invalidate = () => {
      if (!current || scope.signal.aborted) return;
      void queryClient.invalidateQueries({ queryKey: messageKeys.all(accountId, pairId) });
      void queryClient.invalidateQueries({ queryKey: ['today', accountId, pairId] });
    };
    const start = () => {
      const attempt = ++generation;
      invalidate();
      void subscribeMessages(accountId, pairId, invalidate).then(stop => {
        if (current && attempt === generation && !scope.signal.aborted) stopMessages = stop; else stop();
      }).catch(() => undefined);
    };
    if (AppState.currentState === 'active') start();
    const lifecycle = AppState.addEventListener('change', state => {
      generation += 1; stopMessages?.(); stopMessages = undefined;
      if (state === 'active') start();
    });
    return () => { current = false; generation += 1; stopMessages?.(); stopTasks(); stopCalendar(); lifecycle.remove(); };
  }, [accountId, pairId, refresh]);
  return null;
}
