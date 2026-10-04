import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useAuth } from '../auth';
import { usePairGate } from '../pair';
import { queryClient } from '../../lib/query-client';
import { syncNotificationDevice } from './device';
import { notificationIdFromPayload } from './navigation';
// Foreground updates refresh app records; the app does not display a second local push.
export function NotificationLifecycle() {
  const { state } = useAuth(); const gate = usePairGate();
  const accountId = state.status === 'authenticated' ? state.account?.id : null;
  const pairId = gate.pair?.status === 'active' ? gate.pair.pairId : null;
  useEffect(() => {
    if (!accountId || !pairId) return;
    let active = true; let syncing = false; let syncAgain = false;
    const sync = async () => {
      if (syncing) { syncAgain = true; return; } syncing = true;
      try { await syncNotificationDevice(false); } catch { /* Settings and reminder controls report permission/setup failures. */ }
      finally { syncing = false; if (syncAgain && active) { syncAgain = false; void sync(); } }
    };
    const response = (event: Notifications.NotificationResponse) => {
      if (!active) return;
      const id = notificationIdFromPayload(event.notification.request.content.data);
      Notifications.clearLastNotificationResponse();
      if (id) router.push({ pathname: '/notifications', params: { notificationId: id } });
    };
    void sync(); const previous = Notifications.getLastNotificationResponse(); if (previous) response(previous);
    const opened = Notifications.addNotificationResponseReceivedListener(response);
    const received = Notifications.addNotificationReceivedListener(() => { void queryClient.invalidateQueries({ queryKey: ['notifications'] }); });
    const tokens = Notifications.addPushTokenListener(() => { void sync(); });
    const app = AppState.addEventListener('change', value => { if (value === 'active') void sync(); });
    return () => { active = false; opened.remove(); received.remove(); tokens.remove(); app.remove(); };
  }, [accountId, pairId]);
  return null;
}
