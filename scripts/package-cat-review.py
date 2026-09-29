"""Package genuine browser screenshots after CUA review; never generate images.

Input: artifacts/cat-master-webgl/review.json and its PNG files.
Run only after capturing the current GLB in the browser.
"""
from pathlib import Path
import hashlib, html, json, shutil, struct

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'artifacts/cat-master-webgl'
OUT = ROOT / 'public/review/cat-master'
OUT.mkdir(parents=True, exist_ok=True)
frames = json.loads((SOURCE / 'review.json').read_text(encoding='utf-8'))
assert len({frame['file'] for frame in frames}) == len(frames)
assert {f['angle'] for f in frames if f['kind'] == 'angle'} == set(range(0, 360, 45))
assert {f['action'] for f in frames if 'action' in f} == {'idle','happy','wave','jump','run','sleep','roar'}
asset = (ROOT / 'public/models/cat-studio.glb').read_bytes()
length = struct.unpack_from('<I', asset, 12)[0]
gltf = json.loads(asset[20:20+length])
triangles = sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
catalog_path = ROOT / 'public/models/catalog.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
cat = next(entry for entry in catalog['models'] if entry['id'] == 'cat')
cat.update(bytes=len(asset), meshes=len(gltf['meshes']), triangles=triangles)
catalog_path.write_text(json.dumps(catalog, indent=2)+'\n', encoding='utf-8')
manifest = {
    'renderer': 'Three.js / React Three Fiber, browser WebGL',
    'glbSha256': hashlib.sha256(asset).hexdigest(),
    'approval': 'pending', 'artAcceptance': 'not passed',
    'camera': 'Existing gallery FOV 33 / distance 4.6; no per-action reframing',
    'frames': frames,
}
for frame in frames:
    name = frame['file']
    assert Path(name).name == name and name.endswith('.png')
    shutil.copyfile(SOURCE / name, OUT / name)
(OUT / 'review.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')

groups = [('angle','Восемь ракурсов'),('animation','Семь действий: спереди и сбоку'),
          ('phase','Дополнительные фазы Jump / Run / Sleep'),('reveal','Появление по этапам игры')]
sections = []
for kind, title in groups:
    figures = []
    for frame in frames:
        if frame['kind'] != kind: continue
        caption = (f"Reveal {frame['value']}" if kind == 'reveal' else
                   f"{frame['action'].title()} · {frame['angle']}° · phase {frame['phase']}")
        name = html.escape(frame['file'])
        figures.append(f'<figure><a href="{name}"><img src="{name}" loading="lazy" alt="{html.escape(caption)}"></a><figcaption>{html.escape(caption)}</figcaption></figure>')
    sections.append(f'<section id="{kind}"><h2>{title}</h2><div class="grid">'+''.join(figures)+'</div></section>')
page = '''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CAT — WebGL review, художественный этап не завершён</title>
<style>body{margin:0;background:#142e40;color:#fff5df;font:17px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:28px}h1{font-size:clamp(26px,4vw,40px);line-height:1.2}a{color:#ffdd9e}.status{background:#2e4854;border-left:4px solid #ffd484;padding:18px;border-radius:12px}nav{display:flex;gap:20px;flex-wrap:wrap;margin:25px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}figure{margin:0;background:#1c3c50;border-radius:14px;overflow:hidden}img{display:block;width:100%;height:auto}figcaption{padding:10px}section{scroll-margin-top:24px}code{overflow-wrap:anywhere;font-size:12px}footer{margin-top:32px;color:#c2d3de}</style>
<main><a href="/friends">← Открыть живую галерею и движения</a><h1>CAT v7 · обзор настоящего WebGL</h1>
<div class="status"><strong>Технический кандидат. Художественный этап не завершён.</strong><p>Снимки экспортированного GLB в браузере, без генерации или ретуши. Связная сетка и риг заменены, но эталонный уровень персонажа пока не достигнут. Остальные животные не изменены.</p>
<p>Остаётся: встроить глаза в более выразительную форму лица, усилить читаемую короткую шерсть и пушистость хвоста, доработать тканевые складки и силуэт капюшона. В Jump верх ушей может выйти за край прежнего кадра — камера специально не подстраивалась.</p></div>
<nav><a href="#angle">360°</a><a href="#animation">Действия</a><a href="#phase">Фазы</a><a href="#reveal">Появление</a></nav>
<p>Кадры статичные. Нажмите снимок, чтобы открыть оригинал. Анимации проигрываются в <a href="/friends">галерее</a>.</p>'''
page += ''.join(sections)
page += f'<footer>{triangles:,} треугольников · {len(gltf["skins"][0]["joints"])} костей · {len(gltf["animations"])} clips · {len(asset)/1048576:.2f} MiB GLB<p>SHA-256: <code>{manifest["glbSha256"]}</code> · <a href="review.json">manifest</a></p>Мобильный FPS, физический iPad и TV не проверены. Технические тесты не подтверждают художественное качество.</footer></main></html>'
(OUT / 'index.html').write_text(page, encoding='utf-8')
print(f'Packaged {len(frames)} actual WebGL screenshots; art acceptance pending')
