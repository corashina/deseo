import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toAppError } from '@deseo/domain/result';
import { saveProfile, signOut } from '..';
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
  // The text is English, so dates use the first English browser language, such as en-GB. Then the order and clock match the person.
  const locale = navigator.languages.find(tag => /^en(-|$)/i.test(tag)) ?? 'en';
  const save = useMutation({ mutationFn: () => saveProfile({ displayName: name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale }), onSuccess: () => revalidate() });
  useUnsavedChanges(!save.isSuccess && Boolean(name));
  return <section className="card form-page centered-card"><PageHeader title="Set up your profile" description="Choose the name your partner will see." />
    <form onSubmit={event => { event.preventDefault(); if (!save.isPending) save.mutate(); }}><fieldset disabled={save.isPending}><Field label="Your name" name="displayName" required maxLength={40} autoComplete="given-name" value={name} onChange={event => setName(event.target.value)} /></fieldset>
    {save.isError && <Status error>{toAppError(save.error).message}</Status>}<Button variant="primary" type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : save.isError ? 'Retry profile' : 'Save profile'}</Button></form>
    <Button variant="text" disabled={save.isPending} onClick={() => void signOut()}>Sign out</Button></section>;
}
