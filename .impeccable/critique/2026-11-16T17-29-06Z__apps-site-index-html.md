---
target: Public site
total_score: 25
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/deseo/apps/site/index.html"
target_fingerprint: "sha256:40855d4030edec058e3032b7ab121a689ac672cfcb75bd8065f55d639ef71363"
target_path: /home/user/deseo/apps/site/index.html
timestamp: 2026-11-16T17-29-06Z
slug: apps-site-index-html
---
Method: dual-agent (A: A-site · B: B-site)

# Critique: Public site (baseline, 2026-11-16)

Evidence: design-capture run 43916736848 (master 0eb7250 plus dark captures), 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 25/36, 69% (Acceptable, just under Good).** Heuristic 7 is n/a (static Persuade pages have no repeat workflows). P0: 0 · P1: 3 · P2: 7 · P3: 7.

The copy is honest and specific to Deseo. The layout is a generic product page, and The Shared Notebook look appears only inside the screenshots. The detector found 18 source issues and 3 rendered issues. 14 of the source issues (`design-system-color`) and the radius finding are real token drift. The 3 `tight-leading` findings are false positives: headings use the 1.2 line height that DESIGN.md sets. The 3 rendered `straggler` findings are real.

| Sev | Finding | Where | Command | Source |
|---|---|---|---|---|
| P1 | Preview images are design studies: "DESIGN REFERENCE", color legends, other products' names (Cupla, Couply), and a 5-tab bar with Messages that no longer ships | public/images/today, calendar, messages, desktop .webp | polish | A+B |
| P1 | Dark palette is out of date: 13 of 16 dark variables differ from the Midnight tokens | src/site.css dark block | harden | A+B |
| P1 | The hero has no action; "Download for iOS / Android" looks like a call to action but is plain text | index.html `.soon` | clarify | A |
| P2 | Previews are light-only and opaque, so they glare on the dark canvas; the icon has a baked light square | public/images, index.html | adapt | A+B |
| P2 | System font instead of Manrope; heading sizes off the type scale (28/32/20/18/22px) | src/site.css | typeset | A+B |
| P2 | /invite/ has no reassurance (private events, either person can end the pair) and no product glimpse | invite/index.html | onboard | A |
| P2 | `main` bottom padding is overridden, so the last content touches the footer on every page | src/site.css `.wrap` vs `main` | layout | B |
| P2 | Phone previews are about 1.2x density and look soft on phones | public/images | optimize | B |
| P2 | No dark `theme-color`, so the mobile browser bar stays light | all 6 HTML pages | adapt | B |
| P2 | Standalone links on privacy, terms, and 404 are about 24px tall | privacy, terms, 404 | harden | B |
| P3 | Narrow pages: 720px column does not line up with the 1120px header and footer | src/site.css `.wrap.narrow` | layout | B |
| P3 | Large empty space beside phone previews; previews do not share a right edge | index.html, site.css `.preview` | layout | A+B |
| P3 | Footer sits mid-screen on short pages | privacy, terms, 404 | layout | A+B |
| P3 | Stragglers on 3 paragraphs; no `text-wrap: pretty` | site.css `p` | typeset | B |
| P3 | Off-token radius 28px and spacing 48/64px | site.css | polish | B |
| P3 | Copy: h1 and lede repeat "Plan your days"; "share a note" against the glossary; 5 footer links; "12-character" breaks at the hyphen | index.html, invite | clarify | A+B |
| P3 | Support questions sit closer to the previous answer than to their own | support/index.html, site.css | layout | B |

**Bolder moves (owner decides):** show the release status as a Note Peach pinned note (colorize); show names beside colors on the page itself, such as rose "Alex", mint "Sam", lilac "Together" marks on feature headings (colorize).

**Claims check:** the JSON-LD lists "iOS, Android" for an app that is not available yet. Check this against the no-claims rule.

## Assessment A: design review


## Design specificity verdict
**The layout could belong to any app in the category. The copy is specific to Deseo.** The copy is honest and product-specific: "A message shows Sent only after Deseo saves it", "Either person can end the pair", "no ads, public feeds, streaks, or relationship scores". The structure is the generic product page that mode-persuade.md warns against:
- a split hero (headline on the left, phone on the right),
- three zig-zag rows of text and a phone image,
- a tinted callout,
- an FAQ card.

