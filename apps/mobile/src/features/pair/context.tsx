import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import { useAuth, type Account } from '../auth';
import { AppError } from '../../lib/result';
import { restorePairContext, pairKeys } from './queries';
import { subscribePairSignals } from './realtime';
import type { PairContext } from './types';

type PairGate = { account: Account | null; pair: PairContext | null; checking: boolean; error: Error | null; online: boolean; refresh(): Promise<void> };
const Context = createContext<PairGate | null>(null);

export function PairProvider({ children, reconcileDrafts }: PropsWithChildren<{ reconcileDrafts(accountId: string, pairId: string): Promise<void> }>) {
  const { state, refresh: refreshAuth } = useAuth();
  const account = state.status === 'authenticated' ? state.account : null;
  const [online, setOnline] = useState(true);
  const result = useQuery({ queryKey: pairKeys.context(account?.id ?? ''), queryFn: async () => {
    const pair = await restorePairContext(account!.id);
    if (pair.status === 'active') await reconcileDrafts(account!.id, pair.pairId);
    return pair;
  },
    enabled: !!account, staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const refresh = useCallback(async () => {
    await refreshAuth();
  }, [refreshAuth]);
  useEffect(() => NetInfo.addEventListener(network => {
    const connected = network.isConnected === true && network.isInternetReachable !== false;
    setOnline(wasOnline => {
      if (!wasOnline && connected) void refresh();
      return connected;
    });
  }), [refresh]);
  const pairId = result.data && 'pairId' in result.data ? result.data.pairId : null;
  const livePairId = result.data?.status === 'active' || result.data?.status === 'pending' ? pairId : null;
  useEffect(() => {
    if (!account) return;
    let active = true;
    let remove: (() => void) | undefined;
    const start = () => {
      void subscribePairSignals(account.id, livePairId, () => { void refresh(); }).then(stop => {
        if (!active || AppState.currentState !== 'active') stop(); else remove = stop;
      }).catch(() => { /* Durable checks run on resume and reconnect. */ });
    };
    if (AppState.currentState === 'active') start();
    const listener = AppState.addEventListener('change', status => {
      remove?.(); remove = undefined;
      if (status === 'active') start();
    });
    return () => { active = false; remove?.(); listener.remove(); };
  }, [account?.id, livePairId, refresh]);
  const checking = !!account && (result.isPending || result.isFetching);
  return <Context.Provider value={{ account, pair: account && !checking && !result.error ? result.data ?? null : null,
    checking, error: result.error, online, refresh }}>{children}</Context.Provider>;
}

export function usePairGate(): PairGate {
  const value = useContext(Context);
  if (!value) throw new Error('PairProvider is missing.');
  return value;
}
export function useCore(): { account: Account; pair: PairContext; refresh(): Promise<void>; online: boolean } {
  const value = usePairGate();
  if (!value.account || !value.pair) throw new AppError({ code: 'UNAUTHENTICATED', message: 'Check your account and pair before opening this screen.' });
  return { account: value.account, pair: value.pair, refresh: value.refresh, online: value.online };
}
