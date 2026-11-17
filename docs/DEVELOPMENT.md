# Development

Read [Setup](#setup), [Verification](#verification), [Remaining work](#remaining-work), or [Release](#release).
Work targets the web portal first. The Expo app is frozen; change it only for shared contract fixes.
Record unrun checks as pending. A requirement in this file does not prove that a check passed.

## Setup

Use Node 24.18.0, npm 11.16.0, Docker, and the committed root lockfile.
Read [Contributor rules](../AGENTS.md), [Design](../DESIGN.md), [Screens](README.md#screens), and [Architecture](ARCHITECTURE.md) before product work.

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
| `npm run typecheck:functions` | Deno check of all four Edge entrypoints |
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

### Public site

```sh
npm run dev --workspace @deseo/site
npm run build --workspace @deseo/site
npm run preview --workspace @deseo/site
```

The build writes static HTML to `apps/site/dist`. Preview serves it at `http://127.0.0.1:4175`.
Vite preview does not add trailing slashes. Site links use `/support/`, not `/support`.
Images in `apps/site/public/images` are WebP copies of `design` previews. Mark each one as a preview.

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
`.github/workflows/ci.yml` runs typecheck, lint, unit tests, the web build and size budget, the site build, the design drift check, SQL tests, the race test, and Edge checks.
`npm run size --workspace @deseo/web` fails when the gzip JS and CSS that `index.html` loads exceeds the budget in `apps/web/scripts/check-size.mjs`.
Playwright tests need the local backend and Edge functions. Run them with `npm run test --workspace @deseo/web` on all platforms.

The `web-e2e` job ("Web journeys") runs the browser tests on each pull request and blocks merge. Its steps:

1. Start Supabase without Studio, Vector, Logflare, imgproxy, and Supavisor. It starts in the background while `npm ci` and the Chromium install run.
2. Serve Edge functions with `npm run functions`.
3. Read the local URL and key from `supabase status`, then run the browser tests.
4. On failure, upload the Playwright report, the traces, and the Edge log.

The job reserves ports 55720 to 55729 so outgoing connections do not take them.
The `supabase/setup-cli` action installs the CLI version from `package.json` before `npm ci`. The database job does the same.
Supabase start takes about 2 minutes. The tests run on 4 workers in about 30 seconds.

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

### Web interface rules

The portal follows the [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) where AGENTS.md and DESIGN.md allow.

- Format dates and times with `lib/format.ts`. It uses `Intl`, the account locale, and an explicit timezone.
- Give each controlled input a `name`. `Field` sets `autocomplete="off"` unless the caller sets a value.
- Turn spellcheck off on email and code inputs.
- Keep submit enabled until the request starts. Validate on submit and show the error next to the field.
- Pass a field error to `Field` as `error`. Move focus to that field.
- Give images `width` and `height`. Contain scroll in dialogs.
- Give an `aria-label` only to an element with a role, such as `group` or `log`. The conversation is a `log`.
- Show counts as numerals. Format numbers with `Intl.NumberFormat`.
- On phones, `html` scroll padding keeps focus below the sticky top bar.
- `index.html` preloads the Manrope latin font file from `node_modules`.

### Impeccable review

[Impeccable](https://github.com/pbakaus/impeccable) 4.9.2 reviewed the web portal and the public site in November 2026. The mobile app was out of scope.
Its skill is in `.claude/skills/impeccable`. Its project settings are in `.impeccable/config.json`.

Design drift: CI runs `npx --yes impeccable@4.9.2 detect --github apps/web/src apps/site`. A counted rule fails the step. Off-token colors are advisory.

Screens: run the "Design capture" workflow by hand on a branch. Download its `design-capture` artifact.
It holds screenshots at 390, 768, 1024, and 1440px, dark screens at 390 and 1440px, and rendered detector results for each page.
Locally, run `CAPTURE=1 npm run test --workspace @deseo/web`. `tests/capture/capture.spec.ts` lists the screens.
`tests/capture/previews.spec.ts` makes the site previews with the sample pair Alex and Sam. Convert them to WebP in `apps/site/public/images`.

Review steps:

1. Capture the screens.
2. Run `/impeccable audit` for the project. Run `/impeccable critique` for each area, with two separate reviewers.
3. Store each report with `.claude/skills/impeccable/scripts/impeccable audit-storage write` or `critique-storage write`.
4. Force-add the snapshots in `.impeccable/audit` and `.impeccable/critique`. Their `.gitignore` excludes them.

Scores, baseline to final. Critique scores are of 40. The site is of 36.

| Area | Baseline | Final |
|---|---|---|
| Shell | 26 | 29 |
| Entry | 26 | 29 |
| Today | 26 | 27 |
| Calendar | 25 | 28 |
| Memories | 24 | 28 |
| Tasks | 27 | 28 |
| Settings | 26 | 28 |
| Public site | 25 | 27 |
| Audit (of 16) | 12 | 12 |

The final audit has no P0 or P1 issues. Accessibility was not scored, by owner decision.

Turned-off rules and their reasons:

- `low-contrast`, `gray-on-color`, `skipped-heading`: accessibility was out of scope for this review.
- `kicker-above-heading`: DESIGN.md asks for an eyebrow above detail titles.
- `design-system-font-size` 23px: the sidebar wordmark beside the 40px icon.
- `tight-leading` in `apps/site`: the static scan rounds the 1.3 title leading down.

The rendered `nested-cards` result on `.view-tabs` is a false positive. The segmented control is a track, not a card.

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
| `apps/web/tests/pairing.spec.ts` | 100 | Invitation and join, cross-pair reads, new pair without old content |
| `apps/web/tests/memories.spec.ts` | 100 | Failed photo retry, pair end during publish |
| `apps/web/tests/messages.spec.ts` | 100, 94 | Lost send acknowledgement, pinned notes |
| `apps/web/tests/calendar.spec.ts` | 100, 98 | Shared and private events, edit conflicts |
| `apps/web/tests/tasks.spec.ts` | 95 | Failed reopen and retry |
| `apps/web/tests/layout/layout.spec.ts` | 95 | No side scroll, shell, clipped text, and 48px targets on 25 screens at 6 widths |
| `apps/web/tests/layout/focus.spec.ts` | 95, 93, 92, 90 | Dialog and drawer focus, event form order, navigation order, skip link |
| `apps/web/tests/layout/rules.spec.ts` | 91 | Each layout rule fails on a bad page |
| `supabase/functions/finalize-memory/validate-jpeg.test.ts` | 100 | JPEG bytes, dimensions, embedded metadata |
| `supabase/tests/end-pair.test.sql` | 95 | Shared access removal, fresh sign-in |
| `supabase/tests/memories.test.sql` | 100 | Access, quota, immutable uploads, publication, cleanup |
| `supabase/tests/messages.test.sql` | 100 | Access, retries, cursor order, revocation |
| `supabase/tests/notification-jobs.test.sql` | 100 | Leases, cancellation, quiet hours, receipts |
| `supabase/tests/planning-races.test.ts` | 100 | Concurrent writes, conflicts, retries, cross-pair access |

The suite omits mobile UI flows, native draft recovery, concurrent pairing, and full Edge handler checks.
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

Browser tests get fixtures from `apps/web/tests/support/test.ts`:

| Fixture | Use |
|---|---|
| `account(name)` | New confirmed account with a password session. `null` skips the profile. |
| `pendingPair(name)` | Account with a pair and an open invitation |
| `pair([a, b])` | Two accounts in an active pair. Call it again for another pair. |
| `signIn(page, account)` | Puts a new session in the tab before the app loads |
| `filledPair` | One pair per worker with long text in each area. Read it and never change it. |

Each test removes its accounts, pairs, and photos. Cleanup accepts only `entry-<uuid>@example.test` accounts.
`support/network.ts` drops, fails, or holds one request to test retries and races.

### Complete journeys

`web-e2e` checks each web journey on each pull request. Check each journey on mobile before a release:
invitation and join, shared and private events, edit conflicts, task reopen, lost message acknowledgement,
pinned notes, failed photo retry, pair end during upload, and a new pair without old content.

Record the commit, platform, device, command, and result for each check.

## Remaining work

| Work | Requirements |
|---|---|
| Account controls | Profile, private avatars, verified email changes, timezone changes without shifting saved instants |
| Export | All content types; paired and author-only scope, resumable parts, expiry, file integrity |
| Deletion | Disable access, revoke sessions, finish cleanup, verify records and objects are gone |
| Public site | Done: static landing, invitation, support, policy status, and 404 pages. Pending: deletion page, approved policies, support address, store, app, and canonical links, sitemap, `robots.txt` |
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
- [ ] Replace prototype site imagery with screenshots of the release candidate.
- [ ] Configure web hosting: Brotli, `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`, and `no-cache` for `index.html`.
- [ ] Check privacy disclosures against SDKs, processors, storage, and retention.
- [ ] Verify backups, restore, and queue and deletion alerts.
- [ ] Review the candidate with the owner before publishing.

### Store preparation

Prepare name, description, screenshots, icon exports, content rating, support URL, and privacy URL.
Describe only working features. Do not claim therapy, guaranteed reminders, or end-to-end encryption.
Give reviewers a synthetic pair. Match privacy labels to the exact build.
#### Listing text

Use this draft for both stores. Before submission, confirm each feature on the signed build.

| Field | Limit | Text |
|---|---|---|
| App Store name | 30 | `Deseo: Plan Together` |
| App Store subtitle | 30 | `Shared calendar for couples` |
| App Store keywords | 100 | `couple,partner,relationship,schedule,agenda,tasks,todo,photo,memories,chat,notes,date,anniversary` |
| Google Play title | 30 | `Deseo: Plan Together` |
| Google Play short description | 80 | `Plan your days together. Share a calendar, tasks, messages, and photo memories.` |

Keywords do not repeat words from the name or subtitle. Apple indexes those words separately.

Full description:

```text
Plan your days together.

Deseo is a private space for two partners. Plan your days, share a note, and keep the moments you want to remember.

Calendar
- Add shared events and private events.
- Add all-day plans and yearly important dates.
- Save date ideas for later.

Tasks
- Make named lists.
- Assign a task, set a due date, and mark it done.

Messages (on Today)
- Write to each other in one conversation.
- Pin a message to keep it as a note.

Memories
- Save one to five photos with a date and a caption.

Today
- See the conversation, both notes, your next plans, due tasks, the latest memory, and the next important date.

Privacy and control
- Sign in with an email code.
- Join your partner with an invitation.
- Private events stay private.
- Either partner can end the pair at any time.
- No ads, no public feed, and no relationship scores.
```

Add a reminder line only after push reminders pass on signed Android and iOS builds.

Read the current [Apple deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/) and [Google deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).
