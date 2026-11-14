import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Account } from '@deseo/domain/auth';
import type { PairContext } from '@deseo/domain/pair';
import { toAppError } from '@deseo/domain/result';
import { restoreSession, clearGlobalSignOutFailure, clearEntryIntent } from '../features/auth';
import { getPairContext } from '../features/pair';
import { getSupabase } from '../lib/supabase';
import { resetPrivateQueries } from '../lib/query-client';
import { clearDrafts } from '../lib/drafts';
type State = { status: 'loading' | 'signedOut' | 'authenticated' | 'error'; account: Account | null; pair: PairContext | null; userId?: string; error?: string };
type SessionValue = State & { revalidate(): Promise<void> };
const loading: State = { status: 'loading', account: null, pair: null };
const signedOut: State = { status: 'signedOut', account: null, pair: null };
const Context = createContext<SessionValue | null>(null);
const scopeOf = (userId: string, account: Account | null, pair: PairContext | null) =>
  userId + ':' + Boolean(account) + ':' + pair?.status + ':' + (pair && 'pairId' in pair ? pair.pairId : '');
function clearPrivateState() {
  clearDrafts();
  void resetPrivateQueries();
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(loading);
  const accountId = state.account?.id;
  // Drop answers from older checks. A newer check or a sign-out supersedes them.
  const generation = useRef(0);
  const scope = useRef<string | null>(null);
  const revalidate = useCallback(async () => {
    const request = ++generation.current;
    try {
      const session = await restoreSession();
      const pair = session?.account ? await getPairContext() : null;
      if (request !== generation.current) return;
      const nextScope = session ? scopeOf(session.userId, session.account, pair) : null;
      // Privacy rule: clear private caches before another account or pair can show.
      if (scope.current !== nextScope) { scope.current = nextScope; clearPrivateState(); }
      const nextState: State = session ? { status: 'authenticated', userId: session.userId, account: session.account, pair } : signedOut;
      // Keep the same objects when nothing changed. Then a focus check does not re-run effects or rejoin channels.
      setState(current => JSON.stringify(current) === JSON.stringify(nextState) ? current : nextState);
    } catch (error) {
      if (request !== generation.current) return;
      const failure = toAppError(error);
      const rejected = failure.code === 'FORBIDDEN' || failure.code === 'UNAUTHENTICATED';
      scope.current = null;
      clearPrivateState();
      setState({ ...loading, status: rejected ? 'signedOut' : 'error', error: failure.message });
      if (rejected) void getSupabase().auth.signOut({ scope: 'local' });
    }
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      generation.current++;
      scope.current = null;
      clearEntryIntent();
      clearPrivateState();
      setState(signedOut);
    };
    const refresh = () => { if (scope.current) void revalidate(); };
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      clearTimeout(timer);
      if (event === 'SIGNED_OUT') { reset(); return; }
      if (event === 'SIGNED_IN') clearGlobalSignOutFailure();
      if (!scope.current?.startsWith(session?.user.id + ':')) {
        generation.current++; scope.current = null; clearPrivateState(); setState(loading);
      }
      // Leave the Auth callback before the next request takes its session lock.
      timer = setTimeout(() => void revalidate(), 0);
    });
    window.addEventListener('deseo:signout', reset);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    void revalidate();
    return () => {
      generation.current++; clearTimeout(timer);
      data.subscription.unsubscribe();
      window.removeEventListener('deseo:signout', reset);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [revalidate]);
  useEffect(() => {
    if (state.status !== 'authenticated' || !accountId) return;
    // Any membership or profile signal for this account refetches the session context.
    const client = getSupabase();
    const channel = client.channel('portal-membership:' + accountId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pair_members', filter: 'user_id=eq.' + accountId }, () => void revalidate())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'user_id=eq.' + accountId }, () => void revalidate())
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [state.status, accountId, revalidate]);
  return <Context.Provider value={{ ...state, revalidate }}>{children}</Context.Provider>;
}
export function useSession(): SessionValue {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider is missing.');
  return value;
}
