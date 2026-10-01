import { chromium } from 'playwright';
import { mkdir, writeFile, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  browserExecutable,
  isInjectedSecurityURL,
  isolateTestContext,
} from './browser-runtime.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const executablePath = browserExecutable();
await mkdir('.test-artifacts', { recursive: true });
await mkdir('artifacts', { recursive: true });
const report = [],
  errors = [];
const pass = (name) => {
  report.push(name);
  console.log('PASS', name);
};
// Use the regular graphics path, as on the production device. Forced
// SwiftShader on this Windows host can stall both UI timers and audio.
const browserArgs = ['--enable-webgl'];
async function hold(page, locator, duration) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Hold button missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(duration);
  await page.mouse.up();
}
async function parentGate(page) {
  await hold(page, page.locator('.parent-corner'), 3100);
  await hold(page, page.getByRole('button', { name: 'Hold PARENT' }), 2100);
  await page.waitForURL('**/parent');
}
const browser = await chromium.launch({ headless: true, executablePath, args: browserArgs });
try {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await isolateTestContext(context);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'artifacts/welcome-landscape.png' });
  pass('Welcome and original Foxy render');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw new Error('Landscape overflows horizontally');
  await parentGate(page);
  pass('3 second corner + 2 second parent gate');
  await page.getByRole('button', { name: 'Exit parent mode' }).click();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Test permission denied', 'NotAllowedError'));
  });
  await page.reload();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page
    .getByRole('button', { name: 'PLAY WITHOUT CAMERA' })
    .waitFor({ timeout: 20000 })
    .catch(async (error) => {
      await page.screenshot({ path: 'artifacts/camera-denial-failure.png' });
      console.error('Camera fallback diagnostics:', await page.locator('body').innerText(), errors);
      throw error;
    });
  await page.getByRole('button', { name: 'PLAY WITHOUT CAMERA' }).click();
  await page.locator('.speech').filter({ hasText: 'Find the CAT!' }).waitFor({ timeout: 12000 });
  await page.getByRole('button', { name: 'Play with CAT' }).click();
  await page.getByText('CAT!', { exact: true }).waitFor({ timeout: 8000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/cat-3d.png' });
  await page.locator('.speech').filter({ hasText: 'Find the DOG!' }).waitFor({ timeout: 15000 });
  pass('Camera denial → explicit 3D choice → animated CAT → DOG');
  await parentGate(page);
  await page.getByRole('button', { name: 'Force LION' }).click();
  await page.locator('.free-note').waitFor();
  await page.waitForTimeout(1500);
  if (!(await page.locator('.speech').innerText()).includes('LION'))
    throw new Error('Force LION missing');
  pass('Parent force controls and Free Play');
  await context.close();
  const portrait = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await isolateTestContext(portrait);
  const phone = await portrait.newPage();
  await phone.goto(base);
  await phone.waitForTimeout(1000);
  await phone.screenshot({ path: 'artifacts/welcome-portrait.png' });
  if (await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error('Portrait overflows');
  pass('Portrait welcome has no horizontal overflow');
  await portrait.close();
  // Construct test camera video from only the generated paper targets, never user camera data.
  const raster = await browser.newPage();
  const yuv = [];
  for (const id of ['cat', 'dog', 'lion']) {
    await raster.goto(`${base}/markers/milo-v2/${id}.png`);
    const rgba = await raster.evaluate(async () => {
      const image = document.querySelector('img');
      await image.decode();
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 480;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#81959d';
      ctx.fillRect(0, 0, 640, 480);
      ctx.save();
      ctx.translate(320, 240);
      ctx.rotate(0.05);
      ctx.drawImage(image, -260, -189, 520, 378);
      ctx.restore();
      return [...ctx.getImageData(0, 0, 640, 480).data];
    });
    const frame = Buffer.alloc((640 * 480 * 3) / 2),
      clamp = (x) => Math.max(0, Math.min(255, Math.round(x)));
    for (let y = 0; y < 480; y++)
      for (let x = 0; x < 640; x++) {
        const i = (y * 640 + x) * 4,
          r = rgba[i],
          g = rgba[i + 1],
          b = rgba[i + 2];
        frame[y * 640 + x] = clamp(16 + 0.257 * r + 0.504 * g + 0.098 * b);
      }
    for (let y = 0; y < 480; y += 2)
      for (let x = 0; x < 640; x += 2) {
        let r = 0,
          g = 0,
          b = 0;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const i = ((y + dy) * 640 + x + dx) * 4;
            r += rgba[i] / 4;
            g += rgba[i + 1] / 4;
            b += rgba[i + 2] / 4;
          }
        const j = (y / 2) * 320 + x / 2;
        frame[640 * 480 + j] = clamp(128 - 0.148 * r - 0.291 * g + 0.439 * b);
        frame[640 * 480 + 320 * 240 + j] = clamp(128 + 0.439 * r - 0.368 * g - 0.071 * b);
      }
    yuv.push(frame);
  }
  await raster.close();
  const cameraFile = resolve('.test-artifacts/cards.y4m');
  const video = await open(cameraFile, 'w');
  await video.write('YUV4MPEG2 W640 H480 F2:1 Ip A1:1 C420jpeg\n');
  for (const frame of yuv)
    for (let i = 0; i < 30; i++) {
      await video.write('FRAME\n');
      await video.write(frame);
    }
  await video.close();
  const arBrowser = await chromium.launch({
    headless: true,
    executablePath,
    args: [
      ...browserArgs,
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${cameraFile}`,
    ],
  });
  try {
    const arContext = await arBrowser.newContext({
      viewport: { width: 1180, height: 820 },
      permissions: ['camera'],
    });
    await isolateTestContext(arContext);
    const arPage = await arContext.newPage();
    const requests = [];
    arPage.on('request', (r) => {
      if (!isInjectedSecurityURL(r.url())) requests.push({ url: r.url(), method: r.method() });
    });
    arPage.on('pageerror', (e) => errors.push(e.message));
    await arPage.goto(`${base}/marker-test`);
    await hold(arPage, arPage.getByRole('button', { name: 'Hold PARENT' }), 2100);
    await arPage
      .locator('.diagnostic')
      .filter({ hasText: 'Target visible: YES' })
      .waitFor({ timeout: 30000 });
    await arPage.screenshot({ path: 'artifacts/marker-test-cat.png' });
    pass('Real getUserMedia + MindAR + normalized anchor cube using generated test video');
    const stream = await arPage.evaluateHandle(() => document.querySelector('video').srcObject);
    await arPage.getByRole('link', { name: '← Parent' }).click();
    await arPage.waitForURL('**/parent');
    // React releases the stream in the unmount effect after navigation commits.
    await arPage.waitForFunction(
      (s) => s.getTracks().every((t) => t.readyState === 'ended'),
      stream,
      { timeout: 3000 },
    );
    pass('Camera stream released when diagnostics closes');
    await arPage.getByRole('button', { name: 'Exit parent mode' }).click();
    await arPage.getByRole('button', { name: 'PLAY', exact: true }).click();
    for (const word of ['CAT', 'DOG', 'LION']) {
      try {
        await arPage.getByText(`${word}!`, { exact: true }).waitFor({ timeout: 35000 });
      } catch (e) {
        await arPage.screenshot({ path: 'artifacts/browser-failure.png' });
        console.log('Failure screen:', await arPage.locator('body').innerText());
        throw e;
      }
      await arPage.waitForTimeout(900);
      await arPage.screenshot({ path: `artifacts/ar-${word.toLowerCase()}.png` });
      pass(`AR ${word} appearance from real image recognition`);
    }
    await arPage
      .getByRole('button', { name: 'PLAY AGAIN', exact: true })
      .waitFor({ timeout: 35000 });
    await arPage.screenshot({ path: 'artifacts/finale.png' });
    pass('AR story progresses CAT → DOG → LION → 17.5 second finale → complete');
    await arPage.getByRole('button', { name: 'FREE PLAY', exact: true }).click();
    await arPage.locator('.free-note').waitFor();
    pass('Free Play after completion');
    await arPage.waitForFunction(
      () =>
        ['CAT!', 'DOG!', 'LION!'].includes(
          document.querySelector('.speech > div:not(.foxy-chip)')?.textContent,
        ),
      { timeout: 12000 },
    );
    const firstFree = await arPage.locator('.speech > div:not(.foxy-chip)').innerText();
    await arPage.waitForFunction(
      (previous) => {
        const caption = document.querySelector('.speech > div:not(.foxy-chip)')?.textContent;
        return ['CAT!', 'DOG!', 'LION!'].includes(caption) && caption !== previous;
      },
      firstFree,
      { timeout: 30000 },
    );
    pass('Free Play switches animal when a different image replaces the visible card');
    await arPage.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await arPage.goto(`${base}/offline-status`);
    await arPage.locator('.offline-checks').filter({ hasText: 'READY' }).waitFor();
    const status = await arPage.locator('.offline-checks').innerText();
    if (status.includes('NOT CACHED')) throw new Error(status);
    pass('Engine, procedural models, shipped audio and image targets cached');
    await arContext.setOffline(true);
    await arPage.reload();
    await arPage.getByRole('heading', { name: 'Offline status' }).waitFor();
    if ((await arPage.locator('.offline-checks').innerText()).includes('NOT CACHED'))
      throw new Error('Offline assets missing');
    await arPage.goto(base);
    await arPage.getByRole('button', { name: 'PLAY', exact: true }).waitFor();
    pass('Offline reload and game relaunch through Service Worker');
    if (
      requests.some(
        (r) => !r.url.startsWith(base) && !r.url.startsWith('blob:') && !r.url.startsWith('data:'),
      )
    )
      throw new Error('Unexpected remote runtime request');
    if (requests.some((r) => r.method !== 'GET')) throw new Error('Unexpected data upload');
    pass('Runtime uses only same-origin GET assets; no camera upload');
    await arContext.close();
  } finally {
    await arBrowser.close();
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  await writeFile(
    'BROWSER_TEST_RESULTS.json',
    JSON.stringify(
      {
        browser: 'Desktop Chromium; generated camera video, not a physical iPad',
        passed: report,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(`Browser checks complete (${report.length})`);
} finally {
  await browser.close();
}
