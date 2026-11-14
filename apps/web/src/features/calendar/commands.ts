import { z } from 'zod';
import { callRpc } from '../../lib/rpc';
import { queryClient } from '../../lib/query-client';
import { eventInputSchema, eventPayload, eventRowSchema, type Event, type EventInput } from '@deseo/domain/calendar';

const version = z.number().int().positive();
export async function invalidateCalendar(): Promise<void> {
  await Promise.all([queryClient.invalidateQueries({ queryKey: ['calendar'] }), queryClient.invalidateQueries({ queryKey: ['today'] })]);
}
// The event RPCs take a command ID. Each attempt sends a new one.
export async function createEvent(input: EventInput): Promise<Event> {
  const event = await callRpc('create_event', { p_input: eventPayload(eventInputSchema.parse(input)), p_command_id: crypto.randomUUID() }, eventRowSchema);
  await invalidateCalendar();
  return event;
}
// The expected version makes a concurrent edit fail with CONFLICT.
export async function updateEvent(input: EventInput, expectedVersion: number): Promise<Event> {
  const parsed = eventInputSchema.parse(input);
  const event = await callRpc('update_event', {
    p_input: eventPayload(parsed), p_command_id: crypto.randomUUID(), p_event_id: parsed.id, p_expected_version: version.parse(expectedVersion),
  }, eventRowSchema);
  await invalidateCalendar();
  return event;
}
export async function deleteEvent(id: string, expectedVersion: number): Promise<void> {
  await callRpc('delete_event', { p_event_id: z.string().uuid().parse(id), p_expected_version: version.parse(expectedVersion), p_command_id: crypto.randomUUID() }, z.object({ id: z.string().uuid() }));
  // Do not wait. The page leaves the deleted event at once.
  void invalidateCalendar();
}
