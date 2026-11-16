import type { Memory } from '@deseo/domain/memories';
// A memory without a caption shows one name everywhere.
export const memoryTitle = (memory: Memory) => memory.caption || 'Our memory';
