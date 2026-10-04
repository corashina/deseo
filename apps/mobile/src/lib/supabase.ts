import 'react-native-url-polyfill/auto';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { getPrivateStorage } from './private-storage';
import { captureQueryScope } from './query-client';
import { AppError } from './result';

let client: Promise<SupabaseClient> | undefined;
async function scopedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const scope = captureQueryScope();
  const controller = new AbortController();
  const original = init?.signal;
  const abort = () => controller.abort();
  scope.signal.addEventListener('abort', abort);
  original?.addEventListener('abort', abort);
  if (scope.signal.aborted || original?.aborted) controller.abort();
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    scope.assertCurrent();
    return response;
  } finally {
    scope.signal.removeEventListener('abort', abort);
    original?.removeEventListener('abort', abort);
  }
}
export function getSupabase(): Promise<SupabaseClient> {
  client ??= (async () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key?.startsWith('sb_publishable_')) {
      throw new AppError({ code: 'RETRYABLE', message: 'Set the Supabase URL and publishable key before you sign in.' });
    }
    const storage = await getPrivateStorage();
    return createClient(url, key, {
      auth: { storage: storage.session, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, lock: processLock },
      global: { fetch: scopedFetch },
    });
  })();
  return client;
}
export async function resetSupabaseClient(): Promise<void> {
  const previous = client;
  client = undefined;
  if (previous) {
    try {
      const resolved = await previous;
      resolved.auth.stopAutoRefresh();
      await resolved.removeAllChannels();
    } catch { /* Storage or configuration already blocked this client. */ }
  }
}
