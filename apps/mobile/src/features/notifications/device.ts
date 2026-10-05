import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import { getPrivateStorage } from '../../lib/private-storage';
import { captureQueryScope } from '../../lib/query-client';
import { AppError } from '@deseo/domain/result';
import { registerDevice, revokeDevice } from './commands';
import type { Permission } from './types';
let installationPromise: Promise<string> | null = null;
export function installationId(): Promise<string> {
  installationPromise ??= (async () => {
    const storage = await getPrivateStorage(); const saved = await storage.getIntent('pushInstallation');
    if (saved) return saved;
    const id = randomUUID(); await storage.setIntent('pushInstallation', id); return id;
  })().catch(error => { installationPromise = null; throw error; });
  return installationPromise;
}
export function permissionState(settings: Notifications.NotificationPermissionsStatus): Permission {
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL || settings.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL) return 'allowed';
  return settings.status === 'undetermined' ? 'not_requested' : 'denied';
}
export async function readNotificationPermission() { return permissionState(await Notifications.getPermissionsAsync()); }
export async function syncNotificationDevice(request: boolean): Promise<Permission> {
  const scope = captureQueryScope(); const id = await installationId(); scope.assertCurrent();
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') throw new AppError({ code: 'VALIDATION', message: 'Use an Android or iOS development build for push.' });
  let settings = await Notifications.getPermissionsAsync(); scope.assertCurrent();
  if (request && permissionState(settings) === 'not_requested') {
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('updates', { name: 'Deseo updates', importance: Notifications.AndroidImportance.DEFAULT });
    scope.assertCurrent(); settings = await Notifications.requestPermissionsAsync(); scope.assertCurrent();
  }
  const permission = permissionState(settings); let token: string | null = null;
  if (permission === 'allowed') {
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== 'string') throw new AppError({ code: 'RETRYABLE', message: 'Push setup is missing from this build.' });
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data; scope.assertCurrent();
  }
  const result = await registerDevice({ installationId: id, token, platform: Platform.OS, permission }); scope.assertCurrent();
  if (!result.ok) throw new AppError(result.error);
  return permission;
}
export async function revokeCurrentDevice(all: boolean) {
  const result = await revokeDevice(await installationId(), all);
  if (!result.ok) throw new AppError(result.error);
}
