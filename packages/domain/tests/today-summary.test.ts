// Importance: 100. Both applications must parse the same Today rows and enforce server limits.
import { todayResultSchema, todaySummarySchema } from '@deseo/domain/today';
import { eventPayload, eventRowSchema } from '@deseo/domain/calendar';
import { taskPayload, taskRowSchema } from '@deseo/domain/tasks';
import { messageRowSchema } from '@deseo/domain/messages';

const id = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
const pairId = '610bc9c7-8c81-47d1-894e-314c92071cf1';
const authorId = '8301d41c-9f5b-4973-9ea0-cbc5efb7d016';
const empty = { agenda: [], important_dates: [], due_tasks: [], notes: [] };
const event = { ...eventPayload({ id, pairId, title: 'Trip', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw',
  temporal: { kind: 'allDay', startDate: '2026-10-25', endDateExclusive: '2026-10-27' } }), created_by: authorId, version: 1 };
const task = { ...taskPayload({ id, pairId, listId: id, title: 'Book tickets', assigneeId: authorId, dueDate: '2026-10-25' }),
  created_by: authorId, completed_at: null, completed_by: null, version: 2 };
const note = { id, pair_id: pairId, author_id: authorId, client_id: authorId, body: 'See you soon',
  created_at: '2026-10-05T09:30:00.123456Z', pinned_at: '2026-10-05T09:31:00Z', version: 1 };

test('Today transforms the shared Result envelope and rejects malformed data', () => {
  expect(todayResultSchema.parse({ ok: true, data: empty })).toEqual({
    ok: true, data: { agenda: [], importantDates: [], dueTasks: [], notes: [] },
  });
  expect(todaySummarySchema.safeParse({ ...empty, notes: null }).success).toBe(false);
  expect(todayResultSchema.safeParse({ ok: true, data: { ...empty, due_tasks: [{}] } }).success).toBe(false);
  expect(todayResultSchema.parse({ ok: false, error: { code: 'FORBIDDEN' } })).toEqual({ ok: false, error: { code: 'FORBIDDEN' } });
});

test('Today retains the full agenda and parses bounded Tasks and Notes through existing row schemas', () => {
  const rows = { agenda: Array(5).fill(event), important_dates: [event], due_tasks: Array(3).fill(task), notes: Array(2).fill(note) };
  expect(todaySummarySchema.parse(rows)).toEqual({ agenda: Array(5).fill(eventRowSchema.parse(event)),
    importantDates: [eventRowSchema.parse(event)], dueTasks: Array(3).fill(taskRowSchema.parse(task)), notes: Array(2).fill(messageRowSchema.parse(note)) });
  expect(todaySummarySchema.safeParse({ ...rows, due_tasks: Array(4).fill(task) }).success).toBe(false);
  expect(todaySummarySchema.safeParse({ ...rows, notes: Array(3).fill(note) }).success).toBe(false);
});
