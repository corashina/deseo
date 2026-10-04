// Importance: 98. Offline drafts, uncertain retries, and conflict review must preserve work.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdeaFormScreen } from './IdeaFormScreen';
import { useCore } from '../../pair';
import { getDateIdea } from '../date-ideas';
import { createIdea, updateIdea } from '../date-ideas';
import { readIdeaDraft, writeIdeaDraft } from '../idea-drafts';
import type { IdeaDraft } from '../idea-drafts';
jest.mock('../../pair', () => ({ useCore: jest.fn() }), { virtual: true });
jest.mock('../CalendarAccess', () => ({ CalendarAccess: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../realtime', () => ({ useCalendarSignals: jest.fn() }));
jest.mock('../date-ideas', () => { const original = jest.requireActual('../date-ideas'); return { ...original, getDateIdea: jest.fn(), createIdea: jest.fn(), updateIdea: jest.fn() }; });
jest.mock('../../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../idea-drafts', () => ({ readIdeaDraft: jest.fn(), writeIdeaDraft: jest.fn(), removeIdeaDraft: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../lib/query-client', () => ({ captureQueryScope: () => ({ assertCurrent: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '50000000-0000-4000-8000-000000000001' }));
jest.mock('../../../components/ui/Screen', () => { const { View, Text } = jest.requireActual('react-native'); return { Screen: ({ title, children }: { title: string; children: React.ReactNode }) => <View><Text>{title}</Text>{children}</View> }; });
const accountId = '10000000-0000-4000-8000-000000000001';
const pairId = '30000000-0000-4000-8000-000000000001';
const idea = { id: '40000000-0000-4000-8000-000000000001', pairId, authorId: accountId, title: 'Bread', note: '', link: '', state: 'saved' as const, linkedEventId: null, createdAt: '2026-10-04T12:00:00Z', version: 3 };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useCore).mockReturnValue({ account: { id: accountId, displayName: 'Alex', timezone: 'Europe/Warsaw', locale: 'en', status: 'active', version: 1 }, pair: { status: 'active', pairId, timezone: 'Europe/Warsaw', members: [{ userId: accountId, displayName: 'Alex', slot: 'a' }, { userId: '10000000-0000-4000-8000-000000000002', displayName: 'Sam', slot: 'b' }] }, online: true, refresh: jest.fn() });
  jest.mocked(getDateIdea).mockResolvedValue(idea); jest.mocked(readIdeaDraft).mockResolvedValue(null); jest.mocked(writeIdeaDraft).mockResolvedValue(undefined);
});
async function mount(ideaId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><IdeaFormScreen ideaId={ideaId} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByLabelText('Title').props.editable).toBe(true)); return client;
}
it('requires saved-version review before restoring a conflict draft', async () => {
  jest.mocked(updateIdea).mockResolvedValue({ ok: false, error: { code: 'CONFLICT' } });
  await mount(idea.id);
  await fireEvent.changeText(screen.getByLabelText('Title'), 'Local bread');
  await fireEvent.press(screen.getByText('Save changes'));
  await waitFor(() => expect(screen.getByText('Reload saved version')).toBeTruthy());
  expect(updateIdea).toHaveBeenCalledTimes(1);
  jest.mocked(getDateIdea).mockResolvedValue({ ...idea, title: 'Partner bread', version: 4 });
  await fireEvent.press(screen.getByText('Reload saved version'));
  await waitFor(() => expect(screen.getByLabelText('Title').props.value).toBe('Partner bread'));
  await fireEvent.press(screen.getByText('Restore my draft'));
  expect(screen.getByLabelText('Title').props.value).toBe('Local bread');
  expect(updateIdea).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText('Save changes'));
  await waitFor(() => expect(jest.mocked(updateIdea).mock.calls[1]?.[2]).toBe(4));
});
it('preserves uncertain submissions and retries the same IDs after restore', async () => {
  const input = { id: idea.id, pairId, title: idea.title, note: '', link: '' };
  jest.mocked(readIdeaDraft).mockResolvedValue({ id: idea.id, commandId: '50000000-0000-4000-8000-000000000009', values: { title: 'Bread', note: '', link: '' }, submission: input });
  jest.mocked(createIdea).mockResolvedValue({ ok: false, error: { code: 'RETRYABLE' } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><IdeaFormScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByLabelText('Title').props.editable).toBe(false));
  const retries = screen.getAllByText('Retry save');
  await fireEvent.press(retries[retries.length - 1]!);
  await waitFor(() => expect(createIdea).toHaveBeenCalledWith(input, '50000000-0000-4000-8000-000000000009'));
});
it('allows editing offline but disables submission', async () => {
  const base = jest.mocked(useCore)(); jest.mocked(useCore).mockReturnValue({ ...base, online: false });
  await mount();
  await fireEvent.changeText(screen.getByLabelText('Title'), 'Offline bread');
  expect(screen.getByRole('button', { name: 'Save idea' }).props.accessibilityState.disabled).toBe(true);
  await waitFor(() => expect(writeIdeaDraft).toHaveBeenCalled());
  expect(createIdea).not.toHaveBeenCalled();
});
// Importance: 98. Restart during conflict review must retain the user's local edits.
it('restores saved-version review and local edits after remount', async () => {
  let stored: IdeaDraft | null = null;
  jest.mocked(readIdeaDraft).mockImplementation(async () => stored);
  jest.mocked(writeIdeaDraft).mockImplementation(async (_account, _pair, _key, draft) => { stored = JSON.parse(JSON.stringify(draft)) as IdeaDraft; });
  jest.mocked(updateIdea).mockResolvedValue({ ok: false, error: { code: 'CONFLICT' } });
  await mount(idea.id);
  await fireEvent.changeText(screen.getByLabelText('Title'), 'Local bread');
  await fireEvent.press(screen.getByText('Save changes'));
  await waitFor(() => expect(screen.getByText('Reload saved version')).toBeTruthy());
  jest.mocked(getDateIdea).mockResolvedValue({ ...idea, title: 'Partner bread', version: 4 });
  await fireEvent.press(screen.getByText('Reload saved version'));
  await waitFor(() => expect(stored).toMatchObject({ expectedVersion: 4, values: { title: 'Partner bread' } }));
  await screen.unmount();
  await mount(idea.id);
  expect(screen.getByLabelText('Title').props.value).toBe('Partner bread');
  await fireEvent.press(screen.getByText('Restore my draft'));
  expect(screen.getByLabelText('Title').props.value).toBe('Local bread');
  expect(updateIdea).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText('Save changes'));
  await waitFor(() => expect(jest.mocked(updateIdea).mock.calls[1]?.[2]).toBe(4));
});
