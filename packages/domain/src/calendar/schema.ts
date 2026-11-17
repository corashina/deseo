import { DateTime } from 'luxon';
import { z } from 'zod';
import type { Event, EventFormValues, EventInput } from './types';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine((value) => DateTime.fromISO(value, { zone: 'UTC' }).isValid, 'Enter a valid date.');
// Who an event is for. Private means only its author sees it.
export const whoSchema = z.enum(['together', 'a', 'b', 'private']);
const instantSchema = z.string().datetime({ offset: true });
const temporalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('timed'), startsAt: instantSchema, endsAt: instantSchema }).strict(),
  z.object({ kind: z.literal('allDay'), startDate: dateSchema, endDateExclusive: dateSchema }).strict(),
]);
export const eventInputSchema = z.object({
  id: z.string().uuid(), pairId: z.string().uuid(),
  title: z.string().trim().min(1, 'Enter a title.').max(120, 'Use 120 characters or less.'),
  who: whoSchema, temporal: temporalSchema,
  location: z.string().trim().max(200).optional(), description: z.string().trim().max(2000).optional(),
  confirmShared: z.boolean().optional(), repeat: z.enum(['none', 'yearly']).optional(), importantDate: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  const temporal = value.temporal;
  const valid = temporal.kind === 'timed'
    ? DateTime.fromISO(temporal.endsAt).toMillis() > DateTime.fromISO(temporal.startsAt).toMillis()
    : temporal.endDateExclusive > temporal.startDate;
  if (value.importantDate && temporal.kind !== 'allDay') context.addIssue({ code: 'custom', path: ['temporal'], message: 'An important date must be all day.' });
  if (value.repeat === 'yearly' && (temporal.kind !== 'allDay' || DateTime.fromISO(temporal.endDateExclusive).diff(DateTime.fromISO(temporal.startDate), 'days').days !== 1)) context.addIssue({ code: 'custom', path: ['temporal'], message: 'A yearly date must be one all-day date.' });
  if (!valid) context.addIssue({ code: 'custom', path: ['temporal'], message: 'End must follow start.' });
});
/** Stored form values. Accepts incomplete input. */
export const eventValuesSchema = z.object({ title: z.string(), allDay: z.boolean(), repeat: z.enum(['none', 'yearly']).optional(), importantDate: z.boolean().optional(), startDate: z.string(), endDate: z.string(),
    startTime: z.string(), endTime: z.string(), who: whoSchema,
    location: z.string(), description: z.string() });
export const eventFormSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(120, 'Use 120 characters or less.'),
  allDay: z.boolean(), repeat: z.enum(['none', 'yearly']).optional(), importantDate: z.boolean().optional(), startDate: dateSchema, endDate: dateSchema,
  startTime: z.string(), endTime: z.string(), who: whoSchema,
  location: z.string().max(200, 'Use 200 characters or less.'), description: z.string().max(2000, 'Use 2,000 characters or less.'),
}).superRefine((value, context) => {
  if (value.importantDate && !value.allDay) context.addIssue({ code: 'custom', path: ['allDay'], message: 'An important date must be all day.' });
  if (value.repeat === 'yearly' && (!value.allDay || value.startDate !== value.endDate)) context.addIssue({ code: 'custom', path: ['endDate'], message: 'A yearly date must be one all-day date.' });
  if (value.allDay) {
    if (value.endDate < value.startDate) context.addIssue({ code: 'custom', path: ['endDate'], message: 'End must be on or after start.' });
    return;
  }
  let valid = true;
  for (const field of ['startTime', 'endTime'] as const) {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value[field])) continue;
    context.addIssue({ code: 'custom', path: [field], message: 'Use a 24-hour time, such as 18:30.' });
    valid = false;
  }
  if (valid && `${value.endDate}T${value.endTime}` <= `${value.startDate}T${value.startTime}`)
    context.addIssue({ code: 'custom', path: ['endTime'], message: 'End must follow start.' });
});

