import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createTVServer } from '../server/tv-server.mjs';
import { browserExecutable, isolateTestContext } from './browser-runtime.mjs';

const app = await createTVServer({
  port: 0,
  host: '127.0.0.1',
  ...(process.env.SING_TEST_ROOT ? { root: process.env.SING_TEST_ROOT } : {}),
});
let browser, release;
try {
  browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
  });
  await isolateTestContext(context);
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let held = false;
  await context.route(/\/assets\/SingPage-.*\.js$/, async (route) => {
    if (!held) {
      held = true;
      await gate;
    }
    await route.continue().catch(() => {}); // An opening-menu navigation may cancel this request.
  });
  const forbidden = [];
  await context.route(
    /\/assets\/(authoredCat|StudioLighting|MindARProvider)-|\/models\/.*\.glb/,
    (route) => {
      forbidden.push(route.request().url());
      return route.abort();
    },
  );
  // The external platform is irrelevant to opening the owned page.
  await context.route(/https:\/\/www.youtube.*\//, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${app.port}/sing`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Открываем игру…', { exact: true }).waitFor();
  await page
    .getByRole('navigation', { name: 'Детское меню' })
    .getByRole('link', { name: /TV/ })
    .click();
  await page.getByLabel('TV code').waitFor();
  console.log('PASS navigation stays usable while song page code is deliberately held');
  release();
  await page.locator('.kid-nav a[href="/sing"]').click();
  await page.getByRole('group', { name: 'Выбери песенку' }).waitFor();
  const bytes = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((r) => r.name.includes('/assets/') && r.name.endsWith('.js'))
      .reduce((n, r) => n + r.decodedBodySize, 0),
  );
  assert.ok(bytes < 450000, `Lightweight menus downloaded ${bytes} JS bytes`);
  await page.getByRole('button', { name: /The Wheels on the Bus/ }).click();
  await page.locator('.sing-official-video iframe').waitFor();
  assert.equal(await page.locator('.sing-stage').count(), 0);
  assert.deepEqual(forbidden, []);
  await page.screenshot({ path: 'artifacts/singing/watch-phone.png', fullPage: true });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: 'artifacts/singing/watch-landscape.png', fullPage: true });
  console.log(
    `PASS chooser/watch page opens without Three.js, AR or GLBs; menus use ${bytes} JS bytes`,
  );
} finally {
  release?.();
  await browser?.close();
  await app.close();
}
