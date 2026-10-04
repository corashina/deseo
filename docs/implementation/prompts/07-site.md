# Chat 07: Public website

**Master task:** 18. **Start:** After 06. **Parallel work:** None.

**Output:** Landing, support, privacy, terms, invitation, and account-deletion pages.

## Materials

- [Execution guide](../CHAT_GUIDE.md).
- Read `docs/handoffs/06-account.md` for the working deletion contract.
- [Master Task 18](../../superpowers/plans/2026-10-04-deseo-implementation.md#task-18-public-website-and-installation-handoff).
- [Public screen guide](../../product/SCREENS.md#2-public-site).
- [Architecture](../../architecture/ARCHITECTURE.md), especially the static site boundary.
- [Style](../../../STYLE.md), [selected icon](../../design/icons-round-2/icon-05-two-voices.png), and [release inputs](../../engineering/RELEASE.md).
- [Data contract](../../architecture/DATA.md), invitation and account-deletion behavior.

Needed materials: screenshots from the working app, actual domain, support contact, operator details, and approved legal text.
Store destinations and signed association values must be real before publication.
Missing publication inputs do not block independent local page work.

## Ownership and checks

Own `apps/site`, public assets, association files, site configuration, and site tests.
Use the actual deletion backend and fresh email verification flow.

Prove mobile layout, keyboard use, invitation handoff without the app, and independent account deletion.
Check that invitation tokens do not reach logs, analytics, referrers, or generated HTML.
Check public output contains no account or pair data.

Use honest prelaunch store states. Never invent addresses, store IDs, legal approval, or privacy claims.
Record missing operator facts as publication blockers in the handoff.

**Handoff:** `docs/handoffs/07-site.md`.

## Prompt

```text
Implement Chat 07, Public website, for Deseo.
Project: C:\Users\Corashina\Documents\Projects\deseo

Read AGENTS.md and docs/implementation/prompts/07-site.md.
Read CHAT_GUIDE.md, its common materials, and docs/handoffs/06-account.md.
Use the saved design and master Task 18 as this chat's accepted scope.
Use superpowers:executing-plans inline. Do not create other chats or agents.

Verify the integrated baseline and actual deletion interface before coding.
Work serially on the recorded integration branch. Preserve unrelated changes.
Inspect existing workspace scripts and brand assets.
Check official Astro and native-link documentation before adding dependencies or association configuration.
Apply the Supabase skill when connecting authentication or deletion endpoints.

Build the static landing page, support, privacy, terms, invitation, and account-deletion pages.
Follow STYLE.md. Use concise copy and screenshots from the working native app.
Keep native screens separate from website markup.
Implement invitation handoff with app-installed and app-missing states.
Implement independently usable web deletion through Chat 06's backend and fresh verification.
Do not duplicate deletion logic or report success before the backend confirms it.

Add token redaction, no-referrer behavior, security headers, and restricted deletion-request CORS.
Use actual domain, support, operator, store, and signing values when available.
Request missing owner facts while continuing independent local work.
Never invent legal approval, business details, working store links, or association values.
Use truthful prelaunch states and record missing publication inputs in the handoff.

Rate tests before writing them. Implement only tests rated at least 90.
Run site tests, static build, responsive checks, keyboard checks, and external deletion checks.
Inspect output for token leakage and private data.
Record unavailable production-domain checks separately.

Commit tested code, then write docs/handoffs/07-site.md using the handoff template.
Record routes, backend dependencies, real screenshots, check results, and publication blockers.
Commit the report separately. Report the final integration tip for Chat 08.
Do not provision remote services, deploy, submit builds, or contact real users.
```
