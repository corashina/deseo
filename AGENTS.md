- Be Brief. Use ASD-STE100 Simplified Technical English. Use one word for one idea. Do not use two words for the same thing. Write short sentences. Use 20 words or less for instructions.
- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
- Avoid allocations and repeated setup in per-frame update and render paths.
- Do not implement reduced-motion variants or `prefers-reduced-motion` handling unless the user explicitly requests it.
- Before implementing tests, give it a rating 0-100 in terms of importance and implement only those that score 90 or higher.
- Use the [unslop skill](https://github.com/michael-denyer/pstack-claude/blob/main/plugins/pstack/skills/unslop/SKILL.md) when you write or edit UI text, documentation, and code comments.

- Read [README.md](README.md), [PRODUCT.md](PRODUCT.md), and [the documentation index](docs/README.md) before product work.
- Use the terms in [the glossary](PRODUCT.md#glossary).
- Follow [the architecture](docs/ARCHITECTURE.md) and [data contract](docs/ARCHITECTURE.md#data-contract) for module and access rules.
- Follow [STYLE.md](STYLE.md) for frontend design, colors, layout, components, and interaction rules.

- Keep exactly three Markdown files in `docs`: `README.md`, `ARCHITECTURE.md`, and `DEVELOPMENT.md`.
- Do not create folders inside `docs`. Merge new documentation into these files. Keep visual assets in `design`.
