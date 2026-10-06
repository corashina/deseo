import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
let controller = new AbortController();
export function captureQueryScope() {
  const current = controller;
  return { signal: current.signal, assertCurrent() {
    if (current !== controller || current.signal.aborted) throw new DOMException('Session changed', 'AbortError');
  } };
}
export async function resetPrivateQueries(): Promise<void> {
  controller.abort();
  controller = new AbortController();
  const cancellation = queryClient.cancelQueries();
  queryClient.clear();
  await cancellation;
}
