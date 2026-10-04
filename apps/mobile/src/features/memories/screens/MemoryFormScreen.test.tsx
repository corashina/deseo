// Importance: 95. Recovery must preserve text and enforce author controls on direct routes.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCore } from '../../pair';
import { getMemory } from '../queries';
import { openMemoryDraft, reviewMemoryConflict, submitMemoryDraft } from '../lifecycle';
import { MemoryFormScreen } from './MemoryFormScreen';
import { accountId, draft, memory, pairId } from '../test-fixtures';

let mockSnapshot: { status: string; generation: number; drafts: Record<string, unknown>; busy: boolean; error: string | null; completedId: string | null };
const mockListeners = new Set<() => void>();
jest.mock('../../pair', () => ({ useCore: jest.fn() }));
jest.mock('../queries', () => ({ getMemory: jest.fn(), memoryKeys: { detail: (...parts: string[]) => ['memories', ...parts] } }));
jest.mock('../lifecycle', () => ({
  getMemoryLifecycle: () => mockSnapshot, subscribeMemoryLifecycle: (listener: () => void) => { mockListeners.add(listener); return () => mockListeners.delete(listener); },
  openMemoryDraft: jest.fn().mockResolvedValue(undefined), clearMemoryCompletion: jest.fn(), changeMemoryDraft: jest.fn(), discardCurrentMemoryDraft: jest.fn(), pickMemoryPhotos: jest.fn(),
  restartMemoryDraft: jest.fn(), reviewMemoryConflict: jest.fn().mockResolvedValue(undefined), submitMemoryDraft: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../drafts', () => ({ photoFile: () => ({ uri: 'file:///cache/photo.jpg' }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }));
jest.mock('../../../components/ui/Screen', () => {
  const { View, Text } = jest.requireActual('react-native');
  return { Screen: ({ title, children }: { title: string; children: React.ReactNode }) => <View><Text>{title}</Text>{children}</View> };
});
beforeEach(() => {
  jest.clearAllMocks();
  mockSnapshot = { status: 'ready', generation: 1, drafts: { 'memories:new': draft }, busy: false, error: null, completedId: null };
  jest.mocked(useCore).mockReturnValue({ account: { id: accountId, timezone: 'UTC' }, pair: { status: 'active', pairId }, online: true } as never);
  jest.mocked(getMemory).mockResolvedValue({ ...memory, state: 'published' });
});
async function mount(memoryId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><MemoryFormScreen memoryId={memoryId} /></QueryClientProvider>);
  return client;
}
it('denies a partner edit before opening or writing a local draft', async () => {
  jest.mocked(getMemory).mockResolvedValue({ ...memory, createdBy: pairId, state: 'published' });
  await mount(memory.id);
  await waitFor(() => expect(screen.getByText('Only the author can edit this memory.')).toBeOnTheScreen());
  expect(screen.queryByLabelText('Caption (optional)')).toBeNull();
  expect(openMemoryDraft).not.toHaveBeenCalled();
});
it('shows a recovered caption and requires a tap to retry', async () => {
  mockSnapshot.drafts = { 'memories:new': { ...draft, submitted: true, reserved: true } };
  await mount();
  expect(screen.getByLabelText('Caption (optional)')).toHaveProp('value', draft.caption);
  expect(screen.getByLabelText('Caption (optional)')).toHaveProp('editable', false);
  expect(submitMemoryDraft).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  expect(submitMemoryDraft).toHaveBeenCalledWith('memories:new');
});
it('keeps conflict text while reviewing the latest saved version', async () => {
  const key = `memories:edit:${memory.id}`;
  mockSnapshot.drafts = { [key]: { ...draft, key, expectedVersion: 1, conflict: true, submitted: true, caption: 'My preserved caption' } };
  await mount(memory.id);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review saved version' })).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: 'Review saved version' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Keep my draft' })).toBeOnTheScreen());
  expect(screen.getByLabelText('Caption (optional)')).toHaveProp('value', 'My preserved caption');
  await fireEvent.press(screen.getByRole('button', { name: 'Keep my draft' }));
  expect(reviewMemoryConflict).toHaveBeenCalledWith(expect.objectContaining({ version: memory.version }));
  expect(submitMemoryDraft).not.toHaveBeenCalled();
});
it('removes form text when access is suspended', async () => {
  await mount();
  await act(() => { mockSnapshot = { ...mockSnapshot, status: 'checking', generation: 2, drafts: {} }; mockListeners.forEach(listener => listener()); });
  expect(screen.queryByLabelText('Caption (optional)')).toBeNull();
});
