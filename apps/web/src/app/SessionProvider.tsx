import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Account } from '@deseo/domain/auth';
import type { PairContext } from '@deseo/domain/pair';
import { toAppError } from '@deseo/domain/result';
import { restoreSession, clearGlobalSignOutFailure, entryIntent } from '../features/auth';
import { getPairContext } from '../features/pair';
import { getSupabase } from '../lib/supabase';
import { resetPrivateQueries } from '../lib/query-client';
import { setDraftScope } from '../lib/drafts';
import { isOnline } from '../lib/network';
type State = { status: 'loading' | 'signedOut' | 'authenticated' | 'error'; account: Account | null; pair: PairContext | null; userId?: string; error?: string };
type SessionValue = State & { revalidate(): Promise<void> };
const empty: State = { status: 'loading', account: null, pair: null };
const Context = createContext<SessionValue | null>(null);
type VerifiedSnapshot = { userId: string; account: Account | null; pair: PairContext | null };
function representedProfile(snapshot: VerifiedSnapshot | null, row: Record<string, unknown>) {
  const account = snapshot?.account;
  if (!account || account.id !== snapshot!.userId || row.user_id !== account.id
    || account.status !== 'active' || row.account_status !== 'active'
    || typeof row.version !== 'number' || !Number.isSafeInteger(row.version) || row.version < 1
    || typeof row.display_name !== 'string' || !row.display_name.length || row.display_name.length > 40
    || typeof row.timezone !== 'string' || !row.timezone.length || row.timezone.length > 100
    || typeof row.locale !== 'string' || row.locale.length < 2 || row.locale.length > 35) return false;
  return row.version < account.version || (row.version === account.version
    && row.display_name === account.displayName && row.timezone === account.timezone && row.locale === account.locale);
}
function representedMembership(snapshot: VerifiedSnapshot | null, row: Record<string, unknown>, event: string) {
  const pair = snapshot?.pair;
  if (!snapshot || !pair || !['pending', 'active'].includes(pair.status)
    || event !== 'INSERT' || row.user_id !== snapshot.userId || row.left_at !== null) return false;
  const member = pair.status === 'pending' ? pair.member : pair.status === 'active' ? pair.members.find(member => member.userId === snapshot.userId) : undefined;
  return Boolean(member && member.userId === snapshot.userId && row.pair_id === ('pairId' in pair ? pair.pairId : null) && row.slot === member.slot);
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(empty);
  const accountId = state.account?.id;
  const generation = useRef(0);
  const mounted = useRef(false);
  const verifiedUser = useRef<string | null>(null);
  const verifiedAuthority = useRef<string | null>(null);
  const verifiedSnapshot = useRef<VerifiedSnapshot | null>(null);
  const revalidate = useCallback(async () => {
    const request = ++generation.current;
    setState(current => current.status === 'authenticated' ? current : empty);
    await resetPrivateQueries();
    try {
      const session = await restoreSession();
      if (!mounted.current || request !== generation.current) return;
      if (!session) {
        if (verifiedAuthority.current !== null) await resetPrivateQueries();
        if (!mounted.current || request !== generation.current) return;
        verifiedUser.current = null;
        verifiedAuthority.current = null;
        verifiedSnapshot.current = null;
        setDraftScope(null, null);
        setState({ ...empty, status: 'signedOut' });
        return;
      }
      const pair = session.account ? await getPairContext() : null;
      if (!mounted.current || request !== generation.current) return;
      const pairId = pair && 'pairId' in pair ? pair.pairId : null;
      const authority = session.userId + ':' + (session.account?.status ?? 'setup') + ':' + pair?.status + ':' + pairId;
      // Old pages can start reads during verification. Abort them before adopting another authority.
      if (verifiedAuthority.current !== authority) {
        await resetPrivateQueries();
        if (!mounted.current || request !== generation.current) return;
      }
      verifiedAuthority.current = authority;
      verifiedSnapshot.current = { userId: session.userId, account: session.account, pair };
      setDraftScope(session.userId, pair && 'pairId' in pair ? pair.pairId : null, pair?.status);
      verifiedUser.current = session.userId;
      setState({ status: 'authenticated', userId: session.userId, account: session.account, pair });
    } catch (error) {
      if (!mounted.current || request !== generation.current) return;
      const failure = toAppError(error);
      verifiedSnapshot.current = null;
      const rejected = failure.code === 'FORBIDDEN' || failure.code === 'UNAUTHENTICATED';
      if (rejected) { verifiedUser.current = null; verifiedAuthority.current = null; setDraftScope(null, null); }
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
      verifiedAuthority.current = null;
      verifiedSnapshot.current = null;
      entryIntent.email = ''; entryIntent.emailDraft = ''; entryIntent.codeDraft = ''; entryIntent.invite = null;
      void resetPrivateQueries();
      setDraftScope(null, null);
      setState({ ...empty, status: 'signedOut' });
    };
    const refresh = () => { if (isOnline() && verifiedUser.current && document.visibilityState !== 'hidden') void revalidate(); };
    const client = getSupabase();
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') { clearTimeout(timer); reset(); return; }
      if (event === 'SIGNED_IN') { clearGlobalSignOutFailure(); entryIntent.emailDraft = ''; entryIntent.codeDraft = ''; }
      generation.current++;
      void resetPrivateQueries();
      if (session?.user.id !== verifiedUser.current) {
        verifiedUser.current = null; verifiedAuthority.current = null; verifiedSnapshot.current = null;
        setDraftScope(null, null); setState(empty);
      }
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
    if (state.status !== 'authenticated' || !accountId) return;
    const client = getSupabase();
    const channel = client.channel('portal-membership:' + accountId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pair_members', filter: 'user_id=eq.' + accountId }, payload => {
        if (verifiedUser.current !== accountId) return;
        if (!representedMembership(verifiedSnapshot.current, payload.new, payload.eventType)) void revalidate();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'user_id=eq.' + accountId }, payload => {
        if (verifiedUser.current !== accountId) return;
        if (!representedProfile(verifiedSnapshot.current, payload.new)) void revalidate();
      });
    channel.subscribe();
    return () => { void client.removeChannel(channel); };
  }, [state.status, accountId, revalidate]);
  return <Context.Provider value={{ ...state, revalidate }}>{children}</Context.Provider>;
}
export function useSession(): SessionValue {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider is missing.');
  return value;
}
