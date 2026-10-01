import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { extname, resolve, sep } from 'node:path';
import { browserExecutable } from './browser-runtime.mjs';
import { writeMarkerCatalog } from './marker-catalog.mjs';
import { cards, markerDirectory } from './marker-roster.mjs';
import { uniqueCardMatching } from './marker-matching.mjs';

const root = resolve('.');
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(req.url?.split('?')[0] ?? '/'));
  if (!path.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(path);
    res.setHeader('Content-Type', extname(path) === '.js' ? 'text/javascript' : 'image/png');
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log('browser:', message.text()));
  await page.goto(`http://127.0.0.1:${port}/${markerDirectory}/cat.png`);
  const bytes = await page.evaluate(
    async ({ base, paths, directory }) => {
      const { Compiler } = await import(`${base}/node_modules/mind-ar/dist/mindar-image.prod.js`);
      const images = await Promise.all(
        paths.map(
          (id) =>
            new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = `${base}/${directory}/${id}.png`;
            }),
        ),
      );
      const compiler = new Compiler();
      await compiler.compileImageTargets(images, (progress) => {
        if (Math.round(progress) % 25 === 0) console.log(`compile ${progress.toFixed(0)}%`);
      });
      return [...new Uint8Array(await compiler.exportData())];
    },
    { base: `http://127.0.0.1:${port}`, paths: cards.map((c) => c.id), directory: markerDirectory },
  );
  const compiled = uniqueCardMatching(Buffer.from(bytes));
  await writeFile(`${markerDirectory}/targets.mind`, compiled);
  await writeMarkerCatalog();
  console.log(`Compiled ${compiled.length} bytes for ${cards.length} Milo friends`);
} finally {
  await browser.close();
  server.close();
}
