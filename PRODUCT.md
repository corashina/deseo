# Deseo web portal

<!-- impeccable:product-schema 1 -->

## Platform

web

This record covers the signed-in browser portal.
React DOM and Vite provide separate browser screens beside the Expo Android and iOS application.
Both applications use the same accounts, pair, content, backend, and shared domain contracts.
The public information site has separate delivery scope.

## Users

Two partners who coordinate plans, share tasks, exchange messages, and keep personal photos.
Each account can join one active pair. Each pair contains two people.

## Product Purpose

Help partners plan their day and keep shared personal content in one private space.
Success means both partners can retrieve a saved shared event, task, message, or memory.
Each partner controls private events and can end shared access without the other partner's approval.

## Positioning

Partners combine a shared calendar and task lists with one conversation, pinned notes, and photo memories.
They write their own date ideas and choose which events to share.

## Operating Context

Users sign in with an email code, set a name and timezone, and create or accept a partner invitation.
Today combines upcoming plans, due tasks, a memory, a pinned note, and an important date.
Calendar, Memories, Messages, Tasks, and Settings provide the main workflows.
The current portal uses English text. Date rules use event, profile, or pair timezones as defined in DATA.md.
Users can reload record URLs and use browser Back.
Browser drafts remain in memory and disappear after reload. Users receive a warning before leaving changed input.

## Capabilities and Constraints

- Calendar includes shared and private events, all-day dates, yearly important dates, and saved date ideas.
- Tasks include named lists, assignment, due dates, completion, and reopening.
- Memories include one to five photos, a date, a caption, and author controls.
- Messages use plain text. Each person can pin one message as a note. Sent confirms server storage.
- Settings covers profile, pair state, notification preferences, fresh verification, and sign-out.
- Users control their own reminders. The portal does not request browser push permission or register native devices.
- The server checks current account status and pair membership before granting shared access.
- Private event authors control access. Memory authors control edits and deletion.
- Users retain failed input and resolve edit conflicts. Clients reuse pending commands for retries.
- Clients clear private content when account or pair authority changes.
- Browser scope excludes service workers, offline content storage, and installation prompts.
- Account export, deletion, avatar backend work, pair-timezone writes, and public pages remain separate delivery scope.
- Product scope excludes relationship scores, streaks, coaching, profiling, public feeds, advertising, and partner surveillance.

Use [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for module rules.
Use [DATA.md](docs/architecture/DATA.md) for permissions, dates, retries, and content lifecycle.
These documents remain authoritative for their subjects.

## Brand Commitments

The owner selected the Deseo name, pastel styling, and the Two voices icon.
Use [STYLE.md](STYLE.md) for visual rules and [the selected icon](docs/design/icons-round-2/icon-05-two-voices.png).
Write short sentences, name concrete actions, and describe the actual state.
Keep instructions within 20 words. Use [Stop Slop](https://github.com/hardikpandya/stop-slop/blob/main/SKILL.md) for UI text and documentation.

## Evidence on Hand

- [Approved portal design](docs/superpowers/specs/2026-10-05-deseo-web-portal-design.md): browser scope and confirmed choices.
- [Screen guide](docs/product/SCREENS.md): journeys, routes, forms, and states.
- [Portal gallery](docs/design/web-portal/index.html): local fixture captures, not customer testimonials.
- [Portal handoff](docs/handoffs/web-portal.md): verification records and remaining checks.
- [Development guide](docs/engineering/DEVELOPMENT.md): local commands and backend ownership rules.

Use the pair's own photos with consent. Identify prototype and test content as such.
The project provides no confirmed customer testimonials, usage claims, store approvals, or launch commitments in these records.

## Product Principles

1. Protect private content and respect each partner's control.
2. Keep each product layer usable before adding the next.
3. Confirm shared changes through durable server results.
4. Preserve input after failures and explain recovery actions.
5. Keep browser UI separate from native UI and share domain contracts.

## Accessibility & Inclusion

Support keyboard navigation, visible focus, labeled controls, screen readers, and browser zoom.
Use names and labels alongside ownership colors.
Require 4.5:1 contrast for normal text and 3:1 for essential control boundaries and focus indicators.
Use [STYLE.md](STYLE.md) for the full accessibility and release checks.

## Open Decisions

Confirm the audience age limit, launch languages beyond the current English portal, beta terms, and pricing.
Confirm the legal operator, jurisdiction, launch domain, support contact, and approved policies before release.
