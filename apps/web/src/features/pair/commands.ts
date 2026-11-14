import { z } from 'zod';
import { createdInviteSchema, invitePreviewSchema } from '@deseo/domain/pair';
import { timezoneSchema } from '@deseo/domain/auth';
import { errorResult, resultSchema, type Result } from '@deseo/domain/result';
import { getSupabase, type DeseoClient, type RpcName } from '../../lib/supabase';
import { captureQueryScope, resetPrivateQueries } from '../../lib/query-client';
import { entryIntent } from '../auth';
import { assertOnline } from '../../lib/network';
export const inviteTokenSchema = z.string().transform(value => value.replace(/[\s-]/g, '').toUpperCase()).pipe(z.string().regex(/^[0-9A-HJKMNP-TV-Z]{12}$/));
async function command<T extends z.ZodTypeAny>(name: RpcName, args: Record<string, unknown>, schema: T, client: DeseoClient = getSupabase()): Promise<Result<z.infer<T>>> {
  try {
    assertOnline();
    const scope = captureQueryScope();
    const { data, error } = await client.rpc(name, args).abortSignal(scope.signal);
    scope.assertCurrent();
    if (error) throw error;
    return resultSchema(schema).parse(data);
  } catch (error) { return errorResult(error); }
}
const pairResult = z.object({ pairId: z.string().uuid() });
const endedResult = z.object({ endedAt: z.string() });
const id = z.string().uuid();
export async function createPair(timezone: string, commandId: string) {
  try { return await command('create_pair', { p_timezone: timezoneSchema.parse(timezone), p_command_id: id.parse(commandId) }, pairResult); }
  catch (error) { return errorResult(error); }
}
export async function createInvite(pairId: string, commandId: string) {
  try { return await command('create_invite', { p_pair_id: id.parse(pairId), p_command_id: id.parse(commandId) }, createdInviteSchema); }
  catch (error) { return errorResult(error); }
}
export async function previewInvite(token: string) {
  try { return await command('preview_invite', { p_token: inviteTokenSchema.parse(token) }, invitePreviewSchema); }
  catch (error) { return errorResult(error); }
}
export async function acceptInvite(token: string, commandId: string) {
  try {
    const result = await command('accept_invite', { p_token: inviteTokenSchema.parse(token), p_command_id: id.parse(commandId) }, pairResult);
    if (result.ok) entryIntent.invite = null;
    return result;
  } catch (error) { return errorResult(error); }
}
export async function cancelPendingPair(pairId: string, commandId: string) {
  try { return await command('cancel_pending_pair', { p_pair_id: id.parse(pairId), p_command_id: id.parse(commandId) }, endedResult); }
  catch (error) { return errorResult(error); }
}
// Pass a freshly signed-in client for the first attempt. A retry with the saved session replays the receipt.
export async function endPair(pairId: string, commandId: string, client?: DeseoClient) {
  try {
    const result = await command('end_pair', { p_pair_id: id.parse(pairId), p_command_id: id.parse(commandId) }, endedResult, client);
    if (result.ok) await resetPrivateQueries();
    return result;
  } catch (error) { return errorResult(error); }
}
