---
target: Shell
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/user/deseo/apps/web/src/app/AppShell.tsx"
target_fingerprint: "sha256:58c3b834f6666381862042c0ad105326d1fdf9a660c76b5eaadb5472b82d71d0"
target_path: /home/user/deseo/apps/web/src/app/AppShell.tsx
timestamp: 2026-11-16T17-30-50Z
slug: apps-web-src-app-appshell-tsx
---
Method: dual-agent (A: A-shell · B: B-shell)

# Critique: Shell (baseline, 2026-11-16)

Evidence: design-capture run 43916736848 (master 0eb7250 plus dark captures), 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 26/40 (Acceptable).** P0: 0 · P1: 1 · P2: 5 · P3: 7.

The desktop frame is calm and follows DESIGN.md breakpoints, widths, and 48px targets. But the frame is a recolored admin template: the pair, the product's core idea, is the quietest thing on screen. The phone frame is the weak point. The detector found 0 issues in source and 2 on rendered pages; both are false positives (`kicker-above-heading` is the date eyebrow that DESIGN.md asks for; `nested-cards` is the Month/Agenda segmented control). Assessment B found a CSS cascade bug that explains the filled collapse toggle Assessment A saw.

| Sev | Finding | Where | Command | Source |
|---|---|---|---|---|
| P1 | On phones the top bar is not sticky, so the menu scrolls away on long screens such as Today | shell.css `.topbar` | adapt | A |
| P2 | Phone top bar overload: own avatar shows twice (pair cluster and account button); names wrap to 4 lines, bar about 108px tall | AppShell.tsx, shell.css `.topbar-label`, `.mobile-account` | distill | A+B |
| P2 | Unread count is only inside the drawer on phones | PortalNavigation.tsx, AppShell.tsx | clarify | A |
| P2 | The 768px rail is icon-only; touch never shows `title` tooltips; brand icon 4px off the icon column | shell.css rail rules | clarify | A+B |
| P2 | Cascade bug: `.button.secondary` beats the shell overrides, so the collapse toggle is a filled tile and the menu button has a control border; Button has no Text variant though DESIGN.md lists one | main.tsx import order, shell.css, controls.css, Button.tsx | polish | A+B |
| P2 | Button defaults to primary, so 31 call sites can show extra primary buttons | Button.tsx | polish | audit |
| P3 | Status: neutral fill reuses shared-soft (One Meaning Rule); error has no icon; no success or warning variant; no in-button busy state | Status.tsx, Button.tsx, controls.css | harden | A |
| P3 | Loading fallback replaces the page header too, so the layout jumps | router.tsx | harden | A |
| P3 | Dark mode: brand icon is a near-white tile; `sidebar-dark` is almost the same as `canvas-dark` | brand/icon-web.webp, tokens.json | colorize | A+B |
| P3 | Token drift: brand 23px, gaps 10px, sidebar padding 11px, eyebrow margin 6px, badge weight, topbar label 14/600, literal radii; `--space-*` never used | shell.css, controls.css, base.css, main.tsx | extract | A+B |
| P3 | Danger text color: CSS and DESIGN.md disagree in dark mode | controls.css, DESIGN.md | polish | B |
| P3 | Dead rules (`.topbar > button`, toggle hide then show); a stale collapse toggle can show in the rail after a resize | shell.css, AppShell.tsx | distill | B |
| P3 | h1 moves 23px between tabs because only Today has an eyebrow; drawer title "Navigation" | PageHeader.tsx, shell.css | polish | A |

**Bolder moves (owner decides):** a pair band in the top bar, each name next to its avatar in its owner color joined by a shared "+" (bolder plus colorize); a plum-tinted dark sidebar so the rail keeps its color in dark mode (colorize, a token change).

**Capture effects, not defects:** faded buttons in the 390 dark shots. The drawer and the collapsed sidebar were not captured; they were reviewed from CSS.

## Assessment A: design review


## Design specificity verdict
Mostly generic for the category. A pale lavender left sidebar, a white 72px top bar, Phosphor icons, and a selected item with a fill and shadow match a recoloured SaaS admin template. Two shell details belong to Deseo only: the overlapping rose and teal pair avatars, and the "Anna + Marek" label. But the label is 14px ink text in an otherwise empty 72px band, and the names carry no owner colour. The colours do real work (tinted rail, pastel selection, owner avatars), but the shell has no signature move. The pair identity, the product's core idea, is the quietest thing on screen.

