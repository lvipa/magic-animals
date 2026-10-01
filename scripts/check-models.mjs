import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const result = spawnSync(
  process.platform === 'win32' ? 'python' : 'python3',
  ['scripts/check-cast-assets.py'],
  { encoding: 'utf8' },
);
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.status !== 0) throw Error('Authored cast validation failed');
if (!process.argv.includes('--assets-only')) {
  const browser = spawnSync(process.execPath, ['scripts/check-cast-runtime.mjs'], {
    stdio: 'inherit',
  });
  if (browser.status !== 0) throw Error('Browser skin/deformation validation failed');
}
await writeFile(
  'MODEL_TEST_RESULTS.json',
  JSON.stringify(
    {
      assets: 'All 8 authored skinned GLBs',
      browser: process.argv.includes('--assets-only')
        ? 'Not run'
        : 'Real production loader, skin weights and pose displacement validated',
    },
    null,
    2,
  ),
);
