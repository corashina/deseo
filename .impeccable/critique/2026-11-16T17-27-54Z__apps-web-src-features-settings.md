---
target: Settings
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/deseo/apps/web/src/features/settings"
timestamp: 2026-11-16T17-27-54Z
slug: apps-web-src-features-settings
---
Method: dual-agent (A: A-settings · B: B-settings)

# Critique: Settings (baseline, 2026-11-16)

Evidence: design-capture run 43916736848 (master 0eb7250 plus dark captures), 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 26/40 (Acceptable).** P0: 0 · P1: 2 · P2: 4 · P3: 5.

The detector found 0 issues in source and on the rendered page. Assessment A found the real problems in the flow and the hierarchy. Assessment B confirmed the layout faults with measurements (a 200px edge offset at 1440, uneven gaps in Your pair) and found token drift in shared controls. The page has no notifications or delete-account section. PRODUCT.md says this is intentional.

| Sev | Finding | Where | Command | Source |
|---|---|---|---|---|
| P1 | End pair sends an email code before the user sees what ending means; the dialog never names the partner and has no Cancel | SettingsPage.tsx EndPairSection, Dialog.tsx | clarify | A |
| P1 | The destructive zone is not apart from normal edits; End pair shares the card and divider with Account | SettingsPage.tsx, settings.css | layout | A |
| P2 | Two primary buttons: "Sign out on this browser" is as loud as "Save profile" | SettingsPage.tsx AccountSection | quieter | A |
| P2 | Card and page header do not share a left edge at 1440 (x 288 vs 488) | base.css `.form-page` | layout | A+B |
| P2 | Timezone copy is jargon ("dates and instants"); the field shows the raw IANA value and needs clearing to search | SettingsPage.tsx, TimezoneField.tsx | clarify | A |
| P2 | Uneven spacing in Your pair (35px above, 58px below) and two intro text styles | settings.css, SettingsPage.tsx | layout | B |
| P3 | Pending pair sees "You have no active pair." | SettingsPage.tsx | clarify | A |
| P3 | Member name has no type token; 80px avatar and 32px letter have no token | base.css `.paired-members` | typeset | B |
| P3 | Names wrap to 4 lines in two 150px columns at 390 | base.css `.paired-members` | adapt | B |
| P3 | Literal radii and off-scale gaps in controls; danger text color drift in dark | controls.css | polish | B |
| P3 | Dialog "Close" is a full bordered button in the heading | Dialog.tsx | polish | A |

**Bolder moves (owner decides):** make the pair one object (one shared-soft card, overlapping avatars; colorize); a live local-time line under the timezone field (delight).

**To check live:** a gray fill on "Sign out on all devices" in the 390 dark shot only; probably a capture hover state.

## Assessment A: design review


Evidence: `features/settings/pages/SettingsPage.tsx`, `components/ui/{TimezoneField,Dialog,Button,Field}.tsx`, `styles/settings.css`, `styles/controls.css`, `styles/base.css` (.form-page, .paired-members), and all six captures. There is no capture of the End pair dialog, so I judged it from code.

**Scope note:** the page has no notifications section and no delete account control. PRODUCT.md says both are intentional: the browser gets no push, and account deletion is "separate delivery scope". The high-stakes review therefore covers End pair and the two sign-out actions.

## Design specificity verdict
Mostly category-interchangeable. Take out the "Your pair" block and this is any SaaS settings card: a heading, hairline-divided sections and stock buttons. Only one element belongs to Deseo: the two 80px rose and teal avatars with names and "You" / "Your partner". Even that block reads as two loose circles, not as a pair. The End pair moment, the most emotional action in the product, uses generic system wording and never names the partner.

