import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createTVServer } from '../server/tv-server.mjs';
import { isolateTestContext } from './browser-runtime.mjs';
const app = await createTVServer({
  port: 0,
  host: '127.0.0.1',
  ...(process.env.SING_TEST_ROOT ? { root: process.env.SING_TEST_ROOT } : {}),
});
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
  // Test double verifies app controls, not actual YouTube networking or audio.
  await phone.route(/https:\/\/www.youtube-nocookie.com\/embed\//, (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<html><body>Official video test double</body></html>',
    }),
  );
  await phone.addInitScript(() => {
    window.__micTracks = [];
    window.__songSources = [];
    window.__videos = [];
    window.YT = {
      Player: class {
        constructor(frame, { events }) {
          this.events = events;
          this.position = 0;
          this.state = 2;
          this.started = 0;
          this.destroyed = false;
          window.__videos.push(this);
          setTimeout(() => {
            if (!this.destroyed) events.onReady();
          }, 500);
        }
        getCurrentTime() {
          return Math.min(
            195,
            this.position + (this.state === 1 ? (performance.now() - this.started) / 1000 : 0),
          );
        }
        getDuration() {
          return 195;
        }
        getPlayerState() {
          return this.state;
        }
        seekTo(t) {
          this.position = t;
          this.started = performance.now();
        }
        playVideo() {
          this.started = performance.now();
          this.state = 1;
          this.events.onStateChange({ data: 1 });
        }
        pauseVideo() {
          this.position = this.getCurrentTime();
          this.state = 2;
          this.events.onStateChange({ data: 2 });
        }
        destroy() {
          this.destroyed = true;
          this.state = -1;
        }
      },
    };
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await original(options);
      window.__micTracks.push(...stream.getTracks());
      return stream;
    };
    const Context = window.AudioContext;
    window.AudioContext = class extends Context {
      createBufferSource() {
        const source = super.createBufferSource(),
          connect = source.connect.bind(source),
          start = source.start.bind(source);
        let output;
        source.connect = (node, ...args) => {
          output = node;
          return connect(node, ...args);
        };
        source.start = (...args) => {
          const b = source.buffer,
            samples = b.getChannelData(0);
          let energy = 0;
          for (let i = b.sampleRate * 2; i < b.sampleRate * 8; i++) energy += samples[i] ** 2;
          window.__songSources.push({
            duration: b.duration,
            gain: output?.gain?.value,
            rms: Math.sqrt(energy / (b.sampleRate * 6)),
          });
          return start(...args);
        };
        return source;
      }
    };
  });
  const page = await phone.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const choose = async (title) => {
    await page.getByRole('heading', { name: 'Sing with Milo', exact: true }).waitFor();
    if (!(await page.locator('.sing-song-picker').count()))
      await page.getByLabel('Выбрать другую песенку').click();
    await page
      .getByRole('group', { name: 'Выбери песенку' })
      .getByRole('button', { name: new RegExp(title) })
      .click();
  };
  await page.goto(base + '/sing', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Sing with Milo', exact: true }).waitFor();
  assert.equal(await page.locator('.sing-song-picker button').count(), 7);
  assert.equal(await page.locator('.sing-stage canvas').count(), 0);
  await mkdir('artifacts/singing', { recursive: true });
  await page.screenshot({ path: 'artifacts/singing/full-library-phone.png', fullPage: true });
  await choose('Twinkle Star');
  await page.waitForFunction(() => document.querySelector('.sing-stage canvas')?.width > 390);
  const raster = await page.locator('.sing-stage canvas').evaluate((c) => ({
    width: c.width,
    css: c.getBoundingClientRect().width,
    antialias: c.getContext('webgl2')?.getContextAttributes()?.antialias,
  }));
  assert.equal(raster.antialias, true);
  assert.ok(raster.width / raster.css >= 1.49);
  await page.getByRole('button', { name: '▶ Петь!', exact: true }).click();
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.sing-progress').value > 5);
  const sources = await page.evaluate(() => window.__songSources);
  assert.equal(sources.length, 1);
  assert.ok(sources[0].gain > 0.8 && sources[0].rms > 0.01 && sources[0].duration > 133);
  await page.getByRole('button', { name: '⭐ Спел!', exact: true }).click();
  assert.equal(await page.getByLabel('1 звёзд').count(), 1);
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).click();
  const stopped = await page.locator('.sing-progress').evaluate((p) => p.value);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.sing-progress').evaluate((p) => p.value), stopped);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('.model-loading').waitFor({ state: 'detached', timeout: 45000 });
  await page.screenshot({ path: 'artifacts/singing/hd-milo-phone.png', fullPage: true });
  pass(
    'Seven-song chooser; full 134-second Twinkle; only one audible mix; pause, stars, no phone overflow, MSAA and supersampling',
  );
  await page.getByRole('button', { name: '⚙ Для взрослых', exact: true }).click();
  await page.getByRole('button', { name: '🎤 Повтори', exact: false }).click();
  await page.getByRole('button', { name: '🎤 Включить микрофон', exact: true }).click();
  await page.getByRole('button', { name: '🎤 Выключить микрофон', exact: true }).waitFor();
  await page.getByRole('button', { name: '▶ Петь!', exact: true }).click();
  await page.getByText('🎤 Теперь твоя очередь!', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).click();
  await page.getByLabel('Ещё строку', { exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.sing-progress').value < 3);
  await choose('ABC Song');
  assert.equal(
    await page.evaluate(() => window.__micTracks.every((t) => t.readyState === 'ended')),
    true,
  );
  await page.getByRole('button', { name: '▶ Петь!', exact: true }).click();
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).waitFor();
  assert.ok(await page.evaluate(() => window.__songSources.at(-1).duration > 105));
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).click();
  pass('Full ABC; echo response and phrase repeat; changing songs releases microphone');
  const tvContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    serviceWorkers: 'block',
  });
  await isolateTestContext(tvContext);
  const tv = await tvContext.newPage();
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(base + '/tv', { waitUntil: 'domcontentloaded' });
  await tv.getByRole('button', { name: 'START TV', exact: true }).click();
  await tv.waitForFunction(() =>
    /^\d{6}$/.test(document.querySelector('.tv-code')?.textContent || ''),
  );
  const code = (await tv.locator('.tv-code').textContent()).trim();
  await page.goto(base + '/connect-tv', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('TV code').fill(code);
  await page.getByRole('button', { name: 'Connect TV', exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes('TV connected'));
  await page.locator('.kid-nav a[href="/sing"]').click();
  await choose('The Wheels on the Bus');
  await page.getByRole('button', { name: 'Двери', exact: false }).click();
  await tv.locator('.sing-tv').waitFor();
  await tv.getByText('open and shut', { exact: false }).first().waitFor();
  const frame = page.locator('.sing-official-video iframe');
  assert.match(await frame.getAttribute('src'), /9UasekNr8KI/);
  const frameBox = await frame.boundingBox();
  assert.ok(frameBox.width >= 200 && frameBox.height >= 200);
  await page.getByRole('button', { name: /▶ (Петь!|Продолжить)/ }).click();
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.sing-progress').max === 195);
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).click();
  await tv.reload({ waitUntil: 'domcontentloaded' });
  await tv.getByText('open and shut', { exact: false }).first().waitFor({ timeout: 15000 });
  pass(
    'TV pairing/reload preserve bus action and actual duration; official embed is visible and >=200px (mock API)',
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const unobscured = await page.evaluate(() => {
    const video = document.querySelector('.sing-official-video iframe').getBoundingClientRect();
    return ['.sing-controls', '.kid-nav'].every((selector) => {
      const other = document.querySelector(selector).getBoundingClientRect();
      return !(
        other.left < video.right &&
        other.right > video.left &&
        other.top < video.bottom &&
        other.bottom > video.top
      );
    });
  });
  assert.equal(unobscured, true);
  await page.screenshot({ path: 'artifacts/singing/video-landscape-fixed.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const video = window.__videos.at(-1);
    video.position = 195;
    video.state = 0;
    video.events.onStateChange({ data: 0 });
  });
  await page.getByRole('button', { name: '🎶 Ещё концерт!', exact: true }).waitFor();
  await page.evaluate(() => {
    const video = window.__videos.at(-1);
    video.seekTo(0);
    video.playVideo();
  });
  await page.waitForFunction(() => document.querySelector('.sing-progress').value < 2);
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).waitFor();
  await page.evaluate(() => {
    const video = window.__videos.at(-1);
    video.pauseVideo();
    video.seekTo(70);
  });
  await page.waitForFunction(
    () => Math.abs(document.querySelector('.sing-progress').value - 70) < 0.1,
  );
  await page.getByText('beep beep beep', { exact: false }).first().waitFor();
  await page.evaluate(() => {
    const video = window.__videos.at(-1);
    video.seekTo(92);
    video.playVideo();
  });
  await page.waitForFunction(() =>
    document
      .querySelector('.music-activity button[aria-pressed="true"]')
      ?.textContent.includes('Прыгаем'),
  );
  await page.getByRole('button', { name: 'Прыгаем', exact: false }).evaluate((button) => {
    if (button.getAttribute('aria-pressed') !== 'true')
      throw new Error('Manual interaction froze automatic timing');
  });
  await page.getByLabel('Сначала', { exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.sing-progress').value < 2);
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).waitFor();
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).click();
  pass(
    'Landscape video is unobscured; iframe replay after ending, paused seek and verse changes restore the same app clock; restart plays immediately',
  );
  await page.getByRole('button', { name: '⚙ Для взрослых', exact: true }).click();
  await page.getByText('Подстроить движения под это исполнение', { exact: true }).click();
  await page.getByRole('button', { name: 'Начать разметку', exact: true }).click();
  for (const [at, label] of [
    [12, 'Двери'],
    [45, 'Дворники'],
    [80, 'Двери'],
  ]) {
    await page.evaluate((at) => window.__videos.at(-1).seekTo(at), at);
    await page.waitForFunction(
      (at) => Math.abs(document.querySelector('.sing-progress').value - at) < 0.1,
      at,
    );
    await page.getByRole('button', { name: label, exact: false }).click();
    assert.equal(await page.evaluate(() => window.__videos.at(-1).position), at);
  }
  await page.getByRole('button', { name: 'Сохранить метки (3)', exact: true }).click();
  for (const [at, label] of [
    [46, 'Дворники'],
    [81, 'Двери'],
    [13, 'Двери'],
  ]) {
    await page.evaluate((at) => window.__videos.at(-1).seekTo(at), at);
    await page.waitForFunction(
      (label) =>
        document
          .querySelector('.music-activity button[aria-pressed="true"]')
          ?.textContent.includes(label),
      label,
    );
    await tv
      .getByText(label === 'Дворники' ? 'swish swish swish' : 'open and shut', { exact: false })
      .first()
      .waitFor();
  }
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem('milo-video-cues-v1:9UasekNr8KI'))),
    [
      { time: 12, choice: 1 },
      { time: 45, choice: 2 },
      { time: 80, choice: 1 },
    ],
  );
  pass(
    'Gesture marks save actual iframe times without seeking, follow repeated actions/rewinds and reach TV',
  );
  await page
    .getByRole('button', { name: '⬇ Сохранить Twinkle и ABC заранее', exact: true })
    .click();
  await page.getByText('Twinkle и ABC сохранены.', { exact: false }).waitFor();
  assert.equal(
    await page.evaluate(
      async () => (await (await caches.open('milo-music-full-v4')).keys()).length,
    ),
    4,
  );
  pass('Offline-save downloads the four authorized full audio stems into the PWA music cache');
  for (const [title, action, expected] of [
    ['Old MacDonald', 'Лошадка', 'horse'],
    ['If You’re Happy', 'Хлопай', 'clap your hands'],
    ['Head, Shoulders', 'Колени', 'knees'],
    ['Itsy Bitsy Spider', 'Солнышко', 'sun'],
  ]) {
    await choose(title);
    await page.getByRole('button', { name: action, exact: false }).click();
    await page.getByRole('button', { name: /▶ (Петь!|Продолжить)/ }).click();
    await page.getByRole('button', { name: '⏸ Пауза', exact: true }).waitFor();
    await tv.getByText(expected, { exact: false }).first().waitFor();
    await page.getByRole('button', { name: '⏸ Пауза', exact: true }).click();
    if (title.startsWith('Head')) {
      await page.locator('.model-loading').waitFor({ state: 'detached', timeout: 45000 });
      await page.screenshot({ path: 'artifacts/singing/hd-poppy-phone.png', fullPage: true });
      await tv.screenshot({ path: 'artifacts/singing/hd-poppy-tv.png' });
    }
  }
  pass(
    'Farm verse, clap, Poppy gestures and Spider weather synchronize to TV (mock official player)',
  );
  await choose('The Wheels on the Bus');
  await page.getByRole('button', { name: '▶ Петь!', exact: true }).click();
  await page.getByLabel('Выбрать другую песенку').click();
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => window.__videos.at(-1).state), -1);
  await page.locator('.kid-nav a[href="/friends"]').click();
  await tv.locator('.sing-tv').waitFor({ state: 'detached' });
  pass('Leaving during official-player load cancels playback; leaving music restores Animals TV');
  assert.deepEqual(errors, []);
  await writeFile(
    'artifacts/singing/browser-results.json',
    JSON.stringify(
      {
        checks,
        raster,
        errors,
        environment:
          'Chromium phone viewport, fake microphone, mocked YouTube API. Actual external video/audio and physical iPhone/TV review remain.',
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await app.close();
}
