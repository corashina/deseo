import { Directory, File, Paths } from 'expo-file-system';
import { z } from 'zod';
import { getPrivateStorage } from '../../lib/private-storage';
import { AppError } from '@deseo/domain/result';
import { uuid } from '@deseo/domain/memories';
import { draftSchema } from './schema';
import type { MemoryDraft } from './types';

type Owner = Pick<MemoryDraft, 'accountId' | 'pairId' | 'draftId' | 'key'>;
const registrySchema = z.array(z.object({ accountId: uuid, pairId: uuid, draftId: uuid,
  key: z.string(), paths: z.array(z.string()), cleanup: z.boolean() }));
type Registry = z.infer<typeof registrySchema>;
const transientOwners = new Map<string, { owner: Owner; cancel(): Promise<void> }>();
// This map describes live native work only. It intentionally starts empty after process restart.
export function beginTransientMemoryFiles(owner: Owner, scope: { signal: AbortSignal; assertCurrent(): void }) {
  scope.assertCurrent();
  const controller = new AbortController();
  let pending: Promise<unknown> | null = null;
  const abort = () => controller.abort();
  scope.signal.addEventListener('abort', abort, { once: true });
  if (scope.signal.aborted) abort();
  const operation = { owner, async cancel() { abort(); await pending?.catch(() => undefined); } };
  transientOwners.set(owner.draftId, operation);
  const assertCurrent = () => {
    scope.assertCurrent();
    if (controller.signal.aborted) throw new AppError({ code: 'FORBIDDEN' });
  };
  return {
    signal: controller.signal,
    assertCurrent,
    async run<T>(work: () => Promise<T>): Promise<T> {
      assertCurrent();
      const task = Promise.resolve().then(() => { assertCurrent(); return work(); });
      pending = task;
      try { const result = await task; assertCurrent(); return result; }
      finally { if (pending === task) pending = null; }
    },
    finish() {
      scope.signal.removeEventListener('abort', abort);
      if (transientOwners.get(owner.draftId) === operation) transientOwners.delete(owner.draftId);
    },
  };
}
let queue: Promise<unknown> = Promise.resolve();
export function fileOperation<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work);
  queue = next.catch(() => undefined);
  return next;
}
export function flushMemoryFiles(): Promise<void> { return queue.then(() => undefined); }
export function memoryRoot() { return new Directory(Paths.cache, 'deseo-memories'); }
export function photoFile(draftId: string, photoId: string, variant: 'full' | 'thumb') {
  return new File(memoryRoot(), uuid.parse(draftId), `${uuid.parse(photoId)}.${variant}.jpg`);
}
export function isOwnedCacheUri(uri: string): boolean {
  if (uri.includes('..') || uri.includes('%') || uri.includes('\\')) return false;
  return [memoryRoot().uri, new Directory(Paths.cache, 'ImageManipulator').uri, new Directory(Paths.cache, 'ImagePicker').uri]
    .some(root => uri.startsWith(`${root.replace(/\/$/, '')}/`));
}
function removeFile(uri: string) {
  if (!isOwnedCacheUri(uri)) throw new Error('Refusing to remove an external file.');
  const file = new File(uri);
  if (file.exists) file.delete();
}
async function registry(): Promise<Registry> {
  const raw = await (await getPrivateStorage()).getIntent('memories:files');
  return raw ? registrySchema.parse(JSON.parse(raw)) : [];
}
async function writeRegistry(entries: Registry) {
  await (await getPrivateStorage()).setIntent('memories:files', JSON.stringify(entries));
}
export function readMemoryDraft(accountId: string, pairId: string, key: string): Promise<MemoryDraft | null> {
  return fileOperation(async () => {
    const raw = await (await getPrivateStorage()).getDraft(accountId, pairId, key);
    if (!raw) return null;
    const draft = draftSchema.parse(JSON.parse(raw));
    if (draft.accountId !== accountId || draft.pairId !== pairId || draft.key !== key) throw new AppError({ code: 'FORBIDDEN' });
    return { ...draft, photos: draft.photos.map(photo => ({ ...photo,
      status: photoFile(draft.draftId, photo.id, 'full').exists && photoFile(draft.draftId, photo.id, 'thumb').exists
        ? photo.status === 'uploading' ? 'failed' : photo.status : 'missing' })) };
  });
}
export function writeMemoryDraft(draft: MemoryDraft, assertCurrent: () => void): Promise<void> {
  assertCurrent();
  const value = JSON.stringify(draftSchema.parse(draft));
  return fileOperation(async () => {
    assertCurrent();
    const storage = await getPrivateStorage();
    assertCurrent();
    const entries = await registry();
    assertCurrent();
    if (!entries.some(entry => entry.draftId === draft.draftId)) {
      await writeRegistry([...entries, { accountId: draft.accountId, pairId: draft.pairId, key: draft.key,
        draftId: draft.draftId, paths: [], cleanup: false }]);
    }
    assertCurrent();
    await storage.setDraft(draft.accountId, draft.pairId, draft.key, value);
    assertCurrent();
  });
}
export function registerMemoryFiles(owner: Owner, paths: string[], assertCurrent: () => void): Promise<void> {
  return fileOperation(async () => {
    assertCurrent();
    if (paths.some(path => !isOwnedCacheUri(path))) throw new Error('The file is outside private memory storage.');
    const entries = await registry();
    assertCurrent();
    const entry = entries.find(item => item.draftId === owner.draftId);
    if (entry) entry.paths = [...new Set([...entry.paths, ...paths])];
    else entries.push({ ...owner, paths, cleanup: false });
    await writeRegistry(entries);
    assertCurrent();
  });
}
export function removeMemoryFiles(paths: string[]): Promise<void> {
  return fileOperation(async () => {
    const entries = await registry();
    let failed = false;
    for (const path of paths) {
      try {
        removeFile(path);
        for (const entry of entries) entry.paths = entry.paths.filter(item => item !== path);
      } catch { failed = true; }
    }
    await writeRegistry(entries);
    if (failed) throw new AppError({ code: 'RETRYABLE', message: 'We could not remove temporary photos. Retry cleanup.' });
  });
}
export function discardMemoryDraft(owner: Owner): Promise<void> {
  return fileOperation(async () => {
    const entries = await registry();
    const entry = entries.find(item => item.draftId === owner.draftId);
    if (entry) entry.cleanup = true;
    await writeRegistry(entries);
    await (await getPrivateStorage()).removeDraft(owner.accountId, owner.pairId, owner.key);
    await cleanupEntries(entries);
  });
}
async function cleanupEntries(entries: Registry) {
  let failed = false;
  for (const entry of entries.filter(item => item.cleanup)) {
    const remaining: string[] = [];
    for (const path of entry.paths) {
      try { removeFile(path); } catch { remaining.push(path); failed = true; }
    }
    entry.paths = remaining;
  }
  await writeRegistry(entries.filter(entry => !entry.cleanup || entry.paths.length > 0));
  if (failed) throw new AppError({ code: 'RETRYABLE', message: 'We could not remove temporary photos. Retry cleanup.' });
}
// Only a verified scope may purge another account or pair. Unknown access keeps drafts.
export function reconcileMemoryFiles(owner: { accountId: string; pairId: string } | null, assertCurrent: () => void, sweepNative = false): Promise<void> {
  return fileOperation(async () => {
    assertCurrent();
    for (const operation of transientOwners.values()) {
      if (owner?.accountId !== operation.owner.accountId || owner.pairId !== operation.owner.pairId) {
        await operation.cancel();
        assertCurrent();
      }
    }
    const entries = await registry();
    const storage = await getPrivateStorage();
    for (const entry of entries) {
      assertCurrent();
      const current = owner?.accountId === entry.accountId && owner.pairId === entry.pairId;
      if (current && !entry.cleanup && transientOwners.has(entry.draftId)) continue;
      const draft = current ? await storage.getDraft(entry.accountId, entry.pairId, entry.key) : null;
      assertCurrent();
      if (!draft || entry.cleanup) {
        entry.cleanup = true;
        await storage.removeDraft(entry.accountId, entry.pairId, entry.key);
      }
    }
    assertCurrent();
    await writeRegistry(entries);
    await cleanupEntries(entries);
    assertCurrent();
    const retained = new Set(entries.filter(entry => !entry.cleanup).flatMap(entry => entry.paths));
    const root = memoryRoot();
    if (root.exists) {
      const sweep = (directory: Directory) => {
        for (const item of directory.list()) {
          if (item instanceof Directory) sweep(item);
          else if (!retained.has(item.uri)) { assertCurrent(); removeFile(item.uri); }
        }
      };
      sweep(root);
    }
    if (sweepNative) {
      // Memories is the sole picker/manipulator caller. Do not run while its picker promise exists.
      for (const name of ['ImageManipulator', 'ImagePicker']) {
        const directory = new Directory(Paths.cache, name);
        if (directory.exists) {
          for (const item of directory.list()) {
            if (item instanceof Directory) continue;
            assertCurrent(); removeFile(item.uri);
          }
        }
      }
    }
  });
}
export function clearMemoryRoot(): void {
  const root = memoryRoot();
  if (root.exists) root.delete();
}
