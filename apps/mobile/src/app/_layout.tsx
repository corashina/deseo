import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../features/auth';
import { PairProvider, usePairGate } from '../features/pair';
import { reconcileEventDrafts } from '../features/calendar';
import { queryClient } from '../lib/query-client';
import { theme } from '../theme';
import { FeatureLifecycle } from '../components/FeatureLifecycle';
import { NotificationLifecycle } from '../features/notifications';
import { startCrashReporting, withCrashReporting } from '../lib/crash-reporting';

startCrashReporting();

function Navigation() {
  const { state } = useAuth();
  const gate = usePairGate();
  const signedOut = state.status === 'signedOut';
  const authenticated = state.status === 'authenticated';
  const hasProfile = authenticated && !!state.account;
  const paired = hasProfile && gate.pair?.status === 'active';
  return <Stack screenOptions={{ headerStyle: { backgroundColor: theme.colors.canvas }, headerTintColor: theme.colors.ink,
    contentStyle: { backgroundColor: theme.colors.canvas }, headerBackTitle: 'Back' }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="invite" options={{ title: 'Invitation' }} />
    <Stack.Protected guard={signedOut || (authenticated && !state.account)}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack.Protected>
    <Stack.Protected guard={hasProfile && !!gate.pair}>
      <Stack.Screen name="(pair)" options={{ headerShown: false }} />
    </Stack.Protected>
    <Stack.Protected guard={paired}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="events/new" options={{ title: 'New event' }} />
      <Stack.Screen name="events/[eventId]/index" options={{ title: 'Event' }} />
      <Stack.Screen name="events/[eventId]/edit" options={{ title: 'Edit event' }} />
      <Stack.Screen name="ideas/index" options={{ title: 'Date ideas' }} />
      <Stack.Screen name="ideas/new" options={{ title: 'New idea' }} />
      <Stack.Screen name="ideas/[ideaId]/index" options={{ title: 'Date idea' }} />
      <Stack.Screen name="ideas/[ideaId]/edit" options={{ title: 'Edit idea' }} />
      <Stack.Screen name="tasks/new" options={{ title: 'New task' }} />
      <Stack.Screen name="tasks/[taskId]/index" options={{ title: 'Task' }} />
      <Stack.Screen name="tasks/[taskId]/edit" options={{ title: 'Edit task' }} />
      <Stack.Screen name="tasks/lists/[listId]" options={{ title: 'Task list' }} />
      <Stack.Screen name="memories" options={{ headerShown: false }} />
      <Stack.Screen name="settings/pair" options={{ title: 'Your pair' }} />
      <Stack.Screen name="settings/notifications" options={{ title: 'Notification preferences' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Stack.Protected>
  </Stack>;
}

function RootLayout() {
  return <SafeAreaProvider><QueryClientProvider client={queryClient}><AuthProvider><PairProvider reconcileDrafts={reconcileEventDrafts}>
    <FeatureLifecycle /><NotificationLifecycle /><StatusBar style="dark" /><Navigation />
  </PairProvider></AuthProvider></QueryClientProvider></SafeAreaProvider>;
}

export default withCrashReporting(RootLayout);
