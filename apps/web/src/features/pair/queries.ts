import { pairContextSchema } from '@deseo/domain/pair';
import { callRpc } from '../../lib/rpc';
export function getPairContext() {
  return callRpc('get_pair_context', {}, pairContextSchema);
}
