# Development workflow

Status: Setup contract for implementation. There is no package manifest or runnable app yet.

Do not run the planned npm commands until Task 1 creates their scripts.

## 1. Before scaffolding

Read AGENTS.md, STYLE.md, the product design, DATA.md, and the implementation task.

Confirm the written design and plan with the owner. Keep existing design assets intact.

Initialize Git when product scaffolding starts. Use a focused branch and preserve unrelated local work.

Select a supported Node LTS release using the current Expo and Astro requirements.

Pin the Node and npm versions in project configuration. Record the actual Expo SDK and React Native versions here.

Use npm workspaces for mobile and site. Install native libraries with Expo's compatibility-aware installer.

Add dependencies only when their feature task needs them. Keep exact versions and one root lockfile.

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

Read environment settings once during module initialization. Validate required settings before launching the relevant build.

Use separate native identifiers and backend projects for development and production.

## 4. Planned command contract

Task 1 must create and verify these scripts. These are target commands, not current capabilities.

| Command | Required behavior |
|---|---|
| `npm ci` | Install the committed workspace lockfile |
| `npm run dev:mobile` | Start the Expo development server |
| `npm run dev:site` | Start the public site's development server |
| `npm run typecheck` | Check mobile, site, and applicable shared TypeScript |
| `npm run lint` | Check source and module import rules |
| `npm run test:mobile -- <path>` | Run targeted Jest Expo tests |
| `npm run test:db` | Run the local Supabase SQL test suite |
| `npm run test:db:race` | Run real concurrent pairing/worker transaction checks |
| `npm run test:functions` | Run backend function tests in their supported runtime |
| `npm run test:site` | Run Playwright public-page flows |
| `npm run build:site` | Produce the static public site |
| `npm run verify` | Run typecheck, lint, relevant test suites, and static site build |

Device builds and Maestro runs have separate environment requirements. Record the exact working commands after setup.

Do not make an unrelated module's tests mandatory before that module exists. Add its suite when the feature starts.

## 5. Database changes

Use local development first. Review RLS, constraints, grants, and execution rights with every schema change.

Create migration filenames through the installed Supabase CLI. Use the task's named migration label.

Generate and inspect database types after changing the schema.

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

Use the [architecture review](../architecture/REVIEW.md) when reviewing module structure.
