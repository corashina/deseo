// Importance: 100. Deleted images and access changes must remove mounted private image sources.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

// Importance 92: photo failures require a local retry without opening another memory.
it('recovers a failed photo and keeps navigation separate', async () => {
  const onOpen = jest.fn();
  jest.mocked(getMemoryMedia).mockResolvedValue({ ok: false, error: { code: 'RETRYABLE' } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><MemoryImage photoId="photo" variant="thumb" width={512} height={307} onOpen={onOpen} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry photo' })).toBeOnTheScreen());
  jest.mocked(getMemoryMedia).mockResolvedValue({ ok: true, data: { url: 'https://example.com/recovered.jpg', expiresAt: '2026-10-04T12:00:00Z' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Retry photo' }));
  await waitFor(() => expect(screen.getByTestId('private-photo')).toHaveProp('source', { uri: 'https://example.com/recovered.jpg' }));
  expect(onOpen).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Open memory' }));
  expect(onOpen).toHaveBeenCalledTimes(1);
});
