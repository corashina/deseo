import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Text } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { useTheme } from '../../../theme';
import { readNotificationPermission } from '../device';
import type { Permission } from '../types';
export function DevicePermission({ refresh = 0 }: { refresh?: number }) {
  const theme = useTheme();
  const retryRead = useRef<(() => void) | null>(null);
  const [permission, setPermission] = useState<Permission | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const read = () => { void readNotificationPermission().then(value => { if (live) { setPermission(value); setFailed(false); } }).catch(() => { if (live) setFailed(true); }); };
    retryRead.current = read;
    read(); const listener = AppState.addEventListener('change', state => { if (state === 'active') read(); });
    return () => { live = false; retryRead.current = null; listener.remove(); };
  }, [refresh]);
  return <>
    <Text style={theme.typography.secondary}>{permission === 'allowed' ? 'Notifications are allowed on this device.' : permission === 'denied' ? 'Reminders are off on this device.' : permission === 'not_requested' ? 'Notification permission has not been requested.' : failed ? 'Notification permission is unknown.' : 'Checking notification permission…'}</Text>
    {failed && <Status message="We could not check notification permission." tone="error" actionLabel="Retry" onAction={() => retryRead.current?.()} />}
    {permission === 'denied' && <Button label="Open device settings" variant="text" onPress={() => { void Linking.openSettings().catch(() => setFailed(true)); }} />}
  </>;
}
