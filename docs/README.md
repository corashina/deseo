# Documentation

Deseo has a React browser portal and an Expo app for Android and iOS.
Both use shared domain contracts and one backend. Public pages remain separate delivery work.

| Read | Use |
|---|---|
| [Architecture](ARCHITECTURE.md) | Modules, data, access, and lifecycle rules |
| [Development](DEVELOPMENT.md) | Setup, verification, remaining work, and release |
| [Product](../PRODUCT.md) | Purpose, scope, and open decisions |
| [Style](../STYLE.md) | Colors, layout, controls, and writing |
| [Glossary](../GLOSSARY.md) | Product terms |
| [Contributor rules](../AGENTS.md) | Change rules |

Use the [screen guide](#screens), [visual assets](#visual-assets), and [sources](#sources) below.
Keep three Markdown files in `docs/`. Put visual assets in `design/`; do not add folders inside `docs/`.
Update the relevant section for new decisions, requirements, or check results.

## Screens

The browser section describes portal scope. Native and public-site sections include requirements for remaining delivery work.
Check [remaining work](DEVELOPMENT.md#remaining-work) before treating a requirement as an available feature.

### Browser portal

The [router](../apps/web/src/app/router.tsx) defines the browser routes.
The [gallery](../design/web-portal/index.html) covers 119 views at 1440×1000 and 390×844.
The browser uses a sidebar, rail, or drawer. Expo keeps bottom tabs and native stacks.

Entry routes cover Welcome, email codes, profile setup, invitations, joining, waiting, and ended pairs.
Product routes cover Today, Calendar, events, ideas, tasks, lists, Messages, Memories, notifications, and Settings.
Record URLs support reload and browser Back. Changed forms and unsent drafts warn before leaving.

Today shows each upcoming plan's date in the pair timezone. Calendar provides month, agenda, and comparison views.
Messages keeps the composer inside the conversation region. Memories uses browser files, preparation, private uploads, and explicit downloads.
Settings supports profile edits, pair state, preferences, end-pair verification, and local or global sign-out.
Settings remains available to unpaired accounts and former pair members.

Browser shared rows, private images, and drafts stay in memory. A reload discards browser drafts.
Supabase stores browser Auth sessions through its supported browser storage.
Failed writes preserve their immutable command and input until the user resolves them.

Account export, deletion, avatar backend work, pair-timezone writes, and public pages remain separate delivery work.
The future native and public-site requirements below do not add portal controls for those capabilities.

### Main journey

```mermaid
flowchart TD
  Landing[Landing or partner link] --> Install[Open or install Deseo]
  Install --> Auth[Email and verification code]
  Auth --> Profile[Name and timezone]
  Profile --> Choice{Invitation available?}
  Choice -->|Yes| Confirm[Review inviter and join]
  Choice -->|No| Invite[Create or enter invitation]
  Invite --> Waiting[Wait for partner]
  Confirm --> Welcome[Pair welcome]
  Waiting --> Welcome
  Welcome --> Today[Today]
  Today --> Tabs[Calendar / Memories / Messages / Tasks]
  Today --> Settings[Pair avatar opens Settings]
```

Resume the original invitation after authentication. Do not restart onboarding after an email code expires.

### Public site

| Page | Content | Main action | Required states |
|---|---|---|---|
| `/` | Product name, short promise, real app preview, planning, messages, memories, privacy summary | Download for iOS / Android | Store unavailable before release; desktop QR after launch |
| `/invite` | Generic invitation explanation and installation instructions | Open Deseo | Installed, not installed, expired link after native validation |
| `/support` | Pairing, permissions, failed uploads, contact method | Contact support | Support address must exist before launch |
| `/privacy` | Actual collection, processors, retention, export, deletion, operator | Open data controls | Owner-approved policy required |
| `/terms` | Actual service terms and operator | Read support options | Owner-approved terms required |
| `/delete-account` | Independent email verification and deletion request | Request deletion | Code sent, invalid code, confirmed, processing, complete |

Landing headline: **Plan your days together.**

Supporting copy: **Plan your days, share a note, and keep the moments you want to remember.**

Use a real app screenshot once the product works. Mark prototype imagery as a preview before then.

Show three short product sections and one privacy section. Include a small FAQ and clear footer links.

Use the selected icon, pastel panels, dark text, and generous photo space. Keep the page useful at 360px.

Do not show fake reviews, invented usage counts, urgency banners, or unimplemented features.

Before store approval, use an honest Coming soon state. Do not collect a waitlist without a separate need.

Invitation links carry an opaque token in the query string. The public page does not fetch partner details.

Set `Referrer-Policy: no-referrer`. Exclude invitation URLs from analytics and scrub their queries from access logs.

After installation, tell users to reopen the original invitation. Do not promise automatic transfer through an app store.

### Authentication and entry

| Screen | Content and behavior |
|---|---|
| Launch | Selected icon on ivory; restore session and check account status |
| Welcome | One sentence, Continue with email, privacy and terms links |
| Email | Visible Email label, email keyboard, Continue, inline format error |
| Verification | One six-digit field, paste/autofill, email shown, Change email, resend countdown |
| Profile | Required display name; detected timezone with edit control; optional avatar |
| Pair choice | Invite your partner or Enter invitation; explain shared content |
| Session expired | Explain sign-in is required; preserve encrypted drafts for the same account |

Use one email-code flow for new and returning accounts. Configure a ten-minute expiry and a 60-second resend delay.

Show a general response after requesting a code. Do not reveal whether an email has an account.

Verify codes with the backend. The visible countdown does not replace server rate limits.

Avoid separate password creation, reset, and confirmation screens.

Changing the email field preserves the pending invitation. A new valid code replaces the prior attempt.

Ask for photo access only when the person selects an avatar or memory photo.

### Pairing

#### Create an invitation

Show a 12-character invitation code in three groups. Offer Copy and the native share sheet.

State the 24-hour expiry. Show Regenerate and Cancel invitation.

The share sheet opens only after a user action. The app never sends an invitation without that action.

#### Accept an invitation

Accept either the complete link or its code. Trim separators and normalize letter case.

After sign-in, show the inviter's display name and avatar. Show no calendar, message, or photo content.

Explain: **Your partner will see shared events, tasks, messages, and memories. Private events stay private.**

Use Join pair as the only primary action. Keep Cancel available.

#### Waiting and failure states

| State | UI behavior |
|---|---|
| Waiting | Invitation details and explicit refresh; realtime can update the state |
| Partner joined | Confirm both names; proceed to the pair welcome |
| Wrong or expired | Use one generic error; offer to enter a new invitation |
| Already used | Explain that the invitation is unavailable |
| Self-invitation | Explain that a second account is required |
| Already paired | Open current pair settings; never switch pairs silently |
| Pending pair exists | Allow cancellation of the empty pending pair before joining |
| Race lost | Return the current server state; do not display a third member |
| Offline | Keep the code as a local draft; do not claim it was accepted |

#### Pair welcome

Show both names, the selected icon, and **Your space is ready**.

Offer Add your first event. Put Add an important date beneath it as an optional action.

Allow Continue to Today. Do not require anniversaries, birthdays, or relationship history.

### Native shell

Use Today, Calendar, Memories, Messages, and Tasks in the bottom tab bar.

Use labels and one consistent outline icon set. Keep the bar above the device safe area.

Put the pair avatar and unread reminder indicator in the header. The avatar opens Settings.

Preserve each tab's scroll position. Use native stack navigation for details and full-screen forms.

Android Back closes the keyboard or current screen before leaving the app. Warn only when unsaved input would be lost.

Save drafts before tab changes or app backgrounding. Revalidate membership before restoring shared content on resume.

Do not turn every interaction into a modal. Use native menus for short action lists.

### Today

Order: greeting and date, next three events, latest memory, latest note, due tasks, next important date.

Use the current pair's names. Do not use generated compliments or relationship summaries.

Show Add event as the main action. Each section links to its full tab.

Show up to three unfinished tasks due today or earlier. Use See tasks for the full list.

Show one latest pinned note. A link opens all pinned notes in Messages.

Show one upcoming important date with its absolute date. Compute the countdown in the pair timezone.

When data is empty, show a short prompt and its creation action. Omit empty decorative cards.

Display reminder permission problems beside the reminder area. Do not block use of the app.

### Calendar

Default to an agenda grouped by date. Offer Month as a second view.

Use filters for All, Me, Partner, and Together. Include visible owner names beside colors.

A private event appears only to its author. Mark it with a lock and Private label.

The event detail shows title, date, time, timezone, people, visibility, location, description, and the viewer's reminder.

| Form field | Rule |
|---|---|
| Title | Required; 1–120 characters |
| All-day | Switches between date fields and date/time fields |
| Start / End | End follows start; all-day UI shows the last included day |
| Timezone | Detected default; editable IANA zone |
| People | Me, Partner, Together; private events use Me |
| Visibility | Shared or Private; defaults to Shared |
| Location | Optional text; 200 characters; no background location access |
| Description | Optional plain text; 2,000 characters |
| Important date | Available for all-day events; offers yearly repeat |
| Your reminder | None, 15 minutes, one hour, or one day before |

Convert the inclusive all-day end shown in the form to an exclusive stored end date.

All-day reminder offsets count back from 09:00 in the event timezone. Show the reference time and offset before saving.
The one-day offset means 24 elapsed hours. Across daylight-saving changes, it can differ from 09:00 on the previous day.

Use the pair timezone as the default for important dates. Timed events default to the creator's timezone.

Show a conflict screen when the stored version changed. Offer Reload saved version or return to the preserved draft.

Do not silently overwrite the other person's edit. Do not automatically merge text fields.

Delete shared events through a confirmation that names the event. Cancel future reminder jobs on the server.

#### Date ideas

Open Saved ideas from the Calendar header menu.

Each idea has a required title, optional note, and optional HTTPS link.

Plan date prefills a shared event. Save the event and its source idea link in one transaction.

Mark the idea Planned after confirmation. On deletion of the future event, return it to Saved.

Allow manual archive. Do not scrape URLs, infer budgets, book venues, or generate suggestions.

### Tasks

Start with one General list. Allow named lists, including a user-created grocery list.

Allow list rename and deletion, except General. Require an empty list; offer Move tasks to General before removal.

Each row shows a checkbox, title, assignee, and optional due date. Make the whole checkbox label easy to tap.

Quick add requires only a title. Open details for list, assignment, due date, or reminder.

Use Me, Partner, or Unassigned. Both members can complete shared tasks regardless of assignment.

Keep completed items in a collapsed group. Allow Undo after completion.

On a failed completion, restore the prior state and show Retry beside the task.

Use version checks for text edits. Completion uses an explicit desired state, never a server-side toggle.

Offer Delete task in its detail menu, with a confirmation naming the task.

A due date does not create a push without the person's reminder preference.

### Messages and notes

Use one chronological conversation. Load the latest 50 messages, then page backward.

The composer supports plain text up to 4,000 characters. Keep Send reachable above the keyboard.

Show Sending, Sent, or Failed beside the sender's message. Failed items keep their original text and UUID.

Show a new-message affordance when the reader is viewing older messages. Do not force scrolling.

Unread count reflects durable messages beyond the viewer's read cursor. Do not expose that cursor as partner read receipts.

Allow authors to delete their own messages after confirmation. Do not allow editing sent messages in this release.

Each member can pin one of their own messages. Replacing it removes the previous pin in one transaction.

Pin actions say **Pin as note**. The conversation contains the authoritative message.

Show both pins above the conversation. Today displays the most recent pin.

Do not add a sticker store, reaction picker, typing indicator, or online status.

### Memories

Use a feed grouped by month. Each entry shows date, photo, caption, and author.

Native Add memory opens the photo picker. Browser Add memory opens a file input. Select one to five photos.

Require the memory date. Keep the caption optional, with a 1,000-character limit.

Show each photo's upload state. Publish only after every selected photo has completed.

Allow removing a failed photo before submission. Native encrypted drafts survive closure; browser drafts last while the tab remains open.

Keep uploads in the foreground for the first release. Explain interruption and offer explicit retry.

The detail screen shows full images without the card crop. Allow saving a copy through a deliberate action.

The author can change the caption or delete the memory. The partner can view and save a copy.

Explain that saved copies remain outside Deseo after deletion or disconnect.

### Settings

| Group | Controls |
|---|---|
| You | Display name, avatar, timezone, system date/time format |
| Your pair | Partner identity, stable owner colors, pair timezone, invitation state |
| Notifications | Device permission, event/task reminders, message alerts, quiet hours |
| Your data | Export shared-access data while paired; export own contributions after disconnect |
| Help | Short help pages, support contact, app version |
| Account | Change email with verification, sign out, sign out all devices, delete account |
| Pair | End pair, separated from ordinary edits |

Keep partner colors fixed as blush and mint in the first release. Names identify people independently of color.

Timezone changes affect future display and quiet hours. Do not reinterpret stored event instants.

A pair timezone change affects all-day reminder instants. Show the new time and recalculate unsent jobs.

Default quiet hours are off. Let each person set start and end in their own timezone.

Defer suppressed pushes until quiet hours end. Expire an event push when its event has already started.

#### Destructive actions

End pair explains access loss and the 30-day own-contribution export window. Require fresh email verification and confirmation.

Delete account explains that it also ends the pair. Disable access immediately and show deletion progress independently of app login.

A remote account deletion request uses the same backend flow as the native app.

### Common states

| State | Rule |
|---|---|
| Loading | Keep layout stable; show a short progress state |
| Empty | Explain the missing content and offer one relevant action |
| Offline | Preserve drafts; label unsubmitted content; do not queue writes automatically |
| Failed read | Keep the screen structure and show Retry |
| Failed write | Preserve input; report the affected item; reuse its command ID |
| Conflict | Show that someone changed the record; preserve both saved data and local draft |
| Permission denied | Explain the feature impact and link to operating system settings |
| Pair ended | Clear shared views and open the end-pair notice |
| Account disabled | Clear session and shared caches; do not restore private screens |
| Expired media link | Request a new authorized link once; show a recoverable error if access fails |

### Accessibility and device behavior

Use at least 48dp touch targets. Keep visible labels on fields and navigation.

Support Dynamic Type, VoiceOver, TalkBack, keyboard focus, and Android hardware Back.

Announce save failures and send results. Do not move focus on every realtime update.

Use platform date pickers where suitable. Provide explicit timezone and all-day labels around them.

Test long names, large text, small phones, safe areas, and the keyboard over the composer.

Keep gesture-only actions available through visible controls. Do not use swipe as the only delete or reply action.

Use the system font and native text rendering. See STYLE.md for native token mapping.

## Visual assets

| Asset | Contents |
|---|---|
| [Reviewed frontend gallery](../design/frontend-2026-10-07/web/index.html) | Captures of source `701f078`; see its merge note |
| [Frontend capture records](../design/frontend-2026-10-07/web/coverage.json) | Recorded source, dates, views, and fixtures |
| [Portal gallery](../design/web-portal/index.html) | Captured browser pages with full-size links |
| [Capture records](../design/web-portal/coverage.json) | Routes, views, viewports, and fixture details |
| [Static reference](../design/preview.html) | Sample interactions without persistence |
| [Desktop](../design/desktop.jpg), [mobile](../design/mobile.jpg) | Static overview images |
| [Calendar](../design/mobile-calendar.jpg), [messages](../design/mobile-messages.jpg) | Static mobile images |
| [Selected icon](../design/icons-round-2/icon-05-two-voices.png) | Two voices, round two, icon 05 |
| [First icon round](../design/icons/comparison.html) | Ten initial concepts |
| [Second icon round](../design/icons-round-2/comparison.html) | Ten variations of Together, Two sparks, and Conversation |
| [First prompts](../design/icons/prompts.json), [second prompts](../design/icons-round-2/prompts.json) | Image generation records from 4 October 2026 |

The portal capture uses 1440 × 1000 and 390 × 844 viewports, plus full-page images for long forms.
Its display clock is 5 October 2026, 10:00 Europe/Warsaw. Backend and Auth clocks retain real time.
Normal views use the local Anna and Marek pair. Other views use disposable fixtures or controlled request failures.
The captures mask invitation and verification codes. Browser confirmation prompts require separate navigation checks.
The root route and invitation entry resolve to Welcome. The gallery records 39 routes, 119 views, and 238 viewport records.

### Visual review

The 4 October 2026 review covered the static reference and the pastel revision.
It recorded no horizontal overflow across five screens at 320, 360, 390, 768, and 1440px.
It checked heading, badge, navigation, and composer bounds, with one active navigation item per view.
The revision moved memories and notes before tasks, increased navigation labels to 12px, and task targets to 44px.
It added screen-specific header actions and removed the event action from Messages.
The review checked the desktop overview and mobile Today, Calendar, and Messages after the palette change.
The ten measured color pairs met 4.5:1 for text and 3:1 for essential controls. See [Style](../STYLE.md#measured-palette-contrast).

These are historical visual results. The reference uses sample content and an illustration in place of a personal photo.
It does not save events, upload photos, send messages, or schedule reminders.
The review did not establish product usability, screen-reader access, text zoom, keyboard behavior, or native device acceptance.

## Sources

The source review dates from 4 October 2026. Vendor descriptions do not establish independent usability results.
Check current official documentation before changing dependencies or preparing a release.

### Product references

| Source | Observed feature | Deseo decision |
|---|---|---|
| [Cupla product overview](https://www.cupla.app/the-app/) | Shared schedules, tasks, date planning, important dates, saved ideas | Keep manual shared planning, reminders, and user-written date ideas |
| [Cupla calendar explanation](https://www.cupla.app/help/en/articles/15051425-whats-the-difference-between-a-shared-calendar-on-ical-or-google-and-using-cupla) | External calendar aggregation and schedule comparison | Defer provider sync; do not promise complete availability |
| [Couply homepage](https://www.couply.io/) | Questions, quizzes, and relationship content | Retain warmth; exclude scoring and coaching |
| [Couply FAQ](https://www.couply.io/faqs) | Date planner, photo journal, love notes, important-date reminders | Combine these needs with shared planning |

Deseo's screen, data, and architecture decisions are original proposals. They are not claims about either app's internal implementation.

### Platform references

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

Use [unslop](https://github.com/michael-denyer/pstack-claude/blob/main/plugins/pstack/skills/unslop/SKILL.md) for documentation and UI text.
The initial module review used [Improve Codebase Architecture](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md)
and [Codebase Design](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md).
See [release requirements](DEVELOPMENT.md#store-preparation) for store sources.

## Frontend design

Date: 7 October 2026. The owner approved this scope, spec, and plan.
Task reviews and the final source review passed on their recorded revisions.
Use [the merge record](DEVELOPMENT.md#frontend-merge-record) for the combined source and evidence limits.

<a id="frontend-design-1-intent"></a>
### 1. Intent

Improve browser and native interfaces for two partners who plan days, share messages, and save memories.
Apply Anthropic's frontend-design skill. Keep Deseo's pastel colors and Two voices icon.
The approved treatment gives planning compact rows, photos more space, and notes personal surfaces.

<a id="frontend-design-2-scope"></a>
### 2. Scope

Cover `apps/web`, `apps/mobile`, shared brand tokens, and their design documentation.
The browser route manifest defines 39 routes and 119 views. Cover corresponding native routes and permission states.
Keep product flows, route addresses, feature interfaces, [data contracts](ARCHITECTURE.md#data-contract), and access rules.
Use implemented settings controls. Pending backend work and the public site remain separate deliveries.
Preserve unrelated changes, local user data, and historical screenshots with their recorded source.

<a id="frontend-design-3-approach"></a>
### 3. Approach

The owner selected shared controls followed by screen composition. Screen-only corrections would leave inconsistent controls and type.
Complete each working layer before the next. Reuse current libraries and components.
Add shared structures only for multiple callers.

<a id="frontend-design-4-visual-rules"></a>
### 4. Visual rules

<a id="frontend-design-color"></a>
#### Color

Use [STYLE.md colors](../STYLE.md#4-color-tokens) and `brand/tokens.json` for palette values and semantic roles.
Keep stable partner colors with visible owner names. Reserve status colors for their defined states.

<a id="frontend-design-type-and-dimensions"></a>
#### Type and dimensions

Use [the style scale](../STYLE.md#5-typography-spacing-and-shape), system fonts, and supported native weights.
The approved change removed the separate browser Inter preference and aligned section headings with the 20px specification.
Keep 48px browser targets, 48dp native targets, visible labels, 16px form text, and font scaling.

<a id="frontend-design-content-hierarchy"></a>
#### Content hierarchy

Follow [the selected blend](../STYLE.md#blend): photos lead personal content; compact rows support plans and tasks.
Keep peach notes, group borders, and content spacing. Reserve shadows for dialogs, popovers, and selected navigation.
Use existing action feedback durations and [the contributor motion rule](../AGENTS.md).

<a id="frontend-design-5-layout"></a>
### 5. Layout

Use [responsive layout](../STYLE.md#6-responsive-layout) and [screen contracts](../STYLE.md#7-navigation-and-screen-contracts).
Keep browser sidebar, rail, and drawer navigation. Keep native bottom tabs and stacks.
Desktop Today pairs flexible planning with a 360px personal column when both fit.
Single-column order: heading, Add event, upcoming plans, latest memory, pinned note, due tasks, important date.
Browser keyboard order must match that visual order. Native layouts must clear safe areas, keyboards, and navigation.

<a id="frontend-design-6-screen-coverage"></a>
### 6. Screen coverage

Use [Screens](#screens) for flows and [STYLE.md screen contracts](../STYLE.md#7-navigation-and-screen-contracts) for composition.
Cover authentication, pairing, Today, Calendar, events, ideas, Memories, Messages, notes, Tasks, notifications, Settings, and route failures.
Review normal, empty, loading, error, conflict, unknown-outcome, and unavailable states.
Keep input after failures. Use existing retry and reconciliation rules. Browser drafts remain in memory until reload.

<a id="frontend-design-7-module-and-data-rules"></a>
### 7. Module and data rules

Follow [module structure](ARCHITECTURE.md#module-structure) and [dependency rules](ARCHITECTURE.md#dependency-rules).
Keep platform controls separate. Map shared tokens through browser CSS and the native theme.
Reuse platform EventRow, MemoryCard, NoteCard, and TaskRow components across existing callers.
Keep data access in feature queries and commands. Preserve lazy routes, feature styles, focus return, and draft warnings.
This update adds no domain UI contracts, query cache, cross-platform UI layer, or product dependency.
Remove replaced styles and obsolete selectors.

<a id="frontend-design-8-writing"></a>
### 8. Writing

Follow [STYLE.md writing rules](../STYLE.md#13-writing-rules) and Stop Slop.
Keep established product terms, action names, sample language, and space for longer translations.
Explain destructive effects before confirmation. This update adds no language system.

<a id="frontend-design-9-verification"></a>
### 9. Verification

Use [Development verification](DEVELOPMENT.md#verification) for commands, test importance, browser widths, and evidence requirements.
The approved priorities were focus and recovery 95, enlarged/narrow text 92, and Today order 90.
Decoration tests scored 25 and required visual review only.
Review browser routes at desktop and phone widths. Record gallery coverage, links, dimensions, and source revision.
Keep source checks, browser captures, native exports, and physical-device evidence separate.
Physical native acceptance remains unverified; see [native evidence](DEVELOPMENT.md#native-frontend-evidence).

<a id="frontend-design-10-delivery-order"></a>
### 10. Delivery order

Completed layers: foundation; entry/settings; Today/Calendar; tasks/notifications; Memories; Messages/notes; checks and captures.
Reviewers checked both platforms at each layer. [The handoff](DEVELOPMENT.md#frontend-design-handoff) records corrections and remaining device checks.

<a id="frontend-design-11-design-review"></a>
### 11. Design review

The owner selected the existing palette, icon, ownership labels, and planning structure.
Photos, notes, and planning rows retain distinct shapes and density.
Each gallery proves its recorded source. Later merged forms and controls can differ.

<a id="frontend-design-references"></a>
### References

- [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
- [Stop-slop skill](https://github.com/hardikpandya/stop-slop/blob/main/SKILL.md)
- [Screen guide](README.md#screens)
- [Browser scope](README.md#browser-portal)

## Design Taste comparison

Open [the comparison](../design/design-taste-2026-10-08/index.html) to review eight browser screens at desktop and phone widths.
Each set uses the same local demo account and display time. Full-page images include content below the viewport.
Both sets retain the observed photo error and Retry. Before and after captures use the same preview origin.
