---
target: Shell
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
target_identity: "file:/home/user/deseo/apps/web/src/app/AppShell.tsx"
target_fingerprint: "sha256:98350bf0655503323a93ed0ffe5aac1ab58c06b52f89d03992f9532e74837f34"
target_path: /home/user/deseo/apps/web/src/app/AppShell.tsx
timestamp: 2026-11-17T10-58-41Z
slug: apps-web-src-app-appshell-tsx
---
Method: dual-agent (A: A-shell · B: B-shell)

# Critique: Shell (rescore, 2026-11-17)

Evidence: design-capture run on master a9c61d0, 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 29/40, 72%.** Baseline: 26/40. P0: 0 · P1: 0 · P2: 4 · P3: 1 (Assessment A).

P2 and P3 findings stay open for a later pass. Assessment B lists the detector results and visible defects. Questions are in Assessment A.

## Assessment A: design review


Mode: Operate. Evidence: Today, Calendar, Tasks, Settings, and Pair start at 390/768/1024/1440 light and 390/1440 dark, plus `AppShell.tsx`, `router.tsx`, `components/ui/*`, `shell.css`, `base.css`, `controls.css`.

## Design specificity verdict

**Mostly category-standard, which suits an Operate shell. The pair presence is too quiet to make the frame Deseo's own.** The structure is a standard SaaS frame: a tinted sidebar with icon and label rows, a white top bar, and a large page title. In Operate mode that is correct. The world adds palette (lavender sidebar, lilac current-page fill with the selected shadow, Two voices icon) and density, and that part works in both palettes. The one product-specific element is the top bar pair line: two overlapped owner-colored avatars and "Name + Name". It is set as plain 15px ink text with nothing else in the bar, so it reads as a breadcrumb, not a signature move. Cover the logo and this could be any pastel productivity tool. The parts that are there are well made. What is missing is a frame that says "two people".

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Current page is clear (lilac fill + shadow, Calendar stays current on events/ideas). The unread count is the quietest element in the frame. The lazy-page fallback is a bordered "Loading page…" box. |
| 2 | Match system / real world | 4 | Today, Calendar, Memories, Tasks, Settings, Your pair: glossary terms, plain verbs, names instead of roles. |
| 3 | User control and freedom | 3 | The drawer closes on Escape, X, and route change. Back works. The collapsed sidebar resets on reload and on any pair-state change (`useState(false)` + `key={identity}`). |
| 4 | Consistency and standards | 3 | The account avatar opens Settings only below 768px. Pair names truncate per line on the phone but break mid-name at 768–1279px. The mobile avatar button is boxed while the menu button beside it is bare. |
| 5 | Error prevention | 3 | UnsavedChangesGuard covers navigation away from drafts. A busy dialog cannot close. Gate redirects stop invalid routes. |
| 6 | Recognition rather than recall | 3 | Labels show at every width, including under rail icons. On the phone, all four destinations hide behind the menu button. |
| 7 | Flexibility and efficiency | 2 | No shortcuts for the five destinations. The collapse choice is not kept. There is a skip link and a first-chunk prefetch. |
| 8 | Aesthetic and minimalist design | 3 | Calm and restrained. The desktop top bar is a 72px band that holds only one text line, with about 60% of it empty at 1440. |
| 9 | Error recovery | 3 | The session error offers Retry + Sign out. The route error separates "unavailable" from "could not load" and gives a return link. Field errors sit beside the field. |
| 10 | Help and documentation | 2 | The frame has no help or support entry. Help comes only from page descriptions and field hints. |
| **Total** | | **29/40** | **Good** |

## Cognitive load

Checklist: 0 failures (low load). Single focus, chunking, grouping, hierarchy, and progressive disclosure all pass. The rail keeps its labels, so the user does not need to remember icons.

Decision points with more than 4 visible options: the sidebar has 5 destinations, grouped 4 + Settings below a divider. That grouping keeps it within limits. The phone top bar has 3 controls.

## Emotional journey

