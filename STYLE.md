# Deseo frontend style guide

Deseo is a shared app for two partners. It covers plans, tasks, photos, messages, and notes.
The owner approved pastel styling, the [Two voices icon](brand/icon-source.png), and separate browser and native screens.

## 1. Platforms

React DOM serves the browser portal. Expo serves Android and iOS; the Expo app is frozen.
`apps/site` serves static public pages. `apps/site/src/site.css` holds their styles; it copies the shared colors.

Shared colors live in `brand/tokens.json`. The browser maps them to CSS variables in `apps/web/src/main.tsx`.
Native code reads colors through `useTheme()` or `makeStyles()` in `apps/mobile/src/theme`. Do not import `tokens.json` in components.

Use React Router links and a sidebar in the portal. Use Expo Router stacks and bottom tabs on native devices.
Follow [the screen guide](docs/README.md#screens) for routes and flows.

## 2. Product fit

Planning screens are compact. Personal screens give photos and notes more space.

| User need | Interface treatment |
|---|---|
| Know each other's plans | Owner colors, names, agenda, and shared event labels |
| Save photos together | Large image cards, captions, and a chronological feed |
| Send texts and notes | One conversation with clear sender labels |
| Remember a date | Upcoming event cards and the important date countdown |
| Coordinate daily work | Task rows with owners and due dates |
| Feel like a pair | Partner names and personal content on Today |

Keep questions, streaks, quizzes, AI advice, and relationship scores out of scope.
Use English text until the owner selects launch languages. Leave room for longer translated labels.

## 3. Color tokens

Define colors once in `brand/tokens.json`. Use semantic tokens in components.
CSS variables use kebab case: `actionHover` becomes `--action-hover`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#FAF7F5` | `#1C1A22` | Page background |
| `surface` | `#FFFFFF` | `#25222D` | Cards, forms, navigation |
| `ink` | `#383547` | `#F1ECF4` | Headings and body text |
| `muted` | `#6C6475` | `#B4AABD` | Secondary text and timestamps |
| `line` | `#E5DEE8` | `#3A3543` | Decorative dividers and card borders |
| `control` | `#8B8293` | `#8F859A` | Input and checkbox boundaries |
| `action` | `#DDD4EE` | `#4A3F5E` | Main buttons and selected dates |
| `actionHover` | `#D2C6E7` | `#564A6C` | Main button hover |
| `onAction` | `#413852` | `#F1EBFA` | Text on pastel action surfaces |
| `actionBorder` | `#786A8B` | `#9C8CB3` | Pastel action boundary |
| `link` | `#60527C` | `#C9B8EA` | Text buttons and links |
| `sidebar` | `#F3EEF7` | `#221F29` | Pale lavender navigation surface |
| `roseAccent` | `#DCA9BD` | `#8A5468` | Decorative blush marks |
| `tealAccent` | `#A7CEC1` | `#4C7C70` | Decorative mint marks |
| `sharedAccent` | `#C3B5DD` | `#6E5F8C` | Decorative lilac marks |
| `rose` | `#89435D` | `#F0A9C2` | Partner A foreground |
| `roseSoft` | `#F5E3EB` | `#3F2731` | Partner A background |
| `teal` | `#356B66` | `#8FD3C4` | Partner B foreground |
| `tealSoft` | `#DEF0E9` | `#1F3632` | Partner B background |
| `shared` | `#60527C` | `#C9B8EA` | Shared content foreground |
| `sharedSoft` | `#EAE4F5` | `#2E2840` | Shared content background |
| `note` | `#FAEDDF` | `#3A2F25` | Personal note background |
| `noteLine` | `#EAD8C8` | `#57473A` | Note border |
| `focus` | `#68518C` | `#B9A3E0` | Focus ring |
| `success` | `#236644` | `#8FD6AE` | Success text |
| `successSoft` | `#EAF4ED` | `#1D3326` | Success background |
| `warning` | `#805500` | `#F0C46B` | Warning text |
| `warningSoft` | `#FFF2D6` | `#3A2E15` | Warning background |
| `danger` | `#A92F3E` | `#F2939F` | Error text and destructive actions |
| `dangerSoft` | `#FCECEF` | `#3E2227` | Error background |

Use blush, mint, lilac, and peach fills. In the light palette, keep text and essential boundaries dark.
Use `onAction` text and `actionBorder` borders on primary buttons and selected dates.
Use `link` for text buttons. Never use the pastel action fill as a text color.
Use accent tokens for decorative marks. Use owner foreground tokens for names and metadata.

Assign partner colors to stable partner IDs. Both partners see the same assignment.
Do not assign colors by gender. Show a name beside each owner color.
Use an icon and explicit text for errors and warnings.

The browser portal stays light. The mobile app follows the device appearance.
Add a new color role to both palettes in one change.
Do not create per-screen color aliases with the same meaning.

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

## 4. Typography, spacing, and shape

Use the system sans-serif stack. Use real text for labels and numbers.

| Role | Desktop | Mobile | Weight / line height |
|---|---|---|---|
| Browser page title | 36px | 30px | 700 / 1.2 |
| Browser welcome title | 48px | 36px | 700 / 1.2 |
| Native page title | 28dp | 28dp | 700 / 34dp |
| Section title | 20px | 20px | 650 / 1.3 |
| Body and input | 16px | 16px | 400 / 1.5 |
| Button | 15px | 15px | 600 / 1.4 |
| Secondary text | 14px | 14px | 400 / 1.5 |
| Badge | 12px | 12px | 600 / 1.4 |
| Browser navigation label | 15px | 15px | 550 / 1.4 |
| Native navigation label | 12dp | 12dp | 600 / 17dp |

Use uppercase only for short decorative labels. Keep instructions and controls in sentence case.
Use tabular numbers for times and countdowns. Limit title tracking to `-0.03em`.

Spacing tokens are 4, 8, 12, 16, 20, 24, 32, and 40px.
Use 24px card padding on desktop and 20px on mobile. Use 24px section gaps on desktop and 16px on mobile.
Keep form field groups 20px apart.
Use 20px card corners, 12px control corners, and 8px badges. Use circles for avatars.
Use a one-pixel card border. Reserve shadows for popovers, dialogs, and selected navigation.
Use 140ms transitions for feedback and 200ms for panels. Animate opacity or transform.
Avoid looping animation, parallax, and decorative counters.

## 5. Responsive layout

Build from one column. Set breakpoints by available space.

| Width | Shell | Content |
|---|---|---|
| 320–767px | Menu button and drawer | One column, 16px page padding |
| 768–1023px | 72px rail | 24px page padding |
| 1024px and above | 256px sidebar; 72px collapsed | 32px page padding |

Cap content at 1440px, forms at 720px, and messages at 960px. The header is at least 72px high.
From 1200px, Today pairs a flexible planning column with a 360px personal column. Below 1200px, Today uses one column.
From 1500px, Memories shows three columns.
Use `min-width: 0` on grid children. Let long event and partner names wrap.
Use 48px browser targets and 48dp native targets.
Below 768px, month grid day buttons stay 48px high but can be narrower. Seven 48px columns do not fit on a 320px phone.
At narrow widths, move the header action below the heading before either gets crowded.
Do not shrink desktop calendar cells into unreadable mobile columns.

## 6. Navigation and screens

Use five primary destinations: **Today, Calendar, Memories, Messages, Tasks**.
Group them above Settings. Use surface fills for hover and pastel fills for the current page.
Use labeled 20px icons: Phosphor regular in the browser, Ionicons on native devices.
On narrow screens, the account avatar in the header opens Settings.

**Today.** Show at most three upcoming events. Show one main action, **Add event**. Section actions are text buttons.
Keyboard order matches the visual order.

**Calendar.** Show the date, owner legend, view control, and Add event above the calendar.
Each event shows title, time, and owner name, plus location when set.
Open details before editing. Explain invalid end times beside the time field.
Group overlapping events without hiding owners. Format dates through `Intl` in the user's locale.
Keep all-day dates as dates. Never shift them through UTC conversion.
Show the timezone while editing, and in details when partners use different zones.

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

## 7. Components

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

Use one primary button per form. Show loading inside the button without changing its width.
Use secondary buttons for Cancel and text buttons for section links and small edits.
Use `control` for essential input boundaries. Decorative borders can use `line`.
Use buttons for interactive filters. Badges stay static.
Trap focus in modal dialogs. Return focus to the trigger on close. Support Escape where cancel is safe.
Give icon-only buttons an accessible name.
Reuse EventRow, MemoryCard, NoteCard, and TaskRow across callers on each platform.

## 8. States

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

## 9. Structure

Follow [ARCHITECTURE.md](docs/ARCHITECTURE.md) for modules.
Keep server access in feature data modules. Pass explicit view data to display components.
Keep authorization on the server. Frontend visibility controls do not grant access.
Keep static data, formatters, and icon definitions outside render paths.
Give production images explicit dimensions and responsive sizes.

## 10. Review checklist

- Check Today, Calendar, Memories, Messages, Tasks, and pair setup at 320, 390, 768, and 1440px.
- Check 200% text zoom, keyboard navigation, and visible focus.
- Check dialog focus, errors, and announcements with a screen reader.
- Test long names, long event titles, and translated labels.
- Check event ownership without color.
- Check dates across timezones and daylight-saving changes.
- Confirm failed saves keep input and create no duplicates.
- Check invitation, offline, loading, empty, error, and conflict states with real data.

## 11. Writing

Use the [unslop skill](https://github.com/michael-denyer/pstack-claude/blob/main/plugins/pstack/skills/unslop/SKILL.md) for UI text and documentation.
Use short sentences and concrete actions. Keep instructions within 20 words.
Use terms from [the glossary](PRODUCT.md#glossary).
Write button labels as actions: Add event, Save changes, Send message, Upload photo, Retry.
Describe the actual state. Avoid guilt, inflated praise, vague promises, and relationship scoring.
