---
target: Public site
total_score: 27
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 1
target_identity: "file:/home/user/deseo/apps/site/index.html"
target_fingerprint: "sha256:8b99e96d1cfb451afc52478800856482995885de4e878db77d60508076613b95"
target_path: /home/user/deseo/apps/site/index.html
timestamp: 2026-11-17T10-58-41Z
slug: apps-site-index-html
---
Method: dual-agent (A: A-site · B: B-site)

# Critique: Public site (rescore, 2026-11-17)

Evidence: design-capture run on master a9c61d0, 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 27/36, 75%.** Baseline: 25/36. Heuristic 7 is n/a. P0: 0 · P1: 1 · P2: 3 · P3: 1 (Assessment A).

P1 findings, all fixed in PR #35:

- The hero has no primary action

P2 and P3 findings stay open for a later pass. Assessment B lists the detector results and visible defects. Questions are in Assessment A.

## Assessment A: design review


Scope: `apps/site` home, invite, support, privacy, terms, 404. Evidence: source plus all captures (390/768/1024/1440 light, 390/1440 dark).

## Design specificity verdict

**Content is authored; composition is category-interchangeable.** The copy is specific to Deseo and honest: "A message shows Sent only after Deseo saves it", "The app store does not pass the invitation to Deseo", Preview badges on real captures of Alex and Sam. Tokens, Manrope, and the owner colors match the portal exactly, and dark mode is a true Midnight port. But the page skeleton is the template that mode-persuade names: a split hero (copy left, phone right), three text-left/preview-right rows, a tinted panel, and an FAQ card. "The Shared Notebook" lives only inside the screenshots. Around them the page is warm canvas with headings. Remove the logo and the previews, and the layout could belong to any habit tracker.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Release status is clear everywhere. Only the header Support link shows the current page; the footer and the Invite, Privacy, and Terms pages show no current state. |
| 2 | Match with real world | 3 | Plain language. "Join their pair" on `/invite` uses the noun "pair" with no context for a first-time visitor. |
| 3 | User control and freedom | 3 | Every page has the brand link and footer. Privacy and Terms point to Support, which has no contact. This makes a loop. |
| 4 | Consistency and standards | 3 | Two "Coming soon" cards use different heading sizes: home `.soon h2` is 19px, invite "Install Deseo" is 40px. Rose (Partner A) and note peach are used as decorative panel fills. |
| 5 | Error prevention | 3 | The invite page warns that the store drops the link. Step 2 still says to reopen the original link, which expires in 24 hours. |
| 6 | Recognition over recall | 3 | Invitations is not in the header. Support has three sections and no jump links. |
| 7 | Flexibility and efficiency | n/a | Static Persuade site with no repeat tasks (mode rule). |
| 8 | Aesthetic and minimalist | 3 | Clean. The release status repeats six times on home, and the h2s are nearly as loud as the h1. |
| 9 | Error recovery | 3 | "Invitation does not work?", the 404 page, and Failed uploads all name the cause and the fix. |
| 10 | Help and documentation | 3 | Support is short and task-based. It has no contact and no section index. |
| **Total** | | **27/36** | **Good (75%)** |

## Cognitive load

- **Fail: visual hierarchy.** On home, the lilac "Coming soon" card (badge, 19px heading, paragraph) is heavier than the one action, a text link. Feature h2s at 40px/800 compete with the 48px/700 h1. On `/invite` and `/support`, each 40px h2 heads only a short paragraph.
- **Borderline: single focus.** The hero splits attention between a headline about the product and a card about its absence.
- Decision points: none has more than 4 options. The header has 1 link and the footer has 4.
- Result: 1 to 2 failures, which is low to moderate load.

## Emotional journey

- **Peak:** the 1440 "Talk in one place" capture. Owner-colored bubbles, the peach pinned note, and the "Coffee with Maya" next-plan glow look like a real shared life.
- **Valley:** the hero. The first boxed message says what you cannot do yet ("not in the App Store or Google Play yet"). Privacy and Terms are one-sentence placeholders, and Support says "no support contact yet."
- **Reassurance at the high-stakes moment** (accepting an invitation) is good. "What you share" and "Either person can end the pair" sit right under the install steps.

## What's working

1. **Honest, specific copy.** Each claim maps to a real behavior (one active pair, private events stay with the author, a memory is published only after every photo uploads). No hype.
2. **Real captures with a token-true dark pass.** Each preview swaps to its dark capture. Dark home at 1440 shows plum surfaces and bright owner colors with no washed-out images.
3. **Narrow pages are well built.** The 720px column keeps the header's left edge, and the footer sits at the bottom of short pages (404 and Privacy at 390 and 1440).

## Priority issues

