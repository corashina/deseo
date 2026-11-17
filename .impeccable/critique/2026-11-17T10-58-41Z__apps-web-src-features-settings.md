---
target: Settings
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/deseo/apps/web/src/features/settings"
timestamp: 2026-11-17T10-58-41Z
slug: apps-web-src-features-settings
---
Method: dual-agent (A: A-settings · B: B-settings)

# Critique: Settings (rescore, 2026-11-17)

Evidence: design-capture run on master a9c61d0, 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 28/40, 70%.** Baseline: 26/40. P0: 0 · P1: 2 · P2: 3 · P3: 5 (Assessment A).

P1 findings, all fixed in PR #35:

- Invalid timezone is a dead end
- The End pair code step is silent

P2 and P3 findings stay open for a later pass. Assessment B lists the detector results and visible defects. Questions are in Assessment A.

## Assessment A: design review


Scope: no notification or account-deletion controls exist in the portal by product scope (PRODUCT.md). They are not scored as missing. End pair is the high-stakes action. Its dialog is not captured; I judged it from `SettingsPage.tsx` and `Dialog.tsx`.

## Design specificity verdict

Mostly category-standard: one stacked card, a separate danger card, plum and red buttons. With the logo covered, it could be any SaaS settings page. The authored parts are small and right: owner-colored avatars with You / Your partner, the partner named in the dialog, and product-specific copy ("Changing it does not move your events."). That restraint suits Operate. Your pair is the only place a signature move could sit, and it has none.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | "Profile saved." and "Sending code…" work. After "Email me a code", the code field appears with no sent message, no address, and no expiry. |
| 2 | Match with real world | 3 | The copy is plain. The field shows the raw IANA value `Europe/Warsaw`, but the hint asks for a city. |
| 3 | User control and freedom | 3 | Cancel, Close, and Escape all work, each blocked while busy. A conflict says "Your draft is kept", but the only action discards the draft. |
| 4 | Consistency and standards | 3 | The code field skips the sign-in `.code-input` style. "Email me a code" uses the danger fill but deletes nothing. The End card heading spacing differs from the main card. |
| 5 | Error prevention | 3 | End pair is gated well. The free-text timezone accepts invalid values. |
| 6 | Recognition rather than recall | 3 | No email address shows anywhere, including where the dialog says "we email you". |
| 7 | Flexibility and efficiency | 2 | The code field is not in a form, so Enter does not confirm. There are no other accelerators. |
| 8 | Aesthetic and minimalist design | 3 | Clean. Member names in the 19px title style weigh as much as the section heading. |
| 9 | Error recognition and recovery | 2 | An invalid timezone shows "Check the entered values." below the form. "Retry profile" then repeats the same failure. |
| 10 | Help and documentation | 3 | Good section intros and a timezone hint. The code step leaves out the "check spam" and expiry notes that sign-in gives. |
| | **Total** | **28/40** | **Good** (70%) |

## Cognitive load

0 of 8 failures; one item is borderline. Visual hierarchy in Your pair: at 1024px and 1440px, two wrapped 19px/700 names outweigh the 19px "Your pair" heading. The largest decision point is the dialog code step, with exactly 4 options: Confirm ending pair, Cancel, Send a new code, and Close. Progressive disclosure is good: the code field appears only after the person requests a code. Load is low.

## Emotional journey

- **Peak:** Your pair. The two owner-colored avatars are the only warm moment.
- **Steady:** Account copy builds trust ("Signing out removes private content and unsent changes from this browser.").
- **High stakes:** The dialog names the partner, lists what both people lose, and says "You cannot undo this." Then the reassurance stops. After the code request there is no "We sent a code to …" line and no spam note. Nothing says to save photos first, though memories become unreachable and no export exists.
- **Valley:** After the pair ends, the page says only "Your pair has ended. Shared content is unavailable." It is correct but cold.

## What's working

1. **End pair is isolated and gated.** It has its own card, and the code goes out only on request. A retryable failure becomes "Retry ending pair", which reuses the command ID.
2. **Long names hold up.** Member rows stack at 390px and wrap with `min-width: 0`. The auto-fit grid keeps both members side by side from 768px. The header shows one truncated line per partner.
3. **Specific, honest copy.** "Your next pair starts empty." "Changing it does not move your events."

## Priority issues

