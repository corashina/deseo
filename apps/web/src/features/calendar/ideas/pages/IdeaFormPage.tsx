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
import { finePointer } from '../../../../lib/pointer';
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
const fields = (idea: DateIdea): Fields => ({ title: idea.title, note: idea.note, link: idea.link });
export function IdeaFormPage() {
  const { ideaId } = useParams();
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({ queryKey: ideaKeys.detail(account!.id, pairId, ideaId ?? 'new'), queryFn: () => getDateIdea(pairId, ideaId!), enabled: Boolean(ideaId) });
  if (ideaId && query.isPending)
    return <Status>Loading idea…</Status>;
  if (query.isError)
    return <RouteErrorPage title="Idea" returnTo="/ideas" returnLabel="Return to ideas" error={query.error} onRetry={() => void query.refetch()} />;
  if (ideaId && !query.data)
    return <RouteErrorPage title="Idea" returnTo="/ideas" returnLabel="Return to ideas" />;
  return <IdeaEditor key={ideaId ?? 'new'} idea={query.data ?? undefined} />;
}
function IdeaEditor({ idea }: {
  idea?: DateIdea;
}) {
  const { account, pair } = useSession();
  const navigate = useNavigate();
  if (!account || pair?.status !== 'active')
    throw new Error('Active pair required');
  const [id] = useState(() => idea?.id ?? crypto.randomUUID());
  // Keep the version the draft started from. A concurrent edit then fails with CONFLICT.
  const [version, setVersion] = useState(idea?.version);
  const command = useCommandId();
  const form = useForm<Fields>({ resolver: zodResolver(ideaFieldsSchema), defaultValues: idea ? fields(idea) : { title: '', note: '', link: '' } });
  const save = useMutation({ mutationFn: (values: Fields) => {
    const input: IdeaInput = { ...values, id, pairId: pair.pairId };
    const commandId = command.idFor({ input, version });
    return idea ? updateIdea(input, version!, commandId) : createIdea(input, commandId);
  }, onSuccess: () => command.reset() });
  const reload = useMutation({
    mutationFn: async () => {
      const current = await getDateIdea(pair.pairId, idea!.id);
      if (!current) throw new AppError({ code: 'FORBIDDEN', message: 'Idea unavailable.' });
      form.reset(fields(current));
      setVersion(current.version);
    },
    onSuccess: () => save.reset(),
  });
  const failure = save.isError ? toAppError(save.error) : null;
  const conflict = failure?.code === 'CONFLICT';
  const error = reload.isError ? toAppError(reload.error).message : conflict ? 'This idea changed. Your draft is kept.' : failure?.message ?? '';
  const saving = save.isPending || reload.isPending;
  useUnsavedChanges(!save.isSuccess && form.formState.isDirty);
  useEffect(() => {
    if (save.isSuccess)
      navigate('/ideas/' + id, { replace: true });
  }, [save.isSuccess, navigate, id]);
  return <>
    <PageHeader title={idea ? 'Edit idea' : 'Add idea'} description="Keep a note and an optional HTTPS link." />
    <section className="card form-page">
      <form onSubmit={form.handleSubmit(values => save.mutate(values))}>
        <fieldset disabled={saving}>
          <label className="field">
            <span>Title</span>
            <input {...form.register('title')} autoComplete="off" maxLength={120} required autoFocus={finePointer} />
          </label>
          <label className="field">
            <span>Note</span>
            <textarea {...form.register('note')} autoComplete="off" maxLength={1000} rows={4} />
          </label>
          <label className="field">
            <span>Link</span>
            <input {...form.register('link')} type="text" inputMode="url" autoComplete="off" spellCheck={false} maxLength={2048} />
          </label>
          {Object.entries(form.formState.errors).map(([field, error]) => <p role="alert" key={field}>{error.message}
          </p>)}
        </fieldset>
        {error && <Status error>{error}
        </Status>}
        {conflict && <Button disabled={saving} variant="secondary" type="button" onClick={() => reload.mutate()}>Reload idea and discard draft</Button>}
        <div className="actions">
          <Button type="submit" disabled={saving || conflict}>{saving ? 'Saving…' : failure ? 'Retry save' : idea ? 'Save changes' : 'Save idea'}
          </Button>
          <Link to="/ideas">Cancel</Link>
        </div>
      </form>
    </section>
  </>;
}
