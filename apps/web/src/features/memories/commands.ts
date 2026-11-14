import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { assertOnline } from '../../lib/network';
import type { PreparedBrowserPhoto, MemoryReservationInput } from './prepare';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { getSupabase } from '../../lib/supabase';
import { AppError, errorResult, resultSchema, type Result } from '@deseo/domain/result';
import { memoryInputSchema, memorySchema, photoSchema, uuid } from '@deseo/domain/memories';
import { memoryRpc } from './transport';
import type { Memory, MemoryInput } from '@deseo/domain/memories';

export async function reserveMemory(input: MemoryReservationInput, commandId: string): Promise<Result<Memory>> {
  try {
    assertOnline();
    const parsed = memoryInputSchema.extend({ id: uuid, pairId: uuid,
      photos: z.array(photoSchema.omit({ order: true, fullPath: true, thumbPath: true, validated: true })).min(1).max(5),
    }).parse(input);
    return { ok: true, data: await memoryRpc('reserve_memory', { p_input: parsed, p_command_id: uuid.parse(commandId) }, memorySchema) };
  } catch (error) { return errorResult(error); }
}
async function invalidateMemories() {
  await queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === 'memories' || query.queryKey[0] === 'today' });
}
type PublishInput = { reservation: Memory; photos: PreparedBrowserPhoto[]; commandId: string; onProgress(message: string): void };
// Upload each reserved file to private Storage, then let finalize-memory check the bytes and publish.
// Storage never overwrites a file. On retry, an existing file is the same prepared upload, so it counts as done.
async function publishMemory({ reservation, photos, commandId, onProgress }: PublishInput): Promise<Result<Memory>> {
  try {
    assertOnline();
    const scope = captureQueryScope();
    const client = getSupabase();
    const claims = await client.auth.getClaims();
    scope.assertCurrent();
    if (claims.error) throw claims.error;
    const sessionId = uuid.parse(claims.data?.claims.session_id);
    for (const [index, local] of photos.entries()) {
      onProgress('Uploading photo ' + (index + 1) + ' of ' + photos.length + '…');
      const photo = reservation.photos.find(item => item.id === local.id);
      if (!photo) throw new AppError({ code: 'VALIDATION', message: 'Select this photo again.' });
      if (photo.validated) continue;
      for (const variant of ['full', 'thumb'] as const) {
        const { error } = await client.storage.from('memory-photos').upload(photo[`${variant}Path`], local[variant],
          { contentType: 'image/jpeg', cacheControl: '0', upsert: false, metadata: { sessionId } });
        scope.assertCurrent();
        if (error && (error as { statusCode?: string }).statusCode !== '409') throw error;
      }
    }
    onProgress('Publishing memory…');
    const { data, error } = await client.functions.invoke('finalize-memory',
      { body: { memoryId: uuid.parse(reservation.id), commandId: uuid.parse(commandId) }, method: 'POST', signal: scope.signal });
    scope.assertCurrent();
    if (error) {
      const response = error.context as Response | undefined;
      const body: unknown = response && typeof response.json === 'function' ? await response.json().catch(() => null) : null;
      scope.assertCurrent();
      const parsed = resultSchema(memorySchema).safeParse(body);
      if (parsed.success && !parsed.data.ok) return parsed.data;
      throw new AppError({ code: 'RETRYABLE', message: 'Check your connection and retry.' });
    }
    return resultSchema(memorySchema).parse(data);
  } catch (error) { return errorResult(error); }
}
export function usePublishMemory() {
  return useMutation({ mutationFn: publishMemory, onSuccess: result => { if (result.ok) void invalidateMemories(); } });
}
export async function updateMemory(id: string, input: MemoryInput, expectedVersion: number, commandId: string): Promise<Result<Memory>> {
  try {
    assertOnline();
    const scope = captureQueryScope();
    const memory = await memoryRpc('update_memory', { p_memory_id: uuid.parse(id), p_input: memoryInputSchema.parse(input),
      p_expected_version: z.number().int().positive().parse(expectedVersion), p_command_id: uuid.parse(commandId) }, memorySchema);
    scope.assertCurrent();
    await invalidateMemories();
    scope.assertCurrent();
    return { ok: true, data: memory };
  } catch (error) { return errorResult(error); }
}
export async function deleteMemory(id: string, expectedVersion: number, commandId: string): Promise<Result<{ id: string }>> {
  try {
    assertOnline();
    const scope = captureQueryScope();
    const data = await memoryRpc('delete_memory', { p_memory_id: uuid.parse(id),
      p_expected_version: z.number().int().positive().parse(expectedVersion), p_command_id: uuid.parse(commandId) }, z.object({ id: uuid }));
    scope.assertCurrent();
    await invalidateMemories();
    scope.assertCurrent();
    return { ok: true, data };
  } catch (error) { return errorResult(error); }
}
