"""Localized silhouette smoothing; keep original source intact."""
import bpy,bmesh,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent/'.deployment/incoming-milo'
bpy.ops.wm.open_mainfile(filepath=str(root/'milo-incoming-source.blend'))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000002);bm.to_mesh(body.data);bm.free();body.data.update()
def ramp(v,a,b):
 t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
group=body.vertex_groups.new(name='sculpt / feather artifacts only')
selected=0
for v in body.data.vertices:
 x,y,z=v.co
 crown=ramp(z,.78,.86)*(1-ramp(abs(x),.12,.23))
 cheek=ramp(abs(x),.27,.36)*ramp(z,.30,.39)*(1-ramp(z,.58,.70))
 back=ramp(y,.22,.32)*ramp(z,.35,.42)*(1-ramp(z,.54,.64))
 weight=max(crown,cheek,back)
 if weight>0:group.add([v.index],weight,'REPLACE');selected+=1
bpy.context.view_layer.objects.active=body;body.select_set(True)
mod=body.modifiers.new('Localized feather smoothing','SMOOTH');mod.factor=1;mod.iterations=180;mod.vertex_group=group.name
bpy.ops.object.modifier_apply(modifier=mod.name)
body.vertex_groups.remove(body.vertex_groups['sculpt / feather artifacts only'])
bpy.ops.wm.save_as_mainfile(filepath=str(root/'milo-cleaned-source-WIP.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'milo-cleaned-source-WIP.glb'),export_format='GLB',export_animations=False)
print(json.dumps({'affected_vertices':selected,'scope':'crown, cheek contour, rear head only; no eye/nose/mouth change'}))
