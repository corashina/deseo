import { z } from 'zod';
import { createdInviteSchema, invitePreviewSchema } from '@deseo/domain/pair';
import { timezoneSchema } from '@deseo/domain/auth';
import type { DeseoClient } from '../../lib/supabase';
import { callRpc } from '../../lib/rpc';
import { entryIntent } from '../auth';
export const inviteTokenSchema = z.string().transform(value => value.replace(/[\s-]/g, '').toUpperCase()).pipe(z.string().regex(/^[0-9A-HJKMNP-TV-Z]{12}$/));
const pairResult = z.object({ pairId: z.string().uuid() });
const endedResult = z.object({ endedAt: z.string() });
const id = z.string().uuid();
// The pair RPCs take a command ID. Each attempt sends a new one.
export function createPair(timezone: string) {
  return callRpc('create_pair', { p_timezone: timezoneSchema.parse(timezone), p_command_id: crypto.randomUUID() }, pairResult);
}
export function createInvite(pairId: string) {
  return callRpc('create_invite', { p_pair_id: id.parse(pairId), p_command_id: crypto.randomUUID() }, createdInviteSchema);
}
// One click creates the pair and its invitation. The waiting page shows that code once.
type CreatedInvite = z.infer<typeof createdInviteSchema>;
let heldInvite: { pairId: string; invite: CreatedInvite } | null = null;
export async function createPairWithInvite(timezone: string) {
  const { pairId } = await createPair(timezone);
  heldInvite = { pairId, invite: await createInvite(pairId) };
}
export function takeHeldInvite(pairId: string) {
  const held = heldInvite?.pairId === pairId ? heldInvite.invite : null;
  heldInvite = null;
  return held;
}
export function previewInvite(token: string) {
  return callRpc('preview_invite', { p_token: inviteTokenSchema.parse(token) }, invitePreviewSchema);
}
export async function acceptInvite(token: string) {
  const result = await callRpc('accept_invite', { p_token: inviteTokenSchema.parse(token), p_command_id: crypto.randomUUID() }, pairResult);
  entryIntent.invite = null;
  return result;
}
export function cancelPendingPair(pairId: string) {
  return callRpc('cancel_pending_pair', { p_pair_id: id.parse(pairId), p_command_id: crypto.randomUUID() }, endedResult);
}
// Pass a freshly signed-in client for the first attempt. A retry with the saved session replays the receipt.
export function endPair(pairId: string, commandId: string, client?: DeseoClient) {
  return callRpc('end_pair', { p_pair_id: id.parse(pairId), p_command_id: id.parse(commandId) }, endedResult, client);
}
