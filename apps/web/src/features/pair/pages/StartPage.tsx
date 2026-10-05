import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPair } from '..';
import { useSession } from '../../../app/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function StartPage() {
  const { account, revalidate } = useSession();
  const [commandId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return <><PageHeader title="Make space for two" description="Invite your partner or join their pair with an invitation code." /><div className="pair-grid"><section className="card"><p className="eyebrow">START TOGETHER</p><h2>Invite your partner</h2><p>Create your pair, then share a private invitation.</p><Button disabled={pending} onClick={async () => { setPending(true); setError(''); const result = await createPair(account!.timezone, commandId); if (result.ok) await revalidate(); else { setError(result.error.message ?? 'Try again.'); setPending(false); } }}>Create pair</Button>{error && <Status error>{error}</Status>}</section><section className="card"><h2>Have an invitation?</h2><p>Use the code your partner sent you.</p><Link className="button secondary" to="/pair/join">Join a pair</Link></section></div></>;
}
