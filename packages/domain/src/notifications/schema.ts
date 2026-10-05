import { z } from 'zod';
import { DateTime } from 'luxon';
const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const preferencesSchema = z.object({ messageAlerts: z.boolean(), defaultEventReminderMinutes: z.number().refine(n => [15, 60, 1440].includes(n)).nullable(),
  quietStart: time.nullable(), quietEnd: time.nullable(), timezone: z.string().refine(zone => DateTime.now().setZone(zone).isValid), version: z.number().int().nonnegative() })
  .refine(p => (p.quietStart === null && p.quietEnd === null) || (p.quietStart !== null && p.quietEnd !== null && p.quietStart !== p.quietEnd));
const reminderFields = { id: uuid, pairId: uuid, eventId: uuid.nullable(), taskId: uuid.nullable(), minutesBefore: z.number().refine(n => [15, 60, 1440].includes(n)).nullable(),
  remindAt: instant.nullable(), active: z.boolean() };
export const reminderInputSchema = z.object({ ...reminderFields, expectedVersion: z.number().int().positive().nullable() })
  .refine(r => (r.eventId !== null) !== (r.taskId !== null))
  .refine(r => !r.active || (r.eventId !== null ? r.minutesBefore !== null && r.remindAt === null : r.remindAt !== null && r.minutesBefore === null));
export const reminderSchema = z.object({ ...reminderFields, version: z.number().int().positive(), state: z.enum(['scheduled', 'past', 'off']), nextDueAt: instant.nullable().optional() });
export const destinationSchema = z.object({ kind: z.enum(['event', 'task', 'messages']), id: uuid, pairId: uuid });
export const notificationSchema = z.object({ id: uuid, pairId: uuid, kind: z.enum(['event', 'task', 'message']), createdAt: instant, readAt: instant.nullable(),
  state: z.enum(['queued', 'submitted', 'provider_accepted', 'failed', 'expired', 'canceled']) });
export const notificationPageSchema = z.object({ items: z.array(notificationSchema).max(50), nextCursor: z.string().nullable() });
