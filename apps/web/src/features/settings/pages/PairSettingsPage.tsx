import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { requestSensitiveActionCode, verifySensitiveAction } from '../../auth';
import { endPair } from '../../pair';
import { useCommandScope } from '../../../lib/use-command-scope';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { useNetworkStatus } from '../../../lib/network';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Dialog } from '../../../components/ui/Dialog';
import '../../../styles/settings.css';
type Attempt = { proof: string; expiresAt: string; commandId: string; pairId: string };
export function PairSettingsPage() {
  const { account, pair, revalidate } = useSession(); const online = useNetworkStatus();
  const pairId = pair && 'pairId' in pair ? pair.pairId : null;
  const attempt = useRef(readDraft<Attempt>(account!.id, pairId, 'end-pair'));
  const mounted = useRef(false); const pending = useRef(false);
  const [code, setCode] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false); const [error, setError] = useState(''); const [uncertain, setUncertain] = useState(Boolean(attempt.current));
  useUnsavedChanges(Boolean(code) || uncertain);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (pair?.status === 'active') return;
    removeDraft(account!.id, pairId, 'end-pair'); attempt.current = undefined;
    setCode(''); setSent(false); setConfirm(false); setUncertain(false);
  }, [account, pairId, pair?.status]);
  const beginScope = useCommandScope(() => { pending.current = false; setBusy(false); setUncertain(Boolean(attempt.current)); });
  async function send() {
    if (!online || pending.current || uncertain) return;
    const scope = beginScope(); pending.current = true; setBusy(true); setError('');
    const result = await requestSensitiveActionCode('end_pair');
    if (!mounted.current || scope.signal.aborted) return;
    pending.current = false; setBusy(false);
    if (result.ok) { setSent(true); setCode(''); } else setError(result.error.message ?? 'We could not send a code. Try again.');
  }
  async function disconnect() {
    if (!online || pending.current || pair?.status !== 'active') return;
    const scope = beginScope(); pending.current = true; setBusy(true); setError('');
    try {
      if (!attempt.current) {
        const verified = await verifySensitiveAction('end_pair', code); scope.assertCurrent();
        if (!mounted.current) return;
        if (!verified.ok) { setError(verified.error.message ?? 'The code is invalid or expired. Request a new code.'); return; }
        attempt.current = { ...verified.data, pairId: pair.pairId, commandId: crypto.randomUUID() };
        writeDraft(account!.id, pairId, 'end-pair', attempt.current); setCode('');
      }
      const result = await endPair(attempt.current.pairId, attempt.current.proof, attempt.current.commandId);
      if (!mounted.current) return;
      // The successful end command clears the query scope itself.
      if (result.ok) { removeDraft(account!.id, pairId, 'end-pair'); attempt.current = undefined; setConfirm(false); setUncertain(false); await revalidate(); return; }
      scope.assertCurrent();
      setError(result.error.message ?? 'We could not end this pair. Try again.');
      if (result.error.code !== 'RETRYABLE') { removeDraft(account!.id, pairId, 'end-pair'); attempt.current = undefined; setUncertain(false); setSent(false); }
      else setUncertain(true);
    } catch { if (mounted.current && !scope.signal.aborted) { setUncertain(Boolean(attempt.current)); setError('Pair termination is unconfirmed. Retry the same action.'); } }
    finally { if (mounted.current && !scope.signal.aborted) { pending.current = false; setBusy(false); } }
  }
  return <><PageHeader title="Your pair" back={{ to: '/settings', label: 'Settings' }} /><section className="card form-page settings-detail">
    {pair?.status === 'active' ? <><div className="paired-members">{pair.members.map(member => <div key={member.userId}><Avatar name={member.displayName} slot={member.slot} /><h2>{member.displayName}</h2><p>{member.userId === account!.id ? 'You' : 'Your partner'}</p></div>)}</div>
      <p>Pair timezone: {pair.timezone}</p>
      <section className="settings-section"><h2>End this pair</h2><p>Either person can end this pair. Both people lose shared access. Your next pair starts empty.</p>
      {uncertain ? <Button variant="danger" disabled={!online || busy} onClick={() => void disconnect()}>Retry ending pair</Button> : <><Button variant="secondary" disabled={!online || busy} onClick={() => void send()}>{sent ? 'Send a new code' : 'Send code to end pair'}</Button>
      {sent && <><Field label="Email verification code" disabled={busy} inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} onChange={event => setCode(event.target.value)} /><Button variant="danger" disabled={!online || busy || !/^\d{6}$/.test(code)} onClick={() => setConfirm(true)}>End pair</Button></>}</>}</section>
    </> : <><p>{pair?.status === 'ended' ? 'Your pair has ended. Shared content is unavailable.' : 'You have no active pair.'}</p><Link to="/pair/start">Set up your pair</Link></>}
    {error && !confirm && <Status error>{error}</Status>}
    </section>
    <Dialog busy={busy} title="End this pair?" open={confirm} onClose={() => { if (!busy) setConfirm(false); }}><p>Both people lose shared access. This cannot be undone.</p>{confirm && error && <Status error>{error}</Status>}<Button variant="danger" disabled={!online || busy} onClick={() => void disconnect()}>Confirm ending pair</Button></Dialog>
  </>;
}
