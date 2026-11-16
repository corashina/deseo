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
  canvas-dark: "#1C1A22"
  surface-dark: "#25222D"
  ink-dark: "#F1ECF4"
  muted-dark: "#B4AABD"
  line-dark: "#3A3543"
  control-dark: "#8F859A"
  action-dark: "#4A3F5E"
  action-hover-dark: "#564A6C"
  on-action-dark: "#F1EBFA"
  action-border-dark: "#9C8CB3"
  link-dark: "#C9B8EA"
  sidebar-dark: "#221F29"
  rose-accent-dark: "#8A5468"
  teal-accent-dark: "#4C7C70"
  shared-accent-dark: "#6E5F8C"
  rose-dark: "#F0A9C2"
  rose-soft-dark: "#3F2731"
  teal-dark: "#8FD3C4"
  teal-soft-dark: "#1F3632"
  shared-dark: "#C9B8EA"
  shared-soft-dark: "#2E2840"
  note-dark: "#3A2F25"
  note-line-dark: "#57473A"
  focus-dark: "#B9A3E0"
  success-dark: "#8FD6AE"
  success-soft-dark: "#1D3326"
  warning-dark: "#F0C46B"
  warning-soft-dark: "#3A2E15"
  danger-dark: "#F2939F"
  danger-soft-dark: "#3E2227"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  display-mobile:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  headline-mobile:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  nav-label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 550
    lineHeight: 1.4
  badge:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
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
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.sidebar}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
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

| User need | Interface treatment |
|---|---|
| Know each other's plans | Owner colors, names, agenda, and shared event labels |
| Save photos together | Large image cards, captions, and a chronological feed |
| Send texts and notes | One conversation with clear sender labels |
| Remember a date | Upcoming event cards and the important date countdown |
| Coordinate daily work | Task rows with owners and due dates |
| Feel like a pair | Partner names and personal content on Today |

**Key Characteristics:**

- Pastel fills with dark text and dark essential boundaries.
- A stable color for each partner, always shown with a name.
- Flat cards with one-pixel borders; shadows only on popovers, dialogs, and selected navigation.
- System sans-serif type and real text for labels and numbers.

### Platforms

