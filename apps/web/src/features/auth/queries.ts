import { sessionResultSchema } from '@deseo/domain/auth';
import { AppError } from '@deseo/domain/result';
import { getSupabase } from '../../lib/supabase';
// The next read needs only a signed-in session, so it starts with the session read. The caller drops it for a user without a profile.
export async function restoreSession<T>(next: () => Promise<T>) {
  const client = getSupabase();
  const { data: local, error: localError } = await client.auth.getSession();
  if (localError) throw localError;
  if (!local.session) return null;
  const nextRead = next();
  nextRead.catch(() => undefined);
  const { data, error } = await client.rpc('get_session_context');
  if (error) throw error;
  const result = sessionResultSchema.parse(data);
  if (!result.ok) throw new AppError(result.error);
  if (result.data.userId !== local.session.user.id) throw new AppError({ code: 'UNAUTHENTICATED' });
  if (result.data.account && (result.data.account.id !== result.data.userId || result.data.account.status !== 'active')) {
    throw new AppError({ code: 'FORBIDDEN' });
  }
  return { ...result.data, next: nextRead };
}
