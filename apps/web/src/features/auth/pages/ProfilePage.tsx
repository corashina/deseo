import { isOnline, useNetworkStatus } from '../../../lib/network';
import { useState } from 'react';
import type { ProfileInput } from '@deseo/domain/auth';
import { useCommandScope } from '../../../lib/use-command-scope';
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
  const [initial] = useState(() => readDraft<{ name: string; timezone: string; attempt?: ProfileInput }>(userId!, null, 'profile'));
  const [name, setName] = useState(initial?.name ?? '');
  const [timezone, setTimezone] = useState(initial?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(initial?.attempt);
  const [confirmed, setConfirmed] = useState(false);
  const beginScope = useCommandScope(() => setPending(false));
  useUnsavedChanges(!confirmed && (Boolean(name) || timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone || Boolean(attempt)));
  return <section className="card form-page"><PageHeader title="Set up your profile" description="Choose the name your partner will see." />
    <form onSubmit={async event => { event.preventDefault(); if (!isOnline() || pending) return; const scope = beginScope(); setPending(true); setError('');
      const next = attempt ?? { displayName: name, timezone, locale: 'en' };
      writeDraft(userId!, null, 'profile', { name, timezone, attempt: next }); setAttempt(next);
      const result = await saveProfile(next);
      if (!scope.isCurrent()) return;
      if (result.ok) { removeDraft(userId!, null, 'profile'); setConfirmed(true); await revalidate(); }
      else { setError(result.error.message ?? 'Check your profile.'); setPending(false); if (result.error.code !== 'RETRYABLE') { setAttempt(undefined); writeDraft(userId!, null, 'profile', { name, timezone }); } }
    }}><fieldset disabled={pending || Boolean(attempt)}><Field label="Your name" required maxLength={40} autoComplete="given-name" value={name} onChange={event => { setName(event.target.value); writeDraft(userId!, null, 'profile', { name: event.target.value, timezone }); }} />
    <Field label="Timezone" required value={timezone} onChange={event => { setTimezone(event.target.value); writeDraft(userId!, null, 'profile', { name, timezone: event.target.value }); }} /></fieldset>
    {error && <Status error>{error}</Status>}<Button type="submit" disabled={pending || !online}>{attempt ? 'Retry profile' : 'Save profile'}</Button></form></section>;
}
