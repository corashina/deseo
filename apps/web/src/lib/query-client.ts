import { QueryClient } from '@tanstack/react-query';
// Mutations also run offline, so a failed write shows its retry control at once.
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 }, mutations: { networkMode: 'always' } } });
// Privacy rule: cancel and remove all private reads on sign-out and on account or pair change.
export async function resetPrivateQueries(): Promise<void> {
  const cancellation = queryClient.cancelQueries();
  queryClient.clear();
  await cancellation;
}
