# Deseo glossary

Use these terms in code, documentation, and UI text.

| Term | Meaning |
|---|---|
| Account | One person's authenticated identity |
| Profile | That person's display name, avatar, locale, and timezone |
| Pair | A private space with two active members |
| Partner | The other member of the current pair |
| Invitation | A temporary request to join a pair |
| Event | A dated plan, either timed or all-day |
| Shared event | An event both partners can view and edit |
| Private event | An event only its author can view and edit |
| Owner label | Who an event concerns: one person or both; it does not grant access |
| Important date | An all-day event marked for a countdown; it can repeat yearly |
| Date idea | A saved activity the pair may schedule later |
| Task | An item someone can complete |
| List | A named group of shared tasks |
| Memory | A dated entry with photos and an optional caption |
| Message | A text entry in the pair's one conversation |
| Note | A pinned message; not a separate record type |
| Reminder | One person's requested notification for an event or task |
| Notification | A durable record of a reminder or partner message |
| Push | A device notification delivered through Expo, APNs, or FCM |
| Draft | Unsubmitted content stored on its author's device |
| Active pair | A pair whose two members can use shared features |
| Pending pair | A pair with one member awaiting a partner |
| Ended pair | A pair with revoked shared access and a limited author export period |
| Command | A named write operation with validation and authorization |
| Module | Code with one public interface and internal implementation |
| Interface | What a caller must know, including inputs, outputs, errors, and access rules |

Use `pairId` in TypeScript and `pair_id` in SQL. Use `userId` for an account identifier.

Do not use couple, household, workspace, or room as alternate database names for Pair.