The Shared Notebook look shows up only inside the screenshots. The site itself has no Manrope font, no Note Peach note card, and no partner colors shown with names. It does not use the Name Beside Color rule. Swap the logo and the images and this is any couples app.

## Heuristic scores
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | "Coming soon", "Preview" and the footer state the release status honestly. The header "Support" link has no current-page state on /support/. |
| 2 | Match with real world | 3 | Plain words. The lede's "share a note" conflicts with the glossary, where a note is a pinned message. |
| 3 | User control and freedom | 3 | Brand link, footer and 404 all return home. Privacy leads to Support, which says "no support contact yet": a dead end. |
| 4 | Consistency and standards | 2 | The site uses the system font, not Manrope. The dark palette differs from the Midnight tokens. Heading sizes are off the token scale. The previews show UI the product rules do not describe. |
| 5 | Error prevention | 3 | The invite page warns that the store does not pass the invitation on, and that invitations expire after 24 hours. |
| 6 | Recognition rather than recall | 3 | Labeled links everywhere. The invite flow makes users remember the original link across an app install. |
| 7 | Flexibility and efficiency | n/a | Static Persuade pages have no repeat workflows. |
| 8 | Aesthetic and minimalist design | 2 | Design-study notes are visible in the previews. The "two people per pair" claim appears three times on home. Large empty gaps at 1440. Light screenshots sit on the dark canvas. |
| 9 | Error recovery | 3 | The 404 page and "Invitation does not work?" both give a plain cause and a next step. |
| 10 | Help and documentation | 3 | Support is task-focused and linked from the invite page. It has no contact yet. |
| **Total** | | **25/36 (69%)** | **Acceptable** (just under Good) |

## Cognitive load
Two checklist items fail, so cognitive load is **moderate**.
- **Visual hierarchy fails.** The home hero has no primary action. The boldest item after the headline is the heading "Download for iOS / Android", which is not a link.
- **Working memory fails.** /invite/ asks the visitor to install an app, then "open the original invitation link again". The link must survive a trip through an app store. This is partly part of the task itself, but the page does nothing to help.
- **More than 4 options:** the footer has 5 links on every page. "Home" duplicates the brand link; remove it to get 4.

## Emotional journey
- **Peak:** the hero preview. "Coffee with Maya", "Dinner at our favorite place", and rose, mint and lilac owner rows make the offer warm in one glance.
- **Valley:** the next block after the hook is "Download for iOS / Android", then "not in the App Store or Google Play yet". The first thing that looks like an action says no.
- **Reassurance is late and in the wrong place.** The privacy panel is the strongest trust moment: private events stay private, either person can end the pair, no scores. It sits fifth on home, and it is missing from /invite/. Accepting an invitation to a private space is the high-stakes moment, and that page says nothing about what the partner can see or how to leave.

## What's working
1. **Honest status copy everywhere.** Each preview has a "Preview" badge and a "sample content" caption. The footer gives the release status. The privacy and terms pages say plainly that the policies are not published yet. Nothing claims more than the project can prove.
2. **The /invite/ steps are good.** There are four numbered steps. It explains clearly that the store does not pass the invitation on. "This page does not read or check your invitation" prevents a real confusion.
3. **The reflow is solid.** Hero and feature rows collapse to one column cleanly at 390 and 768. Footer links are 48px high. Headings wrap with `overflow-wrap: anywhere`.

## Priority issues
1. **[P1] Preview images are design studies, not the product.**
   - **Where:** `public/images/today.webp`, `calendar.webp`, `messages.webp`, `desktop.webp`; home at all widths.
   - **Why:** Each image carries a "DESIGN REFERENCE · Sample content · No data saved" strip and colour legends such as "Lavender · Actions" and "Rose · Alex". messages.webp prints "Deseo / Cupla structure + Couply warmth · Light theme · Original design study · 04.10.2026", which names other apps. The phone previews show a five-tab bar with Messages, but DESIGN.md says there are four destinations and Today holds the conversation. Showing UI that does not ship is itself a product claim.
   - **Fix:** Recapture from the real app with the sample pair. Remove the study strip, legends and notes.
   - **Command:** polish
2. **[P1] The hero has no action, and its heading reads like a dead call to action.**
   - **Where:** `index.html` `.soon`; home at 390 and 1440.
   - **Why:** In Persuade mode the opening needs one visible primary action. "Download for iOS / Android" is styled like one but is plain text.
   - **Fix:**
     - Change the heading to the state, for example "Not in app stores yet".
     - Add one real link for the second audience: "Have an invitation? See how to join" → /invite/. This makes no new claim.
   - **Command:** clarify
