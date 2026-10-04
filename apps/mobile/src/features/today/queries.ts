import { DateTime } from 'luxon';
import { listAgenda } from '../calendar';
import { getPairContext } from '../pair';
import { AppError } from '../../lib/result';
import type { TodayView } from './types';

export async function getToday(pairId: string, date: string): Promise<TodayView> {
  const pair = await getPairContext();
  if (pair.status !== 'active' || pair.pairId !== pairId) throw new AppError({ code: 'FORBIDDEN' });
  const day = DateTime.fromISO(date, { zone: pair.timezone });
  if (!day.isValid || day.toISODate() !== date) throw new AppError({ code: 'VALIDATION', field: 'date' });
  const rows = await listAgenda({ pairId, from: date, to: day.plus({ days: 7 }).toISODate()! });
  const now = Date.now();
  return { pair, agenda: rows.filter(event => event.temporal.kind === 'allDay' || Date.parse(event.temporal.endsAt) > now).slice(0, 3) };
}
