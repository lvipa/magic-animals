import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { browserExecutable, isolateTestContext } from './browser-runtime.mjs';
const fixture = resolve('dist/test-transitions');
if (dirname(fixture) !== resolve('dist')) throw Error('Invalid fixture path');
await mkdir(fixture, { recursive: true });
await mkdir('.test-artifacts/transitions', { recursive: true });
await build({
  entryPoints: ['scripts/character-transitions-review.ts'],
  bundle: true,
  format: 'esm',
  outfile: `${fixture}/runtime.js`,
});
await writeFile(
  `${fixture}/index.html`,
  '<!doctype html><script type="module" src="runtime.js"></script>',
);
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ['--enable-webgl'],
});
try {
  const context = await browser.newContext();
  await isolateTestContext(context);
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'log') console.log(message.text());
  });
  await page.goto('http://127.0.0.1:4173/test-transitions/index.html');
  await page
    .waitForFunction(() => window.transitionReport || false, {}, { timeout: 60000 })
    .catch((error) => {
      throw Error(errors.join('\n') || error.message);
    });
  const report = await page.evaluate(() => window.transitionReport);
  if (errors.length) throw Error(errors.join('\n'));
  await writeFile(
    '.test-artifacts/transitions/results.json',
    JSON.stringify(
      {
        report,
        errors,
        method:
          'Continuous 60 fps simulation using all eight production GLB rigs and the real animation runtime',
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS all eight rigs: 20 second emotions, sleep exit, rapid interrupted transitions and idle recovery',
  );
} finally {
  await browser.close();
  await rm(fixture, { recursive: true, force: true });
}
