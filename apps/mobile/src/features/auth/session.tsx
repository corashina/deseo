import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { getSupabase, resetSupabaseClient } from '../../lib/supabase';
import { getPrivateStorage, onPrivateStorageFailure, resetPrivateStorage } from '../../lib/private-storage';
import { connectQueryLifecycle, resetPrivateQueries } from '../../lib/query-client';
import { AppError, toAppError } from '@deseo/domain/result';
import { restoreSession } from './queries';
import { onSessionReset } from './session-events';
import type { AuthState } from '@deseo/domain/auth';
import { flushPrivateDrafts } from '../../lib/draft';

interface AuthContextValue {
  state: AuthState;
  refresh(): Promise<void>;
  retryStorage(): Promise<void>;
  /** True while a verified account is checked again. Cover its content until the check ends. */
  verifying: boolean;
  /** Counts checks that confirmed the same account. The pair gate checks membership again after each one. */
  verifiedAt: number;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [clientVersion, setClientVersion] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState(0);
  const generation = useRef(0);
  const mounted = useRef(true);
  const accountId = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    const drafts = flushPrivateDrafts();
    // A verified account keeps its screens and cache under a cover. Any other result clears them.
    const kept = accountId.current;
    if (kept) setVerifying(true);
    else setState({ status: 'loading' });
    try {
      await drafts;
      if (!kept) await resetPrivateQueries();
      const context = await restoreSession();
      if (!mounted.current || request !== generation.current) return;
      if (kept && context?.userId !== kept) {
        accountId.current = null;
        setState({ status: 'loading' });
        await resetPrivateQueries();
        if (!mounted.current || request !== generation.current) return;
      }
      if (!context) {
        accountId.current = null;
        setState({ status: 'signedOut' });
        return;
      }
      const storage = await getPrivateStorage();
      const previous = await storage.getIntent('lastAccount');
      if (previous && previous !== context.userId) await storage.purgeAccountDrafts(previous);
      await storage.setIntent('lastAccount', context.userId);
      if (!mounted.current || request !== generation.current) return;
      accountId.current = context.userId;
      setState({ status: 'authenticated', ...context });
      if (kept === context.userId) setVerifiedAt(value => value + 1);
    } catch (error) {
      if (!mounted.current || request !== generation.current) return;
      const appError = toAppError(error);
      if (kept) {
        accountId.current = null;
        await resetPrivateQueries();
        if (!mounted.current || request !== generation.current) return;
      }
      if (appError.code === 'FORBIDDEN' || appError.code === 'UNAUTHENTICATED') {
        try {
          const storage = await getPrivateStorage();
          const previous = accountId.current ?? await storage.getIntent('lastAccount');
          if (appError.code === 'FORBIDDEN' && previous) await storage.purgeAccountDrafts(previous);
          await storage.clearSession();
          await resetSupabaseClient();
        } catch (storageError) {
          if (mounted.current && request === generation.current) setState({ status: 'error', error: toAppError(storageError) });
          return;
        }
        if (!mounted.current || request !== generation.current) return;
        accountId.current = null;
        setState({ status: 'signedOut', error: appError });
        setClientVersion((value) => value + 1);
      } else setState({ status: 'error', error: appError });
    } finally {
      if (mounted.current && request === generation.current) setVerifying(false);
    }
  }, []);
  const retryStorage = useCallback(async () => {
    generation.current += 1;
    setVerifying(false);
    setState({ status: 'loading' });
    await resetPrivateQueries();
    await resetSupabaseClient();
    try {
      await resetPrivateStorage();
      accountId.current = null;
      setClientVersion((value) => value + 1);
    } catch (error) { setState({ status: 'error', error: toAppError(error) }); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const disconnectQueries = connectQueryLifecycle();
    const removeStorageListener = onPrivateStorageFailure((error) => {
      generation.current += 1;
      accountId.current = null;
      void resetPrivateQueries();
      void resetSupabaseClient();
      setVerifying(false);
      setState({ status: 'error', error });
    });
    const removeResetListener = onSessionReset((event) => {
      generation.current += 1;
      accountId.current = null;
      setVerifying(false);
      setState({ status: 'signedOut' });
      if (event === 'client') setClientVersion((value) => value + 1);
    });
    return () => {
      mounted.current = false;
      generation.current += 1;
      disconnectQueries();
      removeStorageListener();
      removeResetListener();
    };
  }, []);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const appState = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        // Cover private content in the app switcher. Resume checks the account again before removing the cover.
        const request = ++generation.current;
        if (accountId.current) setVerifying(true);
        void flushPrivateDrafts().catch(error => {
          if (active && request === generation.current) setState({ status: 'error', error: toAppError(error) });
        });
      }
      void getSupabase().then((client) => {
        if (!active) return;
        if (next === 'active') {
          client.auth.startAutoRefresh();
          void refresh();
        } else {
          client.auth.stopAutoRefresh();
        }
      }).catch((error) => { if (active) setState({ status: 'error', error: toAppError(error) }); });
    });
    void getSupabase().then((client) => {
      if (!active) return;
      const { data } = client.auth.onAuthStateChange((event) => {
        // Token refresh keeps the same account and session. Realtime and server checks report access changes.
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
        const request = ++generation.current;
        const drafts = flushPrivateDrafts();
        setState({ status: 'loading' });
        // Supabase holds its auth lock during this callback.
        setTimeout(() => {
          void drafts.then(() => { if (active && request === generation.current) void refresh(); }).catch(error => {
            if (active && request === generation.current) setState({ status: 'error', error: toAppError(error) });
          });
        }, 0);
      });
      unsubscribe = () => { data.subscription.unsubscribe(); client.auth.stopAutoRefresh(); };
      if (AppState.currentState === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
      void refresh();
    }).catch((error) => { if (active) setState({ status: 'error', error: toAppError(error) }); });
    return () => { active = false; generation.current += 1; appState.remove(); unsubscribe?.(); };
  }, [clientVersion, refresh]);
  return <AuthContext.Provider value={{ state, refresh, retryStorage, verifying, verifiedAt }}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new AppError({ code: 'RETRYABLE', message: 'AuthProvider is missing.' });
  return value;
}
