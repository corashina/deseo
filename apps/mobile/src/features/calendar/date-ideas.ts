import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { AppError, errorResult, resultSchema, type Page, type Result } from '@deseo/domain/result';
import { eventPayload } from '@deseo/domain/calendar';
import { eventInputSchema, eventRowSchema } from '@deseo/domain/calendar';
import { calendarKeys } from './queries';
import type { Event, EventInput } from '@deseo/domain/calendar';
import { ideaInputSchema, ideaRowSchema, type IdeaState, type IdeaInput, type DateIdea } from '@deseo/domain/calendar';

export const ideaKeys = {
  list: (accountId: string, pairId: string, state: IdeaState) => [...calendarKeys.all(accountId, pairId), 'ideas', state] as const,
  detail: (accountId: string, pairId: string, id: string) => [...calendarKeys.all(accountId, pairId), 'idea', id] as const,
};
const cursorSchema = z.object({ at: z.string().datetime({ offset: true }), id: z.string().uuid() });
export async function listDateIdeas(pairId: string, state: IdeaState = 'saved', cursor?: string): Promise<Page<DateIdea>> {
  z.string().uuid().parse(pairId); z.enum(['saved', 'planned', 'archived']).parse(state);
  const scope = captureQueryScope(); const client = await getSupabase(); scope.assertCurrent();
  let query = client.from('date_ideas').select('*').eq('pair_id', pairId).eq('state', state)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(51);
  if (cursor) {
    const value = cursorSchema.parse(JSON.parse(cursor));
    query = query.or(`created_at.lt.${value.at},and(created_at.eq.${value.at},id.lt.${value.id})`);
  }
  const { data, error } = await query.abortSignal(scope.signal); scope.assertCurrent(); if (error) throw error;
  const rows = z.array(ideaRowSchema).parse(data); const items = rows.slice(0, 50); const last = items.at(-1);
  return { items, nextCursor: rows.length > 50 && last ? JSON.stringify({ at: last.createdAt, id: last.id }) : null };
}
export async function getDateIdea(pairId: string, id: string): Promise<DateIdea | null> {
  z.string().uuid().parse(pairId); z.string().uuid().parse(id);
  const scope = captureQueryScope(); const client = await getSupabase(); scope.assertCurrent();
  const { data, error } = await client.from('date_ideas').select('*').eq('pair_id', pairId).eq('id', id).abortSignal(scope.signal).maybeSingle();
  scope.assertCurrent(); if (error) throw error; return data === null ? null : ideaRowSchema.parse(data);
}
async function invalidate(pairId?: string) {
  await queryClient.invalidateQueries({ predicate: query => ['calendar', 'today'].includes(String(query.queryKey[0])) && (!pairId || query.queryKey[2] === pairId) });
}
async function ideaCommand(input: IdeaInput, commandId: string, expectedVersion?: number): Promise<Result<DateIdea>> {
  try {
    const parsed = ideaInputSchema.parse(input); z.string().uuid().parse(commandId);
    if (expectedVersion !== undefined) z.number().int().positive().parse(expectedVersion);
    const scope = captureQueryScope(); const client = await getSupabase(); scope.assertCurrent();
    const response = await client.rpc(expectedVersion === undefined ? 'create_date_idea' : 'update_date_idea', {
      p_input: { id: parsed.id, pair_id: parsed.pairId, title: parsed.title, note: parsed.note || null, link: parsed.link || null }, p_command_id: commandId,
      ...(expectedVersion === undefined ? {} : { p_idea_id: parsed.id, p_expected_version: expectedVersion }),
    }).abortSignal(scope.signal);
    scope.assertCurrent(); if (response.error) return errorResult(response.error);
    const result = resultSchema(ideaRowSchema).parse(response.data); if (result.ok) await invalidate(parsed.pairId); return result;
  } catch (error) { return errorResult(error); }
}
export function createIdea(input: IdeaInput, commandId: string) { return ideaCommand(input, commandId); }
export function updateIdea(id: string, input: IdeaInput, expectedVersion: number, commandId: string): Promise<Result<DateIdea>> {
  try { z.number().int().positive().parse(expectedVersion); if (id !== input.id) throw new AppError({ code: 'VALIDATION' }); }
  catch (error) { return Promise.resolve(errorResult(error)); }
  return ideaCommand(input, commandId, expectedVersion);
}
export async function archiveIdea(id: string, expectedVersion: number, commandId: string): Promise<Result<DateIdea>> {
  try {
    z.string().uuid().parse(id); z.string().uuid().parse(commandId); z.number().int().positive().parse(expectedVersion);
    const scope = captureQueryScope(); const client = await getSupabase(); scope.assertCurrent();
    const response = await client.rpc('archive_date_idea', { p_idea_id: id, p_expected_version: expectedVersion, p_command_id: commandId }).abortSignal(scope.signal);
    scope.assertCurrent(); if (response.error) return errorResult(response.error);
    const result = resultSchema(ideaRowSchema).parse(response.data); if (result.ok) await invalidate(result.data.pairId); return result;
  } catch (error) { return errorResult(error); }
}
export async function planDateIdea(ideaId: string, eventInput: EventInput, expectedVersion: number, commandId: string): Promise<Result<Event>> {
  try {
    z.string().uuid().parse(ideaId); z.string().uuid().parse(commandId); z.number().int().positive().parse(expectedVersion);
    const input = eventInputSchema.parse(eventInput);
    if (input.visibility !== 'shared' || input.repeat === 'yearly') throw new AppError({ code: 'VALIDATION', message: 'Plan a shared event for this idea.' });
    const scope = captureQueryScope(); const client = await getSupabase(); scope.assertCurrent();
    const response = await client.rpc('plan_date_idea', { p_idea_id: ideaId, p_event_input: eventPayload(input), p_expected_version: expectedVersion, p_command_id: commandId }).abortSignal(scope.signal);
    scope.assertCurrent(); if (response.error) return errorResult(response.error);
    const result = resultSchema(eventRowSchema).parse(response.data); if (result.ok) await invalidate(input.pairId); return result;
  } catch (error) { return errorResult(error); }
}
