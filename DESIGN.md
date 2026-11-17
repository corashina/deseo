---
name: Deseo
description: A private app for two people to plan days, share messages, and keep memories.
colors:
  canvas: "#FAF7F5"
  surface: "#FFFFFF"
  ink: "#383547"
  muted: "#6C6475"
  line: "#E5DEE8"
  control: "#8B8293"
  action: "#DDD4EE"
  action-hover: "#D2C6E7"
  on-action: "#413852"
  primary: "#60527C"
  on-primary: "#FFFFFF"
  action-border: "#786A8B"
  link: "#60527C"
  sidebar: "#F3EEF7"
  rose-accent: "#DCA9BD"
  teal-accent: "#A7CEC1"
  shared-accent: "#C3B5DD"
  rose: "#89435D"
  rose-soft: "#F5E3EB"
  teal: "#356B66"
  teal-soft: "#DEF0E9"
  shared: "#60527C"
  shared-soft: "#EAE4F5"
  note: "#FAEDDF"
  note-line: "#EAD8C8"
  focus: "#68518C"
  success: "#236644"
  success-soft: "#EAF4ED"
  warning: "#805500"
  warning-soft: "#FFF2D6"
  danger: "#A92F3E"
  danger-soft: "#FCECEF"
  shadow: "#25324B1F"
  backdrop: "#38354759"
  canvas-dark: "#14111B"
  surface-dark: "#221D2D"
  ink-dark: "#F2ECF7"
  muted-dark: "#A79EB4"
  line-dark: "#332C40"
  control-dark: "#8A7F99"
  action-dark: "#3A3056"
  action-hover-dark: "#45396A"
  on-action-dark: "#F1EBFA"
  primary-dark: "#BBA4F7"
  on-primary-dark: "#1A1526"
  action-border-dark: "#9C8CB3"
  link-dark: "#C9B5F7"
  sidebar-dark: "#1C1825"
  rose-accent-dark: "#B45A80"
  teal-accent-dark: "#3E9C86"
  shared-accent-dark: "#7D68B8"
  rose-dark: "#F49CC0"
  rose-soft-dark: "#3A2231"
  teal-dark: "#7EDEC6"
  teal-soft-dark: "#18332D"
  shared-dark: "#BBA4F7"
  shared-soft-dark: "#2A2342"
  note-dark: "#2E2620"
  note-line-dark: "#57473A"
  focus-dark: "#C9B5F7"
  success-dark: "#8FD6AE"
  success-soft-dark: "#1D3326"
  warning-dark: "#F0C46B"
  warning-soft-dark: "#3A2E15"
  danger-dark: "#F2939F"
  danger-soft-dark: "#3E2227"
  shadow-dark: "#0000004D"
  backdrop-dark: "#05030ACC"
typography:
  display:
    fontFamily: "Manrope Variable, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "48px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  display-mobile:
    fontFamily: "Manrope Variable, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Manrope Variable, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline-mobile:
    fontFamily: "Manrope Variable, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope Variable, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.3
  eyebrow:
    fontFamily: "Manrope Variable, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Manrope Variable, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Manrope Variable, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: "Manrope Variable, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  nav-label:
    fontFamily: "Manrope Variable, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 550
    lineHeight: 1.4
  badge:
    fontFamily: "Manrope Variable, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  badge: "8px"
  control: "12px"
  card: "20px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.sidebar}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.link}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "24px"
  note-card:
    backgroundColor: "{colors.note}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  badge:
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
  avatar:
    rounded: "{rounded.full}"
    size: "32px"
---

# Design System: Deseo

## Overview

**Creative North Star: "The Shared Notebook"**

Deseo is a shared app for two partners. It covers plans, tasks, photos, messages, and notes.
The owner approved pastel styling, the [Two voices icon](brand/icon-source.png), and separate browser and native screens.
The look is calm and personal: pastel fills, dark text, and names beside every owner color.

