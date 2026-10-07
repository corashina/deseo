# Development

Use Node 24.18.0, npm 11.16.0, and the committed root lockfile.
Read AGENTS.md, STYLE.md, the approved portal design, ARCHITECTURE.md, and DATA.md before product work.

## 1. Install and verify source

Run these commands from the repository root:

```powershell
npm ci
npm run verify:mobile
npm run test:domain
```

Mobile verification runs native TypeScript, lint, and Jest. It does not require Docker.
The domain suite checks shared schemas, payloads, and results.
Keep exact pins. Add packages only when a feature needs them.

## 2. Local browser backend

Run Docker Desktop. Use one `deseo` project from the repository root.
Its API uses 55721, database 55722, mail 55724, and inspector 55728.

```powershell
npm run start:backend
```

Set CLI telemetry controls before direct commands:

```powershell
$env:DO_NOT_TRACK = '1'
$env:SUPABASE_TELEMETRY_DISABLED = 'true'
```

The start command saves status in `.superpowers/backend/status.local.json`. Keep this ignored file private.

Refresh the saved status with `npm run status:backend`.

Create `apps/web/.env.local` from `.env.example` and use the local publishable key.

| Browser variable | Use |
|---|---|
| `VITE_SUPABASE_URL` | API address; local value `http://127.0.0.1:55721` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser key |

Browser invitations use `location.origin`. The portal has no separate site-URL environment setting.
Do not add the unused planned `VITE_SITE_URL` variable.

## 3. One Edge origin

Start one Edge process in a separate terminal. Stop it before changing modes.

Development:

```powershell
npm run start:functions -- -Mode Development
npm run dev:web
```

Tests:

```powershell
npm run start:functions -- -Mode Test
npm run verify:web
```

Run each second command in another terminal while Edge remains active.
Development uses `http://127.0.0.1:5174`. Tests use `http://127.0.0.1:4174`.
Stop the other portal server before switching modes. The guarded script rejects the conflicting listener.
Playwright starts and stops its own preview. Run Windows browser checks elevated for Docker and owned process teardown.

| Server variable | Use |
|---|---|
| `WEB_APP_ORIGIN` | One exact browser origin selected by mode |
| `PUBLIC_SUPABASE_URL` | Reachable public API address for signed media links |
| `SUPABASE_URL` | Runtime-injected internal address for server calls |

Keep injected internal configuration intact. A deployed public API address must also be reachable by mobile devices.

Local Kong intercepts OPTIONS and stamps wildcard CORS headers.
The handler rejects unknown and null origins before work. Native calls can omit Origin.
See [the handoff](../handoffs/web-portal.md) for live measurements and deployment limits.

## 4. Named pair and gallery

With the local backend and Edge process running:

```powershell
npm run seed:web
```

The command creates or reuses Anna and Marek with stable content IDs.
Their emails are `anna@deseo.example.test` and `marek@deseo.example.test`.
Use the ordinary sign-in screen and codes from the local mail inbox at `http://127.0.0.1:55724`.

Open [the gallery](../design/web-portal/index.html) for route, state, viewport, and fixture evidence.
Use disposable fixtures for failures, end-pair actions, and destructive tests.
Remove only IDs recorded by ownership journals. Preserve unknown rows and user edits.

## 5. Backend checks

Run SQL checks against the combined development database:

```powershell
npm run test:db
```

The SQL suites use fixture IDs and roll back their transactions. Preserve development records and unknown rows.
Run race tests separately from browser tests. Set test keys from the ignored backend status file.
All race harnesses use API 55721. Notification races require an empty notification table.
Memory races require empty memory and cleanup tables because their workers claim jobs across the database.
Do not reset the development database to satisfy these requirements.

On 2026-10-07, the `deseo` backend combined the web and integration development data.
The private backups and transfer checks are in `.superpowers/consolidation`.
Docker retains the original database and storage volumes as backups.
Use `npm run start:backend` for the single current project.

Run Edge checks from the root:

```powershell
npm run test:memories:functions
npm run typecheck:memories:functions
npm run test:notifications:functions
npm run typecheck:notifications:functions
npm exec --yes --package deno@2.9.6 -- deno check --frozen --config supabase/functions/verify-sensitive-action/deno.json supabase/functions/verify-sensitive-action/index.ts
```

The sensitive function has its own committed dependency map. Use its config for standalone checks.
Discover CLI options through the installed help before changing commands.

After you change a migration, regenerate the shared database types from a running local stack:

```powershell
npm run gen:types
```

The command writes `packages/domain/src/database.types.ts`. Mobile and web create their clients from it.
CI fails when the committed file differs from the schema.

### Continuous integration

`.github/workflows/ci.yml` runs on pushes to `master` and on every pull request.

- The apps job runs `verify:mobile`, the domain tests, and the web typecheck, lint, and build.
- The backend job starts Supabase and runs the SQL suites, the type check, the three race harnesses, and the Deno function checks.

Playwright portal tests need the seeded development backend and its Edge functions. Run them locally with `npm run test:web`.

## 6. Expo mobile

Copy `apps/mobile/.env.example` to its `.env.local` before connecting a native build.
Use `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for that backend.
Native links use `EXPO_PUBLIC_SITE_URL`; configured development push uses `EXPO_PUBLIC_EAS_PROJECT_ID`.
These values are public build configuration. Keep server keys out of them.

A phone's loopback address refers to that phone. Use an API address the device can reach.
Android emulators can use `10.0.2.2`; physical devices need a reachable host address.

```powershell
npm run dev:mobile
npm run android --workspace @deseo/mobile
npm run ios --workspace @deseo/mobile
npm exec --workspace @deseo/mobile -- expo export --platform android --platform ios --output-dir dist
```

MMKV needs a development build. Expo Go cannot run its native storage.
Android requires installed Android tooling. iOS local builds require macOS and Xcode.
JavaScript exports verify bundling; physical device, push, native binary, and store checks remain separate.

The app follows the device appearance. Read colors from `useTheme()` and build styles with `makeStyles()` from `src/theme`.

### Phone preview build

A preview build installs on both phones without a store. Android gets an APK; iOS needs a registered device.

1. Sign in once: `npm exec --yes --package eas-cli@24.11.0 -- eas login`.
2. In `apps/mobile`, link the project: `npm exec --yes --package eas-cli@24.11.0 -- eas init`. Save the project ID as `EXPO_PUBLIC_EAS_PROJECT_ID`.
3. Add the `EXPO_PUBLIC_*` values to the EAS `preview` environment. Use a backend both phones can reach.
4. Run `npm run build:mobile:preview` and open the install links on both phones.

### Crash reporting

The app sends crashes to Sentry only when `EXPO_PUBLIC_SENTRY_DSN` is set.
It sends no default personal data and drops console, request, and navigation breadcrumbs.
To upload source maps from EAS, set `SENTRY_ORG`, `SENTRY_PROJECT`, and the secret `SENTRY_AUTH_TOKEN` in that EAS environment.

## 7. Implementation rules

Rate tests before writing them. Implement only tests scoring at least 90.
Use feature public interfaces and shared domain contracts. Keep database calls out of screens.
Run focused checks during a fix, then one fresh full check on final source.
Preserve failed logs and state each rerun's scope.
Generate database types after schema changes. Test fresh replay and populated fixtures.
Keep account, pair, and private-state cleanup contracts intact.

The [portal handoff](../handoffs/web-portal.md) records current results, dependency findings, and remaining acceptance work.