## Heuristic scores
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Clear active nav and document titles. On phones the unread count hides in the drawer. The `Loading page…` fallback replaces the whole page. |
| 2 | Match with real world | 3 | Plain glossary terms. The drawer title "Navigation" is generic. |
| 3 | User control and freedom | 3 | Esc and Close on the drawer, Back works, unsaved-changes guard at the root. The collapse state resets on every reload. |
| 4 | Consistency and standards | 2 | Cascade order breaks the toggle styles. Same "Add event" is secondary on Today and primary on Calendar. Eyebrow on Today only. The lilac status fill reuses the shared-content colour. |
| 5 | Error prevention | 3 | Root UnsavedChangesGuard. Destructive actions are kept apart. |
| 6 | Recognition rather than recall | 2 | The 768px rail is icon-only and relies on `title` tooltips. On phones the menu scrolls away. |
| 7 | Flexibility and efficiency | 2 | Collapse toggle and skip link only. No persisted preference. |
| 8 | Aesthetic and minimalist | 3 | Clean on desktop. The phone top bar is crowded: 3 avatars and a 4-line name block. |
| 9 | Error recovery | 3 | Frame error offers Retry and Sign out. Status errors have no icon, against DESIGN.md. |
| 10 | Help and documentation | 2 | Page-header descriptions are the only in-context help. |
| **Total** | | **26/40** | **Acceptable** |

## Cognitive load
- **Fail (visual hierarchy, 390px):** the top bar's 4-line name block (`Anna Maria Kowalska-Wiśniewska z Gdańska + Marek…`) competes with the h1 and pushes it down to y≈150.
- **Fail (working memory, 768px):** the icon-only rail makes users remember 5 glyphs. Avatars show initials only, so partners with the same initial get two "A" circles.
- Result: 2 failures, moderate load.
- **Decision points:** navigation has 5 items (4 plus Settings, split by a divider). That is at the limit, and grouped well enough. No other shell decision point has more than 4 options.

## Emotional journey
- **Peak:** desktop first view. The lavender rail, the overlapping rose and teal circles and the joined names feel private and calm.
- **Valley:** the phone.
  - The header takes 108px with the names wrapped over 4 lines.
  - The partner sees three circles, two of them "A". The rightmost one sits in a bordered button and reads like a third person.
  - On a long Today conversation the hamburger scrolls away with the page.
- **Dark-mode valley:** the brand icon is a white tile, the brightest object on the near-black sidebar.
- **Reassurance at high-stakes moments:** good at the frame level (Retry plus Sign out when the account fails, unsaved-changes guard). Weak at component level: Status has no icon, no success variant, and the Button component has no in-button busy state.

## What's working
1. **Breakpoints follow DESIGN.md exactly.** The 256px sidebar, 72px rail and drawer swap at 1024 and 768 (`shell.css:33-50`). Long names wrap without overflow at every width, and the 48px targets hold.
2. **Navigation states are clear.** The pastel `action` fill plus `shadow-selected` reads instantly in both palettes. Settings is split off by a divider. Calendar stays active for `/events` and `/ideas` (`PortalNavigation.tsx:13`).
3. **The page header is a solid shared part.** It has an h1 on the type scale, an optional eyebrow, and an action that drops below the heading under 768px (`base.css:26-33`), as DESIGN.md requires.

## Priority issues
1. **[P1] The phone navigation scrolls away**
   - **Where:** `shell.css:14,42-50`. Today, Calendar and Settings at 390px.
   - **Why:** `.topbar` is not sticky. I grepped all CSS, and only `.sidebar` and `.skip-link` are positioned, so this is a real defect, not a capture effect. Today is chat-first and long. To change screens, the partner must scroll back to the top.
   - **Fix:** below 768px, set `position: sticky; top: 0; z-index` on `.topbar`. Keep it one row (see issue 2).
   - **Command:** adapt.
