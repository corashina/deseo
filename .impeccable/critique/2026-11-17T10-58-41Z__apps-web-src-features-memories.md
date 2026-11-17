---
target: Memories
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/user/deseo/apps/web/src/features/memories"
timestamp: 2026-11-17T10-58-41Z
slug: apps-web-src-features-memories
---
Method: dual-agent (A: A-memories · B: B-memories)

# Critique: Memories (rescore, 2026-11-17)

Evidence: design-capture run on master a9c61d0, 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 28/40, 70%.** Baseline: 24/40. P0: 0 · P1: 1 · P2: 3 · P3: 1 (Assessment A).

P1 findings, all fixed in PR #35:

- Photos lock after publish, but the add form does not say so.

P2 and P3 findings stay open for a later pass. Assessment B lists the detector results and visible defects. Questions are in Assessment A.

## Assessment A: design review


## Design specificity verdict

**Partly authored.** The feed is Deseo's: month headings, `shared-soft` reserved 3:2 covers, and owner-colored partner badges beside the date. The detail and form screens are category-interchangeable. Detail is a generic CRUD record: an eyebrow, a date title, one large image, a text link, and the caption last. The add form is a stock file input, a date field, and a textarea. Nothing on those two screens says "two people keeping a moment".

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Step text ("Uploading photo 2 of 3…") is good, but it is one line, not per photo. No success message after save or delete. |
| 2 | Match with real world | 3 | "Reserving photo space…" is system language. "Add memory" becomes "Publish memory". |
| 3 | User control and freedom | 3 | Cancel, unsaved warning, and delete confirmation exist. Photos cannot change after publish; only delete and redo. |
| 4 | Consistency and standards | 3 | Card title is the caption; detail title is the date. Empty-state action is a link; header action is a button. |
| 5 | Error prevention | 3 | 5-photo cap and conflict checks are good. Publish is enabled with zero photos and fails on submit. |
| 6 | Recognition over recall | 3 | Actions are visible. Photo numbers appear only in "Download photo N" link text. |
| 7 | Flexibility and efficiency | 2 | No drag-and-drop or paste. One-at-a-time download. No month jump; only "Load older memories". |
| 8 | Aesthetic and minimalist | 3 | Clean. On detail, a download link sits between photo and caption. Empty photo area is two text lines. |
| 9 | Error recovery | 3 | Retry photo, Retry save with draft kept, and conflict reload are good. A raw Storage error can show at form level. |
| 10 | Help and documentation | 2 | Hints exist. The photo-lock rule shows only on Edit, after the user can act on it. |
| **Total** | | **28/40** | **Good** (70%) |

## Cognitive load

- Failures: **1 of 8**, **Grouping**. In `PhotoSelection`, "No photos selected." (16px, ink) sits between the picker and its hint "Choose one to five photos." (14px, muted). The status separates the control from its rule.
- Decision points over 4 options: none. Detail has Edit, Download, Return, and Delete, which is 4 and still acceptable.
- Load: low.

## Emotional journey

- **Peak:** Opening a memory. The full-width photo in a `shared-soft` box loads without a layout jump.
- **Valley 1:** Publishing. One text line steps through "Reserving photo space…" to "Publishing memory…" while the thumbnails stay still. A moment of care feels like a file transfer.
- **Valley 2:** Opening Edit to add a forgotten photo and reading "Photos stay as published."
- **Reassurance:** The delete dialog does this well: "Both partners will lose this memory and its photos." It names the shared consequence.

## What's working

1. **Reserved 3:2 cover on `shared-soft`** (`memories.css` `.memory-cover::before`).
2. **Owner badge plus date plus photo count** in the card meta follows the Name Beside Color rule. Very long names wrap inside the badge without breaking the card.
3. **Draft-safe failure paths.** A conflict keeps the draft and offers "Reload memory and discard draft". "Retry save" reuses command IDs, so a retry cannot create a duplicate.

## Priority issues

1. **[P1] Photos lock after publish, but the add form does not say so.**
   Where: `MemoryFormPage.tsx` / `PhotoSelection.tsx`, `/memories/new`, all widths.
   Why: A partner who forgets a photo learns the rule only on Edit. The only fix is to delete and redo. This will cause support questions.
   Fix: Change the hint to "Choose one to five photos. You cannot change photos after you publish." Put it directly under the "Photos" label, before the status line.
   Command: **clarify**.

