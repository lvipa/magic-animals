import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cards, markerDirectory, markerVersion } from './marker-roster.mjs';
export async function writeMarkerCatalog() {
  const digest = (data) => createHash('sha256').update(data).digest('hex');
  const target = await readFile(`${markerDirectory}/targets.mind`);
  const images = [];
  for (const [targetIndex, { id, word, name }] of cards.entries()) {
    const png = await readFile(`${markerDirectory}/${id}.png`);
    images.push({
      id,
      word,
      name,
      targetIndex,
      image: `${markerVersion}/${id}.png`,
      width: png.readUInt32BE(16),
      height: png.readUInt32BE(20),
      sha256: digest(png),
    });
  }
  await writeFile(
    'public/markers/catalog.json',
    JSON.stringify(
      {
        compiler: 'MindAR 1.2.5',
        matching: 'Unique side confetti only; full card tracking and anchor coordinates',
        version: markerVersion,
        target: `${markerVersion}/targets.mind`,
        bytes: target.byteLength,
        sha256: digest(target),
        images,
      },
      null,
      2,
    ),
  );
}
