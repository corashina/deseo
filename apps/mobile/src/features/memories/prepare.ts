import { Directory, File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { randomUUID } from 'expo-crypto';
import type { ImagePickerAsset } from 'expo-image-picker';
import { AppError } from '@deseo/domain/result';
import { isOwnedCacheUri, memoryRoot, photoFile, registerMemoryFiles, removeMemoryFiles, writeMemoryDraft } from './drafts';
import type { MemoryDraft, LocalMemoryPhoto } from './types';

async function jpeg(asset: ImagePickerAsset, maximum: number, assertCurrent: () => void) {
  const context = ImageManipulator.manipulate(asset.uri);
  const intermediates: string[] = [];
  try {
    if (Math.max(asset.width, asset.height) > maximum) context.resize(asset.width >= asset.height ? { width: maximum } : { height: maximum });
    const image = await context.renderAsync();
    try {
      for (const compress of [0.85, 0.65, 0.45]) {
        assertCurrent();
        const result = await image.saveAsync({ format: SaveFormat.JPEG, compress });
        intermediates.push(result.uri);
        assertCurrent();
        const file = new File(result.uri);
        if (file.size > 0 && file.size <= 5242880) return { ...result, bytes: file.size, intermediates };
      }
      throw new AppError({ code: 'VALIDATION', message: 'This photo is too large. Choose a smaller photo.' });
    } finally { image.release(); }
  } catch (error) {
    for (const uri of intermediates) if (isOwnedCacheUri(uri)) { const file = new File(uri); if (file.exists) file.delete(); }
    throw error;
  } finally { context.release(); }
}
export async function prepareMemoryDraft(input: { draft: MemoryDraft; assets: ImagePickerAsset[]; assertCurrent: () => void }): Promise<MemoryDraft> {
  const { assertCurrent } = input;
  let draft = input.draft;
  if (draft.reserved || draft.submitted || input.assets.length + draft.photos.length > 5 || input.assets.length < 1) {
    throw new AppError({ code: 'VALIDATION', message: 'Choose one to five photos before you upload.' });
  }
  await writeMemoryDraft(draft, assertCurrent);
  for (const asset of input.assets) {
    const id = randomUUID();
    const fullFile = photoFile(draft.draftId, id, 'full');
    const thumbFile = photoFile(draft.draftId, id, 'thumb');
    const sources = isOwnedCacheUri(asset.uri) ? [asset.uri] : [];
    const temporary: string[] = [...sources];
    let complete = false;
    await registerMemoryFiles(draft, [...sources, fullFile.uri, thumbFile.uri], assertCurrent);
    try {
      const directory = new Directory(memoryRoot(), draft.draftId);
      directory.create({ intermediates: true, idempotent: true });
      const full = await jpeg(asset, 2560, assertCurrent);
      temporary.push(...full.intermediates);
      await registerMemoryFiles(draft, full.intermediates, assertCurrent);
      const thumb = await jpeg({ ...asset, uri: full.uri, width: full.width, height: full.height }, 512, assertCurrent);
      temporary.push(...thumb.intermediates);
      await registerMemoryFiles(draft, thumb.intermediates, assertCurrent);
      assertCurrent();
      await new File(full.uri).move(fullFile);
      assertCurrent();
      await new File(thumb.uri).move(thumbFile);
      assertCurrent();
      const photo: LocalMemoryPhoto = { id, fullBytes: full.bytes, thumbBytes: thumb.bytes,
        width: full.width, height: full.height, thumbWidth: thumb.width, thumbHeight: thumb.height, status: 'ready' };
      draft = { ...draft, photos: [...draft.photos, photo] };
      await writeMemoryDraft(draft, assertCurrent);
      complete = true;
    } finally {
      await removeMemoryFiles([...temporary, ...(complete ? [] : [fullFile.uri, thumbFile.uri])]);
    }
  }
  return draft;
}
