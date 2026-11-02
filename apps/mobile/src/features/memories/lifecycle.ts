import { AppState, Platform } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { DateTime } from 'luxon';
import { restoreSession } from '../auth';
import { getPairContext } from '../pair';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { getSupabase } from '../../lib/supabase';
import { onPrivateStorageFailure } from '../../lib/private-storage';
import { registerDraftFlush } from '../../lib/draft';
import { AppError, toAppError } from '@deseo/domain/result';
import { clearMemoryRoot, discardMemoryDraft, flushMemoryFiles, isOwnedCacheUri, photoFile,
  readMemoryDraft, reconcileMemoryFiles, registerMemoryFiles, removeMemoryFiles, writeMemoryDraft } from './drafts';
import { prepareMemoryDraft } from './prepare';
import { deleteMemory, finalizeMemory, reserveMemory, updateMemory, uploadMemoryPhoto } from './commands';
import { memoryInputSchema } from '@deseo/domain/memories';
import { subscribeMemorySignals } from './queries';
import type { Memory, MemoryInput } from '@deseo/domain/memories';
import type { MemoryDraft } from './types';

type Snapshot = { status: 'checking' | 'ready' | 'blocked'; accountId: string | null; pairId: string | null;
  generation: number; drafts: Record<string, MemoryDraft>; busy: boolean; error: string | null; completedId: string | null };
let snapshot: Snapshot = { status: 'checking', accountId: null, pairId: null, generation: 0, drafts: {}, busy: false, error: null, completedId: null };
const listeners = new Set<() => void>();
let initialized = false;
let reconcile: Promise<void> | null = null;
let again = false;
let nativePicker: Promise<void> | null = null;
let selection: { token: string; draftId: string; accountId: string; pairId: string } | null = null;
let boundClient: Awaited<ReturnType<typeof getSupabase>> | null = null;
let stopAuth: (() => void) | undefined;
let stopSignals: (() => void) | undefined;
let cacheClear = Promise.resolve(true);
let foreground = AppState.currentState === 'active';

