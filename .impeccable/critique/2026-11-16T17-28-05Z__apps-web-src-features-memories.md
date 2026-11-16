---
target: Memories
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/deseo/apps/web/src/features/memories"
timestamp: 2026-11-16T17-28-05Z
slug: apps-web-src-features-memories
---
Method: dual-agent (A: A-memories · B: B-memories)

# Critique: Memories (baseline, 2026-11-16)

Evidence: design-capture run 43916736848 (master 0eb7250 plus dark captures), 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 24/40 (Acceptable).** P0: 0 · P1: 2 · P2: 4 · P3: 6.

The feed is the strongest part: covers keep their 3:2 space and the grid stays calm. The detail and form screens are generic forms that give the photo less weight than the buttons. The detector found 0 issues in source and on all 4 rendered screens. Assessment B found no token drift in memories.css. It found small spacing faults in the form and confirmed that the detail photo and its Download button do not line up.

| Sev | Finding | Where | Command | Source |
|---|---|---|---|---|
| P1 | The caption is the detail page title: up to 1000 characters of 30–40px/800 text, 5 lines at 768 and 390; it also drops line breaks | MemoryDetailPage.tsx `PageHeader title` | typeset | A+B |
| P1 | Feed card captions have no line limit, so one long caption stretches a card and its row | memories.css `.memory-card-copy h3` | harden | A |
| P2 | Detail screen: actions outweigh the photo; filled red Delete sits 24px under Download; small photo centered with Download at the right edge | MemoryDetailPage.tsx, memories.css `.memory-detail` | distill | A+B |
| P2 | No reserved image space on the detail screen, so the page jumps when photos load | memories.css `.memory-detail img` | harden | A |
| P2 | Add form puts photos last; edit form hides the photo; technical hint ("JPEG", "MiB") | MemoryFormPage.tsx, PhotoSelection.tsx | layout | A |
| P2 | Author shows as muted text with no owner color on the one personal-content screen | MemoryCard.tsx, MemoryDetailPage.tsx | colorize | A |
| P3 | Form card bottom inset 48px against 24px top; empty status paragraph adds space on edit | memories.css, base.css `.actions`, MemoryFormPage.tsx | polish | B |
| P3 | Date input text inset 6px against 16px below 768px | memories.css date rule | polish | B |
| P3 | Month heading and card caption share 19px/700, so the feed hierarchy is flat | MemoriesPage.tsx | typeset | A |
| P3 | "Load older memories" and Retry use the primary variant | MemoriesPage.tsx | polish | A |
| P3 | Fallback names differ ("Our memory", "Shared memory"); "1 photo" on its own line | MemoryCard.tsx, MemoryDetailPage.tsx | clarify | A |
| P3 | Feed loading is a text line, not cards at final size | MemoriesPage.tsx | harden | A |

**Bolder moves (owner decides):** owner badge for the author on card and detail (colorize); a small thumbnail strip under covers with several photos (delight).

**Capture effects, not defects:** faded buttons in the 390 dark shots; the tiny detail photo comes from the small test image.

## Assessment A: design review


## Design specificity verdict
The area is **half authored**. The feed has some Deseo character: pastel canvas, a lilac `shared-soft` placeholder behind each 3:2 cover, month headings, and captions kept outside the image. But the memory card is a generic image card. The author shows only as muted text, so the product's main idea ("a stable color for each partner, always shown with a name") does not appear on the one screen about shared personal content. The detail and form screens are category-default CRUD: a page title, a white card, stacked buttons, and a red Delete. Cover the logo and you could not tell this is a two-person memory book and not any photo-upload admin. DESIGN.md says "Personal screens give photos and notes more space". The detail screen does the opposite: the caption headline and the buttons get more space than the photo.

