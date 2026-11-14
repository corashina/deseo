import { z } from 'zod';
import { accountSchema, emailCodeSchema, emailSchema, profileSchema, type Account, type ProfileInput } from '@deseo/domain/auth';
import { AppError, toAppError } from '@deseo/domain/result';
import { createFreshClient, getSupabase, type DeseoClient } from '../../lib/supabase';
import { callRpc } from '../../lib/rpc';
import { resetPrivateQueries } from '../../lib/query-client';
import { startSignOutNotice } from './sign-out-notice';
export const entryIntent: { email: string; emailDraft: string; codeDraft: string; retryAt: string; invite: string | null; invalidInvite: boolean } = { email: '', emailDraft: '', codeDraft: '', retryAt: '', invite: null, invalidInvite: false };
export function clearEntryIntent() {
  Object.assign(entryIntent, { email: '', emailDraft: '', codeDraft: '', invite: null, invalidInvite: false });
}
export async function requestEmailCode(email: string): Promise<{ retryAt: string }> {
  const parsed = emailSchema.parse(email);
  const { error } = await getSupabase().auth.signInWithOtp({ email: parsed, options: { shouldCreateUser: true } });
  if (error) throw toAppError(error);
  entryIntent.email = parsed;
  entryIntent.codeDraft = '';
  entryIntent.retryAt = new Date(Date.now() + 60_000).toISOString();
  return { retryAt: entryIntent.retryAt };
}
export async function verifyEmailCode(email: string, code: string): Promise<{ userId: string }> {
  const { data, error } = await getSupabase().auth.verifyOtp({ email: emailSchema.parse(email), token: emailCodeSchema.parse(code), type: 'email' });
  if (error) throw toAppError(error);
  if (!data.session || !data.user) throw new AppError({ code: 'UNAUTHENTICATED' });
  entryIntent.emailDraft = '';
  entryIntent.codeDraft = '';
  return { userId: data.user.id };
}
export function saveProfile(input: ProfileInput, expectedVersion?: number): Promise<Account> {
  const profile = profileSchema.parse(input);
  return callRpc('save_profile', {
    p_display_name: profile.displayName, p_timezone: profile.timezone, p_locale: profile.locale,
    p_expected_version: expectedVersion === undefined ? undefined : z.number().int().positive().parse(expectedVersion),
  }, accountSchema);
}
export async function signOut(scope: 'local' | 'global' = 'local') {
  const client = getSupabase();
  const reportGlobalFailure = startSignOutNotice();
  if (scope === 'global') {
    // The type generator marks SQL arguments non-null, but revoke_device takes null to revoke every device.
    await callRpc('revoke_device', { p_installation_id: null as unknown as string, p_all: true }, z.object({ revoked: z.literal(true) }));
  }
  // Clear private state at once. Do not wait for the network.
  window.dispatchEvent(new Event('deseo:signout'));
  clearEntryIntent();
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
export async function requestVerificationCode(): Promise<{ retryAt: string }> {
  const { email } = await sessionUser();
  const { error } = await getSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw toAppError(error);
  return { retryAt: new Date(Date.now() + 60_000).toISOString() };
}
// Sign in again with the email code in a separate session. Run one command with it, then end that session.
// The database accepts a sensitive command only from a session that signed in during the last ten minutes.
export async function withFreshSignIn<T>(code: string, run: (client: DeseoClient) => Promise<T>): Promise<T> {
  const user = await sessionUser();
  const fresh = createFreshClient();
  const { data, error } = await fresh.auth.verifyOtp({ email: user.email, token: emailCodeSchema.parse(code), type: 'email' });
  if (error) throw toAppError(error);
  if (data.user?.id !== user.id) throw new AppError({ code: 'UNAUTHENTICATED' });
  try { return await run(fresh); } finally { void fresh.auth.signOut({ scope: 'local' }); }
}
