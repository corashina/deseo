# Architecture review before implementation

Reviewed: 4 October 2026. Scope: the design documents and planned product structure.

## Method

Applied Matt Pocock's [Improve Codebase Architecture](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md) skill.

Also read its [Codebase Design](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md) vocabulary.

The skill normally reviews existing implementation. This project has no runtime code, dependencies, tests, or Git history.

I adapted the review to the proposed modules before scaffolding. A read-only scout checked the existing files and risks.

No existing-code refactoring or runtime validation is claimed.

## Applied decisions

| Finding | Without the decision | Selected design | Strength |
|---|---|---|---|
| Pair membership affects every feature | Each screen interprets pair state and access | Pair commands and database policies enforce one membership model | Strong |
| Notes and messages have the same lifecycle | Two write paths, permissions, and retry rules | A note is a pinned message | Strong |
| Today displays other features' records | Duplicate tables become inconsistent | Today composes existing feature queries | Strong |
| Reminders cross calendar, tasks, devices, and timezones | Screen timers lose work when the app closes | Durable jobs with current authorization checks | Strong |
| Shared edits and retries can conflict | Every form invents its own persistence behavior | Named commands use versions and idempotent identifiers | Strong |
| Public pages and native interaction differ | Shared UI wrappers hide platform behavior | Separate mobile and site folders; share visual data only | Strong |

These decisions keep related rules together and give callers a small interface.

## Interfaces that earn their place

- Pair commands hide token handling, locking, capacity, and membership transitions.
- Calendar commands hide visibility rules, time conversion, version checks, and reminder changes.
- Memory finalization hides validation, quota, publication, and orphan cleanup.
- Message commands hide duplicate prevention and note replacement.

Removing these interfaces would spread their rules across screens and workers.

Do not add generic repositories, a global event bus, interchangeable backend adapters, or a second form framework.

Those abstractions have no second implementation or current consumer need.

## System alternatives

| Option | Assessment |
|---|---|
| Expo + static site + Supabase | Recommended. Native experience with managed account, data, storage, and delivery infrastructure |
| Universal Expo app for native and all website pages | Fewer build tools, but public document markup and native account flows become coupled |
| Expo + custom Node backend + separate database/storage | More operational work before the pair flow works; no current requirement justifies it |

Keep the static site narrow. Do not add server rendering, a CMS, or native UI sharing to it.

## First implementation priority

Prove pairing and pair isolation before broad screen work.

The first useful product is two verified people sharing one event. Security and data correctness belong in that slice.

See [ADR 0001](../adr/0001-mobile-stack-and-module-structure.md) and [the implementation plan](../superpowers/plans/2026-10-04-deseo-implementation.md).
