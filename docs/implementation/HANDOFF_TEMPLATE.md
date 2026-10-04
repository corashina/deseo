# Chat handoff template

Copy this structure into the assigned `docs/handoffs/NN-name.md` file.

Replace each instruction with the actual result. Never include secrets or private user content.

## Identity

- Chat number and scope: record the assigned brief.
- Master tasks: list full and partial task coverage.
- Branch and worktree: record their actual names and paths.
- Base commit: record the starting integration commit.
- Tested code commit: record the commit that passed the listed checks.
- Integration branch: record where the work belongs.

## Status

- Code status: In progress, Blocked, Ready for integration, or Integrated.
- Device status: Pending or Verified, with platforms named.
- Release status: Not assessed, Blocked, or Candidate ready for owner review.

## Implemented behavior

List working user flows. Separate completed behavior from integration work assigned to a later chat.

## Changed files

List feature folders, routes, migration files, functions, dependency changes, and generated files.

## Public interfaces

Record exact exports, types, parameter names, return values, query keys, error codes, and import paths.

Record assumptions about authentication, membership, local drafts, source IDs, and cancellation.

## Database and dependencies

List migration order, new tables/functions/policies, and any shared schema dependencies.

Record local project ID and ports. Do not include connection passwords or tokens.

List added package versions and any native configuration changes needed during integration.

## Verification

| Check | Importance | Exact command or device action | Actual result |
|---|---|---|---|
| Record each relevant check | Record score before implementing a test | Record the actual command or action | Passed, failed, or not run |

Include environment, device, operating system, build ID, and evidence paths when applicable.

## Integration instructions

Name routes and shared screens to wire. Include exact feature exports and required schema ordering.

List unresolved conflicts or interface requests. Do not silently redefine the common contract.

## Remaining work

Separate code gaps, missing credentials, unavailable devices, human usability checks, and owner release inputs.

Name the next eligible chat. Explain whether the current result is safe as its starting point.
