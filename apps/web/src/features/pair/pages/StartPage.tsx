import { isOnline, useNetworkStatus } from '../../../lib/network';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPair } from '..';
import { useSession } from '../../../app/SessionProvider';
import { readDraft, writeDraft, removeDraft } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function StartPage() {
  const online = useNetworkStatus();
  const { account, pair, revalidate } = useSession();

  const pairId = pair && 'pairId' in pair ? pair.pairId : null;
  const [attempt, setAttempt] = useState(() => readDraft<{ commandId: string; timezone: string }>(account!.id, pairId, 'create-pair'));
  const [pending, setPending] = useState(false);
  const beginScope = useCommandScope(() => setPending(false));
  const [error, setError] = useState('');
  return <><PageHeader title="Make space for two" description="Invite your partner or join their pair with an invitation code." /><div className="pair-grid"><section className="card"><h2>Invite your partner</h2><p>Create your pair, then share a private invitation.</p><Button disabled={pending || !online} onClick={async () => { if (!isOnline() || pending) return; const scope = beginScope(); const next = attempt ?? { commandId: crypto.randomUUID(), timezone: account!.timezone }; setAttempt(next); writeDraft(account!.id, pairId, 'create-pair', next); setPending(true); setError(''); const result = await createPair(next.timezone, next.commandId); if (!scope.isCurrent()) return; if (result.ok || result.error.code !== 'RETRYABLE') { removeDraft(account!.id, pairId, 'create-pair'); setAttempt(undefined); } if (result.ok) await revalidate(); else { setError(result.error.message ?? 'Try again.'); setPending(false); } }}>Create pair</Button>{error && <Status error>{error}</Status>}</section><section className="card"><h2>Have an invitation?</h2><p>Use the code your partner sent you.</p><Link className="button secondary" to="/pair/join">Join a pair</Link></section></div></>;
}