3. **[P1] Dark mode does not follow the Midnight palette.**
   - **Where:** `src/site.css` dark block; `icon.webp`; all `*-dark` shots.
   - **Why:**
     - Several dark values in site.css differ from brand/tokens.json:
       - canvas #1C1A22 (token #14111B),
       - surface #25222D (token #221D2D),
       - note #3A2F25 (token #2E2620),
       - link #C9B8EA (token #C9B5F7).
     - icon.webp is RGB with a light background, so it shows as a white chip in the dark header.
     - The light screenshots sit as bright white blocks on the dark canvas.
   - **Fix:**
     - Copy the dark tokens exactly.
     - Use an icon with transparency or a tile that matches the dark palette.
     - Add `<picture><source media="(prefers-color-scheme: dark)">` with Midnight captures. This is static HTML and needs no JavaScript.
   - **Command:** colorize
4. **[P2] /invite/ has no reassurance and no product glimpse.**
   - **Where:** `invite/index.html`, all widths.
   - **Why:** The invited partner decides here whether to join a private space, and the page has nothing on control or privacy.
   - **Fix:**
     - Add two lines already published on home: "Private events stay with their author" and "Either person can end the pair".
     - Add one Today preview or a link to home.
   - **Command:** onboard
5. **[P2] Type does not follow the system.**
   - **Where:** `src/site.css`.
   - **Why:** The body uses the system font stack, so the captures render in DejaVu, which looks wide and generic. DESIGN.md requires Manrope in the browser. Several sizes and margins are not tokens:
     - h2 28/32px (headline is 30/40),
     - h3 20px, `.faq h3` 18px, `.lede` 20px,
     - margins of 48 and 64px.
   - **Fix:** Self-host one subset Manrope woff2 with preload and `font-display: swap`; Lighthouse 100 is still reachable. Map heading sizes to the display, headline and title tokens. If the 64px section rhythm is needed, add it as a token in brand/tokens.json and DESIGN.md in the same change.
   - **Command:** typeset

## Persona red flags
- **Jordan (first-timer):** looks for the download button under "Download for iOS / Android" and finds none. There is no way to hear about launch. Privacy says "not published" and links to Support, which says "no support contact yet". Jordan ends at a dead end.
- **Casey (mobile, 390):** the first screen is the headline and the coming-soon block, with nothing to tap. The "Keep your moments" image is a 1265px desktop capture shrunk to about 358px, and its text is unreadable. If Casey is interrupted between installing and reopening the invitation, the invitation is lost.
- **Riley (stress tester):** finds "No data saved", "Cupla" and "Couply" in the previews. Sees the same pair rule in the privacy panel, the FAQ and the support page. "Already have Deseo?" appears on /invite/ before any release.
- **Invited partner (from PRODUCT.md Users):** arrives from a partner link and reads "Someone invited you to join their pair". The page cannot say who or what that partner will see, and it does not say they can end the pair alone.

## Minor observations
- `index.html`: the h1 "Plan your days together." and the lede "Plan your days, share a note…" repeat the same opening words.
- `index.html`: "Keep your moments" shows the large-screen Today layout, not a memory card with photo, caption, author and date.
- `index.html` at 1440: short text blocks are vertically centred against 865px phone images, which leaves about 300px of empty space around each block.
- `index.html` privacy panel: the link text "not published yet" is a state, not a destination.
- `privacy/`, `terms/`, `404.html` at 1440: `main` has no minimum height, so the footer sits in the middle of the window over a large empty canvas.
- `index.html` footer at 390: "Terms" wraps onto its own line.
- `src/site.css`: the dark `.panel.rose` reads as a muddy maroon close to a warning colour.
- `index.html` JSON-LD: `MobileApplication` lists "iOS, Android" for an app that is not available yet. Check this against the no-claims rule.

## Bolder move proposals
1. **Make the status a pinned note** (colorize, home hero). Restyle `.soon` as the DESIGN.md note card: Note Peach fill, `note-line` border, and a small "Pinned" label. /invite/ already uses this panel. The reason: the release status becomes a piece of the Shared Notebook, not a generic SaaS callout.
2. **Show names beside colours on the page itself** (colorize, home feature rows). Give each feature heading a decorative mark with a name label: rose "Alex", mint "Sam", lilac "Together", as the previews do. The reason: the site would show the Name Beside Color rule itself instead of leaving it to the screenshots.

