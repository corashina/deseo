import { Image, Linking, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { theme } from '../../../theme';

export function WelcomeScreen() {
  const site = process.env.EXPO_PUBLIC_SITE_URL;
  return <Screen title="Deseo" subtitle="Plan your days together.">
    <Image source={require('../../../../assets/icon.png')} accessibilityLabel="Deseo: two voices" style={{ width: 160, height: 160, alignSelf: 'center', borderRadius: 36 }} />
    <Text style={theme.typography.body}>A private place for you and your partner to share plans.</Text>
    <Button label="Continue with email" onPress={() => router.push('/(auth)/email')} />
    {site && <>
      <Button label="Privacy" variant="text" onPress={() => { void Linking.openURL(`${site}/privacy`); }} />
      <Button label="Terms" variant="text" onPress={() => { void Linking.openURL(`${site}/terms`); }} />
    </>}
  </Screen>;
}
