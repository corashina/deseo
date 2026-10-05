# Development workflow

Status: The portal branch includes the reviewed native reminder and backend corrections.
Real push and native device checks remain pending.

## Web portal workspace

Use `codex/deseo-web-portal` in `.worktrees/deseo-web-portal` for portal work.
Keep the existing native app in `apps/mobile`. Add browser screens in `apps/web`.

Use Node `24.18.0`, npm `11.16.0`, and the root lockfile.
The browser app reuses the native React, Query, forms, Zod, Luxon, and Supabase pins.
Web tooling pins: Vite `8.3.2`, React plugin `6.1.2`, Playwright `1.63.0`, and React DOM types `19.2.7`.
See [Vite setup](https://vite.dev/guide/) and [Playwright configuration](https://playwright.dev/docs/test-configuration).

| Command | Purpose |
|---|---|
| `npm run dev:web` | Serve the browser app at `http://127.0.0.1:5174` |
| `npm run build:web` | Build the browser app |
| `npm run preview:web` | Serve the production build at `http://127.0.0.1:4174` |
| `npm run test:web -- <file>` | Run a browser acceptance file |
| `npm run verify:web` | Run browser typecheck, scoped lint, build, and acceptance tests |
| `npm run prepare:web:backend` | Prepare the disposable backend config and source links |
| `npm run start:web:backend` | Prepare and start the `deseo-web` stack |
| `npm run reset:web:backend` | Replay migrations in the verified `deseo-web` stack |
| `npm run test:web:db` | Run SQL tests in that stack |

Both browser servers bind to loopback and reject occupied ports.
Task 1 configures tooling. Task 3 adds the application entry and browser acceptance tests.
Build and browser tests require those files. Do not use empty test passes as acceptance evidence.

Playwright checks Chromium at 1440×1000 and 390×844 against the production preview.
Keep Auth state in `apps/web/playwright/.auth`. Keep credentials in ignored environment files.
Playwright saves reports and traces under `.superpowers/web-tests`.

The dedicated backend lives in `.superpowers/web-backend` and uses project ID `deseo-web`.
Its ports use 55720–55729, including inspector port 55728.
The setup script checks Docker project labels, worktree identity, and listeners before operating on this stack.
Keep the existing 556xx integration stack separate.
Use [the installed CLI help](https://supabase.com/docs/reference/cli/introduction) before changing backend commands.

Run these commands from the portal worktree root:

```powershell
npm run prepare:web:backend
npm run start:web:backend
npm run reset:web:backend
npm run test:web:db
```

Read local keys into the test process without printing them:

```powershell
$webStatus = npx supabase --workdir .superpowers/web-backend status -o json | ConvertFrom-Json
$env:SUPABASE_TEST_URL = 'http://127.0.0.1:55721'
$env:SUPABASE_TEST_PUBLISHABLE_KEY = $webStatus.ANON_KEY
$env:SUPABASE_TEST_SERVICE_ROLE_KEY = $webStatus.SERVICE_ROLE_KEY
npm run test:db:race
npm run test:memories:race
npm run test:notifications:race
Remove-Item Env:SUPABASE_TEST_SERVICE_ROLE_KEY
```

SQL tests include the reminder contract: reject zero minutes; accept 15, 60, and 1440 minutes.
All-day offsets count back from 09:00 in the event timezone.

## Chat 05 integration checks

Use `codex/deseo-integration` in `.worktrees/deseo-05-integration`. The primary checkout remains separate.

Run `supabase/tests/prepare-integration-stack.ps1` to prepare the disposable `deseo-integration` stack.
Its ports use 55620–55629. The script checks listeners before writing its local configuration.
It does not start containers or reset a database.

Set `DO_NOT_TRACK=1` and `SUPABASE_TELEMETRY_DISABLED=true` for local CLI commands.
After Docker starts, use these commands from the integration worktree:

```powershell
npx supabase --workdir .superpowers/integration-backend start
npx supabase --workdir .superpowers/integration-backend db reset --local
npx supabase --workdir .superpowers/integration-backend test db
npx supabase --workdir .superpowers/integration-backend gen types --local --schema public
```

Save successful type output as `apps/mobile/src/lib/database.types.ts`. Do not save failed command output as types.
No shared schema history was rewritten. New notification migrations follow all feature migrations.

All race harnesses default to `http://127.0.0.1:55621`. Supply local test keys through environment variables.
Run core/planning/messages races, memory races, and notification races against this disposable stack.
Notification races require an empty notification table and never call Expo.

```powershell
npm run test:db:race
npm run test:memories:race
npm run test:notifications:race
npm run test:notifications:functions
npm run typecheck:notifications:functions
```

The notification package is `expo-notifications@57.0.21`. Rebuild native development binaries after installing it.
Set `EXPO_PUBLIC_EAS_PROJECT_ID` to the authorized project ID. Source checks need no push credentials.

Workers require `NOTIFICATION_WORKER_SECRET`, with at least 32 characters.
Use `EXPO_ACCESS_TOKEN` when enhanced Expo push security is enabled.
The server runtime supplies `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, and `SUPABASE_SECRET_KEYS`. Use the default key map entries. Keep server keys out of public variables.
Set Vault entries `notification_function_url` and `notification_worker_secret` only for an authorized environment.
The URL points to that environment's `/functions/v1` base. Do not use a production URL for local tests.

Cron invokes dispatch and receipt workers every minute. It refreshes the yearly horizon daily at 00:07 UTC.
Each worker validates the scheduler secret. Its `verify_jwt=false` configuration does not permit anonymous work.

Maestro flows under `apps/mobile/e2e` require an authenticated synthetic pair and existing fixture IDs.
They remain unrun. Record Android and iOS results before claiming Stage B or Stage C acceptance.

Event reminders support 15, 60, or 1440 minutes before their reference time. Zero-offset choices are removed.

## 1. Installed workspace

Read AGENTS.md, STYLE.md, the product design, DATA.md, and the implementation task.

The saved design and Tasks 1–5 are the accepted core scope. Keep existing design assets intact.

The integration branch is `codex/deseo-integration`. The initial documentation commit is `17095fa`.

Use Node `24.18.0` and npm `11.16.0`, as pinned in `.node-version` and `package.json`.

The app uses Expo `57.0.26`, React Native `0.86.3`, React `19.2.3`, and Expo Router `57.0.24`.

Run `npm ci` from the repository root. The workspace contains `apps/mobile` and `apps/web`.

Add dependencies only when their feature task needs them. Keep exact versions and one root lockfile.

Run `npm run verify:mobile` without Docker. This runs native TypeScript, ESLint, and Jest.

Copy `apps/mobile/.env.example` to `.env.local` inside that folder before connecting to a local backend.
Use an API URL reachable from the device. A phone's loopback address refers to that phone.
The Android emulator normally reaches the host through `10.0.2.2`; a physical device needs a reachable host address.

Run `npm run dev:mobile` after installing a development build. MMKV requires native code; Expo Go cannot run this app.
Build Android with `npm run android --workspace @deseo/mobile` when Android tooling is available.
Build iOS with `npm run ios --workspace @deseo/mobile` on macOS with Xcode.
No EAS project, remote backend, build submission, or device installation was created during Chat 01.

## 2. Local environment

| Tool | Purpose |
|---|---|
| Node and npm | Workspace packages, Expo, and Astro |
| Android Studio | Android emulator and native tooling |
| Physical Android phone | Permission, notification, camera, and release checks |
| Physical iPhone or macOS runner | iOS native checks; Windows cannot run an iOS simulator |
| EAS CLI | Development and release builds, including iOS from Windows |
| Supabase CLI and Docker | Local PostgreSQL, Auth, Storage, and database tests |
| Maestro | Native flow tests |

Discover CLI commands with the installed version's help. Keep development and production credentials separate.

Local seed data uses synthetic names and photos. Never copy a real couple's content into fixtures.

## 3. Environment variables

| Location | Values | Exposure |
|---|---|---|
| Mobile `.env.local` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SITE_URL` | Bundled; must contain no secrets |
| Mobile app config | EAS project ID, app scheme, platform identifiers, associated domain | Public build metadata |
| Site environment | `PUBLIC_SITE_URL`, verified iOS/Android store URLs, Supabase URL/publishable key for deletion | Public |
| Backend secrets | Supabase secret key, Expo push access token, scheduled-worker secret, SMTP configuration | Server only |
| CI secrets | EAS/build credentials and environment-scoped deploy credentials | Restricted CI only |

Use `.env.example` files with names and explanations. Never put usable secret values in examples or documentation.

The Supabase client validates settings at first use. Missing settings produce an error; they never activate sample data.

Use separate native identifiers and backend projects for development and production.

## 4. Available commands

Run root scripts from the repository root. Run Expo checks from `apps/mobile`.

| Command | Required behavior |
|---|---|
| `npm ci` | Install the committed workspace lockfile |
| `npm run dev:mobile` | Start the Expo development server |
| `npm run typecheck` | Check current workspace TypeScript |
| `npm run lint` | Check source and module import rules |
| `npm run test:mobile -- <path>` | Run targeted Jest Expo tests |
| `npm run test:db` | Run the local Supabase SQL test suite |
| `npm run test:db:race` | Run concurrent requests with real local Auth accounts |
| `npm run verify:mobile` | Run typecheck, lint, and mobile tests |
| `npm run verify` | Run mobile, SQL, and race checks; requires local Supabase |
| `npx expo-doctor@1.20.4` | Check native dependency and configuration compatibility |
| `npx expo export --platform android --platform ios --output-dir dist` | Produce native JavaScript bundles; does not compile native binaries |

The race script uses Node's built-in TypeScript support. Set its local test keys before running it.
See [the backend guide](../../supabase/README.md) for ports, keys, SQL tests, advisors, and schema generation.

Typecheck the Edge function from the root:

```powershell
npm exec --yes --package deno@2.9.6 -- deno check --frozen --config supabase/functions/verify-sensitive-action/deno.json supabase/functions/verify-sensitive-action/index.ts
```

Typecheck the race harness from the root:

```powershell
node_modules/.bin/tsc.cmd --noEmit --target es2022 --module esnext --moduleResolution bundler --types node --strict --skipLibCheck supabase/tests/pairing-races.test.ts
```

Device builds and Maestro runs have separate environment requirements. Record the exact working commands after setup.

Do not make an unrelated module's tests mandatory before that module exists. Add its suite when the feature starts.

## 5. Database changes

Use local development first. Review RLS, constraints, grants, and execution rights with every schema change.

Create migration filenames through the installed Supabase CLI. Use the task's named migration label.

Generate and inspect database types after changing the schema.

The reviewed backend commit supplies generated `apps/mobile/src/lib/database.types.ts`.
Regenerate this file after schema changes. Runtime Zod schemas validate current responses.

Run SQL tests and advisors. Rebuild the local database from the migration history to verify reproducibility.

Test fresh installation. Do not add compatibility layers for unreleased schema experiments.

Once real users exist, protect their data during schema changes. The rule against legacy paths does not authorize data loss.

## 6. Implementation loop

1. Read the task's spec sections and public interfaces.
2. Rate each proposed test. Write only tests scoring at least 90.
3. Confirm the behavior test fails for the missing behavior.
4. Implement the smallest complete path through UI and persistence.
5. Run the relevant tests and typecheck.
6. Verify device behavior when the task uses native capabilities.
7. Update documentation when a decision changes.
8. Commit only the task's files after verification.

Keep prototype fixtures under docs or test fixtures. Never import the HTML reference's sample state into product modules.

## 7. Dependency rules

Use one Supabase client and one QueryClient per app session.

Use established library features before adding wrappers or utilities. Check current types and documentation first.

Do not duplicate server state in a separate global store.

Use a feature public interface for cross-feature reads. Lint against imports into another feature's internals.

Do not add backend abstractions to make a hypothetical provider replacement easier.

Run `npm audit` before release. The current tree has unresolved upstream advisories recorded in the core handoff.
Do not use `npm audit fix --force` to replace the compatible Expo stack with older major versions.

Use the [architecture review](../architecture/REVIEW.md) when reviewing module structure.