## Questions to consider
- With no download and no sign-up, what is the one thing home wants a visitor to do? Should the page say it?
- Is a less polished capture of the real app better than a design study that shows UI the product does not have?
- Should /invite/ speak more in the inviting partner's voice ("your partner made this link") than in Deseo's?

All files are under /home/user/deseo/apps/site.
## Assessment B: detector and rendered evidence


### Detector counts

**Source scan** (`impeccable detect --json` on the 6 pages, exit 2): 18 findings.
- `tight-leading` ×3: index.html, invite/index.html, support/index.html (the `line-height 1.20x` is the h1/h2 rule, site.css:63)
- `design-system-color` ×14:
  - `rgb(201,184,234)` = #C9B8EA, the `--link` value in the dark block. Found on all 6 pages, on "Skip to content".
  - `rgb(180,170,189)` = #B4AABD, the `--muted` value in the dark block. Found on all 6 pages, on `.lede`.
  - `rgb(58,47,37)` = #3A2F25, the `--note` value in the dark block. Found on invite (panel) and support (note panel).
- `design-system-radius` ×1: index.html, `.preview img` 28px (site.css:153)

**Rendered scan** (1440 light): 3 findings, all `straggler` (advisory).
- home `p.lede` ("remember.")
- home `p:nth-of-type(4)` (FAQ "hours.")
- support `section:nth-of-type(1) > p:nth-of-type(2)` ("one.")
- invite, privacy, terms, 404: no findings.

### Verified findings

1. **The dark palette does not match the tokens** (P1, harden). 13 of 16 dark variables in site.css:26-45 differ from `brand/tokens.json` darkColors and the DESIGN.md `-dark` keys:
   - canvas: #1C1A22, but the token is #14111B
   - surface: #25222D, but the token is #221D2D
   - muted: #B4AABD, but the token is #A79EB4
   - link: #C9B8EA, but the token is #C9B5F7
   - focus: #B9A3E0, but the token is #C9B5F7
   - note: #3A2F25, but the token is #2E2620
   - ink, line, action, sidebar, rose-soft, teal-soft and shared-soft also differ.

   Only on-action, action-border and note-line match. The light block matches all 16 tokens. DESIGN.md says site.css "copies the shared colors", so the dark copy is out of date. The 14 detector color findings are 3 symptoms of this one problem.
2. **The font is not the token font** (P2, typeset). site.css:56 uses `system-ui`. DESIGN.md frontmatter and §Typography say Manrope Variable in the browser.
3. **Heading sizes are not on the type scale** (P2, typeset). These sizes have no token:
   - h2 28/32px at weight 700. The headline token is 40/30px at 800.
   - h3 20px, and `.faq h3` 18px. The title token is 19px.
   - `.lede` 20px and `.brand` 22px.
4. **Radius 28px is not a token** (P3, polish). `.preview img` (site.css:153). The rounded scale is 8/12/20/9999.
5. **Spacing is off the scale** (P3, polish). `.feature`/`.panel` `margin-top: 64px`, and 48px gaps. The spacing scale stops at 40. `.panel` padding is 20/32px, but the card token is 24px.
6. **Stragglers** (P3, typeset). All 3 are real and you can see them in the screenshots. `p` has no `text-wrap: pretty`.

### False positives

- **`tight-leading` ×3:** the 1.2 line height is on h1/h2. DESIGN.md display and headline use 1.2 (headline uses 1.1). Body text is 1.5.

### Visible defects from screenshots

1. **The last content touches the footer** (P2, layout). All pages, all widths, light and dark. Cause: `main { padding-bottom: 48px }` (site.css:113) is overridden by `.wrap { padding: 0 var(--gutter) }` (site.css:85), which has higher specificity. So main has 0 bottom padding.
   - Home: the "Questions" panel border sits on the footer rule at 390 and 1440.
   - Other pages: the last paragraph is about 20px above the rule.
2. **Design-study text in the preview images** (P1, distill). Home, all widths. today, calendar, messages and desktop .webp show this text:
   - "DESIGN REFERENCE · Sample content · No data saved"
   - colour legends ("Lavender · Actions, Rose · Alex…")
   - "Deseo / Cupla structure + Couply warmth" and "Light theme · Original design study · 04.10.2026" (messages, desktop)

   Cupla and Couply are names of other products.
