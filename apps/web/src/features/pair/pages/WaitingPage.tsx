import { DateTime } from 'luxon';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toAppError } from '@deseo/domain/result';
import { cancelPendingPair, createInvite, takeHeldInvite } from '..';
import { useSession } from '../../../app/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
import { formatDate } from '../../../lib/format';
export function WaitingPage() {
  const { account, pair, revalidate } = useSession();
  const pairId = pair?.status === 'pending' ? pair.pairId : '';
  const [held] = useState(() => takeHeldInvite(pairId));
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const invite = useMutation({ mutationFn: createInvite, onMutate: () => setStatus('') });
  const cancel = useMutation({ mutationFn: cancelPendingPair, onSuccess: () => revalidate() });
  if (pair?.status !== 'pending') return null;
  const current = invite.data ?? (invite.isIdle ? held : null);
  const token = current?.token ?? '';
  const expiresAt = current?.expiresAt ?? pair.invite?.expiresAt;
  async function copy() {
    try {
      await navigator.clipboard.writeText(location.origin + '/invite?token=' + token);
      setStatus('Invitation link copied.');
    } catch { setStatus('Copy the code above and send it to your partner.'); }
  }
  return <><PageHeader title="Waiting for your partner" description="Send this code to your partner. Only your partner should use it." /><section className="card form-page">
    {token && !invite.isPending ? <>
      <p className="invite-code" translate="no" aria-label="Your invitation code">{token}</p>
      <Button onClick={() => void copy()}>Copy invitation link</Button>
    </> : expiresAt && !invite.isPending && <p>Your invitation code was shown once. Replace it to see a new code.</p>}
    {expiresAt && !invite.isPending && <p className="muted">Expires {formatDate(DateTime.fromISO(expiresAt).setZone(account!.timezone), 'dateTime', account!.locale)}</p>}
    {status && <Status>{status}</Status>}
    <div className="actions">
      <Button variant={token ? 'secondary' : 'primary'} disabled={invite.isPending} onClick={() => invite.mutate(pair.pairId)}>
        {invite.isPending ? 'Creating invitation…' : invite.isError ? 'Retry invitation code' : expiresAt ? 'Replace invitation code' : 'Create invitation code'}
      </Button>
      <Button variant="secondary" onClick={() => void revalidate()}>Check pair status</Button>
    </div>
    {invite.isError && <Status error>{toAppError(invite.error).message}</Status>}
    <div className="pair-cancel"><Button variant="secondary" onClick={() => setOpen(true)}>Cancel pending pair</Button></div></section>
    <Dialog busy={cancel.isPending} open={open} onClose={() => { if (!cancel.isPending) setOpen(false); }} title="Cancel this pair?"><p>The invitation will stop working. You can create or join another pair.</p>{cancel.isError && <Status error>{toAppError(cancel.error).message}</Status>}<Button variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate(pair.pairId)}>{cancel.isError ? 'Retry cancel' : 'Cancel pair'}</Button></Dialog></>;
}
