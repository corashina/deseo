import { DateTime } from 'luxon';
import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope } from '../../lib/query-client';
import { AppError, resultSchema } from '@deseo/domain/result';
import { dateSchema, eventRowSchema } from '@deseo/domain/calendar';
import type { AgendaItem, AgendaRange, Event } from '@deseo/domain/calendar';

export const calendarKeys = {
  all: (accountId: string, pairId: string) => ['calendar', accountId, pairId] as const,
  agenda: (accountId: string, range: AgendaRange) => [...calendarKeys.all(accountId, range.pairId), 'agenda', range.from, range.to] as const,
  event: (accountId: string, pairId: string, id: string) => [...calendarKeys.all(accountId, pairId), 'event', id] as const,
};

export async function listAgenda(range: AgendaRange): Promise<AgendaItem[]> {
  const pairId = z.string().uuid().parse(range.pairId);
  const from = dateSchema.parse(range.from);
  const to = dateSchema.parse(range.to);
  const days = DateTime.fromISO(to, { zone: 'UTC' }).diff(DateTime.fromISO(from, { zone: 'UTC' }), 'days').days;
  if (days <= 0 || days > 366) throw new AppError({ code: 'VALIDATION', message: 'Choose a range from one to 366 days.' });
  const scope = captureQueryScope();
  const client = await getSupabase();
  scope.assertCurrent();
  const response = await client.rpc('list_agenda', { p_pair_id: pairId, p_from: from, p_to: to }).abortSignal(scope.signal);
  scope.assertCurrent();
  if (response.error) throw response.error;
  const result = resultSchema(z.array(eventRowSchema)).parse(response.data);
  if (!result.ok) throw new AppError(result.error);
  return result.data;
}

export async function getEvent(pairId: string, id: string): Promise<Event | null> {
  z.string().uuid().parse(pairId);
  z.string().uuid().parse(id);
  const scope = captureQueryScope();
  const client = await getSupabase();
  scope.assertCurrent();
  const { data, error } = await client.from('events').select('*').eq('pair_id', pairId).eq('id', id).abortSignal(scope.signal).maybeSingle();
  scope.assertCurrent();
  if (error) throw error;
  return data === null ? null : eventRowSchema.parse(data);
}
