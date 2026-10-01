import { build } from 'esbuild';
import { chromium } from 'playwright';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { browserExecutable, isolateTestContext } from './browser-runtime.mjs';
const dir = '.test-artifacts/cast';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['scripts/cast-runtime-review.ts'],
  bundle: true,
  format: 'esm',
  outfile: `${dir}/runtime.js`,
});
await writeFile(
  `${dir}/index.html`,
  '<!doctype html><body style="margin:0"><script type="module" src="runtime.js"></script>',
);
// Serve the fixture via Vite preview, so the same immutable production URLs,
// Draco decoder and browser skinning are exercised as in the deployed game.
await mkdir('dist/test-cast', { recursive: true });
await writeFile(
  'dist/test-cast/index.html',
  await (await import('node:fs/promises')).readFile(`${dir}/index.html`),
);
await writeFile(
  'dist/test-cast/runtime.js',
  await (await import('node:fs/promises')).readFile(`${dir}/runtime.js`),
);
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ['--enable-webgl'],
});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await isolateTestContext(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error('PAGE ERROR', e.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'log' || message.type() === 'error') console.log(message.text());
  });
  await page.goto('http://127.0.0.1:4173/test-cast/index.html');
  await page
    .waitForFunction(() => window.castReport || false, {}, { timeout: 60000 })
    .catch((error) => {
      throw Error(errors.join('\n') || error.message);
    });
  if (errors.length) throw Error(errors.join('\n'));
  const report = await page.evaluate(() => window.castReport);
  console.log(JSON.stringify(report, null, 2));
  await page.screenshot({ path: `${dir}/lineup.png` });
  for (const { id } of report) {
    for (const [action, time] of [
      ['idle', 0],
      ['wave', 0.7],
      ['roar', 0.7],
      ['sleep', 2.2],
      ['jump-crouch', 0.375],
      ['jump-apex', 0.917],
    ]) {
      await page.evaluate(
        ([id, action, time]) => window.showCharacter(id, action, time),
        [id, action.startsWith('jump-') ? 'jump' : action, time],
      );
      await page.screenshot({ path: `${dir}/${id}-${action}.png` });
    }
    if (['foxy', 'dog'].includes(id)) {
      await page.evaluate(([id]) => window.showCharacter(id, 'roar', 0.875, 1.25), [id]);
      await page.screenshot({ path: `${dir}/${id}-mouth-profile.png` });
    }
    if (['cat', 'dog', 'elephant'].includes(id)) {
      for (const action of ['sing', 'tired', 'hungry', 'thirsty', 'sad']) {
        await page.evaluate(([id, action]) => window.showCharacter(id, action, 0.7), [id, action]);
        await page.screenshot({ path: `${dir}/${id}-${action}.png` });
      }
    }
  }
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.id = 'voice-check';
    button.textContent = 'Voice check';
    button.onclick = () => {
      window.voiceCheckPromise = window.startVoiceCheck();
    };
    document.body.append(button);
  });
  await page.locator('#voice-check').click();
  const voice = await page.evaluate(() => window.voiceCheckPromise);
  if (voice.catMouth < 0.025 || voice.dogMouth > 0.001)
    throw Error(`Wrong voice/mouth routing: ${JSON.stringify(voice)}`);
  console.log('PASS actual recorded CAT audio drives its mouth, not DOG', voice);
  await writeFile(`${dir}/results.json`, JSON.stringify({ report, errors }, null, 2));
  await page.evaluate(() => window.disposeCast());
} finally {
  await browser.close();
  const fixture = resolve('dist/test-cast');
  if (dirname(fixture) !== resolve('dist')) throw Error('Invalid test fixture cleanup path');
  await rm(fixture, { recursive: true, force: true });
}
