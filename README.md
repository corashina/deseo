# Deseo

A private app for two people to plan days, share messages, and keep memories.

Deseo has a React browser portal and an Expo application for Android and iOS.
Both applications use shared domain contracts and the same Supabase access rules.
Work targets the web portal first. The mobile app is frozen.
The public site in `apps/site` builds static pages. Store links, policies, and account deletion are pending.

## Product

- **Today.** Upcoming plans with dates, due tasks, a memory, a note, and an important date.
- **Calendar.** Shared events, private events, important dates, and date ideas.
- **Memories.** Private photos with dates, captions, and author controls.
- **Messages.** One conversation on Today and one pinned note per person.
- **Tasks.** Shared lists, assignment, due dates, and completion.
- **Settings.** Profile, pair, fresh verification, and sign-out controls.

Each account can join one active pair. Each pair has two people.
Deseo uses pastel colors and the [Two voices icon](brand/icon-source.png).

## Start

Use Node 24.18.0, npm 11.16.0, and Docker. Run each long command in its own terminal.

```sh
npm ci
npm run backend:start
npm run functions
npm run dev
```

Follow [Development](docs/DEVELOPMENT.md#setup) for local keys, seed data, and checks.

## Read first

| Document | Purpose |
|---|---|
| [Documentation](docs/README.md) | Screens, design references, and sources |
| [Architecture](docs/ARCHITECTURE.md) | Modules, data, access, and lifecycle rules |
| [Development](docs/DEVELOPMENT.md) | Setup, verification, remaining work, and release |
| [Product](PRODUCT.md) | Purpose, scope, decisions, and glossary |
| [Design](DESIGN.md) | Colors, type, layout, components, and states |

## Workspace

```text
apps/mobile/       Expo screens and native capabilities
apps/web/          React DOM screens and browser capabilities
packages/domain/   Shared schemas, payloads, types, date rules, and results
supabase/          Migrations, transactions, Edge functions, and fixtures
brand/             Shared tokens and icon
apps/site/         Static public information site
```

## Delivery limits

Browser checks, backend checks, and native JavaScript exports have separate evidence.
Physical Android and iOS checks remain unverified. Windows cannot run an iOS simulator.
Check [verification requirements](docs/DEVELOPMENT.md#verification) before claiming device, push, deployment, or store acceptance.

Account export, account deletion, avatar backend work, and public pages remain outside this portal delivery.
Browser push, service workers, offline content storage, and installation prompts remain outside its scope.

Read [AGENTS.md](AGENTS.md) before changing the project.
