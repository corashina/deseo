import * as Sentry from '@sentry/react-native';

// Breadcrumbs from these categories can hold request URLs with pair and record IDs, or logged user text.
const privateCategories = new Set(['console', 'fetch', 'xhr', 'navigation']);

export function startCrashReporting(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    beforeBreadcrumb: (breadcrumb) => (privateCategories.has(breadcrumb.category ?? '') ? null : breadcrumb),
  });
}

export const withCrashReporting = Sentry.wrap;
