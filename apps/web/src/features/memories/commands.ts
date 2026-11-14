import { z } from 'zod';
import { AppError, resultSchema } from '@deseo/domain/result';
import { memoryInputSchema, memorySchema, photoSchema, uuid, type Memory, type MemoryInput } from '@deseo/domain/memories';
import { callRpc } from '../../lib/rpc';
import { queryClient } from '../../lib/query-client';
import { getSupabase } from '../../lib/supabase';
import type { PreparedBrowserPhoto, MemoryReservationInput } from './prepare';
const version = z.number().int().positive();
const reservationSchema = memoryInputSchema.extend({ id: uuid, pairId: uuid,
  photos: z.array(photoSchema.omit({ order: true, fullPath: true, thumbPath: true, validated: true })).min(1).max(5) });
async function invalidateMemories(): Promise<void> {
  await Promise.all([queryClient.invalidateQueries({ queryKey: ['memories'] }), queryClient.invalidateQueries({ queryKey: ['today'] })]);
}
// A retry of the same input passes the same command ID, so the server stores the write once.
export function reserveMemory(input: MemoryReservationInput, commandId: string): Promise<Memory> {
  return callRpc('reserve_memory', { p_input: reservationSchema.parse(input), p_command_id: uuid.parse(commandId) }, memorySchema);
}
// Upload each reserved file to private Storage, then let finalize-memory check the bytes and publish.
// Storage never overwrites a file. On retry, an existing file (409) is the same prepared upload, so it counts as done.
// The photos are in reservation order.
export async function publishMemory(reservation: Memory, photos: PreparedBrowserPhoto[], commandId: string, onProgress: (message: string) => void): Promise<Memory> {
  if (reservation.photos.length !== photos.length) throw new AppError({ code: 'VALIDATION', message: 'Select the photos again.' });
  const client = getSupabase();
  const claims = await client.auth.getClaims();
  if (claims.error) throw claims.error;
  const sessionId = uuid.parse(claims.data?.claims.session_id);
  for (const [index, local] of photos.entries()) {
    onProgress('Uploading photo ' + (index + 1) + ' of ' + photos.length + '…');
    const photo = reservation.photos[index];
    if (photo.validated) continue;
    for (const variant of ['full', 'thumb'] as const) {
      const { error } = await client.storage.from('memory-photos').upload(photo[`${variant}Path`], local[variant],
        { contentType: 'image/jpeg', cacheControl: '0', upsert: false, metadata: { sessionId } });
      if (error && (error as { statusCode?: string }).statusCode !== '409') throw error;
    }
  }
  onProgress('Publishing memory…');
  const { data, error } = await client.functions.invoke('finalize-memory',
    { body: { memoryId: uuid.parse(reservation.id), commandId: uuid.parse(commandId) }, method: 'POST' });
  if (error) {
    const response = error.context as Response | undefined;
    const body: unknown = response && typeof response.json === 'function' ? await response.json().catch(() => null) : null;
    const parsed = resultSchema(memorySchema).safeParse(body);
    if (parsed.success && !parsed.data.ok) throw new AppError(parsed.data.error);
    throw new AppError({ code: 'RETRYABLE', message: 'Check your connection and retry.' });
  }
  const result = resultSchema(memorySchema).parse(data);
  if (!result.ok) throw new AppError(result.error);
  await invalidateMemories();
  return result.data;
}
// The expected version makes a concurrent edit fail with CONFLICT.
export async function updateMemory(id: string, input: MemoryInput, expectedVersion: number, commandId: string): Promise<Memory> {
  const memory = await callRpc('update_memory', { p_memory_id: uuid.parse(id), p_input: memoryInputSchema.parse(input),
    p_expected_version: version.parse(expectedVersion), p_command_id: uuid.parse(commandId) }, memorySchema);
  await invalidateMemories();
  return memory;
}
export async function deleteMemory(id: string, expectedVersion: number, commandId: string): Promise<void> {
  await callRpc('delete_memory', { p_memory_id: uuid.parse(id), p_expected_version: version.parse(expectedVersion),
    p_command_id: uuid.parse(commandId) }, z.object({ id: uuid }));
  // Do not wait. The page leaves the deleted memory at once.
  void invalidateMemories();
}