- **Peak:** first sight of the frame at 1440. The two avatars and both names at the top of every page give a quiet "this is ours" moment. The lavender sidebar and Today's lilac selection feel personal, not corporate.
- **Valley:** 768–1024px. The names line breaks inside a surname and leaves "Jr" or "Nowakowski Jr" alone on line two. At 1024 the 256px sidebar squeezes the Calendar grid ("Weeken / d trip t…"). The user collapses it, then loses that choice on the next reload.
- **Valley:** on the phone, an unread "9" is a 12px lilac chip on the menu icon's corner. A message from the partner is the most emotional signal the shell carries, and it is the easiest thing to miss.
- **Reassurance:** Settings → End pair uses a danger button with a dialog that names the result. Session failure gives Retry and Sign out with a plain sentence. Both are good.

## What's working

1. **The rail at 768px** (`shell.css` rail block): 12px/600 labels under 20px icons, an unread badge pinned to the icon, a divider before Settings. Labeled, compact, and the 768 shots show nothing clipped.
2. **Current-page treatment** in both palettes: `action` fill, `on-action` text, and the selected shadow. It is clear without a loud accent, and Calendar stays current on `/events/*` and `/ideas/*` (`PortalNavigation.tsx`).
3. **Phone top bar name handling**: each name gets one line with an ellipsis, own avatar on the right, and the bar is sticky only below 768px. That handles the stress names cleanly at 390.

## Priority issues

**[P2] Unread count has the least visual weight in the frame**
- Where: `shell.css` `.unread-count`; `AppShell.tsx` drawer toggle; Today nav row at 1440 and the menu button at 390 (settings-390, settings-1440).
- Why: in a two-person app, "your partner wrote" is the main reason to open Today. The badge is a 12px `shared-soft` chip that blends into the lavender sidebar and sits on the corner of the phone menu icon.
- Fix: use the `primary`/`on-primary` pair with an 18–20px min-width circle and tabular numbers. Keep it on the Today row and the menu button only.
- Command: colorize

**[P2] Top bar pair names break inside a name at 768–1279px**
- Where: `shell.css` `.topbar-label` (`overflow-wrap: anywhere`, inline spans); today-768, today-1024, calendar-1024.
- Why: "Zieliński-" / "Nowakowski Jr" and an orphan "Jr" make the identity line look broken in exactly the band where the rail already makes the frame tight.
- Fix: make each name its own `inline-block` unit so lines break only at " + ". Above 768px, cap each name with an ellipsis, as on the phone.
- Command: layout

**[P2] Collapse choice is not kept; 1024 is cramped by default**
- Where: `AppShell.tsx` `const [collapsed, setCollapsed] = useState(false)` and `<AppShell key={identity}>` in `router.tsx`; calendar-1024.
- Why: at 1024 the 256px sidebar takes a quarter of the width and the month grid truncates titles mid-word. A user who collapses it has to do it again after each reload.
- Fix: keep the choice in `localStorage` (try/catch, per-viewer convenience). Read it in the `useState` initializer.
- Command: adapt

**[P2] Desktop top bar has no job beyond one text line**
- Where: `AppShell.tsx` header; `shell.css` `.mobile-account { display: none }` from 768px; every 1440 shot.
- Why: 72px of chrome on every page, with an empty right side. The phone gets an avatar that opens Settings; tablet and desktop users do not, so the same object behaves differently by width. On Today, which fills the window, this band takes height from the conversation.
- Fix: show the own-avatar Settings link at the right edge at every width. That gives one account entry everywhere and balances the bar.
- Command: layout

**[P3] Lazy-page fallback flashes a bordered box**
- Where: `router.tsx` `Page` → `<Suspense fallback={<Status>Loading page…</Status>}>`, one boundary per route.
- Why: each first visit mounts a new boundary, so the user sees a canvas box at the top of main, then the page jumps in. DESIGN.md says loading keeps the final layout's dimensions.
- Fix: move one Suspense boundary to wrap `<Outlet />` inside `AppShell` `main`. React Router 7 navigations run as transitions, so the current page stays visible until the next chunk is ready.
- Command: harden

## Persona red flags

- **Alex (power user):** no keys to switch between Today/Calendar/Memories/Tasks. Collapsing the sidebar at 1024 does not survive a reload.
- **Casey (one-handed phone):** all navigation sits at the top-left behind the menu button, out of thumb reach. The unread "9" is a 12px chip at the top. The drawer opens with no motion, so the change of context gives no cue.
- **Riley (stress tester):** long names break mid-surname at 768/1024. If both partners share an initial, the avatars differ by color only, though the names beside them save it.
- **Partner checking in (PRODUCT.md users):** they open the portal to see whether the other person wrote or planned something. The frame shows both names but gives no sign of the partner beyond a small badge, and the top bar does not change when something new arrives.

