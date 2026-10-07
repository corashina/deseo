import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from '../features/auth';
import { PairProvider, usePairGate } from '../features/pair';
import { reconcileEventDrafts } from '../features/calendar';
import { queryClient } from '../lib/query-client';
import { theme } from '../theme';
import { Status } from '../components/ui/Status';
import { FeatureLifecycle } from '../components/FeatureLifecycle';
import { NotificationLifecycle } from '../features/notifications';

function Navigation() {
  const { state, verifying } = useAuth();
  const gate = usePairGate();
  // Screens stay mounted during a resume check. The cover hides them until the account and pair are confirmed.
  const covered = verifying || gate.verifying;
  const signedOut = state.status === 'signedOut';
  const authenticated = state.status === 'authenticated';
  const hasProfile = authenticated && !!state.account;
  const paired = hasProfile && gate.pair?.status === 'active';
  return <View style={styles.fill}>
  <View style={styles.fill} accessibilityElementsHidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>
  <Stack screenOptions={{ headerStyle: { backgroundColor: theme.colors.canvas }, headerTintColor: theme.colors.ink,
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
  </Stack>
  </View>
  {covered && <View style={styles.cover}><Status tone="loading" message="Checking your account…" /></View>}
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.canvas, justifyContent: 'center', padding: theme.space[4] },
});

export default function RootLayout() {
  return <SafeAreaProvider><QueryClientProvider client={queryClient}><AuthProvider><PairProvider reconcileDrafts={reconcileEventDrafts}>
    <FeatureLifecycle /><NotificationLifecycle /><StatusBar style="dark" /><Navigation />
  </PairProvider></AuthProvider></QueryClientProvider></SafeAreaProvider>;
}
