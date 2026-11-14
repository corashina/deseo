import { z } from 'zod';
import { accountSchema, emailCodeSchema, emailSchema, profileSchema, sensitiveActionSchema, type Account, type ProfileInput, type SensitiveAction } from '@deseo/domain/auth';
import { AppError, resultSchema, toAppError } from '@deseo/domain/result';
import { getSupabase } from '../../lib/supabase';
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
async function sensitiveRequest<T extends z.ZodTypeAny>(action: SensitiveAction, schema: T, code?: string): Promise<z.infer<T>> {
  sensitiveActionSchema.parse(action);
  if (code !== undefined) emailCodeSchema.parse(code);
  const { data, error } = await getSupabase().functions.invoke('verify-sensitive-action', { body: { action, ...(code === undefined ? {} : { code }) }, method: 'POST' });
  if (error) {
    const response = error.context as Response | undefined;
    const payload = response && typeof response.json === 'function' ? await response.json().catch(() => null) : null;
    const parsed = resultSchema(schema).safeParse(payload);
    if (parsed.success && !parsed.data.ok) throw new AppError(parsed.data.error);
    throw new AppError({ code: 'RETRYABLE' });
  }
  const result = resultSchema(schema).parse(data);
  if (!result.ok) throw new AppError(result.error);
  return result.data;
}
export const requestSensitiveActionCode = (action: SensitiveAction) => sensitiveRequest(action, z.object({ retryAt: z.string().datetime({ offset: true }) }));
export const verifySensitiveAction = (action: SensitiveAction, code: string) => sensitiveRequest(action, z.object({ proof: z.string().min(40).max(200), expiresAt: z.string().datetime({ offset: true }) }), code);
