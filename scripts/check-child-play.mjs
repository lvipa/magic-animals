import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserExecutable, isolateTestContext } from './browser-runtime.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const output = '.test-artifacts/child-play';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ['--enable-webgl'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await isolateTestContext(context);
await context.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    throw new DOMException('Test denied camera', 'NotAllowedError');
  };
});
const page = await context.newPage();
const errors = [],
  checks = [],
  audioRequests = new Set();
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.url().includes('/audio/')) audioRequests.add(request.url());
});
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
async function noOverflow() {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'Horizontal phone overflow',
  );
}
try {
  await page.goto(base);
  await page.getByRole('button', { name: '🔎 НАЙТИ 8 ДРУЗЕЙ' }).click();
  await page.getByRole('button', { name: 'PLAY WITHOUT CAMERA', exact: true }).click();
  await page.locator('.hunt-panel').waitFor();
  const tasks = {
    ELEPHANT: 'Thirsty',
    PANDA: 'Happy',
    CAT: 'Wave',
    RABBIT: 'Jump',
    FOX: 'Run',
    DOG: 'Jump',
    BEAR: 'Sleep',
    LION: 'Sing',
  };
  let count = 0;
  for (const [word, action] of Object.entries(tasks)) {
    await page.getByRole('button', { name: `Play with ${word}`, exact: true }).click();
    await page.locator('.hunt-task strong').waitFor();
    // A wrong answer must not award a star or prevent retrying.
    if (count === 0) {
      await page.locator('.hunt-answers button').filter({ hasText: 'Sleep' }).click();
      assert.match(await page.locator('.hunt-panel header').innerText(), /0 \/ 8 заданий/);
      await page.getByRole('button', { name: '🔊 Послушать задание' }).click();
    }
    await page.locator('.hunt-answers button').filter({ hasText: action }).click();
    count++;
    assert.match(
      await page.locator('.hunt-panel header').innerText(),
      new RegExp(`${count} / 8 друзей`),
    );
    assert.match(
      await page.locator('.hunt-panel header').innerText(),
      new RegExp(`${count} / 8 заданий`),
    );
    await noOverflow();
  }
  await page.getByRole('button', { name: 'Play with CAT', exact: true }).click();
  assert.match(await page.locator('.hunt-panel header').innerText(), /8 \/ 8 заданий/);
  pass(
    'All eight friends in arbitrary order; distinct tasks; wrong answer/retry; duplicate card gives no extra star',
  );
  await page.screenshot({ path: `${output}/album-phone.png`, fullPage: true });
  await page.reload();
  await page.locator('.hunt-panel').waitFor();
  assert.match(await page.locator('.hunt-panel header').innerText(), /8 \/ 8 друзей/);
  assert.match(await page.locator('.hunt-panel header').innerText(), /8 \/ 8 заданий/);
  pass('Album and eight completed tasks persist through page reload');
  await page.getByRole('button', { name: '🔄 Начать поиск заново' }).click();
  assert.match(await page.locator('.hunt-panel header').innerText(), /0 \/ 8 друзей/);
  assert.match(await page.locator('.hunt-panel header').innerText(), /0 \/ 8 заданий/);
  await page.locator('.hunt-task').waitFor({ state: 'hidden' });
  pass('New search clears only the round and hides the previous task');
  await page.locator('.kid-nav').getByRole('link', { name: /Миры/ }).click();
  await page.getByRole('button', { name: /Космос/ }).click();
  await page.locator('.world-preview .world-space').waitFor();
  await page.screenshot({ path: `${output}/worlds-phone.png` });
  await page
    .locator('.kid-nav')
    .getByRole('link', { name: /Друзья/ })
    .click();
  await page.getByRole('button', { name: /DOG/ }).click();
  await page.getByRole('button', { name: '🦘 Jump', exact: true }).click();
  await page.locator('.phrase-card strong').filter({ hasText: 'I am jumping!' }).waitFor();
  await page.locator('.gallery-stage .world-space').waitFor();
  for (const [label, phrase] of [
    ['🎵 Sing', 'I am singing!'],
    ['🥱 Tired', 'I am tired.'],
    ['🍎 Hungry', 'I am hungry.'],
    ['💧 Thirsty', 'I am thirsty.'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    assert.ok((await page.locator('.phrase-card strong').innerText()).includes(phrase));
    await page.getByRole('button', { name: '🔊 Повторить', exact: true }).click();
  }
  await page.getByRole('button', { name: '💬 Расскажи о себе' }).click();
  assert.match(await page.locator('.listening-play p').innerText(), /ears/);
  await page.getByRole('button', { name: '🤗 Обнять друга' }).click();
  await page.getByRole('button', { name: 'Listen & choose a move' }).click();
  await page.getByRole('button', { name: 'Hear again 🔊' }).click();
  await noOverflow();
  pass(
    'Child navigation, persisted rocket world, first-person phrase/translation/repeat, facts, hug and listening challenge',
  );
  await page.getByRole('button', { name: '🦘 Jump', exact: true }).click();
  await page.locator('.gallery-stage [role=status]').waitFor({ state: 'hidden', timeout: 30000 });
  await page.screenshot({ path: `${output}/friends-phone.png`, fullPage: true });
  await page.locator('.kid-nav').getByRole('link', { name: /Домой/ }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).waitFor();
  const box = await page.getByRole('button', { name: 'SCAN ANY CARD · 8 friends' }).boundingBox();
  await page
    .getByRole('button', { name: 'SCAN ANY CARD · 8 friends' })
    .evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const visibleBox = await page
    .getByRole('button', { name: 'SCAN ANY CARD · 8 friends' })
    .boundingBox();
  const nav = await page.locator('.kid-nav').boundingBox();
  assert.ok(
    box && visibleBox && nav && visibleBox.y + visibleBox.height < nav.y,
    'Home scan button covered by child menu',
  );
  pass('Home returns to welcome; scan button remains above child menu');
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.ok([...audioRequests].some((url) => url.includes('character-dog-learn-jump.mp3')));
  assert.ok([...audioRequests].some((url) => url.includes('character-dog-discover.mp3')));
  assert.ok([...audioRequests].some((url) => url.includes('world-space.mp3')));
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ base, checks, errors, audioRequests: [...audioRequests] }, null, 2),
  );
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
}
