// Importance: 98. Permission prompts need user intent; stale accounts must not register tokens.
import * as Notifications from 'expo-notifications';
import { syncNotificationDevice } from './device';
import { getPrivateStorage } from '../../lib/private-storage';
import { registerDevice } from './commands';
jest.mock('expo-notifications', () => ({ getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(), AndroidImportance: { DEFAULT: 3 }, IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { easConfig: { projectId: '610bc9c7-8c81-47d1-894e-314c92071cf1' } } }));
jest.mock('../../lib/private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('./commands', () => ({ registerDevice: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: jest.fn(() => ({ assertCurrent: jest.fn() })) }));
import { captureQueryScope } from '../../lib/query-client';
const installationId = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
beforeEach(() => {
  jest.mocked(getPrivateStorage).mockResolvedValue({ getIntent: jest.fn().mockResolvedValue(installationId), setIntent: jest.fn() } as never);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false, status: 'undetermined' } as never);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: false, status: 'denied' } as never);
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: 'ExpoPushToken[test]', type: 'expo' });
  jest.mocked(registerDevice).mockResolvedValue({ ok: true, data: { deviceId: installationId } });
  jest.mocked(captureQueryScope).mockImplementation(() => ({ assertCurrent: jest.fn() }) as never);
});
test('reads permission without prompting during resume', async () => {
  expect(await syncNotificationDevice(false)).toBe('not_requested');
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  expect(registerDevice).toHaveBeenCalledWith(expect.objectContaining({ permission: 'not_requested', token: null }));
});
test('registers denial without obtaining a token', async () => {
  expect(await syncNotificationDevice(true)).toBe('denied');
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
});
test('does not register after account scope changes during a native request', async () => {
  let calls = 0;
  jest.mocked(captureQueryScope).mockReturnValue({ assertCurrent: () => { if (++calls > 1) throw new Error('account changed'); } } as never);
  await expect(syncNotificationDevice(true)).rejects.toThrow('account changed');
  expect(registerDevice).not.toHaveBeenCalled();
});
