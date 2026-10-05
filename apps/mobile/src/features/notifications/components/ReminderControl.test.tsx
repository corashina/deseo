// Importance: 98. Reminder choices must stay private, require intent, and preserve retry identity.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReminderControl } from './ReminderControl';
import { setReminder } from '../commands';
import { syncNotificationDevice } from '../device';
import { getReminder } from '../queries';
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'c8cf3be1-51dc-492e-85c6-4cfb634b4590') }));
jest.mock('../../pair', () => ({ useCore: () => ({ account: { id: 'account-a' }, pair: { status: 'active', pairId: '610bc9c7-8c81-47d1-894e-314c92071cf1' }, online: true }) }));
jest.mock('../commands', () => ({ setReminder: jest.fn() }));
jest.mock('../device', () => ({ syncNotificationDevice: jest.fn(), readNotificationPermission: jest.fn().mockResolvedValue('not_requested') }));
jest.mock('../queries', () => ({ getReminder: jest.fn(), getNotificationPreferences: jest.fn().mockResolvedValue({ defaultEventReminderMinutes: 15 }),
  notificationKeys: { reminder: (...args: string[]) => ['reminder', ...args], preferences: (...args: string[]) => ['preferences', ...args] } }));
jest.mock('../../../lib/query-client', () => ({ captureQueryScope: () => ({ assertCurrent: jest.fn() }) }));
const id = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
beforeEach(() => { jest.mocked(getReminder).mockResolvedValue(null); jest.mocked(syncNotificationDevice).mockResolvedValue('denied');
  jest.mocked(setReminder).mockResolvedValue({ ok: false, error: { code: 'RETRYABLE' } }); });
test('waits for Save before requesting permission and keeps retry identity', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><ReminderControl eventId={id} sourceVersion={1} timezone="Europe/Warsaw" /></QueryClientProvider>);
  await screen.findByText('Your reminder');
  expect(syncNotificationDevice).not.toHaveBeenCalled();
  expect(await screen.findByText('Selected: 15 minutes before')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save reminder'));
  await waitFor(() => expect(setReminder).toHaveBeenCalledTimes(1));
  await screen.findByText('We could not complete this request. Try again.');
  await fireEvent.press(screen.getByText('Save reminder'));
  await waitFor(() => expect(setReminder).toHaveBeenCalledTimes(2));
  expect(jest.mocked(setReminder).mock.calls[0]).toEqual(jest.mocked(setReminder).mock.calls[1]);
  client.clear();
});
// Importance: 98. Event choices must leave a delivery window before timed and all-day expiry.
test.each([false, true])('offers only advance reminders for allDay=%s', async allDay => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><ReminderControl eventId={id} sourceVersion={1} timezone="Europe/Warsaw" allDay={allDay} /></QueryClientProvider>);
  await screen.findByText('Your reminder');
  expect(screen.queryByText('At start')).toBeNull();
  expect(screen.queryByText('At 09:00')).toBeNull();
  expect(screen.getByText('None')).toBeTruthy();
  if (allDay) expect(screen.getByText('Choose how long before 09:00 in Europe/Warsaw to receive an all-day reminder.')).toBeTruthy();
  for (const [minutes, label] of [[15, allDay ? '15 minutes before 09:00' : '15 minutes before'],
    [60, allDay ? 'One hour before 09:00' : 'One hour before'], [1440, allDay ? '24 hours before 09:00' : 'One day before']] as const) {
    await fireEvent.press(screen.getByText(new RegExp(`^(Selected: )?${label}$`)));
    await fireEvent.press(screen.getByText('Save reminder'));
    await waitFor(() => expect(setReminder).toHaveBeenLastCalledWith(expect.objectContaining({ minutesBefore: minutes, active: true }), expect.any(String)));
    await screen.findByText('We could not complete this request. Try again.');
  }
  client.clear();
});
// Importance: 98. A partner's edit must refresh the server's recalculated reminder time.
test('reads the reminder again after the source version changes', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000, gcTime: 0 } } });
  const view = await render(<QueryClientProvider client={client}><ReminderControl eventId={id} sourceVersion={1} timezone="Europe/Warsaw" /></QueryClientProvider>);
  await screen.findByText('Your reminder');
  expect(getReminder).toHaveBeenCalledTimes(1);
  await view.rerender(<QueryClientProvider client={client}><ReminderControl eventId={id} sourceVersion={2} timezone="Europe/Warsaw" /></QueryClientProvider>);
  await waitFor(() => expect(getReminder).toHaveBeenCalledTimes(2));
  client.clear();
});