export const getMemoryLifecycle = () => snapshot;
export function clearMemoryCompletion() { if (snapshot.completedId) emit({ completedId: null }); }
export function subscribeMemoryLifecycle(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function emit(next: Partial<Snapshot>) { snapshot = { ...snapshot, ...next }; listeners.forEach(listener => listener()); }
function suspend() {
  stopSignals?.(); stopSignals = undefined;
  emit({ status: 'checking', generation: snapshot.generation + 1, drafts: {}, completedId: null });
  cacheClear = Image.clearMemoryCache().catch(() => false);
}
function admission() {
  const generation = snapshot.generation;
  const scope = captureQueryScope();
  const accountId = snapshot.accountId;
  const pairId = snapshot.pairId;
  return () => {
    scope.assertCurrent();
    if (!foreground || snapshot.status !== 'ready' || generation !== snapshot.generation
      || accountId !== snapshot.accountId || pairId !== snapshot.pairId) throw new AppError({ code: 'RETRYABLE', message: 'Check your access before you retry.' });
  };
}
function draftGuard(draftId: string) {
  const check = admission();
  return () => {
    check();
    if (!Object.values(snapshot.drafts).some(draft => draft.draftId === draftId)) throw new AppError({ code: 'RETRYABLE' });
  };
}
function draftWriteGuard(draftId: string) {
  const scope = captureQueryScope();
  const generation = snapshot.generation;
  return () => {
    scope.assertCurrent();
    if (generation !== snapshot.generation || !Object.values(snapshot.drafts).some(draft => draft.draftId === draftId)) {
      throw new AppError({ code: 'RETRYABLE' });
    }
  };
}
async function bindAuth() {
  const client = await getSupabase();
  if (boundClient === client) return;
  stopAuth?.(); boundClient = client;
  const { data } = client.auth.onAuthStateChange(event => {
    setTimeout(() => {
      if (boundClient !== client) return;
      if (event === 'SIGNED_OUT') selection = null;
      suspend();
      void reconcileMemoryAccess();
    }, 0);
  });
  stopAuth = () => data.subscription.unsubscribe();
}
async function checkAccess() {
  if (!foreground) return;
  const scope = captureQueryScope();
  const generation = snapshot.generation;
  const current = () => { scope.assertCurrent(); if (generation !== snapshot.generation || !foreground) throw new AppError({ code: 'RETRYABLE' }); };
  try {
    await bindAuth();
    const session = await restoreSession();
    current();
    const pair = session?.account ? await getPairContext() : null;
    current();
    const owner = session?.account && pair?.status === 'active' ? { accountId: session.account.id, pairId: pair.pairId } : null;
    if (!owner || selection && (selection.accountId !== owner.accountId || selection.pairId !== owner.pairId)) selection = null;
    await reconcileMemoryFiles(owner, current, nativePicker === null);
    current();
    if (!(await cacheClear) && !(await Image.clearMemoryCache())) throw new AppError({ code: 'RETRYABLE', message: 'We could not clear private photos. Retry access checks.' });
    current();
    emit({ status: owner ? 'ready' : 'blocked', accountId: owner?.accountId ?? null, pairId: owner?.pairId ?? null,
      error: owner ? null : 'Connect with your partner to open memories.' });
    if (owner && !stopSignals) {
      const stop = await subscribeMemorySignals(owner.accountId, owner.pairId, () => { suspend(); void reconcileMemoryAccess(); });
      try { current(); stopSignals = stop; } catch { stop(); }
    }
  } catch (error) {
    if (scope.signal.aborted || generation !== snapshot.generation || !foreground) return;
    const failure = toAppError(error);
    if (failure.code === 'UNAUTHENTICATED' || failure.code === 'FORBIDDEN') {
      selection = null;
      await reconcileMemoryFiles(null, current).catch(() => { failure.message = 'We could not remove temporary photos. Retry cleanup.'; });
    }
    emit({ status: 'blocked', error: failure.message });
  }
}
export function reconcileMemoryAccess(): Promise<void> {
  if (reconcile) { again = true; return reconcile; }
  reconcile = (async () => { do { again = false; await checkAccess(); } while (again); })()
    .finally(() => { reconcile = null; });
  return reconcile;
}
export function ensureMemoryLifecycle() {
  if (initialized || Platform.OS === 'web') return;
  initialized = true;
  const arm = () => captureQueryScope().signal.addEventListener('abort', () => {
    suspend();
    queueMicrotask(() => { arm(); void reconcileMemoryAccess(); });
  }, { once: true });
  arm();
  registerDraftFlush(flushMemoryFiles);
  AppState.addEventListener('change', state => {
    foreground = state === 'active';
    if (!foreground) {
      emit({ status: 'checking' });
      cacheClear = Image.clearMemoryCache().catch(() => false);
      void flushMemoryFiles().then(() => { if (!foreground) suspend(); });
    }
    else void reconcileMemoryAccess();
  });
  queryClient.getQueryCache().subscribe(event => {
    if (event.type === 'updated' && event.action.type === 'success' && event.query.queryKey[0] === 'account'
      && event.query.queryKey[2] === 'pair') {
      suspend(); void reconcileMemoryAccess();
    }
  });
  onPrivateStorageFailure(() => {
    selection = null; suspend();
    try { clearMemoryRoot(); } catch { /* Retry the root removal during storage recovery. */ }
    emit({ status: 'blocked', error: 'Restore private storage before you open memories.' });
  });
  queueMicrotask(() => { void reconcileMemoryAccess(); });
}
function setDraft(draft: MemoryDraft) { emit({ drafts: { ...snapshot.drafts, [draft.key]: draft } }); }
async function persist(draft: MemoryDraft, check = draftGuard(draft.draftId)) {
  check(); setDraft(draft);
  await writeMemoryDraft(draft, check);
  check();
}
export async function openMemoryDraft(timezone: string, memory?: Memory): Promise<void> {
  const check = admission(); check();
  const accountId = snapshot.accountId!; const pairId = snapshot.pairId!;
  if (memory && (memory.createdBy !== accountId || memory.pairId !== pairId)) throw new AppError({ code: 'FORBIDDEN' });
  const key = memory ? `memories:edit:${memory.id}` : 'memories:new';
  if (snapshot.drafts[key]) return;
  const saved = await readMemoryDraft(accountId, pairId, key);
  check();
  const draft: MemoryDraft = saved ?? { accountId, pairId, key, draftId: randomUUID(), id: memory?.id ?? randomUUID(),
    memoryDate: memory?.memoryDate ?? DateTime.now().setZone(timezone).toISODate()!, caption: memory?.caption ?? '',
    reserveCommandId: randomUUID(), publishCommandId: randomUUID(), commandId: randomUUID(), photos: [],
    reserved: false, submitted: false, expectedVersion: memory?.version, conflict: false, selectionToken: null };
  setDraft(draft);
  await persist(draft);
}
export function changeMemoryDraft(key: string, values: Partial<MemoryInput>): void {
  const draft = snapshot.drafts[key];
  if (!draft || draft.submitted || snapshot.busy) return;
  admission()();
  void persist({ ...draft, ...values }, draftWriteGuard(draft.draftId)).catch(error => { if (snapshot.status === 'ready') emit({ error: toAppError(error).message }); });
}
function requireDraft(key: string) {
  const draft = snapshot.drafts[key];
  if (!draft) throw new AppError({ code: 'RETRYABLE', message: 'Open your draft again.' });
  return draft;
}
async function waitForSelectionAccess(token: string) {
  if (!foreground || snapshot.status !== 'ready') {
    await new Promise<void>((resolve) => {
      const stop = subscribeMemoryLifecycle(() => {
        if (selection?.token !== token || foreground && snapshot.status === 'ready') { stop(); resolve(); }
      });
    });
  }
  if (selection?.token !== token) throw new AppError({ code: 'FORBIDDEN' });
}
export function pickMemoryPhotos(): Promise<void> {
  if (nativePicker) return nativePicker;
  const draft = requireDraft('memories:new');
  if (draft.reserved || draft.submitted || draft.photos.length >= 5) return Promise.resolve();
  const token = randomUUID();
  selection = { token, draftId: draft.draftId, accountId: draft.accountId, pairId: draft.pairId };
  nativePicker = (async () => {
    let assets: ImagePicker.ImagePickerAsset[] = [];
    emit({ busy: true, error: null });
    try {
      await persist({ ...draft, selectionToken: token });
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true,
        selectionLimit: 5 - draft.photos.length, quality: 1, exif: false, base64: false });
      assets = result.canceled ? [] : result.assets;
      if (foreground) await reconcileMemoryAccess();
      await waitForSelectionAccess(token);
      await openMemoryDraft('UTC');
      const current = requireDraft('memories:new');
      if (current.draftId !== draft.draftId || current.selectionToken !== token) return;
      const check = draftGuard(current.draftId);
      const prepared = assets.length ? await prepareMemoryDraft({ draft: current, assets, assertCurrent: check }) : current;
      check();
      await persist({ ...prepared, selectionToken: null }, check);
    } catch (error) {
      if (snapshot.status === 'ready') {
        // Preparation saves each photo. Recover completed photos when a later selection fails.
        const recovered = await readMemoryDraft(draft.accountId, draft.pairId, draft.key).catch(() => null);
        if (snapshot.status === 'ready' && recovered?.draftId === draft.draftId) setDraft(recovered);
        emit({ error: toAppError(error).message });
      }
    } finally {
      await removeMemoryFiles(assets.map(asset => asset.uri).filter(isOwnedCacheUri)).catch(() => {
        emit({ error: 'We could not remove temporary photos. Retry cleanup.' });
      });
      selection = null; nativePicker = null; emit({ busy: false });
    }
  })();
  return nativePicker;
}
export async function submitMemoryDraft(key: string): Promise<void> {
  if (snapshot.busy) return;
  let draft = requireDraft(key);
  const check = draftGuard(draft.draftId);
  emit({ busy: true, error: null });
  try {
    memoryInputSchema.parse(draft);
    if (!draft.expectedVersion && draft.photos.length === 0) {
      throw new AppError({ code: 'VALIDATION', message: 'Choose at least one photo.' });
    }
    draft = { ...draft, submitted: true };
    await persist(draft, check);
    let memory: Memory;
    if (draft.expectedVersion) {
      const result = await updateMemory(draft.id, draft, draft.expectedVersion, draft.commandId);
      check();
      if (!result.ok) throw new AppError(result.error);
      memory = result.data;
    } else {
      const reserved = await reserveMemory(draft, draft.reserveCommandId);
      check();
      if (!reserved.ok) throw new AppError(reserved.error);
      memory = reserved.data;
      draft = { ...draft, reserved: true };
      await persist(draft, check);
      if (memory.state !== 'published') {
        for (const photo of draft.photos) {
          draft = { ...draft, photos: draft.photos.map(item => item.id === photo.id ? { ...item, status: 'uploading' } : item) };
          await persist(draft, check);
          const result = await uploadMemoryPhoto(memory, { id: photo.id, fullUri: photoFile(draft.draftId, photo.id, 'full').uri,
            thumbUri: photoFile(draft.draftId, photo.id, 'thumb').uri });
          check();
          draft = { ...draft, photos: draft.photos.map(item => item.id === photo.id ? { ...item, status: result.ok ? 'validated' : 'failed' } : item) };
          await persist(draft, check);
          if (!result.ok) throw new AppError(result.error);
        }
        const published = await finalizeMemory(draft.id, draft.publishCommandId);
        check();
        if (!published.ok) throw new AppError(published.error);
        memory = published.data;
      }
    }
    check();
    emit({ drafts: Object.fromEntries(Object.entries(snapshot.drafts).filter(([name]) => name !== key)), completedId: memory.id });
    await discardMemoryDraft(draft);
  } catch (error) {
    if (snapshot.status !== 'ready') return;
    const failure = toAppError(error);
    if (failure.code === 'CONFLICT' && draft.expectedVersion) {
      draft = { ...draft, conflict: true };
      await persist(draft, check).catch(() => undefined);
    } else if ((failure.code === 'VALIDATION' || failure.code === 'QUOTA_EXCEEDED') && !draft.reserved) {
      await persist({ ...draft, submitted: false }, check).catch(() => undefined);
    }
    emit({ error: failure.message });
    if (failure.code === 'FORBIDDEN' || failure.code === 'UNAUTHENTICATED') void reconcileMemoryAccess();
  } finally { emit({ busy: false }); }
}
export async function reviewMemoryConflict(memory: Memory): Promise<void> {
  const draft = requireDraft(`memories:edit:${memory.id}`);
  if (memory.createdBy !== draft.accountId) throw new AppError({ code: 'FORBIDDEN' });
  await persist({ ...draft, expectedVersion: memory.version, commandId: randomUUID(), submitted: false, conflict: false });
  emit({ error: null });
}
// Cancel the old immutable reservation before assigning a new upload identity.
export async function restartMemoryDraft(removePhotoId?: string): Promise<void> {
  if (snapshot.busy) return;
  const draft = requireDraft('memories:new');
  const check = draftGuard(draft.draftId);
  emit({ busy: true, error: null });
  try {
    if (draft.submitted || draft.reserved) {
      // Replaying reservation resolves a lost reply, including a request that never arrived.
      const reservation = await reserveMemory(draft, draft.reserveCommandId);
      check();
      if (reservation.ok && reservation.data.state === 'published') {
        emit({ completedId: draft.id });
        await discardCurrentMemoryDraft('memories:new');
        return;
      }
      if (!reservation.ok && reservation.error.code !== 'FORBIDDEN') throw new AppError(reservation.error);
      // Pending rows remain version 1. Deleting rows and tombstones accept this stable cancellation.
      const result = await deleteMemory(draft.id, 1, draft.commandId);
      check();
      if (!result.ok) throw new AppError(result.error);
    }
    const photos: MemoryDraft['photos'] = [];
    const replacements: string[] = [];
    try {
      for (const photo of draft.photos.filter(item => item.id !== removePhotoId)) {
        const id = randomUUID();
        const paths = (['full', 'thumb'] as const).map(variant => photoFile(draft.draftId, id, variant).uri);
        await registerMemoryFiles(draft, paths, check);
        replacements.push(...paths);
        for (const variant of ['full', 'thumb'] as const) {
          const source = photoFile(draft.draftId, photo.id, variant);
          if (source.exists) await source.copy(photoFile(draft.draftId, id, variant));
          check();
        }
        photos.push({ ...photo, id, status: photo.status === 'missing' ? 'missing' : 'ready' });
      }
      const next = { ...draft, id: randomUUID(), reserveCommandId: randomUUID(), publishCommandId: randomUUID(), commandId: randomUUID(),
        photos, reserved: false, submitted: false };
      await persist(next, check);
    } catch (error) { await removeMemoryFiles(replacements); throw error; }
    await removeMemoryFiles(draft.photos.flatMap(photo => (['full', 'thumb'] as const).map(variant => photoFile(draft.draftId, photo.id, variant).uri)));
  } catch (error) { if (snapshot.status === 'ready') emit({ error: toAppError(error).message }); }
  finally { emit({ busy: false }); }
}
export async function discardCurrentMemoryDraft(key: string): Promise<void> {
  const draft = requireDraft(key);
  admission()();
  selection = null;
  emit({ drafts: Object.fromEntries(Object.entries(snapshot.drafts).filter(([name]) => name !== key)), error: null });
  await discardMemoryDraft(draft);
}
