import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppError, toAppError } from '@deseo/domain/result';
import { useSession } from '../../../app/SessionProvider';
import { requestSensitiveActionCode, verifySensitiveAction } from '../../auth';
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
  const [confirm, setConfirm] = useState(false);
  // A verified proof is kept, so a retry after a failed end does not need a new code.
  const [proof, setProof] = useState<string>();
  const send = useMutation({ mutationFn: () => requestSensitiveActionCode('end_pair'), onSuccess: () => setCode('') });
  const disconnect = useMutation({
    mutationFn: async (pairId: string) => {
      let current = proof;
      if (!current) {
        current = (await verifySensitiveAction('end_pair', code).catch((error: unknown) => {
          const failure = toAppError(error);
          throw failure.code === 'VALIDATION' ? new AppError({ code: 'VALIDATION', message: 'The code is invalid or expired. Request a new code.' }) : failure;
        })).proof;
        setProof(current); setCode('');
      }
      await endPair(pairId, current);
    },
    onSuccess: async () => { setConfirm(false); setProof(undefined); await revalidate(); },
    onError: error => { if (toAppError(error).code !== 'RETRYABLE') setProof(undefined); },
  });
  useUnsavedChanges(Boolean(code) || Boolean(proof));
  const busy = send.isPending || disconnect.isPending;
  const error = disconnect.isError ? toAppError(disconnect.error).message : send.isError ? toAppError(send.error).message : '';
  return <section className="card form-page settings-detail"><PageHeader title="Your pair" description="Manage your shared access." />
    {pair?.status === 'active' ? <><div className="paired-members">{pair.members.map(member => <div key={member.userId}><Avatar name={member.displayName} slot={member.slot} /><h2>{member.displayName}</h2><p>{member.userId === account!.id ? 'You' : 'Your partner'}</p></div>)}</div>
      <p>Pair timezone: {pair.timezone}</p>
      <section className="settings-section"><h2>End this pair</h2><p>Either person can end this pair. Both people lose shared access. Your next pair starts empty.</p>
      {proof ? <Button variant="danger" disabled={busy} onClick={() => disconnect.mutate(pair.pairId)}>Retry ending pair</Button> : <><Button variant="secondary" disabled={busy} onClick={() => send.mutate()}>{send.isSuccess ? 'Send a new code' : 'Send code to end pair'}</Button>
      {send.isSuccess && <><Field label="Email verification code" disabled={busy} inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} onChange={event => setCode(event.target.value)} /><Button variant="danger" disabled={busy || !/^\d{6}$/.test(code)} onClick={() => setConfirm(true)}>End pair</Button></>}</>}</section>
    </> : <><p>{pair?.status === 'ended' ? 'Your pair has ended. Shared content is unavailable.' : 'You have no active pair.'}</p><Link to="/pair/start">Set up your pair</Link></>}
    {error && !confirm && <Status error>{error}</Status>}<Link to="/settings">Return to settings</Link>
    <Dialog busy={busy} title="End this pair?" open={confirm} onClose={() => { if (!busy) setConfirm(false); }}><p>Both people lose shared access. This cannot be undone.</p>{confirm && error && <Status error>{error}</Status>}<Button variant="danger" disabled={busy || pair?.status !== 'active'} onClick={() => { if (pair?.status === 'active') disconnect.mutate(pair.pairId); }}>Confirm ending pair</Button></Dialog>
  </section>;
}
