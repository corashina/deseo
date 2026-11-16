import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toAppError } from '@deseo/domain/result';
import { saveProfile } from '..';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function ProfilePage() {
  const { revalidate } = useSession();
  const [name, setName] = useState('');
  // Use the browser timezone. Settings can change it later.
  const save = useMutation({ mutationFn: () => saveProfile({ displayName: name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: 'en' }), onSuccess: () => revalidate() });
  useUnsavedChanges(!save.isSuccess && Boolean(name));
  return <section className="card form-page"><PageHeader title="Set up your profile" description="Choose the name your partner will see." />
    <form onSubmit={event => { event.preventDefault(); if (!save.isPending) save.mutate(); }}><fieldset disabled={save.isPending}><Field label="Your name" name="displayName" required maxLength={40} autoComplete="given-name" value={name} onChange={event => setName(event.target.value)} /></fieldset>
    {save.isError && <Status error>{toAppError(save.error).message}</Status>}<Button variant="primary" type="submit" disabled={save.isPending}>{save.isError ? 'Retry profile' : 'Save profile'}</Button></form></section>;
}
