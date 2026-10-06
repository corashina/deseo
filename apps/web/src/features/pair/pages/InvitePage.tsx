import { isOnline, useNetworkStatus } from '../../../lib/network';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createInvite } from '..';
import { useSession } from '../../../app/SessionProvider';
import { readDraft, writeDraft, removeDraft } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function InvitePage() {
  const online = useNetworkStatus();
  const { account, pair } = useSession();

  const [token, setToken] = useState('');
  const [expires, setExpires] = useState('');
  const pairId = pair && 'pairId' in pair ? pair.pairId : null;
  const [commandId, setCommandId] = useState(() => readDraft<string>(account!.id, pairId, 'create-invite') ?? crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const beginScope = useCommandScope(() => setPending(false));
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  if (pair?.status !== 'pending') return null;
  return <section className="card form-page"><PageHeader title="Invite your partner" description="Only your partner should use this code. New codes replace earlier invitations." />
    {token && <><p className="invite-code">{token}</p><p className="muted">Expires {new Date(expires).toLocaleString()}</p><Button disabled={pending} onClick={async () => { const scope = beginScope(); try { await navigator.clipboard.writeText(location.origin + '/invite?token=' + token); if (scope.isCurrent()) setStatus('Invitation link copied.'); } catch { if (scope.isCurrent()) setError('Copy the code above and send it to your partner.'); } }}>Copy invitation link</Button></>}
    <Button variant={token ? 'secondary' : 'primary'} disabled={pending || !online} onClick={async () => {
      if (!isOnline() || pending) return; const scope = beginScope(); writeDraft(account!.id, pairId, 'create-invite', commandId); setPending(true); setError(''); const result = await createInvite(pair.pairId, commandId); if (!scope.isCurrent()) return; if (result.ok || result.error.code !== 'RETRYABLE') removeDraft(account!.id, pairId, 'create-invite'); setPending(false);
      if (!result.ok) setError(result.error.message ?? 'Try again.');
      else { setToken(result.data.token ?? ''); setExpires(result.data.expiresAt); setCommandId(crypto.randomUUID()); if (!result.data.token) setStatus('This code was already delivered. Create a new code to view it.'); }
    }}>{token ? 'Replace invitation code' : 'Create invitation code'}</Button>
    {error && <Status error>{error}</Status>}{status && <Status>{status}</Status>}<Link to="/pair/waiting">Waiting for your partner</Link></section>;
}
