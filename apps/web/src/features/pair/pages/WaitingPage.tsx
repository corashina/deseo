import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { cancelPendingPair } from '..';
import { useSession } from '../../../app/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function WaitingPage() {
  const { pair, revalidate } = useSession();
  const [open, setOpen] = useState(false);
  const cancel = useMutation({ mutationFn: cancelPendingPair, onSuccess: () => revalidate() });
  if (pair?.status !== 'pending') return null;
  return <><PageHeader title="Waiting for your partner" description="Your pair is ready. Share an invitation to connect." /><section className="card form-page"><h2>One more person</h2><p>Your partner can sign in and use your invitation code.</p><div className="actions"><Link className="button primary" to="/pair/invite">Get invitation code</Link><Button variant="secondary" onClick={() => void revalidate()}>Check pair status</Button></div><div className="pair-cancel"><Button variant="secondary" onClick={() => setOpen(true)}>Cancel pending pair</Button></div></section>
    <Dialog busy={cancel.isPending} open={open} onClose={() => { if (!cancel.isPending) setOpen(false); }} title="Cancel this pair?"><p>The invitation will stop working. You can create or join another pair.</p>{cancel.isError && <Status error>{toAppError(cancel.error).message}</Status>}<Button variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate(pair.pairId)}>{cancel.isError ? 'Retry cancel' : 'Cancel pair'}</Button></Dialog></>;
}