## Heuristic scores
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | "Profile saved." and "Sending code…" work. The code email gives no destination address, and `retryAt` is ignored. |
| 2 | Match real world | 2 | "dates and instants", raw IANA value `Europe/Warsaw`. A pending pair sees "You have no active pair." |
| 3 | User control | 3 | Conflict discard is good. But clicking "End pair" sends an email before the user sees any explanation. The dialog has no Cancel in its footer. |
| 4 | Consistency | 2 | Two primary buttons ("Save profile", "Sign out on this browser") against the one-primary rule. The dialog's bordered "Close" sits in the heading, not as Cancel. |
| 5 | Error prevention | 3 | The code gate and 6-digit check are solid. Timezone is free text. End pair sits one hairline below sign-out. |
| 6 | Recognition | 3 | The timezone datalist only filters after the user clears the current value. No local-time preview. |
| 7 | Flexibility | 2 | `one-time-code` autofill and the two sign-out scopes are good. Little else. |
| 8 | Aesthetic / minimalist | 3 | Clean, but all four sections have equal weight. The read-only avatars are the heaviest element. |
| 9 | Error recovery | 3 | The invalid-code copy names the fix, "Retry ending pair" reuses the command ID, and the draft survives a conflict. Other errors pass `toAppError().message` through. |
| 10 | Help | 2 | Inline hints exist. Nothing says what happens to the user's own private events or authored memories after End pair. |
| **Total** | | **26/40** | **Acceptable (65%)** |

## Cognitive load
- **Fail, visual hierarchy:** "Sign out on this browser" (primary) is as loud as "Save profile". The red "End pair" is the third loud fill. Nothing tells the eye that Profile is the main job.
- **Fail, grouping:** End this pair shares the same card and the same 1px `--line` divider as Account. DESIGN.md says "Keep destructive actions apart from normal edits."
- Pass on single focus, chunking (4 sections), one thing at a time, working memory and progressive disclosure.
- Result: 2 failures, moderate load.
- No decision point shows more than 4 options. The timezone datalist has about 420 entries, but it is a search, not a visible choice.

## Emotional journey
- **Peak:** the pair block. Both names wrap well, even at 390px with 4-line names, and the owner colors carry the relationship.
- **Valley:** End pair. One tap sends an email. The dialog says "End this pair?" and "Both people lose shared access. This cannot be undone." It never says "Marek", never says whether Marek is told, and never says what the user keeps.
- The page copy "Your next pair starts empty" looks forward to a new pair at the exact moment someone ends one. That reads cold.
- **Reassurance:** "This cannot be undone" is honest, and the sign-out copy ("clears private content… from this browser") reassures well. High-stakes reassurance is honest but thin.

## What's working
1. The End pair mechanics are robust:
   - fresh verification;
   - `inputMode="numeric"` and `autoComplete="one-time-code"`;
   - local 6-digit validation with a fix-naming error;
   - a kept `commandId` so retries replay;
   - the dialog's Escape is blocked while busy, and its first focus lands on the safe "Close".
2. The profile conflict path ("Your profile changed. Your draft is kept." plus "Discard changes and reload") follows Product Principle 4 exactly.
3. Long names wrap without overflow at every width, and the 2-column pair grid holds at 390px.

## Priority issues
1. **[P1] End pair sends an email before the user sees the consequences**
   - **Where:** `SettingsPage.tsx`, the EndPairSection button `onClick → send.mutate()`, all widths.
   - **Why it matters:**
     - An exploratory tap triggers a rate-limited email.
     - The real explanation only appears after the side effect.
     - The dialog does not name the partner, the email address, or what the user keeps.
     - Its footer pairs "Confirm ending pair" with "Send a new code", so there is no Cancel where users expect one.
   - **Fix:**
     - Make "End pair" open the dialog first.
     - Dialog step 1: "End your pair with {partner name}?", then 2 or 3 short lines on what both people lose, then a "Send code" button and a "Cancel" button.
     - Step 2: "We sent a code to {masked email}", the code field, danger "End pair", secondary "Cancel", and "Send a new code" as a text link under the field that shows `retryAt`.
     - Update the docs/README.md Settings rule ("End pair sends a fresh email code and opens one dialog") in the same change.
   - **Command:** clarify (then harden).
