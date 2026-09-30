import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';

const result = await build({
  entryPoints: ['scripts/milo-review-viewer.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  write: false,
  logLevel: 'info',
});
// Three.js embeds multiline GLSL templates. Strip trailing spaces so the
// generated artifact passes Git's whitespace check without changing shader code.
const output = new TextDecoder().decode(result.outputFiles[0].contents)
  .replace(/[\t ]+$/gm, '');
await writeFile('public/review/milo-rig/viewer.js', output);