1. **[P1] The hero has no primary action.** `index.html` hero, all widths. The only action, "Have an invitation? See how to join", is an underlined link at the bottom of a card about release status. Persuade requires a visible primary action, and for the stated audience (a person with a partner link) this is the action. **Fix:** put the link under the lede as a `button-primary` (48px, plum, 12px corners). Cut the `.soon` card to the badge and one sentence. **Command:** clarify.
2. **[P2] Invite steps conflict with the 24-hour expiry.** `invite/index.html` "Install Deseo" step 2, all widths. Before release, any invitation the visitor holds will expire before they can install, so "Open the original invitation link again" will fail. **Fix:** step 2: "Open the invitation link again. If it is older than 24 hours, ask your partner for a new one." **Command:** clarify.
3. **[P2] Flat heading scale.** `src/site.css` sets `h2` to 40px/800 and `h1` to 48px/700. On home, "Plan the week" reads at nearly hero weight. On `/invite`, "Already have Deseo?" is as loud as the page title. **Fix:** use `headline-mobile` (30px/800) for h2 at every width on home features and `.page`. Keep the display size for the hero h1 only. **Command:** typeset.
4. **[P2] Release status repeats six times on home.** Hero badge, hero h2, hero paragraph, FAQ "When can I download Deseo?", the privacy panel note, and the footer. **Fix:** keep the hero line (DESIGN.md requires it) and the footer. Drop the FAQ question and the `.soon` h2. **Command:** distill.
5. **[P3] Owner and note colors used as decoration.** `index.html` `.panel.rose` (rose-soft is Alex's color in the captures directly above it). `.panel.note` on `/invite` and `/support` uses note peach, which means a pinned note. In dark mode, `note-dark` makes a muddy brown slab (`invite-1440-dark`, `support-390-dark`). The One Meaning Rule is broken. **Fix:** use `sidebar` or `shared-soft` for neutral info panels. **Command:** polish.

## Persona red flags

- **Jordan (first-timer):** on `/invite`, "join their pair" and "select Join pair" assume the term "pair". "This page does not read or check your invitation" raises a doubt the page never resolves. On home, the first thing Jordan sees in a box is a negative.
- **Riley (stress tester):** home privacy panel → `/privacy` ("not published yet") → "Go to support" → "no support contact yet". A full loop with no answer. The wide preview cuts "Pick up flowers for dinner" mid-row, and the phone captures stop mid-card ("Sunday market", the second memory photo).
- **Casey (mobile):** at 390 the home page is about 5,250px tall. About 2,200px of it is three 300×740 phone captures. On a slow connection, each lazy capture is a blank white bordered slab (seen in `home-390` and `home-768`; probably a capture effect, but it is also the real loading state).
- **Invited partner (from PRODUCT.md Users):** they came to act on a link. Step 2 sends them to a link that will have expired (issue 2). The Invitations page has no header entry, so a return visit from home depends on the hero text link.

## Minor observations

- `index.html` "Plan the week": the copy claims shared task lists, but the preview shows only Calendar.
- `index.html` sample message "booked our table for 18:30" next to UI times in "10:05 PM" format. DESIGN.md asks for a numeric hour with AM/PM.
- `src/site.css` `.hero`: at 1440, about 280px of dead gutter between the text and the phone. The vertically centered copy leaves about 200px empty above the h1.
- `support/index.html`: the lede names three topics but does not link to `#pairing`, `#permissions`, and `#uploads`.
- Footer nav (all pages): no current-page state, unlike the header.
- `404.html`: offers only the home page. "Invitations" is the likely target for a broken invite URL.

## Bolder move proposals

1. **Make the hero part of the notebook (bolder, home hero).** Put a real HTML note card (`note-card`: peach, sender eyebrow "FROM SAM", one line) beside the headline as set text, in place of the generic `.soon` card. Reason: today the Shared Notebook appears only inside screenshots, and this puts its material on the page itself without adding JavaScript or claims.
2. **Teach the owner colors in text (colorize, home "Plan the week").** Next to "Each person has a fixed color and a visible name", add a static legend: rose-accent and teal-accent dots with "Alex" and "Sam", and a lilac one with "Together". Reason: this states the Name Beside Color Rule at the point where the copy claims it, and it uses the allowed decorative-mark tokens.

## Questions to consider

- Before release, the only visitor who can act is an invitee. Should `/` lead with the invitation path and treat the product tour as secondary?
- Do three 740px phone captures say more than their two sentences each? What if one wide capture and one phone capture did the whole job?
- What would this page look like if it *were* a page of the shared notebook, not a page about a notebook?


## Assessment B: detector and rendered evidence


## Detector counts

**Source scan** (`impeccable detect --json apps/site/index.html apps/site/invite apps/site/support apps/site/privacy apps/site/terms apps/site/404.html`): exit 0, `[]`. **0 findings.**
Config ignores in effect: `low-contrast`, `gray-on-color`, `skipped-heading` (all files), and `tight-leading` for `apps/site/**` (h3 leading 1.3 rounds to 24px in the static scan).

**Rendered scan** (`capture/site/*.detect.json`, CDP, 1440px light):

| Screen | Findings |
|---|---|
| home | 0 |
| invite | 0 |
| support | 0 |
| privacy | 0 |
| terms | 0 |
| 404-html | 0 |

**Total: 0 source, 0 rendered.**

## Verified findings

The detector found nothing. These are from code review against DESIGN.md frontmatter and `brand/tokens.json`. All colors, spacing, and radii in `apps/site/src/site.css` use token variables, with the exceptions below.

| # | Severity | Finding | File | Command |
|---|---|---|---|---|
| 1 | P2 | The wide Today preview (1440x1100 capture) scales to the content width on phones. At 390px it renders about 358px wide, a 0.25 scale, so app text is about 3-4px. At 768px it is about 0.49 scale (about 7px text). The preview cannot be read below 1024px. `sizes` also says `100vw`, but the real width is `100vw - 32px`. The captures do not show this because the image did not load (see the capture note below), so this comes from the code and the image size. | `apps/site/index.html:76-82`, `site.css:129-134` | adapt |
| 2 | P3 | The header nav link has `padding: 0 var(--space-3)` with no negative margin. The "Support" text sits 12px inside the right content edge, so it does not line up with the previews and panels below. The footer already corrects its own inset with `margin-left: calc(-1 * var(--space-2))`. Visible at all widths. | `site.css:80-85` | layout |
| 3 | P3 | `.badge` padding is `2px 10px`, and 10px is not on the spacing scale. The portal badges (`.partner-badge`, `.unread-count`) use `2px var(--space-2)`. | `site.css:118` | polish |
| 4 | P3 | Type roles that are not in the DESIGN.md scale: `.lede` is 19px/400 (title is 19px/700, body is 16px/400). `.brand` is 19px/800 (title weight is 700). Header and footer nav links are 16px/600 and 14px/600, but "Browser navigation label" is 15px/550. Either add the roles to DESIGN.md or map the elements to the existing roles. | `site.css:74-75, 80-85, 95, 183-199` | typeset |
| 5 | P3 | Light-only favicon: `favicon.png` (32px RGB, opaque `#FBF8F6` square) has no dark version, so dark browser tabs show a light tile. `apple-touch-icon.png` is opaque too, and that is correct for iOS. | `apps/site/public/favicon.png`, all page heads | polish |
| 6 | P3 | The header icon tile is different in each mode. `icon-web.webp` has a `#FCF8F7` tile that disappears on canvas `#FAF7F5`, so light mode shows only the glyph and the gap to "Deseo" looks wider. `icon-web-dark.webp` has a visible `#26222C` tile, which is not a token (dark surface is `#221D2D`). | `brand/icon-web*.webp`, `.brand` | polish |
| 7 | P3 | The preview crops cut through content. The calendar preview ends in the middle of the "Sunday market" card. The memories preview ends in the middle of the October photo. The wide preview cuts the last "Pick up flowers for dinner" task card at its bottom edge. The source images are fixed-height viewport captures (390x960 at 2x, 1440x1100). | `apps/site/public/images/*`, `apps/web/tests/capture/previews.spec.ts` | polish |

## False positives

None. The detector reported nothing.

## Visible defects from screenshots

- **Home, 390/768 light and 390 dark: preview boxes are empty.** At 390 light, the calendar, wide, and memories boxes show only the surface and border. At 390 dark, the wide and memories boxes are empty. At 768, the wide box is empty. **Capture effect, not a site defect:** these images use `loading="lazy"`, and the full-page shot does not scroll, so they never loaded. The `width`/`height` attributes kept the right box size (no layout shift).
- **Home, all widths: header "Support" is 12px inside the right edge** (finding 2). At 1440, the text ends at x≈1236 while the previews and panels end at x≈1248.
- **Home, 1440/1024 light: last task card cut at the bottom of the wide preview** (finding 7).
- **Home, preview content (apps/web, not site CSS):** in the phone Today preview, the top bar wraps "Alex / + Sam" onto two lines even though there is room. Under the pinned note, a thin edge of a cut message bubble shows (also in the wide preview, as a teal strip under "FROM SAM"). These come from the portal at capture time. I did not check the cause in this area.
- **All screens, dark 390/1440:** the surfaces are correct (canvas, surface, rose-soft, note, shared-soft all switch). The previews swap to dark versions, and the dark image edges (`#221D2D`) match the dark surface. The only dark defect I found is the favicon (finding 5), and it does not show in the captures.
- **No horizontal scroll** at any width: each capture's width equals its viewport width (390, 768, 1024, 1440). No text clipped or overlapping. Long headings wrap with `text-wrap: balance`.
- **Touch targets:** `.brand`, header nav, footer links, and `.go` links all have `min-height: var(--nav-target)` (48px). The inline links in sentences ("privacy page", "pairing help") are inline text, so the rule does not apply to them.
- **Short pages** (privacy, terms, 404): the footer stays at the bottom, as DESIGN.md says. Spacing is even.
- **Invite and support, all widths:** no defects. The 720px column keeps the left edge of the header.

## Skipped steps

- **Browser overlay (live detector on the page):** skipped. No local backend or live page in this container, and the overrides forbid starting servers.
- **Seeing the lazy-loaded previews at 390/768:** not possible. They did not render in the captures, so finding 1 comes from the code and the image size.