React DOM serves the browser portal. Expo serves Android and iOS; the Expo app is frozen.
`apps/site` serves static public pages. `apps/site/src/site.css` holds their styles; it copies the shared colors.
Use React Router links and a sidebar in the portal. Use Expo Router stacks and bottom tabs on native devices.
Follow [the screen guide](docs/README.md#screens) for routes and flows.

## Colors

Define colors once in `brand/tokens.json`. Use semantic tokens in components.
The browser maps them to CSS variables in `apps/web/src/main.tsx`. CSS variables use kebab case: `actionHover` becomes `--action-hover`.
Native code reads colors through `useTheme()` or `makeStyles()` in `apps/mobile/src/theme`. Do not import `tokens.json` in components.
The frontmatter holds both palettes: light keys have no suffix, and dark keys end in `-dark`.

**The One Change Rule.** A token change edits `brand/tokens.json` and this file in one change. Add a new color role to both palettes in one change.

### Primary

- **Lilac Action** (`action` #DDD4EE, dark #4A3F5E): main buttons and selected dates. `action-hover` (#D2C6E7) on hover.
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
- **Pale Lavender Sidebar** (`sidebar` #F3EEF7): navigation surface.
- **Focus** (`focus` #68518C): focus ring.

### Status

- **Success** (`success` #236644 on `success-soft` #EAF4ED), **Warning** (`warning` #805500 on `warning-soft` #FFF2D6), **Danger** (`danger` #A92F3E on `danger-soft` #FCECEF): text and background pairs. Danger also marks destructive actions.

### Named Rules

**The Dark Text Rule.** In the light palette, keep text and essential boundaries dark. Never use the pastel action fill as a text color.
**The Name Beside Color Rule.** Assign partner colors to stable partner IDs. Both partners see the same assignment. Do not assign colors by gender. Show a name beside each owner color.
**The One Meaning Rule.** Do not create per-screen color aliases with the same meaning. Use accent tokens for decorative marks and owner foreground tokens for names and metadata.

The browser portal stays light. The public site and the mobile app follow the device appearance.
Use an icon and explicit text for errors and warnings.

### Contrast

Require 4.5:1 for normal text. Require 3:1 for essential control boundaries and focus indicators.
Every dark text color passes 4.5:1 on canvas, surface, sidebar, note, and its own soft fill.

| Pair | Light | Dark |
|---|---:|---:|
| Ink / surface | 11.88:1 | 13.41:1 |
| Muted / canvas | 5.30:1 | 7.72:1 |
| Action text / action | 7.70:1 | 8.32:1 |
| Rose / rose-soft | 5.64:1 | 7.22:1 |
| Teal / teal-soft | 5.15:1 | 7.53:1 |
| Shared / shared-soft | 5.65:1 | 7.72:1 |
| Muted / note | 4.91:1 | 5.84:1 |
| Control / surface | 3.68:1 | 4.45:1 |
| Focus / canvas | 6.26:1 | 7.69:1 |
| Action border / action | 3.48:1 | 3.15:1 |

Do not use decorative border colors as essential control boundaries. Recheck contrast after a token change.
Sources: [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## Typography

**Body Font:** the system sans-serif stack (`system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`).

**Character:** plain and familiar, so names, dates, and photos carry the personality.

### Hierarchy

| Role | Desktop | Mobile | Weight / line height |
|---|---|---|---|
| Browser welcome title (display) | 48px | 36px | 700 / 1.2 |
| Browser page title (headline) | 36px | 30px | 700 / 1.2 |
| Native page title | 28dp | 28dp | 700 / 34dp |
| Section title (title) | 20px | 20px | 650 / 1.3 |
| Body and input | 16px | 16px | 400 / 1.5 |
| Button | 15px | 15px | 600 / 1.4 |
| Secondary text | 14px | 14px | 400 / 1.5 |
| Badge | 12px | 12px | 600 / 1.4 |
| Browser navigation label | 15px | 15px | 550 / 1.4 |
| Native navigation label | 12dp | 12dp | 600 / 17dp |

Use real text for labels and numbers. Use tabular numbers for times and countdowns.
Use uppercase only for short decorative labels. Keep instructions and controls in sentence case.
Limit title tracking to `-0.03em`.

## Layout

Build from one column. Set breakpoints by available space.

| Width | Shell | Content |
|---|---|---|
| 320–767px | Menu button and drawer | One column, 16px page padding |
| 768–1023px | 72px rail | 24px page padding |
| 1024px and above | 256px sidebar; 72px collapsed | 32px page padding |

Spacing tokens are 4, 8, 12, 16, 20, 24, 32, and 40px.
Use 24px card padding on desktop and 20px on mobile. Use 24px section gaps on desktop and 16px on mobile.
Keep form field groups 20px apart.

Cap content at 1440px, forms at 720px, and messages at 960px. The header is at least 72px high.
From 1200px, Today pairs a flexible planning column with a 360px personal column. Below 1200px, Today uses one column.
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

- **Popover** (`box-shadow: 0 8px 24px rgb(37 50 75 / 12%)`): popovers and dialogs.
- **Selected** (`box-shadow: 0 2px 8px rgb(56 53 71 / 8%)`): the selected navigation item.

**The Flat Card Rule.** Reserve shadows for popovers, dialogs, and selected navigation.

### Motion

Use 140ms transitions for feedback and 200ms for panels, with `cubic-bezier(.2, .8, .2, 1)`. Animate opacity or transform.
Avoid looping animation, parallax, and decorative counters.

## Shapes

Use 20px card corners, 12px control corners, and 8px badges. Use circles for avatars.
Use a one-pixel card border.

## Components

| Component | Anatomy and behavior |
|---|---|
| App shell | Responsive navigation, page header, content region |
| Page header | One heading, short context, one main action |
| Partner badge | Stable owner color and visible name |
| Event row | Time column, tinted body, owner strip, title, metadata |
| Memory card | Reserved image area, caption, author, date |
| Note card | Warm fill, sender, short text |
| Task row | Labeled checkbox, wrapping title, owner, optional due date |
| Date countdown | Number, unit, event name, absolute date |
| Button | Primary, secondary, text, or destructive |
| Input field | Visible label, input, optional hint, local error |
| Dialog | Title, focused task, primary action, Cancel |
| Status message | Plain explanation and a recovery action when available |

Reuse EventRow, MemoryCard, NoteCard, and TaskRow across callers on each platform.

### Buttons

- **Primary:** `action` fill, `on-action` text, `action-border` border, 12px corners, 48px high. Use one primary button per form.
- **Secondary:** surface fill and `control` border. Use it for Cancel.
- **Text:** `link` color. Use it for section links and small edits.
- **Destructive:** `danger` fill.
- Show loading inside the button without changing its width.

### Inputs

- Visible label, 16px text, `control` boundary, 12px corners, 48px high.
- Use `control` for essential input boundaries. Decorative borders can use `line`.
- Show the error beside the field.

### Filters and badges

Use buttons for interactive filters. Badges stay static.

### Dialogs

Trap focus in modal dialogs. Return focus to the trigger on close. Support Escape where cancel is safe.
Give icon-only buttons an accessible name.

### Navigation

Use five primary destinations: **Today, Calendar, Memories, Messages, Tasks**.
Group them above Settings. Use surface fills for hover and pastel fills for the current page.
Use labeled 20px icons: Phosphor regular in the browser, Ionicons on native devices.
On narrow screens, the account avatar in the header opens Settings.

### Screens

**Today.** Show at most three upcoming events. Show one main action, **Add event**. Section actions are text buttons.
Keyboard order matches the visual order.

**Calendar.** Show the month, owner legend, and view control above the calendar. Date ideas and Add event go in the header.
Each event shows title, time, and owner name, plus location when set.
Open details before editing. Explain invalid end times beside the time field.
Group overlapping events without hiding owners. Format dates through `Intl` in the user's locale.
Keep all-day dates as dates. Never shift them through UTC conversion.
Show an IANA timezone only when it differs from the viewer's profile timezone. The event form keeps it in More details.

**Memories.** Use a feed with month headings. Show image, caption, date, and author.
Keep captions outside images. Use a 3:2 crop in cards and the full image in detail.
Reserve image space before loading. Show progress, failure, and Retry on the affected image.

**Messages.** Use sender names, timestamps, and restrained rose and teal fills.
Limit message width to 80%. Align the viewer's messages to the trailing edge.
Keep sender colors stable. Use 16px message padding on narrow screens.
Show Read only if a real read receipt exists. Notes are pinned messages, not a second text system.

**Tasks.** Each row has a checkbox, title, owner label, and optional due date.
Completed tasks keep readable text. Keep overdue labels separate from partner colors.

**Settings.** Explain data effects before ending a pair. Keep destructive actions apart from normal edits.

### States

| State | Behavior | Example text |
|---|---|---|
| First use | Explain the screen and offer one action | Add your first shared event |
| No events | Show the date and a creation action | Nothing planned for today |
| Loading | Keep the final layout's dimensions | Loading your calendar… |
| Save failure | Keep input and offer Retry | We could not save this event. Try again. |
| Message failure | Show failure beside the message | Message not sent. Retry |
| Partner changed data | Refresh or ask for conflict resolution | Sam changed this event. Review the update. |
| Upload failure | Keep the caption and retry the file | Photo upload failed. Retry |

Keep draft and sent states distinct. Prevent duplicate saves while a request is pending.
Use optimistic updates only with rollback and a visible failure.
Announce save results in a polite live region. Keep errors visible until resolved or dismissed.

## Do's and Don'ts

### Do:

- **Do** use blush, mint, lilac, and peach fills with dark text.
- **Do** use `on-action` text and `action-border` borders on primary buttons and selected dates.
- **Do** show a name beside each owner color, and check event ownership without color.
- **Do** keep server access in feature data modules and pass explicit view data to display components.
- **Do** keep static data, formatters, and icon definitions outside render paths.
- **Do** give production images explicit dimensions and responsive sizes.
- **Do** keep authorization on the server. Frontend visibility controls do not grant access.
- **Do** follow [ARCHITECTURE.md](docs/ARCHITECTURE.md) for modules.

### Don't:

- **Don't** use the pastel action fill as a text color.
- **Don't** use decorative border colors as essential control boundaries.
- **Don't** assign partner colors by gender.
- **Don't** add looping animation, parallax, or decorative counters.
- **Don't** add questions, streaks, quizzes, AI advice, or relationship scores.

### Review checklist

- Check Today, Calendar, Memories, Messages, Tasks, and pair setup at 320, 390, 768, and 1440px.
- Check 200% text zoom, keyboard navigation, and visible focus.
- Check dialog focus, errors, and announcements with a screen reader.
- Test long names, long event titles, and translated labels.
- Check event ownership without color.
- Check dates across timezones and daylight-saving changes.
- Confirm failed saves keep input and create no duplicates.
- Check invitation, offline, loading, empty, error, and conflict states with real data.
