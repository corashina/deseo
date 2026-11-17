---
target: Entry
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/user/deseo/apps/web/src/features/auth"
timestamp: 2026-11-17T10-58-41Z
slug: apps-web-src-features-auth
---
Method: dual-agent (A: A-entry · B: B-entry)

# Critique: Entry (rescore, 2026-11-17)

Evidence: design-capture run on master a9c61d0, 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 29/40, 72%.** Baseline: 26/40. P0: 0 · P1: 1 · P2: 3 · P3: 1 (Assessment A).

P1 findings, all fixed in PR #35:

- Waiting after a return visit reads as broken

P2 and P3 findings stay open for a later pass. Assessment B lists the detector results and visible defects. Questions are in Assessment A.

## Assessment A: design review


All 9 screens at all 6 captures. The Waiting capture shows the return-visit state (no code). I judged the code-shown and Join preview states from source.

## Design specificity verdict

**Lightly authored. The palette and voice are Deseo's, but the structure could belong to any product.** Welcome has some character: the lilac story panel, the 96px Two voices icon, and "Plan your days together." After it, every screen is the standard SaaS auth pattern (a small logo row above a 480px white card). Rose and teal are Deseo's signature, and they are absent from the whole first run. The only exception is the rose "A" avatar. The pairing moment is the one event unique to this product, and it gets no more visual weight than a password reset.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Busy states on every button. No progress cue across 6–7 screens. Waiting does not say it updates by itself. |
| 2 | Match system / real world | 3 | Plain, short copy. "Sign in with email" shown to people who have no account. "Replace invitation code" shown when no code is visible. |
| 3 | User control and freedom | 3 | Back, Use another email, Sign out on profile setup, and Cancel invitation with a dialog. Exits are good. |
| 4 | Consistency and standards | 3 | Tertiary actions use two styles (underlined "Back" and plain "Sign out"/"Cancel invitation"). Titles jump from 30px to 40px. Cards change from centered to left-aligned. The Back link is offset. |
| 5 | Error prevention | 3 | Link-or-code normalization, format checks, resend cooldown, review before Join. Pasting "123 456" gets cut to "123 45". |
| 6 | Recognition rather than recall | 3 | Verify shows the email, and the Join preview names the inviter. On a return visit, Waiting shows an expiry time for a code it does not show. |
| 7 | Flexibility and efficiency | 3 | One-click pair and code, self-reviewing deep link, code autofill. No share sheet on phones. |
| 8 | Aesthetic and minimalist design | 3 | Clean, focused cards. The Welcome story panel is mostly empty, and its message repeats the card. |
| 9 | Error recovery | 3 | Specific errors, input kept, Retry labels. Errors show as a separate Status, not on the field. |
| 10 | Help and documentation | 2 | The spam hint and the descriptions help. There is no help, support, or privacy link anywhere in the entry flow. |
| **Total** | | **29/40** | **Good** |

## Cognitive load

- Failures: **Visual hierarchy** on Waiting in the return-visit state. The primary button is "Replace invitation code", the only status is "Expires Nov 17, 2026, 10:16 PM" for a code you cannot see, and nothing says the state is fine. **Working memory** (partial): the same state expects you to remember the code you already sent. The verify step also depends on in-memory `entryIntent.email`, so a reload loses it.
- Score: 1–2 failures, so the load is low to moderate.
- Decision points with more than 4 options: none. Waiting with a code on screen has exactly 4 actions (Copy, Replace, Check, Cancel).

## Emotional journey

- **Peaks:** the Welcome headline, and "Make space for two" with two balanced choices.
- **Valleys:** Verify is a generic OTP box. Waiting after a return visit says "We show each code once. Replace it to get a code you can send." It is honest but cold, and it reads like a system rule, not reassurance. When the partner joins, the realtime update sends you to Today without comment. The high point of the whole first run goes unmarked.
- **Reassurance:** good. The Join preview says "Private events stay private." The cancel dialog states the result. Ended does not assign blame.

