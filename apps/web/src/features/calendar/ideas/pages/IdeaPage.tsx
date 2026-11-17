import { RouteErrorPage } from '../../../../app/RouteErrorPage';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppError, toAppError } from '@deseo/domain/result';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ideaFieldsSchema, type DateIdea, type IdeaInput } from '@deseo/domain/calendar';
import { useSession } from '../../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../../lib/unsaved-changes';
import { useCommandId } from '../../../../lib/command-id';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { Button } from '../../../../components/ui/Button';
import { Dialog } from '../../../../components/ui/Dialog';
import { Status } from '../../../../components/ui/Status';
import { Field } from '../../../../components/ui/Field';
import { useReturnTo } from '../../../../lib/return-to';
import { getDateIdea, ideaKeys } from '../queries';
import { archiveIdea, updateIdea } from '../commands';
import '../../../../styles/planning.css';
type Fields = { title: string; note: string; link: string };
const fields = (idea: DateIdea): Fields => ({ title: idea.title, note: idea.note, link: idea.link });
const states = { saved: 'Saved', planned: 'Planned', archived: 'Archived' };
// Opening an idea shows its edit form, with Plan date and Archive idea.
export function IdeaPage() {
  const { ideaId = '' } = useParams();
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({ queryKey: ideaKeys.detail(account!.id, pairId, ideaId), queryFn: () => getDateIdea(pairId, ideaId) });
  if (query.isPending) return <Status>Loading idea…</Status>;
  if (query.isError) return <RouteErrorPage title="Idea" returnTo="/calendar" returnLabel="Return to calendar" error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <RouteErrorPage title="Idea" returnTo="/calendar" returnLabel="Return to calendar" />;
  return <IdeaEditor key={ideaId} idea={query.data} />;
}
function IdeaEditor({ idea }: { idea: DateIdea }) {
  const { pair } = useSession();
  const navigate = useNavigate();
  if (pair?.status !== 'active') throw new Error('Active pair required');
  // Keep the version the draft started from. A concurrent edit then fails with CONFLICT.
  const [version, setVersion] = useState(idea.version);
  const [confirm, setConfirm] = useState(false);
  const command = useCommandId();
  const back = useReturnTo('/calendar');
  const form = useForm<Fields>({ resolver: zodResolver(ideaFieldsSchema), defaultValues: fields(idea) });
  const save = useMutation({ mutationFn: (values: Fields) => {
    const input: IdeaInput = { ...values, id: idea.id, pairId: pair.pairId };
    return updateIdea(input, version, command.idFor({ input, version }));
  }, onSuccess: () => command.reset() });
  const reload = useMutation({
    mutationFn: async () => {
      const current = await getDateIdea(pair.pairId, idea.id);
      if (!current) throw new AppError({ code: 'FORBIDDEN', message: 'Idea unavailable.' });
      form.reset(fields(current));
      setVersion(current.version);
    },
    onSuccess: () => { save.reset(); archive.reset(); },
  });
  const archive = useMutation({ mutationFn: () => archiveIdea(idea.id, version), onSuccess: () => navigate(back), onSettled: () => setConfirm(false) });
  const failure = save.isError ? toAppError(save.error) : archive.isError ? toAppError(archive.error) : null;
  const conflict = failure?.code === 'CONFLICT';
  const error = reload.isError ? toAppError(reload.error).message : conflict ? 'This idea changed. Your draft is kept.' : failure?.message ?? '';
  const saving = save.isPending || reload.isPending || archive.isPending;
  useUnsavedChanges(!save.isSuccess && form.formState.isDirty);
  // Navigate after the save clears the unsaved-changes guard, so no false prompt shows.
  useEffect(() => { if (save.isSuccess) navigate(back, { replace: true }); }, [save.isSuccess, navigate, back]);
  const errors = form.formState.errors;
  const noteError = errors.note?.message;
  return <>
    <PageHeader title="Edit idea" description={idea.state === 'saved' ? undefined : states[idea.state]}
      action={idea.state === 'saved' && <Link className="button primary" to={'/events/new?idea=' + idea.id}>Plan date</Link>} />
    <section className="card form-page">
      <form onSubmit={form.handleSubmit(values => save.mutate(values))}>
        <fieldset disabled={saving}>
          <Field label="Title" {...form.register('title')} maxLength={120} required error={errors.title?.message} />
          <label className="field" htmlFor={idea.id + '-note'}>
            <span>Note</span>
            <textarea id={idea.id + '-note'} {...form.register('note')} autoComplete="off" maxLength={1000} rows={4} aria-invalid={Boolean(noteError)} aria-describedby={noteError ? idea.id + '-note-error' : undefined} />
            {noteError && <span className="field-error" role="alert" id={idea.id + '-note-error'}>{noteError}</span>}
          </label>
          <Field label="Link" {...form.register('link')} type="text" inputMode="url" spellCheck={false} maxLength={2048} hint="Optional. Starts with https://" error={errors.link?.message} />
        </fieldset>
        {idea.linkedEventId && <p><Link to={'/events/' + idea.linkedEventId}>View planned event</Link></p>}
        {error && <Status error>{error}</Status>}
        {conflict && <Button disabled={saving} variant="secondary" type="button" onClick={() => reload.mutate()}>Reload idea and discard draft</Button>}
        <div className="actions">
          <Button variant="primary" type="submit" disabled={saving || conflict}>{save.isPending ? 'Saving…' : save.isError ? 'Retry save' : 'Save changes'}</Button>
          <Link to={back}>Cancel</Link>
        </div>
      </form>
      {idea.state !== 'archived' && <div className="idea-actions"><Button variant="secondary" disabled={saving} onClick={() => setConfirm(true)}>{archive.isError ? 'Retry archive' : 'Archive idea'}</Button></div>}
    </section>
    <Dialog busy={archive.isPending} open={confirm} title="Archive this idea?" onClose={() => setConfirm(false)}>
      <p>The idea leaves your list of date ideas.</p>
      <Button variant="primary" disabled={archive.isPending} onClick={() => archive.mutate()}>Confirm archive</Button>
    </Dialog>
  </>;
}
