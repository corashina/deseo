import { DateTime, IANAZone } from 'luxon';
import { z } from 'zod';
import type { Event, EventFormValues, EventInput } from './types';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine((value) => DateTime.fromISO(value, { zone: 'UTC' }).isValid, 'Enter a valid date.');
export const zoneSchema = z.string().refine((value) => IANAZone.isValidZone(value), 'Enter a valid IANA timezone.');
const instantSchema = z.string().datetime({ offset: true });
const temporalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('timed'), startsAt: instantSchema, endsAt: instantSchema }).strict(),
  z.object({ kind: z.literal('allDay'), startDate: dateSchema, endDateExclusive: dateSchema }).strict(),
]);
export const eventInputSchema = z.object({
  id: z.string().uuid(), pairId: z.string().uuid(),
  title: z.string().trim().min(1, 'Enter a title.').max(120, 'Use 120 characters or less.'),
  owner: z.enum(['a', 'b', 'together']), visibility: z.enum(['shared', 'private']),
  timezone: zoneSchema, temporal: temporalSchema,
  location: z.string().trim().max(200).optional(), description: z.string().trim().max(2000).optional(),
  confirmShared: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  const temporal = value.temporal;
  const valid = temporal.kind === 'timed'
    ? DateTime.fromISO(temporal.endsAt).toMillis() > DateTime.fromISO(temporal.startsAt).toMillis()
    : temporal.endDateExclusive > temporal.startDate;
  if (!valid) context.addIssue({ code: 'custom', path: ['temporal'], message: 'End must follow start.' });
  if (value.visibility === 'private' && value.owner === 'together') context.addIssue({ code: 'custom', path: ['owner'], message: 'A private event must belong to you.' });
});
export const eventFormSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(120, 'Use 120 characters or less.'),
  allDay: z.boolean(), startDate: dateSchema, endDate: dateSchema,
  startTime: z.string(), endTime: z.string(),
  startOffset: z.number().optional(), endOffset: z.number().optional(),
  timezone: zoneSchema, owner: z.enum(['a', 'b', 'together']), visibility: z.enum(['shared', 'private']),
  location: z.string().max(200, 'Use 200 characters or less.'), description: z.string().max(2000, 'Use 2,000 characters or less.'),
}).superRefine((value, context) => {
  if (value.allDay) {
    if (value.endDate < value.startDate) context.addIssue({ code: 'custom', path: ['endDate'], message: 'End must be on or after start.' });
    return;
  }
  let start: string | undefined;
  let end: string | undefined;
  for (const field of ['start', 'end'] as const) {
    try {
      const instant = resolveWallTime(value[`${field}Date`], value[`${field}Time`], value.timezone, value[`${field}Offset`]);
      if (field === 'start') start = instant;
      else end = instant;
    } catch (error) {
      context.addIssue({ code: 'custom', path: [`${field}Time`], message: error instanceof Error ? error.message : 'Enter a valid time.' });
    }
  }
  if (start && end && end <= start) context.addIssue({ code: 'custom', path: ['endTime'], message: 'End must follow start.' });
});

export function wallTimeChoices(date: string, time: string, timezone: string): DateTime[] {
  zoneSchema.parse(timezone);
  dateSchema.parse(date);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Use a 24-hour time, such as 18:30.');
  const wall = `${date}T${time}`;
  const value = DateTime.fromISO(wall, { zone: timezone });
  if (!value.isValid || value.toFormat("yyyy-MM-dd'T'HH:mm") !== wall) {
    throw new Error('This time does not exist. Choose another time.');
  }
  return value.getPossibleOffsets().sort((a, b) => a.toMillis() - b.toMillis());
}

export function resolveWallTime(date: string, time: string, timezone: string, offset?: number): string {
  const choices = wallTimeChoices(date, time, timezone);
  if (choices.length > 1 && offset === undefined) throw new Error('Choose the first or second time below.');
  const selected = offset === undefined ? choices[0] : choices.find((choice) => choice.offset === offset);
  if (!selected) throw new Error('Choose the current timezone offset.');
  return selected.toUTC().toISO()!;
}

export function inclusiveEndDate(exclusive: string): string {
  return DateTime.fromISO(dateSchema.parse(exclusive), { zone: 'UTC' }).minus({ days: 1 }).toISODate()!;
}

export function toEventInput(values: EventFormValues & { id: string; pairId: string; confirmShared?: boolean }): EventInput {
  const parsed = eventFormSchema.parse(values);
  return eventInputSchema.parse({
    id: values.id, pairId: values.pairId, title: parsed.title, owner: parsed.owner, visibility: parsed.visibility,
    timezone: parsed.timezone, location: parsed.location, description: parsed.description, confirmShared: values.confirmShared,
    temporal: parsed.allDay
      ? { kind: 'allDay', startDate: parsed.startDate, endDateExclusive: DateTime.fromISO(parsed.endDate, { zone: 'UTC' }).plus({ days: 1 }).toISODate()! }
      : { kind: 'timed', startsAt: resolveWallTime(parsed.startDate, parsed.startTime, parsed.timezone, parsed.startOffset), endsAt: resolveWallTime(parsed.endDate, parsed.endTime, parsed.timezone, parsed.endOffset) },
  });
}

export function eventToForm(event: Event): EventFormValues {
  const temporal = event.temporal;
  const start = temporal.kind === 'timed' ? DateTime.fromISO(temporal.startsAt).setZone(event.timezone) : null;
  const end = temporal.kind === 'timed' ? DateTime.fromISO(temporal.endsAt).setZone(event.timezone) : null;
  return { title: event.title, allDay: temporal.kind === 'allDay',
    startDate: temporal.kind === 'allDay' ? temporal.startDate : start!.toISODate()!,
    endDate: temporal.kind === 'allDay' ? inclusiveEndDate(temporal.endDateExclusive) : end!.toISODate()!,
    startTime: start?.toFormat('HH:mm') ?? '', endTime: end?.toFormat('HH:mm') ?? '',
    startOffset: start?.offset, endOffset: end?.offset, timezone: event.timezone,
    owner: event.owner, visibility: event.visibility, location: event.location ?? '', description: event.description ?? '',
  };
}

export const eventRowSchema = z.object({
  id: z.string().uuid(), pair_id: z.string().uuid(), created_by: z.string().uuid(), title: z.string(),
  owner: z.enum(['a', 'b', 'together']), visibility: z.enum(['shared', 'private']), timezone: zoneSchema,
  starts_at: z.string().nullable(), ends_at: z.string().nullable(), start_date: z.string().nullable(), end_date_exclusive: z.string().nullable(),
  location: z.string().nullable(), description: z.string().nullable(), version: z.number().int().positive(), repeat: z.literal('none'),
}).transform((row): Event => {
  const temporal = row.starts_at !== null
    ? { kind: 'timed' as const, startsAt: row.starts_at, endsAt: row.ends_at! }
    : { kind: 'allDay' as const, startDate: row.start_date!, endDateExclusive: row.end_date_exclusive! };
  const input = eventInputSchema.parse({ id: row.id, pairId: row.pair_id, title: row.title, owner: row.owner, visibility: row.visibility,
    timezone: row.timezone, temporal, location: row.location ?? undefined, description: row.description ?? undefined });
  return { ...input, authorId: row.created_by, version: row.version };
});
