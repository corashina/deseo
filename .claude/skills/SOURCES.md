# Skill sources

Each skill folder is an unmodified copy of its upstream files, fetched on 2026-10-06 from the `main` branch at the commit listed below.

| Skill | Upstream | Commit | Author | License |
|-------|----------|--------|--------|---------|
| `stop-slop` | https://github.com/hardikpandya/stop-slop | | Hardik Pandya | MIT (`stop-slop/LICENSE`) |
| `impeccable` | https://github.com/pbakaus/impeccable (`plugin/skills/impeccable`) | `cf3d2fa` | Paul Bakaus | Apache 2.0 (`impeccable/LICENSE`, third-party notice in `impeccable/NOTICE.md`) |
| `expo-design-system` | https://github.com/expo/skills (`plugins/expo/skills/expo-design-system`) | `d4f4840` | Expo | MIT (`expo-design-system/LICENSE`) |
| `expo-native-ui` | https://github.com/expo/skills (`plugins/expo/skills/expo-native-ui`) | `d4f4840` | Expo | MIT (`expo-native-ui/LICENSE`) |
| `expo-ui` | https://github.com/expo/skills (`plugins/expo/skills/expo-ui`) | `d4f4840` | Expo | MIT (`expo-ui/LICENSE`) |
| `expo-router` | https://github.com/expo/skills (`plugins/expo/skills/expo-router`) | `d4f4840` | Expo | MIT (`expo-router/LICENSE`) |
| `expo-animation` | https://github.com/expo/skills (`plugins/expo/skills/expo-animation`) | `d4f4840` | Expo | MIT (`expo-animation/LICENSE`) |
| `vercel-react-native-skills` | https://github.com/vercel-labs/agent-skills (`skills/react-native-skills`) | `063bee9` | Vercel | MIT, stated in the skill's front matter and the upstream README; upstream ships no license file |

The four agents in `.claude/agents/impeccable-*.md` come from `plugin/agents` in the Impeccable repository at the same commit and license. The Impeccable reference files call them by name.

Impeccable's plugin also ships edit hooks (`plugin/hooks/hooks.json`). This repository leaves them out. Run `npx impeccable install` on your machine if you want them.

The `impeccable` launcher in `impeccable/scripts/` downloads the Impeccable engine binary into `~/.impeccable/bin/` the first time it runs. If the download fails, the skill tells the agent to read `PRODUCT.md` and `DESIGN.md` directly.

To update a skill, copy the new upstream files over the old ones and change the commit and date above. Keep the license files.
