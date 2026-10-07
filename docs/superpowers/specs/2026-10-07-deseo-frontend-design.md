# Deseo frontend design

Date: 7 October 2026.

Status: The owner selected the existing pastel identity. This written spec awaits owner review.

## 1. Intent

Improve the existing browser and native interfaces for two partners who plan days, share messages, and save memories.

Apply Anthropic's frontend-design skill across the implemented product. Keep Deseo's pastel colors and Two voices icon.

Give planning content a compact layout. Give photos more space. Make notes look like personal content.

Success means clear actions, consistent controls, readable content, and complete screen coverage on both platforms.

Follow [STYLE.md](../../../STYLE.md), [Architecture](../../architecture/ARCHITECTURE.md), and [Data](../../architecture/DATA.md).

## 2. Scope

Cover `apps/web`, `apps/mobile`, shared brand tokens, and the design documentation that guides those interfaces.

Use the existing browser route manifest as the coverage list. It contains 39 routes and 119 views.

Cover the corresponding native routes and native controls, including permission states and keyboard layouts.

Keep the current product flows, route addresses, feature interfaces, data contracts, and access rules.

Use the implemented settings controls. Pending backend work does not authorize new account controls in this design.

The planned public site remains a separate delivery. Apply these brand rules when that delivery starts.

Preserve unrelated working changes and local user data. Keep historical screenshots as evidence of their recorded source.

## 3. Approach

| Approach | Benefit | Cost | Decision |
|---|---|---|---|
| Shared controls, then screen composition | Consistent product with distinct content layouts | Requires review of both platforms | Select |
| Screen corrections alone | Smaller first change | Leaves inconsistent controls and typography | Reject |

Start with tokens and shared platform controls. Complete each layer before changing feature screens.

Use the current libraries and components. Add a component only when multiple callers need the same structure.

## 4. Visual rules

### Color

Retain the semantic colors in `brand/tokens.json`. Use these six colors as the visual foundation.

| Role | Value | Use |
|---|---|---|
| Canvas | `#FAF7F5` | Page background |
| Ink | `#383547` | Main text |
| Action | `#DDD4EE` | Primary actions and selection |
| Partner A surface | `#F5E3EB` | Partner A content |
| Partner B surface | `#DEF0E9` | Partner B content |
| Note surface | `#FAEDDF` | Pinned notes and personal dates |

Use the existing dark foregrounds on pastel surfaces. Keep owner names beside their stable partner colors.

Keep white surfaces for forms and grouped planning content. Use the existing lilac surface for shared content.

Reserve error, warning, and success colors for their defined states. Recheck contrast after changing opacity or composition.

### Type and dimensions

Use the system sans-serif stack specified in STYLE.md. Remove the browser's separate Inter preference.

Keep the approved type scale, spacing tokens, and corner sizes. Align browser section headings with the 20px specification.

Use native system fonts and supported weights. Respect Dynamic Type and keep 48dp native targets.

Use 48px browser targets for shared controls. Keep form text at 16px and labels visible.

Keep text left aligned. Use tabular numbers for times and countdowns. Let long names and titles wrap.

### Content hierarchy

Use the couple's photos as the main visual focus. Use compact event rows and task rows for planning.

Give notes their existing peach surface. Use borders to separate groups, and spacing to separate content within groups.

Reserve shadows for dialogs, popovers, and selected navigation. Avoid decorative gradients and repeated entrance animations.

Use existing feedback durations for user actions. Follow AGENTS.md's motion rule; do not add reduced-motion variants.

## 5. Layout

Keep the browser sidebar, tablet rail, and phone drawer. Keep native bottom tabs and stack navigation.

Keep the browser's 1440px content cap, 720px form cap, and 960px message cap.

Keep one main action in each page header. Move it below the heading before either becomes crowded.

Desktop Today uses a flexible planning column and a 360px personal column when both fit.

```text
Navigation | Today and date                         Add event
           | Upcoming plans       | Latest memory
           | Due tasks            | Pinned note
           |                      | Important date
```

Single-column Today uses the approved personal-content order. Change browser structure so keyboard order matches visual order.

```text
Today and date
Add event
Upcoming plans
Latest memory
Pinned note
Due tasks
Important date
```

Keep 16px phone page padding. Use 20px card padding on phones and 24px on desktop.

Native screens respect safe areas, the keyboard, and font scaling. Keep the final content item clear of navigation.

## 6. Screen coverage

