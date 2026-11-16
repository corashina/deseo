---
target: Entry
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/deseo/apps/web/src/features/auth"
timestamp: 2026-11-16T17-29-20Z
slug: apps-web-src-features-auth
---
Method: dual-agent (A: A-entry · B: B-entry)

# Critique: Entry (baseline, 2026-11-16)

Evidence: design-capture run 43916736848 (master 0eb7250 plus dark captures), 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 26/40 (Acceptable).** P0: 0 · P1: 2 · P2: 6 · P3: 7.

Only Welcome looks made for Deseo. From sign-in on, the brand disappears and each screen places its header, button, and title size in a different way. The pairing logic is strong (one-click invitation, the invitation survives sign-in). The detector found 0 issues in source and 1 rendered `straggler` on Welcome, which is real. Assessment B measured the alignment faults that Assessment A saw and found that "Your pair" is not selected in the navigation on Join.

| Sev | Finding | Where | Command | Source |
|---|---|---|---|---|
| P1 | The Join field rejects the invitation link that Waiting's main button copies | features/pair/commands.ts `inviteTokenSchema`, JoinPage.tsx | harden | A |
| P1 | Waiting says "Send this code" but shows no code in the "shown once" state; header outside the card, 200px left of it at 1440 | WaitingPage.tsx, base.css `.form-page` | clarify | A+B |
| P2 | Profile setup has no way out (no Back, no Sign out) | ProfilePage.tsx | harden | A |
| P2 | Brand disappears after Welcome; button width, title size (24 vs 40px), and header placement change on every screen | EmailPage, VerifyPage, ProfilePage, NotFoundPage, base.css | polish | A+B |
| P2 | Pair screens use three alignments at 1440 (full-width grid, centered card, mixed) | StartPage, JoinPage, EndedPage, WaitingPage, base.css `.form-page` | layout | B |
| P2 | Verify: a generic field for a 6-digit code, no help for a missing code, three uneven button rows | VerifyPage.tsx, base.css | clarify | A+B |
| P2 | "Your pair" is not selected in the navigation on /pair/join | PortalNavigation.tsx | harden | B |
| P2 | Welcome has no privacy or terms links, although docs/README.md asks for them | WelcomePage.tsx | clarify | A |
| P3 | Welcome at 768 stays two columns of about 350px; stragglers in Welcome text | base.css breakpoint, `.entry-story p` | adapt | B |
| P3 | Dark mode: the icon keeps a light tile | brand/icon-web.webp | polish | A+B |
| P3 | "Back" link sits 6px right of the content edge; 404 has a 60px gap above its link | base.css `.form-page > a`, NotFoundPage.tsx | polish | A+B |
| P3 | Token drift: entry-story h1 weight and line height, 48px and 32px padding, 24px title, 22px radius, invite-code type | base.css | typeset | B |
| P3 | Start page cards stretch to about 550px each at 1440; heading repeats the button label | StartPage.tsx, `.pair-grid` | layout | A |
| P3 | System words: "Cancel pending pair", "Check pair status", "Keep this tab open and retry" | WaitingPage.tsx, RouteErrorPage.tsx | clarify | A |
| P3 | Ended offers only Start; an invited user must go through Start to reach Join | EndedPage.tsx | clarify | A |

**Bolder moves (owner decides):** a two-voices handoff on Waiting and Join, with the inviter's rose slot filled and an empty teal "Your partner" slot (delight); the Welcome lilac story panel at smaller scale on sign-in, verify, and profile (colorize).

**Capture effects, not defects:** faded buttons in the 390 dark shots.

## Assessment A: design review


I did not edit any files. I did not run the detector.

### Design specificity verdict
**Mostly interchangeable with any other product in this category.** Only the Welcome screen looks made for Deseo: the Two voices icon, the lilac story panel, and "Plan your days together." The remaining screens are a white card with an H1, one field and a plum button. Sign-in, verify, profile setup, join, ended and 404 all look the same.
- From sign-in onward there is no icon and no Deseo name. The handoff to the second person, which is what this product is about, gets no visual weight.
- The invitation code is the one moment that belongs only to Deseo (`.invite-code` on `shared-soft`). On the captured waiting state it is not shown at all.
- "Make space for two" is the one line of real voice after Welcome.

