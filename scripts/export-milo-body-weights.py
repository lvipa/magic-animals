import bpy,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent.parent/'.deployment/incoming-milo'
bpy.ops.wm.open_mainfile(filepath=str(root/'milo-body-rig-WIP.blend'))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
report={'topology_sha256':hashlib.sha256(repr([list(p.vertices) for p in body.data.polygons]).encode()).hexdigest(),'weights':[{body.vertex_groups[g.group].name:g.weight for g in v.groups} for v in body.data.vertices]}
(root/'weights-v1.json').write_text(json.dumps(report),encoding='utf-8')
print('WEIGHTS_SAVED',len(report['weights']),report['topology_sha256'])
