import type { PairContext } from '@deseo/domain/pair';
import { usePairSignals } from '../../lib/realtime';
// A deleted memory leaves RLS, so its row change does not reach the partner. A revocation row signals it.
export function useMemorySignals(accountId: string, pair: PairContext | null) {
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  usePairSignals('memories', accountId, pair, { topic: 'portal-memories:' + accountId + ':' + pairId, private: false, table: 'memories' });
  usePairSignals('memories', accountId, pair, { topic: 'portal-memory-revocations:' + accountId + ':' + pairId, private: false, table: 'memory_access_revocations' });
}
