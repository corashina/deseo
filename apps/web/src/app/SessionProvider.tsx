import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Account } from '@deseo/domain/auth';
import type { PairContext } from '@deseo/domain/pair';
import { toAppError } from '@deseo/domain/result';
import { restoreSession } from '../features/auth';
import { getPairContext } from '../features/pair';
import { getSupabase } from '../lib/supabase';
import { resetPrivateQueries } from '../lib/query-client';
import { setDraftScope } from '../lib/drafts';
import { isOnline } from '../lib/network';
type State = { status: 'loading' | 'signedOut' | 'authenticated' | 'error'; account: Account | null; pair: PairContext | null; userId?: string; error?: string };
type SessionValue = State & { revalidate(): Promise<void> };
const empty: State = { status: 'loading', account: null, pair: null };
const Context = createContext<SessionValue | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(empty);
  const generation = useRef(0);
  const mounted = useRef(false);
  const verifiedUser = useRef<string | null>(null);
  const revalidate = useCallback(async () => {
    const request = ++generation.current;
    setState(current => current.status === 'authenticated' ? current : empty);
    await resetPrivateQueries();
    try {
      const session = await restoreSession();
      if (!mounted.current || request !== generation.current) return;
      if (!session) {
        verifiedUser.current = null;
        setDraftScope(null, null);
        setState({ ...empty, status: 'signedOut' });
        return;
      }
      const pair = session.account ? await getPairContext() : null;
      if (!mounted.current || request !== generation.current) return;
      setDraftScope(session.userId, pair && 'pairId' in pair ? pair.pairId : null);
      verifiedUser.current = session.userId;
      setState({ status: 'authenticated', userId: session.userId, account: session.account, pair });
    } catch (error) {
      if (!mounted.current || request !== generation.current) return;
      const failure = toAppError(error);
      const rejected = failure.code === 'FORBIDDEN' || failure.code === 'UNAUTHENTICATED';
      if (rejected) { verifiedUser.current = null; setDraftScope(null, null); }
      await resetPrivateQueries();
      if (request !== generation.current) return;
      setState({ ...empty, status: rejected ? 'signedOut' : 'error', error: failure.message });
      if (rejected) void getSupabase().auth.signOut({ scope: 'local' });
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      generation.current++;
      verifiedUser.current = null;
      void resetPrivateQueries();
      setDraftScope(null, null);
      setState({ ...empty, status: 'signedOut' });
    };
    const refresh = () => { if (isOnline() && verifiedUser.current && document.visibilityState !== 'hidden') void revalidate(); };
    const client = getSupabase();
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') { clearTimeout(timer); reset(); return; }
      generation.current++;
      void resetPrivateQueries();
      if (session?.user.id !== verifiedUser.current) { setDraftScope(null, null); setState(empty); }
      clearTimeout(timer);
      // Leave the Auth callback before acquiring its session lock.
      timer = setTimeout(() => void revalidate(), 0);
    });
    window.addEventListener('deseo:signout', reset);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    void revalidate();
    return () => {
      mounted.current = false; generation.current++; clearTimeout(timer);
      data.subscription.unsubscribe();
      window.removeEventListener('deseo:signout', reset);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      void resetPrivateQueries();
    };
  }, [revalidate]);
  useEffect(() => {
    if (state.status !== 'authenticated' || !state.account) return;
    const client = getSupabase();
    const channel = client.channel('portal-membership:' + state.account.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pair_members', filter: 'user_id=eq.' + state.account.id }, () => void revalidate())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'user_id=eq.' + state.account.id }, () => void revalidate());
    channel.subscribe();
    return () => { void client.removeChannel(channel); };
  }, [state.status, state.account, state.pair, revalidate]);
  return <Context.Provider value={{ ...state, revalidate }}>{children}</Context.Provider>;
}
export function useSession(): SessionValue {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider is missing.');
  return value;
}
