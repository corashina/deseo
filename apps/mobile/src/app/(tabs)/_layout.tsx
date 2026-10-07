import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useQuery } from '@tanstack/react-query';
import { getUnreadCount, messageKeys } from '../../features/messages';
import { usePairGate } from '../../features/pair';
export default function TabsLayout() {
  const theme = useTheme();
  const { account, pair } = usePairGate();
  const accountId = account?.id ?? '';
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const unread = useQuery({ queryKey: messageKeys.unread(accountId, pairId), queryFn: () => getUnreadCount(pairId),
    enabled: !!accountId && !!pairId });
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.colors.link,
    tabBarInactiveTintColor: theme.colors.muted, tabBarStyle: { backgroundColor: theme.colors.surface } }}>
    <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="memories" options={{ title: 'Memories', tabBarIcon: ({ color, size }) => <Ionicons name="images-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarBadge: !unread.isError && unread.data ? Math.min(unread.data, 99) : undefined,
      tabBarAccessibilityLabel: unread.isError ? 'Messages, unread count unavailable' : `Messages, ${unread.data ?? 0} unread`,
      tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: ({ color, size }) => <Ionicons name="checkbox-outline" color={color} size={size} /> }} />
  </Tabs>;
}
