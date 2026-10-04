import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createTVServer } from '../server/tv-server.mjs';
import { browserExecutable, isolateTestContext } from './browser-runtime.mjs';

// Resolve the production hostname to our owned local server, exercising the
// real hostname-based choice of the PHP-shaped polling transport (no live DNS edit).
const app = await createTVServer({ port: 0, host: '127.0.0.1', root: '.deployment/dist-sing-v6' });
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: browserExecutable(),
    args: [
      '--host-resolver-rules=MAP sing.flowlabli.online 127.0.0.1',
      '--no-proxy-server',
      '--enable-webgl',
    ],
  });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await isolateTestContext(context);
  await context.route(/https:\/\/www.youtube.*\//, (route) => route.abort());
  const base = `http://sing.flowlabli.online:${app.port}`;
  // The local Node backend exposes the same protocol at /tv-poll; ISP uses PHP.
  await context.route(base + '/tv-poll.php', async (route) => {
    const response = await route.fetch({ url: `http://127.0.0.1:${app.port}/tv-poll` });
    await route.fulfill({ response });
  });
  const tv = await context.newPage(),
    phone = await context.newPage();
  let sockets = 0;
  for (const page of [tv, phone]) page.on('websocket', () => sockets++);
  await tv.goto(base + '/tv', { waitUntil: 'domcontentloaded' });
  await tv.getByRole('button', { name: 'START TV', exact: true }).click();
  await tv.waitForFunction(() =>
    /^\d{6}$/.test(document.querySelector('.tv-code')?.textContent || ''),
  );
  const code = (await tv.locator('.tv-code').textContent()).trim();
  await phone.goto(base + '/connect-tv', { waitUntil: 'domcontentloaded' });
  await phone.getByLabel('TV code').fill(code);
  await phone.getByRole('button', { name: 'Connect TV', exact: true }).click();
  await phone.getByText('TV connected ✓', { exact: true }).waitFor();
  await phone.locator('.kid-nav a[href="/sing"]').click();
  await phone.getByRole('button', { name: /If You’re Happy/ }).click();
  await tv.getByText('Подпевайте видео на телефоне.', { exact: true }).waitFor();
  await phone.getByRole('button', { name: '🐾 2. Повторяем с другом', exact: true }).click();
  await tv.getByText('clap your hands', { exact: true }).first().waitFor();
  assert.equal(sockets, 0);
  console.log(
    'PASS music-host controller/TV pairing and repeat lesson use polling without WebSocket',
  );
} finally {
  await browser?.close();
  await app.close();
}
