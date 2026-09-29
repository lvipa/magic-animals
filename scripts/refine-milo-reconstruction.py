"""A reversible eye/material study on the raw Milo 256 reconstruction.

Run with Blender --background assets/characters/cat/milo-reconstruction-256.blend
--python scripts/refine-milo-reconstruction.py. This is NOT a production rig/GLB.
"""
from pathlib import Path
from math import cos,pi,sin
import sys

import bpy
import bmesh
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'assets/characters/cat/milo-reconstruction-256.blend'
variant=int(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else 2
if variant not in (1,2):raise RuntimeError('Supported study variants: 1 or 2.')
suffix='' if variant==1 else '-v2'
output=ROOT/('assets/characters/cat/milo-eye-study'+suffix+'.blend')
render=ROOT/('.test-artifacts/milo-eye-study'+suffix+'-front.png')
if output.exists():raise RuntimeError('Eye study already exists; preserving it.')
if Path(bpy.data.filepath).resolve()!=source.resolve():raise RuntimeError('Open the raw 256 scene first.')
body=next(o for o in bpy.context.scene.objects if o.name=='Milo / raw local reconstruction 256')
if body.get('art_status')!='raw neural mesh; no separated eyes/cloth, UV textures, groom or rig':
    raise RuntimeError('Unexpected mesh state.')
attr=body.data.color_attributes[0]
if variant==2:
    # Light, shape-preserving relaxation of scanner noise. Original stays in
    # milo-reconstruction-256.blend; this study is saved as another file.
    bm=bmesh.new();bm.from_mesh(body.data)
    for _ in range(3):
        bmesh.ops.smooth_vert(bm,verts=bm.verts,factor=.18,use_axis_x=True,
                              use_axis_y=True,use_axis_z=True)
    bm.to_mesh(body.data);bm.free();body.data.update()

def material(name,color,roughness,metallic=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=roughness
    bsdf.inputs['Metallic'].default_value=metallic
    return m

sclera=material('Milo eye / warm ivory sclera',(.83,.80,.72),.22)
outer=material('Milo eye / deep teal limbal ring',(.018,.105,.124),.25)
iris=material('Milo eye / luminous teal iris',(.055,.40,.45),.21)
iris_inner=material('Milo eye / pale iris center',(.20,.65,.65),.25)
pupil=material('Milo eye / black pupil',(.003,.008,.012),.07)
lid=material('Milo eye / soft peach lid',(.83,.58,.47),.7)

def eye_mesh(name,center,rings,segments=64):
    """Smooth curved disk with a few material rings; character faces +X."""
    verts=[]; faces=[]; mids=[]
    for rx,ry,rz,mid in rings:
        for k in range(segments):
            a=2*pi*k/segments
            verts.append((center.x+rx,center.y+ry*cos(a),center.z+rz*sin(a)))
    for j in range(len(rings)-1):
        for k in range(segments):
            kn=(k+1)%segments
            faces.append((j*segments+k,j*segments+kn,(j+1)*segments+kn,(j+1)*segments+k))
            mids.append(rings[j][3])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(ob)
    for mat in (sclera,outer,iris,iris_inner,pupil,lid):mesh.materials.append(mat)
    for poly,index in zip(mesh.polygons,mids):poly.material_index=index;poly.use_smooth=True
    bevel=ob.modifiers.new('round optical transitions','SUBSURF');bevel.levels=1;bevel.render_levels=1
    return ob

centers=[]
for side in (-1,1):
    points=[]
    for vertex in body.data.vertices:
        p=vertex.co;r,g,b,_=attr.data[vertex.index].color
        if p.x>0 and side*p.y>0 and 1.45<p.z<1.90 and g-r>.015 and b-r>.02:
            points.append(p.copy())
    if len(points)<20:raise RuntimeError('Cannot locate original teal eye patch.')
    centers.append(sum(points,Vector())/len(points))

for index,c in enumerate(centers):
    # The underlying reconstructed eye remains as a socket/color guide.
    # Keep lenses tucked into that patch so they do not become protruding beads.
    if variant==1:
        c.x=.345
        rings=[(.024,.087,.083,5),(.034,.078,.075,0),
               (.038,.062,.065,0),(.041,.055,.058,1),
               (.046,.046,.050,2),(.051,.027,.031,3),
               (.053,.021,.024,4),(.054,.002,.002,4)]
    else:
        c.x=.317
        c.y+=.025 if c.y<0 else -.025
        rings=[(.018,.102,.100,5),(.029,.091,.090,0),
               (.035,.079,.080,0),(.040,.070,.072,1),
               (.045,.057,.060,2),(.050,.040,.043,3),
               (.053,.035,.038,4),(.055,.002,.002,4)]
    eye_mesh('Milo optical eye '+str(index+1),c,rings)

# Keep the imported reconstruction untouched. Its vertex colors remain visible
# on the fur/hoodie. The added optics are independent editable meshes.
scene=bpy.context.scene
scene['art_status']='Milo eye study '+str(variant)+'; unretopologized; no groom, rig or art approval.'
camera=bpy.data.objects['Milo camera / front'];camera.location=(5,0,1.08)
camera.rotation_euler=(Vector((0,0,1.08))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera=camera;scene.render.filepath=str(render)
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print({'scene':str(output),'render':str(render),'status':scene['art_status']})
