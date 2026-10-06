import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { errorResult, resultSchema, type Result } from '@deseo/domain/result';
import { captureQueryScope, resetPrivateQueries } from '../../lib/query-client';
import { clearPendingInvite, inviteTokenSchema } from '../../lib/links';
import { timezoneSchema } from '../auth';
import { createdInviteSchema, invitePreviewSchema } from '@deseo/domain/pair';

async function command<T extends z.ZodTypeAny>(name: string, args: Record<string, unknown>, schema: T): Promise<Result<z.infer<T>>> {
  try {
    const scope = captureQueryScope();
    const { data, error } = await (await getSupabase()).rpc(name, args);
    scope.assertCurrent();
    if (error) throw error;
    return resultSchema(schema).parse(data);
  } catch (error) { return errorResult(error); }
}
const pairResult = z.object({ pairId: z.string().uuid() });
const endedResult = z.object({ endedAt: z.string() });
const id = z.string().uuid();

export async function createPair(timezone: string, commandId: string) {
  try {
    return await command('create_pair', { p_timezone: timezoneSchema.parse(timezone), p_command_id: id.parse(commandId) }, pairResult);
  } catch (error) { return errorResult(error); }
}
export async function createInvite(pairId: string, commandId: string) {
  try {
    return await command('create_invite', { p_pair_id: id.parse(pairId), p_command_id: id.parse(commandId) }, createdInviteSchema);
  } catch (error) { return errorResult(error); }
}
export async function previewInvite(token: string) {
  try { return await command('preview_invite', { p_token: inviteTokenSchema.parse(token) }, invitePreviewSchema); }
  catch (error) { return errorResult(error); }
}
export async function acceptInvite(token: string, commandId: string) {
  try {
    const result = await command('accept_invite', { p_token: inviteTokenSchema.parse(token), p_command_id: id.parse(commandId) }, pairResult);
    if (result.ok) await clearPendingInvite();
    return result;
  } catch (error) { return errorResult(error); }
}
export async function cancelPendingPair(pairId: string, commandId: string) {
  try {
    return await command('cancel_pending_pair', { p_pair_id: id.parse(pairId), p_command_id: id.parse(commandId) }, endedResult);
  } catch (error) { return errorResult(error); }
}
export async function endPair(pairId: string, verificationProof: string, commandId: string) {
  try {
    const result = await command('end_pair', { p_pair_id: id.parse(pairId), p_verification_proof: verificationProof,
      p_command_id: id.parse(commandId) }, endedResult);
    if (result.ok) await resetPrivateQueries();
    return result;
  } catch (error) { return errorResult(error); }
}
