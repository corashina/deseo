import { useCallback, useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useForm, type DefaultValues, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getPrivateStorage } from './private-storage';
import { captureQueryScope } from './query-client';
import type { CommandError, Result } from './result';

const writers = new Set<() => Promise<void>>();
let pendingFlush: Promise<void> | null = null;
/** Registers a writer that saves unsent local content before the app leaves the foreground or changes account. */
export function registerDraftFlush(writer: () => Promise<void>): () => void {
  writers.add(writer);
  return () => { writers.delete(writer); };
}
export function flushPrivateDrafts(): Promise<void> {
  if (pendingFlush) return pendingFlush;
  const writes = [...writers].map(writer => {
    try { return writer(); } catch (error) { return Promise.reject(error); }
  });
  pendingFlush = Promise.all(writes).then(() => undefined).finally(() => { pendingFlush = null; });
  return pendingFlush;
}

const AUTOSAVE_MS = 300;
const uuid = z.string().uuid();
export type DraftIdentity = { id: string; commandId: string; expectedVersion?: number };
type Envelope<V, I> = DraftIdentity & { values: V; submission?: I; preservedValues?: V; conflict?: true };
type Scoped = { id?: unknown; pairId?: unknown };

function envelopeSchema<V, I>(values: z.ZodType<V>, input: z.ZodType<I>) {
  return z.object({ id: uuid, commandId: uuid, expectedVersion: z.number().int().positive().optional(),
    values, submission: input.optional(), preservedValues: values.optional(), conflict: z.literal(true).optional() });
}
function assertScope<V, I>(pairId: string, draft: Envelope<V, I>) {
  const submission = draft.submission as Scoped | undefined;
  if (submission && ((submission.id !== undefined && submission.id !== draft.id) || (submission.pairId !== undefined && submission.pairId !== pairId))) {
    throw new Error('The draft scope changed.');
  }
}

export type DraftOptions<V extends FieldValues, I, R> = {
  accountId: string;
  pairId: string;
  /** Storage key inside the account and pair scope. */
  key: string;
  /** Stored values. Accepts incomplete input. */
  values: z.ZodType<V>;
  /** Validation for a save. Field messages show on the form. */
  rules: z.ZodType<V>;
  /** Command input kept while a save is unconfirmed. */
  input: z.ZodType<I>;
  initial: { values: V; id?: string; expectedVersion?: number };
  online: boolean;
  toInput(values: V, identity: DraftIdentity): I;
  command(input: I, identity: DraftIdentity): Promise<Result<R>>;
  /** Returns the saved version after a CONFLICT, or null when the item is unavailable. */
  reload?(): Promise<{ values: V; expectedVersion: number } | null>;
  onSaved(data: R): void;
};
export type Draft<V extends FieldValues, I, R> = {
  form: UseFormReturn<V>;
  ready: boolean;
  saving: boolean;
  /** An unconfirmed save exists. Editing stays locked until it resolves. */
  frozen: boolean;
  error: CommandError | null;
  storageError: string | null;
  savedOnDevice: boolean;
  canRestore: boolean;
  /** The command succeeded but the local draft could not be removed. */
  savedButNotCleared: R | null;
  save(prepare?: (input: I) => Promise<I | null> | I | null): Promise<void>;
  retry(): Promise<void>;
  reloadSaved(): Promise<void>;
  restore(): Promise<void>;
  dismissConflict(): void;
  leave(): Promise<boolean>;
};

const openError = 'We could not open your draft. Open this screen again.';
const writeError = 'We could not save your draft on this device. Keep this screen open.';
const clearError = 'We saved your changes. We could not remove the local draft.';

