import { Image, Linking, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { theme } from '../../../theme';

export function WelcomeScreen() {
  const site = process.env.EXPO_PUBLIC_SITE_URL;
  return <Screen title="Deseo">
    <Image source={require('../../../../assets/icon.png')} accessibilityLabel="Deseo: two voices" style={styles.icon} />
    <Text style={theme.typography.body}>Share plans, messages, and memories with your partner.</Text>
    <Button label="Continue with email" onPress={() => router.push('/(auth)/email')} />
    {site && <>
      <Button label="Privacy" variant="text" onPress={() => { void Linking.openURL(`${site}/privacy`); }} />
      <Button label="Terms" variant="text" onPress={() => { void Linking.openURL(`${site}/terms`); }} />
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  icon: { width: 120, height: 120, borderRadius: 24 },
});
