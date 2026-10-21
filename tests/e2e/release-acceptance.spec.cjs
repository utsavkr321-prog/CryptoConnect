const { test, expect } = require(process.env.PLAYWRIGHT_MODULE);
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const appUrl = process.env.CC_APP_URL ?? 'http://127.0.0.1:5173';
const apiUrl = process.env.CC_API_URL ?? 'http://127.0.0.1:18080';
const responsiveViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
const responsiveRoutes = [
  ['/dashboard', 'Dashboard'],
  ['/chat', 'Secure Chat'],
  ['/visualizer', 'Encryption Visualizer'],
  ['/security-lab', 'Security Lab'],
  ['/contacts', 'Contacts'],
  ['/events', 'Security Events'],
  ['/settings', 'Settings'],
];

async function expectNoHorizontalOverflow(page, size, route) {
  const overflowingRegion = await page.evaluate(() => {
    const regions = [document.documentElement, document.body, document.querySelector('main')].filter(Boolean);
    return regions.find((region) => region.scrollWidth > region.clientWidth + 1)?.tagName ?? null;
  });
  expect(overflowingRegion, `${route} overflowed horizontally at ${size.width}x${size.height}`).toBeNull();
}

test('two isolated profiles register, exchange live messages, recover, and revoke a token', async ({ browser }) => {
  test.setTimeout(360_000);
  const runTag = randomUUID();
  const password = `Cc-ci-${randomUUID()}-aA9!`;
  const accounts = [
    { name: `CI Alice ${runTag.slice(0, 8)} ${'extended-'.repeat(3)}`, email: `alice-${runTag}@example.test`, password },
    { name: `CI Bob ${runTag.slice(0, 8)} ${'extended-'.repeat(3)}`, email: `bob-${runTag}@example.test`, password: `Cc-ci-${randomUUID()}-bB7!` },
  ];
  const failures = [];
  const contexts = [await browser.newContext(), await browser.newContext()];
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  await Promise.all(contexts.map((context) => context.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }))));
  await Promise.all(contexts.map((context) => context.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.__ccWebSocketOpens = 0;
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args) {
        super(...args);
        this.addEventListener('open', () => { window.__ccWebSocketOpens += 1; });
      }
    };
  })));

  for (const page of pages) {
    page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error'
        && !/WebSocket.*(?:failed|closed)/i.test(message.text())
        // The flow intentionally submits a duplicate contact request and asserts its HTTP 409 response.
        && !/status of 409/.test(message.text()))
        failures.push(`console: ${message.text()}`);
    });
    page.on('requestfailed', (request) => {
      if (request.resourceType() !== 'websocket') failures.push(`request failed: ${request.method()} ${request.url()}`);
    });
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 400)
        failures.push(`API ${response.status()}: ${response.request().method()} ${response.url()}`);
    });
  }

  async function register(page, account) {
    await page.goto(`${appUrl}/login`);
    await page.getByRole('button', { name: 'Create Account', exact: true }).first().click();
    await page.locator('#auth-name').fill(account.name);
    await page.locator('#auth-email').fill(account.email);
    await page.locator('#auth-password').fill(account.password);
    await page.locator('form').getByRole('button', { name: 'Create Account', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  }

  try {
    await register(pages[0], accounts[0]);
    await register(pages[1], accounts[1]);

    const contactResults = await pages[0].evaluate(async ({ email, api }) => {
      const token = sessionStorage.getItem('cc_access_token');
      const search = await fetch(`${api}/api/users?query=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const [user] = await search.json();
      const body = JSON.stringify({ userId: user.id });
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const add = await fetch(`${api}/api/contacts`, { method: 'POST', headers, body });
      const duplicate = await fetch(`${api}/api/contacts`, { method: 'POST', headers, body });
      return { search: search.status, add: add.status, duplicate: duplicate.status };
    }, { email: accounts[1].email, api: apiUrl });
    expect(contactResults).toEqual({ search: 200, add: 201, duplicate: 409 });

    await pages[0].goto(`${appUrl}/chat`);
    await pages[0].getByRole('button', { name: 'Start a conversation' }).click();
    await pages[0].locator('#registered-user-search').fill(accounts[1].email);
    const userResult = pages[0].getByRole('button').filter({ hasText: accounts[1].email });
    await expect(userResult).toBeVisible();
    await userResult.click();
    await expect(pages[0].getByRole('textbox', { name: 'Message' })).toBeVisible();

    // Exercise every protected route at the supported device classes using the authenticated test profile.
    for (const size of responsiveViewports) {
      await pages[0].setViewportSize(size);
      for (const [route, heading] of responsiveRoutes) {
        await pages[0].goto(`${appUrl}${route}`);
        await expect(pages[0].getByRole('heading', { name: heading, exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(pages[0], size, route);

        if (route === '/dashboard' && size.width === 320) {
          const menuButton = pages[0].getByRole('button', { name: 'Open menu' });
          const menuBounds = await menuButton.boundingBox();
          expect(menuBounds).not.toBeNull();
          expect(menuBounds.width).toBeGreaterThanOrEqual(44);
          expect(menuBounds.height).toBeGreaterThanOrEqual(44);
          await menuButton.click();
          const navigationDialog = pages[0].getByRole('dialog', { name: 'Main navigation' });
          await expect(navigationDialog).toBeVisible();
          await expect(navigationDialog).toHaveAttribute('aria-modal', 'true');
          const firstNavigationLink = pages[0].getByRole('link', { name: 'Dashboard', exact: true });
          const lastNavigationControl = pages[0].getByRole('button', { name: 'Logout' });
          await expect(firstNavigationLink).toBeFocused();
          await pages[0].keyboard.press('Shift+Tab');
          await expect(lastNavigationControl).toBeFocused();
          await pages[0].keyboard.press('Tab');
          await expect(firstNavigationLink).toBeFocused();
          await pages[0].keyboard.press('Escape');
          await expect(navigationDialog).toHaveCount(0);
          await expect(menuButton).toBeFocused();
        }

        if (route === '/chat' && size.width < 768) {
          const conversationItem = pages[0].getByRole('button').filter({ hasText: accounts[1].name }).first();
          await expect(conversationItem).toBeVisible();
          await expect.poll(() => pages[0].evaluate(() => window.__ccWebSocketOpens)).toBeGreaterThan(0);
          const socketOpensBeforeViewSwitch = await pages[0].evaluate(() => window.__ccWebSocketOpens);
          await conversationItem.click();
          await expect(conversationItem).toBeHidden();
          const composer = pages[0].getByRole('textbox', { name: 'Message' });
          await expect(composer).toBeVisible();
          const backToList = pages[0].getByRole('button', { name: 'Back to conversations' });
          await expect(backToList).toBeVisible();
          const composerBounds = await composer.boundingBox();
          expect(composerBounds).not.toBeNull();
          expect(composerBounds.y + composerBounds.height).toBeLessThanOrEqual(size.height);
          await backToList.click();
          await expect(conversationItem).toBeVisible();
          await expect.poll(() => pages[0].evaluate(() => window.__ccWebSocketOpens)).toBe(socketOpensBeforeViewSwitch);
        }

        if (route === '/chat' && size.width >= 768) {
          await expect(pages[0].getByRole('button').filter({ hasText: accounts[1].name }).first()).toBeVisible();
          await expect(pages[0].getByRole('textbox', { name: 'Message' })).toBeVisible();
        }
      }
    }

    // A short viewport approximates the reduced visual area available while a mobile keyboard is open.
    await pages[0].setViewportSize({ width: 390, height: 360 });
    await pages[0].goto(`${appUrl}/chat`);
    const compactConversation = pages[0].getByRole('button').filter({ hasText: accounts[1].name }).first();
    await expect(compactConversation).toBeVisible();
    await compactConversation.click();
    const compactComposer = pages[0].getByRole('textbox', { name: 'Message' });
    await expect(compactComposer).toBeVisible();
    const compactComposerBounds = await compactComposer.boundingBox();
    expect(compactComposerBounds).not.toBeNull();
    expect(compactComposerBounds.y + compactComposerBounds.height).toBeLessThanOrEqual(360);
    await pages[0].setViewportSize({ width: 1280, height: 800 });

    await pages[1].goto(`${appUrl}/chat`);
    const conversation = pages[1].getByRole('button').filter({ hasText: accounts[0].name });
    await expect(conversation).toBeVisible();
    await conversation.click();
    await expect(pages[0].getByText('Live connection')).toBeVisible();
    await expect(pages[1].getByText('Live connection')).toBeVisible();

    const aToB = `A-to-B-${runTag}`;
    await pages[0].getByRole('textbox', { name: 'Message' }).fill(aToB);
    await pages[0].getByRole('button', { name: 'Send message' }).click();
    await expect(pages[0].locator('.message-sent').filter({ hasText: aToB })).toBeVisible();
    await expect(pages[1].locator('.message-received').filter({ hasText: aToB })).toBeVisible();
    await expect(pages[0].locator('[title="Read by recipient"]').first()).toBeVisible();

    const longMessage = `Long URL: https://example.test/${'a'.repeat(1500)}`;
    await pages[0].setViewportSize({ width: 320, height: 568 });
    await pages[0].getByRole('textbox', { name: 'Message' }).fill(longMessage);
    await pages[0].getByRole('button', { name: 'Send message' }).click();
    const longSent = pages[0].locator('.message-sent').filter({ hasText: longMessage });
    await expect(longSent).toBeVisible();
    await expect(pages[1].locator('.message-received').filter({ hasText: longMessage })).toBeVisible();
    const longBubbleBounds = await longSent.boundingBox();
    expect(longBubbleBounds).not.toBeNull();
    expect(longBubbleBounds.width).toBeLessThanOrEqual(320);
    await expectNoHorizontalOverflow(pages[0], { width: 320, height: 568 }, '/chat long message');
    await pages[0].setViewportSize({ width: 1280, height: 800 });

    const bToA = `B-to-A-${runTag}`;
    await pages[1].getByRole('textbox', { name: 'Message' }).fill(bToA);
    await pages[1].getByRole('button', { name: 'Send message' }).click();
    await expect(pages[1].locator('.message-sent').filter({ hasText: bToA })).toBeVisible();
    await expect(pages[0].locator('.message-received').filter({ hasText: bToA })).toBeVisible();

    const browserState = await pages[0].evaluate(async (api) => {
      const token = sessionStorage.getItem('cc_access_token');
      const response = await fetch(`${api}/api/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      const [conversation] = await response.json();
      const historyResponse = await fetch(`${api}/api/conversations/${conversation.id}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      const history = await historyResponse.json();
      return { conversationId: conversation.id, messageIds: history.map((message) => message.id) };
    }, apiUrl);
    expect(browserState.messageIds.length).toBeGreaterThanOrEqual(2);

    const duplicateResult = await pages[0].evaluate(async ({ conversationId, api, runTag }) => {
      const token = sessionStorage.getItem('cc_access_token');
      const body = JSON.stringify({
        clientMessageId: `duplicate-${crypto.randomUUID()}`,
        content: `duplicate-${runTag}`,
      });
      const options = { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body };
      const first = await fetch(`${api}/api/conversations/${conversationId}/messages`, options);
      const firstMessage = await first.json();
      const second = await fetch(`${api}/api/conversations/${conversationId}/messages`, options);
      const secondMessage = await second.json();
      return { firstStatus: first.status, secondStatus: second.status, sameId: firstMessage.id === secondMessage.id };
    }, { conversationId: browserState.conversationId, api: apiUrl, runTag });
    expect(duplicateResult).toEqual({ firstStatus: 201, secondStatus: 200, sameId: true });

    if (process.env.CC_RESTART_BACKEND !== 'false') {
      const previousSocketOpens = await Promise.all(pages.map((page) => page.evaluate(() => window.__ccWebSocketOpens)));
      execFileSync('docker', [
        'compose', '--env-file', process.env.COMPOSE_ENV_FILE,
        '-f', process.env.CC_COMPOSE_FILE, '-p', process.env.CC_COMPOSE_PROJECT,
        'restart', 'backend',
      ], { stdio: 'pipe' });
      await expect.poll(async () => (await fetch(`${apiUrl}/health/ready`)).status, { timeout: 90_000 }).toBe(200);
      await Promise.all(pages.map((page, index) => expect.poll(
        () => page.evaluate(() => window.__ccWebSocketOpens), { timeout: 60_000 },
      ).toBeGreaterThan(previousSocketOpens[index])));
      await expect(pages[0].getByText('Live connection')).toBeVisible();
      await expect(pages[1].getByText('Live connection')).toBeVisible();
    }

    const followup = `${process.env.CC_RESTART_BACKEND === 'false' ? 'followup' : 'after-restart'}-${runTag}`;
    await pages[0].getByRole('textbox', { name: 'Message' }).fill(followup);
    await pages[0].getByRole('button', { name: 'Send message' }).click();
    await expect(pages[1].locator('.message-received').filter({ hasText: followup })).toBeVisible();
    await pages[1].reload();
    await expect(pages[1].getByRole('heading', { name: 'Secure Chat' })).toBeVisible();
    await expect(pages[1].getByRole('button').filter({ hasText: accounts[0].name })).toBeVisible();
    await pages[1].getByRole('button').filter({ hasText: accounts[0].name }).click();
    await expect(pages[1].locator('.message-received').filter({ hasText: aToB })).toBeVisible();
    await expect(pages[1].locator('.message-sent').filter({ hasText: bToA })).toBeVisible();
    await expect(pages[1].locator('.message-received').filter({ hasText: followup })).toBeVisible();

    const revokedToken = await pages[1].evaluate(() => sessionStorage.getItem('cc_access_token'));
    await pages[1].getByRole('button', { name: 'Logout' }).click();
    await expect(pages[1]).toHaveURL(/\/login$/);
    await expect.poll(async () => (await fetch(`${apiUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${revokedToken}` } })).status).toBe(401);
    await pages[1].getByRole('button', { name: 'Sign In', exact: true }).first().click();
    await pages[1].locator('#auth-email').fill(accounts[1].email);
    await pages[1].locator('#auth-password').fill(accounts[1].password);
    await pages[1].locator('form').getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(pages[1]).toHaveURL(/\/dashboard$/);

    expect(failures.filter((failure) => !failure.includes('API 409: POST ') || !failure.includes('/api/contacts'))).toEqual([]);
    fs.writeFileSync(process.env.ACCEPTANCE_STATE_PATH, JSON.stringify({ ...browserState, accounts }), { mode: 0o600 });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
