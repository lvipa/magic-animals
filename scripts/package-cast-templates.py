"""Package approved-output concept files, without personal inputs or secrets."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import json,hashlib
root=Path(__file__).resolve().parent.parent
directory=root/'public/review/cast-templates'
manifest=json.loads((directory/'templates-manifest.json').read_text(encoding='utf-8'))
names=['milo-turnaround-v1.png']+[c['image'] for c in manifest['characters']]+['templates-manifest.json','prompts-v1.json']
with ZipFile(directory/'milo-friends-templates-v1.zip','w',compression=ZIP_DEFLATED) as archive:
 for name in names:
  assert Path(name).name==name
  archive.write(directory/name,name)
 archive.writestr('README.txt','Magic Animals / Milo and friends\n8 illustrated character turnaround sheets. Modeling references, not rigged 3D assets.\nCreated with built-in ImageGen on 2026-10-01.\nUse original full PNGs as Blender references. Resolve view inconsistencies before meshing.\nSee templates-manifest.json for names/species and prompts-v1.json for generation prompts.\n')
report={name:hashlib.sha256((directory/name).read_bytes()).hexdigest() for name in names}
(root/'assets/characters/cast/concepts/sha256-v1.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('CAST_ZIP_OK',len(names), (directory/'milo-friends-templates-v1.zip').stat().st_size)
