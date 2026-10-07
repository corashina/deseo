# Deseo

A private app for two people to plan days, share messages, and keep memories.

Deseo has a React browser portal and an Expo application for Android and iOS.
Both applications use shared domain contracts and the same Supabase access rules.
The public information site remains a separate delivery task.

## Product

- **Today:** Upcoming plans with dates, due tasks, a memory, a note, and an important date.
- **Calendar:** Shared events, private events, important dates, reminders, and date ideas.
- **Memories:** Private photos with dates, captions, and author controls.
- **Messages:** One conversation and one pinned note per person.
- **Tasks:** Shared lists, assignment, due dates, and completion.
- **Settings:** Profile, pair, preferences, fresh verification, and sign-out controls.

Each account can join one active pair. Each pair has two people.
Deseo uses pastel colors and the [Two voices icon](design/icons-round-2/icon-05-two-voices.png).

## Start

Use Node 24.18.0 and npm 11.16.0. Install the root lockfile with `npm ci`.

```powershell
npm run verify:mobile
npm run test:domain
npm run prepare:web:backend
npm run start:web:backend
```

Set the browser environment and start one Edge process before `npm run dev:web`.
Follow [Development](docs/DEVELOPMENT.md#development-workflow) for exact commands, local keys, and origin modes.

## Read first

| Document | Purpose |
|---|---|
| [Portal design](docs/README.md#browser-portal-design) | Approved browser scope |
| [Screen guide](docs/README.md#screens) | Routes, forms, states, and native flows |
| [Style guide](STYLE.md) | Colors, dimensions, and platform navigation |
| [Architecture](docs/ARCHITECTURE.md#architecture) | Modules, shared contracts, and platform capabilities |
| [Data contract](docs/ARCHITECTURE.md#data-contract) | Access, transactions, and lifecycle rules |
| [Development](docs/DEVELOPMENT.md#development-workflow) | Setup and verification commands |
| [Testing](docs/DEVELOPMENT.md#verification) | Importance ratings and acceptance limits |
| [Portal handoff](docs/DEVELOPMENT.md#portal-handoff) | Measured results, commits, and remaining checks |
| [Documentation index](docs/README.md) | Design, implementation, research, and handoffs |

## Workspace

```text
apps/mobile/       Expo screens and native capabilities
apps/web/          React DOM screens and browser capabilities
packages/domain/   Shared schemas, payloads, types, date rules, and results
supabase/          Migrations, transactions, Edge functions, and fixtures
brand/             Shared tokens and icon
apps/site/         Planned public information site
```

## Screenshots

Open [the current gallery](design/frontend-2026-10-07/web/index.html) or [the capture index](design/frontend-2026-10-07/web/README.md).
Keep [the historical gallery](design/web-portal/index.html) as its recorded-source reference.
The current gallery requires 39 routes, 119 views, and 238 viewport records.
It uses named local accounts, owned disposable normal-media fixtures, and controlled failure states.

The [older visual reference](design/preview.html) contains sample interactions without persistence.

## Delivery limits

Browser checks, backend checks, and native JavaScript exports have separate evidence.
Physical Android and iOS checks remain unverified. Windows cannot run an iOS simulator.
Read the handoff before claiming device, push, deployment, or store acceptance.

Account export, account deletion, avatar backend work, and public pages remain outside this portal delivery.
Browser push, service workers, offline content storage, and installation prompts remain outside its scope.

Read [AGENTS.md](AGENTS.md) before changing the project.
