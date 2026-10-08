// Importance: 95. Failed permission reads need local Retry and app-focus recovery without prompting.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { DevicePermission } from './DevicePermission';
import { readNotificationPermission, syncNotificationDevice } from '../device';

jest.mock('../device', () => ({ readNotificationPermission: jest.fn(), syncNotificationDevice: jest.fn() }));

test('retries a failed permission read and keeps app-focus recovery', async () => {
  let onFocus: (state: AppStateStatus) => void = () => {};
  const remove = jest.fn();
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    onFocus = callback;
    return { remove };
  });
  jest.mocked(readNotificationPermission).mockRejectedValueOnce(new Error('Read failed'))
    .mockResolvedValueOnce('allowed').mockResolvedValueOnce('denied');
  try {
    await render(<DevicePermission />);
    await screen.findByText('We could not check notification permission.');
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Notifications are allowed on this device.');
    expect(screen.queryByText('We could not check notification permission.')).toBeNull();
    await act(() => { onFocus('active'); });
    await screen.findByText('Reminders are off on this device.');
    expect(screen.getByRole('button', { name: 'Open device settings' })).toBeTruthy();
    expect(readNotificationPermission).toHaveBeenCalledTimes(3);
    expect(syncNotificationDevice).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
  } finally { listener.mockRestore(); }
});