2. **[P1] The destructive zone is not apart from normal edits**
   - **Where:** `SettingsPage.tsx` and `settings.css`. Seen at 1440, 1024, 768 and 390: End this pair follows Account with the same divider, about 24px below "Sign out on all devices".
   - **Why it matters:** this breaks DESIGN.md's Settings rule. At 390 the red button is the last thing in a continuous scroll of ordinary actions.
   - **Fix:**
     - Render End this pair as its own card after the main card, with a 32px gap.
     - Use the existing `danger` token for the section title or for a `danger-soft` status line. No new tokens.
   - **Command:** layout.
3. **[P2] Two primary buttons, and sign-out outranks the profile**
   - **Where:** `AccountSection`, where `<Button>` defaults to `variant='primary'`. Visible at all widths. In dark mode it becomes a bright lilac fill.
   - **Why it matters:** this breaks "one primary button per page", and sign-out becomes the page's loudest call to action.
   - **Fix:** make both sign-out buttons `variant="secondary"`.
   - **Command:** quieter.
4. **[P2] Card and header use two left edges at wide widths**
   - **Where:** `.form-page { margin: 24px auto }` (base.css). At 1440 the header starts at x≈288 and the card at x≈488. At 1024 they align.
   - **Why it matters:** the card floats like a modal, the page loses its axis, and about 200px of dead canvas opens on the left.
   - **Fix:** left-align the form in `.settings-page` (`margin-inline: 0`) so the title, description and card share one edge.
   - **Command:** layout.
5. **[P2] Timezone copy and control speak system language**
   - **Where:** the `ProfileSection` description and `TimezoneField.tsx`, all widths.
   - **Why it matters:**
     - "Stored events keep their dates and instants" is jargon.
     - The field shows `Europe/Warsaw`, while the datalist labels read "Warsaw / Europe".
     - To search, the user must first clear the value.
     - Free text accepts invalid zones.
   - **Fix:**
     - Copy: "Your timezone sets how times show. Saved events do not move."
     - Show the current local time under the field ("Now 14:32 in Warsaw").
     - Select the whole value on focus so typing replaces it.
     - Validate against `Intl.supportedValuesOf` beside the field.
   - **Command:** clarify.

## Persona red flags
- **Jordan (first-timer):**
  - Taps "End pair" to read what happens and gets an email instead.
  - "instants" and "Europe/Warsaw" mean nothing to Jordan.
  - In the dialog, "Send a new code" sits where Cancel should be. The only exit is a bordered "Close" at the top.
- **Casey (mobile):**
  - Leaves to read the email code. If the mobile browser reloads the tab, the dialog and `send.isSuccess` reset, so "End pair" sends a second code into the rate limit.
  - No `retryAt` text explains the wait.
  - The header at 390 is about 108px tall because both full names wrap to 3 lines.
- **Riley (stress tester):**
  - A pending pair (Settings is an `account` route, so it is reachable) shows "You have no active pair." and "Set up your pair", which redirects to /pair/waiting.
  - "Save profile" with no change still saves and says "Profile saved."
  - Free-text timezone input is caught only by the server.
- **The partner who is leaving (from PRODUCT.md: "Each partner… can end shared access without the other partner's approval"):**
  - This person needs to know whether Marek is told, what they keep (their private events and authored memories), and that they do not need Marek's approval.
  - The dialog answers none of these. It also never uses Marek's name, so the act feels abstract and unsure.

