import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { inviteTokenSchema, setPendingInvite } from '../../../lib/links';

export function InviteScreen({ token }: { token: string | undefined }) {
  const [error, setError] = useState(false);
  useEffect(() => {
    const parsed = inviteTokenSchema.safeParse(token);
    if (!parsed.success) { setError(true); return; }
    void setPendingInvite(parsed.data).then(() => router.replace('/')).catch(() => setError(true));
  }, [token]);
  return <Screen title="Your invitation"><Status message={error ? 'We could not open this invitation. Check the code or request a new one.' : 'Opening your invitation…'}
    actionLabel={error ? 'Continue' : undefined} onAction={error ? () => router.replace('/') : undefined} /></Screen>;
}