### Heuristic scores
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Buttons show their own states (Sending…, Checking…, the resend countdown). There is no step progress across about 6 screens. Waiting depends on a manual "Check pair status". |
| 2 | Match with the real world | 3 | System words reach the user: "Cancel pending pair", "Check pair status", "was shown once". |
| 3 | User control and freedom | 2 | `ProfilePage` has no way out: no Back and no Sign out. A user who typed the wrong email is stuck at /profile/setup. |
| 4 | Consistency and standards | 2 | The PageHeader sits inside the card on join and ended, but outside it on start and waiting. The button is full width on Welcome and auto width elsewhere. The card H1 is 24px on Welcome and 40px on sign-in. |
| 5 | Error prevention | 2 | The join field rejects the invitation link that the inviter's own primary button copies. |
| 6 | Recognition rather than recall | 3 | Verify shows the email address. Join shows the inviter's name. |
| 7 | Flexibility and efficiency | 3 | The deep link carries the invitation through sign-in. `one-time-code` autofill works. One click creates the pair and its invitation. |
| 8 | Aesthetic and minimalist design | 3 | Clean, but empty. At 1440 the pair-start cards stretch to about 550px each. |
| 9 | Error recognition and recovery | 3 | Messages are specific ("Enter the 12-character invitation code.", "Ask your partner for a new code."). |
| 10 | Help and documentation | 2 | Nothing for "no code arrived" (spam folder, expiry). Welcome has no privacy or terms links, although docs/README.md specifies them. |
| **Total** | | **26/40** | **Acceptable** |

### Cognitive load
- **Failed: working memory.** Waiting asks the inviter to move a code to another app. After a reload or revisit the code is gone ("shown once"), so the user must remember whether it was ever sent.
- **Failed: visual hierarchy on Welcome.** There are two competing headlines: the story H1 at 48px and the card H1 "Welcome to Deseo" at 24px. The trust line "A private space for you and your partner" sits under the button as a muted afterthought.
- **Failed: grouping on Waiting.** Replace, Check status and Cancel sit in one card under a header that says "Send this code", but no code is shown.
- Failures: 3 of 8, so the load is moderate.
- No decision point has more than 4 options. The most is Waiting, with 3 buttons and 1 dialog.

### Emotional journey
- **Peak:** Welcome, and the invited state "Your invitation is ready". Join preview "Join {inviterName}" with "Private events stay private." reassures the user at the right moment.
- **Valley 1:** Sign-in, Verify and Profile. The brand disappears and the screens look like admin login. The step where the user hands over an email address has the least warmth and the least trust signal.
- **Valley 2:** Waiting, in the captured "shown once" state. The title says "Waiting for your partner" and the description says "Send this code", but there is no code. The user is not told whether the screen updates by itself. "Check pair status" suggests it does not.
- **High-stakes moments:** Cancel pending pair is behind a dialog. Ended explains what access is lost. Both are well handled.

### What's working
1. **Two-click invitation.** `createPairWithInvite` creates the pair and its invitation in one action. A failure still lands on Waiting with a way to recover. The inviter needs about 7 screens, the invitee about 6.
2. **The invitation survives sign-in.** In `router.tsx`, `/invite` is captured before the router starts and removed from history. Welcome then changes to "Your invitation is ready", and Join previews the inviter automatically.
3. **Input is kept and Retry labels are honest** ("Retry profile", "Retry joining pair"). The resend countdown is shown inside the button.

### Priority issues
1. **[P1] The join field rejects the shared link.**
   - **Where:** `features/pair/commands.ts` `inviteTokenSchema` and `JoinPage.tsx`, all widths.
   - **Why it matters:** Waiting's primary button is "Copy invitation link", which copies `…/invite?token=XXXX`. If the partner pastes that link into the Invitation code field, they get "Enter the 12-character invitation code." This breaks the fastest path between the two people. docs/README.md says "Accept the full link or its code."
   - **Fix:** In the transform, take the `token` parameter when the value parses as a URL, then normalize it. Add a field hint: "Paste the code or the link."
   - **Command:** harden.
