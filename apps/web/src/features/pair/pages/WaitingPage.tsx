import { isOnline, useNetworkStatus } from '../../../lib/network';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cancelPendingPair } from '..';
import { useSession } from '../../../app/SessionProvider';
import { readDraft, writeDraft, removeDraft } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function WaitingPage() {
  const online = useNetworkStatus();
  const { account, pair, revalidate } = useSession();
  const [open, setOpen] = useState(false);

  const pairId = pair && 'pairId' in pair ? pair.pairId : null;
  const [commandId, setCommandId] = useState(() => readDraft<string>(account!.id, pairId, 'cancel-pair') ?? crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const beginScope = useCommandScope(() => setPending(false));
  const [error, setError] = useState('');
  if (pair?.status !== 'pending') return null;
  return <><PageHeader title="Waiting for your partner" description="Your pair is ready. Share an invitation to connect." /><section className="card form-page"><h2>One more person</h2><p>Your partner can sign in and use your invitation code.</p><div className="actions"><Link className="button primary" to="/pair/invite">Get invitation code</Link><Button variant="secondary" onClick={() => void revalidate()}>Check pair status</Button></div><Button variant="secondary" onClick={() => setOpen(true)}>Cancel pending pair</Button></section>
    <Dialog busy={pending} open={open} onClose={() => { if (!pending) setOpen(false); }} title="Cancel this pair?"><p>The invitation will stop working. You can create or join another pair.</p>{error && <Status error>{error}</Status>}<Button variant="danger" disabled={pending || !online} onClick={async () => { if (!isOnline() || pending) return; const scope = beginScope(); writeDraft(account!.id, pairId, 'cancel-pair', commandId); setPending(true); const result = await cancelPendingPair(pair.pairId, commandId); if (!scope.isCurrent()) return; if (result.ok || result.error.code !== 'RETRYABLE') { removeDraft(account!.id, pairId, 'cancel-pair'); setCommandId(crypto.randomUUID()); } if (result.ok) await revalidate(); else { setError(result.error.message ?? 'Try again.'); setPending(false); } }}>Cancel pair</Button></Dialog></>;
}
