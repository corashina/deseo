import type { Page, Request, Route } from '@playwright/test';

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
  const handler = async (route: Route) => {
    if (!match(route.request())) return route.fallback();
    await page.unroute(url, handler);
    arrived();
    await gate;
    await route.continue();
  };
  await page.route(url, handler);
  return { arrived: reached, release };
}
