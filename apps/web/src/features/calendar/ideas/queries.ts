import { z } from 'zod';
import { getSupabase } from '../../../lib/supabase';
import { type Page } from '@deseo/domain/result';
import { calendarKeys } from '../queries';
import { ideaRowSchema, type IdeaState, type DateIdea } from '@deseo/domain/calendar';
export const ideaKeys = {

  list: (accountId: string, pairId: string, state: IdeaState) => [...calendarKeys.all(accountId, pairId), 'ideas', state] as const,

  detail: (accountId: string, pairId: string, id: string) => [...calendarKeys.all(accountId, pairId), 'idea', id] as const,

};
const cursorSchema = z.object({ at: z.string().datetime({ offset: true }), id: z.string().uuid() });
export async function listDateIdeas(pairId: string, state: IdeaState = 'saved', cursor?: string): Promise<Page<DateIdea>> {
  z.string().uuid().parse(pairId);
  z.enum(['saved', 'planned', 'archived']).parse(state);
  const client = await getSupabase();
  let query = client.from('date_ideas').select('*').eq('pair_id', pairId).eq('state', state)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(51);
  if (cursor) {
    const value = cursorSchema.parse(JSON.parse(cursor));
    query = query.or(`created_at.lt.${value.at},and(created_at.eq.${value.at},id.lt.${value.id})`);
  }
  const { data, error } = await query;
  if (error)
    throw error;
  const rows = z.array(ideaRowSchema).parse(data);
  const items = rows.slice(0, 50);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > 50 && last ? JSON.stringify({ at: last.createdAt, id: last.id }) : null };
}
export async function getDateIdea(pairId: string, id: string): Promise<DateIdea | null> {
  z.string().uuid().parse(pairId);
  z.string().uuid().parse(id);
  const client = await getSupabase();
  const { data, error } = await client.from('date_ideas').select('*').eq('pair_id', pairId).eq('id', id).maybeSingle();
  if (error)
    throw error;
  return data === null ? null : ideaRowSchema.parse(data);
}
