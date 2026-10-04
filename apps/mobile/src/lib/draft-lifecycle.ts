const writers = new Set<() => Promise<void>>();
let pending: Promise<void> | null = null;
export function registerDraftFlush(writer: () => Promise<void>): () => void {
  writers.add(writer);
  return () => { writers.delete(writer); };
}
export function flushPrivateDrafts(): Promise<void> {
  if (pending) return pending;
  const writes = [...writers].map(writer => {
    try { return writer(); } catch (error) { return Promise.reject(error); }
  });
  pending = Promise.all(writes).then(() => undefined).finally(() => { pending = null; });
  return pending;
}