2. **[P1] Waiting header and content contradict each other, and the layout is misaligned.**
   - **Where:** `WaitingPage.tsx`, all widths. At 1440 the header starts at x=288 and the card is centred at x=488.
   - **Why it matters:** "Send this code to your partner" appears above "Your invitation code was shown once." That is confusing at the moment of highest uncertainty.
   - **Fix:** Change the description by state.
     - Code visible: "Send this link to your partner."
     - Code not visible: "Create a new code to invite your partner. The old code stops working."
   - **Fix (layout):** Put the PageHeader inside the `form-page` card, as on Join and Ended. Show the code grouped as `XXXX XXXX XXXX`; the schema already strips spaces.
   - **Command:** clarify.
3. **[P2] Profile setup has no way out.**
   - **Where:** `ProfilePage.tsx`, rendered in `entry-container`, so there is no shell and no Settings.
   - **Why it matters:** A user with the wrong account or wrong email has to clear site data to escape.
   - **Fix:** Add a secondary "Sign out" text link under Save profile.
   - **Command:** harden.
4. **[P2] The brand disappears and the entry screens are inconsistent.**
   - **Where:** `EmailPage`, `VerifyPage`, `ProfilePage`, `NotFoundPage`, and `.form-page` in `base.css`, all widths.
   - **Why it matters:** Welcome sets a tone that the next three screens drop. Button width, H1 size and header placement change on every screen.
   - **Fix:**
     - Put the 48px icon and the "Deseo" wordmark above every entry card.
     - Use the Welcome card treatment on all entry forms: `entry-card` padding, 24–30px title, full-width primary button.
     - Use one rule for where the PageHeader goes.
   - **Command:** polish.
5. **[P2] Verify gives a generic field for a 6-digit code and no help.**
   - **Where:** `VerifyPage.tsx`, all widths.
   - **Fix:**
     - Narrow the input to about 200px, centred or left, at 24px with tabular numbers and letter spacing. Keep it a standard input.
     - Add the hint "The code expires in 10 minutes. Check your spam folder."
     - Make Resend a text button, so "Sign in" is the only filled control.
   - **Command:** clarify.

### Persona red flags
- **Jordan (first-timer):**
  - There is no step indicator, so Jordan cannot tell how many screens remain before reaching the partner.
  - "Cancel pending pair" and "Check pair status" are system language.
  - Welcome has no privacy or terms link, so "private space" is a claim without support.
- **Casey (mobile, interrupted):**
  - Casey copies the link, switches to a messaging app and comes back. Waiting no longer shows the code after a reload, and nothing says the page updates by itself.
  - At 390 the top bar shows Anna's avatar twice: the pair avatar and the account button.
- **Riley (stress tester):**
  - Riley pastes the copied link into Join and gets an error.
  - The 404 page shows a large empty gap between the description and "Return to Deseo" (32px header margin + 16px margin + 48px target).
- **Invited partner (from PRODUCT.md Users):** they arrive by a link from the other person, usually on a phone.
  - The welcome card is good.
  - On Sign-in and Verify they see no inviter name and no Deseo brand, so they have no confirmation they are still in their partner's flow until Join.
  - Showing "Joining Anna" on those screens would carry the trust forward.

### Minor observations
- `base.css` `.form-page > a`: "Back" is centred inside a 48px-wide inline-flex box, so it looks indented about 6px from the field edge (sign-in, join).
- `StartPage.tsx`: the heading "Invite your partner" repeats as the button label. The description repeats both card texts.
- `StartPage.tsx` / `.pair-grid`: there is no width cap. At 1440 the cards are wide and mostly empty, and they do not line up with the 720px cards on Join and Ended.
- `WelcomePage.tsx` `.welcome-icon`: in dark mode the icon tile is a bright light square on `#14111B` (1440-dark and 390-dark).
- `EndedPage.tsx`: there is only one action. Users who arrived with an invitation must go through Start to reach Join.
- `RouteErrorPage.tsx`: "Keep this tab open and retry." is an odd instruction. Use "We could not load this page. Retry."
- **Capture effect, not a defect.** In all 390-dark shots the primary buttons look faded, for example fill (164,143,216) against the token (187,164,247). This matches the `.button` colour transition caught partway through the appearance switch. The 1440-dark shots are correct.

