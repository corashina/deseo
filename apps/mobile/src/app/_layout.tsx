import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../features/auth';
import { PairProvider, usePairGate } from '../features/pair';
import { reconcileEventDrafts } from '../features/calendar';
import { queryClient } from '../lib/query-client';
import { theme } from '../theme';

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
      <Stack.Screen name="settings/pair" options={{ title: 'Your pair' }} />
    </Stack.Protected>
  </Stack>;
}

export default function RootLayout() {
  return <SafeAreaProvider><QueryClientProvider client={queryClient}><AuthProvider><PairProvider reconcileDrafts={reconcileEventDrafts}>
    <StatusBar style="dark" /><Navigation />
  </PairProvider></AuthProvider></QueryClientProvider></SafeAreaProvider>;
}
