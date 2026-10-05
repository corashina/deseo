# Deseo web portal

Date: 5 October 2026.
Status: Owner approved on 5 October 2026. Product implementation has not started.

## 1. Intent and confirmed choices

Build a browser portal for two partners. Keep the Expo application for Android and iOS.

The owner selected separate React web screens with shared rules and data.
Both applications use the same accounts, pair, content, and Supabase access rules.

Use ChatGPT's sidebar and content layout as a reference.
Use Cupla and Couply for feature structure, visual hierarchy, spacing, and card proportions where they fit Deseo.
Keep Deseo's approved pastel colors and Two voices icon.

Create a synthetic paired couple for local testing.
After implementation, provide screenshots of each product page and subpage.

Approved scope assumptions:

- Use English interface text and Europe/Warsaw for the sample pair.
- Port the existing product flows, including forms and details.
- Keep the planned public information site separate from the signed-in portal.
- Use local test accounts, without creating accounts on a hosted production backend.

## 2. Current project evidence

The primary checkout contains `apps/mobile`. It does not contain a production web application.
`docs/design/preview.html` contains the browser design reference and sample interactions.

The native application uses Expo Router, React Native, TanStack Query, React Hook Form, Zod, Luxon, and Supabase.
Its native shell has five bottom tabs. Its Screen component caps content at 680px.
Its private storage module rejects browser use. A CSS change cannot complete the browser port.

The primary checkout still exposes the obsolete zero-minute reminder.
The owner previously chose advance reminders only. Align native validation, browser validation, and SQL with that choice.
Review the existing reminder correction before integration. Do not import unfinished account work with it.

The current STYLE.md and ARCHITECTURE.md restrict the product to native platforms.
Implementation must replace those obsolete platform restrictions with the approved portal contract.

The primary checkout has no account export or deletion implementation.
The account branch has a newer, integration-ready handoff with recorded automated checks.
Its physical device checks remain pending. Those changes are not integrated into the primary checkout.
The portal scope below remains unchanged. Execution must verify the selected baseline rather than inherit another branch's test result.

## 3. Approaches

| Approach | Benefit | Cost | Decision |
|---|---|---|---|
| Separate React portal and Expo mobile app | Each platform gets suitable navigation, forms, and layout | Two UI implementations | Owner selected |
| One Expo app with web-specific screens | Reuses Expo navigation and bundling | Requires browser replacements for native storage and media modules | Considered |
| Duplicate the mobile data layer inside a portal | Fast initial scaffold | Duplicates validation and command rules | Rejected |

Use shared platform-neutral contracts. Keep UI and device capabilities inside each application.
Keep PostgreSQL and existing transactions authoritative for permissions, pairing, and content changes.

## 4. Reference use

I inspected official reference pages and available screen images on 5 October 2026.