### Bolder move proposals
1. **Two voices handoff (delight).** On Waiting and on the Join preview, show the two avatar slots side by side. The inviter's slot is filled in rose with a name; the partner's slot is an empty teal circle labelled "Your partner". On Join, the empty slot shows the invitee. This uses the existing `.paired-members` and slot tokens, and makes "pair" visible before the first shared event. It touches pair-waiting and pair-join.
2. **Brand frame for entry (colorize).** Put sign-in, verify and profile setup on the same lilac `sidebar` story panel as Welcome, at smaller scale. The forms then read as one continuous welcome instead of four admin screens. It touches sign-in, verify and profile-setup.

### Questions to consider
- Should Waiting ever lose the code? A copyable link that stays until expiry may be worth more than the "shown once" rule for a 24-hour pairing token.
- Does the inviter need "Check pair status" at all if realtime and focus refresh already revalidate? If the page updated by itself and said so, the most anxious screen would have one fewer button.
- Could the invitee set their name on the Join screen, so that "Join Anna" and "Your name" become one decision instead of two screens?
## Assessment B: detector and rendered evidence


**Detector counts**
- **Source scan** (`impeccable detect --json apps/web/src/features/auth apps/web/src/features/pair apps/web/src/app/NotFoundPage.tsx apps/web/src/app/RouteErrorPage.tsx`): exit 0, `[]`. No findings.
- **Rendered scan** (capture/entry/*.detect.json, 1440 light): one finding in total.
  - welcome: 1 `straggler` (advisory) at `div.entry-story > p`. The word "place." is alone on line 2.
  - sign-in, verify, profile-setup, pair-start, pair-join, pair-waiting, pair-ended, no-such-page: 0 each.

**Verified findings**
1. **Straggler on welcome.** Real, P3. `.entry-story > p` (apps/web/src/styles/base.css:49) has `max-width:400px` and no `text-wrap: pretty`. The screenshots show the same thing where the detector did not run: "code." alone in the entry-card description at 390, and "partner." alone at 768. Fix with `text-wrap: pretty` on body paragraphs. Command: **typeset**.

**False positives**
- None. The detector flagged one item, and it is real.

**Visible defects from screenshots**
1. **pair-waiting, 1440, light and dark: header and card do not line up.** The PageHeader starts at x≈288 but the card is centred (x≈488–1208). Cause: WaitingPage.tsx puts `PageHeader` outside `section.card.form-page`, and `.form-page` centres itself with `margin: 24px auto; max-width: 720px` (base.css:22). At 1024 and below the content column is about 720px wide, so the gap disappears. P2. **layout**.
2. **Pair screens use different alignments at 1440.** pair-start is a full-width grid aligned left. pair-join and pair-ended are a 720px card centred in the content area. pair-waiting mixes the two (item 1). Same cause: `.form-page` centring inside the portal shell. P2. **layout**.
3. **pair-join, all widths: no navigation item is selected.** On join, "Your pair" is not highlighted. On start, waiting and ended it is. Cause: PortalNavigation.tsx:16 has `NavLink to={destination}`, and destination is `/pair/start`, so `/pair/join` never matches. Matching on `/pair/` would fix it. P2. **harden**.
4. **"Back" link sits about 6px to the right of the content edge** (sign-in and pair-join, all widths). Cause: base.css:25 gives the link `min-width:48px; justify-content:center`, so the short word is centred in a 48px box. Longer links ("Return to Deseo", "Use another email") are not shifted. P3. **polish**.
5. **no-such-page, all widths: gap of about 60px between the description and the link.** Cause: `.page-header` margin-bottom 32 (base.css:26), plus `.form-page > a` margin-top 16 (base.css:23), plus the centred 48px link box. RouteErrorPage uses a button in `.actions` instead, so the two error screens look different. P3. **layout**.
6. **verify, all widths: buttons are grouped unevenly.** "Sign in" sits alone inside the form. "Resend code" and "Use another email" share the next row, and at 390 the link drops to a third row. Cause: the resend button is outside the form and gets `.form-page > button` margins (base.css:23). P3. **layout**.
7. **welcome, 768: two columns are too narrow.** The breakpoint is `max-width:767px` (base.css:56), so 768 still gets 2 columns of about 350px. The h1 breaks over 3 lines with "days" alone, and both paragraphs end with a single word. P3. **adapt**.
8. **Heading sizes change between welcome and the next screens.** The welcome card title is 24px (`.entry-card h1`, base.css:53). sign-in, verify and profile use the 40px h1 in a 24px-padded card. The welcome card is 32px-padded (base.css:52). P3. **typeset**.
9. **Dark mode, welcome (1440, 390) and the shell logo: the icon keeps a light tile.** `brand/icon-web.webp` has a baked-in cream tile (sampled #FCF8F7), which shows as a bright square on the dark surface. The asset only suits light mode. P3. **polish**.
10. **Not a defect: buttons look washed out in all 390-dark shots.** This is a capture effect. One sampled pixel is (164,143,216), about 74% of the way from #60527C to #BBA4F7. The `.button` background and colour transitions (controls.css:1, 140ms) were caught mid-change after the appearance switch. The 1440-dark shots are correct.
11. **Outside this area (shell):** at 390 the top bar shows two "A" avatars, one beside the name and one as the account button. I am passing this to the shell review.

Checked and clean: no horizontal scroll, clipping or overlap in any of the 54 shots, and every control I saw is at least 48px. All images are 900px high and the content fits, so the sticky-element capture effect does not apply.

**Drift from DESIGN.md tokens**
- **base.css:48** `.entry-story h1`: takes h1 weight 800 / line-height 1.1 / -.035em. The `display` token is 700 / 1.2 / -0.03em.
- **base.css:47** `.entry-story` padding 48px: not on the spacing scale (max 40).
- **base.css:52** `.entry-card` padding 32px: the card token is 24px.
- **base.css:53** 24px heading: no 24px type token (title is 19, headline is 40/30).
- **base.css:50** `.welcome-icon` border-radius 22px: no radius token.
- **base.css:43** `.invite-code`: 28px / weight 650 / .08em are not tokens. `border-radius:12px` is written as a number instead of `var(--radius-control)`.
- **base.css:40** `.paired-members .avatar` 80px / 32px font: the avatar token is 32px size.
- **controls.css:2** `.button.primary` font-weight 700: the `button` token is 600.
- **controls.css:5** `.button.danger` text uses `--on-primary`. The frontmatter says `{colors.surface}`, but the DESIGN.md text says on-primary. The two parts of DESIGN.md disagree.
- **controls.css:1** `.button` gap 10px: off scale.
- **base.css:19** `.eyebrow` margin-bottom 6px: off scale.
- **controls.css:24, 29, 34–36**: `.status` 12px, `dialog` 20px and `.view-tabs button` 12px radius are written as numbers instead of radius tokens. `.view-tabs button` padding 10px is off scale.
Suggested commands: **typeset**, **polish**, **extract**.

**Skipped steps**
- **Browser overlay**: not possible. There is no local backend or live page in this container, and the brief says not to start servers.
- **`.invite-code` look**: the waiting capture has no code to show (the "shown once" state), so I could only check the CSS, not a rendered code.
- **RouteErrorPage**: it was in the source scan (0 findings), but it was not captured, so I have no screenshot of it.
- **Accessibility rules** (low-contrast, gray-on-color, skipped-heading): off on purpose in `.impeccable/config.json`. I did not assess them.

I did not edit any files.
