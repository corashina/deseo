import type { z } from 'zod';
import type { MemoryInput } from '@deseo/domain/memories';
import type { draftSchema, localPhotoSchema } from './schema';
export type MemoryDraft = z.infer<typeof draftSchema>;
export type LocalMemoryPhoto = z.infer<typeof localPhotoSchema>;
export type MemoryReservationInput = MemoryInput & { id: string; pairId: string; photos: Omit<LocalMemoryPhoto, 'status'>[] };