3. **The preview images are light-only** (P2, adapt). Home, 390 and 1440 dark. All images are opaque RGB light-mode captures with no `<picture>`/dark source, so they show as bright white blocks on the dark canvas.
4. **The icon has a baked background** (P3, adapt). Header on all pages. `icon.webp` is opaque with a #FBF9F7 square. In dark mode it shows as a light tile, and in light mode the tile edges are invisible.
5. **The phone previews are low resolution** (P2, optimize). `today.webp` and `calendar.webp` are 358px wide and `messages.webp` is 390px. All show at 300 CSS px, which is about 1.2x density, so they are soft on 2x and 3x screens. `desktop.webp` (1265w at 512px) is fine.
6. **No dark `theme-color`** (P2, adapt). All 7 HTML files (the 6 pages and dist) have only `<meta name="theme-color" content="#FAF7F5">`. In dark mode, the mobile browser bar stays light. You cannot see this in the captures; I confirmed it in the code.
7. **The page column does not line up with the header and footer** (P3, layout). The `.narrow` pages (invite, support, privacy, terms, 404) at 768 and above. `.wrap.narrow` (site.css:86) centres a 720px column, but the header and footer use the 1120px wrap.
   - At 1440: the h1 starts at x=392 and the brand starts at x=192.
   - At 768: there is a 24px step.
8. **The preview images do not line up** (P3, layout). Home at 1024 and 1440. The hero figure sits on the right edge (grid `1fr auto`). The feature figures are centred in a `1fr` column (`.preview.phone img { margin: 0 auto }`, site.css:155). Their right edges are 1247 and 1145 at 1440.
9. **Large empty space beside the phones** (P3, layout). Home, 768 to 1440. The feature text is vertically centred beside images about 725px tall. This leaves gaps of about 250px above and below the text.
10. **Support questions are not grouped with their answers** (P3, layout). Support, all widths. h3 has no top margin in `.page`, so the gaps are:
    - h2 to h3: 12px
    - h3 to answer: 12px
    - answer to next question: 16px

    Only `.faq h3` (home) gets `margin-top: 24px`.
11. **Standalone links are under 48px** (P2, harden). Privacy, terms, 404. "Go to support" and "Go to the home page" are plain inline `<a>` in a `<p>`, about 24px tall. Header, footer and brand links are 48px.
12. **"12-character" breaks at the hyphen** (P3, polish). Invite at 768 and 1440, and the home FAQ at 390. The fix is a non-breaking hyphen (U+2011).
13. **Footer sits mid-screen on short pages** (P3, layout). Privacy, terms, 404 at all widths. The body has no min-height layout, so the lower half of the viewport is empty canvas below the footer.

I saw no horizontal scroll, no clipped text and no overlap at any width. In dark mode, all surfaces and text can be read (apart from the light-only images). The sticky/fixed caveat does not apply: the site has no sticky or fixed parts. `.skip` is absolute and off-screen.

### Images in apps/site/public

| File | Format | Size | Alpha | Note |
|---|---|---|---|---|
| favicon.png | PNG | 32×32 | none | light background |
| apple-touch-icon.png | PNG | 180×180 | none | correct for iOS |
| images/icon.webp | WebP | 96×96 | none | light square, shows at 40px |
| images/today.webp | WebP | 358×865 | none | light UI, 1.2x |
| images/calendar.webp | WebP | 358×865 | none | light UI, 1.2x |
| images/messages.webp | WebP | 390×900 | none | light UI, 1.3x |
| images/desktop.webp | WebP | 1265×1220 | none | light UI |
| images/desktop-640.webp | WebP | 640×617 | none | light UI |
| images/og.png | PNG | 1200×630, 72 KB | none | correct |

None of the images has transparency, and none has a dark variant.

### Skipped steps

- **Browser overlay:** skipped. There is no local backend and no live page in this container, and the brief does not allow starting servers.
- **Live dark-mode detector run:** not available. The rendered `.detect.json` files are 1440 light only. I checked dark mode only from the screenshots and the CSS.

The working files are cropped home screenshots in `/tmp/claude-0/-home-user/a1136e82-3529-5ad9-805a-aba66d8eeeb4/scratchpad/bsite/`. I edited no repo files.
