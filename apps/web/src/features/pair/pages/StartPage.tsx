import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { createPairWithInvite } from '..';
import { useSession } from '../../../app/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function StartPage() {
  const { account, revalidate } = useSession();
  // A failed invitation still leaves a pending pair. The waiting page then offers a new code.
  const create = useMutation({ mutationFn: () => createPairWithInvite(account!.timezone), onSettled: () => revalidate() });
  return <><PageHeader title="Make space for two" description="Invite your partner or join their pair with an invitation code." /><div className="pair-grid"><section className="card"><h2>Invite your partner</h2><p>Get a private code to send to your partner.</p><Button disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Creating invitation…' : create.isError ? 'Retry invitation' : 'Invite your partner'}</Button>{create.isError && <Status error>{toAppError(create.error).message}</Status>}</section><section className="card"><h2>Have an invitation?</h2><p>Use the code your partner sent you.</p><Link className="button secondary" to="/pair/join">Join a pair</Link></section></div></>;
}
