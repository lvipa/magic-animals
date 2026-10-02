import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserExecutable, isolateTestContext } from './browser-runtime.mjs';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const output = '.test-artifacts/mobile-controls';
await mkdir(output, { recursive: true });
const reports = [];
for (const engine of process.argv.includes('--webkit') ? [chromium, webkit] : [chromium]) {
  const browser = await engine.launch(
    engine === chromium
      ? {
          headless: true,
          executablePath: browserExecutable(),
          args: ['--enable-webgl'],
        }
      : { headless: true },
  );
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: { width: 390, height: 664 },
  });
  await isolateTestContext(context);
  await context.addInitScript(() => {
    localStorage.setItem(
      'magic-adventure',
      JSON.stringify({
        state: { world: 'space', found: ['cat', 'dog', 'foxy'], missions: ['cat'] },
        version: 0,
      }),
    );
    if (!navigator.mediaDevices)
      Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Controlled denied camera', 'NotAllowedError');
    };
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const checks = [];
  const nav = page.getByRole('navigation', { name: 'Детское меню' });
  async function tapNav(label, path) {
    const link = nav.getByRole('link', { name: new RegExp(label) });
    const box = await link.boundingBox();
    assert.ok(
      box && box.y >= 0 && box.y + box.height <= (await page.evaluate(() => innerHeight)),
      `${label} outside visible viewport`,
    );
    assert.ok(
      await link.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
        );
      }),
      `${label} covered by another layer`,
    );
    await link.tap();
    await page.waitForURL(base + path);
    await nav.locator(`a[href="${path}"][aria-current="page"]`).waitFor();
    assert.equal(await nav.evaluate((el) => el.parentElement === document.body), true);
    assert.equal(await link.getAttribute('aria-current'), 'page');
  }
  try {
    await page.goto(base + '/hunt');
    if (engine === chromium)
      await page.getByRole('button', { name: 'PLAY WITHOUT CAMERA', exact: true }).tap();
    else await page.getByRole('button', { name: '🐾 Без камеры', exact: true }).tap();
    assert.match(await page.locator('.stars').innerText(), /3 \/ 8/);
    assert.match(await page.locator('.hunt-panel header').innerText(), /3 \/ 8 друзей/);
    await page.getByRole('button', { name: '🔄 Начать поиск заново' }).tap();
    assert.match(await page.locator('.hunt-panel header').innerText(), /0 \/ 8 друзей/);
    assert.match(await page.locator('.hunt-panel header').innerText(), /0 \/ 8 заданий/);
    assert.match(await page.locator('.stars').innerText(), /0 \/ 8/);
    assert.equal(
      (await page.evaluate(() => JSON.parse(localStorage.getItem('magic-adventure')).state)).world,
      'space',
    );
    await page.getByRole('button', { name: 'Play with DOG', exact: true }).tap();
    assert.match(await page.locator('.stars').innerText(), /1 \/ 8/);
    assert.match(await page.locator('.hunt-panel header').innerText(), /1 \/ 8 друзей/);
    checks.push('Restart at 3/8, clear stars, retain world, both counters 0 then 1');
    await tapNav('Миры', '/worlds');
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await tapNav('Друзья', '/friends');
    if (engine === chromium) {
      await page.getByRole('button', { name: /CAT/, exact: false }).tap();
      await page.getByRole('button', { name: '🍎 Hungry', exact: true }).tap();
      await page
        .locator('.gallery-stage [role=status]')
        .waitFor({ state: 'hidden', timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.locator('.gallery-stage').screenshot({ path: `${output}/cat-hungry.png` });
      for (const action of ['💧 Thirsty', '💙 Sad']) {
        await page.getByRole('button', { name: action, exact: true }).tap();
        await page.waitForTimeout(1500);
        await page
          .locator('.gallery-stage')
          .screenshot({
            path: `${output}/cat-${action.includes('Thirsty') ? 'thirsty' : 'sad'}.png`,
          });
      }
    }
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await tapNav('TV', '/connect-tv');
    await tapNav('Карточки', '/hunt');
    await tapNav('Домой', '/');
    for (const name of ['PLAY', 'SCAN ANY CARD · 8 friends']) {
      const button = page.getByRole('button', { name, exact: true });
      await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const buttonBox = await button.boundingBox(),
        navBox = await nav.boundingBox();
      assert.ok(buttonBox.y + buttonBox.height < navBox.y, `${name} covered by bottom menu`);
    }
    await page.setViewportSize({ width: 390, height: 560 });
    await tapNav('Миры', '/worlds');
    await page.setViewportSize({ width: 844, height: 390 });
    await tapNav('Карточки', '/hunt');
    await page.screenshot({ path: `${output}/${engine.name()}-landscape.png` });
    await page.setViewportSize({ width: 390, height: 664 });
    await page.screenshot({ path: `${output}/${engine.name()}-hunt.png`, fullPage: true });
    assert.equal(errors.length, 0, errors.join('\n'));
    checks.push(
      'All five menu destinations by touch, scrolled pages, short viewport and landscape',
    );
    reports.push({ engine: engine.name(), checks, errors });
    console.log('PASS mobile controls', engine.name(), checks);
  } catch (error) {
    await page.screenshot({ path: `${output}/${engine.name()}-failure.png`, fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}
await writeFile(
  `${output}/results.json`,
  JSON.stringify(
    {
      base,
      reports,
      method:
        'Touch emulation on desktop Chromium/WebKit; physical iPhone Safari still needs device testing',
    },
    null,
    2,
  ),
);
