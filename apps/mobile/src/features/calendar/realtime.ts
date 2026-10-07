import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { DeseoClient } from '../../lib/supabase';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { calendarKeys } from './queries';

type Connection = { listeners: Map<symbol, () => Promise<void>>; dispose(): void };
const connections = new Map<string, Connection>();

// Native stacks keep previous screens mounted. One channel serves their active scope.
export function connectCalendarSignals(accountId: string, pairId: string, refresh: () => Promise<void>): () => void {
  const key = `${accountId}:${pairId}`;
  let connection = connections.get(key);
  if (!connection) {
    const listeners = new Map<symbol, () => Promise<void>>();
    const scope = captureQueryScope();
    let channel: RealtimeChannel | undefined; let client: DeseoClient | undefined;
    let active = true; let generation = 0;
    const invalidate = () => {
      try { scope.assertCurrent(); } catch { return; }
      if (!active) return;
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all(accountId, pairId) });
      void queryClient.invalidateQueries({ queryKey: ['today', accountId, pairId] });
    };
    const revalidate = () => { const callback = listeners.values().next().value; if (callback) void callback(); };
    const close = () => { generation += 1; if (channel && client) void client.removeChannel(channel); channel = undefined; };
    const start = async () => {
      const attempt = ++generation;
      try {
        client = await getSupabase(); scope.assertCurrent(); await client.realtime.setAuth(); scope.assertCurrent();
        if (!active || attempt !== generation || AppState.currentState !== 'active') return;
        channel = client.channel(`calendar:${pairId}`, { config: { private: true } }).on('broadcast', { event: 'changed' }, invalidate);
        let subscribed = false;
        channel.subscribe(status => {
          if (status !== 'SUBSCRIBED' || !active || attempt !== generation) return;
          if (subscribed) revalidate(); subscribed = true; invalidate();
        });
      } catch { /* Foreground and reconnect also fetch durable rows. */ }
    };
    const lifecycle = AppState.addEventListener('change', state => {
      close();
      if (state === 'active') { revalidate(); void start(); invalidate(); }
    });
    const dispose = () => {
      if (!active) return;
      active = false; close(); lifecycle.remove(); scope.signal.removeEventListener('abort', dispose);
      if (connections.get(key)?.dispose === dispose) connections.delete(key);
    };
    connection = { listeners, dispose }; connections.set(key, connection);
    scope.signal.addEventListener('abort', dispose, { once: true });
    if (AppState.currentState === 'active') void start();
  }
  const listener = Symbol(); connection.listeners.set(listener, refresh);
  const current = connection;
  return () => { current.listeners.delete(listener); if (current.listeners.size === 0) current.dispose(); };
}
export function useCalendarSignals(accountId: string, pairId: string, refresh: () => Promise<void>) {
  useEffect(() => connectCalendarSignals(accountId, pairId, refresh), [accountId, pairId, refresh]);
}
