import type { z } from 'zod';
import type { eventInputSchema, eventFormSchema } from './schema';

export type EventInput = z.infer<typeof eventInputSchema>;
export type Owner = EventInput['owner'];
export type Visibility = EventInput['visibility'];
export type EventTime = EventInput['temporal'];
export type Event = Omit<EventInput, 'confirmShared'> & { authorId: string; version: number; seriesDate?: string };
export type AgendaItem = Event;
export type AgendaRange = { pairId: string; from: string; to: string };
export type EventFormValues = z.infer<typeof eventFormSchema>;
