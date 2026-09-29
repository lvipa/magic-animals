"""Project Milo's approved three-view artwork onto a raw 3D draft.

Uses the original image as a texture atlas without changing its pixels.
This is a visual feasibility study, not a production-ready UV unwrap or GLB.
"""
from pathlib import Path
from mathutils import Vector
import bpy

ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'assets/characters/cat/milo-reconstruction-256.blend'
output=ROOT/'assets/characters/cat/milo-projection-study.blend'
art=ROOT/'assets/characters/cat/concepts/milo-turnaround-v1.png'
if Path(bpy.data.filepath).resolve()!=source.resolve():raise RuntimeError('Open raw 256 study first.')
if output.exists():raise RuntimeError('Existing texture projection study preserved.')
body=next(o for o in bpy.context.scene.objects if o.name=='Milo / raw local reconstruction 256')
image=bpy.data.images.load(str(art),check_existing=True)
if tuple(image.size)!=(1536,1024):raise RuntimeError('Unexpected approved reference dimensions.')
image.pack()

mesh=body.data
uv=mesh.uv_layers.new(name='Milo turnaround directional projection')
for face in mesh.polygons:
    normal=face.normal
    if abs(normal.x)>=abs(normal.y):view='front' if normal.x>=0 else 'back'
    else:view='side'
    for loop_index in face.loop_indices:
        p=mesh.vertices[mesh.loops[loop_index].vertex_index].co
        z=max(0,min(2.1,p.z))
        if view=='front':
            px=22+(max(-.56,min(.56,p.y))+.56)/1.12*515
        elif view=='back':
            px=1060+(.56-max(-.56,min(.56,p.y)))/1.12*435
        else:
            # Approved side portrait faces left, while raw draft faces +X.
            px=590+(.56-max(-.56,min(.56,p.x)))/1.12*440
        py=950-z/2.1*880
        uv.data[loop_index].uv=(px/1536,1-py/1024)

mat=bpy.data.materials.new('Milo / approved turnaround projection')
mat.use_nodes=True
nodes=mat.node_tree.nodes;links=mat.node_tree.links
tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Linear'
tex.extension='CLIP'
uvnode=nodes.new('ShaderNodeUVMap');uvnode.uv_map=uv.name
links.new(uvnode.outputs['UV'],tex.inputs['Vector'])
p=nodes.get('Principled BSDF');links.new(tex.outputs['Color'],p.inputs['Base Color'])
p.inputs['Roughness'].default_value=.8
mesh.materials.clear();mesh.materials.append(mat)
scene=bpy.context.scene
scene['art_status']='Original concept projection on neural shape; not approved, not rigged or web optimized.'
scene.render.resolution_x=900;scene.render.resolution_y=1000
for name,position in [('front',(5,0,1.08)),('side',(0,-5,1.08)),('back',(-5,0,1.08))]:
    camera=bpy.data.objects['Milo camera / front'];camera.location=position
    camera.rotation_euler=(Vector((0,0,1.08))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera
    scene.render.filepath=str(ROOT/('.test-artifacts/milo-projection-study-'+name+'.png'))
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print({'scene':str(output),'status':scene['art_status']})
