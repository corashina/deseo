import type { PairContext } from '@deseo/domain/pair';
import { usePairSignals } from '../../lib/realtime';
export function useTaskSignals(accountId: string, pair: PairContext | null) {
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  usePairSignals('tasks', accountId, pair, { topic: 'tasks:' + pairId, private: true });
}
