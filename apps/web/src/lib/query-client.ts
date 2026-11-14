import { QueryClient } from '@tanstack/react-query';
// Mutations also run offline, so a failed write shows its retry control at once.
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 }, mutations: { networkMode: 'always' } } });
let controller = new AbortController();
// Memories only. Delete with the memories rewrite.
export function captureQueryScope() {
  const current = controller;
  return { signal: current.signal, assertCurrent() {
    if (current !== controller || current.signal.aborted) throw new DOMException('Session changed', 'AbortError');
  } };
}
// Privacy rule: cancel and remove all private reads on sign-out and on account or pair change.
export async function resetPrivateQueries(): Promise<void> {
  controller.abort();
  controller = new AbortController();
  const cancellation = queryClient.cancelQueries();
  queryClient.clear();
  await cancellation;
}
