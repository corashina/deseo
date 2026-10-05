import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ideaFieldsSchema, type DateIdea, type IdeaInput } from '@deseo/domain/calendar';
import { useSession } from '../../../../app/SessionProvider';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../../lib/drafts';
import { captureQueryScope } from '../../../../lib/query-client';
import { useNetworkStatus } from '../../../../lib/network';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { Button } from '../../../../components/ui/Button';
import { Status } from '../../../../components/ui/Status';
import { getDateIdea, ideaKeys } from '../queries';
import { createIdea, updateIdea } from '../commands';
import '../../../../styles/planning.css';
type Fields = {
  title: string;
  note: string;
  link: string;
};
type Attempt = {
  input: IdeaInput;
  commandId: string;
  expectedVersion?: number;
};
type Draft = {
  values: Fields;
  id: string;
  expectedVersion?: number;
  attempt?: Attempt;
  dirty: boolean;
};
const fields = (idea: DateIdea): Fields => ({ title: idea.title, note: idea.note, link: idea.link });
export function IdeaFormPage() {
  const { ideaId } = useParams();
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({ queryKey: ideaKeys.detail(account!.id, pairId, ideaId ?? 'new'), queryFn: () => getDateIdea(pairId, ideaId!), enabled: Boolean(ideaId) });
  if (ideaId && query.isPending)
    return <Status>Loading idea…</Status>;
  if (query.isError)
    return <>
      <Status error>We could not load this idea.</Status>
      <Button onClick={() => void query.refetch()}>Retry</Button>
    </>;
  if (ideaId && !query.data)
    return <section className="card">
      <h1>Idea unavailable</h1>
      <Link to="/ideas">Return to ideas</Link>
    </section>;
  return <IdeaEditor key={ideaId ?? 'new'} idea={query.data ?? undefined} />;
}
function IdeaEditor({ idea }: {
  idea?: DateIdea;
}) {
  const { account, pair } = useSession();
  const navigate = useNavigate();
  const online = useNetworkStatus();
  if (!account || pair?.status !== 'active')
    throw new Error('Active pair required');
  const key = 'idea:' + (idea?.id ?? 'new');
  const draft = useRef(readDraft<Draft>(account.id, pair.pairId, key));
  const id = useRef(draft.current?.id ?? idea?.id ?? crypto.randomUUID());
  const version = useRef(draft.current?.expectedVersion ?? idea?.version);
  const attempt = useRef(draft.current?.attempt);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [frozen, setFrozen] = useState(Boolean(attempt.current));
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const form = useForm<Fields>({ resolver: zodResolver(ideaFieldsSchema), defaultValues: draft.current?.values ?? (idea ? fields(idea) : { title: '', note: '', link: '' }) });
  useUnsavedChanges(!confirmed && (form.formState.isDirty || draft.current?.dirty === true || frozen));
  useEffect(() => {
    const watch = form.watch(values => writeDraft(account.id, pair.pairId, key, { values, id: id.current, expectedVersion: version.current, attempt: attempt.current, dirty: true }));
    return () => watch.unsubscribe();
  }, [form, account.id, pair.pairId, key]);
  useEffect(() => {
    if (confirmed)
      navigate('/ideas/' + id.current, { replace: true });
  }, [confirmed, navigate]);
  async function save(values: Fields) {
    if (!online || busy.current)
      return;
    const next = attempt.current ?? {
      input: { ...values, id: id.current, pairId: pair!.status === 'active' ? pair!.pairId : '' },
      commandId: crypto.randomUUID(),
      expectedVersion: version.current
    };
    const scope = captureQueryScope();
    attempt.current = next;
    busy.current = true;
    setSaving(true);
    setFrozen(true);
    setError('');
    writeDraft(account!.id, next.input.pairId, key, { values, id: id.current, expectedVersion: version.current, attempt: next, dirty: true });
    const result = idea ? await updateIdea(next.input.id, next.input, next.expectedVersion!, next.commandId) : await createIdea(next.input, next.commandId);
    busy.current = false;
    setSaving(false);
    try {
      scope.assertCurrent();
    }
    catch {
      setError('Your save is unconfirmed. Retry with the same details.');
      return;
    }
    if (result.ok) {
      removeDraft(account!.id, next.input.pairId, key);
      setConfirmed(true);
      return;
    }
    setError(result.error.code === 'CONFLICT' ? 'This idea changed. Your draft is kept.' : result.error.message ?? 'Save failed. Try again.');
    setConflict(result.error.code === 'CONFLICT');
    if (result.error.code !== 'RETRYABLE') {
      attempt.current = undefined;
      setFrozen(false);
      writeDraft(account!.id, next.input.pairId, key, { values, id: id.current, expectedVersion: version.current, dirty: true });
    }
  }
  async function reload() {
    if (saving)
      return;
    setSaving(true);
    try {
      const current = await getDateIdea(pair!.status === 'active' ? pair!.pairId : '', idea!.id);
      if (!current) {
        setError('Idea unavailable.');
        return;
      }
      version.current = current.version;
      attempt.current = undefined;
      draft.current = undefined;
      form.reset(fields(current));
      removeDraft(account!.id, current.pairId, key);
      setConflict(false);
      setError('');
    }
    catch {
      setError('We could not reload this idea. Try again.');
    }
    finally {
      setSaving(false);
    }
  }
  return <>
    <PageHeader title={idea ? 'Edit idea' : 'Add idea'} description="Keep a note and an optional HTTPS link." />
    <section className="card form-page planning-form">
      <form onSubmit={form.handleSubmit(save)}>
        <fieldset disabled={saving || frozen}>
          <label className="field">
            <span>Title</span>
            <input {...form.register('title')} maxLength={120} required autoFocus />
          </label>
          <label className="field">
            <span>Note</span>
            <textarea {...form.register('note')} maxLength={1000} rows={4} />
          </label>
          <label className="field">
            <span>Link</span>
            <input {...form.register('link')} type="text" inputMode="url" maxLength={2048} />
          </label>
          {Object.entries(form.formState.errors).map(([field, error]) => <p role="alert" key={field}>{error.message}
          </p>)}
        </fieldset>
        {error && <Status error>{error}
        </Status>}
        {frozen && <p>Your save is unconfirmed. Retry with the same details.</p>}
        {conflict && <Button variant="secondary" type="button" onClick={() => void reload()}>Reload idea and discard draft</Button>}
        <div className="actions">
          <Button type="submit" disabled={!online || saving || conflict}>{saving ? 'Saving…' : frozen ? 'Retry save' : idea ? 'Save changes' : 'Save idea'}
          </Button>
          <Link to="/ideas">Cancel</Link>
        </div>
      </form>
    </section>
  </>;
}
