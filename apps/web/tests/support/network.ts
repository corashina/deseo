import type { Page, Request } from '@playwright/test';

// Send the request, then drop the response. The server stores the change, and the browser sees a network error.
export async function loseResponse(page: Page, url: string) {
  await page.route(url, async route => { await route.fetch(); await route.abort('failed'); }, { times: 1 });
}

// Drop the request before it reaches the server.
export async function failRequest(page: Page, url: string) {
  await page.route(url, route => route.abort('failed'), { times: 1 });
}

// Hold the first matching request until the test releases it, then send it. Other requests go through.
export async function holdRequest(page: Page, url: string, match: (request: Request) => boolean = () => true) {
  let arrived!: () => void;
  let release!: () => void;
  const reached = new Promise<void>(resolve => { arrived = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  // Removing the route inside its own handler ends the held request, so a flag marks the first match instead.
  let held = false;
  await page.route(url, async route => {
    if (held || !match(route.request())) return route.fallback();
    held = true;
    arrived();
    await gate;
    await route.continue();
  });
  return { arrived: reached, release };
}
