import { z } from 'zod';
import { accountSchema, emailCodeSchema, emailSchema, profileSchema, type Account, type ProfileInput } from '@deseo/domain/auth';
import { AppError, errorResult, resultSchema, type Result } from '@deseo/domain/result';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope, resetPrivateQueries } from '../../lib/query-client';
import { setDraftScope } from '../../lib/drafts';
export const entryIntent: { email: string; retryAt: string; invite: string | null; invalidInvite: boolean } = { email: '', retryAt: '', invite: null, invalidInvite: false };
export async function requestEmailCode(email: string): Promise<Result<{ retryAt: string }>> {
  try {
    const parsed = emailSchema.parse(email);
    const { error } = await getSupabase().auth.signInWithOtp({ email: parsed, options: { shouldCreateUser: true } });
    if (error) throw error;
    entryIntent.email = parsed;
    entryIntent.retryAt = new Date(Date.now() + 60_000).toISOString();
    return { ok: true, data: { retryAt: entryIntent.retryAt } };
  } catch (error) { return errorResult(error); }
}
export async function verifyEmailCode(email: string, code: string): Promise<Result<{ userId: string }>> {
  try {
    const { data, error } = await getSupabase().auth.verifyOtp({ email: emailSchema.parse(email), token: emailCodeSchema.parse(code), type: 'email' });
    if (error) throw error;
    if (!data.session || !data.user) throw new AppError({ code: 'UNAUTHENTICATED' });
    return { ok: true, data: { userId: data.user.id } };
  } catch (error) { return errorResult(error); }
}
export async function saveProfile(input: ProfileInput, expectedVersion?: number): Promise<Result<Account>> {
  try {
    const scope = captureQueryScope();
    const profile = profileSchema.parse(input);
    if (expectedVersion !== undefined) z.number().int().positive().parse(expectedVersion);
    const { data, error } = await getSupabase().rpc('save_profile', {
      p_display_name: profile.displayName, p_timezone: profile.timezone, p_locale: profile.locale,
      p_expected_version: expectedVersion ?? null,
    }).abortSignal(scope.signal);
    scope.assertCurrent();
    if (error) throw error;
    return resultSchema(accountSchema).parse(data);
  } catch (error) { return errorResult(error); }
}
export async function signOut(scope: 'local' | 'global' = 'local') {
  window.dispatchEvent(new Event('deseo:signout'));
  setDraftScope(null, null);
  entryIntent.invite = null;
  entryIntent.invalidInvite = false;
  entryIntent.email = '';
  await resetPrivateQueries();
  const { error } = await getSupabase().auth.signOut({ scope });
  if (error) throw error;
}
