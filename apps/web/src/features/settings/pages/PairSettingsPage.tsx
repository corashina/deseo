import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppError, toAppError } from '@deseo/domain/result';
import { useSession } from '../../../app/SessionProvider';
import { requestVerificationCode, withFreshSignIn } from '../../auth';
import { endPair } from '../../pair';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Dialog } from '../../../components/ui/Dialog';
import '../../../styles/settings.css';
export function PairSettingsPage() {
  const { account, pair, revalidate } = useSession();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [confirm, setConfirm] = useState(false);
  // Keep the command ID once the code is accepted. A retry reuses it, so the server replays the result.
  const [attempt, setAttempt] = useState<{ pairId: string; commandId: string }>();
  const send = useMutation({ mutationFn: requestVerificationCode, onSuccess: () => setCode('') });
  const disconnect = useMutation({
    mutationFn: async (pairId: string) => {
      if (attempt) return endPair(attempt.pairId, attempt.commandId);
      const next = { pairId, commandId: crypto.randomUUID() };
      return withFreshSignIn(code, client => { setAttempt(next); setCode(''); return endPair(next.pairId, next.commandId, client); }).catch((error: unknown) => {
        const failure = toAppError(error);
        throw failure.code === 'VALIDATION' ? new AppError({ code: 'VALIDATION', message: 'The code is invalid or expired. Request a new code.' }) : failure;
      });
    },
    onSuccess: async () => { setConfirm(false); setAttempt(undefined); await revalidate(); },
    onError: error => { if (toAppError(error).code !== 'RETRYABLE') setAttempt(undefined); },
  });
  useUnsavedChanges(Boolean(code) || Boolean(attempt));
  const busy = send.isPending || disconnect.isPending;
  const error = disconnect.isError ? toAppError(disconnect.error).message : send.isError ? toAppError(send.error).message : '';
  return <section className="card form-page settings-detail"><PageHeader title="Your pair" description="Manage your shared access." />
    {pair?.status === 'active' ? <><div className="paired-members">{pair.members.map(member => <div key={member.userId}><Avatar name={member.displayName} slot={member.slot} /><h2>{member.displayName}</h2><p>{member.userId === account!.id ? 'You' : 'Your partner'}</p></div>)}</div>
      <p>Pair timezone: <span translate="no">{pair.timezone}</span></p>
      <section className="settings-section"><h2>End this pair</h2><p>Either person can end this pair. Both people lose shared access. Your next pair starts empty.</p>
      {attempt ? <Button variant="danger" disabled={busy} onClick={() => disconnect.mutate(pair.pairId)}>Retry ending pair</Button> : <><Button variant="secondary" disabled={busy} onClick={() => send.mutate()}>{send.isSuccess ? 'Send a new code' : 'Send code to end pair'}</Button>
      {send.isSuccess && <><Field label="Email verification code" name="code" spellCheck={false} disabled={busy} inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} error={codeError} onChange={event => { setCodeError(''); setCode(event.target.value); }} /><Button variant="danger" disabled={busy} onClick={() => { if (/^\d{6}$/.test(code)) setConfirm(true); else setCodeError('Enter the 6-digit code from your email.'); }}>End pair</Button></>}</>}</section>
    </> : <><p>{pair?.status === 'ended' ? 'Your pair has ended. Shared content is unavailable.' : 'You have no active pair.'}</p><Link to="/pair/start">Set up your pair</Link></>}
    {error && !confirm && <Status error>{error}</Status>}<Link to="/settings">Return to settings</Link>
    <Dialog busy={busy} title="End this pair?" open={confirm} onClose={() => { if (!busy) setConfirm(false); }}><p>Both people lose shared access. This cannot be undone.</p>{confirm && error && <Status error>{error}</Status>}<Button variant="danger" disabled={busy || pair?.status !== 'active'} onClick={() => { if (pair?.status === 'active') disconnect.mutate(pair.pairId); }}>Confirm ending pair</Button></Dialog>
  </section>;
}