2. **[P1] Phone top bar overload and duplicate avatar**
   - **Where:** `AppShell.tsx:27`, `shell.css:30,45`. All 390px shots. On pair-start 390 it shows "A Anna [A]".
   - **Why:** the `.mobile-account` link repeats the viewer's avatar beside the pair cluster. The label wraps to 4 lines and makes the bar 108px tall.
   - **Fix:** under 768px, remove `.mobile-account`. Make `.topbar-pair` itself the Settings link, which still meets "account avatar opens Settings". Clamp `.topbar-label` to 2 lines, or hide it, since the h1 gives the context.
   - **Command:** distill.
3. **[P2] The unread count is invisible on phones**
   - **Where:** `PortalNavigation.tsx:22`, `AppShell.tsx:27`. 390px on any screen other than Today.
   - **Why:** the count renders only inside the drawer. A partner on Calendar gets no sign of a new message. DESIGN.md says to show the unread count on Today.
   - **Fix:** when `unread > 0`, put the same `.unread-count` badge on `.drawer-toggle`.
   - **Command:** clarify.
4. **[P2] The 768px rail is icon-only**
   - **Where:** `shell.css:35-38`. calendar-768, tasks-768, settings-768.
   - **Why:** 768px is a tablet width, and touch never shows `title` tooltips. The unread "9" floats loose at the rail edge.
   - **Fix:** stack a 12px label (badge typography token) under each 20px icon. "Memories" fits in the 72px rail. Anchor the badge to the icon.
   - **Command:** clarify.
5. **[P2] Button has no Text variant, so the shell's overrides lose the cascade**
   - **Where:** `Button.tsx`, `main.tsx:11-12`, `shell.css:6,47`, `controls.css:4`.
   - **Why:** `controls.css` loads after `shell.css`, and `.button.secondary` (0,2,0) beats `.brand .collapse-toggle` and `.topbar .drawer-toggle`.
     - The collapse toggle meant to be transparent renders as a borderless white tile (1440 and 1024 light) or a dark tile (dark).
     - The drawer toggle gets a `control` border instead of `line`.
   - **Fix:** add the `text` variant that DESIGN.md already lists (Primary, Secondary, Text, Destructive). Use it for the collapse toggle, and delete the local overrides.
   - **Command:** polish.

## Persona red flags
- **Casey (mobile):** the menu and Settings sit only at the top and scroll away. The unread signal is hidden behind the hamburger. The header eats 108px of a 390px-wide screen. In the no-pair state the drawer holds 2 items, and one of them repeats the avatar button.
- **Jordan (first-timer):** the 768px rail has no labels and its tooltips never show on touch. The bordered "A" button on the right is ambiguous: is it me, or someone else?
- **Riley (stress tester):**
  - `name.trim().slice(0, 1)` (`Avatar.tsx:2`) splits emoji and surrogate pairs into a broken glyph.
  - Equal initials give two identical circles, told apart only by colour.
  - Collapse resets on reload and on every `AppShell` remount (it is keyed by pair identity).
- **Partner checking plans on a phone (PRODUCT.md users):** while on Calendar the partner cannot see that the other partner wrote. The only route to Today is scroll up, open the hamburger, then tap.

## Minor observations
- **Status colour and variants** (`Status.tsx`, `controls.css:81-83`)
  - Neutral status uses `shared-soft`, which already means shared content (One Meaning Rule).
  - Error has no icon, which DESIGN.md requires.
  - There is no success or warning variant, though the tokens exist.