## Minor observations

- `shell.css` `.mobile-account`: a round avatar inside a bordered 12px-radius secondary box looks like a form control next to the bare menu button. Use the `text` variant.
- `Dialog.tsx` / `shell.css` `.navigation-drawer`: the drawer has no 200ms slide-in (DESIGN.md Motion). Its heading is the generic "Navigation", and the drawer lacks the brand row the sidebar has.
- `Button.tsx`: there is no busy state, so callers swap labels ("Add task" → "Saving…") and the width changes. DESIGN.md says it must not.
- `router.tsx` `Frame` session-error card renders outside `.entry-container`: no page padding and no brand row. It touches the screen edges at 390.
- `shell.css` dark: the top bar (`surface-dark`) is lighter than the sidebar (`sidebar-dark`), the reverse of light mode, so the bar has more weight than the navigation in dark mode.
- `PageHeader.tsx`: one component, used three ways. Today has an eyebrow and no description; Tasks and Settings have a description; Calendar has neither. The rhythm under the 40px title changes from page to page.

## Bolder move proposals

1. **Colorize the pair line** (all signed-in screens): set each top bar name in its owner foreground (`rose`/`teal`), with the "+" in `muted`. Reason: this makes the one product-specific element read as the frame's signature move. It follows the Name Beside Color rule, since the name is the label. It uses existing tokens only.
2. **Delight: partner activity on the pair line** (top bar, Today): when unread > 0, the partner's avatar gets a 2px `rose-accent`/`teal-accent` ring that clears on Today. Reason: it ties the unread signal to a person, not to a number, which fits "Feel like a pair", and it involves no scoring or streaks.

## Questions to consider

- Should the top bar exist on desktop at all, or should the pair line move to the sidebar foot and give the 72px back to the page?
- With four destinations, is the phone drawer worth a tap each time, compared with the bottom tabs the native app already uses?
- What would the frame look like if it showed "us" first and "the app" second?


## Assessment B: detector and rendered evidence


Scope: sidebar, collapse toggle, rail, top bar (pair avatars and names), menu button and account button, page header, shared Button/Field/Dialog/Status. Screen content is out of scope.

## Detector counts

**Source scan** (`impeccable detect --json apps/web/src/app apps/web/src/components/ui`): **0 findings**, exit 0.

**Rendered scan** (CI `--cdp`, 1440px light):

| Screen | Rule | Selector | Count |
|---|---|---|---|
| today | kicker-above-heading | `header.page-header > div > span.eyebrow` ("Monday, November 16" above h1 "Today") | 1 |
| calendar | nested-cards | `div.calendar-toolbar > div.view-tabs` | 1 |
| tasks | nested-cards | `div.view-tabs` | 1 |
| tasks-taskId | none | | 0 |
| settings | none | | 0 |
| pair-start | none | | 0 |

Rendered total: 3 (kicker-above-heading 1, nested-cards 2).

## Verified findings

No detector finding is real. These findings come from the screenshots and the CSS comparison.

1. **P3: the top-bar pair label wraps badly at 768 and 1024px.** At 1024px, "Jr" sits alone on the second line. At 768px, the line breaks at the hyphen in "Zieliński-Nowakowski". Cause: `.topbar-label` (apps/web/src/styles/shell.css:18) has `overflow-wrap: anywhere` and no `text-wrap: balance`, so the two name spans wrap as one run. Command: **typeset**. Add `text-wrap: balance`, or let the line break only at the " + " joint.
2. **P3: the two narrow-screen top-bar buttons have different weights.** Below 768px, the menu button is a borderless `text` Button (AppShell.tsx:42). The account link is a bordered `button secondary` box around a round avatar (AppShell.tsx:45, shell.css:24). The bordered square around a circle looks heavy next to the plain menu icon. DESIGN.md "Buttons > Text" says to use text buttons for icon toggles in the shell. Command: **polish**. Use one variant for both, or drop the border.
3. **P3: some spacing values are off the scale or not tokenized.**
   - Off-scale values: `.mobile-account { padding: 7px }` (shell.css:24); the `2px` vertical badge padding on `.unread-count` (shell.css:12) and `.partner-badge` (controls.css:44).
   - Hard-coded px instead of `var(--space-*)`: `.page-header` uses `gap: 16px 24px; margin-bottom: 32px` (base.css:33), the mobile rule uses `gap: 16px` (base.css:40), and `h1` uses `margin-bottom: 12px` (base.css:14). These values are on the scale, but they do not follow a token change.

   Command: **extract**.

