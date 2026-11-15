import { z } from 'zod';
import { callRpc } from '../../../lib/rpc';
import { AppError } from '@deseo/domain/result';
import { eventPayload, eventInputSchema, eventRowSchema, ideaInputSchema, ideaRowSchema, type IdeaInput, type DateIdea, type Event, type EventInput } from '@deseo/domain/calendar';
import { invalidate } from '../../../lib/query-keys';
const version = z.number().int().positive();
const ideaPayload = (input: IdeaInput) => {
  const parsed = ideaInputSchema.parse(input);
  return { id: parsed.id, pair_id: parsed.pairId, title: parsed.title, note: parsed.note || null, link: parsed.link || null };
};
// A retry of the same input passes the same command ID, so the server stores the write once.
export async function createIdea(input: IdeaInput, commandId: string): Promise<DateIdea> {
  const idea = await callRpc('create_date_idea', { p_input: ideaPayload(input), p_command_id: commandId }, ideaRowSchema);
  await invalidate(['calendar'], ['today']);
  return idea;
}
// The expected version makes a concurrent edit fail with CONFLICT.
export async function updateIdea(input: IdeaInput, expectedVersion: number, commandId: string): Promise<DateIdea> {
  const idea = await callRpc('update_date_idea', {
    p_input: ideaPayload(input), p_command_id: commandId, p_idea_id: input.id, p_expected_version: version.parse(expectedVersion),
  }, ideaRowSchema);
  await invalidate(['calendar'], ['today']);
  return idea;
}
export async function archiveIdea(id: string, expectedVersion: number): Promise<DateIdea> {
  const idea = await callRpc('archive_date_idea', { p_idea_id: z.string().uuid().parse(id), p_expected_version: version.parse(expectedVersion), p_command_id: crypto.randomUUID() }, ideaRowSchema);
  await invalidate(['calendar'], ['today']);
  return idea;
}
export async function planDateIdea(ideaId: string, eventInput: EventInput, expectedVersion: number, commandId: string): Promise<Event> {
  const input = eventInputSchema.parse(eventInput);
  if (input.visibility !== 'shared' || input.repeat === 'yearly')
    throw new AppError({ code: 'VALIDATION', message: 'Plan a shared event for this idea.' });
  const event = await callRpc('plan_date_idea', { p_idea_id: z.string().uuid().parse(ideaId), p_event_input: eventPayload(input), p_expected_version: version.parse(expectedVersion), p_command_id: commandId }, eventRowSchema);
  await invalidate(['calendar'], ['today']);
  return event;
}
