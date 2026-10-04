// Importance: 98. A conflict must preserve the user's draft and block silent overwrite.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { EventFormScreen } from './EventFormScreen';
import { useCore } from '../../pair';
import { getEvent } from '../queries';
import { updateEvent } from '../commands';
import { readEventDraft, writeEventDraft } from '../drafts';

jest.mock('../../pair', () => ({ useCore: jest.fn() }), { virtual: true });
jest.mock('../queries', () => ({ getEvent: jest.fn(), calendarKeys: { event: (account: string, pair: string, id: string) => ['calendar', account, pair, id] } }));
jest.mock('../commands', () => ({ createEvent: jest.fn(), updateEvent: jest.fn() }));
jest.mock('../drafts', () => ({ readEventDraft: jest.fn(), writeEventDraft: jest.fn(), removeEventDraft: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../lib/query-client', () => ({ captureQueryScope: () => ({ assertCurrent: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'c8cf3be1-51dc-492e-85c6-4cfb634b4590' }));
jest.mock('../../../components/ui/Screen', () => {
  const { View, Text } = jest.requireActual('react-native');
  return { Screen: ({ title, children }: { title: string; children: React.ReactNode }) => <View><Text>{title}</Text>{children}</View> };
});

const id = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
const pairId = '610bc9c7-8c81-47d1-894e-314c92071cf1';
const accountId = '741dd351-3376-4622-a9bd-ab9ced5fac8d';
const event = { id, pairId, authorId: accountId, title: 'Dinner', owner: 'a' as const, visibility: 'shared' as const, timezone: 'Europe/Warsaw', temporal: { kind: 'allDay' as const, startDate: '2026-07-01', endDateExclusive: '2026-07-02' }, version: 3 };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useCore).mockReturnValue({ account: { id: accountId, displayName: 'Alex', timezone: 'Europe/Warsaw', locale: 'en', status: 'active', version: 1 },
    pair: { status: 'active', pairId, timezone: 'Europe/Warsaw', members: [{ userId: accountId, displayName: 'Alex', slot: 'a' }, { userId: 'partner', displayName: 'Sam', slot: 'b' }] }, online: true, refresh: jest.fn() });
  jest.mocked(getEvent).mockResolvedValue(event);
  jest.mocked(readEventDraft).mockResolvedValue(null);
  jest.mocked(writeEventDraft).mockResolvedValue(undefined);
});
async function mount(eventId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><EventFormScreen eventId={eventId} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByLabelText('Title')).toHaveProp('editable', true));
  return client;
}
it('offers the preserved draft after a conflict without an automatic second save', async () => {
  jest.mocked(updateEvent).mockResolvedValue({ ok: false, error: { code: 'CONFLICT' } });
  await mount(id);
  await fireEvent.changeText(screen.getByLabelText('Title'), 'My dinner');
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Return to draft' })).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: 'Return to draft' }));
  expect(screen.getByLabelText('Title')).toHaveProp('value', 'My dinner');
  expect(updateEvent).toHaveBeenCalledTimes(1);
  expect(jest.mocked(updateEvent).mock.calls[0]![2]).toBe(3);
});
it('keeps the same payload and command ID for a deliberate retry', async () => {
  jest.mocked(updateEvent).mockResolvedValue({ ok: false, error: { code: 'RETRYABLE' } });
  await mount(id);
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByLabelText('Title')).toHaveProp('editable', false));
  const buttons = screen.getAllByRole('button', { name: 'Retry save' });
  await fireEvent.press(buttons[0]!);
  await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(2));
  expect(jest.mocked(updateEvent).mock.calls[0]).toEqual(jest.mocked(updateEvent).mock.calls[1]);
});
// Importance: 98. Storage errors must not claim local persistence or send an untracked command.
it('blocks the save and explains encrypted draft failure', async () => {
  jest.mocked(writeEventDraft).mockRejectedValue(new Error('storage unavailable'));
  await mount(id);
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(screen.getByText('We could not save your draft on this device. Keep this screen open.')).toBeOnTheScreen());
  expect(updateEvent).not.toHaveBeenCalled();
});
// Importance: 98. Restoring an edit must retain its original version after restart.
it('restores the original draft version instead of using the latest event version', async () => {
  jest.mocked(readEventDraft).mockResolvedValue({ id, commandId: 'c8cf3be1-51dc-492e-85c6-4cfb634b4590', expectedVersion: 2,
    values: { title: 'My old draft', allDay: true, startDate: '2026-07-01', endDate: '2026-07-01', startTime: '', endTime: '',
      timezone: 'Europe/Warsaw', owner: 'a', visibility: 'shared', location: '', description: '' } });
  jest.mocked(updateEvent).mockResolvedValue({ ok: false, error: { code: 'CONFLICT' } });
  await mount(id);
  expect(screen.getByLabelText('Title')).toHaveProp('value', 'My old draft');
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1));
  expect(jest.mocked(updateEvent).mock.calls[0]![2]).toBe(2);
});
// Importance: 100. A private event requires an explicit sharing choice.
it('requires consent before sharing a private event', async () => {
  jest.mocked(getEvent).mockResolvedValue({ ...event, visibility: 'private' });
  jest.mocked(updateEvent).mockResolvedValue({ ok: false, error: { code: 'CONFLICT' } });
  const confirm = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await mount(id);
  await fireEvent.press(screen.getByRole('button', { name: 'Shared' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(confirm).toHaveBeenCalledWith('Share this event?', expect.any(String), expect.any(Array)));
  expect(updateEvent).not.toHaveBeenCalled();
  const buttons = confirm.mock.calls[0]![2]!;
  await act(async () => { buttons.find((button) => button.text === 'Share event')!.onPress!(); });
  await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1));
  expect(jest.mocked(updateEvent).mock.calls[0]![1].confirmShared).toBe(true);
  confirm.mockRestore();
});