No colors, type sizes, weights, radii, or shadows in shell.css, base.css, or controls.css drift from DESIGN.md or brand/tokens.json:

- Nav label: 15/550.
- Rail label: 12/600.
- h1: 40/800/1.1/-0.035em, and 30px on mobile.
- Eyebrow: 12/700/.06em.
- Button: 15/600/1.4.
- Inputs: 48px high, 16px text.
- Selected shadow: `0 2px 8px`.
- Popover shadow: `0 8px 24px`.
- Top bar: at least 72px high.
- Rail: 72px. Sidebar: 256px.
- Feedback motion: 140ms.

The 23px wordmark is on the config ignore list. `brand/tokens-css.ts` builds every color, space, radius, and `--nav-target` variable from tokens.json.

## False positives

- **kicker-above-heading (today):** DESIGN.md "Screens > Today" says: "Show the date in the eyebrow above the title". PageHeader (components/ui/PageHeader.tsx:3) renders it on purpose. `.impeccable/config.json` ignores this rule for `apps/web/src/**`. The CDP scan reports a URL, not a file, so the ignore did not apply.
- **nested-cards (calendar, tasks):** `.view-tabs` (controls.css:50) is the segmented-control track. It has a canvas fill, a 1px `line` border, a 12px radius, and 4px padding. DESIGN.md "Filters and badges" requires view tabs and owner filters as segmented controls with a raised pressed segment. It is a control, not a card. It has no card padding or card radius.

## Visible defects from screenshots

| Screen | Width | Mode | Defect | Cause |
|---|---|---|---|---|
| today, calendar, tasks, settings | 1024 | light | Orphan "Jr" on the second line of the top-bar label | shell.css:18 (finding 1) |
| today, calendar, tasks, settings | 768 | light | Name breaks at its hyphen in the top bar | shell.css:18 (finding 1) |
| all five | 390 | light + dark | Bordered account box beside a borderless menu icon | AppShell.tsx:45, shell.css:24 (finding 2) |

**Checked and clean:**

- No horizontal scroll and no clipped frame elements at any width.
- Every frame control is 48px or larger: the collapse toggle, the menu button, the account link, the rail links (64x48), and the sidebar links.
- The rail unread badge (768px) and the menu-button badge (390px) sit clear of the icon.
- The sticky top bar at 390px truncates each name to one line, as DESIGN.md asks.
- Dark mode uses the dark icon tile (`icon-web-dark.webp`), and the top bar, sidebar, and canvas surfaces are distinct.
- The selected nav item is readable in both modes.
- The sidebar ending at 900px in the long full-page shots is a capture effect. `.sidebar` is `position: fixed` (shell.css:2).

**Out of frame scope (for the screen reviewers):**

- At 390px on Calendar, the owner-filter segments wrap the long names to three centered lines. The "Everyone" segment grows to about 100px high. Cause: calendar.css:69 (2-column grid) with controls.css:55.
- At 1024px on Tasks, the Assigned-to select and the date input clip their values ("Unassigne", "mm/dd/y"). Cause: the planning.css row layout.

## Skipped steps

- **Browser overlay:** skipped. No local backend and no live page exist in this container, and the overrides forbid starting servers.
- **Navigation drawer open, collapsed sidebar at 1024px and up, Dialog, and Status:** no capture shows these states. Only the CSS was reviewed:
  - The drawer has `width: min(320px, 90vw)` and `height: 100dvh`.
  - Dialog and Status match DESIGN.md (canvas fill and `line` border for neutral status; danger pair for error).
  - Nothing visual can be verified for these states.
- **CSS-only files:** the source scanner takes markup only. I compared shell.css, base.css, controls.css, tokens.css, and main.tsx by hand.