| Area | Design treatment |
|---|---|
| Welcome and authentication | Selected icon, concise introduction, focused email-code form, one primary action |
| Pair setup and invitations | Clear steps, partner names, readable code, visible expiry, distinct waiting and failure states |
| Today | Compact schedule, prominent memory, peach note, due tasks, important date with absolute date |
| Calendar | Clear date controls and owner filters; readable month, agenda, and comparison layouts |
| Events | Group required fields first; show ownership, visibility, timezone, reminder, and local validation |
| Date ideas | Distinct saved, planned, and archived states; keep planning actions beside the idea |
| Memories | Month headings, reserved image space, 3:2 feed crops, full images in details |
| Memory forms | Caption and photo selection, progress per photo, local failure and Retry controls |
| Messages | Stable sender colors, grouped messages, timestamps, delivery states, reachable composer |
| Pinned notes | Peach surface, author, note text, pin time, Reply and applicable author actions |
| Tasks and lists | Full-row completion targets, readable completion state, assignment, due date, list actions |
| Notifications | Plain source labels, dates, unread state, and actionable unavailable or permission states |
| Settings | Separate profile, pair, preferences, and account actions; isolate destructive controls |
| Dialogs and route failures | Focused action, clear Cancel or recovery action, visible focus and state explanation |

Review empty, loading, error, conflict, unknown-outcome, and unavailable states beside each area's normal state.

Keep inputs after failures. Keep pending actions distinct from confirmed success. Preserve existing retry and reconciliation rules.

Describe draft storage according to the platform. Browser drafts stay in memory and do not survive reload.

## 7. Module and data rules

Keep browser controls in `apps/web/src/components/ui`. Keep native controls in `apps/mobile/src/components/ui`.

Map existing brand tokens through browser CSS and the native theme. Keep feature styles inside their owning application.

Keep data access in feature queries and commands. Present existing results through display components.

Reuse each platform's EventRow, MemoryCard, NoteCard, and TaskRow across their existing callers.

Use the current dialog and navigation mechanisms. Preserve focus return, Escape behavior, Back behavior, and draft warnings.

Preserve lazy route loading and feature stylesheet ownership. A route must render correctly after a direct browser load.

Do not add UI contracts to `packages/domain`. Do not add a second query cache or cross-platform UI abstraction.

Remove obsolete styles when replacing them. Do not keep compatibility selectors or introduce new product dependencies for this update.

## 8. Writing

Apply stop-slop to UI text and changed documentation. Use short sentences, concrete states, and consistent action names.

Keep instructions within 20 words. Use sentence case. Remove decorative labels that do not help users choose an action.

Use event, memory, message, note, task, and reminder with their existing meanings.

Use the same action name through its form and result. Keep destructive effects explicit before confirmation.

Keep the existing sample language. Preserve layout space for longer translated text without adding a new language system.

## 9. Verification

Use [the verification plan](../../engineering/TESTING.md) and the current development commands.

Run `npm run verify:web`, `npm run verify:mobile`, and `npm run test:domain` on the final implementation.

Export native Android and iOS JavaScript after shared frontend changes. Record physical-device checks as separate evidence.

Extend existing tests only for missing high-importance behavior. Rate proposed tests before writing them.

| Behavior | Importance | Check |
|---|---:|---|
| Keyboard navigation and dialog focus | 95 | Existing browser acceptance and manual focus review |
| Draft retention and failure recovery | 95 | Existing browser and native feature suites |
| Long text, enlarged text, and narrow layouts | 92 | Existing layout suite and rendered screenshots |
| Today content and keyboard order | 90 | Browser order check and native screen review |
| Exact decoration and shadow values | 25 | Visual review; no new automated test |

Inspect browser pages at 320, 390, 768, 1024, and 1440px. Check 200% text sizing and keyboard access.

Review all route-manifest views at desktop and phone widths. Use existing controlled fixtures for failure and destructive states.

Regenerate the portal gallery after final changes. Check coverage, links, image dimensions, and source revision.

Review native screens at phone widths and large text sizes. Check VoiceOver, TalkBack, safe areas, and keyboard access on devices.

Keep source checks, browser evidence, native exports, and device evidence separate. Do not claim device acceptance from source tests.

## 10. Delivery order

1. Align tokens, type, platform controls, and shell layouts.
2. Complete authentication, pair setup, settings, and their states.
3. Complete Today, Calendar, events, and date ideas.
4. Complete tasks, lists, notifications, and preferences.
5. Complete memories, messages, and pinned notes.
6. Run final checks, capture screens, and record coverage and remaining device checks.

Keep each completed layer usable. Review both platforms before moving to the next layer.

## 11. Design review

The selected treatment follows Deseo's existing palette, icon, ownership labels, and planning structure.

Photos provide the main visual focus. Notes and planning rows retain different shapes and density.

The implementation must verify current source through new captures. Earlier captures can differ from current styles.

The owner must approve this written spec before implementation planning. The plan must then receive its required review.

## References

- [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
- [Stop-slop skill](https://github.com/hardikpandya/stop-slop/blob/main/SKILL.md)
- [Screen guide](../../product/SCREENS.md)
- [Approved browser design](2026-10-05-deseo-web-portal-design.md)
