import type { PairContext } from '@deseo/domain/pair';
import { usePairSignals } from '../../lib/realtime';
export function useCalendarSignals(accountId: string, pair: PairContext | null) {
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  usePairSignals('calendar', accountId, pair, { topic: 'calendar:' + pairId, private: true, table: 'events' });
}
