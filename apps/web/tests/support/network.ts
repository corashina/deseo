import type { Page, Request } from '@playwright/test';

// Send the request, then drop the response. The server stores the change, and the browser sees a network error.
export async function loseResponse(page: Page, url: string) {
  await page.route(url, async route => { await route.fetch(); await route.abort('failed'); }, { times: 1 });
}

// Drop the request before it reaches the server.
export async function failRequest(page: Page, url: string) {
  await page.route(url, route => route.abort('failed'), { times: 1 });
}

// Hold the first matching response until the test releases it. Other requests go through.
export async function holdRequest(page: Page, url: string, match: (request: Request) => boolean = () => true) {
  let arrived!: () => void;
  let release!: () => void;
  const reached = new Promise<void>(resolve => { arrived = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  let held = false;
  await page.route(url, async route => {
    if (held || !match(route.request())) return route.fallback();
    held = true;
    const response = await route.fetch();
    arrived();
    await gate;
    await route.fulfill({ response }).catch(() => undefined);
  });
  return { arrived: reached, release };
}
