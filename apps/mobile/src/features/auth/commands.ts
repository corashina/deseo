import { z } from 'zod';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabase, resetSupabaseClient } from '../../lib/supabase';
import { getPrivateStorage } from '../../lib/private-storage';
import { clearPendingInvite } from '../../lib/links';
import { resetPrivateQueries } from '../../lib/query-client';
import { AppError, errorResult, resultSchema, toAppError, type Result } from '../../lib/result';
import { accountSchema, emailCodeSchema, emailSchema, profileSchema, sensitiveActionSchema } from './schema';
import { notifySessionReset } from './session-events';
import type { Account, ProfileInput, SensitiveAction } from './types';

export async function requestEmailCode(email: string): Promise<Result<{ retryAt: string }>> {
  try {
    const parsedEmail = emailSchema.parse(email);
    const { error } = await (await getSupabase()).auth.signInWithOtp({ email: parsedEmail, options: { shouldCreateUser: true } });
    if (error) throw toAppError(error);
    return { ok: true, data: { retryAt: new Date(Date.now() + 60_000).toISOString() } };
  } catch (error) { return errorResult(error); }
}
export async function verifyEmailCode(email: string, code: string): Promise<Result<{ userId: string }>> {
  try {
    const parsedEmail = emailSchema.parse(email);
    const token = emailCodeSchema.parse(code);
    const client = await getSupabase();
    const { data, error } = await client.auth.verifyOtp({ email: parsedEmail, token, type: 'email' });
    if (error) throw toAppError(error);
    if (!data.session || !data.user) throw new AppError({ code: 'UNAUTHENTICATED', message: 'Request a new sign-in code.' });
    // AuthProvider validates current server account access before opening a route.
    return { ok: true, data: { userId: data.user.id } };
  } catch (error) { return errorResult(error); }
}
export async function saveProfile(input: ProfileInput, expectedVersion?: number): Promise<Result<Account>> {
  try {
    const profile = profileSchema.parse(input);
    if (expectedVersion !== undefined) z.number().int().positive().parse(expectedVersion);
    const { data, error } = await (await getSupabase()).rpc('save_profile', {
      p_display_name: profile.displayName, p_timezone: profile.timezone, p_locale: profile.locale,
      p_expected_version: expectedVersion ?? null,
    });
    if (error) throw toAppError(error);
    const result = resultSchema(accountSchema).safeParse(data);
    if (!result.success) throw new AppError({ code: 'RETRYABLE', message: 'We could not validate the saved profile. Try again.' });
    return result.data;
  } catch (error) { return errorResult(error); }
}
const retrySchema = z.object({ retryAt: z.string().datetime({ offset: true }) });
const proofSchema = z.object({ proof: z.string().min(40).max(200), expiresAt: z.string().datetime({ offset: true }) });
async function sensitiveRequest<T extends z.ZodTypeAny>(action: SensitiveAction, schema: T, code?: string): Promise<Result<z.infer<T>>> {
  try {
    sensitiveActionSchema.parse(action);
    if (code !== undefined) emailCodeSchema.parse(code);
    const { data, error } = await (await getSupabase()).functions.invoke('verify-sensitive-action', { body: { action, ...(code === undefined ? {} : { code }) } });
    const payload: unknown = error instanceof FunctionsHttpError ? await error.context.json() : data;
    if (error && !(error instanceof FunctionsHttpError)) throw toAppError(error);
    const parsed = resultSchema(schema).safeParse(payload);
    if (!parsed.success) throw new AppError({ code: 'RETRYABLE', message: 'We could not verify this action. Try again.' });
    return parsed.data;
  } catch (error) { return errorResult(error); }
}
export function requestSensitiveActionCode(action: SensitiveAction): Promise<Result<{ retryAt: string }>> {
  return sensitiveRequest(action, retrySchema);
}
export function verifySensitiveAction(action: SensitiveAction, code: string): Promise<Result<{ proof: string; expiresAt: string }>> {
  return sensitiveRequest(action, proofSchema, code);
}
export async function signOut(scope: 'local' | 'global'): Promise<void> {
  const client = await getSupabase();
  const { data } = await client.auth.getSession();
  notifySessionReset();
  await resetPrivateQueries();
  let failure: unknown;
  try {
    const { error } = await client.auth.signOut({ scope });
    if (error) failure = error;
  } catch (error) { failure = error; }
  try {
    const storage = await getPrivateStorage();
    const accountId = data.session?.user.id ?? await storage.getIntent('lastAccount');
    if (accountId) await storage.purgeAccountDrafts(accountId);
    await storage.clearSession();
    await clearPendingInvite();
    await storage.removeIntent('lastAccount');
  } catch (error) { failure ??= error; }
  finally { await resetSupabaseClient(); notifySessionReset('client'); }
  if (failure) throw toAppError(failure);
}
