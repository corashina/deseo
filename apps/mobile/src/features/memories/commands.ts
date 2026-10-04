import { z } from 'zod';
import { File } from 'expo-file-system';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { getSupabase } from '../../lib/supabase';
import { AppError, errorResult, type Result } from '../../lib/result';
import { memoryInputSchema, memorySchema, photoSchema, uuid } from './schema';
import { memoryFunction, memoryRpc } from './transport';
import type { Memory, MemoryInput, MemoryPhoto, MemoryReservationInput, MemoryInspection } from './types';

export async function reserveMemory(input: MemoryReservationInput, commandId: string): Promise<Result<Memory>> {
  try {
    const parsed = memoryInputSchema.extend({ id: uuid, pairId: uuid,
      photos: z.array(photoSchema.omit({ order: true, fullPath: true, thumbPath: true, validated: true })).min(1).max(5),
    }).parse(input);
    return { ok: true, data: await memoryRpc('reserve_memory', { p_input: parsed, p_command_id: uuid.parse(commandId) }, memorySchema) };
  } catch (error) { return errorResult(error); }
}
export function inspectMemory(memoryId: string): Promise<MemoryInspection> {
  return memoryFunction('finalize-memory', { action: 'inspect', memoryId: uuid.parse(memoryId) },
    z.object({ memory: memorySchema, photos: z.array(z.object({ id: uuid, full: z.boolean(), thumb: z.boolean(), validated: z.boolean() })) }));
}
export async function uploadMemoryPhoto(reservation: Memory, localFile: { id: string; fullUri: string; thumbUri: string }): Promise<Result<MemoryPhoto>> {
  try {
    const scope = captureQueryScope();
    const client = await getSupabase();
    scope.assertCurrent();
    const claims = await client.auth.getClaims();
    scope.assertCurrent();
    if (claims.error) throw claims.error;
    const sessionId = uuid.parse(claims.data?.claims.session_id);
    const inspection = await inspectMemory(reservation.id);
    const photo = inspection.memory.photos.find(item => item.id === localFile.id);
    const state = inspection.photos.find(item => item.id === localFile.id);
    if (!photo || !state) throw new AppError({ code: 'VALIDATION', message: 'Select this photo again.' });
    if (state.validated) return { ok: true, data: photo };
    for (const variant of ['full', 'thumb'] as const) {
      if (state[variant]) continue;
      const bytes = await new File(localFile[`${variant}Uri`]).bytes();
      scope.assertCurrent();
      const { error } = await client.storage.from('memory-photos').upload(photo[`${variant}Path`], bytes.buffer,
        { contentType: 'image/jpeg', upsert: false, metadata: { sessionId } });
      scope.assertCurrent();
      if (error) {
        // Only inspection plus validation can resolve an uncertain immutable upload.
        const after = await inspectMemory(reservation.id);
        if (!after.photos.find(item => item.id === photo.id)?.[variant]) throw error;
      }
    }
    scope.assertCurrent();
    return { ok: true, data: await memoryFunction('finalize-memory', { action: 'validate', memoryId: reservation.id, photoId: photo.id }, photoSchema) };
  } catch (error) { return errorResult(error); }
}
async function invalidateMemories() {
  await queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === 'memories' || query.queryKey[0] === 'today' });
}
export async function finalizeMemory(memoryId: string, commandId: string): Promise<Result<Memory>> {
  try {
    const memory = await memoryFunction('finalize-memory', { action: 'publish', memoryId: uuid.parse(memoryId), commandId: uuid.parse(commandId) }, memorySchema);
    await invalidateMemories();
    return { ok: true, data: memory };
  } catch (error) { return errorResult(error); }
}
export async function updateMemory(id: string, input: MemoryInput, expectedVersion: number, commandId: string): Promise<Result<Memory>> {
  try {
    const memory = await memoryRpc('update_memory', { p_memory_id: uuid.parse(id), p_input: memoryInputSchema.parse(input),
      p_expected_version: z.number().int().positive().parse(expectedVersion), p_command_id: uuid.parse(commandId) }, memorySchema);
    await invalidateMemories();
    return { ok: true, data: memory };
  } catch (error) { return errorResult(error); }
}
export async function deleteMemory(id: string, expectedVersion: number, commandId: string): Promise<Result<{ id: string }>> {
  try {
    const data = await memoryRpc('delete_memory', { p_memory_id: uuid.parse(id),
      p_expected_version: z.number().int().positive().parse(expectedVersion), p_command_id: uuid.parse(commandId) }, z.object({ id: uuid }));
    await invalidateMemories();
    return { ok: true, data };
  } catch (error) { return errorResult(error); }
}
