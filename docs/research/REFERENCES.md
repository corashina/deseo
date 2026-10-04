# Research sources

Reviewed on 4 October 2026. Product pages can change. Treat feature lists as vendor descriptions, not independent usability evidence.

## Product references

| Source | Observed feature | Deseo decision |
|---|---|---|
| [Cupla product overview](https://www.cupla.app/the-app/) | Shared schedules, tasks, date planning, important dates, saved ideas | Keep manual shared planning, reminders, and user-written date ideas |
| [Cupla calendar explanation](https://www.cupla.app/help/en/articles/15051425-whats-the-difference-between-a-shared-calendar-on-ical-or-google-and-using-cupla) | External calendar aggregation and schedule comparison | Defer provider sync; do not promise complete availability |
| [Couply homepage](https://www.couply.io/) | Questions, quizzes, and relationship content | Retain warmth; exclude scoring and coaching |
| [Couply FAQ](https://www.couply.io/faqs) | Date planner, photo journal, love notes, important-date reminders | Combine these needs with shared planning |

Deseo's screen, data, and architecture decisions are original proposals. They are not claims about either app's internal implementation.

## Skills applied

| Skill | Use |
|---|---|
| [Improve Codebase Architecture](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md) | Review module responsibilities before scaffold work |
| [Codebase Design](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md) | Keep interfaces small and related rules together |
| [Stop Slop](https://github.com/hardikpandya/stop-slop/blob/main/SKILL.md) | Remove vague promises, filler, and formulaic copy |

The architecture review adapts an existing-code skill to a new project. No installer or remote script was executed.

## Platform and library sources

| Source | Planning implication |
|---|---|
| [Expo Router](https://docs.expo.dev/router/introduction/) | Use file-based native navigation and typed links |
| [Expo monorepos](https://docs.expo.dev/guides/monorepos/) | Use supported workspace configuration; avoid custom Metro workarounds |
| [Expo linking](https://docs.expo.dev/linking/overview/) | Configure native links and public installation handoff |
| [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) | Validate native modules in development builds |
| [Expo push](https://docs.expo.dev/push-notifications/overview/) | Use one push integration for APNs and FCM |
| [Expo push delivery](https://docs.expo.dev/push-notifications/sending-notifications/) | Track tickets, receipts, retries, and invalid device tokens |
| [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) | Keep keys small; account for native storage failures and reinstall behavior |
| [MMKV](https://github.com/mrousavy/react-native-mmkv) | Use explicit encryption and account-scoped storage; it is plaintext by default |
| [TanStack Query on React Native](https://tanstack.com/query/latest/docs/framework/react/react-native) | Connect query refresh to network and foreground state |
| [Astro](https://docs.astro.build/en/concepts/why-astro/) | Keep the public site static and focused on content |
| [Supabase Expo guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native) | Use the supported client integration; do not copy its public-profile example policies |
| [Supabase email codes](https://supabase.com/docs/guides/auth/auth-email-passwordless) | Use verified email codes for a passwordless entry flow |
| [Supabase row security](https://supabase.com/docs/guides/database/postgres/row-level-security) | Enforce record access in PostgreSQL |
| [Supabase Cron](https://supabase.com/docs/guides/cron) | Schedule bounded reminder and cleanup work |
| [Supabase changelog](https://supabase.com/changelog) | Recheck SDK, keys, and database changes before provisioning |

The Markdown changelog endpoint failed during this review. The main changelog loaded.

Its reviewed database changes concern existing extension usage. No current Deseo database exists to upgrade.

Recheck current documentation before implementation. Pin the versions selected by the working scaffold, not guessed versions in this plan.

## Store requirements

- [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/): include an in-app deletion path.
- [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111): include the required external deletion resource.

Verify the complete current submission rules before release. These links do not establish legal compliance for an unspecified operator or region.