// Read a date and time in the viewer's timezone. An hour that repeats at a clock change uses its first occurrence.
function wallInstant(date: string, time: string, timezone: string): string {
  const value = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
  const first = value.getPossibleOffsets().sort((a, b) => a.toMillis() - b.toMillis())[0] ?? value;
  return first.toUTC().toISO()!;
}

export function inclusiveEndDate(exclusive: string): string {
  return DateTime.fromISO(dateSchema.parse(exclusive), { zone: 'UTC' }).minus({ days: 1 }).toISODate()!;
}

export function toEventInput(values: EventFormValues & { id: string; pairId: string; confirmShared?: boolean }, timezone: string): EventInput {
  const parsed = eventFormSchema.parse(values);
  return eventInputSchema.parse({
    id: values.id, pairId: values.pairId, title: parsed.title, who: parsed.who,
    repeat: parsed.repeat, importantDate: parsed.importantDate || parsed.repeat === 'yearly', location: parsed.location, description: parsed.description, confirmShared: values.confirmShared,
    temporal: parsed.allDay
      ? { kind: 'allDay', startDate: parsed.startDate, endDateExclusive: DateTime.fromISO(parsed.endDate, { zone: 'UTC' }).plus({ days: 1 }).toISODate()! }
      : { kind: 'timed', startsAt: wallInstant(parsed.startDate, parsed.startTime, timezone), endsAt: wallInstant(parsed.endDate, parsed.endTime, timezone) },
  });
}

export function eventToForm(event: Event, timezone: string): EventFormValues {
  const temporal = event.temporal;
  const start = temporal.kind === 'timed' ? DateTime.fromISO(temporal.startsAt).setZone(timezone) : null;
  const end = temporal.kind === 'timed' ? DateTime.fromISO(temporal.endsAt).setZone(timezone) : null;
  return { title: event.title, repeat: event.repeat, importantDate: event.importantDate, allDay: temporal.kind === 'allDay',
    startDate: temporal.kind === 'allDay' ? (event.seriesDate ?? temporal.startDate) : start!.toISODate()!,
    endDate: temporal.kind === 'allDay' ? (event.seriesDate ?? inclusiveEndDate(temporal.endDateExclusive)) : end!.toISODate()!,
    startTime: start?.toFormat('HH:mm') ?? '', endTime: end?.toFormat('HH:mm') ?? '',
    who: event.who, location: event.location ?? '', description: event.description ?? '',
  };
}

export const eventRowSchema = z.object({
  id: z.string().uuid(), pair_id: z.string().uuid(), created_by: z.string().uuid(), title: z.string(),
  who: whoSchema,
  starts_at: z.string().nullable(), ends_at: z.string().nullable(), start_date: z.string().nullable(), end_date_exclusive: z.string().nullable(),
  location: z.string().nullable(), description: z.string().nullable(), version: z.number().int().positive(), repeat: z.enum(['none', 'yearly']), important_date: z.boolean().default(false), repeat_month: z.number().int().nullable().optional(), repeat_day: z.number().int().nullable().optional(), occurrence_date: dateSchema.optional(),
}).transform((row): Event => {
  const temporal = row.starts_at !== null
    ? { kind: 'timed' as const, startsAt: row.starts_at, endsAt: row.ends_at! }
    : { kind: 'allDay' as const, startDate: row.occurrence_date ?? row.start_date!, endDateExclusive: row.occurrence_date ? DateTime.fromISO(row.occurrence_date, { zone: 'UTC' }).plus({ days: 1 }).toISODate()! : row.end_date_exclusive! };
  const input = eventInputSchema.parse({ id: row.id, pairId: row.pair_id, title: row.title, who: row.who,
    repeat: row.repeat, importantDate: row.important_date || row.repeat === 'yearly', temporal, location: row.location ?? undefined, description: row.description ?? undefined });
  return { ...input, authorId: row.created_by, version: row.version, ...(row.repeat === 'yearly' ? { seriesDate: row.start_date! } : {}) };
});
