import { File } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { randomUUID } from 'expo-crypto';
import { captureQueryScope } from '../../lib/query-client';
import { AppError } from '../../lib/result';
import { beginTransientMemoryFiles, memoryRoot, registerMemoryFiles, removeMemoryFiles } from './drafts';
import { getMemoryMedia } from './queries';
import { getMemoryLifecycle, reconcileMemoryAccess } from './lifecycle';

export async function saveMemoryCopy(photoId: string): Promise<void> {
  const owner = getMemoryLifecycle();
  const permission = await requestPermissionsAsync(true, ['photo']);
  if (!permission.granted) throw new AppError({ code: 'VALIDATION', message: 'Allow photo access in device settings to save a copy.' });
  await reconcileMemoryAccess();
  const current = getMemoryLifecycle();
  if (current.status !== 'ready' || current.accountId !== owner.accountId || current.pairId !== owner.pairId) throw new AppError({ code: 'FORBIDDEN' });
  const scope = captureQueryScope();
  const id = randomUUID();
  const root = memoryRoot();
  const file = new File(root, `${id}.jpg`);
  const fileOwner = { accountId: current.accountId!, pairId: current.pairId!, draftId: id, key: `memories:copy:${id}` };
  const operation = beginTransientMemoryFiles(fileOwner, scope);
  try {
    await registerMemoryFiles(fileOwner, [file.uri], operation.assertCurrent);
    root.create({ intermediates: true, idempotent: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      const media = await getMemoryMedia(photoId);
      operation.assertCurrent();
      if (!media.ok) throw new AppError(media.error);
      try { await operation.run(() => File.downloadFileAsync(media.data.url, file, { signal: operation.signal })); break; }
      catch (error) {
        operation.assertCurrent();
        if (attempt === 1) throw error;
        if (file.exists) file.delete();
      }
    }
    operation.assertCurrent();
    await operation.run(() => Asset.create(file.uri));
  } finally {
    try { await removeMemoryFiles([file.uri]); }
    finally { operation.finish(); }
  }
}