1. **[P1] Invalid timezone is a dead end.** `SettingsPage.tsx` L50 and L58, `TimezoneField.tsx`, all widths. If the person types "Warsaw" and does not pick an option, Zod rejects the value. The message is generic and shows below the form, and "Retry profile" can never succeed. Datalist support is weak on mobile, so many people will reach this path. **Fix:** Check the value with `timezoneSchema` on blur and on submit. Resolve a unique city match to its zone. Otherwise show a field error: "Pick a timezone from the list, such as Europe/Warsaw." Use "Retry profile" only for RETRYABLE errors. **Command:** harden.
2. **[P1] The End pair code step is silent.** `SettingsPage.tsx` L105–115, dialog. A bare field appears. It does not name the address, the expiry, or the spam folder, and it lacks the six-digit `.code-input` style that sign-in teaches. **Fix:** Add a Status line: "We sent a code to a…@example.com. Check spam. It expires in 10 minutes." Add `className="code-input"`. Wrap the step in a `<form>` so Enter confirms. **Command:** clarify.
3. **[P2] The dialog leaves out the consequence that matters most.** `SettingsPage.tsx` L104 and L114. It does not tell the person to save their photos first. It does not say if private events go too. "Email me a code" is red, so red appears twice before the real decision. **Fix:** Add "Download any photos you want to keep before you continue." Make "Email me a code" the primary button. Keep red only for "Confirm ending pair". **Command:** clarify.
4. **[P2] The conflict copy says the draft is kept, but the draft cannot be saved.** `SettingsPage.tsx` L50 and L57–58. On CONFLICT, Save is disabled, and the only action is "Discard changes and reload". DESIGN.md asks to keep both the saved data and the draft. **Fix:** Show the saved value beside the draft. Add "Save my changes", which resubmits with the new version. **Command:** harden.
5. **[P2] The dark danger color reads as a partner color.** `controls.css` L185, tokens. Screens: 390-dark and 1440-dark. `danger-dark` #F2939F is nearly `rose-dark` #F49CC0, so End pair looks like Anna's owner chip. This breaks the One Meaning Rule. **Fix:** Change the token in both `brand/tokens.json` and DESIGN.md: use a deeper red fill with light text, or an outlined danger style. Keep its hue clearly apart from rose. **Command:** colorize.

## Persona red flags

