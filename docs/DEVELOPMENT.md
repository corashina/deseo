# Development

Read [Setup](#setup), [Verification](#verification), [Remaining work](#remaining-work), or [Release](#release).
Work targets the web portal first. The Expo app is frozen; change it only for shared contract fixes.
Record unrun checks as pending. A requirement in this file does not prove that a check passed.

## Setup

Use Node 24.18.0, npm 11.16.0, Docker, and the committed root lockfile.
Read [Contributor rules](../AGENTS.md), [Style](../STYLE.md), [Screens](README.md#screens), and [Architecture](ARCHITECTURE.md) before product work.

### Scripts

Run all scripts from the repository root.

| Script | Command |
|---|---|
| `npm run dev` | Start the web portal on `http://127.0.0.1:5174` |
| `npm run dev:mobile` | Start the Expo development server |
| `npm run backend:start` | `supabase start` |
| `npm run backend:stop` | `supabase stop` |
| `npm run backend:reset` | `supabase db reset --local`; deletes local data |
| `npm run functions` | `supabase functions serve` with `supabase/dev/functions.env` |
| `npm run seed` | Create or reuse the named Anna and Marek pair |
| `npm run gen:types` | Write `packages/domain/src/database.types.ts` from the local schema |
| `npm run lint` | ESLint for mobile, web, and domain source |
| `npm run typecheck` | TypeScript for each workspace |
| `npm run test` | Workspace tests, SQL tests, and the planning race test |
| `npm run typecheck:functions` | Deno check of all six Edge entrypoints |
| `npm run test:functions` | Deno tests for Edge functions |

Use the Supabase CLI for other commands, for example `npx supabase status`.
Set `DO_NOT_TRACK=1` and `SUPABASE_TELEMETRY_DISABLED=true` to turn off CLI telemetry.

### Local backend

Start Docker, then the backend:

```sh
npm ci
npm run backend:start
```

`supabase/config.toml` sets project `deseo` on ports 55720–55729.
The API uses 55721, the database 55722, mail 55724, and the Edge inspector 55728.
`npm run backend:reset` replays migrations and deletes local data. Back up data you need first.

Fixtures and tests read keys from `supabase status` at run time. No status file is written.
They refuse any API address other than `http://127.0.0.1:55721`.

### Web portal

Create `apps/web/.env.local` from `.env.example`. Use the publishable key from `npx supabase status`.

| Browser variable | Use |
|---|---|
| `VITE_SUPABASE_URL` | API address; local value `http://127.0.0.1:55721` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser key |

Start Edge functions and the portal in separate terminals:

```sh
npm run functions
npm run dev
```

One Edge process serves the dev server (`http://127.0.0.1:5174`) and the test preview (`http://127.0.0.1:4174`).
`supabase/dev/functions.env` sets these server values:

| Server variable | Use |
|---|---|
| `WEB_APP_ORIGIN` | Browser origins that Edge functions accept |
| `SUPABASE_URL` | Internal address that the runtime injects |

Local Kong intercepts OPTIONS and adds wildcard CORS headers.
The handler rejects unknown and null origins before work. Native calls can omit Origin.
Browser invitations use `location.origin`. Do not add a site-URL variable.

### Named pair

With the backend and Edge functions running:

```sh
npm run seed
```

The command creates or reuses Anna (`anna@deseo.example.test`) and Marek (`marek@deseo.example.test`).
Sign in with the normal screen. Read codes from the local inbox at `http://127.0.0.1:55724`.
Use disposable fixtures for failures, end-pair actions, and destructive tests.

### Database types and CI

After a migration change, run `npm run gen:types` against the running stack.
CI fails when `packages/domain/src/database.types.ts` differs from the schema.
`.github/workflows/ci.yml` runs typecheck, lint, unit tests, the web build, SQL tests, the race test, and Edge checks.
Playwright tests need the local backend and Edge functions. Run them with `npm run test --workspace @deseo/web`.

### Expo mobile

The mobile app is frozen. These notes keep it buildable.

Copy `apps/mobile/.env.example` to `.env.local`. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
Native links use `EXPO_PUBLIC_SITE_URL`. Development push uses `EXPO_PUBLIC_EAS_PROJECT_ID`.
These values are public. Keep server keys out of them.

A phone's loopback address refers to that phone. Android emulators can use `10.0.2.2`.
MMKV needs a development build; Expo Go cannot run it.
Build a preview with `npm exec --yes --package eas-cli@24.11.0 -- eas build --profile preview --platform all` in `apps/mobile`.
Crash reports go to Sentry only when `EXPO_PUBLIC_SENTRY_DSN` is set.

### Implementation rules

Rate tests before writing them. Implement only tests scoring at least 90.
Use feature public interfaces and shared domain contracts. Keep database calls out of screens.
Run focused checks during a fix, then one full check on final source.
Generate database types after schema changes. Keep account, pair, and private-state cleanup contracts intact.

## Verification

Run `npm run typecheck`, `npm run lint`, and `npm run test` on final source.
Run `npm run typecheck:functions` and `npm run test:functions` after Edge changes.
Physical Android and iOS acceptance remains unverified.

Browser tests use real local Auth, pair transactions, private media, and durable writes.
SQL tests use fixture IDs and roll back their transactions. Keep development records and unknown rows.
The race test creates real accounts and removes its own fixtures. Run it apart from browser tests.
Valid-user requests with unknown or null origins must fail before action work.

Check 320px, 768px, and 1024px layouts, keyboard controls, drawer focus, and 200% text size.
Mask invitation tokens and verification codes in screenshots and logs.

### Retained tests

| File | Importance | Coverage |
|---|---:|---|
| `apps/mobile/src/features/auth/session.test.tsx` | 100 | Restore races, background privacy, account changes |
| `apps/mobile/src/lib/private-storage.test.ts` | 100 | Key loss, corruption, failed writes, scoped removal |
| `apps/web/tests/session-isolation.spec.ts` | 100 | Browser account and pair isolation |
| `apps/web/tests/pair-revocation.spec.ts` | 100 | Fresh verification, pair closure, global sign-out |
| `packages/domain/tests/calendar-dates.test.ts` | 96 | Date boundaries, DST, pair-local selection |
| `supabase/functions/finalize-memory/validate-jpeg.test.ts` | 100 | JPEG bytes, dimensions, embedded metadata |
| `supabase/tests/memories.test.sql` | 100 | Access, quota, immutable uploads, publication, cleanup |
| `supabase/tests/messages.test.sql` | 100 | Access, retries, cursor order, revocation |
| `supabase/tests/notification-jobs.test.sql` | 100 | Leases, cancellation, quiet hours, receipts |
| `supabase/tests/planning-races.test.ts` | 100 | Concurrent writes, conflicts, retries, cross-pair access |

The suite omits broad UI flows, native draft recovery, concurrent pairing, and full Edge handler checks.
Check these areas manually until a defect needs a focused regression test.

### Acceptance priorities

| Area | Importance | Required cases |
|---|---:|---|
| Pair isolation | 100 | Foreign pair IDs, private events, media, direct calls, live subscriptions |
| Pair transaction | 100 | Simultaneous joins, self-join, one account in two pairs, regeneration race |
| Account disable/delete | 100 | Valid old JWT, session revocation, partial cleanup |
| Disconnect | 100 | Open screens, resume, writes, export, upload, and push races |
| Sensitive verification | 100 | Old sign-in, other pair, and receipt replay (`supabase/tests/end-pair.test.sql`) |
| Message durability | 100 | Lost acknowledgement, duplicate UUID, reconnect, paging during inserts |
| Photo access | 100 | Pending access, forged type, metadata, quota race, stale links |
| Reminder delivery | 100 | Duplicate workers, crashes, quiet hours, stale versions, bad tokens |
| Event changes | 98 | Conflicts, duplicate creates, visibility changes, deleted sources |
| Time semantics | 98 | All-day dates, DST gaps and overlaps, partner timezones |
| Accessibility | 95 | Screen readers, large text, focus, labels, status announcements |

Skip decorative snapshots (25) and trivial getter tests (20).

### Fixtures

Use synthetic accounts: two in one pair, one in another pair, and one unpaired.
Use Europe/Warsaw and America/New_York for cross-zone checks. Pin DST and February 29 instants.

### Complete journeys

Check each journey before a release:
invitation and join, shared and private events, edit conflicts, task Undo, lost message acknowledgement,
pinned notes, failed photo retry, pair end during upload, and a new pair without old content.

Record the commit, platform, device, command, and result for each check.

## Remaining work

| Work | Requirements |
|---|---|
| Account controls | Profile, private avatars, verified email changes, timezone changes without shifting saved instants |
| Export | All content types; paired and author-only scope, resumable parts, expiry, file integrity |
| Deletion | Disable access, revoke sessions, finish cleanup, verify records and objects are gone |
| Public site | Landing, support, policies, invitations, and independent deletion on the same backend |
| Native acceptance | Signed Android and iOS builds, storage, photos, push, permissions, lifecycle |
| Release | Access and recovery checks, monitoring, store materials, five-pair usability review |

Finish account deletion before the public deletion page.
Keep invitation tokens out of logs, analytics, referrers, and public output.
Use real operator, support, domain, store, and signing values. Do not invent them.

## Release

Local setup does not prove hosted deployment or publication.

### Required owner inputs

| Input | Required before |
|---|---|
| Legal operator, launch regions, audience, and reviewed policies | Public beta |
| Production domain and support address | App links, email, and store listing |
| Apple and Google developer accounts | Signed distribution |
| Stable bundle and package identifiers | Push credentials and association files |
| Hosting regions and backup retention | Privacy disclosures |
| Consenting beta testers | Usability sessions |

### Environments

Use isolated local, staging, and production data. Limit production secrets to approved contexts.
Use verified SMTP. Check sender identity, expiry text, resend, and junk-folder results.
Use restricted worker credentials. Reject public worker calls.
Apply migrations to staging first. Replay a fresh local database and run access tests before production.

### Operational targets

| Area | Target |
|---|---|
| Reminder claims | Every minute; alert when due jobs wait five minutes |
| Message persistence | Show Sent only after database acknowledgement |
| Orphan uploads | Remove abandoned reservations after 24 hours |
| Media links | At most 60 seconds; never log them |
| Backup restore | Test in an isolated environment before release |

Use content-free metrics only. Do not collect message text, captions, event titles, or tokens.

### Incident handling

For suspected cross-pair access, disable the path, keep content-free evidence, and stop related jobs.
Fix policies and add direct-request tests before you reopen the path.
For partial deletion, keep the account disabled and continue the stored cleanup phase.

### Release candidate

- [ ] Run typecheck, lint, all tests, and Edge checks on the release commit.
- [ ] Run SQL security advisors and resolve material findings.
- [ ] Test signed builds on physical Android and iOS devices.
- [ ] Complete screen reader, large-text, keyboard, permission, and timezone checks.
- [ ] Complete the five-pair usability review.
- [ ] Confirm no sample content or inactive controls reach production.
- [ ] Verify app links, install handoff, and web account deletion.
- [ ] Check privacy disclosures against SDKs, processors, storage, and retention.
- [ ] Verify backups, restore, and queue and deletion alerts.
- [ ] Review the candidate with the owner before publishing.

### Store preparation

Prepare name, description, screenshots, icon exports, content rating, support URL, and privacy URL.
Describe only working features. Do not claim therapy, guaranteed reminders, or end-to-end encryption.
Give reviewers a synthetic pair. Match privacy labels to the exact build.
Read the current [Apple deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/) and [Google deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).
