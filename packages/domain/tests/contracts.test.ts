// Importance: 97. Shared contracts must preserve dates, authorship, UUIDs, and reminder rules.
import { DateTime } from 'luxon';
import { accountSchema } from '@deseo/domain/auth';
import { pairContextSchema } from '@deseo/domain/pair';
import { eventPayload, eventRowSchema, eventToForm, toEventInput, importantDateCountdown } from '@deseo/domain/calendar';
import { taskPayload, taskRowSchema } from '@deseo/domain/tasks';
import { decodeMessageCursor, encodeMessageCursor, messageRowSchema } from '@deseo/domain/messages';
import { memorySchema } from '@deseo/domain/memories';
import { preferencesSchema, reminderInputSchema } from '@deseo/domain/notifications';
import { errorResult, resultSchema } from '@deseo/domain/result';

const id = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
const pairId = '610bc9c7-8c81-47d1-894e-314c92071cf1';
const authorId = '8301d41c-9f5b-4973-9ea0-cbc5efb7d016';

test('all-day form and row round trips preserve dates and authorship', () => {
  const input = toEventInput({ id, pairId, title: 'Trip', allDay: true, repeat: 'none', startDate: '2026-10-25', endDate: '2026-10-26',
    startTime: '', endTime: '', timezone: 'Europe/Warsaw', owner: 'together', visibility: 'shared', location: '', description: '' });
  const event = eventRowSchema.parse({ ...eventPayload(input), created_by: authorId, version: 1 });
  expect(event.authorId).toBe(authorId);
  expect(event.temporal).toEqual({ kind: 'allDay', startDate: '2026-10-25', endDateExclusive: '2026-10-27' });
  expect(toEventInput({ ...eventToForm(event), id, pairId })).toEqual(input);
  expect(importantDateCountdown('2026-10-26', 'Europe/Warsaw', DateTime.fromISO('2026-10-24T22:30:00Z'))).toBe(1);
});

test('task payload and row preserve authorship and due date', () => {
  const input = { id, pairId, listId: id, title: 'Book tickets', assigneeId: authorId, dueDate: '2026-10-25' };
  const task = taskRowSchema.parse({ ...taskPayload(input), created_by: authorId, completed_at: null, completed_by: null, version: 2 });
  expect(task).toEqual({ ...input, authorId, completedAt: null, completedBy: null, version: 2 });
});

test('message row and cursor round trips preserve normalized UUIDs', () => {
  const message = messageRowSchema.parse({ id: id.toUpperCase(), pair_id: pairId, author_id: authorId,
    client_id: authorId.toUpperCase(), body: 'See you soon', created_at: '2026-10-05T09:30:00.123456Z', pinned_at: null, version: 1 });
  expect(message).toMatchObject({ id, pairId, authorId, clientId: authorId });
  expect(decodeMessageCursor(encodeMessageCursor({ createdAt: message.createdAt, id: message.id }))).toEqual({ createdAt: message.createdAt, id });
  expect(resultSchema(messageRowSchema).parse({ ok: true, data: { id, pair_id: pairId, author_id: authorId,
    client_id: authorId, body: message.body, created_at: message.createdAt, pinned_at: null, version: 1 } })).toEqual({ ok: true, data: message });
});

test('memory and account contracts preserve owner identity', () => {
  expect(memorySchema.parse({ id, pairId, createdBy: authorId, memoryDate: '2026-10-05', caption: '', state: 'published',
    version: 1, createdAt: '2026-10-05T09:30:00Z', updatedAt: '2026-10-05T09:30:00Z', expiresAt: null, photos: [] }).createdBy).toBe(authorId);
  expect(accountSchema.parse({ id: authorId, displayName: 'Anna', timezone: 'Europe/Warsaw', locale: 'pl', status: 'active', version: 1 }).id).toBe(authorId);
  expect(pairContextSchema.parse({ status: 'unpaired' })).toEqual({ status: 'unpaired' });
  expect(errorResult({ code: 'CONFLICT' })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
});

test('advance reminder contract rejects the obsolete zero offset', () => {
  const choice = preferencesSchema.innerType().shape.defaultEventReminderMinutes;
  expect(choice.safeParse(0).success).toBe(false);
  for (const value of [null, 15, 60, 1440]) expect(choice.safeParse(value).success).toBe(true);
  for (const minutesBefore of [15, 60, 1440]) {
    expect(reminderInputSchema.safeParse({ id, pairId, eventId: id, taskId: null, minutesBefore, remindAt: null, active: true, expectedVersion: null }).success).toBe(true);
  }
  expect(reminderInputSchema.safeParse({ id, pairId, eventId: id, taskId: null, minutesBefore: 0, remindAt: null, active: true, expectedVersion: null }).success).toBe(false);
});

test('preferences retain quiet-hours cross-field checks', () => {
  const input = { messageAlerts: true, defaultEventReminderMinutes: null, quietStart: null, quietEnd: null, timezone: 'Europe/Warsaw', version: 0 };
  expect(preferencesSchema.safeParse(input).success).toBe(true);
  expect(preferencesSchema.safeParse({ ...input, quietStart: '22:00' }).success).toBe(false);
  expect(preferencesSchema.safeParse({ ...input, quietStart: '22:00', quietEnd: '22:00' }).success).toBe(false);
  expect(preferencesSchema.safeParse({ ...input, quietStart: '22:00', quietEnd: '07:00' }).success).toBe(true);
});
