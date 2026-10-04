import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Deseo',
  slug: 'deseo',
  version: '0.1.0',
  scheme: 'deseo-dev',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: { supportsTablet: true, bundleIdentifier: 'dev.deseo.mobile' },
  android: {
    package: 'dev.deseo.mobile',
    adaptiveIcon: { foregroundImage: './assets/icon.png', backgroundColor: '#FAF7F5' },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    'expo-font',
    ['expo-splash-screen', { image: './assets/icon.png', imageWidth: 180, backgroundColor: '#FAF7F5' }],
  ],
  experiments: { typedRoutes: true },
};

export default config;
