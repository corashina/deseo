import { useLocalSearchParams } from 'expo-router';
import { NotificationListScreen } from '../features/notifications';
export default function NotificationsRoute() {
  const { notificationId } = useLocalSearchParams<{ notificationId?: string }>();
  return <NotificationListScreen notificationId={typeof notificationId === 'string' ? notificationId : undefined} />;
}