## What's working

1. **Low-friction pairing logic.** "Invite your partner" creates the pair and the code in one action. Join accepts a link or a code, with any case and separators. The invitation intent survives sign-in and reviews itself.
2. **Honest button states.** "Sending…", "Creating invitation…", "Retry invitation", "Resend code in 60s", and the copy fallback "Copy the code above and send it to your partner."
3. **Responsive and dark mode discipline.** At 390px, nothing overflows, primary buttons fill the width, Start's two choices stack cleanly, and every screen keeps its tokens in dark mode.

## Priority issues

1. **[P1] Waiting after a return visit reads as broken.** Where: `features/pair/pages/WaitingPage.tsx`, pair-waiting at all widths. Why: the inviter returns (realistic on a phone) and sees no code, a primary button to *replace* a code, and an expiry for something invisible. "Check if your partner joined" suggests manual polling, but `SessionProvider` already updates through realtime and on focus. People will create a new code without need, and that silently invalidates the one they already sent. Fix: lead with the state: "Your code works until 10:16 PM. Your partner can still use it." Make Replace secondary. Add one line: "This page opens Today when your partner joins." Change "Check if your partner joined" to a text button "Check now". Command: **clarify**.
2. **[P2] The invitation code is hard to read and type.** Where: `.invite-code` in `styles/base.css` and `WaitingPage.tsx`, Waiting with a code on screen. Why: 12 characters in one run at 30px and .08em spacing are hard to read aloud or copy across devices. `inviteTokenSchema` already strips spaces and dashes. Fix: show the code in three groups of four (`XXXX XXXX XXXX`). On touch devices, offer the system share sheet beside "Copy invitation link". Command: **polish**.
3. **[P2] The funnel has no orientation, and the brand stops after Welcome.** Where: sign-in, verify, profile-setup, pair-start. Why: 6–7 screens with no step cue. Jordan cannot tell how far they are from the shared space. Fix: add a quiet eyebrow (the DESIGN eyebrow token), for example "Step 2 of 3 · Your name", on the email/verify, profile, and pair-start cards. Command: **onboard**.
4. **[P2] First-time users get sign-in copy, and trust cues are weak.** Where: `EmailPage.tsx` and `WelcomePage.tsx`. Why: "Sign in with email" puts off a person with no account. "A private space for you and your partner." is 14px muted text under the button. The screen guide lists privacy and terms links on Welcome, and none exist. Fix: change the Email description to "We will send you a six-digit code. New accounts use the same code." Move the privacy line up next to the description. Add the policy links when the policies exist. Command: **clarify**.
5. **[P3] The Back link is offset, and tertiary actions have two styles.** Where: `styles/base.css`. `.form-page > a:not(.button) { justify-content: flex-start }` loses to the later `:is(.form-page, …) > a:not(.button) { justify-content: center }`, because both have the same specificity. "Back" sits about 6px inside the content edge on sign-in and join (1440: x=511 vs 505; 390: x=43 vs 37). It is also underlined, but "Sign out" and "Cancel invitation" are not. Fix: drop `.form-page` from the centering `:is()` list. Use one tertiary style. Command: **polish**.

Counts: P0 0, P1 1, P2 3, P3 1.

## Persona red flags

- **Jordan (first-timer):** sees "Sign in with email" with no account. "Save profile" gives no hint of what comes next. On Waiting, "Replace invitation code" makes Jordan think the first code failed.
- **Casey (mobile, interrupted):** switches to the mail app for the code. If the browser drops the tab, `entryIntent.email` is gone and `/verify` redirects to sign-in. As inviter, Casey has no share sheet, and on return meets the code-less Waiting state.
- **Riley (stress tester):** pastes "123 456" and `maxLength=6` cuts it to "123 45", which shows the six-digit error. A long inviter name in the Join h1 wraps cleanly.
- **The invited partner (from PRODUCT.md users):** opens the link and sees "Your invitation is ready", but the inviter is not named until after sign-in, which is correct by design. The Join preview says "Share plans, messages, and memories" and leaves out tasks, which the screen guide includes. After joining, nothing confirms "You and Anna are now a pair."

