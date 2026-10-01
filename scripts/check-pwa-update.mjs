// Regression: a returning browser must update even if no GLB can download.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { browserExecutable, isolateTestContext } from './browser-runtime.mjs';

const production = process.env.PREVIOUS_RELEASE_URL || 'https://animals.flowlabli.online';
const dir = resolve('.test-artifacts/pwa-update');
await mkdir(dir, { recursive: true });
const getOld = async (path) => {
  const fixtureRoot = resolve(process.env.OLD_RELEASE_DIR || resolve(dir, 'previous'));
  const fixturePath = resolve(fixtureRoot, `.${path}`);
  if (!fixturePath.startsWith(fixtureRoot + '\\') && !fixturePath.startsWith(fixtureRoot + '/')) throw Error('Invalid fixture path');
  try { return await readFile(fixturePath); } catch { /* Capture before publishing. */ }
  const response = await fetch(production + path);
  if (!response.ok) throw Error(`Old release fixture ${path}: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  await mkdir(resolve(fixturePath, '..'), { recursive: true });
  await writeFile(fixturePath, data);
  return data;
};
const oldIndex = await getOld('/index.html'), oldSW = await getOld('/sw.js');
const oldFiles = new Map([['/index.html', oldIndex], ['/sw.js', oldSW]]);
let current = false, blockModels = false, modelRequests = 0;
const modelOrder = [];
let htmlOverride;
const root = resolve('dist');
const catURL = '/models/' + JSON.parse(await readFile('public/models/cat-master-info.json', 'utf8')).asset;
const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://local').pathname;
    if (pathname.endsWith('.glb')) {
      modelRequests++;
      modelOrder.push(pathname);
      // Lightweight install fixture: old Workbox treats response bytes as opaque.
      if (!current) { response.writeHead(200).end('old-model-fixture'); return; }
      if (blockModels) { response.writeHead(503).end(); return; }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    const navigation = !extname(pathname);
    const path = navigation ? '/index.html' : pathname;
    let data;
    if (path === '/index.html' && htmlOverride) data = htmlOverride;
    else if (!current && (path === '/index.html' || path === '/sw.js')) data = oldFiles.get(path);
    else {
      const file = resolve(root, `.${path}`);
      if (!file.startsWith(root + '\\') && !file.startsWith(root + '/')) throw Error('Invalid path');
      try { data = await readFile(file); }
      catch {
        if (!oldFiles.has(path)) oldFiles.set(path, await getOld(path));
        data = oldFiles.get(path);
      }
    }
    response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': data.length });
    response.end(data);
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(4197, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:4197';
let context;
try {
  context = await chromium.launchPersistentContext(resolve(dir, `profile-${Date.now()}`), {
    executablePath: browserExecutable(), headless: true,
    viewport: { width: 390, height: 844 }, args: ['--enable-webgl'],
  });
  await isolateTestContext(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') console.log('BROWSER', message.text()); });
  await page.goto(base + '/friends');
  await page.getByRole('heading', { name: 'More little friends!' }).waitFor({ timeout: 60000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller, {}, { timeout: 60000 });
  if (await page.locator('.model-loading').count()) throw Error('Fixture is not the previous release');
  console.log('PASS previous production worker installed in a persistent browser profile');
  current = true; blockModels = true;
  const before = modelRequests;
  if (process.argv.includes('--recovery')) {
    await page.goto(base + '/review/update.html');
    await page.getByRole('button', { name: 'Update and open friends' }).click();
  } else await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.getByRole('button', { name: 'Try again', exact: true }).waitFor({ timeout: 60000 });
  console.log(`PASS ${process.argv.includes('--recovery') ? 'recovery page' : 'existing tab'} activates new release while character downloads fail`);
  // New installation should request only the selected Bunny, not eight precache models.
  if (modelRequests - before > 2) throw Error('Release is still bulk-downloading models');
  blockModels = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.locator('.model-loading').waitFor({ state: 'detached', timeout: 60000 });
  console.log('PASS failed model retries without reloading the page');
  await page.evaluate(async (url) => {
    const cache = await caches.open('animals-models-v1');
    await cache.put(url, new Response('invalid cached model', { status: 200 }));
  }, catURL);
  await page.getByRole('button', { name: /CAT/, exact: false }).click();
  await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
  const corruptCached = await page.evaluate(async (url) => Boolean(await (await caches.open('animals-models-v1')).match(url)), catURL);
  if (corruptCached) throw Error('Invalid GLB remained cached after a decode failure');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.locator('.model-loading').waitFor({ state: 'detached', timeout: 60000 });
  console.log('PASS invalid cached GLB is evicted and retry downloads a working model');
  const start = modelOrder.length;
  await page.getByRole('button', { name: 'All friends', exact: true }).click();
  await page.getByRole('button', { name: /ELEPHANT/ }).click();
  await page.getByRole('status').filter({ hasText: /Loading Ellie|Adding Ellie's/ }).waitFor();
  await page.locator('.model-loading').waitFor({ state: 'detached', timeout: 60000 });
  const selectedIndex = modelOrder.slice(start).findIndex((path) => path.includes('/elephant-'));
  if (selectedIndex < 0 || selectedIndex > 2) throw Error('Selected friend waited behind the full gallery queue');
  console.log('PASS selected friend gets the next slot ahead of the gallery queue');
  await page.waitForFunction(async () => Boolean(await caches.match('/models/' + (await (await fetch('/models/catalog.json')).json()).models.find((m) => m.id === 'elephant').asset)), {}, { timeout: 30000 });
  console.log('PASS selected elephant shows load status and is cached after download');
  await page.screenshot({ path: resolve(dir, 'elephant-ready.png') });
  // The HTML comes from the network in an already controlled browser, rather
  // than waiting for a changed worker to finish installing.
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  htmlOverride = Buffer.from(html.replace('</body>', '<p id="fresh-html">Fresh HTML</p></body>'));
  await page.reload();
  await page.locator('#fresh-html').waitFor({ state: 'attached', timeout: 30000 });
  console.log('PASS controlled navigation obtains fresh server HTML');
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'More little friends!' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /ELEPHANT/ }).click();
  await page.locator('.model-loading').waitFor({ state: 'detached', timeout: 60000 });
  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS cached elephant loads after an offline page reload');
  await writeFile(resolve(dir, 'result.json'), JSON.stringify({ passed: true, modelRequests, persistentProfile: true }, null, 2));
} catch (error) {
  const page = context?.pages().at(-1);
  if (page) {
    console.log('UPDATE FAILURE', await page.evaluate(async () => ({
      text: document.body.innerText.slice(0, 1800),
      scripts: [...document.scripts].map((script) => script.src),
      workers: (await navigator.serviceWorker.getRegistrations()).map((r) => ({ active: r.active?.state, waiting: r.waiting?.state, installing: r.installing?.state })),
      caches: await caches.keys(),
    })));
    await page.screenshot({ path: resolve(dir, 'failure.png') });
  }
  throw error;
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
}
