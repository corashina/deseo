import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toAppError } from '@deseo/domain/result';
import { Link } from 'react-router-dom';
import type { NotificationPreferences } from '@deseo/domain/notifications';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Status } from '../../../components/ui/Status';
import { getNotificationPreferences, notificationKeys } from '../queries';
import { saveNotificationPreferences } from '../commands';
import '../../../styles/notifications.css';
export function PreferencesPage() {
  const { account } = useSession();
  const query = useQuery({ queryKey: notificationKeys.preferences(account!.id), queryFn: getNotificationPreferences });
  const [draft, setDraft] = useState<NotificationPreferences>();
  const input = draft ?? query.data;
  const save = useMutation({ mutationFn: saveNotificationPreferences, onSuccess: async () => { setDraft(undefined); await query.refetch(); } });
  const discard = useMutation({ mutationFn: () => query.refetch({ throwOnError: true }), onSuccess: () => { setDraft(undefined); save.reset(); } });
  useUnsavedChanges(Boolean(draft));
  function change(values: Partial<NotificationPreferences>) {
    if (!input) return;
    setDraft({ ...input, ...values }); save.reset();
  }
  const conflict = save.isError && toAppError(save.error).code === 'CONFLICT';
  const busy = save.isPending || discard.isPending;
  const message = save.isSuccess ? 'Preferences saved.' : conflict ? 'Your preferences changed. Your draft is kept.' : save.isError ? toAppError(save.error).message : '';
  return <><PageHeader title="Notification preferences" description="Choose your alerts and quiet hours." /><section className="card form-page">
    {query.isPending && !input ? <Status>Loading preferences…</Status> : query.isError && !input ? <><Status error>We could not load preferences.</Status><Button onClick={() => void query.refetch()}>Retry</Button></> : input && <form onSubmit={event => { event.preventDefault(); if (input && !busy) save.mutate(input); }}>
      <fieldset className="field-group" disabled={busy}>
      <h2>Alerts</h2>
      <label className="field field-check"><span><input type="checkbox" checked={input.messageAlerts} onChange={event => change({ messageAlerts: event.target.checked })} /> Message alerts</span></label>
      <label className="field"><span>Default event reminder</span><select value={input.defaultEventReminderMinutes ?? 'none'} onChange={event => change({ defaultEventReminderMinutes: event.target.value === 'none' ? null : Number(event.target.value) })}>
        <option value="none">None</option><option value="15">15 minutes before</option><option value="60">One hour before</option><option value="1440">One day before</option>
      </select></label><p className="muted">This default applies to new events. Open an event to change its reminder.</p>
      <div className="preferences-group"><h2>Quiet hours</h2>
      <label className="field field-check"><span><input type="checkbox" checked={input.quietStart !== null} onChange={event => change({ quietStart: event.target.checked ? '22:00' : null, quietEnd: event.target.checked ? '07:00' : null })} /> Quiet hours</span></label>
      {input.quietStart !== null && <div className="preferences-times"><Field label="Quiet hours start" type="time" required value={input.quietStart} onChange={event => change({ quietStart: event.target.value })} /><Field label="Quiet hours end" type="time" required value={input.quietEnd ?? ''} onChange={event => change({ quietEnd: event.target.value })} /></div>}
      <Field label="Notification timezone" required value={input.timezone} onChange={event => change({ timezone: event.target.value })} />
      <p className="muted">Quiet hours defer native push alerts. Event alerts expire when the event starts.</p></div></fieldset>
      <div className="preferences-group"><h2>Device permission</h2><p>Manage device permission in the Deseo Android or iOS app.</p><p className="muted">This browser receives no push alerts.</p></div>
      {message && <Status error={save.isError}>{message}</Status>}
      {conflict && <Button disabled={busy} variant="secondary" onClick={() => discard.mutate()}>Discard changes and reload</Button>}
      <Button type="submit" disabled={busy || conflict}>{save.isError ? 'Retry preferences' : 'Save preferences'}</Button>
    </form>}<Link to="/settings">Return to settings</Link></section></>;
}
