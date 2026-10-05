import { isOnline, useNetworkStatus } from '../../../lib/network';
import { useState } from 'react';
import { saveProfile } from '..';
import { useSession } from '../../../app/SessionProvider';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function ProfilePage() {
  const online = useNetworkStatus();
  const { revalidate, userId } = useSession();
  const [initial] = useState(() => readDraft<{ name: string; timezone: string }>(userId!, null, 'profile'));
  const [name, setName] = useState(initial?.name ?? '');
  const [timezone, setTimezone] = useState(initial?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useUnsavedChanges(Boolean(name) && !pending);
  return <section className="card form-page"><PageHeader title="Set up your profile" description="Choose the name your partner will see." />
    <form onSubmit={async event => { event.preventDefault(); if (!isOnline() || pending) return; setPending(true); setError('');
      const result = await saveProfile({ displayName: name, timezone, locale: 'en' });
      if (result.ok) { removeDraft(userId!, null, 'profile'); await revalidate(); } else { setError(result.error.message ?? 'Check your profile.'); setPending(false); }
    }}><Field label="Your name" required maxLength={40} autoComplete="given-name" value={name} onChange={event => { setName(event.target.value); writeDraft(userId!, null, 'profile', { name: event.target.value, timezone }); }} />
    <Field label="Timezone" required value={timezone} onChange={event => { setTimezone(event.target.value); writeDraft(userId!, null, 'profile', { name, timezone: event.target.value }); }} />
    {error && <Status error>{error}</Status>}<Button type="submit" disabled={pending || !online}>Save profile</Button></form></section>;
}
