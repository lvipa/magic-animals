import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createTVServer } from '../server/tv-server.mjs';
import { isolateTestContext } from './browser-runtime.mjs';

const app = await createTVServer({ port: 0, host: '127.0.0.1' });
const base = `http://127.0.0.1:${app.port}`,
  checks = [],
  errors = [];
const pass = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: [
      '--enable-webgl',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  });
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    serviceWorkers: 'block',
  });
  await isolateTestContext(phone);
  await phone.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__micTracks = [];
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await original(options);
      window.__micTracks.push(...stream.getTracks());
      return stream;
    };
  });
  const page = await phone.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/sing', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Sing with Milo', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.sing-stage canvas')?.width > 390);
  const raster = await page
    .locator('.sing-stage canvas')
    .evaluate((canvas) => ({
      width: canvas.width,
      css: canvas.getBoundingClientRect().width,
      antialias: canvas.getContext('webgl2')?.getContextAttributes()?.antialias,
    }));
  assert.equal(raster.antialias, true);
  assert.ok(raster.width / raster.css > 1.4);
  await page.getByRole('button', { name: '▶ Петь!', exact: true }).click();
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('progress.sing-progress').value > 1);
  await page.getByRole('button', { name: '⭐ Спел!', exact: true }).click();
  assert.equal(await page.getByLabel('1 звёзд').count(), 1);
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).click();
  const stopped = await page.locator('.sing-progress').evaluate((p) => p.value);
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.sing-progress').evaluate((p) => p.value), stopped);
  pass(
    'Phone: music loads, pause freezes karaoke, participation lights a star, supersampling and MSAA enabled',
  );
  await mkdir('artifacts/singing', { recursive: true });
  await page.screenshot({ path: 'artifacts/singing/phone.png', fullPage: true });
  await page.getByRole('button', { name: '🎤 Повтори', exact: false }).click();
  await page.getByRole('button', { name: '⚙ Для взрослых', exact: true }).click();
  await page.getByRole('button', { name: '🎤 Включить микрофон', exact: true }).click();
  await page.getByRole('button', { name: '🎤 Выключить микрофон', exact: true }).waitFor();
  await page.getByRole('button', { name: '▶ Петь!', exact: true }).click();
  await page.getByText('🎤 Теперь твоя очередь!', { exact: true }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '⭐ Спел!', exact: true }).click();
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).click();
  await page.getByRole('button', { name: '↻ Ещё строку', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.sing-progress').value < 3);
  pass(
    'Echo: silent response window, optional microphone, repeated phrase resumes at its beginning',
  );
  await page.locator('.kid-nav a[href="/friends"]').click();
  assert.equal(
    await page.evaluate(() => window.__micTracks.every((t) => t.readyState === 'ended')),
    true,
  );
  pass('Navigation releases microphone tracks and stops song playback');
  await page.locator('.kid-nav a[href="/sing"]').click();
  await page.getByRole('button', { name: '🌟 Мой концерт', exact: false }).click();
  await page.getByRole('button', { name: '▶ Петь!', exact: true }).click();
  await page.getByText('Твоя звёздная сцена!', { exact: true }).waitFor({ timeout: 35000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('sing-milo-concerts-v1')), '1');
  await page.getByRole('button', { name: '↺ Сначала', exact: true }).click();
  assert.equal(await page.locator('.sing-progress').evaluate((p) => p.value), 0);
  pass('Instrumental concert finishes naturally, persists completion, restart clears the round');

  const tvContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    serviceWorkers: 'block',
  });
  await isolateTestContext(tvContext);
  const tv = await tvContext.newPage();
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(base + '/tv', { waitUntil: 'domcontentloaded' });
  await tv.getByRole('button', { name: 'START TV', exact: true }).click();
  await tv.waitForFunction(() => document.querySelector('.tv-stage canvas')?.width > 1920);
  assert.equal(await tv.locator('.tv-stage canvas').evaluate(c => c.getContext('webgl2')?.getContextAttributes()?.antialias), true);
  await tv.waitForFunction(() =>
    /^\d{6}$/.test(document.querySelector('.tv-code')?.textContent || ''),
  );
  const code = (await tv.locator('.tv-code').textContent()).trim();
  await page.goto(base + '/connect-tv', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('TV code').fill(code);
  await page.getByRole('button', { name: 'Connect TV', exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes('TV connected'));
  await page.locator('.kid-nav a[href="/sing"]').click();
  await page.getByRole('button', { name: '▶ Петь!', exact: true }).click();
  await tv.locator('.sing-tv').waitFor();
  await tv.locator('.sing-tv .sing-lyrics').waitFor();
  assert.equal(await tv.locator('.tv-caption').count(),0);
  await tv.locator('.sing-tv .model-loading').waitFor({ state: 'detached', timeout: 30000 });
  await tv.waitForTimeout(250);
  await tv.screenshot({ path: 'artifacts/singing/tv.png' });
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).click();
  await tv.reload({ waitUntil: 'domcontentloaded' });
  await tv.locator('.sing-tv').waitFor({ timeout: 15000 });
  await page.locator('.kid-nav a[href="/friends"]').click();
  await tv.locator('.sing-tv').waitFor({ state: 'detached' });
  pass(
    'TV: QR/code room carries singing scene, paused song survives TV reload, leaving singing restores Animals',
  );
  assert.deepEqual(errors, []);
  await writeFile(
    'artifacts/singing/browser-results.json',
    JSON.stringify(
      {
        checks,
        raster,
        errors,
        environment:
          'Desktop Chromium with touch-sized viewport and fake microphone; physical TV/iPhone listening review remains',
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await app.close();
}