2. **[P2] Upload progress and failure are not shown on the affected photo.**
   Where: `commands.ts` `publishMemory`, `PhotoSelection.tsx`, `/memories/new`.
   Why: DESIGN.md requires "progress, failure, and Retry on the affected image" ("Photo upload failed. Retry"). Now one line holds all progress, and a Storage error is re-thrown raw (`throw error`) at form level.
   Fix: Mark each preview tile with its state: waiting, uploading, done, or "Photo upload failed. Retry". Map Storage errors to `AppError` with plain text. Change "Reserving photo space…" to "Preparing memory…".
   Command: **harden**.

3. **[P2] On detail, the caption falls below the first viewport, under a download link.**
   Where: `MemoryDetailPage.tsx`, `memories.css` `.memory-photo { max-height: 80vh }`, `/memories/:id` at 1024 and 1440.
   Why: At 1440 the photo is about 710px high, so the caption starts near y=1070, below the 900px window. With five photos it is screens away. The caption names the memory on the card; here it reads as an afterthought.
   Fix: Keep the caption under the photos, as DESIGN.md requires. Lower `.memory-photo` max-height to about 64vh so the first photo and the caption share the first viewport. Move "Download photo N" to the right edge of the figcaption row, or into a small row below the caption. When there is one photo, label it "Download photo".
   Command: **layout**.

4. **[P2] The add form gives the photo no visual space.**
   Where: `PhotoSelection.tsx`, `/memories/new`, all widths.
   Why: Photos are the core of a memory, but the empty state is an outlined button and a sentence. Edit shows 3:2 tiles, so add and edit look unrelated. Publish is enabled with zero photos.
   Fix: When no photo is selected, show one reserved 3:2 `shared-soft` tile that holds the "Choose photos" control. Selected previews then fill the same grid. Disable Publish until at least one photo is selected, and keep the hint visible.
   Command: **layout**.

5. **[P3] The delete dialog has only "Confirm deletion" and an icon X.**
   Where: `MemoryDetailPage.tsx` dialog.
   Why: Other destructive flows pair the destructive button with a visible safe choice. Here the X is the only way out.
   Fix: Add a secondary "Keep memory" button before "Confirm deletion".
   Command: **clarify**.

## Persona red flags

- **Casey (distracted mobile):** On a slow upload there is no per-photo progress to show how far it got after an app switch. A reload loses the draft and photos.
- **Riley (stress tester):** Zero-photo publish fails only after submit. A Storage error can show raw text. With five photos, caption and Delete are far down. At 768 the long name badge wraps to two lines, so cards in a row differ in height.
- **Jordan (first-timer):** "Add memory" changes to "Publish memory", which suggests an audience beyond the pair. No message confirms success after publish or delete. The photo-lock rule appears only after the fact.
- **The keeper (PRODUCT.md: a partner who "keeps personal photos"):** On detail, the date is the large title and their own words are small body text at the bottom. The keeper sees a record, not a keepsake.

## Minor observations

- `MemoriesPage.tsx`: The empty state uses a plain text link "Add memory" that repeats the header's primary button. Use one action.
- `MemoryCard.tsx`: "· 1 photo" appears on every single-photo card. Consider showing the count only when it is more than 1.
- `memories.css`: `.memory-card-link:hover` changes only the h3 color. The cover gives no hover response, so on desktop the image does not look clickable.
- `title.ts`: The fallback "Our memory" shows the same title on every card without a caption. Consider the date instead.

## Bolder move proposals

1. **Colorize: owner accent edge on the cover.** Add a 4px `rose-accent` or `teal-accent` bottom edge (decorative marks only) on each feed cover, matched to the author badge. This lets you scan who added what across a month. The badge keeps the name, so the Name Beside Color rule holds. Screen: `/memories`.
2. **Bolder: caption-led detail header.** For a captioned memory, show the caption as the headline-style title. Show the date as the eyebrow plus a badge. This matches the card, where the caption is the title. It needs a change to the DESIGN.md rule "uses the date as its title", which the owner decides. Screen: `/memories/:id`.

## Questions to consider

1. If photos can never change after publish, should the form show a review step ("These 3 photos, this date") before the irreversible step?
2. Why does the feed use the same grid for a memory with one photo and one with five? Should a five-photo memory show more of itself?
3. Should DESIGN.md's 1500px threshold for three columns stay? At 1440, the first viewport shows only two memories.


## Assessment B: detector and rendered evidence


## Detector counts

**Source scan** (`impeccable detect --json apps/web/src/features/memories`): exit 0, `[]`. **0 findings.**

**Rendered scan** (`--cdp`, 1440px light):

| Screen | Findings |
|---|---|
| memories (feed) | 0 |
| memories-new | 0 |
| memories-memoryId-edit | 0 |
| memories-memoryId (detail) | 1: `kicker-above-heading`, `span.eyebrow` ("Memory" above h1 "November 1, 2026") |

**Total: source 0, rendered 1 (kicker-above-heading x1).**

