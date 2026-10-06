import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { NotificationPreferences } from '@deseo/domain/notifications';
import { useSession } from '../../../app/SessionProvider';
import { captureQueryScope } from '../../../lib/query-client';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { useNetworkStatus } from '../../../lib/network';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Status } from '../../../components/ui/Status';
import { getNotificationPreferences, notificationKeys } from '../queries';
import { saveNotificationPreferences } from '../commands';
type Draft = { input: NotificationPreferences; attempt: NotificationPreferences | null };
export function PreferencesPage() {
  const { account, pair } = useSession();
  const pairId = pair && 'pairId' in pair ? pair.pairId : null;
  const query = useQuery({ queryKey: notificationKeys.preferences(account!.id), queryFn: getNotificationPreferences });
  const online = useNetworkStatus(); const mounted = useRef(false);
  const pending = useRef(false); const scopeCleanup = useRef<() => void>(undefined);
  const [draft, setDraft] = useState(() => readDraft<Draft>(account!.id, pairId, 'preferences'));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [conflict, setConflict] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; scopeCleanup.current?.(); }; }, []);
  function beginScope() {
    scopeCleanup.current?.();
    const scope = captureQueryScope();
    const unlock = () => { if (mounted.current) { pending.current = false; setBusy(false); } };
    scope.signal.addEventListener('abort', unlock, { once: true });
    scopeCleanup.current = () => scope.signal.removeEventListener('abort', unlock);
    return scope;
  }
  useUnsavedChanges(Boolean(draft));
  const input = draft?.input ?? query.data;
  function change(values: Partial<NotificationPreferences>) {
    if (!input) return;
    const next = { input: { ...input, ...values }, attempt: null };
    writeDraft(account!.id, pairId, 'preferences', next); setDraft(next); setMessage('');
  }
  async function save() {
    if (!input || !online || pending.current || conflict) return;
    const scope = beginScope(); pending.current = true;
    const attempt = draft?.attempt ?? { ...input };
    const next = { input: { ...input }, attempt };
    writeDraft(account!.id, pairId, 'preferences', next); setDraft(next); setBusy(true); setMessage('');
    // The versioned command has no receipt. Reconcile a lost response before resending.
    try {
      if (draft?.attempt) {
        const current = await getNotificationPreferences(); scope.assertCurrent();
        if (!mounted.current) return;
        const expected = { ...attempt, version: current.version };
        if (current.version > attempt.version && JSON.stringify(current) === JSON.stringify(expected)) {
          removeDraft(account!.id, pairId, 'preferences'); setDraft(undefined); setMessage('Preferences saved.'); await query.refetch(); return;
        }
      }
      const result = await saveNotificationPreferences(attempt); scope.assertCurrent();
      if (!mounted.current) return;
      if (result.ok) { removeDraft(account!.id, pairId, 'preferences'); setDraft(undefined); setMessage('Preferences saved.'); await query.refetch(); }
      else {
        setMessage(result.error.code === 'CONFLICT' ? 'Your preferences changed. Your draft is kept.' : result.error.message ?? 'Preferences save failed. Retry.');
        if (result.error.code !== 'RETRYABLE') { const rejected = { input: next.input, attempt: null }; writeDraft(account!.id, pairId, 'preferences', rejected); setDraft(rejected); }
        setConflict(result.error.code === 'CONFLICT');
      }
    } catch { if (mounted.current && !scope.signal.aborted) setMessage('Preferences save is unconfirmed. Retry the same changes.'); }
    finally { if (mounted.current && !scope.signal.aborted) { pending.current = false; setBusy(false); } }
  }
  return <section className="card form-page"><PageHeader title="Notification preferences" description="Choose your alerts and quiet hours." />
    {query.isPending && !input ? <Status>Loading preferences…</Status> : query.isError && !input ? <><Status error>We could not load preferences.</Status><Button onClick={() => void query.refetch()}>Retry</Button></> : input && <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset className="field-group" disabled={busy || Boolean(draft?.attempt) || conflict}>
      <label className="field field-check"><span><input type="checkbox" checked={input.messageAlerts} onChange={event => change({ messageAlerts: event.target.checked })} /> Message alerts</span></label>
      <label className="field"><span>Default event reminder</span><select value={input.defaultEventReminderMinutes ?? 'none'} onChange={event => change({ defaultEventReminderMinutes: event.target.value === 'none' ? null : Number(event.target.value) })}>
        <option value="none">None</option><option value="15">15 minutes before</option><option value="60">One hour before</option><option value="1440">One day before</option>
      </select></label><p className="muted">This default applies to new events. Open an event to change its reminder.</p>
      <label className="field field-check"><span><input type="checkbox" checked={input.quietStart !== null} onChange={event => change({ quietStart: event.target.checked ? '22:00' : null, quietEnd: event.target.checked ? '07:00' : null })} /> Quiet hours</span></label>
      {input.quietStart !== null && <><Field label="Quiet hours start" type="time" required value={input.quietStart} onChange={event => change({ quietStart: event.target.value })} /><Field label="Quiet hours end" type="time" required value={input.quietEnd ?? ''} onChange={event => change({ quietEnd: event.target.value })} /></>}
      <Field label="Notification timezone" required value={input.timezone} onChange={event => change({ timezone: event.target.value })} />
      </fieldset><p>Quiet hours defer native push alerts. Event alerts expire when the event starts.</p>
      <h2>Native push</h2><p>Manage device permission in the Deseo Android or iOS app.</p><p className="muted">This browser receives no push alerts.</p>
      {message && <Status error={conflict}>{message}</Status>}
      {conflict && <Button variant="secondary" onClick={async () => { const fresh = await query.refetch(); if (!mounted.current || fresh.isError) return; removeDraft(account!.id, pairId, 'preferences'); setDraft(undefined); setConflict(false); setMessage(''); }}>Discard changes and reload</Button>}
      <Button type="submit" disabled={!online || busy || conflict}>{draft?.attempt ? 'Retry preferences' : 'Save preferences'}</Button>
    </form>}<Link to="/settings">Return to settings</Link></section>;
}
