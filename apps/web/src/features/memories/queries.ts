import { useEffect } from 'react';
import type { PairContext } from '@deseo/domain/pair';
import { useSession } from '../../app/SessionProvider';
import { z } from 'zod';
import { AppError, errorResult, type Page, type Result } from '@deseo/domain/result';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { getSupabase } from '../../lib/supabase';
import { cursorSchema, memorySchema, uuid } from '@deseo/domain/memories';
import { memoryFunction, memoryRpc } from './transport';
import type { Memory, MemoryMedia } from '@deseo/domain/memories';

export const memoryKeys = {
  all: (accountId: string, pairId: string) => ['memories', accountId, pairId] as const,
  feed: (accountId: string, pairId: string) => [...memoryKeys.all(accountId, pairId), 'feed'] as const,
  latest: (accountId: string, pairId: string) => [...memoryKeys.all(accountId, pairId), 'latest'] as const,
  detail: (accountId: string, pairId: string, id: string) => [...memoryKeys.all(accountId, pairId), 'detail', id] as const,
  media: (accountId: string, pairId: string, photoId: string, variant: string) => [...memoryKeys.all(accountId, pairId), 'media', photoId, variant] as const,
};
export async function listMemories(pairId: string, cursor: string | null = null): Promise<Page<Memory>> {
  const parsed = cursor === null ? null : cursorSchema.parse(JSON.parse(cursor));
  const page = await memoryRpc('list_memories', { p_pair_id: uuid.parse(pairId), p_cursor: parsed, p_limit: 50 },
    z.object({ items: z.array(memorySchema).max(50), nextCursor: cursorSchema.nullable() }));
  return { items: page.items, nextCursor: page.nextCursor === null ? null : JSON.stringify(page.nextCursor) };
}
export function latestMemory(pairId: string): Promise<Memory | null> {
  return memoryRpc('latest_memory', { p_pair_id: uuid.parse(pairId) }, memorySchema.nullable());
}
export async function getMemory(pairId: string, id: string): Promise<Memory> {
  uuid.parse(pairId);
  const memory = await memoryRpc('get_memory', { p_memory_id: uuid.parse(id) }, memorySchema);
  if (memory.pairId !== pairId) throw new AppError({ code: 'FORBIDDEN' });
  return memory;
}
export async function getMemoryMedia(photoId: string, variant: 'full' | 'thumb' = 'full'): Promise<Result<MemoryMedia>> {
  try {
    const media = await memoryFunction('get-memory-media', { photoId: uuid.parse(photoId), variant },
      z.object({ url: z.string().url(), expiresAt: z.string().datetime() }));
    return { ok: true, data: media };
  } catch (error) { return errorResult(error); }
}
export function useMemorySignals(accountId: string, pair: PairContext | null) {
  const { revalidate } = useSession();
  useEffect(() => {
    if (pair?.status !== 'active') return;
    const scope = captureQueryScope();
    const client = getSupabase();
    const refresh = () => {
      if (scope.signal.aborted) return;
      void queryClient.invalidateQueries({ queryKey: memoryKeys.all(accountId, pair.pairId) });
      void queryClient.invalidateQueries({ queryKey: ['today', accountId, pair.pairId] });
    };
    const channel = client.channel('portal-memories:' + accountId + ':' + pair.pairId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories', filter: 'pair_id=eq.' + pair.pairId }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memory_access_revocations', filter: 'pair_id=eq.' + pair.pairId }, () => { if (!scope.signal.aborted) void revalidate(); });
    const close = () => { void client.removeChannel(channel); };
    scope.signal.addEventListener('abort', close, { once: true });
    channel.subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
    return () => { scope.signal.removeEventListener('abort', close); close(); };
  }, [accountId, pair, revalidate]);
}