Planning screens are compact. Personal screens give photos and notes more space.
The type, label, depth, and motion rules follow [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky (CC BY 4.0).

**Key Characteristics:**

- Pastel fills with dark text and dark essential boundaries.
- A stable color for each partner, always shown with a name.
- One page ground for the sidebar, header, and content. Color goes on partners, events, and actions, not on navigation.
- Flat cards with one-pixel borders; shadows only on popovers and dialogs.
- Manrope type in the browser and real text for labels and numbers.

### Platforms

React DOM serves the browser portal. Expo serves Android and iOS; the Expo app is frozen.
`apps/site` serves static public pages. `apps/site/src/site.css` holds their styles. The site build adds the token variables to each page.
Use React Router links and a sidebar in the portal. Use Expo Router stacks and bottom tabs on native devices.
Follow [the screen guide](docs/README.md#screens) for routes and flows.

## Colors

Define colors once in `brand/tokens.json`. Use semantic tokens in components.
`brand/tokens-css.ts` maps them to CSS variables for the portal and the site. CSS variables use kebab case: `actionHover` becomes `--action-hover`.
Native code reads colors through `useTheme()` or `makeStyles()` in `apps/mobile/src/theme`. Do not import `tokens.json` in components.
The frontmatter holds both palettes: light keys have no suffix, and dark keys end in `-dark`.

**The One Change Rule.** A token change edits `brand/tokens.json` and this file in one change. Add a new color role to both palettes in one change.

### Primary

- **Plum Primary** (`primary` #60527C, dark #BBA4F7; `on-primary` #FFFFFF, dark #1A1526): the one main button of a page. `on-primary` is also the danger button text.
- **Lilac Action** (`action` #DDD4EE, dark #3A3056): selected dates. `action-hover` (#D2C6E7) on hover.
- **Deep Plum Text on Action** (`on-action` #413852): text on pastel action surfaces.
- **Plum Action Border** (`action-border` #786A8B): pastel action boundary.
- **Plum Link** (`link` #60527C): text buttons and links.

### Partner and shared colors

- **Rose** (`rose` #89435D on `rose-soft` #F5E3EB): Partner A foreground and background.
- **Teal** (`teal` #356B66 on `teal-soft` #DEF0E9): Partner B foreground and background.
- **Shared Lilac** (`shared` #60527C on `shared-soft` #EAE4F5): shared content.
- **Decorative marks** (`rose-accent` #DCA9BD, `teal-accent` #A7CEC1, `shared-accent` #C3B5DD): blush, mint, and lilac marks only.
- **Note Peach** (`note` #FAEDDF, border `note-line` #EAD8C8): personal note background.

### Neutral

- **Warm Canvas** (`canvas` #FAF7F5): page background.
- **Surface White** (`surface` #FFFFFF): cards, forms, navigation.
- **Ink** (`ink` #383547): headings and body text.
- **Muted** (`muted` #6C6475): secondary text and timestamps.
- **Line** (`line` #E5DEE8): decorative dividers and card borders.
- **Control** (`control` #8B8293): input and checkbox boundaries.
- **Pale Lavender Fill** (`sidebar` #F3EEF7): hover fills, the important date, the sign-in story, and the message composer.
- **Focus** (`focus` #68518C): focus ring.

### Status

- **Success** (`success` #236644 on `success-soft` #EAF4ED), **Warning** (`warning` #805500 on `warning-soft` #FFF2D6), **Danger** (`danger` #A92F3E on `danger-soft` #FCECEF): text and background pairs. Danger also marks destructive actions.

### Named Rules

**The Dark Text Rule.** In the light palette, keep text and essential boundaries dark. Never use the pastel action fill as a text color.
**The Name Beside Color Rule.** Assign partner colors to stable partner IDs. Both partners see the same assignment. Do not assign colors by gender. Show a name beside each owner color.
**The One Meaning Rule.** Do not create per-screen color aliases with the same meaning. Use accent tokens for decorative marks and owner foreground tokens for names and metadata.

The browser portal, the public site, and the mobile app follow the device appearance. No control switches the appearance by hand.
The dark palette is Midnight: plum surfaces and bright owner colors.
Use an icon and explicit text for errors and warnings.

### Contrast

Require 4.5:1 for normal text. Require 3:1 for essential control boundaries and focus indicators.
Every dark text color passes 4.5:1 on canvas, surface, sidebar, note, and its own soft fill.

Do not use decorative border colors as essential control boundaries. Recheck contrast after a token change.
Sources: [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## Typography

**Body Font:** Manrope in the browser, bundled through `@fontsource-variable/manrope`. The system sans-serif stack is the fallback. Native screens use the system font.

**Character:** rounded and friendly, with calm titles. Names, dates, and photos carry the personality.

### Hierarchy

| Role | Desktop | Mobile | Weight / line height |
|---|---|---|---|
| Browser welcome title (display) | 48px | 36px | 500 / 1.2 |
| Browser page title (headline) | 28px | 24px | 500 / 1.2 |
| Native page title | 28dp | 28dp | 700 / 34dp |
| Section title (title) | 19px | 19px | 600 / 1.3 |
| Eyebrow above a title (eyebrow) | 12px | 12px | 600 / 1.5 |
| Body and input | 16px | 16px | 400 / 1.5 |
| Button | 15px | 15px | 600 / 1.4 |
| Secondary text | 14px | 14px | 400 / 1.5 |
| Badge | 12px | 12px | 600 / 1.4 |
| Browser navigation label | 15px | 15px | 550 / 1.4 |
| Native navigation label | 12dp | 12dp | 600 / 17dp |

Inputs and selects are 48px high, so fields in one row line up. Checkboxes use the `primary` accent.
Use real text for labels and numbers. Use tabular numbers for times and countdowns.
Use sentence case everywhere. Do not use uppercase labels.
Use weights 400, 500, and 600 only in the browser. Hierarchy comes from size and color.
Limit title tracking to `-0.02em`. Text below 20px has no negative tracking.
Short strings, such as titles, labels, buttons, and captions, end without a period.

## Layout

Build from one column. Set breakpoints by available space.

| Width | Shell | Content |
|---|---|---|
| 320–767px | Menu button and drawer | One column, 16px page padding |
| 768–1023px | 72px rail with labels under icons | 24px page padding |
| 1024px and above | 256px sidebar; collapses to the rail | 32px page padding |

Spacing tokens are 4, 8, 12, 16, 20, 24, 32, and 40px.
Use 24px card padding on desktop and 20px on mobile. Use 24px section gaps on desktop and 16px on mobile.
Keep form field groups 20px apart.

Cap content at 1440px, forms at 720px, and messages at 960px. The header is at least 72px high.
From 1200px, Today pairs a flexible conversation column with the 360px Our day panel. Below 1200px, Today uses one column.
From 1500px, Memories shows three columns.
Use `min-width: 0` on grid children. Let long event and partner names wrap.
Use 48px browser targets and 48dp native targets.
Below 768px, month grid day buttons stay 48px high but can be narrower. Seven 48px columns do not fit on a 320px phone.
At narrow widths, move the header action below the heading before either gets crowded.
Do not shrink desktop calendar cells into unreadable mobile columns.
Use English text until the owner selects launch languages. Leave room for longer translated labels.

## Elevation & Depth

Surfaces are flat. A one-pixel `line` border separates cards from the canvas.

### Shadow Vocabulary

- **Popover** (`box-shadow: 0 8px 24px var(--shadow)`): popovers and dialogs.
- **Backdrop** (`backdrop`): the scrim behind modal dialogs.

**The Flat Card Rule.** Reserve shadows for popovers and dialogs. Never color a shadow. A surface gets a border or a shadow, never both.

**The Quiet Shell Rule.** The sidebar, the drawer, and the header sit on `canvas`. The current navigation item is a neutral pill: `ink` at 7% with `ink` text. Hover is `ink` at 4%.

**The Working Screen Rule.** Portal screens are worked in, not read once. Page titles stay at 32px or less, and the next plan title uses the section title size. In the month grid, weekend cells use `canvas`, one tone step from the card. These rules follow the app-screen chapter of [taste-skill](https://github.com/Leonxlnx/taste-skill) 2.1.5 by Leonxlnx (MIT). Its violet ban does not apply: the lavender palette is the brand.

### Motion

Use 140ms transitions for feedback and 200ms for panels, with `cubic-bezier(.2, .8, .2, 1)`. Animate opacity or transform. A press scales to 0.98.
Avoid looping animation, parallax, and decorative counters.

## Shapes

Use 20px card corners, 12px control corners, and 8px badges. Use circles for avatars.
Use a one-pixel card border.

## Components

| Component | Anatomy and behavior |
|---|---|
| App shell | Responsive navigation, page header, content region |
| Page header | One heading and one main action. Navigation screens hide the heading for screen readers only, because the navigation names them. No context line repeats the heading or the fields |
| Partner badge | Stable owner color and visible name. Together uses the lilac pair |
| Event row | Time column, tinted body, owner strip, title, metadata |
| Memory card | Reserved image area, caption up to three lines when set, author badge, date, photo count |
| Note card | Warm fill, sender, short text |
| Task row | Labeled checkbox, wrapping title, owner, optional due date |
| Date countdown | Number, unit, event name, absolute date |
| Button | Primary, secondary, text, or destructive |
| Input field | Visible label, input, optional hint, local error |
| Dialog | Title, focused task, primary action, Cancel |
| Status message | Plain explanation and a recovery action when available. Neutral: canvas fill and `line` border. Error: danger pair and a warning icon |

Reuse EventRow, MemoryCard, NoteCard, and TaskRow across callers on each platform.

### Buttons

- **Primary:** `primary` fill, `on-primary` text, 600 weight, 12px corners, 48px high. Use one primary button per page or form.
- **Secondary:** surface fill and `control` border. Use it for Cancel.
- **Text:** `link` color, no fill or border. Use it for section links, small edits, and icon toggles in the shell.
- **Destructive:** `danger` fill.
- Show loading inside the button without changing its width.

### Inputs

- Visible label, 16px text, `control` boundary, 12px corners, 48px high.
- Use `control` for essential input boundaries. Decorative borders can use `line`.
- Show the error beside the field.

### Filters and badges

Use buttons for interactive filters. Badges stay static.
View tabs and owner filters are segmented controls. The pressed segment is a raised surface with ink text, never an owner color. Owner segments show their owner dot.

### Dialogs

Use the native modal dialog. The browser keeps focus off the page and returns it to the trigger. Do not add a focus trap. Support Escape where cancel is safe. A click outside closes the navigation drawer.
Give icon-only buttons an accessible name.
Close is an icon-only text button in the heading. A dialog with an action also has a Cancel button beside it.

### Navigation

Use four primary destinations: **Today, Calendar, Memories, Tasks**. Today holds the conversation.
Show the unread message count on Today.
Group them above Settings. Use surface fills for hover and pastel fills for the current page.
Use labeled 20px icons: Phosphor regular in the browser, Ionicons on native devices.
On narrow screens, the header stays at the top. The menu button shows the unread count. The account avatar opens Settings, and the pair shows names only, one line each.
In the rail, use 12px/600 labels under the icons. Touch shows no tooltips.
The icon tile follows the appearance: `brand/icon-web.webp` in light mode, `brand/icon-web-dark.webp` in dark mode.

### Screens

**Entry.** Sign in shows the story panel and the email card side by side from 1024px, and stacked below it.
The other sign-in screens show the icon and name above one 480px card. The main button fills the card width.
Profile setup offers Sign out. The sign-in code field shows six large spaced digits and says to check spam.
Pair screens are one card with the header inside. Start shows its two choices side by side when they fit.
Sign-in, entry, and pair screens center their text and buttons. Field labels stay at the start; the code field is centered.
The Join field takes the code or the invitation link. Waiting says what to send only when a code is on screen.
On a return visit, Waiting says the code still works, and Replace is a secondary button. Waiting says that the page opens Today when the partner joins.
Ended offers Start a new pair and Enter invitation. Your pair stays selected in the navigation on every pair screen.

**Today.** Today is chat-first: the conversation in the main column and the Our day panel beside it from 1200px.
The header shows only the date. It has no buttons; Send message is the main action.
Today fills the window. The conversation scrolls inside its column, so the composer stays in view. The Our day panel scrolls on its own.
The message field starts at one line and grows to five. Send message sits beside it when they fit. The conversation keeps the most height.
The Our day panel shows, in order: the next plan, Upcoming plans, Due tasks, the next important date, and the latest memory.
The next plan shows a label (Now, Today, Tomorrow, or the weekday), title, time, place, and owner.
Upcoming plans shows a seven-day strip with one dot per owner, then up to three events after the next plan.
Upcoming plans and Due tasks are bordered cards. The important date uses the `sidebar` fill without a border and shows the day count large.
Below 1200px, the panel becomes a row of links above the conversation: next plan, due task count, and countdown. The next plan chip names its day. Each chip keeps one line.
Keyboard order matches the visual order.

**Calendar.** Show the month, owner legend, and view control above the calendar. Add event goes in the header. Date ideas follow the calendar card as a list with a title field.
Each event shows title, time, and owner name, plus location when set.
The selected day fills its number with `primary`. Today gets a 2px `link` ring. Cells stay clear, so event colors keep their meaning.
In a month cell, a title keeps two lines and the owner one line. Below 768px, each day shows owner dots in place of events, and the day button names the count.
Events, date ideas, and tasks open their edit form. Explain invalid end times beside the time field.
The event and idea screens use Edit event and Edit idea as the title, because the Title field shows the name. The idea screen adds its state. Delete and Archive are secondary buttons; the dialog holds the final action.
Return links and Cancel go back to the page the person came from, with the same month, view, and filter.
Show times with a numeric hour, such as 7:00 PM, in every place. On a later day of a timed event, show Until and the end time, or Continues.
A tap on a day brings that day's events into view.
Group overlapping events without hiding owners. Format dates through `Intl` in the user's locale.
Keep all-day dates as dates. Never shift them through UTC conversion.
Show every date and time in the viewer's profile timezone. Do not show timezone names on events.

**Memories.** Use a feed with month headings. Show image, caption, date, and author. Thumbnails download near the viewport, four at a time.
For the partner, the memory screen uses the date as its title, with the author badge, and shows the full caption under the photos. For the author, the title is Edit memory, because the date field follows the photos. Each photo box keeps its shape while it loads. Delete is a secondary button; the dialog holds the destructive one.
Keep captions outside images. Use a 3:2 crop in cards and the full image in detail.
The photo hint says that photos cannot change after publish. Reserve image space before loading. Show progress, failure, and Retry on the affected image.

**Conversation.** Use sender names, timestamps, and restrained rose and teal fills.
Limit message width to 80%. Align the viewer's messages to the trailing edge.
Keep sender colors stable. Use 16px message padding on narrow screens.
Show Read only if a real read receipt exists. Notes are pinned messages, not a second text system.
A message shows the time; older messages add the day, and the year only when it differs. Own messages end the sender line with an actions button that opens a popover menu. The menu sits in the top layer, below the button or above it when there is no room.
Pinned notes are compact rows above the conversation: sender eyebrow, two lines of text, and Unpin. A lone note fills the row.
A failed pin, unpin, or delete shows on its message. An unsent message keeps the sender's color.

**Tasks.** Each row has a checkbox, title, assignee badge in its owner color, and optional due date. A completed row names who completed it.
The checkbox has its own 48px target. The rest of the row opens the task.
Overdue uses `danger` text and Due today uses `warning` text, never a partner color. Open tasks with a due date come first, soonest first.
Quick add puts the title and Add task on one row. Assigned to and Due date sit beside them when the card is 760px wide or more, and below them otherwise.
List tabs hold lists only, one line each. New list sits beside the tabs. List settings start closed.
Completed tasks keep readable text. Delete task is a secondary button; the dialog holds the destructive one.

**Settings.** Profile, Your pair, and Account share one card. End this pair has its own card below it.
Ending a pair opens a dialog that names the partner and explains the result. The email code goes out only when the person asks for it.
Your pair lists each member as a row: a 48px avatar, the name in the title style, and You or Your partner.
Section intros use secondary text. The timezone field selects its value on focus, so typing a city starts a new search. A unique city name becomes its zone; any other value gets a field error.
The end pair code step says where the code went, uses the code field style, and Enter confirms.

**Site.** The site uses the portal tokens, Manrope, and the same type scale. Each page has a light and a dark browser bar color.
Previews are captures of the real app with the sample pair Alex and Sam. Each preview has a dark version and a caption that starts with "Preview of".
`apps/web/tests/capture/previews.spec.ts` makes the captures. Phone previews are 2x captures at 390px. All previews share the right edge.
Narrow pages keep the left edge of the header with a 720px text column. Their section titles are 28px (24px on mobile). The footer stays at the bottom of short pages.
Make no claim that the product cannot prove. The hero has one primary button, Join with an invitation, and one line of release status.

### States

Use the [common states](docs/README.md#common-states). Keep the final layout's size while loading.
Keep draft and sent states distinct. Prevent duplicate saves while a request is pending.
Use optimistic updates only with rollback and a visible failure.
Announce save results in a polite live region. Keep errors visible until resolved or dismissed.

## Do's and Don'ts

- **Do** check event ownership without color, and test long names and long event titles.
- **Do** check 320, 390, 768, and 1440px, 200% text zoom, keyboard navigation, and visible focus.
- **Don't** add questions, streaks, quizzes, AI advice, or relationship scores.
