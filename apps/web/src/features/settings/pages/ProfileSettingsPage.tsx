import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProfileInput } from '@deseo/domain/auth';
import { useSession } from '../../../app/SessionProvider';
import { saveProfile, restoreSession } from '../../auth';
import { captureQueryScope } from '../../../lib/query-client';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { useNetworkStatus } from '../../../lib/network';
import { Field } from '../../../components/ui/Field';
import { TimezoneField } from '../../../components/ui/TimezoneField';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
type Draft = { input: ProfileInput; version: number; uncertain: boolean };
export function ProfileSettingsPage() {
  const { account, pair, revalidate } = useSession();
  const pairId = pair && 'pairId' in pair ? pair.pairId : null;
  const [draft, setDraft] = useState(() => readDraft<Draft>(account!.id, pairId, 'profile-settings'));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [conflict, setConflict] = useState(false);
  const mounted = useRef(false); const online = useNetworkStatus();
  const pending = useRef(false); const scopeCleanup = useRef<() => void>(undefined);
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
  const input = draft?.input ?? { displayName: account!.displayName, timezone: account!.timezone, locale: account!.locale };
  function change(values: Partial<ProfileInput>) {
    const next = { input: { ...input, ...values }, version: draft?.version ?? account!.version, uncertain: false };
    writeDraft(account!.id, pairId, 'profile-settings', next); setDraft(next); setMessage('');
  }
  async function save() {
    if (!online || pending.current || conflict) return;
    const scope = beginScope(); pending.current = true;
    const next = draft ?? { input: { ...input }, version: account!.version, uncertain: false };
    writeDraft(account!.id, pairId, 'profile-settings', { ...next, uncertain: true }); setDraft({ ...next, uncertain: true }); setBusy(true); setMessage('');
    try {
      const current = next.uncertain ? (await restoreSession())?.account : null; scope.assertCurrent();
      if (!mounted.current) return;
      if (current && current.version > next.version && current.displayName === next.input.displayName && current.timezone === next.input.timezone && current.locale === next.input.locale) {
        removeDraft(account!.id, pairId, 'profile-settings'); setDraft(undefined); setMessage('Profile saved.'); await revalidate(); return;
      }
      const result = await saveProfile(next.input, next.version); scope.assertCurrent();
      if (!mounted.current) return;
      if (result.ok) { removeDraft(account!.id, pairId, 'profile-settings'); setDraft(undefined); setMessage('Profile saved.'); await revalidate(); }
      else {
        setMessage(result.error.code === 'CONFLICT' ? 'Your profile changed. Your draft is kept.' : result.error.message ?? 'Profile save failed. Retry.');
        if (result.error.code !== 'RETRYABLE') { const rejected = { ...next, uncertain: false }; writeDraft(account!.id, pairId, 'profile-settings', rejected); setDraft(rejected); }
        setConflict(result.error.code === 'CONFLICT');
      }
    } catch { if (mounted.current && !scope.signal.aborted) setMessage('Profile save is unconfirmed. Retry the same changes.'); }
    finally { if (mounted.current && !scope.signal.aborted) { pending.current = false; setBusy(false); } }
  }
  return <section className="card form-page"><PageHeader title="Profile" description="Your timezone changes display times. Stored events keep their dates and instants." />
    <form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset className="field-group" disabled={busy || Boolean(draft?.uncertain)}>
      <Field label="Your name" required maxLength={40} value={input.displayName} onChange={event => change({ displayName: event.target.value })} />
      <TimezoneField required value={input.timezone} onChange={event => change({ timezone: event.target.value })} />
    </fieldset>{message && <Status error={conflict}>{message}</Status>}
    {conflict && <Button disabled={!online || busy} variant="secondary" onClick={async () => { await revalidate(); if (!mounted.current) return; removeDraft(account!.id, pairId, 'profile-settings'); setDraft(undefined); setConflict(false); setMessage(''); }}>Discard changes and reload</Button>}
    <Button type="submit" disabled={!online || busy || conflict}>{draft?.uncertain ? 'Retry profile' : 'Save profile'}</Button></form><Link to="/settings">Return to settings</Link></section>;
}