## Minor observations
- `SettingsPage.tsx`: the pending-pair copy and link are wrong for `pair.status === 'pending'`. Use "Your partner has not joined yet." with a link to check pair status.
- `SettingsPage.tsx`: "Pair timezone" shows only when it differs, which is correct. It is plain text with no label styling, so it reads as an orphan.
- `settings.css` / `base.css`: the pair block has about 60px of space between "You" and the next divider at 1440. That is much more than other section gaps, so the rhythm breaks.
- `Dialog.tsx`: "Close" is a full bordered secondary button in the heading. That is a fourth button-weight control in a destructive dialog.
- `SettingsPage.tsx`: the success path for ending a pair has no confirmation of its own. It relies on the redirect to /pair/ended. Check that the notice names what happened.
- `controls.css`: the dark danger button (`#F2939F` fill, dark text) reads soft pink, much less alarming than the light-mode red. This is acceptable, but confirm it is intended.
- `settings-390-dark.png`: "Sign out on all devices" shows a grey fill that the light capture does not. It is probably a hover or pointer artifact of the capture. Verify on a device.

## Bolder move proposals
1. **colorize: make the pair one object.**
   - Put both members in a single `shared-soft` card.
   - Overlap the avatars, echoing the header's "A M" pair and the Two voices icon.
   - Keep the names in their owner foreground colors with "You" / "Your partner".
   - **Reason:** this is the only Deseo-specific moment on the page. Today it is two unrelated 80px circles.
   - **Touches:** the Your pair section, all widths.
2. **delight (restrained): a live clock in the timezone field.**
   - Show "Now 14:32 in Warsaw" under the field, and the pair timezone's local time when it differs.
   - **Reason:** it turns an abstract setting into something the user can check, and it fixes the jargon at the same time.
   - **Touches:** the Profile section.

## Questions to consider
1. Should the most irreversible action in the product ever be one tap away from a side effect the user did not choose?
2. Settings is the only screen where the pair appears as a pair. Should "Your pair" lead the page instead of sitting second, under a name field?
3. When public launch needs account deletion, will it share End pair's verification dialog and danger card, or will a second destructive pattern appear?
## Assessment B: detector and rendered evidence


## Detector counts
- **Source scan:** I ran `impeccable detect --json apps/web/src/features/settings apps/web/src/components/ui/TimezoneField.tsx apps/web/src/components/ui/Dialog.tsx`. It returned `[]` with exit 0, so there are no findings for any rule. The config ignores low-contrast, gray-on-color and skipped-heading on purpose.
- **Rendered scan:** `capture/settings/settings.detect.json` is `[]`, so there are no findings at 1440px light.

## Verified findings
There are no detector findings to verify. These are the code-level findings from the CSS compared with the tokens:

1. **The paired-member name has no type token. P3, typeset.** In `apps/web/src/styles/base.css:41`, `.paired-members h3` sets only `margin-bottom: 4px`. The name falls back to the browser h3 size (about 18.7px bold). That size is not on the type scale. The `title` token is 19px/700/1.3/-0.015em, and `memories.css:19` and `planning.css:35` already use it for h3.
2. **The large avatar and its letter have no token. P3, extract.** `base.css:40` sets `.paired-members .avatar` to 80px with a 32px letter. DESIGN.md defines `avatar` only at 32px, and the type scale has no 32px size. Add an avatar size token to both files, or use existing values.
3. **Dialog radius is a literal. P3, polish.** `controls.css:28` has `dialog { border-radius: 20px }`. It should use `var(--radius-card)`. The value is the same, but the literal bypasses the token.
4. **More values off the tokens. P3, polish.** All are in `controls.css`:
   - `.status` uses `border-radius: 12px` where `var(--radius-control)` exists (line 22).
   - `.button` uses `gap: 10px`, which is not on the spacing scale (line 1).
   - `.view-tabs button` uses `padding: 10px 16px` and `8px` on mobile, plus a literal `border-radius: 12px` (lines 32, 35).
