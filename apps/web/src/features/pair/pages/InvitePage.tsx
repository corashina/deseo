import { DateTime } from 'luxon';
import { isOnline, useNetworkStatus } from '../../../lib/network';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createInvite } from '..';
import { useSession } from '../../../app/SessionProvider';
import { readDraft, writeDraft, removeDraft } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { formatDate } from '../../../lib/format';
import { PageHeader } from '../../../components/ui/PageHeader';

type Attempt = Readonly<{ pairId: string; commandId: string }>;
const draftKey = 'create-invite';

export function InvitePage() {
  const online = useNetworkStatus();
  const { account, pair } = useSession();
  const pairId = pair && 'pairId' in pair ? pair.pairId : null;
  const [token, setToken] = useState('');
  const [expires, setExpires] = useState('');
  const [attempt, setAttempt] = useState(() => readDraft<Attempt>(account!.id, pairId, draftKey));
  const currentAttempt = useRef(attempt);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const beginScope = useCommandScope(() => { busy.current = false; setPending(false); });

  async function generate() {
    if (!isOnline() || busy.current || pair?.status !== 'pending') return;
    const scope = beginScope();
    const next = currentAttempt.current ?? { pairId: pair.pairId, commandId: crypto.randomUUID() };
    currentAttempt.current = next;
    writeDraft(account!.id, pairId, draftKey, next);
    setAttempt(next); busy.current = true; setPending(true); setError(''); setStatus('');
    const result = await createInvite(next.pairId, next.commandId);
    if (!scope.isCurrent()) return;
    busy.current = false; setPending(false);
    if (result.ok || result.error.code !== 'RETRYABLE') {
      removeDraft(account!.id, pairId, draftKey); currentAttempt.current = undefined; setAttempt(undefined);
    }
    if (!result.ok) { setError(result.error.message ?? 'Try again.'); return; }
    setToken(result.data.token ?? ''); setExpires(result.data.expiresAt);
    if (!result.data.token) setStatus('The code was already delivered. Create a new invitation code to replace it.');
  }

  async function copy() {
    if (!token || currentAttempt.current || busy.current) return;
    const scope = beginScope();
    try {
      await navigator.clipboard.writeText(location.origin + '/invite?token=' + token);
      if (scope.isCurrent()) setStatus('Invitation link copied.');
    } catch { if (scope.isCurrent()) setError('Copy the code above and send it to your partner.'); }
  }

  if (pair?.status !== 'pending') return null;
  return <section className="card form-page">
    <PageHeader title="Invite your partner" description="Only your partner should use this code. New codes replace earlier invitations." />
    {token && !attempt && !pending && <>
      <p className="invite-code" translate="no" aria-label="Your invitation code">{token}</p>
      <p className="muted">Expires {formatDate(DateTime.fromISO(expires).setZone(account!.timezone), 'dateTime', account!.locale)}</p>
      <Button onClick={() => void copy()}>Copy invitation link</Button>
    </>}
    {attempt && !pending && <Status>Invitation delivery is unconfirmed. Retry the same request.</Status>}
    <Button variant={attempt || !token ? 'primary' : 'secondary'} disabled={pending || !online} onClick={() => void generate()}>
      {pending ? 'Creating invitation…' : attempt ? 'Retry invitation code' : token ? 'Replace invitation code' : 'Create invitation code'}
    </Button>
    {error && <Status error>{error}</Status>}
    {status && <Status>{status}</Status>}
    <Link to="/pair/waiting">Waiting for your partner</Link>
  </section>;
}