## Heuristic scores
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Good upload steps ("Uploading photo 1 of 3…"). Feed loading is a text line only, and the detail image has no reserved space while it loads. |
| 2 | Match with real world | 3 | System words leak into the UI: "MiB", "JPEG copies", "Reserving photo space…", "Publishing memory…". |
| 3 | User control and freedom | 2 | After a memory is published, its photos cannot be changed. To fix a wrong photo, the user must delete the whole memory and add it again. Delete has no undo. |
| 4 | Consistency and standards | 3 | "Add memory" leads to a "Publish memory" button. The fallback is "Our memory" in the title but "Shared memory" in the alt text. "Load older memories" and the feed's "Retry" use the default primary variant, which gives the page a second primary button. |
| 5 | Error prevention | 3 | Delete is confirmed, edits check the version, the picker turns off at 5 photos, and the date defaults to today. The caption has no character count (max 1000). |
| 6 | Recognition rather than recall | 2 | The edit form shows no photo. Users edit a caption without seeing the photo it describes. A memory with several photos has no cue on its cover. |
| 7 | Flexibility and efficiency | 1 | No drag-and-drop, no photo reordering, no way to pick the cover photo. Downloads are one button per photo. |
| 8 | Aesthetic and minimalist design | 2 | On the detail screen, the 40px/800 caption headline and the red Delete button get more weight than the photo. |
| 9 | Error recognition and recovery | 3 | Errors use plain text, "Retry save", and the draft is kept on a conflict. "We could not prepare this photo." does not say which of the chosen files failed. |
| 10 | Help and documentation | 2 | The photo hint is the only help. The caption field does not say it is optional. |
| **Total** | | **24/40** | **Acceptable** |

## Cognitive load
- **Visual hierarchy: fail.** On the detail screen the caption, Download, and Delete all compete with the photo, and the photo is the smallest element.
- **Minimal choices: fail.** The Add memory form with 5 photos has date, caption, Choose photos, 5 × "Remove photo N", Publish, and Cancel: 10 controls. The detail screen with 5 photos has Edit, 5 × Download, Return, and Delete: 8.
- **Working memory: fail.** The edit form asks the user to remember the photo.
- **Chunking: fail (minor).** "No photos selected." and the format hint are two ink-colored body paragraphs between the picker and the Publish button.
- Result: 4 failures, which is **high** load. The add and detail flows drive it.

## Emotional journey
- **Peak:** the feed. The covers are large and calm, and the 3:2 space is reserved with a lilac fill, so the grid holds steady while photos load.
- **Valley:** the detail screen (`MemoryDetailPage.tsx`, every width). The user opens a memory to see the photo. Instead they get a five-line headline at 768 and 390, the photo, then a filled red "Delete memory" as the strongest color on the page.
- **Valley:** Add memory. Photos, the heart of a memory, come last, below the date and caption. The empty picker is a plain full-width button with technical small print.
- **Reassurance:** the delete dialog copy is good ("Both partners will lose this memory and its photos."), and focus lands on Close first. The conflict copy "This memory changed. Your draft is kept." is good.

## What's working
1. **3:2 reserved covers** (`memories.css` `.memory-cover::before`). The aspect ratio holds before load and on error, and the state panel sits in the same grid cell.
2. **Upload honesty.** The upload is staged with progress text, retries reuse their command IDs, "Retry save" appears, and the draft survives a conflict. This fits Product Principle 4.
3. **Long-name handling** in the card metadata. The date and author wrap cleanly at all four widths, with no overflow.

## Priority issues
1. **[P1] The caption is the page title on the detail screen.** Where: `MemoryDetailPage.tsx` `PageHeader title={memory.caption}`, at 390 and 768 (5 lines at 30–40px/800). Why it matters: a caption can be 1000 characters, which makes a wall of heavy display text. The `h1` also drops the line breaks that the card's `h3` keeps with `pre-wrap`, so the two views show the same caption differently. Fix: use the date as the title (e.g. "November 1, 2026") and the author as the description. Show the caption as body text (16–19px, `white-space: pre-wrap`) under the photos. Command: **typeset**.
2. **[P1] Unbounded caption on the feed cards.** Where: `memories.css` `.memory-card-copy h3` (no line limit). Why it matters: one long caption makes one card very tall and stretches its row partner, which breaks the grid. Fix: limit the card caption to 3 lines with `line-clamp` and show the full text on the detail screen. Command: **harden**.
3. **[P2] The detail screen puts actions above the photo in weight.** Where: `MemoryDetailPage.tsx` and `.memory-detail`, all widths. The photo sits small inside a padded card, each photo gets its own right-aligned "Download photo N" button, and a filled danger "Delete memory" sits 24px below Download. Fix: show photos edge to edge in the card with no inner padding. Move Download into a quiet text-button row. Move Delete into a separate zone at the end as a secondary danger button (`danger` text and border); the dialog keeps the filled danger button. Command: **distill**.
4. **[P2] No reserved image space on the detail screen.** Where: `.memory-detail img`, which uses `height: auto` while `.memory-image-state` has `min-height: 180px`. Why it matters: the page jumps when each full photo arrives, which breaks the DESIGN rule "Reserve image space before loading". Fix: set `aspect-ratio: photo.width / photo.height` on the `figure`, capped by `max-height`. Command: **harden**.
5. **[P2] The add form puts photos last and the edit form hides them.** Where: `MemoryFormPage.tsx` and `PhotoSelection.tsx`, all widths. Fix: put Photos first. Show the empty picker as reserved 3:2 tiles. Make the remove control a small icon-plus-text button on each tile, not a 48px full-width button under it. Use `field-hint` (muted) for "Choose one to five photos." and drop "JPEG/MiB" for "up to 5 MB each". On the edit form, show the cover photo read-only above the fields. Command: **layout**.

