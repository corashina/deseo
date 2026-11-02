# Screen review, November 2026

These captures show the web portal before the unslop screen fixes. The fix list is a Claude Doc: https://claude.ai/artifact/8v8qw97p7ZVwu5XDeCZUJm

`before/narrow` holds 390 px captures. `before/desktop` holds 1280 px captures. Each file name is the route, with fixture IDs replaced by their fixture name.

The display clock is 5 October 2026, 10:00 Europe/Warsaw. Message times use the real seed time.
Memory photos are missing, because the local Edge runtime could not load its packages during the seed.

To capture again, start the backend, run `npm run seed:web`, build and serve the portal on port 4174, and run this command:

```bash
GROCERIES_LIST_ID=<Groceries list ID> node --experimental-strip-types design/unslop-2026-11/capture.ts
```
