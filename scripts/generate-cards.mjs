import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserExecutable } from './browser-runtime.mjs';

const cards = [
  { id: 'cat', color: '#f8b460', dark: '#773b32', symbol: '✦', seed: 17 },
  { id: 'dog', color: '#89c9dc', dark: '#304f73', symbol: '◆', seed: 43 },
  { id: 'lion', color: '#f5cf61', dark: '#795030', symbol: '●', seed: 83 },
];
function animal(id, color, dark) {
  if (id === 'dog')
    return `<g stroke="${dark}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M405 493q-104-41-35-132" fill="none" stroke-width="24"/><ellipse cx="535" cy="511" rx="144" ry="83" fill="${color}"/><path d="M443 552v58h66v-70M602 544v66h74v-114" fill="${color}"/><ellipse cx="618" cy="344" rx="100" ry="127" fill="${color}"/><ellipse cx="685" cy="377" rx="104" ry="56" fill="${color}"/><ellipse cx="537" cy="318" rx="40" ry="106" fill="${dark}" transform="rotate(-17 537 318)"/><ellipse cx="650" cy="301" rx="28" ry="33" fill="#fff9e8" stroke-width="7"/><circle cx="663" cy="304" r="14" fill="${dark}" stroke="none"/><ellipse cx="775" cy="352" rx="27" ry="24" fill="${dark}"/><path d="M662 396q42 50 91 15" fill="none"/><path d="M723 430v38q25 26 40-7l-9-44" fill="#df9393" stroke-width="7"/><path d="M557 435q59 32 111-2" fill="none" stroke="#d49a58" stroke-width="22"/><ellipse cx="545" cy="512" rx="58" ry="45" fill="#fff9e8" stroke="none"/></g>`;
  if (id === 'lion') {
    const mane = Array.from({ length: 13 }, (_, i) => {
      const a = (i / 13) * Math.PI * 2;
      return `<ellipse cx="${555 + Math.cos(a) * 140}" cy="${326 + Math.sin(a) * 130}" rx="53" ry="58" fill="${dark}"/>`;
    }).join('');
    return `<g stroke="${dark}" stroke-width="10" stroke-linecap="round"><path d="M648 567q152 20 133-108" fill="none" stroke-width="16"/><path d="M778 459l-29-48 41-20 33 50z" fill="${dark}"/><ellipse cx="547" cy="560" rx="143" ry="67" fill="${color}"/>${mane}<ellipse cx="555" cy="326" rx="124" ry="111" fill="${color}"/><circle cx="463" cy="225" r="29" fill="${color}"/><circle cx="651" cy="225" r="29" fill="${color}"/><path d="M478 312q21-33 46-3M584 299q27-23 51 11" fill="none" stroke-width="12"/><ellipse cx="560" cy="370" rx="51" ry="37" fill="#fff9e8" stroke="none"/><path d="M540 349l38-2-18 25z" fill="${dark}"/><path d="M560 373q7 34 33 13" fill="none" stroke-width="7"/><ellipse cx="448" cy="604" rx="57" ry="29" fill="${color}"/><ellipse cx="611" cy="604" rx="57" ry="29" fill="${color}"/><path d="M432 591v22M451 591v22M599 591v22M618 591v22" stroke-width="6"/></g>`;
  }
  const ears =
    id === 'cat'
      ? `<path d="M423 265 L388 165 L483 222 M677 265 L712 165 L617 222" fill="${color}" stroke="${dark}" stroke-width="12"/>`
      : id === 'dog'
        ? `<ellipse cx="412" cy="270" rx="65" ry="107" fill="${dark}" transform="rotate(27 412 270)"/><ellipse cx="688" cy="270" rx="65" ry="107" fill="${dark}" transform="rotate(-27 688 270)"/>`
        : `<circle cx="550" cy="352" r="195" fill="${dark}"/><circle cx="550" cy="352" r="170" fill="#b97839"/>`;
  const whiskers =
    id === 'cat'
      ? `<path d="M490 405l-100 -20 M490 420l-100 20 M610 405l100 -20 M610 420l100 20" stroke="${dark}" stroke-width="7"/>`
      : '';
  return `<g>${ears}<ellipse cx="550" cy="350" rx="151" ry="141" fill="${color}" stroke="${dark}" stroke-width="12"/><ellipse cx="497" cy="333" rx="14" ry="20" fill="${dark}"/><ellipse cx="603" cy="333" rx="14" ry="20" fill="${dark}"/><ellipse cx="550" cy="402" rx="29" ry="20" fill="${dark}"/><path d="M550 418q-32 36-65 10 M550 418q32 36 65 10" fill="none" stroke="${dark}" stroke-width="9" stroke-linecap="round"/>${whiskers}<ellipse cx="550" cy="573" rx="113" ry="72" fill="${color}" stroke="${dark}" stroke-width="10"/><ellipse cx="480" cy="604" rx="47" ry="27" fill="${color}" stroke="${dark}" stroke-width="8"/><ellipse cx="620" cy="604" rx="47" ry="27" fill="${color}" stroke="${dark}" stroke-width="8"/></g>`;
}
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
const page = await browser.newPage({
  viewport: { width: 1100, height: 800 },
  deviceScaleFactor: 1,
});
for (const card of cards) {
  let seed = card.seed;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const marks = Array.from({ length: 500 }, (_, i) => {
    const x = Math.floor(rand() * 1050 + 25),
      y = Math.floor(rand() * 700 + 30);
    const size = Math.floor(rand() * 45 + 12);
    const shape =
      i % 3 === 0
        ? `<circle cx="${x}" cy="${y}" r="${size / 2}"/>`
        : i % 3 === 1
          ? `<rect x="${x}" y="${y}" width="${size}" height="${size}" transform="rotate(${Math.floor(rand() * 90)} ${x} ${y})"/>`
          : `<path d="M${x} ${y}l${size} ${-size}l${size} ${size}z"/>`;
    return shape;
  }).join('');
  const motif =
    card.id === 'cat'
      ? '<path d="M-30 26L0-32 35 26z"/><circle cx="0" cy="8" r="6" fill="#fff9e8"/>'
      : card.id === 'dog'
        ? '<circle cx="-14" cy="4" r="26"/><circle cx="22" cy="-25" r="13"/><circle cx="32" cy="22" r="8"/>'
        : '<path d="M0-37L12-11 39 0 11 13 0 38-12 12-38 0-11-12z"/>';
  const corners = [0, 1, 2, 3]
    .map(
      (n) =>
        `<g fill="${card.dark}" transform="translate(${n % 2 ? 1006 : 94} ${n > 1 ? 707 : 93}) rotate(${n * 90})">${motif}</g>`,
    )
    .join('');
  const distinctive =
    card.id === 'cat'
      ? '<path d="M515 220l20 55 22-55M590 225l-15 55 30-20" fill="#773b32"/><path d="M423 285l55 23-25 22M677 285l-55 23 25 22" fill="#a66139"/>'
      : card.id === 'dog'
        ? '<path d="M459 281q13-85 79-50l-10 76-55 20z" fill="#304f73"/><ellipse cx="574" cy="453" rx="21" ry="37" fill="#dd8c89"/><circle cx="631" cy="403" r="24" fill="#304f73"/>'
        : '<path d="M378 318l-34-37 40-28 8-56 63 22 24-59 52 42 38-59 43 61 68-17 1 57 61 20-30 54 36 46-55 26 7 62-57-5-16 53-53-20-29 38-39-46-46 21-20-63-49 6 6-52-57-15z" fill="none" stroke="#e29837" stroke-width="19"/><path d="M458 282l51 7M601 291l51-9" stroke="#795030" stroke-width="15"/>';
  const panel =
    card.id === 'cat'
      ? '<rect x="355" y="125" width="390" height="520" rx="17" fill="#fff9e8"/>'
      : card.id === 'dog'
        ? '<rect x="330" y="190" width="490" height="443" rx="100" fill="#fff9e8"/>'
        : '<ellipse cx="555" cy="407" rx="222" ry="237" fill="#fff9e8"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="800" viewBox="0 0 1100 800"><defs><clipPath id="pattern"><rect x="74" y="74" width="952" height="652" rx="20"/></clipPath></defs><rect width="1100" height="800" fill="#fff9e8"/><rect x="18" y="18" width="1064" height="764" rx="${card.seed}" fill="none" stroke="${card.dark}" stroke-width="18"/><rect x="52" y="52" width="996" height="696" rx="18" fill="none" stroke="${card.color}" stroke-width="16" stroke-dasharray="${card.id === 'cat' ? 'none' : card.id === 'dog' ? '55 15' : '8 16'}"/><g fill="${card.dark}" opacity=".85" clip-path="url(#pattern)">${marks}</g>${corners}${panel}${animal(card.id, card.color, card.dark)}${card.id === 'cat' ? distinctive : ''}<rect x="335" y="638" width="430" height="104" rx="36" fill="${card.dark}"/><text x="550" y="712" text-anchor="middle" font-family="Arial,sans-serif" font-size="80" font-weight="900" fill="white">${card.id.toUpperCase()}</text></svg>`;
  await mkdir('public/markers', { recursive: true });
  await writeFile(`public/markers/${card.id}.svg`, svg);
  await page.setContent(`<style>*{margin:0;padding:0}</style>${svg}`);
  await page.screenshot({ path: `public/markers/${card.id}.png` });
}
await mkdir('public/icons', { recursive: true });
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#122536"/><circle cx="256" cy="257" r="171" fill="#f5a64f"/><path d="M119 165L90 75l119 77M393 165l29-90-119 77" fill="#f5a64f"/><ellipse cx="193" cy="249" rx="17" ry="23" fill="#26344a"/><ellipse cx="319" cy="249" rx="17" ry="23" fill="#26344a"/><path d="M256 303l-27 20 27 15 27-15z" fill="#26344a"/><path d="M257 337q-65 51-112-5M255 337q65 51 112-5" fill="none" stroke="#26344a" stroke-width="15" stroke-linecap="round"/></svg>`;
await writeFile('public/icons/icon.svg', icon);
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon.png', 64],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>*{margin:0;padding:0}svg{width:${size}px;height:${size}px}</style>${icon}`,
  );
  await page.screenshot({ path: `public/icons/${name}` });
}
await browser.close();
console.log('Cards and icons created');
