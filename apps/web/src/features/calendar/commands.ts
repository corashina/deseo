import { z } from 'zod';
import { assertOnline } from '../../lib/network';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { errorResult, resultSchema, type Result } from '@deseo/domain/result';
import { eventInputSchema, eventRowSchema } from '@deseo/domain/calendar';
import type { Event, EventInput } from '@deseo/domain/calendar';

import { eventPayload } from '@deseo/domain/calendar';

async function invalidateCalendar(pairId?: string): Promise<void> {
  await queryClient.invalidateQueries({ predicate: (query) =>
    (query.queryKey[0] === 'calendar' || query.queryKey[0] === 'today') && (pairId === undefined || query.queryKey[2] === pairId),
  });
}

async function saveEvent(input: EventInput, commandId: string, expectedVersion?: number): Promise<Result<Event>> {
  try {
    assertOnline();
    const parsed = eventInputSchema.parse(input);
    z.string().uuid().parse(commandId);
    if (expectedVersion !== undefined) z.number().int().positive().parse(expectedVersion);
    const scope = captureQueryScope();
    const client = await getSupabase();
    scope.assertCurrent();
    const response = await client.rpc(expectedVersion === undefined ? 'create_event' : 'update_event', {
      p_input: eventPayload(parsed), p_command_id: commandId,
      ...(expectedVersion === undefined ? {} : { p_event_id: parsed.id, p_expected_version: expectedVersion }),
    }).abortSignal(scope.signal);
    scope.assertCurrent();
    if (response.error) return errorResult(response.error);
    const result = resultSchema(eventRowSchema).parse(response.data);
    if (result.ok) await invalidateCalendar(parsed.pairId);
    return result;
  } catch (error) { return errorResult(error); }
}

export function createEvent(input: EventInput, commandId: string): Promise<Result<Event>> {
  return saveEvent(input, commandId);
}
export function updateEvent(id: string, input: EventInput, expectedVersion: number, commandId: string): Promise<Result<Event>> {
  if (input.id !== id) return Promise.resolve({ ok: false, error: { code: 'VALIDATION', message: 'The event ID changed.' } });
  try {
    assertOnline(); z.number().int().positive().parse(expectedVersion); }
  catch (error) { return Promise.resolve(errorResult(error)); }
  return saveEvent(input, commandId, expectedVersion);
}
export async function deleteEvent(id: string, expectedVersion: number, commandId: string): Promise<Result<{ id: string }>> {
  try {
    assertOnline();
    z.string().uuid().parse(id);
    z.string().uuid().parse(commandId);
    z.number().int().positive().parse(expectedVersion);
    const scope = captureQueryScope();
    const client = await getSupabase();
    scope.assertCurrent();
    const response = await client.rpc('delete_event', { p_event_id: id, p_expected_version: expectedVersion, p_command_id: commandId }).abortSignal(scope.signal);
    scope.assertCurrent();
    if (response.error) return errorResult(response.error);
    const result = resultSchema(z.object({ id: z.string().uuid() })).parse(response.data);
    if (result.ok) await invalidateCalendar();
    return result;
  } catch (error) { return errorResult(error); }
}

import { reminderInputSchema, reminderSchema } from '@deseo/domain/notifications';
import type { z as Zod } from 'zod';
export async function setEventReminder(input: Zod.infer<typeof reminderInputSchema>, commandId: string) {
  try {
    assertOnline();
    z.string().uuid().parse(commandId);
    const scope = captureQueryScope();
    const response = await getSupabase().rpc('set_reminder', { p_input: reminderInputSchema.parse(input), p_command_id: commandId }).abortSignal(scope.signal);
    scope.assertCurrent();
    if (response.error) return errorResult(response.error);
    return resultSchema(reminderSchema).parse(response.data);
  } catch (error) { return errorResult(error); }
}
