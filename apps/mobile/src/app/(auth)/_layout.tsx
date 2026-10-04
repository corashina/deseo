import { Stack } from 'expo-router';
import { useAuth } from '../../features/auth';
export default function AuthLayout() {
  const { state } = useAuth();
  return <Stack screenOptions={{ headerBackTitle: 'Back' }}>
    <Stack.Protected guard={state.status === 'signedOut'}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="email" options={{ title: 'Email' }} />
      <Stack.Screen name="verify" options={{ title: 'Verify email' }} />
    </Stack.Protected>
    <Stack.Protected guard={state.status === 'authenticated' && !state.account}>
      <Stack.Screen name="profile" options={{ headerShown: false }} />
    </Stack.Protected>
  </Stack>;
}
