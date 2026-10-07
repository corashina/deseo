# Deseo visual review

Review date: 4 October 2026.

Scope: The static [design reference](preview.html) and [STYLE.md](../STYLE.md).

## Design judgment

The proposed style fits a shared calendar, photos, messages, reminders, and tasks.

Cupla's influence appears in the owner labels, event rows, and schedule structure.

Couply's influence appears in the paired identity, personal cards, and warm accent colors.

The revised design uses pastel lavender actions, blush and mint event fills, and dark text.

Photos and notes balance the planning tools. Separate content areas make each purpose clear.

This is a design judgment from the rendered reference. Couples have not tested it yet.

## Checks performed

| Check | Result |
|---|---|
| Five sample screens at 320, 360, 390, 768, and 1440px | No horizontal page overflow in 25 combinations |
| Heading, badge, navigation, and composer bounds | No elements outside the viewport in those combinations |
| Navigation changes | One visible panel and one current navigation item per view |
| Desktop composition | Calendar, tasks, memories, notes, and countdown remain distinct |
| Mobile composition | Single column and fixed bottom navigation remain readable |
| Mobile content order | Memories and notes precede tasks |
| Solid text color pairs | Listed pairs exceed 4.5:1 |
| Control boundaries and focus | Listed pairs exceed 3:1 |

See the contrast table in STYLE.md for measured values.

## Pastel revision

The owner requested softer colors after approving the design direction.

Changed the canvas, navigation, buttons, event fills, and note surfaces. Retained dark text for readability.

Regenerated the reference screenshots after the palette change.

Reviewed the desktop overview and mobile Today, Calendar, and Messages at 390px. No horizontal overflow appeared.

Recalculated ten foreground and background pairs. Text passed 4.5:1; essential control boundaries passed 3:1.

## Changes from the first draft

- Moved memories and notes before tasks on mobile.
- Increased mobile navigation labels to 12px.
- Used context-specific header actions for photos and tasks.
- Removed the event action from Messages.
- Increased task label touch height to 44px.

## Evidence

- [Desktop overview](desktop.jpg)
- [Mobile overview](mobile.jpg)
- [Mobile calendar](mobile-calendar.jpg)
- [Mobile messages](mobile-messages.jpg)
- [Browser reference](preview.html)

The illustration represents a photo position. It is not a photo from a real couple.

## Limits

The reference uses sample content. It does not save events, upload photos, send messages, or schedule reminders.

The guide covers setup, forms, and failure states. The reference does not render those flows.

These checks do not establish full accessibility compliance or product usability.

Screen reader checks, text zoom, mobile keyboards, and real data flows remain product implementation checks.

The workspace has no app framework, build command, or Git repository. This review did not run product tests or create commits.
