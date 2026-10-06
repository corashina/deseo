import type { z } from 'zod';
import type { memoryInputSchema, memorySchema, photoSchema } from './schema';
export type Memory = z.infer<typeof memorySchema>;
export type MemoryPhoto = z.infer<typeof photoSchema>;
export type MemoryInput = z.infer<typeof memoryInputSchema>;
export type MemoryMedia = { url: string; expiresAt: string };
export type MemoryInspection = { memory: Memory; photos: { id: string; full: boolean; thumb: boolean; validated: boolean }[] };