| Reference | Observed structure | Deseo application |
|---|---|---|
| [Cupla calendar](https://www.cupla.app/the-app/) | Date navigation, owner filters, partner columns, shared event blocks | Calendar toolbar, stable owner labels, comparison view |
| [Cupla tasks and dates](https://www.cupla.app/the-app/) | Named lists, task assignment, saved ideas, important dates | Compact task rows, list navigation, saved ideas under Calendar |
| [Couply home](https://www.couply.io/) | Greeting, large image card, smaller personal cards, paired identity | Today hierarchy, memory cards, notes, paired avatars |
| [Couply product listing](https://apps.apple.com/us/app/couply-couples-relationship/id1484241314) | Private photo memories and milestones | Memory feed and important-date panel |
| ChatGPT layout requested by owner | Left navigation, open content area, account controls below navigation | Portal shell and message composer placement |

Reference screenshots show proportions, not verified production measurements.
The dimensions below are Deseo design choices. They are not claims about either reference application's source code.

Use the reference structures with Deseo's scope and tokens.
Retain the existing exclusions for AI advice, quizzes, streaks, relationship scores, feeds, and external calendar sync.

## 5. Portal shell and dimensions

Desktop shell:

```text
┌──────────────────────┬────────────────────────────────────────────┐
│ Deseo       Collapse │ Page title                  Page actions   │
│                      ├────────────────────────────────────────────┤
│ Today                │                                            │
│ Calendar             │    Calendar, cards, forms, or conversation  │
│ Memories             │                                            │
│ Messages             │    Use available width for each feature    │
│ Tasks                │                                            │
│                      │                                            │
│ Notifications        │                                            │
│                      │                                            │
│ Anna + Marek         │                                            │
│ Settings             │                                            │
│ Account menu         │                                            │
└──────────────────────┴────────────────────────────────────────────┘
```

| Element | Dimension or rule |
|---|---|
| Desktop sidebar | 256px expanded; 72px collapsed |
| Sidebar rows | At least 48px high; icon and text label |
| Top header | At least 72px high; title, context, feature action |
| Main padding | 32px desktop; 24px tablet; 16px narrow browser |
| Main content | Up to 1440px; centered within the content region |
| Form content | Up to 720px; readable field groups |
| Today columns | Flexible planning column and 360px personal column |
| Card padding | 24px desktop; 20px narrow browser |
| Card spacing | 24px desktop; 16px narrow browser |
| Card corners | Existing 20px token |
| Control corners | Existing 12px token |
| Body and fields | 16px text; visible field labels |
| Page title | 32px desktop; 28px narrow browser |
| Secondary text | 13px; existing contrast-safe muted token |
| Memory cards | 3:2 image area; caption outside the image |
| Message content | Centered, up to 960px; fixed composer in its content region |

Use a persistent sidebar from 1024px. Use the collapsed rail from 768px to 1023px.
Below 768px, use a menu button and accessible navigation drawer.
The browser portal keeps browser navigation at narrow widths. Expo keeps native bottom tabs.

Keep Calendar and Messages tall enough for their content.
Do not center the whole portal inside a phone-sized frame.
Use real links, page titles, active navigation states, browser Back, and reloadable detail URLs.

## 6. Product pages and subpages

Use a route manifest as the screenshot coverage list.
Every implemented route needs a named screenshot entry and a data prerequisite.

| Group | Routes or views | Layout and behavior |
|---|---|---|
| Entry | `/`, `/welcome`, `/sign-in`, `/verify`, `/profile/setup` | Root resolves the current session; centered authentication forms |
| Pair | `/pair/start`, `/pair/invite`, `/pair/join`, `/pair/waiting`, `/pair/welcome`, `/pair/ended`, `/invite` | Invitation review, copy, join, waiting, and ended-pair flows |
| Today | `/today` | Upcoming plans and due tasks beside a memory, note, and important date |
| Calendar | `/calendar`; month, agenda, comparison views | Date toolbar, owner filters, clear event blocks and selected-day agenda |
| Events | `/events/new`, `/events/:eventId`, `/events/:eventId/edit` | Details and full-page forms; private visibility and timezone stay visible |
| Date ideas | `/ideas`, `/ideas/new`, `/ideas/:ideaId`, `/ideas/:ideaId/edit` | Saved ideas, details, editing, archive, and Plan date |
| Memories | `/memories`, `/memories/new`, `/memories/:memoryId`, `/memories/:memoryId/edit` | Month feed, photo preparation, upload progress, full images, author controls |
| Messages | `/messages`; pinned notes view | One conversation, both notes, sender labels, failed send retry, fixed composer |
| Tasks | `/tasks`, `/tasks/new`, `/tasks/:taskId`, `/tasks/:taskId/edit` | List filters, quick add, completion, details, assignment, and due dates |
| Task lists | `/tasks/lists`, `/tasks/lists/:listId` | Create, rename, move tasks to General, and remove empty lists |
| Notifications | `/notifications` | Recipient's saved notifications and authorized source links |
| Settings | `/settings`, `/settings/profile`, `/settings/pair`, `/settings/notifications`, `/settings/account` | Profile edit, pair state, preferences, fresh verification for ending a pair, sign-out controls |
| Route errors | Missing record, forbidden record, unknown route | Recovery action without exposing private data |

Account settings remain reachable when the account is unpaired or the pair has ended.
Pair settings preserve the current backend capabilities. Do not add a timezone write without a supported transaction.

The port includes current product behavior, not unfinished account export, account deletion, or avatar backend work.
Keep those features in their existing account delivery task. Do not add nonfunctional controls for them.
Public landing, support, privacy, terms, and deletion pages retain their separate website delivery scope.

## 7. Workspace and module structure

```text
apps/mobile/                 Expo UI and native capabilities
apps/web/                    React DOM portal
  src/app/                   Router, providers, session gate, shell
  src/features/              Feature pages, queries, commands, UI
  src/components/ui/         Browser controls and layout primitives
  src/lib/                   Browser Supabase client and session lifecycle
  src/styles/                Brand token mapping and portal styles
  tests/                     Browser acceptance tests and route manifest
packages/domain/             Shared schemas, types, payloads, date rules, result contract
brand/                       Existing tokens and icon source
supabase/                    Existing backend and local fixture script
docs/design/web-portal/      Screenshot index and captured product pages
```

Use React, TypeScript, Vite, and React Router for the portal.
Reuse the installed data and form libraries. Pin new package versions after checking their current documentation.
Use an established accessible primitive library for dialogs and menus when native HTML cannot meet the interaction contract.

Extract only code that both applications use.
Shared modules must not import React Native, Expo, MMKV, browser storage, or either application's routes.
Move existing shared contracts and update consumers. Remove obsolete copies instead of leaving compatibility exports.

Keep queries and commands in feature modules. Screens do not make database calls.
Share command payload and validation rules. Keep each application's client and lifecycle separate.
Both clients call the existing authenticated tables, transactions, and Edge functions.

No new general backend, generic repository layer, or global copy of query data is needed.

## 8. Browser data and device behavior

Use the existing email-code sign-in flow.
Check account status and membership through the existing server session contract before showing private content.

Use Supabase's supported browser session storage for authentication tokens.
This is a deliberate browser contract. It does not replace native encrypted storage.
Keep shared rows, private images, and unsent drafts in memory.
Warn before a reload or navigation discards a changed form or unsent draft.
Do not claim browser drafts survive a reload.

Scope query keys to account and pair. Abort old requests and clear private caches on account or pair changes.
Revalidate membership after reconnect and browser focus.
Refresh queries after authorized Realtime signals. Do not copy message bodies into public broadcasts.

Use browser file inputs for photos.
Prepare JPEG full images and thumbnails within the existing dimensions and byte limits.
Remove metadata and use the existing private upload reservation and finalization flow.
Release object URLs after use. Preserve input after a failed upload.

Use existing reminder offsets: None, 15 minutes, one hour, or one day before.
Keep all-day reminders at 09:00 in the event timezone.
The browser can manage reminder preferences and read notifications.
Native push remains an Expo capability; browser push needs a separate delivery design.

The portal uses ordinary browser URLs without an install prompt, service worker, or offline content cache.

## 9. Synthetic paired couple

Create Anna and Marek using reserved `example.test` email addresses.
Use Europe/Warsaw and English. Assign Anna slot A and Marek slot B.

Create real local Supabase Auth accounts and pair them through the normal pairing transactions.
Sign in through email codes from the local mail inbox. Do not add a product authentication bypass.

Provide a local fixture command that:

1. Rejects non-loopback backend addresses.
2. Creates or reuses only its named synthetic accounts.
3. Creates their profiles, pair, and content through supported commands.
4. Reuses stable fixture identifiers on repeat runs.
5. Leaves unrelated accounts and pairs unchanged.
6. Reports test email addresses, fixture IDs, and local sign-in steps without server keys or session tokens.

Use these sample records:

- Shared dinner and weekend walk.
- One visible event for each partner and one private event for Anna.
- One yearly important date and two saved date ideas.
- General and Groceries lists with assigned, unassigned, completed, and due tasks.
- Messages from both people and one pinned note from each.
- Two memories with synthetic local JPEG images and visible sample captions.

Use these records in two browser sessions to verify shared writes and private event isolation.
Use separate disposable fixtures for unpaired, waiting, ended-pair, and failure states.
Keep the named sample pair usable after screenshot capture.

## 10. Errors and accessibility

Preserve loading, empty, offline, failed read, failed write, stale edit, expired session, and revoked pair behavior.
Preserve command identifiers across retries. Never report success before server confirmation.

Use semantic links, buttons, headings, and labeled fields.
Support keyboard navigation, visible focus, Escape, dialog focus restoration, and announced save results.
Use names with owner colors. Allow long names and titles to wrap.
Preserve entered input when another person changes a record. Offer an explicit reload action after a conflict.

## 11. Verification and screenshots

Rate each new test before implementing it. Add only tests scoring at least 90.

| Test | Importance |
|---|---|
| Pair isolation, private events, disabled accounts, and cache cleanup | 100 |
| Real paired-user event, task, message, and memory writes | 98 |
| Conflicts and duplicate prevention | 98 |
| Shared contract extraction preserves mobile behavior | 97 |
| Timezones, all-day dates, and reminder offsets | 96 |
| Photo validation, publication, and author permissions | 96 |
| Failed sends and uploads preserve input | 95 |
| Keyboard navigation and dialog focus | 93 |
| Route reload, browser Back, and responsive navigation | 92 |
| Screenshot manifest covers each route and subview | 90 |

Run existing mobile checks after shared code changes.
Run portal typecheck, lint, production build, and browser acceptance tests.
Run backend tests if fixture or backend changes affect access or commands.

Capture rendered product pages with local data at 1440×1000 and 390×844.
Check shell layouts at 768px and 1024px, plus narrow overflow at 320px.
Capture each main page, detail, create form, edit form, settings page, and onboarding page.
Also capture calendar subviews, pinned notes, list management, confirmations, and representative failure states.

Keep the browser shell in each capture. Use full-page captures for long forms.
Record the route, viewport, fixture, and state in the screenshot index.
Deliver an HTML gallery, a Markdown index, and image files. Embed page screenshots in the final report.
Report missing or blocked captures. Do not substitute design-reference images for implemented product screenshots.

## 12. Delivery order and acceptance

1. Review this design and then the implementation plan.
2. Create an isolated worktree and confirm the current baseline.
3. Extract shared contracts while preserving mobile checks.
4. Complete browser sign-in, pairing, shell, and one saved event end to end.
5. Add tasks and date ideas to the working portal.
6. Add messages, pinned notes, memories, and notification preferences.
7. Complete profile, pair, and account controls within the stated scope.
8. Add the named local sample pair and verify both users.
9. Capture the route manifest and present the screenshot gallery.
10. Update platform, style, development, and screen documentation.

Acceptance requires a usable React web portal and an intact Expo mobile application.
Both applications use the same account and pair data contract.
The sample pair must support real persisted actions and private access rules.
Every implemented page and subpage must appear in the screenshot index.

Native source checks do not prove physical Android or iOS behavior.
Record available native build evidence and any remaining device checks separately.
