import type { Memory } from '@deseo/domain/memories';
import type { MemoryDraft } from './types';
export const accountId = '741dd351-3376-4622-a9bd-ab9ced5fac8d';
export const pairId = '610bc9c7-8c81-47d1-894e-314c92071cf1';
export const id = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
export const photoId = 'c8cf3be1-51dc-492e-85c6-4cfb634b4590';
export const photo = { id: photoId, order: 0, fullPath: `${pairId}/${id}/${photoId}.jpg`, thumbPath: `${pairId}/${id}/${photoId}-thumb.jpg`,
  fullBytes: 100, thumbBytes: 50, width: 100, height: 100, thumbWidth: 50, thumbHeight: 50, validated: false };
export const memory: Memory = { id, pairId, createdBy: accountId, memoryDate: '2026-10-04', caption: 'A walk', state: 'pending', version: 1,
  createdAt: '2026-10-04T10:00:00Z', updatedAt: '2026-10-04T10:00:00Z', expiresAt: '2026-10-05T10:00:00Z', photos: [photo] };
export const draft: MemoryDraft = { accountId, pairId, id, draftId: id, key: 'memories:new', memoryDate: memory.memoryDate,
  caption: memory.caption, photos: [{ id: photoId, fullBytes: 100, thumbBytes: 50, width: 100, height: 100, thumbWidth: 50, thumbHeight: 50, status: 'ready' }],
  reserveCommandId: photoId, publishCommandId: accountId, commandId: pairId, reserved: false, submitted: false, conflict: false, selectionToken: null };