## Minor observations

- The verify code field is an empty 16ch box. DESIGN.md promises "six large spaced digits", but nothing shows the six slots before you type (`styles/controls.css` `.code-input`).
- The verify and join errors use a separate `Status` below the field, so the field never gets a danger border (`VerifyPage.tsx`, `JoinPage.tsx`).
- The title scale jumps from 30px (entry cards) to 40px (pair cards) within one funnel (`styles/base.css`).
- On Welcome at 1024–1440px, the card is vertically centered against a taller story panel, so the two boxes share no edge (`.entry-page` `align-items: center`).
- "Retry profile" is an odd label. "Save profile" for one name field could say what comes next (`ProfilePage.tsx`).

## Bolder move proposals

1. **colorize — Welcome story panel.** Add the rose and teal accents as two small labeled marks ("You", "Your partner") that overlap the way the Two voices icon does. Reason: owner colors are Deseo's signature, and the first run never shows them.
2. **delight — the partner-joined moment (Waiting → Today).** On the first Today after a join, show one status: "Sam joined. Your pair is ready." Reason: the emotional peak of onboarding is a silent redirect now. Mark it once, then never again.
3. **colorize — Welcome in dark mode.** Fill the story panel with `shared-soft-dark`, not `sidebar-dark`. Reason: in dark mode the panel is nearly the canvas color and loses the lilac warmth it has in light mode.

## Questions to consider

- Should forming a pair get more ceremony than a password reset, given it is the only time it happens?
- The copied link already carries the secret. Why does the inviter lose the code on reload? Could Waiting show it again until it expires?
- Does a person need to name themselves before they choose to start or join, or could profile and pair start be one screen?


## Assessment B: detector and rendered evidence


Screens: welcome, sign-in, verify, profile-setup, pair-start, pair-join, pair-waiting, pair-ended, no-such-page. I read all 54 screenshots (4 light widths and 2 dark for each screen).

## Detector counts

**Source scan** (`impeccable detect --json apps/web/src/features/auth apps/web/src/features/pair apps/web/src/app/NotFoundPage.tsx apps/web/src/app/RouteErrorPage.tsx`): exit 0, `[]`. **0 findings** for every rule.

**Rendered scan** (`--cdp`, 1440 light): every `<screen>.detect.json` is `[]`. **0 findings** for each of the 9 screens.

The config turns off `low-contrast`, `gray-on-color` and `skipped-heading`, and turns off `kicker-above-heading` for `apps/web/src/**`. No values in this area were suppressed. The 23px wordmark exception applies to shell.css only.

## Verified findings

The detector gave no findings. I found these by reading the screenshots and the code.

1. **P3: the lone "Back" link sits 6px in from the content edge.** This happens on sign-in and pair-join at every width, in light and dark. The fix in `apps/web/src/styles/base.css:26` never takes effect. Both rules have specificity (0,2,1):
   - `.form-page > a:not(.button) { justify-content: flex-start }` at line 26
   - `:is(.form-page, …) > a:not(.button) { … justify-content: center }` at line 32

   `:is()` takes the specificity of its most specific argument, so the later rule at line 32 wins. "Back" is about 36px wide inside a 48px minimum box, so it is centered and starts 6px in. For comparison, the text button "Sign out" (profile) and "Cancel invitation" (waiting) line up with the edge. Command: **polish**. Move line 26 below line 32, or set `justify-content: flex-start` in the line-32 rule for `.form-page`.
