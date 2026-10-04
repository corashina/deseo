# Development workflow

Status: The native core is implemented. Local database and device checks remain pending.

The owner deferred Docker setup on 2026-10-04. Run mobile checks now; complete backend checks before Chats 02–04.

## 1. Installed workspace

Read AGENTS.md, STYLE.md, the product design, DATA.md, and the implementation task.

The saved design and Tasks 1–5 are the accepted core scope. Keep existing design assets intact.

The integration branch is `codex/deseo-integration`. The initial documentation commit is `17095fa`.

Use Node `24.18.0` and npm `11.16.0`, as pinned in `.node-version` and `package.json`.

The app uses Expo `57.0.26`, React Native `0.86.3`, React `19.2.3`, and Expo Router `57.0.24`.

Run `npm ci` from the repository root. The workspace currently contains only `apps/mobile`.

Add dependencies only when their feature task needs them. Keep exact versions and one root lockfile.

Run `npm run verify:mobile` without Docker. This runs TypeScript, ESLint, and Jest.

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

`apps/mobile/src/lib/database.types.ts` remains pending until the local migrations run.
Runtime Zod schemas validate current responses. A hand-written file must not claim to be generated schema output.

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
