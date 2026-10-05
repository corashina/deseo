import { listAgenda } from './queries';
import type { AgendaItem } from '@deseo/domain/calendar';

export async function listImportantDates(pairId: string, from: string, to: string): Promise<AgendaItem[]> {
  return (await listAgenda({ pairId, from, to })).filter(event => event.importantDate === true || event.repeat === 'yearly');
}
