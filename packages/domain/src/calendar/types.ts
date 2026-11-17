import type { z } from 'zod';
import type { eventInputSchema, eventFormSchema } from './schema';

export type EventInput = z.infer<typeof eventInputSchema>;
export type Who = EventInput['who'];
export type EventTime = EventInput['temporal'];
export type Event = Omit<EventInput, 'confirmShared'> & { authorId: string; version: number; seriesDate?: string };
export type AgendaItem = Event;
export type AgendaRange = { pairId: string; from: string; to: string };
export type EventFormValues = z.infer<typeof eventFormSchema>;
/** An owner color. A private event takes its author's slot. */
export type Owner = Exclude<Who, 'private'>;
