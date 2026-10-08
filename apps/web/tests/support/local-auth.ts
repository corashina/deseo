import { expect, type Page, type Request } from '@playwright/test';

export async function readLocalCode(email: string): Promise<string> {
  let code = '';
  await expect.poll(async () => {
    const response = await fetch(`http://127.0.0.1:55724/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const data = await response.json();
    const message = data.messages?.[0];
    if (!message) return false;
    const body = await (await fetch(`http://127.0.0.1:55724/api/v1/message/${message.ID}`)).json();
    code = (body.Text || body.HTML).match(/\b\d{6}\b/)?.[0] ?? '';
    return Boolean(code);
  }, { timeout: 15000 }).toBe(true);
  return code;
}
export async function loginWithLocalEmailCode(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  await expect(page.getByLabel('Sign-in code')).toBeVisible();
  await page.getByLabel('Sign-in code').fill(await readLocalCode(email));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/verify/);
}

// Observe authority signals without holding or changing their delivery.
export async function observeOwnSessionChanges(page: Page, userId: string) {
  const changes: Array<{ table: string; record: Record<string, unknown> }> = [];
  let joined = false;
  let currentSocket = 0;
  await page.routeWebSocket('**/realtime/v1/websocket*', socket => {
    const generation = ++currentSocket;
    joined = false;
    const server = socket.connectToServer();
    server.onMessage(message => {
      let values;
      try { values = JSON.parse(String(message)); } catch { socket.send(message); return; }
      if (Array.isArray(values)) {
        const [, , topic, event, payload] = values;
        if (generation === currentSocket && String(topic).includes('portal-membership:' + userId)) {
          if (event === 'phx_reply' && payload?.status === 'ok') joined = true;
          const change = payload?.data;
          if (event === 'postgres_changes' && change?.record?.user_id === userId)
            changes.push({ table: change.table, record: change.record });
        }
      }
      socket.send(message);
    });
  });
  return {
    changes, joined: () => joined,
    // Register reads before mutation. Accept only the verification started after its observed signals.
    prepareRecovery(version: number, pairId: () => string, observed: () => boolean) {
      let verifying = false;
      const requests = new Map<Request, number>();
      const started = (request: Request) => { if (verifying) requests.set(request, requests.size); };
      page.on('request', started);
      const session = page.waitForResponse(async response => {
        if (!requests.has(response.request()) || !response.url().endsWith('/rpc/get_session_context')) return false;
        try {
          const result = await response.json();
          return response.ok() && result.ok && result.data.userId === userId && result.data.account?.version >= version;
        } catch { return false; }
      });
      const pair = page.waitForResponse(async response => {
        if (!requests.has(response.request()) || !response.url().endsWith('/rpc/get_pair_context')) return false;
        try {
          const account = await session;
          if (requests.get(response.request())! <= requests.get(account.request())!) return false;
          const result = await response.json();
          return response.ok() && result.ok && result.data.pairId === pairId();
        } catch { return false; }
      });
      return async () => {
        try {
          await expect.poll(observed).toBe(true);
          verifying = true;
          await page.evaluate(() => window.dispatchEvent(new Event('focus')));
          await session;
          await pair;
        } finally { page.off('request', started); }
      };
    },
  };
}
