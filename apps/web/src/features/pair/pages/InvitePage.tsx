import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { createInvite } from '..';
import { useSession } from '../../../app/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';

export function InvitePage() {
  const { pair } = useSession();
  const [status, setStatus] = useState('');
  const invite = useMutation({ mutationFn: createInvite, onMutate: () => setStatus('') });
  const token = invite.data?.token ?? '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(location.origin + '/invite?token=' + token);
      setStatus('Invitation link copied.');
    } catch { setStatus('Copy the code above and send it to your partner.'); }
  }

  if (pair?.status !== 'pending') return null;
  return <section className="card form-page">
    <PageHeader title="Invite your partner" description="Only your partner should use this code. New codes replace earlier invitations." />
    {token && !invite.isPending && <>
      <p className="invite-code" aria-label="Your invitation code">{token}</p>
      <p className="muted">Expires {new Date(invite.data!.expiresAt).toLocaleString()}</p>
      <Button onClick={() => void copy()}>Copy invitation link</Button>
    </>}
    {invite.isSuccess && !token && <Status>The code was already delivered. Create a new invitation code to replace it.</Status>}
    <Button variant={token ? 'secondary' : 'primary'} disabled={invite.isPending} onClick={() => invite.mutate(pair.pairId)}>
      {invite.isPending ? 'Creating invitation…' : invite.isError ? 'Retry invitation code' : token ? 'Replace invitation code' : 'Create invitation code'}
    </Button>
    {invite.isError && <Status error>{toAppError(invite.error).message}</Status>}
    {status && <Status>{status}</Status>}
    <Link to="/pair/waiting">Waiting for your partner</Link>
  </section>;
}
