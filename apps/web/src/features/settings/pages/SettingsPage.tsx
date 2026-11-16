import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ProfileInput } from '@deseo/domain/auth';
import { AppError, toAppError } from '@deseo/domain/result';
import { useSession } from '../../../app/SessionProvider';
import { requestVerificationCode, saveProfile, signOut, withFreshSignIn } from '../../auth';
import { endPair } from '../../pair';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { TimezoneField } from '../../../components/ui/TimezoneField';
import '../../../styles/settings.css';

export function SettingsPage() {
  const { account, pair } = useSession();
  return <><PageHeader title="Settings" description="Manage your profile, pair, and account." />
    <div className="card form-page settings-page">
      <ProfileSection />
      <section className="settings-section" aria-labelledby="settings-pair"><h2 id="settings-pair">Your pair</h2>
        {pair?.status === 'active' ? <><div className="paired-members">{pair.members.map(member => <div key={member.userId}><Avatar name={member.displayName} slot={member.slot} /><h3>{member.displayName}</h3><p>{member.userId === account!.id ? 'You' : 'Your partner'}</p></div>)}</div>
          <p>Pair timezone: <span translate="no">{pair.timezone}</span></p></>
          : <><p>{pair?.status === 'ended' ? 'Your pair has ended. Shared content is unavailable.' : 'You have no active pair.'}</p><Link to="/pair/start">Set up your pair</Link></>}
      </section>
      <AccountSection />
      {pair?.status === 'active' && <EndPairSection pairId={pair.pairId} />}
    </div></>;
}

type Draft = { input: ProfileInput; version: number };
function ProfileSection() {
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
  return <section aria-labelledby="settings-profile"><h2 id="settings-profile">Profile</h2>
    <p className="muted">Your timezone changes display times. Stored events keep their dates and instants.</p>
    <form onSubmit={event => { event.preventDefault(); if (!busy) save.mutate(draft ?? { input, version: account!.version }); }}><fieldset className="field-group" disabled={busy}>
      <Field label="Your name" name="displayName" required maxLength={40} value={input.displayName} onChange={event => change({ displayName: event.target.value })} />
      <TimezoneField required value={input.timezone} onChange={event => change({ timezone: event.target.value })} />
    </fieldset>{message && <Status error={save.isError}>{message}</Status>}
    <div className="actions">{conflict && <Button disabled={busy} variant="secondary" onClick={() => discard.mutate()}>Discard changes and reload</Button>}
    <Button type="submit" disabled={busy || conflict}>{save.isError ? 'Retry profile' : 'Save profile'}</Button></div></form>
  </section>;
}

function AccountSection() {
  const leave = useMutation({ mutationFn: signOut });
  return <section className="settings-section" aria-labelledby="settings-account"><h2 id="settings-account">Account</h2>
    <p>Signing out clears private content and unsent changes from this browser.</p>
    {leave.isError && <Status error>Sign-out failed. Try again.</Status>}
    <div className="actions"><Button disabled={leave.isPending} onClick={() => leave.mutate('local')}>Sign out on this browser</Button>
    <Button variant="secondary" disabled={leave.isPending} onClick={() => leave.mutate('global')}>Sign out on all devices</Button></div>
  </section>;
}

function EndPairSection({ pairId }: { pairId: string }) {
  const { revalidate } = useSession();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  // One code per visit: the email service limits how often it sends a code. Send a new code asks again.
  // Keep the command ID once the code is accepted. A retry reuses it, so the server replays the result.
  const [attempt, setAttempt] = useState<{ pairId: string; commandId: string }>();
  const send = useMutation({ mutationFn: requestVerificationCode, onSuccess: () => { setCode(''); setCodeError(''); setOpen(true); } });
  const disconnect = useMutation({
    mutationFn: async () => {
      if (attempt) return endPair(attempt.pairId, attempt.commandId);
      const next = { pairId, commandId: crypto.randomUUID() };
      return withFreshSignIn(code, client => { setAttempt(next); setCode(''); return endPair(next.pairId, next.commandId, client); }).catch((error: unknown) => {
        const failure = toAppError(error);
        throw failure.code === 'VALIDATION' ? new AppError({ code: 'VALIDATION', message: 'The code is invalid or expired. Request a new code.' }) : failure;
      });
    },
    onSuccess: async () => { setOpen(false); setAttempt(undefined); await revalidate(); },
    onError: error => { if (toAppError(error).code !== 'RETRYABLE') setAttempt(undefined); },
  });
  useUnsavedChanges(Boolean(code) || Boolean(attempt));
  const busy = send.isPending || disconnect.isPending;
  const error = disconnect.isError ? toAppError(disconnect.error).message : send.isError ? toAppError(send.error).message : '';
  return <section className="settings-section" aria-labelledby="settings-end-pair"><h2 id="settings-end-pair">End this pair</h2>
    <p>Either person can end this pair. Both people lose shared access. Your next pair starts empty.</p>
    {attempt ? <Button variant="danger" disabled={busy} onClick={() => disconnect.mutate()}>Retry ending pair</Button>
      : <Button variant="danger" disabled={busy} onClick={() => { if (send.isSuccess) setOpen(true); else send.mutate(); }}>{send.isPending ? 'Sending code…' : 'End pair'}</Button>}
    {error && !open && <Status error>{error}</Status>}
    <Dialog busy={busy} title="End this pair?" open={open} onClose={() => { if (!busy) setOpen(false); }}>
      <p>Both people lose shared access. This cannot be undone. Enter the code from your email.</p>
      <Field label="Email verification code" name="code" spellCheck={false} disabled={busy} inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} error={codeError} onChange={event => { setCodeError(''); setCode(event.target.value); }} />
      {error && <Status error>{error}</Status>}
      <div className="actions"><Button variant="danger" disabled={busy} onClick={() => { if (/^\d{6}$/.test(code)) disconnect.mutate(); else setCodeError('Enter the 6-digit code from your email.'); }}>Confirm ending pair</Button>
      <Button variant="secondary" disabled={busy} onClick={() => send.mutate()}>Send a new code</Button></div>
    </Dialog>
  </section>;
}
