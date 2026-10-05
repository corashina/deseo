import { captureQueryScope } from '../../lib/query-client';
import { DateTime } from 'luxon';
import { listAgenda, nextImportantDate } from '../calendar';
import { listDueTasks } from '../tasks';
import { getPairContext } from '../pair';
import { AppError } from '@deseo/domain/result';
export const todayKeys = { day: (accountId: string, pairId: string, date: string) => ['today', accountId, pairId, date] as const };
export async function getToday(pairId: string, date: string) {
  const scope = captureQueryScope();
  const pair = await getPairContext();
  scope.assertCurrent();
  if (pair.status !== 'active' || pair.pairId !== pairId)
    throw new AppError({ code: 'FORBIDDEN' });
  const day = DateTime.fromISO(date, { zone: pair.timezone });
  if (!day.isValid || day.toISODate() !== date)
    throw new AppError({ code: 'VALIDATION', field: 'date' });
  const [events, tasks] = await Promise.all([
    listAgenda({ pairId, from: date, to: day.plus({ days: 366 }).toISODate()! }), listDueTasks(pairId, date),
  ]);
  scope.assertCurrent();
  const now = DateTime.now().setZone(pair.timezone);
  const weekEnd = day.plus({ days: 7 }).toISODate()!;
  const agenda = events.filter(event => event.temporal.kind === 'allDay'
    ? event.temporal.startDate < weekEnd && event.temporal.endDateExclusive > date
    : DateTime.fromISO(event.temporal.endsAt) > now && DateTime.fromISO(event.temporal.startsAt).setZone(pair.timezone).toISODate()! < weekEnd).slice(0, 3);
  return {
    pair,
    agenda,
    tasks: tasks.slice(0, 3),
    importantDate: nextImportantDate(events.filter(event => event.importantDate || event.repeat === 'yearly'), pair.timezone, day)
  };
}
