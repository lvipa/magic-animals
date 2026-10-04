import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createTVServer } from '../server/tv-server.mjs';
import { isolateTestContext, browserExecutable } from './browser-runtime.mjs';

// Real production service worker and native MP3s; no mocked audio/network.
const app = await createTVServer({
  port: 0,
  host: '127.0.0.1',
  ...(process.env.SING_TEST_ROOT ? { root: process.env.SING_TEST_ROOT } : {}),
});
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'allow',
  });
  await isolateTestContext(context);
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${app.port}/sing`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, {
    timeout: 60000,
  });
  await page.getByRole('button', { name: /Twinkle Star/ }).click();
  await page.getByRole('button', { name: '⚙ Для взрослых', exact: true }).click();
  await page
    .getByRole('button', { name: '⬇ Сохранить Twinkle и ABC заранее', exact: true })
    .click();
  await page.getByText('Twinkle и ABC сохранены.', { exact: false }).waitFor();
  await page.locator('.model-loading').waitFor({ state: 'detached', timeout: 45000 });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  for (const title of ['Twinkle Star', 'ABC Song']) {
    await page
      .getByRole('group', { name: 'Выбери песенку' })
      .getByRole('button', { name: new RegExp(title) })
      .click();
    await page.getByRole('button', { name: '▶ Петь!', exact: true }).click();
    await page.getByRole('button', { name: '⏸ Пауза', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('.sing-progress').value > 2);
    assert.equal(await page.getByRole('alert').count(), 0);
    console.log(`PASS real offline reload and MP3 decode/play: ${title}`);
    await page.getByLabel('Выбрать другую песенку').click();
  }
} finally {
  await browser?.close();
  await app.close();
}
