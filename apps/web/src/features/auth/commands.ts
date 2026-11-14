import { z } from 'zod';
import { accountSchema, emailCodeSchema, emailSchema, profileSchema, type Account, type ProfileInput } from '@deseo/domain/auth';
import { AppError, errorResult, resultSchema, type Result } from '@deseo/domain/result';
import { createFreshClient, getSupabase, type DeseoClient } from '../../lib/supabase';
import { captureQueryScope, resetPrivateQueries } from '../../lib/query-client';
import { setDraftScope } from '../../lib/drafts';
import { assertOnline } from '../../lib/network';
import { startSignOutNotice } from './sign-out-notice';
export const entryIntent: { email: string; emailDraft: string; codeDraft: string; retryAt: string; invite: string | null; invalidInvite: boolean } = { email: '', emailDraft: '', codeDraft: '', retryAt: '', invite: null, invalidInvite: false };
export async function requestEmailCode(email: string): Promise<Result<{ retryAt: string }>> {
  try {
    assertOnline();
    const scope = captureQueryScope();
    const parsed = emailSchema.parse(email);
    const { error } = await getSupabase().auth.signInWithOtp({ email: parsed, options: { shouldCreateUser: true } });
    scope.assertCurrent();
    if (error) throw error;
    entryIntent.email = parsed;
    entryIntent.codeDraft = '';
    entryIntent.retryAt = new Date(Date.now() + 60_000).toISOString();
    return { ok: true, data: { retryAt: entryIntent.retryAt } };
  } catch (error) { return errorResult(error); }
}
export async function verifyEmailCode(email: string, code: string): Promise<Result<{ userId: string }>> {
  try {
    assertOnline();
    const { data, error } = await getSupabase().auth.verifyOtp({ email: emailSchema.parse(email), token: emailCodeSchema.parse(code), type: 'email' });
    if (error) throw error;
    if (!data.session || !data.user) throw new AppError({ code: 'UNAUTHENTICATED' });
    return { ok: true, data: { userId: data.user.id } };
  } catch (error) { return errorResult(error); }
}
export async function saveProfile(input: ProfileInput, expectedVersion?: number): Promise<Result<Account>> {
  try {
    assertOnline();
    const scope = captureQueryScope();
    const profile = profileSchema.parse(input);
    if (expectedVersion !== undefined) z.number().int().positive().parse(expectedVersion);
    const { data, error } = await getSupabase().rpc('save_profile', {
      p_display_name: profile.displayName, p_timezone: profile.timezone, p_locale: profile.locale,
      p_expected_version: expectedVersion,
    }).abortSignal(scope.signal);
    scope.assertCurrent();
    if (error) throw error;
    return resultSchema(accountSchema).parse(data);
  } catch (error) { return errorResult(error); }
}
export async function signOut(scope: 'local' | 'global' = 'local') {
  const client = getSupabase();
  const reportGlobalFailure = startSignOutNotice();
  if (scope === 'global') {
    assertOnline();
    const queryScope = captureQueryScope();
    const { data, error } = await client.rpc('revoke_device', {
      // The type generator marks SQL arguments non-null, but revoke_device takes null to revoke every device.
      p_installation_id: null as unknown as string, p_all: true,
    }).abortSignal(queryScope.signal);
    queryScope.assertCurrent();
    if (error) throw error;
    const result = resultSchema(z.object({ revoked: z.literal(true) })).parse(data);
    if (!result.ok) throw new AppError(result.error);
  }
  window.dispatchEvent(new Event('deseo:signout'));
  setDraftScope(null, null);
  entryIntent.invite = null;
  entryIntent.invalidInvite = false;
  entryIntent.email = '';
  entryIntent.emailDraft = '';
  entryIntent.codeDraft = '';
  await resetPrivateQueries();
  try {
    const { error } = await client.auth.signOut({ scope });
    if (error) throw error;
  } catch (error) {
    if (scope === 'global') reportGlobalFailure();
    throw error;
  }
}
async function sessionUser() {
  const { data } = await getSupabase().auth.getSession();
  const user = data.session?.user;
  if (!user?.email) throw new AppError({ code: 'UNAUTHENTICATED' });
  return { id: user.id, email: user.email };
}
export async function requestVerificationCode(): Promise<Result<{ retryAt: string }>> {
  try {
    assertOnline();
    const scope = captureQueryScope();
    const { email } = await sessionUser();
    const { error } = await getSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    scope.assertCurrent();
    if (error) throw error;
    return { ok: true, data: { retryAt: new Date(Date.now() + 60_000).toISOString() } };
  } catch (error) { return errorResult(error); }
}
// Sign in again with the email code in a separate session. Run one command with it, then end that session.
// The database accepts a sensitive command only from a session that signed in during the last ten minutes.
export async function withFreshSignIn<T>(code: string, run: (client: DeseoClient) => Promise<Result<T>>): Promise<Result<T>> {
  try {
    assertOnline();
    const user = await sessionUser();
    const fresh = createFreshClient();
    const { data, error } = await fresh.auth.verifyOtp({ email: user.email, token: emailCodeSchema.parse(code), type: 'email' });
    if (error) throw error;
    if (data.user?.id !== user.id) throw new AppError({ code: 'UNAUTHENTICATED' });
    try { return await run(fresh); } finally { void fresh.auth.signOut({ scope: 'local' }); }
  } catch (error) { return errorResult(error); }
}