## Verified findings

No detector finding is real. These issues come from the code and the screenshots:

| # | Severity | Issue | File | Command |
|---|---|---|---|---|
| 1 | P3 | `.photo-picker { font-size: 16px }` overrides the button token (15px / 600). "Choose photos" renders larger than "Publish memory" on the same form. | `apps/web/src/styles/memories.css:35` | polish |
| 2 | P3 | The memory card title is 16px / 600 / 1.5. No DESIGN.md role has this value: body is 400, and title is 19px / 700 / 1.3. Add a token or use an existing role. | `apps/web/src/styles/memories.css:16` | typeset |
| 3 | P2 | The empty-state "Add memory" link sits in `section.card`. The 48px target rule (`base.css:32`) does not cover `.card > a`, so the target is about 24px high. This is not in the screenshots because the seed data has memories. | `apps/web/src/features/memories/pages/MemoriesPage.tsx` (empty-state branch) | harden |
| 4 | P3 | The photo hint "Choose one to five photos." is not inside `.field`. The status line "No photos selected." (16px ink) sits between the control and the hint. Other fields put the hint directly under the control with an 8px gap. | `apps/web/src/features/memories/components/PhotoSelection.tsx` | layout |
| 5 | P3 | Cancel is a bare text link on the add and edit forms. DESIGN.md (Buttons) says to use the secondary button for Cancel. | `apps/web/src/features/memories/pages/MemoryFormPage.tsx` (`.actions`) | polish |

## False positives

- **kicker-above-heading** (detail, `span.eyebrow`): DESIGN.md defines "Eyebrow above a title (eyebrow) 12px / 700, uppercase" in the hierarchy table. `.impeccable/config.json` now ignores this rule for `apps/web/src/**`, with the reason "DESIGN.md page headers put the eyebrow (date or record type) above the title". That ignore was added on 2026-11-17 10:49, after the capture on 2026-11-16 21:16. The rendered result also reports a URL, not a source path, so the file glob may not suppress it on a re-run.

## Visible defects from screenshots

All 24 screenshots checked: 4 screens, 390/768/1024/1440 light, 390/1440 dark. There is no horizontal scroll, clipped control, overlap, or broken dark surface. The sidebar ends at 900px in the tall detail shots. It is `position: fixed` (`shell.css:2`), so this is a capture effect.

| Screen | Width / theme | Defect | Cause |
|---|---|---|---|
| Feed | 768 light | The long author badge wraps to two lines and becomes a full-width rectangle under the title. The date line in the right card sits 17px lower than in the left card. | `.memory-meta` flex-wrap plus `.partner-badge` `overflow-wrap: anywhere` (`memories.css:17`, `controls.css:44`). The card copy does not pin the meta row to the bottom. |
| Feed | 768 light | Unequal empty space at the bottom of sibling cards. Grid stretch makes the cards equal height, but the copy block does not distribute the space. | `.memory-grid` default stretch, `.memory-card-copy` is block (`memories.css:1,14`) |
| Add memory | all widths | "Choose photos" text is visibly larger than the other button labels. | Finding 1 |
| Add memory | all widths | The vertical rhythm under the picker is uneven: control, then about 20px, then the status line, then 16px, then the hint, then 20px, then the next label. The hint reads as detached from its control. | Finding 4. The status `p` uses the default margin. |
| Detail | 1440 light/dark | No defect. The photo box caps at 80vh as specified. "Download photo 1" lines up with the caption edge (`padding-inline: 0`, `memories.css:29`). | — |
| Edit | all widths | No defect. Published thumbnails use a 3-column grid (2 columns under 768px). | — |
| Dark (390/1440, all screens) | dark | No defect. Surfaces, badges, the primary button, links, and the native date icon all switch correctly. | — |

**Token check (`memories.css` against DESIGN.md frontmatter and `brand/tokens.json`):**
- Spacing uses only `--space-*` tokens.
- Radii use only `--radius-card` and `--radius-control`.
- Colors use only token variables.
- Card padding is 24px on desktop and 20px on mobile. Grid gaps are 24px and 16px. Both match DESIGN.md.
- Meta text is 14px, which matches body-small.
- Drift is limited to findings 1 and 2.
- `min-height: 104px` and `180px` are layout sizes, not tokens. They are acceptable.

## Skipped steps

- **Browser overlay (live detector in the page):** skipped. There is no local backend in this container, and the brief forbids starting servers, so there is no live page.
- **Touch-target check on hidden states:** done from the code only. These states are not in the captures: "Remove photo N" buttons (full-width `.button`, 48px), "Retry photo", and "Load older memories" (`.button`, 48px). Only the empty-state link (finding 3) fails.