/** Owns a form's local draft: retry identity, autosave, unconfirmed saves, and conflict review. */
export function useDraft<V extends FieldValues, I, R>(options: DraftOptions<V, I, R>): Draft<V, I, R> {
  const { accountId, pairId, key } = options;
  const latest = useRef(options); latest.current = options;
  const [schema] = useState(() => envelopeSchema(options.values, options.input));
  const form = useForm<V>({ resolver: zodResolver(options.rules), defaultValues: options.initial.values as DefaultValues<V> });
  const [initialIdentity] = useState<DraftIdentity>(() => ({ id: options.initial.id ?? randomUUID(), commandId: randomUUID(), expectedVersion: options.initial.expectedVersion }));
  const identity = useRef(initialIdentity);
  const submission = useRef<I | undefined>(undefined);
  const preserved = useRef<V | undefined>(undefined);
  const conflict = useRef(false);
  const complete = useRef(false);
  const busy = useRef(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState<CommandError | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [savedOnDevice, setSavedOnDevice] = useState(false);
  const [canRestore, setCanRestore] = useState(false);
  const [savedButNotCleared, setSavedButNotCleared] = useState<R | null>(null);

  const persist = useCallback((): Promise<void> => {
    const scope = captureQueryScope();
    let draft: Envelope<V, I>;
    try {
      draft = schema.parse({ ...identity.current, values: form.getValues(), submission: submission.current, preservedValues: preserved.current, conflict: conflict.current || undefined }) as Envelope<V, I>;
      assertScope(pairId, draft);
    } catch (error) { return Promise.reject(error); }
    const write = writes.current.catch(() => undefined).then(async () => {
      if (complete.current) return;
      const storage = await getPrivateStorage(); scope.assertCurrent();
      await storage.setDraft(accountId, pairId, key, JSON.stringify(draft)); scope.assertCurrent();
      setSavedOnDevice(true);
    });
    writes.current = write;
    return write;
  }, [accountId, pairId, key, schema, form]);
  const cancelTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  useEffect(() => {
    let active = true; const scope = captureQueryScope();
    void (async () => {
      const storage = await getPrivateStorage(); scope.assertCurrent();
      const raw = await storage.getDraft(accountId, pairId, key); scope.assertCurrent();
      if (!active) return;
      if (raw !== null) {
        const draft = schema.parse(JSON.parse(raw)) as Envelope<V, I>;
        assertScope(pairId, draft);
        const initial = latest.current.initial;
        if (initial.id !== undefined && draft.id !== initial.id) throw new Error('The draft belongs to another item.');
        if (initial.expectedVersion !== undefined && draft.expectedVersion === undefined) throw new Error('The draft has no version.');
        identity.current = { id: draft.id, commandId: draft.commandId, expectedVersion: draft.expectedVersion };
        submission.current = draft.submission; preserved.current = draft.preservedValues; conflict.current = draft.conflict === true;
        form.reset(draft.values);
        setSavedOnDevice(true); setCanRestore(draft.preservedValues !== undefined); setFrozen(draft.submission !== undefined);
        if (draft.submission !== undefined) setError({ code: 'RETRYABLE', message: 'Confirm your last save before you change this draft.' });
        else if (conflict.current) setError({ code: 'CONFLICT' });
      }
      setReady(true);
    })().catch(() => { if (active) setStorageError(openError); });
    return () => { active = false; };
  }, [accountId, pairId, key, schema, form]);

  useEffect(() => {
    if (!ready) return;
    const scope = captureQueryScope();
    const flush = async () => { cancelTimer(); scope.assertCurrent(); await persist(); };
    const removeFlush = registerDraftFlush(flush);
    const listener = form.watch(() => {
      if (complete.current || submission.current !== undefined) return;
      setSavedOnDevice(false); cancelTimer();
      timer.current = setTimeout(() => { void flush().catch(() => setStorageError(writeError)); }, AUTOSAVE_MS);
    });
    return () => {
      removeFlush(); listener.unsubscribe(); cancelTimer();
      if (!complete.current) void flush().catch(() => undefined);
    };
  }, [ready, form, persist]);

  const submit = useCallback(async (input: I) => {
    if (busy.current || !latest.current.online || !ready || complete.current) return;
    const scope = captureQueryScope();
    busy.current = true; setSaving(true); setError(null); cancelTimer();
    submission.current = input; setFrozen(true);
    try {
      await persist(); scope.assertCurrent();
      const result = await latest.current.command(input, { ...identity.current }); scope.assertCurrent();
      if (result.ok) {
        complete.current = true;
        try {
          await writes.current.catch(() => undefined);
          await (await getPrivateStorage()).removeDraft(accountId, pairId, key); scope.assertCurrent();
        } catch { setStorageError(clearError); setSavedButNotCleared(result.data); return; }
        latest.current.onSaved(result.data);
        return;
      }
      if (result.error.code === 'RETRYABLE') { setError(result.error); return; }
      submission.current = undefined; identity.current = { ...identity.current, commandId: randomUUID() }; setFrozen(false);
      const field = result.error.field;
      if (result.error.code === 'CONFLICT' && field !== undefined && field in form.getValues()) {
        form.setError(field as Path<V>, { message: result.error.message ?? 'This value is already in use.' });
      } else { conflict.current = result.error.code === 'CONFLICT'; setError(result.error); }
      await persist();
    } catch {
      try { scope.assertCurrent(); setStorageError(writeError); } catch { /* The access gate owns recovery. */ }
    } finally {
      busy.current = false;
      try { scope.assertCurrent(); setSaving(false); } catch { /* The access gate owns recovery. */ }
    }
  }, [accountId, pairId, key, ready, form, persist]);

  const save = useCallback(async (prepare?: (input: I) => Promise<I | null> | I | null) => {
    await form.handleSubmit(async values => {
      let input = latest.current.toInput(values, { ...identity.current });
      if (prepare) { const next = await prepare(input); if (next === null) return; input = next; }
      await submit(input);
    })();
  }, [form, submit]);
  const retry = useCallback(async () => { if (submission.current !== undefined) await submit(submission.current); }, [submit]);
  const reloadSaved = useCallback(async () => {
    const reload = latest.current.reload;
    if (!reload || busy.current) return;
    const scope = captureQueryScope();
    const local = form.getValues();
    try {
      const saved = await reload(); scope.assertCurrent();
      if (!saved) { setError({ code: 'FORBIDDEN', message: 'This item is unavailable.' }); return; }
      preserved.current = local; submission.current = undefined; conflict.current = false;
      identity.current = { ...identity.current, expectedVersion: saved.expectedVersion, commandId: randomUUID() };
      form.reset(saved.values); setError(null); setFrozen(false); setCanRestore(true);
      await persist();
    } catch { try { scope.assertCurrent(); setStorageError(writeError); } catch { /* The access gate owns recovery. */ } }
  }, [form, persist]);
  const restore = useCallback(async () => {
    if (preserved.current) form.reset(preserved.current);
    preserved.current = undefined; setCanRestore(false);
    await persist().catch(() => setStorageError(writeError));
  }, [form, persist]);
  const dismissConflict = useCallback(() => {
    conflict.current = false; setError(null);
    void persist().catch(() => setStorageError(writeError));
  }, [persist]);
  const leave = useCallback(async () => {
    cancelTimer();
    try { await persist(); return true; } catch { setStorageError(writeError); return false; }
  }, [persist]);

  return { form, ready, saving, frozen, error, storageError, savedOnDevice, canRestore, savedButNotCleared,
    save, retry, reloadSaved, restore, dismissConflict, leave };
}