- **Riley:** Typing "Warsaw" or a name of only spaces gives "Check the entered values.", and "Retry profile" loops. A conflict promises a kept draft that cannot be saved.
- **Casey (390px):** Casey goes to the email app and comes back to a dialog that does not say where the code went. The datalist is poor on iOS. The two sign-out buttons stack with ragged widths.
- **Alex:** Enter does not submit the code. Save profile stays active when nothing has changed.
- **Leaving partner (PRODUCT.md: ends access without the other partner's approval):** This person may act alone after a hard conversation. They get no prompt to keep their photos and no sign that the code is on its way. In dark mode, the soft pink button makes the moment feel lighter than it is.

## Minor observations

- [P3] `settings.css` L166: the h2 rule misses the End card because it sits outside `.settings-page`. The heading-to-text gap is about double the main card's, and the text-to-button gap is tight.
- [P3] `settings.css` L174: member names in the title style compete with the "Your pair" heading.
- [P3] `SettingsPage.tsx` L52: the Profile intro explains only the timezone. Move it into the timezone hint.
- [P3] `SettingsPage.tsx` L58: Save profile stays enabled with no changes, and "Profile saved." stays on screen until the next edit.
- [P3] `controls.css` L189: on hover, the danger button fades to `danger-soft`, so it looks weaker under the pointer.

## Bolder move proposals

1. **Shared band for Your pair (colorize).** Set both member rows on one `shared-soft` strip with the lilac Together dot between the avatars. If the pair record has a start date, add "Paired since 4 March 2026". It is a fact, not a counter. Reason: this is the page's only personal block. The shared lilac already means "both of us", so the band gives Settings one recognisably Deseo moment without decorating the form. Screen: Settings, Your pair.

## Questions to consider

1. There is no export. Should End pair link to Memories first, rather than only warn?
2. The person is already signed in. Does the email code protect them, or does it only add an inbox switch at the most emotional moment?
3. After a pair ends, Settings is the last stop, and the portal has no account deletion. Where does a person who wants to leave Deseo go?


## Assessment B: detector and rendered evidence


## Detector counts

| Scan | Command / source | Findings |
|---|---|---|
| Source scan | `impeccable detect --json apps/web/src/features/settings apps/web/src/components/ui/TimezoneField.tsx apps/web/src/components/ui/Dialog.tsx` | **0** (`[]`, exit 0) |
| Rendered scan | `capture/settings/settings.detect.json` (CDP, 1440px light) | **0** (`[]`) |

No rule fired. The config turns off `low-contrast`, `gray-on-color`, and `skipped-heading`. It ignores `kicker-above-heading` in `apps/web/src/**` and `design-system-font-size` at 23px. None of these exclusions hides a finding in this area. The Settings page header has no eyebrow, and the 23px value is in `shell.css`.

## Verified findings

The detectors found nothing. A manual review of the code and screenshots found these items:

1. **P3: the "End this pair" heading has a larger gap than the other section headings.** Look at `apps/web/src/styles/settings.css:2`:
   `.settings-section > h2, .settings-page > section > h2 { margin-bottom: var(--space-2); }`
   The End-pair card is `section.card.form-page.settings-danger`. It sits outside `.settings-page` and has no `.settings-section` class, so its h2 keeps the browser default bottom margin (0.83em, about 16px). The other three headings get 8px. The `h2` rule in `base.css:15` sets no `margin-bottom`. In the screenshots, the heading-to-text distance is about 32px for Profile, Your pair, and Account, and about 40px for "End this pair". This holds at 768, 1024, and 1440. Fix: add `.settings-danger > h2` to the selector in `settings.css:2`, or give `h2` a token margin in `base.css`. Command: **polish**.
2. **P3: the error status after the End-pair button has no top gap (inferred from code, not captured).** In `SettingsPage.tsx:89-91`, `<Status error>` comes directly after the `Button`. `.status` has `margin: 0 0 var(--space-4)` (`controls.css:28`), and `.settings-danger > .button` has `margin-top: 0` and no bottom margin (`settings.css:15`). So a failed end-pair request puts the status box flush against the button. The box also adds 16px of bottom space before the card padding. The other sections place `Status` after a block that has bottom margin, so only this card has the problem. Command: **polish**.
3. **P3: token values are written as literals, not as variables.** `base.css:37` uses `.page-header { gap: 16px 24px; margin-bottom: 32px }`, and `base.css:2` and `base.css:6` use `24px` scroll padding. `base.css:52` uses a `--space-6` margin-bottom in its media query, so the same file uses both forms. The values match `spacing.4/6/8`, so the rendered result does not drift. The risk is that these lines miss a future token change. Type sizes (`19px`, `14px`, `15px`) are also literals. They match the DESIGN.md `title`, `body-small`, and `button` tokens, and the project has no type variables. Command: **extract**.

No color, radius, or spacing value in `settings.css`, `controls.css` (dialog and field rules), or the `base.css` `.form-page` and `.paired-members` scope is outside DESIGN.md or `brand/tokens.json`.

## False positives

None. Both scans returned no findings.

## Visible defects from screenshots

I looked at 390, 768, 1024, and 1440 in light mode, and at 390 and 1440 in dark mode.

- **The "End this pair" heading gap** is visible at every width in both modes. This is item 1 above, caused by `settings.css:2`.
- **No horizontal scroll, clipped text, or overlap.** Long member names wrap inside `.paired-members` (`minmax(min(100%, 240px), 1fr)`). There are two columns at 768 and up and one column at 390. `overflow-wrap: anywhere` breaks "Kowalska-/Wiśniewska" at the hyphen, as expected.
- **Controls:** every button and input measures 48px high (`--nav-target`). At 390, the two sign-out buttons wrap to two rows, each 48px high with a 16px gap. That is correct.
- **Dark mode (390, 1440):** the surface, canvas, and line colors match the `*-dark` tokens. The primary button is `#BBA4F7` with dark text, and the danger button is `#F2939F` with dark text. The avatars use the soft dark fills. No light-only asset appears, and no element is unreadable.
- **Not defects:**
  - At 390, "Your name" shows "…z Gd": this is normal horizontal scroll in a single-line input.
  - The sidebar ends at 900px in the full-page shots. `.sidebar` is `position: fixed` (`shell.css:2`), so this is a capture effect.
  - Outside this area: at 768 and 1024, the shell top bar wraps the pair label so "Jr" or "Nowakowski Jr" sits alone on a second line (`.topbar-label`, `shell.css:18`). This belongs to the shell critique.

## Skipped steps

- **Browser overlay:** skipped. The local backend cannot run in this container and no live page exists. The overrides also prohibit starting servers.
- **The Dialog ("End this pair?") was not rendered:** the capture set has no shot of the open dialog. I reviewed it from code only (`Dialog.tsx`, `controls.css:43-47`). The width is `min(480px, 100vw - 32px)`, padding is `--space-6`, and the close button is a 48px-high text button. I found no defect in the code. The three-button row in the code step ("Confirm ending pair", "Cancel", "Send a new code") wraps at 480px, but I could not see that it wraps cleanly.
- **States that were not captured:** profile conflict or save status, the pending, ended, and no-pair variants of "Your pair", and the "Pair timezone" line. I did not check these visually.