## Persona red flags
- **Riley (stress tester):** a 1000-character caption, or one with line breaks, breaks both the card height and the detail `h1`. With 5 photos the form shows five stacked "Remove photo N" buttons and the detail shows five Download buttons. "We could not prepare this photo." does not say which file failed.
- **Casey (mobile, 390):** on the detail screen, "Edit memory" sits under a 5-line headline, and the photo starts below 450px. "Download photo 1" and "Delete memory" are stacked at the same right edge, 24px apart. A confirmation dialog follows, but the layout invites the wrong tap.
- **Jordan (first-timer):** "Publish memory" after tapping "Add memory" raises the question of who it is published to. "Deseo saves JPEG copies, up to 5 MiB each" is jargon. The Caption field does not say it is optional.
- **Partner who saves photos (PRODUCT.md):** they cannot tell at a glance which partner added a memory, because the author name is muted grey with no owner color. They cannot fix a wrong photo after publishing without deleting the memory, which removes it for both partners.

## Minor observations
- `MemoriesPage.tsx`: the month heading (`h2`, 19px/700) and the card caption (`h3`, 19px/700) are the same size, which flattens the feed hierarchy. Make the month an eyebrow, or make it larger.
- `MemoriesPage.tsx`: "Load older memories" and the error "Retry" use the default `primary` variant, giving the page a second primary button. Use `secondary`.
- `MemoryCard.tsx`: "1 photo" takes its own line. Join it to the date and author line, or drop it when there is one photo.
- `MemoryCard.tsx` / `MemoryDetailPage.tsx`: the fallbacks differ ("Our memory" vs "Shared memory").
- `MemoriesPage.tsx`: the loading state is a text line, not placeholder cards at their final size (DESIGN.md "Loading: keep the final layout's dimensions").
- `base.css` `.form-page { margin: 24px auto }`: at 1440 the form card is centered 200px to the right of the left-aligned page title, so their left edges do not line up. The rule is shared, but it is visible here.
- Capture note: the 390-dark shots show washed-out buttons and card titles. This is a **capture effect**: `.button` and `.memory-card-link h3` have 140ms color transitions, caught mid-switch after the color scheme changed. It is not a defect. The tiny detail photo comes from the small test fixture image, but `width: auto` means a real small photo would also never fill the space.

## Bolder move proposals
1. **colorize: owner badge on the memory card and detail.** Show the author with the partner's `rose` or `teal` foreground on its soft fill (badge token). Reason: this is the system's core rule ("Name Beside Color"), it is missing from the only personal-content screen, and it answers "who added this?" without reading. Screens: feed and detail.
2. **delight: a photo strip on the cover for memories with several photos.** Add a small row of 2–4 thumbnails, or a stacked-edge cue, below the 3:2 cover, outside the image. Reason: it shows "3 photos" visually instead of in muted text, and it keeps the caption-outside-image rule. Screen: feed.

## Questions to consider
- Should a memory's title be its date, the way a notebook page is, with the caption as the words written under the photo?
- If the photo is the memory, why does the detail screen show it smaller than its own Delete button?
- Should editing a memory allow changing its photos, or is "delete and add again" the right message for a shared record?
## Assessment B: detector and rendered evidence


### Detector counts
- **Source scan**: `impeccable detect --json apps/web/src/features/memories` returned `[]`, exit 0. Zero findings, so no rules fired. The scan checked 6 markup files: MemoriesPage, MemoryDetailPage, MemoryFormPage, MemoryCard, MemoryImage, PhotoSelection.
- **Rendered scan** (`capture/memories/*.detect.json`, 1440px light): `memories.detect.json`, `memories-new.detect.json`, `memories-memoryId.detect.json` and `memories-memoryId-edit.detect.json` are all `[]`. Zero findings.
- Rules turned off in config: low-contrast, gray-on-color, skipped-heading.

### Verified findings
The detector found nothing, so there is nothing to verify. The real issues below come from reading the code and the screenshots:

