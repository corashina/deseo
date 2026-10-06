import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Controller } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { useDraft } from '../../../lib/draft';
import { useCore } from '../../pair';
import { CalendarAccess } from '../CalendarAccess';
import { ideaFieldsSchema, ideaInputSchema, type DateIdea, type IdeaInput } from '@deseo/domain/calendar';
import { createIdea, getDateIdea, ideaKeys, updateIdea } from '../date-ideas';
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
const ideaValuesSchema = z.object({ title: z.string(), note: z.string(), link: z.string() });
type IdeaValues = z.infer<typeof ideaValuesSchema>;
function valuesFor(idea: DateIdea): IdeaValues { return { title: idea.title, note: idea.note, link: idea.link }; }
function IdeaForm({ pairId, idea, reload }: { pairId: string; idea?: DateIdea; reload(): Promise<{ data?: DateIdea | null }> }) {
  const core = useCore(); const router = useRouter();
  const draft = useDraft<IdeaValues, IdeaInput, DateIdea>({
    accountId: core.account.id, pairId, key: `calendar:idea:${idea?.id ?? 'new'}`,
    values: ideaValuesSchema, rules: ideaFieldsSchema, input: ideaInputSchema, online: core.online,
    initial: { id: idea?.id, expectedVersion: idea?.version, values: idea ? valuesFor(idea) : { title: '', note: '', link: '' } },
    toInput: (values, identity) => ideaInputSchema.parse({ ...values, id: identity.id, pairId }),
    command: (input, identity) => idea ? updateIdea(input.id, input, identity.expectedVersion!, identity.commandId) : createIdea(input, identity.commandId),
    reload: async () => { const saved = (await reload()).data; return saved ? { values: valuesFor(saved), expectedVersion: saved.version } : null; },
    onSaved: saved => router.replace({ pathname: '/ideas/[ideaId]', params: { ideaId: saved.id } }),
  });
  const { form, ready, saving, frozen, error, storageError } = draft;
  if (draft.savedButNotCleared) { const savedId = draft.savedButNotCleared.id; return <Screen title="Idea saved"><Status message="We saved your idea. We could not remove its local draft." /><Button label="Open idea" onPress={() => router.replace({ pathname: '/ideas/[ideaId]', params: { ideaId: savedId } })} /></Screen>; }
  return <Screen title={idea ? 'Edit idea' : 'Add idea'}>
    {!core.online && <Status message={draft.savedOnDevice ? 'You are offline. Your draft is on this device.' : 'You are offline. Keep this screen open until your draft saves.'} />}
    {storageError && <Status tone="error" message={storageError} />}
    {error && <Status tone="error" message={error.code === 'CONFLICT' ? 'Your partner changed this idea. Your draft is on this device.' : error.message ?? 'We could not save this idea.'}
      actionLabel={error.code === 'CONFLICT' ? 'Reload saved version' : frozen ? 'Retry save' : undefined}
      onAction={error.code === 'CONFLICT' ? () => { void draft.reloadSaved(); } : frozen ? () => { void draft.retry(); } : undefined} />}
    {error?.code === 'CONFLICT' && <Button label="Return to draft" variant="secondary" onPress={draft.dismissConflict} />}
    {draft.canRestore && <Status message="Review the saved idea before you save." actionLabel="Restore my draft" onAction={() => { void draft.restore(); }} />}
    {(['title', 'note', 'link'] as const).map(name => <Controller key={name} control={form.control} name={name} render={({ field, fieldState }) => <Field label={name === 'title' ? 'Title' : name === 'note' ? 'Note (optional)' : 'HTTPS link (optional)'}
      value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} editable={ready && !saving && !frozen} maxLength={name === 'title' ? 120 : name === 'note' ? 1000 : 2048} multiline={name === 'note'} autoCapitalize={name === 'link' ? 'none' : 'sentences'} />} />)}
    <Button label={frozen ? 'Retry save' : idea ? 'Save changes' : 'Save idea'} loading={saving} disabled={!core.online || !ready || saving || error?.code === 'CONFLICT'} onPress={() => { void (frozen ? draft.retry() : draft.save()); }} />
    <Button label="Back" variant="secondary" disabled={!ready || saving} onPress={() => { void draft.leave().then(left => { if (left) router.back(); }); }} />
  </Screen>;
}