5. **Danger button text color differs from DESIGN.md. P3, polish.** DESIGN.md says `button-danger.textColor: {colors.surface}`, but `controls.css:6` uses `var(--on-primary)`. Light mode matches (#FFF). Dark mode uses #1A1526 where DESIGN.md gives #221D2D. Change the CSS or DESIGN.md so they agree.
6. **Section intros use two styles. P2, typeset or polish.** In `SettingsPage.tsx:50` the Profile intro is `p.muted` (14px, muted). The Account and End pair intros (lines 63, 95) are plain 16px ink. The screenshots show three section descriptions in two styles.

## False positives
None. Both scans returned zero findings.

## Visible defects from screenshots
- **Card and page header do not share a left edge (1440 light and dark).** The "Settings" header starts at x≈288. The card starts at x≈488. This is because `.form-page { max-width: var(--form-width) /*720px*/; margin: 24px auto }` (`base.css:31`) centers the card, while `PageHeader` stays left-aligned. At 1024 and below the card fills the column, so the edges match. Severity P2, command `layout`.
- **Uneven spacing in "Your pair" (all widths, light and dark).**
  - Heading to avatars is about 35px. Other sections have about 16–24px from heading to content. The h2 default margin is added to `.settings-page .paired-members { padding: 16px 0 }` (`settings.css:3`).
  - Below "You" / "Your partner" there are about 58px to the next divider. Other sections have about 24px. The cause is the default `p` bottom margin (16px), plus the 16px padding, plus the next `.settings-section` margin-top of 24px.
  - Severity P2, command `layout`.
- **Paired-member names are cramped at 390 (light and dark).** The two-column grid stays at 390. `base.css:56` only lowers the gap to 16px. Each long name wraps to 4 lines ("Marek / Aleksander / Zieliński- / Nowakowski Jr") in a column about 150px wide. The text is not clipped and nothing overlaps. Severity P3, command `adapt`: use one column below about 480px.
- **"Sign out on all devices" has an unexplained fill (390 dark only).** The fill samples as #3D3947. That value is not in tokens.json. The same button at 1440 dark samples as #231E2E, which matches surface #221D2D, and it is white at 390 light. It is probably hover or tap state left by the capture: `.button.secondary:hover` in `controls.css:7` has no `@media (hover: hover)` guard. But #3D3947 is not `--sidebar` either, so this needs a live check. If it is real, it is a dark-mode surface defect, P3, command `harden`.
- **The name input cuts the name at 390.** It shows "…z Gd". This is normal behavior for a single-line input, not a defect.
- **The top bar at 390 and 768 is outside this area.** The pair names wrap to 3 lines at 390 and to 2 lines at 768. That is shell CSS, not settings, so I only note it.
- **Checked and found nothing:**
  - no horizontal scroll at any width;
  - no clipped or overlapping text in the settings card;
  - all buttons and inputs are 48px high, matching `--nav-target` / `.field input min-height: 48px`;
  - dark surfaces are correct: card #221D2D (surface-dark) and soft avatar fills use rose-soft-dark and teal-soft-dark;
  - no light-only assets.

## Skipped steps
- **Browser overlay.** There is no live page in this container: the local backend cannot run, and the overrides forbid starting servers.
- **End-pair Dialog and TimezoneField datalist.** I did not check them visually. The captures show only the resting page, and opening the Dialog requires a verification-code request to the live backend. I reviewed their code only: the Dialog uses `min(480px, calc(100vw - 32px))`, its Close button is 48px, and nothing looks wrong.
- **Pair-ended / no-pair state and Status messages.** I did not check them visually because the stress data has an active pair and no captures exist for those states.

Files: `/home/user/deseo/apps/web/src/features/settings/pages/SettingsPage.tsx`, `/home/user/deseo/apps/web/src/styles/settings.css`, `/home/user/deseo/apps/web/src/styles/base.css`, `/home/user/deseo/apps/web/src/styles/controls.css`, `/home/user/deseo/apps/web/src/components/ui/Dialog.tsx`, `/home/user/deseo/apps/web/src/components/ui/TimezoneField.tsx`. Screenshots are in `/tmp/claude-0/-home-user/a1136e82-3529-5ad9-805a-aba66d8eeeb4/scratchpad/baseline/capture/settings/`.