1. **P3, uneven padding on the form card**: `apps/web/src/styles/memories.css` has no `.memory-form .actions { margin-bottom: 0 }`. The global `.actions { margin-bottom: 24px }` (base.css:34) adds to the card's 24px padding. The bottom inset is 48px and the top inset is 24px, on add and on edit, at all widths. `settings.css:2` already resets this for settings. Command: **polish**.
2. **P3, empty status paragraph adds space on the edit form**: `MemoryFormPage.tsx:90` always renders `{memory && <p role="status">{progress}</p>}`. When it is empty it keeps its default 16px bottom margin. The gap from the caption to "Save changes" becomes about 36px. The `:empty` hide rule (`memories.css:41`) covers only `.photo-selection > [role='status']`. Command: **polish**.
3. **P3, date text inset is different from other fields below 768px**: `memories.css` `@media (max-width:767px) .memory-form input[type='date'] { padding-inline: 4px; }`. At 390px the date text starts about 6px from the border, but the caption text starts 16px in. You can see this in `memories-new-390` and `memories-memoryId-edit-390`. The field is about 316px wide, so it does not need the smaller padding. Command: **polish**.
4. **P3, detail photo and Download button do not align**: `memories.css:27-28`. The image is centered with `margin: auto`, but `figcaption { justify-content: flex-end }` puts "Download photo N" on the right edge. With a photo narrower than the card (the stress fixture's full image is about 96×64), the image floats in the center and the button sits alone on the right. Also, `width: auto` never scales a small photo up. A real full-size photo (at least as wide as the card) fills the card, so the problem is smaller with real data. The alignment mismatch stays. Command: **layout**.

### False positives
None. The detector returned no findings.

### Visible defects from screenshots
- **memories-new / memories-memoryId-edit, 1440 (light and dark)**: the form card is centered (`.form-page { max-width: var(--form-width) /*720px*/; margin: 24px auto }`, base.css:22). The page header is left-aligned at x=288, so the card's left edge is about 200px to the right of the title's left edge. This is a shared rule in `base.css`, not only in memories. At 1024 and below the card fills the column and lines up.
- **Form card bottom inset 48px vs top 24px**: all widths, light and dark (finding 1).
- **Edit form, larger gap before actions**: all widths (finding 2).
- **Date field text inset 6px vs 16px**: 390 light and dark, add and edit (finding 3).
- **memories-memoryId, all widths**: a small photo centered, with Download right-aligned under empty space (finding 4). At 390 the card looks thin and empty: a 96px image, then two buttons.
- **memories-memoryId, 768**: the PageHeader title wraps to 5 lines in about 420px, and about 100px stays empty to the left of "Edit memory". The cause is `text-wrap: balance` on h1 (base.css:14) plus the flex basis in `.page-header` (base.css:27). This is shared PageHeader behaviour with long stress captions. It is minor and not memories-specific.
- **Dark mode**: surfaces, cards, inputs, the link color, the danger button and the cover placeholder all use dark tokens correctly. There are no light-only assets. The cover gradient is the photo itself. The faded buttons at 390 dark ("Add memory", "Edit memory", "Download photo 1", "Delete memory", "Choose photos", "Publish memory", "Save changes") are the 140ms color-transition capture effect, not a defect.
- **No clipped text, horizontal scroll or overlap** on any screen. Long partner names wrap cleanly in the card meta (`overflow-wrap: anywhere`). Long captions wrap in the card h3 (`white-space: pre-wrap; overflow-wrap: anywhere`). No sticky or fixed elements on these screens.
- **Touch targets**: all are 48px or more. Buttons use the 48px control height. "Return to memories" and "Cancel" get `min-height: var(--nav-target)` through base.css:25. The whole feed card is a link target (`.memory-card-link::after { inset: 0 }`).
- **Token drift in memories.css**: none. Spacing values (4, 8, 12, 16, 20, 24, 32) are all on the spacing scale. Radii use `--radius-card` and `--radius-control`. Colors are variables only (`--shared-soft`, `--muted`, `--link`, `--focus`, `--ink`, `--surface`). One small note: `.memory-card-copy h3` (memories.css:19) hard-codes the `title` token values (19px, 1.3, -.015em). The values are correct, but the rule repeats them instead of reading a shared title style.

### Skipped steps
- **Browser overlay**: skipped. There is no local backend in this container and no live page, and the overrides forbid starting servers.
- **Rendered scan at widths other than 1440px light**: not available. CI captured `detect.json` only at 1440px light.
- **Photo-selection grid and error/loading states** (`.photo-selection-grid`, `.memory-image-state`, conflict reload button): no screenshot shows photos selected, a failed photo load or a conflict, so I could not check these layouts visually.
