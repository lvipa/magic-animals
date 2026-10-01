import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserExecutable } from './browser-runtime.mjs';
import { cards, markerDirectory } from './marker-roster.mjs';

// Keep the front view of the original Milo turnarounds in an editable SVG.
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 800 },
    deviceScaleFactor: 1,
  });
  await mkdir(markerDirectory, { recursive: true });
  for (const [index, card] of cards.entries()) {
    let seed = card.seed;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const image = await readFile(card.reference);
    // Turnaround front views can extend beyond exactly one third (wide ears
    // and outstretched paws). Keep those, excluding the adjacent side view.
    const frontWidth = card.id === 'elephant' ? 600 : 560;
    const frontClip =
      card.id === 'elephant'
        ? '<path d="M0 0H600V335H545V475H580V1024H0Z"/>'
        : `<rect width="${frontWidth}" height="1024"/>`;
    const marks = Array.from({ length: 650 }, () => {
      const x = Math.floor(rand() * 1000 + 50),
        y = Math.floor(rand() * 650 + 60),
        size = Math.floor(rand() * 43 + 16);
      if (x > 350 && x < 750 && y > 120 && y < 640) return '';
      const sides = 4 + Math.floor(rand() * 4),
        angle = rand() * Math.PI * 2;
      const points = Array.from({ length: sides }, (_, k) => {
        const radius = size * (0.3 + rand() * 0.5),
          a = angle + (k * Math.PI * 2) / sides;
        return `${(x + Math.cos(a) * radius).toFixed(1)},${(y + Math.sin(a) * radius).toFixed(1)}`;
      }).join(' ');
      return `<polygon points="${points}" opacity="${(0.5 + rand() * 0.5).toFixed(2)}"/>`;
    }).join('');
    const corners = [0, 1, 2, 3]
      .map((n) => {
        const x = n % 2 ? 985 : 115,
          y = n > 1 ? 680 : 120,
          spokes = 3 + index;
        return (
          `<g transform="translate(${x} ${y}) rotate(${index * 13 + n * 37})" fill="${card.dark}">` +
          Array.from(
            { length: spokes },
            (_, k) =>
              `<ellipse rx="8" ry="23" cy="-28" transform="rotate(${(k * 360) / spokes})"/>`,
          ).join('') +
          `<circle r="15" fill="#fff8ed"/></g>`
        );
      })
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="800" viewBox="0 0 1100 800">
      <defs><clipPath id="portrait"><rect x="378" y="130" width="344" height="500" rx="42"/></clipPath><clipPath id="pattern"><rect x="48" y="48" width="1004" height="704" rx="24"/></clipPath></defs>
      <rect width="1100" height="800" fill="#fff8ed"/><rect x="18" y="18" width="1064" height="764" rx="${22 + index * 7}" fill="none" stroke="${card.dark}" stroke-width="18" stroke-dasharray="${index ? `${17 + index * 9} ${9 + index * 3}` : 'none'}"/>
      <rect x="50" y="50" width="1000" height="700" rx="24" fill="${card.color}"/>
      <g fill="${card.dark}" opacity=".85" clip-path="url(#pattern)">${marks}</g>${corners}
      <rect x="350" y="100" width="400" height="550" rx="52" fill="#fff8ed"/>
      <g clip-path="url(#portrait)"><svg x="378" y="130" width="344" height="500" viewBox="-12 0 ${frontWidth + 24} 1024" preserveAspectRatio="xMidYMid meet"><defs><clipPath id="front">${frontClip}</clipPath></defs><image width="1536" height="1024" clip-path="url(#front)" href="data:image/png;base64,${image.toString('base64')}"/></svg></g>
      <rect x="380" y="58" width="340" height="65" rx="28" fill="#fff8ed"/><text x="550" y="104" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${card.dark}">${card.name}</text>
      <rect x="290" y="645" width="520" height="106" rx="32" fill="${card.dark}"/><text x="550" y="722" text-anchor="middle" font-family="Arial,sans-serif" font-size="${card.word.length > 6 ? 64 : 78}" font-weight="900" fill="white">${card.word}</text>
    </svg>`;
    await writeFile(`${markerDirectory}/${card.id}.svg`, svg);
    await page.setContent(`<style>*{margin:0;padding:0}</style>${svg}`);
    await page.evaluate(async () => {
      for (const image of document.querySelectorAll('image')) {
        const i = new Image();
        i.src = image.getAttribute('href');
        await i.decode();
      }
    });
    await page.screenshot({ path: `${markerDirectory}/${card.id}.png` });
    console.log(`CARD ${card.word} · ${card.name}`);
  }
} finally {
  await browser.close();
}
