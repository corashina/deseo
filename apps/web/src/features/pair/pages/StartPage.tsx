import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { createPairWithInvite } from '..';
import { useSession } from '../../../app/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function StartPage() {
  const { revalidate } = useSession();
  // A failed invitation still leaves a pending pair. The waiting page then offers a new code.
  const create = useMutation({ mutationFn: () => createPairWithInvite(), onSettled: () => revalidate() });
  return <section className="card form-page centered-card"><PageHeader title="Make space for two" description="Invite your partner, or join their pair with their code." />
    <div className="pair-options">
      <section><h2>Start a pair</h2><p>Get a private code to send to your partner.</p><Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Creating invitation…' : create.isError ? 'Retry invitation' : 'Invite your partner'}</Button>{create.isError && <Status error>{toAppError(create.error).message}</Status>}</section>
      <section><h2>Have an invitation?</h2><p>Use the code or link your partner sent you.</p><Link className="button secondary" to="/pair/join">Enter invitation</Link></section>
    </div></section>;
}
