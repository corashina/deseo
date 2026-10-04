# ADR 0001: Native app and feature modules

Date: 4 October 2026. Status: Proposed, except the owner-confirmed Expo and TypeScript choice.

## Context

Deseo needs native Android and iOS screens, shared private data, photos, invitations, and reminders.

The workspace contains a style guide and static reference. It has no product stack to preserve.

## Decision

Use Expo Router and TypeScript for the native app. Use Astro for a small static public site.

Use Supabase Auth, PostgreSQL, private Storage, Realtime, Cron, and Edge Functions.

Use one npm workspace. Keep mobile and site code in separate applications.

Group native code by feature. Keep each feature's screen, query, command, schema, and tests close together.

Share brand tokens and source icon assets. Do not share native UI with the website.

Use database constraints, current membership policies, and named transactions to protect pair data.

## Consequences

The team maintains two builds but one product backend. The public site cannot accidentally depend on native sessions.

Supabase reduces initial operations. Database policies and privileged functions require explicit security tests.

MMKV and push require development builds. Expo Go is not sufficient release evidence.

Offline support covers drafts only. A separate sync engine would need a later product decision.

## Rejected alternatives

A custom backend adds account, storage, queue, and deployment work without a current product benefit.

A shared UI package would need wrappers around unrelated native and browser controls.

Microservices, generic repositories, and a global message bus would add interfaces before real variation exists.

## Revisit when

Revisit backend limits when measured workloads exceed the current worker or database design.

Revisit offline writes when observed connectivity failures prevent pairs from completing core tasks.

Revisit public-site structure if the owner requests a full browser application.
