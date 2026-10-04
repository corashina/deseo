// Importance: 100. Deleted images and access changes must remove mounted private image sources.
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryImage } from './MemoryImage';
import { getMemoryMedia } from '../queries';

let mockAccess = { status: 'ready', generation: 1, accountId: 'account', pairId: 'pair' };
const mockListeners = new Set<() => void>();
jest.mock('../lifecycle', () => ({ getMemoryLifecycle: () => mockAccess,
  subscribeMemoryLifecycle: (listener: () => void) => { mockListeners.add(listener); return () => mockListeners.delete(listener); } }));
jest.mock('../queries', () => ({ getMemoryMedia: jest.fn(), memoryKeys: { media: (...parts: string[]) => ['memories', ...parts] } }));
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: (props: object) => <View testID="private-photo" {...props} /> };
});
beforeEach(() => {
  mockAccess = { status: 'ready', generation: 1, accountId: 'account', pairId: 'pair' };
  jest.mocked(getMemoryMedia).mockResolvedValue({ ok: true, data: { url: 'https://example.com/private.jpg', expiresAt: '2026-10-04T12:00:00Z' } });
});
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><MemoryImage photoId="photo" variant="full" width={100} height={100} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('private-photo')).toBeOnTheScreen());
  return client;
}
it('removes the image when a refetch confirms deletion despite retained query data', async () => {
  const client = await mount();
  jest.mocked(getMemoryMedia).mockResolvedValue({ ok: false, error: { code: 'FORBIDDEN' } });
  await act(async () => { await client.invalidateQueries({ queryKey: ['memories'] }); });
  await waitFor(() => expect(screen.queryByTestId('private-photo')).toBeNull());
});
it('clears the source immediately when the access generation changes', async () => {
  await mount();
  await act(() => { mockAccess = { ...mockAccess, status: 'checking', generation: 2 }; mockListeners.forEach(listener => listener()); });
  expect(screen.queryByTestId('private-photo')).toBeNull();
});