2. **P3: the main button on the entry card is not always full width.** The comment at `base.css:54` says entry screens have "a full-width main button". The rule at `base.css:57` only reaches `form > .button`. On no-such-page, the button "Return to Deseo" (`apps/web/src/app/NotFoundPage.tsx:5`, `.form-page > a.button`) is inline at every width. The same applies to `RouteErrorPage` in `.actions`. Command: **polish**. Widen the selector to cover the main action on an entry card, or change the comment to match the code.
3. **P3: font weight and spacing values are not in the tokens.**
   - `.entry-brand` (`base.css:51`) uses 19px with weight 800. The `title` token is 19px with weight 700.
   - `.invite-code` (`base.css:49`) uses 30px, weight 700, line height 1.2 and letter spacing .08em. The size comes from `headline-mobile`, but the weight and line height come from `display`. No token has .08em letter spacing.
   - `.code-input` (`controls.css:57`) uses letter spacing .3em, which is not a token.

   These may be deliberate code styles. If so, add them to DESIGN.md and brand/tokens.json; otherwise change them to token values. Command: **typeset**.
4. **P3: "sign-in" breaks at its hyphen on welcome at 390px**, in light and dark. The description wraps as "…get a sign-" / "in code." The cause is the normal hyphen in `apps/web/src/features/auth/pages/WelcomePage.tsx:8` inside the narrow `.entry-card` (`.page-header p`, `text-wrap: pretty`). Command: **clarify** or **polish**. Use a non-breaking hyphen (U+2011), or wrap the word in a span that does not break.

## False positives

The detector gave no findings, so there are none to reject. From my own checks I rejected these:
- **"link" looks colored** in the descriptions on pair-join and pair-start. A 4x crop of the 1440 shot shows normal subpixel antialiasing on thin strokes. No CSS colors that word. Not a defect.
- **The light brand icon has no visible tile**, but the dark icon shows a tile. The two assets are separate (`icon-web.webp` and `icon-web-dark.webp`). Both read correctly on their canvas. This is not a light-only asset.
- **The sidebar ends at the window height** in full-page shots of pair screens. The overrides say this is a capture effect.

## Visible defects from screenshots

| Screen | Width | Theme | Defect | Cause |
|---|---|---|---|---|
| sign-in | 390, 768, 1024, 1440 | light and dark | "Back" link starts 6px in from the edge of the field and button | `base.css:32` overrides `base.css:26` (finding 1) |
| pair-join | 390, 768, 1024, 1440 | light and dark | Same "Back" inset (319px against a 313px edge at 1440) | Same |
| welcome | 390 | light and dark | "sign-" / "in code." breaks at the hyphen | `WelcomePage.tsx:8` description (finding 4) |
| no-such-page | 390, 768, 1024, 1440 | light and dark | Main button is inline, but sign-in, verify and profile-setup have full-width main buttons | `base.css:57` covers only `form > .button` (finding 2) |

No other visible defects:
- No horizontal scroll, clipped text or overlap at any width.
- No control under 48px. Buttons, inputs, the "Back" and "Use another email" link targets, "Sign out" and the 390 header avatar are all 48px or more.
- Dark mode uses the right surfaces everywhere: canvas `#14111B`, cards `#221D2D`, primary `#BBA4F7` with dark text.
- On verify at 390, the "Resend code in 60s" button and the "Use another email" link wrap to two rows by about 3px. They stay aligned and readable.

## Skipped steps

- **Browser overlay**: skipped. No local backend can run in this container and there is no live page. The overrides forbid starting servers.
- **States not captured**, so not judged:
  - waiting with a code shown, so the `.invite-code` block was never rendered
  - join after an invitation is reviewed (preview and "Join pair")
  - all `Status` error states
  - the welcome invitation variant and its global sign-out failure message
  - `RouteFailureBoundary`/`RouteErrorPage`. This one renders `.entry-container` without the `entry-brand` row (`RouteErrorPage.tsx:22`), so it may look different from the other entry screens. This is from the source only; I did not see it rendered.
- **`pair-grid`** from the task does not exist in the CSS. The pair layout uses `.pair-options` and `.pair-cancel` (`base.css:44-48`), and I reviewed those instead.
