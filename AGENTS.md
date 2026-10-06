# AGENTS.md

## Writing rules

Every agent working in this repository applies the stop-slop skill to the prose it writes: README and docs, code comments, commit messages, pull request titles and descriptions, issue comments, error messages, UI text, and replies to people.

Read `.claude/skills/stop-slop/SKILL.md` and its `references/` folder before you write prose. Check each draft against the skill's quick checks and score it with the skill's rubric; revise anything below 35 of 50. Keep code, commands, paths, and quoted text unchanged.

The skill's core rules:

1. Cut filler phrases, throat-clearing openers, and adverbs.
2. Break formulaic structures such as "not X, it's Y" contrasts and dramatic fragments.
3. Use active voice and name the person who acts.
4. Be specific. Replace vague claims with the concrete thing.
5. Write to the reader as "you".
6. Vary sentence length. Use no em dashes.
7. Trust the reader. State facts without softening.
8. Rewrite any line that sounds like a pull quote.

Each skill's source and license live in `.claude/skills/SOURCES.md`.

## Design rules

Before you build or change a screen, load the design skills in `.claude/skills/`:

- `expo-design-system` decides where tokens live and when a repeated view becomes a shared component. The app's tokens start in `brand/tokens.json` and `apps/mobile/src/theme/index.ts`. Check new UI against `expo-design-system/references/native-slop.md`.
- `expo-native-ui`, `expo-ui`, `expo-router` and `expo-animation` decide what looks and moves like a native iOS or Android app.
- `impeccable` runs design reviews and passes: `/impeccable critique`, `/impeccable audit`, `/impeccable polish`, `/impeccable clarify` for UI copy. Run `/impeccable init` once to write `PRODUCT.md` before the first pass.
- `vercel-react-native-skills` covers list performance, images, safe areas and native modals.

When two skills disagree, follow the Expo skills for native platform behavior and Impeccable for visual hierarchy and copy. UI copy also follows stop-slop.
