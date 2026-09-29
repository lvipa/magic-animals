import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export async function writeMarkerCatalog() {
  const digest = (data) => createHash('sha256').update(data).digest('hex');
  const target = await readFile('public/markers/targets.mind');
  const images = [];
  for (const [targetIndex, id] of ['cat', 'dog', 'lion'].entries()) {
    const png = await readFile(`public/markers/${id}.png`);
    images.push({
      id,
      targetIndex,
      image: `${id}.png`,
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
        target: 'targets.mind',
        bytes: target.byteLength,
        sha256: digest(target),
        images,
      },
      null,
      2,
    ),
  );
}
