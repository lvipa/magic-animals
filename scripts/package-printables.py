"""Build a 100%-scale A4 PDF and a portable archive of the marker sources."""
from pathlib import Path
import zipfile
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
root=Path(__file__).resolve().parent.parent
out=root/'public/printables'
out.mkdir(exist_ok=True)
pdf=out/'magic-animals-a4.pdf'
c=canvas.Canvas(str(pdf),pagesize=A4)
c.setTitle('Magic Animals - A4 camera cards')
c.setAuthor('Magic Animals')
width,height=A4
card_h=82*mm; card_w=card_h*1100/800
row_h=(height-16*mm)/3
for i,id in enumerate(['cat','dog','lion']):
    y=height-8*mm-(i+1)*row_h+(row_h-card_h)/2
    c.drawImage(str(root/'public/markers'/f'{id}.png'),(width-card_w)/2,y,card_w,card_h)
    if i<2:
        c.setStrokeColorRGB(.68,.68,.68); c.setDash(2,3)
        line_y=height-8*mm-(i+1)*row_h
        c.line(22*mm,line_y,width-22*mm,line_y)
c.showPage(); c.save()
guide='''MAGIC ANIMALS PRINT SOURCES

Print magic-animals-a4.pdf: A4 portrait, actual size / 100%, no fit-to-page.
Use matte paper and keep the complete border and patterns of each card.
Each card is approximately 113 x 82 mm.

CAT, DOG and LION are the three supported camera targets.
PNG files are the exact images matched by the shipped targets.mind.
SVG files are editable originals. After editing an image, regenerate PNG
and targets.mind together; a changed card will not match the old target.

HTML preview: printables/cards.html (image paths also work after extraction).
Generator: scripts/generate-cards.mjs in the source repository.
Camera permission requires HTTPS on a phone or tablet.
'''
(out/'PRINT_README.txt').write_text(guide,encoding='utf-8')
html=(out/'cards.html').read_text(encoding='utf-8').replace('src="/markers/','src="../markers/')
(out/'cards.html').write_text(html,encoding='utf-8')
with zipfile.ZipFile(out/'magic-animals-print-sources.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for id in ['cat','dog','lion']:
        for ext in ['png','svg']: archive.write(root/'public/markers'/f'{id}.{ext}',f'markers/{id}.{ext}')
    for name in ['cards.html','magic-animals-a4.pdf','PRINT_README.txt']: archive.write(out/name,'printables/'+name)
print('Created A4 PDF and PNG/SVG/HTML print source archive')
