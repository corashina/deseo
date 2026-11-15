import { z } from 'zod';
import { AppError, type Page } from '@deseo/domain/result';
import { cursorSchema, memorySchema, uuid, type Memory } from '@deseo/domain/memories';
import { callRpc } from '../../lib/rpc';
import { getSupabase } from '../../lib/supabase';
import type { QueryKeys } from '../../lib/query-keys';

const all = (accountId: string, pairId: string) => ['memories', accountId, pairId] as const;
export const memoryKeys = {
  all,
  feed: (accountId: string, pairId: string) => [...all(accountId, pairId), 'feed'] as const,
  latest: (accountId: string, pairId: string) => [...all(accountId, pairId), 'latest'] as const,
  detail: (accountId: string, pairId: string, id: string) => [...all(accountId, pairId), 'detail', id] as const,
  // Photo paths never change. Keep photos outside 'memories', so a signal does not download them again.
  photo: (accountId: string, pairId: string, path: string) => ['memory-photo', accountId, pairId, path] as const,
} satisfies QueryKeys;
export async function listMemories(pairId: string, cursor: string | null = null): Promise<Page<Memory>> {
  const parsed = cursor === null ? null : cursorSchema.parse(JSON.parse(cursor));
  const page = await callRpc('list_memories', { p_pair_id: uuid.parse(pairId), p_cursor: parsed, p_limit: 50 },
    z.object({ items: z.array(memorySchema).max(50), nextCursor: cursorSchema.nullable() }));
  return { items: page.items, nextCursor: page.nextCursor === null ? null : JSON.stringify(page.nextCursor) };
}
export function latestMemory(pairId: string): Promise<Memory | null> {
  return callRpc('latest_memory', { p_pair_id: uuid.parse(pairId) }, memorySchema.nullable());
}
export async function getMemory(pairId: string, id: string): Promise<Memory> {
  uuid.parse(pairId);
  const memory = await callRpc('get_memory', { p_memory_id: uuid.parse(id) }, memorySchema);
  if (memory.pairId !== pairId) throw new AppError({ code: 'FORBIDDEN' });
  return memory;
}
// Storage RLS lets current members read validated photos of published memories. Links expire after 60 seconds.
export async function signMemoryPhoto(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from('memory-photos').createSignedUrl(path, 60);
  // Storage answers a denied read with a 4xx status. Other failures can succeed on retry.
  const status = (error as { status?: number } | null)?.status;
  if (status && status < 500) throw new AppError({ code: 'FORBIDDEN', message: 'This photo is unavailable. Open the memory again.' });
  if (error || !data?.signedUrl) throw new AppError({ code: 'RETRYABLE' });
  return data.signedUrl;
}
