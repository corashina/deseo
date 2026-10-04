# Deseo product design

Date: 4 October 2026. Status: Draft for owner review.

## 1. Brief

Build a useful, intimate app for two people. Help them coordinate plans and make room for shared life.

The owner requested Android and iOS, Expo, TypeScript, a pastel style, and the Two voices icon.

The owner wants a complete design and implementation plan before product work starts.

Assumptions: English first, adults as the intended audience, one active pair per account, and a free private beta.

No jurisdiction, legal operator, launch domain, or paid plan has been selected. These are release inputs, not invented facts.

## 2. Product choices

| Approach | Benefit | Cost | Decision |
|---|---|---|---|
| Private companion | Combines daily plans with personal content | Requires reliable shared data across features | Recommend |
| Planning app | Narrow calendar and task workflow | Gives little reason to save memories or notes | Too narrow for the brief |
| Relationship coaching app | Many activities and prompts | Requires editorial expertise and can create pressure | Exclude |

Cupla provides a useful reference for shared schedules, tasks, dates, and reminders.

Couply provides a useful reference for love notes, photo memories, and time together.

Sources: [Cupla](https://www.cupla.app/the-app/) and [Couply FAQ](https://www.couply.io/faqs).

Use these needs, not their branding, proprietary content, quizzes, or exact screens.

## 3. Jobs and acceptance

| Job | Required result |
|---|---|
| Join my partner | Two verified accounts form one pair through an explicit invitation |
| Plan our day | Both people see the same shared event after saving and refreshing |
| Keep my own plan private | My partner cannot retrieve its title, time, or location |
| Remember something | I select a reminder and see whether this device permits push |
| Share the work | Either partner can add, assign, complete, or reopen a shared task |
| Send something personal | A message survives restart; a failed send keeps its text |
| Keep a memory | Both people can open an uploaded photo and its caption |
| Plan a date | A saved idea can prefill an event without creating duplicates |
| Leave safely | Shared access stops without approval from the other person |

Invite acceptance, a shared event, and partner visibility form the first complete product slice.

## 4. Scope

### First public release

| Area | Include | Keep small |
|---|---|---|
| Public site | Landing, download links, invite handoff, support, privacy, terms, account deletion | Static pages; no content platform |
| Authentication | Email code, session restore, sign-out, fresh verification for destructive actions | No passwords or social identity linking |
| Pairing | Create, invite, accept, revoke, expire, leave | Exactly two people; one active pair each |
| Welcome | Display name, timezone, optional avatar, pair invitation | No questionnaire or carousel tour |
| Today | Next three events, latest memory, latest pinned note, due tasks, next important date | Compose existing data |
| Calendar | Agenda, month view, shared/private events, owner labels, all-day dates | One-off plans and yearly important dates |
| Date ideas | Title, optional note/link, plan action, archive | The couple writes their own ideas |
| Tasks | Named lists, assignment, optional due date/reminder, completion | No priorities, labels, subtasks, or boards |
| Memories | One to five photos, date, caption, author, detail view | No video, albums, comments, or editing suite |
| Messages | Text, retry, paging, unread count, pinned note | No calls, presence, typing indicators, or read receipts |
| Reminders | Event/task reminders, message alerts, quiet hours, per-device permission state | Best-effort push; no alarm guarantee |
| Settings | Profile, timezone, pair, notifications, help, export, disconnect, account deletion | One light theme |

### Deferred until evidence supports the cost

- Google, Apple, or Outlook calendar sync.
- General repeating events, repeating tasks, and occurrence exceptions.
- Voice messages, video, calls, location sharing, and home-screen widgets.
- Full offline browsing, automatic offline writes, and background photo uploads.
- Social sign-in, app lock, extra themes, additional languages, and paid plans.
- Curated conversation prompts and date libraries. Add them only after editorial and user review.

### Excluded product directions

Relationship scores, streaks, guilt messages, AI coaching, personality profiling, public feeds, advertising, and partner surveillance.

## 5. Experience

Use five tabs: Today, Calendar, Memories, Messages, Tasks.

Open Settings from the pair avatar. Put date ideas inside Calendar. Keep notes inside Messages.

Use one main action per screen. Use full-screen native forms for longer edits.

Make the app intimate through real photos, private notes, soft shapes, and calm spacing.

Use adult, direct language. Avoid forced pet names, sexual assumptions, glitter, and reward animations.

Use the approved palette and selected icon from [STYLE.md](../../../STYLE.md).

The [screen guide](../../product/SCREENS.md) defines each screen and its state transitions.

## 6. Pair lifecycle

An unpaired account can create an invitation or accept one.

A pending pair has one member. Its owner can replace or revoke the invitation.

Show what will become shared before acceptance. Require an explicit Join pair action.

Invitation acceptance must lock the pair and both account membership records within one transaction.

An active pair has exactly two members. Neither person is an administrator over the other.

A paired account must leave its current pair before joining another. Never merge pair histories.

During waiting, preserve personal drafts. Do not publish them until the pair becomes active and the author submits them.

Either person can end the pair. Revoke shared access, invitations, queued pushes, and shared subscriptions.

Each former member can export their own contributions for 30 days. Purge the ended pair after that period.

Do not show the other person's content during this export period. Copies already downloaded cannot be recalled.

Explain these effects before confirmation. A new pair starts empty.

## 7. Calendar rules

Shared is the default visibility. Show the visibility beside Save.

Private events belong to their author. They do not appear as busy blocks on the partner's calendar.

Owner labels identify the people involved. They never control read or write access.

Timed events store start and end instants plus the chosen IANA timezone.

All-day events store calendar dates. Their end date is exclusive.

Display each person's local time. Show the event timezone when it differs from the device timezone.

Require an explicit choice when a daylight-saving change repeats a local time. Reject nonexistent local times with a correction.

Important dates can repeat yearly. February 29 uses February 28 in non-leap years, with a visible explanation.

Yearly events support series edits only. Ordinary events and tasks do not repeat in this release.

Show overlaps as information. Do not block saving or claim both people are free from incomplete schedules.

Each member controls their own reminders. One member cannot enable the other's device permissions.

## 8. Content and reliability

Use a generated UUID for each create command. Reuse it when retrying after a timeout.

Apply version checks to shared edits. Preserve the local draft when the server reports a conflict.

Realtime events refresh views. The database remains the source of truth.

Fetch current data after reconnect and app resume. Remove shared views when current membership cannot be verified.

Keep local drafts encrypted. Do not store downloaded shared content for offline browsing in the first release.

Show Sent only after the database confirms a message. It does not mean the partner read it.

Messages contain plain text. Links open through the operating system after a tap; do not fetch previews.

Strip location metadata from uploaded photos. Keep the accepted image intact; generate separate display sizes.

Publish a memory only after its required photos finish. Failed uploads retain the caption and a retry action.

## 9. Data protection

Enforce current membership in database and storage access rules. A route guard alone is insufficient.

Use private storage. Restrict media links to short lifetimes. Keep secret backend keys out of both clients.

Use generic push text by default. Never include message text, event titles, or photo URLs in push payloads.

Do not claim end-to-end encryption. The proposed backend can process content for storage, delivery, and export.

Do not record content, email codes, invitation tokens, or signed media URLs in logs.

Account deletion requires fresh verification. Disable access first, then remove authored data through a retryable job.

The [data contract](../../architecture/DATA.md) defines exact permissions, limits, and lifecycle behavior.

## 10. Architecture

Use one Expo TypeScript app for Android and iOS. Use Expo Router for navigation.

Use a small Astro TypeScript site for public pages and installation handoff. It contains no shared account data.

Use Supabase for Auth, PostgreSQL, private Storage, Realtime, and scheduled backend work.

Use TanStack Query for fetched state. Use React state for form interaction and encrypted storage for drafts.

Keep feature screens, queries, commands, validation, and tests together. Keep route files thin.

Use native React Native styles. Transfer STYLE.md tokens into a typed theme; do not apply browser CSS to native screens.

The [architecture](../../architecture/ARCHITECTURE.md) defines the folder map and dependency rules.

## 11. Delivery stages

| Stage | Working result | Exit condition |
|---|---|---|
| A. Shared plan | Sign-in, pair, Today, one-off events | Two devices see one shared event; a third account cannot retrieve it |
| B. Daily planning | Tasks, date ideas, yearly dates, reminders | Device reminders and race cases pass; task edits survive restart |
| C. Personal content | Messages, notes, memories | Text retries do not duplicate; photo access respects membership |
| D. Public beta | Settings, export, deletion, website, store builds | Privacy, device, accessibility, and operational checks pass |

Build access revocation in Stage A. Expand purge/export coverage as each record type appears.

Do not expose unfinished tabs in internal builds. Release all five tabs only when their complete flows work.

The [implementation plan](../plans/2026-10-04-deseo-implementation.md) maps each stage to tasks and checks.

## 12. Validation goals

These are targets, not measured results.

- At least four of five test pairs complete pairing without facilitator help.
- At least four of five people create a shared event within 60 seconds after opening its form.
- All testers can identify event visibility before saving.
- A confirmed message appears on the other online device within three seconds in the test network.
- No tested route, database query, media request, or subscription reveals another pair's data.
- VoiceOver and TalkBack users can complete sign-in, pairing, event creation, and message sending.
- At least four of five test pairs can find notification controls and explain disconnect effects.

Use observed failures to revise the design. Do not add features to compensate for an unclear core flow.

## 13. Review points

Confirm the complete scope, the proposed Supabase backend, and the email-code authentication flow before product implementation.

The owner has already confirmed Expo, TypeScript, Android, iOS, pastel styling, and icon 05.

Choose a legal operator, launch region, domain, support address, and store accounts before public release.

This document does not authorize provisioning, publishing, store submission, or sending invitations to real people.