- **Loading fallback** (`router.tsx:101`): `<Status>Loading page…</Status>` replaces the page header too, so the layout collapses and then jumps.
- **No busy state** (`Button.tsx`): there is no `busy` prop, but DESIGN.md asks for loading inside the button with no width change.
- **Dead CSS** (`shell.css:19-20`): the `.topbar > button` rules with span ellipsis match nothing. They are left over from a removed control.
- **Off-scale values** (`shell.css:3-4`, `controls.css:1`, `base.css:18`): brand 23px, gap 10px, sidebar padding 11px, eyebrow margin 6px.
- **Dark-mode brand icon** (`shell.css:5`): the white `icon-web.webp` tile glares on `sidebar-dark`.
- **h1 position shifts** (`PageHeader.tsx`): only Today has an eyebrow, so the h1 moves 23px when you switch tabs.
- **Settings header misaligned** (`base.css:22`): at 1440px the header starts at x=288 and the centred 720px form card at x=488.
- **Drawer** (`shell.css:29`): titled "Navigation", with no brand or pair identity. It appears with no 200ms panel motion.
- **Danger hover** (`controls.css:7`): hover flips to a soft fill with red text, which reads as a state change, not a hover.
- **Capture artifact, not a defect** (`controls.css:1`): the 390-dark shots show washed-out buttons (sampled #595662 instead of #221D2D). The 140ms background transition was caught mid-change of the colour scheme.

## Bolder move proposals
1. **Pair band (bolder plus colorize).**
   - **Move:** put each name next to its own avatar, in its owner colour (`rose` and `teal`), joined by a `shared` "+".
   - **Where:** the top bar on every screen.
   - **Reason:** this applies the Name Beside Color Rule to the one element present on every screen. The shell would then say "two people" instead of showing a grey caption.
2. **Plum sidebar in dark (colorize).**
   - **Move:** tint `sidebar-dark` toward the Midnight plum.
   - **Reason:** `sidebar-dark` (#1C1825) is nearly the same as `canvas-dark` (#14111B). The rail loses the committed shell colour that light mode has.
   - **Cost:** a token change in `brand/tokens.json` and DESIGN.md.
   - **Where:** all dark screens.

## Questions to consider
- At 1024px and wider, the top bar only repeats names that Settings already shows. Does it earn 72px on every screen, or should the pair identity move to the sidebar foot?
- Content is capped at 1440px. Does the collapse toggle earn a control and a cascade fix for 184px?
- Apart from two 32px circles, where does the shell show that this is a space for two people?
## Assessment B: detector and rendered evidence


### Detector counts
**Source scan** (`impeccable detect --json apps/web/src/app apps/web/src/components/ui`): **0 findings**. The command printed `[]` and exited with code 0.

**Rendered scan** (`.detect.json` at 1440px light): **2 findings**.
| Screen | Rule | Selector / snippet |
|---|---|---|
| today | kicker-above-heading | `div > span.eyebrow`: "Monday, November 16" above h1 "Today" (source: `components/ui/PageHeader.tsx:3`, `features/today/pages/TodayPage.tsx:38`) |
| calendar | nested-cards | `div.view-tabs` inside `section.card` (`styles/controls.css:34`) |
| tasks, settings, pair-start | — | `[]` |

### Verified findings (from source and screenshots)
1. **shell.css overrides lose to `.button.secondary` (cascade bug). P3, polish.** `main.tsx` imports `controls.css` after `shell.css`. Both selectors have the same specificity (0,2,0), so `.button.secondary` wins. As a result, two shell rules have no effect:
   - `shell.css:6` `.brand .collapse-toggle { background: transparent }`. The collapse toggle renders as a white `surface` tile (pixel 255,255,255) on the `sidebar` fill. In dark it renders #221D2D on #1C1825. Visible on all 1024 and 1440 shots.
   - `shell.css:47` `.topbar .drawer-toggle { border-color: var(--line) }`. The menu button border renders as `control` #8B8293.
   Fix one way: change the import order, or raise the selector specificity. Then decide which result the design wants.
2. **The rail brand icon is 4px off the nav column. P3, layout.** At 768–1023 the content box is x=12–60, so the nav icons are centered at x=36. The 40px icon sits at x=12–52, so its center is x=32. `shell.css:36` sets `padding-left:0` and nothing centers the icon. Visible in `*-768.png`.
3. **The `--space-*` variables are never used. P3, extract.** `main.tsx` emits `--space-1…10`, but there are 0 `var(--space-` uses in `src`. All spacing in the shell is literal. There are also 11 literal `border-radius: 12px/20px/8px` values instead of `var(--radius-*)`. The values match the tokens; the token link is missing.
4. **Off-token values in the frame. P3, typeset/polish.**
   - `.brand` uses font-size 23px (no type role) and gap 10px (not a spacing token). See `shell.css:4`.
   - `.button` uses gap 10px (`controls.css:1`).
   - `.unread-count` uses padding `2px 8px` and has no weight, so it inherits 550. The badge token says 600 (`shell.css:31`).
   - `.topbar-label` uses 14px/600, which is not a defined role (`shell.css:18`).
5. **Danger button text: CSS and DESIGN.md disagree. P3, polish.** `controls.css:5` uses `var(--on-primary)`. The DESIGN.md frontmatter `button-danger.textColor` is `{colors.surface}`. These are the same in light. In dark they are #1A1526 and #221D2D. Pick one and update the other file.
6. **Dead rules. P3, distill.**
   - `shell.css:19-20` (`.topbar > button` max-width and span ellipsis) match nothing. The only topbar button holds an icon and no span.
   - `shell.css:23` hides `.collapsed .collapse-toggle`, then line 25 shows it again.
7. **A stale collapse toggle can show in the rail. P3, harden. Not in the captures.** `.collapsed .brand .collapse-toggle` (0,3,0) beats the 768–1023 rule that hides `.brand .collapse-toggle` (0,2,0). If someone collapses the sidebar at 1024px or wider and then narrows the window, the rail shows a toggle that does nothing. `collapsed` is React state in `AppShell.tsx:20`, so it survives a resize.

### False positives
- **kicker-above-heading (today):** DESIGN.md says "Show the date in the eyebrow above the title" (§Screens/Today). It also defines the `eyebrow` type role (12/700/.06em), and the CSS matches it. It is a sanctioned pattern, not slop. The owner decides if the rule should change.
- **nested-cards (calendar `.view-tabs`):** this is a segmented control (a 4px tray on `canvas`, with control radius 12, not card radius 20) and not a content card. The same control appears in Tasks and Ideas.

### Visible defects from screenshots
| Screen | Width / theme | Defect | Cause |
|---|---|---|---|
| all signed-in | 1024, 1440, light and dark | Collapse toggle shows as a filled tile, not a bare icon | Finding 1 (`controls.css:4` beats `shell.css:6`) |
| all signed-in | 1440 dark (and 390 dark in the topbar) | The brand icon is a near-white (#FCF8F7) tile. It is the brightest element in the dark sidebar, so it is a light-only asset. `brand/` has no dark variant. | `AppShell.tsx:12` `icon-web.webp`; P3, owner decision |
| all signed-in | 768 | Brand icon 4px left of the nav icon column | Finding 2 |
| today, calendar, tasks, settings | 390 light and dark | Stress names wrap the topbar label to 4 lines, so the topbar grows to about 108px and the label is cramped between two 48px buttons. DESIGN allows names to wrap, so this is P3 (layout/clarify). Possible fix: show only the avatars, or clamp the label at narrow widths. | `.topbar-label { overflow-wrap:anywhere }`, `shell.css:18` |
| all signed-in | 390 | The user's own avatar shows twice in one row: in `topbar-pair` and in the `mobile-account` Settings button. On pair-start it is "A Anna … A". P3, distill. | `AppShell.tsx:26` |
| settings | 1024, 1440 | The PageHeader is left-aligned at the content edge while the 720px card is centered, so the two do not share an edge. The page composes it this way (`SettingsPage.tsx:21-22`), not the frame. For the Settings reviewer. | `.form-page { margin: auto }` |
| today, tasks | 390 dark | Faded "Add event" and "Add task" buttons | Capture effect (140ms transition), not a defect |

No horizontal scroll from the frame at any width. Topbar height (72px or more), page padding (32/24/16), sidebar widths (256, 72-px rail, drawer below 768) and 48px targets all match DESIGN.md. The nav selection matches DESIGN.md (`action` fill, selected shadow, hover `surface`). The Today summary strip is cut off at 768 and 390, but that is screen content, not the frame. It goes to the Today reviewer.

### Skipped steps
- **Browser overlay:** skipped. There is no local backend and no live page in this container, and the overrides forbid starting servers.
- **Navigation drawer (below 768) and collapsed sidebar (72px at 1024px and wider):** neither state is in any capture. I reviewed them from CSS only. `.navigation-drawer` is full height, `min(320px, 90vw)` wide, uses the `sidebar` fill and shows labels. Finding 7 is the only issue found. The drawer cannot open at 768 by design, because the rail replaces it there.
- **Rendered detector:** it ran at 1440 light only, so the 390, 768, 1024 and dark states were judged visually only.

Working crops are in `/tmp/claude-0/-home-user/a1136e82-3529-5ad9-805a-aba66d8eeeb4/scratchpad/bshell/`. I edited no repo files.
