"""Carve socket shapes in a copy of Milo's raw mesh and embed curved eyes.

This is an exploratory sculpt, not approved CAT geometry or a production GLB.
Blender --background assets/characters/cat/milo-reconstruction-256.blend \
  --python scripts/sculpt-milo-sockets.py
"""
from math import acos, cos, pi, sin
from pathlib import Path

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'assets/characters/cat/milo-reconstruction-256.blend'
output=ROOT/'assets/characters/cat/milo-socket-study.blend'
if Path(bpy.data.filepath).resolve()!=source.resolve():raise RuntimeError('Open raw Milo 256 first.')
if output.exists():raise RuntimeError('Existing sculpt study preserved.')
body=next(o for o in bpy.context.scene.objects if o.name=='Milo / raw local reconstruction 256')
if body.get('art_status')!='raw neural mesh; no separated eyes/cloth, UV textures, groom or rig':
    raise RuntimeError('Unexpected input scene.')
attr=body.data.color_attributes[0]
if attr.domain!='POINT':raise RuntimeError('Expected point-domain colors.')

def make_mat(name,rgb,roughness):
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*rgb,1)
    mat.use_nodes=True
    p=mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Roughness'].default_value=roughness
    return mat

eye_materials=[
    make_mat('Eye / deep pupil',(.002,.006,.010),.07),
    make_mat('Eye / inner teal iris',(.045,.34,.39),.16),
    make_mat('Eye / outer iris',(.012,.115,.14),.19),
    make_mat('Eye / warm ivory sclera',(.74,.70,.65),.23),
]

centers=[]
for side in (-1,1):
    blue=[];surround=[]
    for vertex in body.data.vertices:
        p=vertex.co;r,g,b,a=attr.data[vertex.index].color
        if p.x<.15 or not (1.42<p.z<1.70) or side*p.y<.04:continue
        if g-r>.015 and b-r>.02:blue.append(p.copy())
        else:surround.append((r,g,b))
    if len(blue)<20 or len(surround)<20:raise RuntimeError('Cannot isolate eye regions.')
    c=sum(blue,Vector())/len(blue)
    skin=tuple(sum(rgb[i] for rgb in surround)/len(surround) for i in range(3))
    centers.append((c,skin))

for c,skin in centers:
    # Depression extends past the neural blue patch into contiguous cheek/forehead.
    # It is part of the same original skin mesh, unlike overlay ring studies.
    cy=c.y+(.012 if c.y<0 else -.012)
    for vertex in body.data.vertices:
        p=vertex.co
        if p.x<.14:continue
        dy=(p.y-cy)/.112;dz=(p.z-c.z)/.117
        r2=dy*dy+dz*dz
        if r2<1:
            p.x-=.115*(1-r2)**2
        rgba=attr.data[vertex.index].color
        if abs(p.y-c.y)<.085 and abs(p.z-c.z)<.09 and rgba[1]-rgba[0]>.015 and rgba[2]-rgba[0]>.02:
            rgba[:]=(skin[0],skin[1],skin[2],rgba[3])

    # A single smooth ocular mesh; iris and pupil are material zones on the
    # curved surface. The rest of the volume sits inside the carved socket.
    cx=.287;rx=.081;ry=.106;rz=.109
    segments=64;steps=40
    verts=[];faces=[];face_mats=[]
    for i in range(steps+1):
        theta=pi*i/steps
        for j in range(segments):
            phi=2*pi*j/segments
            verts.append((cx+rx*cos(theta),cy+ry*sin(theta)*cos(phi),c.z+rz*sin(theta)*sin(phi)))
    for i in range(steps):
        theta=pi*(i+.5)/steps
        mat=0 if theta<.36 else 1 if theta<.69 else 2 if theta<.83 else 3
        for j in range(segments):
            n=(j+1)%segments
            faces.append((i*segments+j,(i+1)*segments+j,(i+1)*segments+n,i*segments+n))
            face_mats.append(mat)
    mesh=bpy.data.meshes.new('Curved ocular mesh');mesh.from_pydata(verts,[],faces);mesh.update()
    eye=bpy.data.objects.new('Milo / embedded eye '+('L' if c.y<0 else 'R'),mesh)
    bpy.context.scene.collection.objects.link(eye)
    for mat in eye_materials:mesh.materials.append(mat)
    for face,index in zip(mesh.polygons,face_mats):
        face.material_index=index;face.use_smooth=True

body.data.update()
scene=bpy.context.scene
scene['art_status']='Socket sculpt experiment; raw body topology, no fur/cloth separation/rig, not approved.'
scene.render.resolution_x=900;scene.render.resolution_y=1000
for name,position in [('front',(5,0,1.08)),('side',(0,-5,1.08))]:
    camera=bpy.data.objects['Milo camera / front'];camera.location=position
    camera.rotation_euler=(Vector((0,0,1.08))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera
    scene.render.filepath=str(ROOT/('.test-artifacts/milo-socket-study-'+name+'.png'))
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print({'scene':str(output),'status':scene['art_status']})
