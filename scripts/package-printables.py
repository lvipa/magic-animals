"""Create eight Milo camera cards on three A4 sheets, plus editable sources."""
from pathlib import Path
import json, zipfile
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm

root=Path(__file__).resolve().parent.parent
out=root/'public/printables';out.mkdir(exist_ok=True)
catalog=json.loads((root/'public/markers/catalog.json').read_text(encoding='utf-8'))
assert catalog['version']=='milo-v2' and len(catalog['images'])==8
cards=catalog['images'];pdf=out/'magic-animals-milo-a4.pdf'
c=canvas.Canvas(str(pdf),pagesize=A4)
c.setTitle('Magic Animals - eight Milo camera cards - A4')
c.setAuthor('Magic Animals')
width,height=A4;card_h=82*mm;card_w=card_h*1100/800
row_h=92*mm
for page in range(3):
    for row,card in enumerate(cards[page*3:page*3+3]):
        y=height-8*mm-(row+1)*row_h+(row_h-card_h)/2
        c.drawImage(str(root/'public/markers'/card['image']),(width-card_w)/2,y,card_w,card_h)
        if row<2 and page*3+row+1<len(cards):
            c.setStrokeColorRGB(.68,.68,.68);c.setDash(2,3)
            line_y=height-8*mm-(row+1)*row_h
            c.line(22*mm,line_y,width-22*mm,line_y)
    c.setFont('Helvetica',8);c.setFillColorRGB(.3,.3,.3)
    c.drawCentredString(width/2,6*mm,f'MILO CARDS v2 | A4 / 100% | {page+1}/3')
    c.showPage()
c.save()

guide='''MAGIC ANIMALS - MILO CAMERA CARDS v2

Eight cards: CAT, DOG, LION, FOX, RABBIT, BEAR, PANDA, ELEPHANT.
Print magic-animals-milo-a4.pdf: three A4 portrait sheets, actual size / 100%.
Each complete card is approximately 113 x 82 mm. Use matte white paper.
Keep the whole border and patterns. Cut only between the cards.

Open https://animals.flowlabli.online and tap SCAN ANY CARD.
Allow the camera and show ONE card at a time, in ANY order.
Move slowly and keep the card lit, fully visible and flat.
PLAY starts the optional CAT -> DOG -> LION narrated adventure.
These v2 designs replace the previous three card designs for the new camera.

The PNGs are the exact images compiled into markers/milo-v2/targets.mind.
SVGs embed original Milo concept artwork and can be edited without extra files.
After editing, regenerate PNGs AND targets.mind together. Edited artwork will
not reliably match the old compiled target. The app's targetIndex order is
listed in markers/catalog.json. Never reorder just one side of this mapping.

Generators in the source repository:
scripts/generate-cards.mjs -> scripts/compile-targets.mjs -> scripts/package-printables.py
HTML preview: printables/cards.html (relative image links work after extraction).
Physical camera use requires HTTPS and camera permission on your device.
'''
(out/'PRINT_README.txt').write_text(guide,encoding='utf-8')
sections=[]
for page in range(3):
    figures=''.join(f'<figure><img src="../markers/{card["image"]}" alt="{card["name"]} - {card["word"]}"></figure>' for card in cards[page*3:page*3+3])
    sections.append(f'<section class="sheet">{figures}<footer>MILO CARDS v2 · A4 / 100% · {page+1}/3</footer></section>')
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Print eight Milo AR cards - Magic Animals</title><style>
*{box-sizing:border-box}body{margin:0;background:#ecf1f3;color:#233744;font:16px/1.5 system-ui,sans-serif}
.guide{max-width:760px;margin:24px auto;padding:24px;background:white;border-radius:18px}
h1{line-height:1.15}a,button{display:inline-block;border:0;border-radius:12px;padding:12px 18px;margin:4px;background:#244f66;color:white;font:inherit;cursor:pointer}
.sheet{position:relative;width:210mm;height:297mm;margin:20px auto;background:white;padding:8mm;box-shadow:0 3px 20px #263c4320}
figure{height:92mm;margin:0;display:flex;align-items:center;justify-content:center;border-bottom:1px dashed #bbb}
figure:last-of-type{border:0}figure img{display:block;width:112.75mm;height:82mm}footer{position:absolute;bottom:4mm;left:0;right:0;text-align:center;font-size:8pt;color:#555}
@media screen and (max-width:820px){.guide{margin:12px}.sheet{width:calc(100% - 24px);height:auto;padding:14px}.sheet figure{height:auto;padding:12px 0}.sheet img{width:min(100%,426px);height:auto}footer{position:static;margin-top:12px}}
@page{size:A4 portrait;margin:0}@media print{body{background:white}.guide{display:none}.sheet{margin:0;box-shadow:none;break-after:page}.sheet:last-child{break-after:auto}img{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style><main><div class="guide"><h1>Eight little Milo friends</h1><p>Print all three A4 sheets at <strong>100% / Actual size</strong> on matte paper. Keep the whole border of each card.</p>
<p>Tap <strong>SCAN ANY CARD</strong> in the game. Show one card at a time in any order. These new cards are for the updated camera.</p>
<button onclick="window.print()">Print cards</button><a href="magic-animals-milo-a4.pdf" download>Download A4 PDF</a><a href="magic-animals-print-sources.zip" download>Download editable SVG + PNG sources</a><a href="/">Open game</a></div>'''+''.join(sections)+'</main></html>'
(out/'cards.html').write_text(html,encoding='utf-8')
with zipfile.ZipFile(out/'magic-animals-print-sources.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for card in cards:
        for ext in ['png','svg']:
            file=Path(card['image']).with_suffix('.'+ext)
            archive.write(root/'public/markers'/file,'markers/'+file.as_posix())
    archive.write(root/'public/markers/catalog.json','markers/catalog.json')
    for name in ['cards.html','magic-animals-milo-a4.pdf','PRINT_README.txt']:
        archive.write(out/name,'printables/'+name)
print(f'Created {pdf.name}: 8 cards, 3 A4 sheets; PNG/SVG/HTML source archive')
