import { getSupabase } from '../../lib/supabase';
import { AppError, toAppError } from '@deseo/domain/result';
import { captureQueryScope } from '../../lib/query-client';
import { sessionResultSchema } from '@deseo/domain/auth';
import type { Account, SessionContext } from '@deseo/domain/auth';

export async function restoreSession(): Promise<SessionContext | null> {
  const scope = captureQueryScope();
  const client = await getSupabase();
  const { data: local, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw toAppError(sessionError);
  if (!local.session) return null;
  const { data, error } = await client.rpc('get_session_context');
  if (error) throw toAppError(error);
  scope.assertCurrent();
  const parsed = sessionResultSchema.safeParse(data);
  if (!parsed.success) throw new AppError({ code: 'RETRYABLE', message: 'We could not validate your account. Try again.' });
  if (!parsed.data.ok) throw new AppError(parsed.data.error);
  const context = parsed.data.data;
  if (context.userId !== local.session.user.id || context.account?.id !== undefined && context.account.id !== context.userId) {
    throw new AppError({ code: 'UNAUTHENTICATED', message: 'Sign in again.' });
  }
  if (context.account?.status === 'disabled') {
    throw new AppError({ code: 'FORBIDDEN', message: 'This account is disabled.' });
  }
  return context;
}
export async function getAccount(): Promise<Account | null> {
  return (await restoreSession())?.account ?? null;
}
