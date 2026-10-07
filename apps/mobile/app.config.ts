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
    'expo-notifications',
    'expo-secure-store',
    'expo-localization',
    'expo-font',
    ['expo-image-picker', {
      photosPermission: 'Choose photos to share in a memory.',
      cameraPermission: false,
      microphonePermission: false,
    }],
    ['expo-media-library', {
      photosPermission: 'Choose photos to share in a memory.',
      savePhotosPermission: 'Save a copy of this photo to your library.',
      granularPermissions: ['photo'],
      isAccessMediaLocationEnabled: false,
    }],
    ['@sentry/react-native/expo', {
      organization: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      disableAutoUpload: !process.env.SENTRY_AUTH_TOKEN,
    }],
    ['expo-splash-screen', { image: './assets/icon.png', imageWidth: 180, backgroundColor: '#FAF7F5' }],
  ],
  experiments: { typedRoutes: true },
  ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID ? { extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } } } : {}),
};

export default config;
