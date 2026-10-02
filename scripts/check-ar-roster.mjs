import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { browserExecutable, isolateTestContext } from './browser-runtime.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const catalog = JSON.parse(await readFile('public/markers/catalog.json', 'utf8'));
const output = '.test-artifacts/ar-roster';
const hunt = process.argv.includes('--hunt');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ['--enable-webgl'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 664 },
  hasTouch: true,
  isMobile: true,
});
await isolateTestContext(context);
// Controlled synthetic MediaStream; real shipped Controller, camera video,
// GPU renderer, models, timelines and state. No physical-device claim.
await context.addInitScript(() => {
  let image = null;
  window.__showARCard = async (id) => {
    image = null;
    if (!id) return;
    const next = new Image();
    next.src = `/markers/milo-v2/${id}.png`;
    await next.decode();
    image = next;
  };
  navigator.mediaDevices.getUserMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    function draw() {
      ctx.fillStyle = '#81959d';
      ctx.fillRect(0, 0, 640, 480);
      if (image) {
        ctx.save();
        ctx.translate(320, 240);
        ctx.rotate(0.045);
        ctx.drawImage(image, -260, -189, 520, 378);
        ctx.restore();
      }
      requestAnimationFrame(draw);
    }
    draw();
    const stream = canvas.captureStream(20);
    window.__lastARStream = stream;
    return stream;
  };
});
const errors = [],
  results = [];
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(base + (hunt ? '/hunt' : ''));
  if (!hunt) {
    const scan = page.getByRole('button', { name: 'SCAN ANY CARD · 8 friends' });
    await scan.waitFor({ timeout: 60000 });
    const box = await scan.boundingBox();
    if (!box || box.y + box.height > 844) throw Error('Scan button outside phone viewport');
    await scan.click();
    await page.locator('.free-note').waitFor();
  } else await page.locator('.hunt-panel').waitFor();
  for (const id of ['elephant', 'panda', 'cat', 'bunny', 'foxy', 'dog', 'bear', 'lion']) {
    await page.evaluate(() => window.__showARCard(null));
    await page.waitForTimeout(1700);
    await page.evaluate((id) => window.__showARCard(id), id);
    const word = catalog.images.find((card) => card.id === id).word;
    await page
      .locator('.speech > div:not(.foxy-chip)')
      .filter({ hasText: word + '!' })
      .waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${output}/${id}-phone.png` });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw Error('Phone horizontal overflow');
    results.push({ id, word });
    console.log('PASS unordered AR', word);
    if (hunt && id === 'cat') {
      await page.getByRole('button', { name: '🔄 Начать поиск заново' }).tap();
      await page.waitForTimeout(1400);
      if (
        !(await page.locator('.hunt-panel header').innerText()).includes('0 / 8 друзей') ||
        !(await page.locator('.stars').innerText()).includes('0 / 8')
      )
        throw Error('Restart re-counted the still-visible card or left unequal counters');
      if (
        !(await page.evaluate(
          () => window.__lastARStream.getVideoTracks()[0].readyState === 'live',
        ))
      )
        throw Error('Restart closed the camera');
      for (const again of ['elephant', 'panda', 'cat']) {
        await page.evaluate(() => window.__showARCard(null));
        await page.waitForTimeout(2000);
        await page.evaluate((id) => window.__showARCard(id), again);
        await page
          .locator('.speech > div:not(.foxy-chip)')
          .filter({ hasText: catalog.images.find((card) => card.id === again).word + '!' })
          .waitFor({ timeout: 30000 });
      }
      console.log(
        'PASS touch restart at 3/8 keeps camera live, waits for a new scan and resets both counters',
      );
    }
  }
  if (!(await page.locator(hunt ? '.hunt-panel header' : '.stars').innerText()).includes('8 / 8'))
    throw Error('Eight discovered friends not counted');
  if (errors.length) throw Error(errors.join('\n'));
  if (hunt) {
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.locator('.kid-nav').getByRole('link', { name: /Миры/ }).tap();
    await page.waitForURL(base + '/worlds');
    if (
      !(await page.evaluate(() => window.__lastARStream.getVideoTracks()[0].readyState === 'ended'))
    )
      throw Error('Bottom menu failed to close camera on navigation');
    console.log('PASS touch bottom menu above active AR, camera released on navigation');
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        base,
        method:
          'Synthetic Canvas MediaStream, real MindAR and production renderer; desktop Chrome at 390x844',
        results,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
