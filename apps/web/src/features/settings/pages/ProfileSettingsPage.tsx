import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ProfileInput } from '@deseo/domain/auth';
import { toAppError } from '@deseo/domain/result';
import { useSession } from '../../../app/SessionProvider';
import { saveProfile } from '../../auth';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { Field } from '../../../components/ui/Field';
import { TimezoneField } from '../../../components/ui/TimezoneField';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
type Draft = { input: ProfileInput; version: number };
export function ProfileSettingsPage() {
  const { account, revalidate } = useSession();
  // Keep the version the draft started from. A concurrent edit then fails with CONFLICT.
  const [draft, setDraft] = useState<Draft>();
  const input = draft?.input ?? { displayName: account!.displayName, timezone: account!.timezone, locale: account!.locale };
  const save = useMutation({ mutationFn: (next: Draft) => saveProfile(next.input, next.version), onSuccess: async () => { setDraft(undefined); await revalidate(); } });
  const discard = useMutation({ mutationFn: revalidate, onSuccess: () => { setDraft(undefined); save.reset(); } });
  useUnsavedChanges(Boolean(draft));
  function change(values: Partial<ProfileInput>) {
    setDraft({ input: { ...input, ...values }, version: draft?.version ?? account!.version }); save.reset();
  }
  const conflict = save.isError && toAppError(save.error).code === 'CONFLICT';
  const busy = save.isPending || discard.isPending;
  const message = save.isSuccess ? 'Profile saved.' : conflict ? 'Your profile changed. Your draft is kept.' : save.isError ? toAppError(save.error).message : '';
  return <section className="card form-page"><PageHeader title="Profile" description="Your timezone changes display times. Stored events keep their dates and instants." />
    <form onSubmit={event => { event.preventDefault(); if (!busy) save.mutate(draft ?? { input, version: account!.version }); }}><fieldset className="field-group" disabled={busy}>
      <Field label="Your name" name="displayName" required maxLength={40} value={input.displayName} onChange={event => change({ displayName: event.target.value })} />
      <TimezoneField required value={input.timezone} onChange={event => change({ timezone: event.target.value })} />
    </fieldset>{message && <Status error={save.isError}>{message}</Status>}
    <div className="actions">{conflict && <Button disabled={busy} variant="secondary" onClick={() => discard.mutate()}>Discard changes and reload</Button>}
    <Button type="submit" disabled={busy || conflict}>{save.isError ? 'Retry profile' : 'Save profile'}</Button></div></form><Link to="/settings">Return to settings</Link></section>;
}
