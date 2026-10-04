import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { captureQueryScope } from '../../../lib/query-client';
import { registerDraftFlush } from '../../../lib/draft-lifecycle';
import type { CommandError } from '../../../lib/result';
import { useCore } from '../../pair';
import { CalendarAccess } from '../CalendarAccess';
import { createIdea, getDateIdea, ideaInputSchema, ideaKeys, updateIdea, type DateIdea, type IdeaInput } from '../date-ideas';
import { readIdeaDraft, writeIdeaDraft, removeIdeaDraft, type IdeaDraft } from '../idea-drafts';
import { useCalendarSignals } from '../realtime';

export function IdeaFormScreen({ ideaId }: { ideaId?: string }) { return <CalendarAccess><Entry ideaId={ideaId} /></CalendarAccess>; }
function Entry({ ideaId }: { ideaId?: string }) {
  const core = useCore(); const pairId = core.pair.status === 'active' ? core.pair.pairId : '';
  useCalendarSignals(core.account.id, pairId, core.refresh);
  const query = useQuery({ queryKey: ideaKeys.detail(core.account.id, pairId, ideaId ?? 'new'), queryFn: () => getDateIdea(pairId, ideaId!), enabled: !!ideaId });
  if (ideaId && query.isPending) return <Screen title="Idea"><Status message="Loading your idea…" /></Screen>;
  if (ideaId && query.isError) return <Screen title="Idea"><Status message="We could not load this idea." tone="error" actionLabel="Retry" onAction={() => { void query.refetch(); }} /></Screen>;
  if (ideaId && !query.data) return <Screen title="Idea"><Status message="This idea is unavailable." /></Screen>;
  return <IdeaForm key={`${core.account.id}:${pairId}:${ideaId ?? 'new'}`} pairId={pairId} idea={ideaId ? query.data! : undefined} reload={() => query.refetch()} />;
}
function valuesFor(idea: DateIdea) { return { title: idea.title, note: idea.note, link: idea.link }; }
function IdeaForm({ pairId, idea, reload }: { pairId: string; idea?: DateIdea; reload(): Promise<{ data?: DateIdea | null }> }) {
  const core = useCore(); const router = useRouter(); const key = `calendar:idea:${idea?.id ?? 'new'}`;
  const [identity] = useState(() => ({ id: idea?.id ?? randomUUID(), commandId: randomUUID(), expectedVersion: idea?.version }));
  const reference = useRef(identity); const submission = useRef<IdeaInput | undefined>(undefined); const preserved = useRef<IdeaDraft['values'] | undefined>(undefined);
  const busy = useRef(false); const complete = useRef(false);
  const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false); const [frozen, setFrozen] = useState(false);
  const [canRestore, setCanRestore] = useState(false); const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<CommandError | null>(null); const [storageError, setStorageError] = useState<string | null>(null);
  const form = useForm<IdeaDraft['values']>({ defaultValues: idea ? valuesFor(idea) : { title: '', note: '', link: '' } });
  const persist = async () => writeIdeaDraft(core.account.id, pairId, key, { ...reference.current, values: form.getValues(), submission: submission.current, preservedValues: preserved.current });
  useEffect(() => {
    let active = true; const scope = captureQueryScope();
    void readIdeaDraft(core.account.id, pairId, key).then(draft => {
      scope.assertCurrent(); if (!active) return;
      if (draft) {
        if (idea && (draft.id !== idea.id || draft.expectedVersion === undefined)) throw new Error('The draft identity changed.');
        reference.current = { id: draft.id, commandId: draft.commandId, expectedVersion: draft.expectedVersion };
        form.reset(draft.values); submission.current = draft.submission; setFrozen(!!draft.submission);
        preserved.current = draft.preservedValues; setCanRestore(draft.preservedValues !== undefined);
        if (draft.submission) setError({ code: 'RETRYABLE', message: 'Confirm your last save before you change this draft.' });
      }
      setReady(true);
    }).catch(() => { if (active) setStorageError('We could not open your draft. Open this screen again.'); });
    return () => { active = false; };
  }, [core.account.id, pairId, key, form.reset]);
  useEffect(() => {
    if (!ready) return;
    const scope = captureQueryScope(); let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = async () => { if (complete.current) return; scope.assertCurrent(); if (timer) clearTimeout(timer); await persist(); };
    const remove = registerDraftFlush(flush); const listener = form.watch(() => {
      if (complete.current || submission.current) return;
      if (timer) clearTimeout(timer); timer = setTimeout(() => { void flush().catch(() => setStorageError('We could not save your draft. Keep this screen open.')); }, 300);
    });
    return () => { remove(); listener.unsubscribe(); if (timer) clearTimeout(timer); void flush().catch(() => undefined); };
  }, [ready, core.account.id, pairId, key, form.watch]);
  const submit = async (input: IdeaInput) => {
    if (busy.current || !core.online || !ready) return;
    const scope = captureQueryScope(); busy.current = true; setSaving(true); setError(null); submission.current = input; setFrozen(true);
    try {
      await persist(); scope.assertCurrent();
      const result = idea ? await updateIdea(input.id, input, reference.current.expectedVersion!, reference.current.commandId) : await createIdea(input, reference.current.commandId);
      scope.assertCurrent();
      if (result.ok) {
        complete.current = true; setSavedId(result.data.id); await removeIdeaDraft(core.account.id, pairId, key); scope.assertCurrent();
        router.replace({ pathname: '/ideas/[ideaId]', params: { ideaId: result.data.id } });
      } else {
        setError(result.error);
        if (result.error.code !== 'RETRYABLE') { submission.current = undefined; reference.current.commandId = randomUUID(); setFrozen(false); await persist(); }
      }
    } catch { try { scope.assertCurrent(); setStorageError(complete.current ? 'We saved your idea. We could not remove its local draft.' : 'We could not save your draft. Keep this screen open.'); } catch { /* The gate owns recovery. */ } }
    finally { busy.current = false; try { scope.assertCurrent(); setSaving(false); } catch { /* The gate owns recovery. */ } }
  };
  const save = () => {
    const input = ideaInputSchema.safeParse({ ...form.getValues(), id: reference.current.id, pairId });
    if (!input.success) { setError({ code: 'VALIDATION', message: input.error.issues[0]?.message ?? 'Check the entered values.' }); return; }
    void submit(input.data);
  };
  const reloadSaved = async () => {
    const scope = captureQueryScope(); preserved.current = form.getValues(); const result = await reload();
    try {
      scope.assertCurrent(); if (!result.data) { setError({ code: 'FORBIDDEN', message: 'This idea is unavailable.' }); return; }
      reference.current.expectedVersion = result.data.version; reference.current.commandId = randomUUID(); submission.current = undefined;
      form.reset(valuesFor(result.data)); setError(null); setFrozen(false); setCanRestore(true); await persist();
    } catch { setStorageError('We could not save your draft. Keep this screen open.'); }
  };
  if (savedId) return <Screen title="Idea saved"><Status message={storageError ?? 'We saved your idea.'} /><Button label="Open idea" onPress={() => router.replace({ pathname: '/ideas/[ideaId]', params: { ideaId: savedId } })} /></Screen>;
  return <Screen title={idea ? 'Edit idea' : 'Add idea'}>
    {!core.online && <Status message="You are offline. You can keep a draft on this device." />}
    {storageError && <Status tone="error" message={storageError} />}
    {error && <Status tone="error" message={error.code === 'CONFLICT' ? 'Your partner changed this idea. Your draft is on this device.' : error.message ?? 'We could not save this idea.'}
      actionLabel={error.code === 'CONFLICT' ? 'Reload saved version' : frozen ? 'Retry save' : undefined}
      onAction={error.code === 'CONFLICT' ? () => { void reloadSaved(); } : frozen ? () => { if (submission.current) void submit(submission.current); } : undefined} />}
    {error?.code === 'CONFLICT' && <Button label="Return to draft" variant="secondary" onPress={() => setError(null)} />}
    {canRestore && <Status message="Review the saved idea before you save." actionLabel="Restore my draft" onAction={() => {
      if (preserved.current) form.reset(preserved.current); preserved.current = undefined; setCanRestore(false); void persist().catch(() => setStorageError('We could not save your draft. Keep this screen open.'));
    }} />}
    {(['title', 'note', 'link'] as const).map(name => <Controller key={name} control={form.control} name={name} render={({ field }) => <Field label={name === 'title' ? 'Title' : name === 'note' ? 'Note (optional)' : 'HTTPS link (optional)'}
      value={field.value} onChangeText={field.onChange} editable={ready && !saving && !frozen} maxLength={name === 'title' ? 120 : name === 'note' ? 1000 : 2048} multiline={name === 'note'} autoCapitalize={name === 'link' ? 'none' : 'sentences'} />} />)}
    <Button label={frozen ? 'Retry save' : idea ? 'Save changes' : 'Save idea'} loading={saving} disabled={!core.online || !ready || saving || error?.code === 'CONFLICT'} onPress={frozen ? () => { if (submission.current) void submit(submission.current); } : save} />
    <Button label="Back" variant="secondary" disabled={!ready || saving} onPress={() => { const scope = captureQueryScope(); void persist().then(() => { scope.assertCurrent(); router.back(); }).catch(() => setStorageError('We could not save your draft. Keep this screen open.')); }} />
  </Screen>;
}
