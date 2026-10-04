# Deseo

A private app for two people to plan their days, share messages, and keep memories.

**Platform:** Android and iOS. **App:** Expo and TypeScript. **Stage:** Design and implementation planning.

The repository contains documentation and a visual reference. It does not contain a working product yet.

Confirmed choices: Expo, TypeScript, Android, iOS, pastel styling, and icon 05.

Proposed choices: Supabase, email-code sign-in, encrypted drafts, and a small static Astro website.

## Product

- **Today:** Upcoming plans, a recent memory, a pinned note, and tasks.
- **Calendar:** Shared events, private events, important dates, reminders, and saved date ideas.
- **Memories:** Photos with a date and caption.
- **Messages:** One conversation for the pair. Pin a message as a love note.
- **Tasks:** Shared lists with assignment, due dates, and completion.

Each account can join one active pair. Each pair has two people.

Cupla informs the planning features. Couply informs the personal content. Deseo uses its own design and copy.

## Read first

| Document | Purpose |
|---|---|
| [Implementation across eight chats](docs/implementation/CHAT_GUIDE.md) | Numbered work, parallel tasks, materials, and ready-to-paste prompts |
| [Product design](docs/superpowers/specs/2026-10-04-deseo-design.md) | Scope, decisions, release stages, and success criteria |
| [Screen guide](docs/product/SCREENS.md) | Landing, sign-in, pairing, tabs, settings, and failure states |
| [Style guide](STYLE.md) | Pastel colors, layout, typography, and selected icon |
| [Architecture](docs/architecture/ARCHITECTURE.md) | Stack, module rules, folder structure, and data flow |
| [Data and access](docs/architecture/DATA.md) | Records, permissions, transactions, and deletion |
| [Implementation plan](docs/superpowers/plans/2026-10-04-deseo-implementation.md) | Ordered tasks, file paths, interfaces, and verification |
| [Development](docs/engineering/DEVELOPMENT.md) | Setup contract and local workflow |
| [Testing](docs/engineering/TESTING.md) | Test importance and acceptance cases |
| [Release](docs/engineering/RELEASE.md) | Device checks, operations, and store submission |
| [Glossary](GLOSSARY.md) | Product terms |
| [Documentation index](docs/README.md) | All documents and research |

## Project structure

```text
AGENTS.md                 Contributor rules
STYLE.md                  Visual rules
GLOSSARY.md               Product terms
docs/                     Existing documentation and design assets
apps/mobile/              Planned Expo application
apps/site/                Planned static public website
supabase/                 Planned database, functions, and access tests
brand/                    Planned shared color tokens and approved icon assets
```

The implementation plan defines future files. Runtime folders and package manifests are not scaffolded yet.

Use one npm workspace and one lockfile when implementation starts. Keep native screens separate from public website markup.

## Preview the current design

Open [the visual reference](docs/design/preview.html) in a browser.

It shows sample screens. Its buttons do not save data or send messages.

Selected icon: [05, Two voices](docs/design/icons-round-2/icon-05-two-voices.png).

## Delivery

1. Sign in, pair two accounts, and share one event.
2. Add tasks, important dates, date ideas, and push reminders.
3. Add messages, pinned notes, and memories.
4. Complete account controls, public pages, device checks, and release preparation.

These stages define product acceptance. The [chat guide](docs/implementation/CHAT_GUIDE.md) defines implementation order and safe parallel work.

Run Chat 01, then Chats 02–04 together, then Chats 05–08 in order.
Use separate worktrees for concurrent chats. Each chat writes a committed handoff for the next chat.

## Scope limits

The first release excludes billing, AI advice, quizzes, streaks, relationship scores, public feeds, and location tracking.

External calendar sync, video, calls, and full offline editing require separate evidence and design decisions.

Read [AGENTS.md](AGENTS.md) before changing this project.
