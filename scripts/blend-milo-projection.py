"""Blend three source-art projections on Milo's 3D draft for a seam study."""
from pathlib import Path
from mathutils import Vector
import bpy

ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'assets/characters/cat/milo-projection-study.blend'
output=ROOT/'assets/characters/cat/milo-projection-blend-study.blend'
if Path(bpy.data.filepath).resolve()!=source.resolve():raise RuntimeError('Open projection study first.')
if output.exists():raise RuntimeError('Existing blended projection preserved.')
body=next(o for o in bpy.context.scene.objects if o.name=='Milo / raw local reconstruction 256')
mesh=body.data
image=bpy.data.images.get('milo-turnaround-v1.png')
if not image or not image.packed_file:raise RuntimeError('Packed original turnaround unavailable.')

def coords(p,view):
    z=max(0,min(2.1,p.z))
    if view=='front':px=22+(max(-.56,min(.56,p.y))+.56)/1.12*515
    elif view=='back':px=1060+(.56-max(-.56,min(.56,p.y)))/1.12*435
    else:px=590+(.56-max(-.56,min(.56,p.x)))/1.12*440
    return (px/1536,1-(950-z/2.1*880)/1024)

for view in ('front','back','side'):
    uv=mesh.uv_layers.new(name='Milo '+view+' projection')
    for face in mesh.polygons:
        for loop_index in face.loop_indices:
            uv.data[loop_index].uv=coords(mesh.vertices[mesh.loops[loop_index].vertex_index].co,view)

mat=bpy.data.materials.new('Milo / soft three-view projection')
mat.use_nodes=True
nodes=mat.node_tree.nodes;links=mat.node_tree.links
def math_op(operation,a,b=None):
    node=nodes.new('ShaderNodeMath');node.operation=operation
    if isinstance(a,(float,int)):node.inputs[0].default_value=a
    else:links.new(a,node.inputs[0])
    if b is not None:
        if isinstance(b,(float,int)):node.inputs[1].default_value=b
        else:links.new(b,node.inputs[1])
    return node.outputs[0]
def mix(color_a,color_b,fac):
    node=nodes.new('ShaderNodeMixRGB');node.blend_type='MIX'
    links.new(fac,node.inputs['Fac']);links.new(color_a,node.inputs['Color1'])
    links.new(color_b,node.inputs['Color2'])
    return node.outputs['Color']
colors={}
for view in ('front','back','side'):
    uvnode=nodes.new('ShaderNodeUVMap');uvnode.uv_map='Milo '+view+' projection'
    tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='CLIP'
    links.new(uvnode.outputs['UV'],tex.inputs['Vector'])
    colors[view]=tex.outputs['Color']
normal=nodes.new('ShaderNodeNewGeometry').outputs['Normal']
xyz=nodes.new('ShaderNodeSeparateXYZ');links.new(normal,xyz.inputs[0])
front=math_op('POWER',math_op('MAXIMUM',xyz.outputs['X'],0),4)
back=math_op('POWER',math_op('MAXIMUM',math_op('MULTIPLY',xyz.outputs['X'],-1),0),4)
side=math_op('POWER',math_op('ABSOLUTE',xyz.outputs['Y']),4)
longitudinal=math_op('ADD',front,back)
back_ratio=math_op('DIVIDE',back,math_op('ADD',longitudinal,.000001))
side_ratio=math_op('DIVIDE',side,math_op('ADD',math_op('ADD',longitudinal,side),.000001))
projected=mix(mix(colors['front'],colors['back'],back_ratio),colors['side'],side_ratio)

# Neutral studio background in the reference has low saturation. Fade such
# samples back to the reconstruction's own vertex colors on out-of-register
# parts (paws and tail), while retaining the original textile/fur detail.
separate=nodes.new('ShaderNodeSeparateColor');separate.mode='HSV'
links.new(projected,separate.inputs['Color'])
mask=math_op('MULTIPLY',math_op('SUBTRACT',separate.outputs['Green'],.08),11.11)
mask=math_op('MINIMUM',math_op('MAXIMUM',mask,0),1)
old=nodes.new('ShaderNodeVertexColor');old.layer_name=mesh.color_attributes[0].name
base=mix(old.outputs['Color'],projected,mask)
p=nodes.get('Principled BSDF');links.new(base,p.inputs['Base Color'])
p.inputs['Roughness'].default_value=.82
mesh.materials.clear();mesh.materials.append(mat)
scene=bpy.context.scene
scene['art_status']='Blended source-art projection experiment; seams and shape still unapproved.'
for name,position in [('front',(5,0,1.08)),('side',(0,-5,1.08)),('back',(-5,0,1.08))]:
    camera=bpy.data.objects['Milo camera / front'];camera.location=position
    camera.rotation_euler=(Vector((0,0,1.08))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera
    scene.render.filepath=str(ROOT/('.test-artifacts/milo-projection-blend-'+name+'.png'))
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print({'scene':str(output),'status':scene['art_status']})
