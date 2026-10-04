import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.colors.link,
    tabBarInactiveTintColor: theme.colors.muted, tabBarStyle: { backgroundColor: theme.colors.surface } }}>
    <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} /> }} />
  </Tabs>;
}
