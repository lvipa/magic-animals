"""Close the lining at armpits and remove unused cage vertices; still a study."""
from pathlib import Path
import math
import bpy
import bmesh
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
scene=bpy.context.scene
if scene.get('art_status')!='Milo full silhouette study v3. Art approval, retopology and rig pending.':
    raise RuntimeError('Expected v3 checkpoint; preserving other work.')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'.test-artifacts/milo-full-study-v3.blend'),copy=True)
head=bpy.data.objects['Milo / unified head and ear roots']
bm=bmesh.new(); bm.from_mesh(head.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
bm.to_mesh(head.data); bm.free()

# The inner garment shell covers the torso through the underarm seam. It is
# actual cloth geometry, not a visibility mask for the skin or an image decal.
sections=[(.486,.278,.208),(.53,.28,.206),(.65,.277,.202),(.80,.267,.192),
          (.94,.272,.192),(1.04,.272,.187),(1.12,.212,.142),(1.18,.127,.112)]
vertices=[]; faces=[]
for z,rx,ry in sections:
    for i in range(64):
        a=math.pi*2*i/64
        fold=.008*math.sin(a*7+z*18)+.003*math.sin(a*13-z*24)
        vertices.append((math.sin(a)*(rx+fold)*.994,-math.cos(a)*(ry+fold*.7)*.994,z))
for row in range(len(sections)-1):
    for i in range(64): faces.append((row*64+i,row*64+(i+1)%64,(row+1)*64+(i+1)%64,(row+1)*64+i))
mesh=bpy.data.meshes.new('Milo garment lining / cage'); mesh.from_pydata(vertices,[],faces)
mesh.materials.append(bpy.data.objects['Milo / tailored hoodie with sewn sleeves'].data.materials[0])
for face in mesh.polygons: face.use_smooth=True
uv=mesh.uv_layers.new(name='Milo cloth layout')
for loop in mesh.loops:
    p=mesh.vertices[loop.vertex_index].co; uv.data[loop.index].uv=(p.x*1.5+p.y*.4,p.z*1.5)
lining=bpy.data.objects.new('Milo / inner garment lining',mesh)
bpy.data.collections['03 / separate tailored hoodie'].objects.link(lining)
sub=lining.modifiers.new('Soft lining subdivision','SUBSURF'); sub.levels=2
solid=lining.modifiers.new('Lining thickness','SOLIDIFY'); solid.thickness=.004; solid.offset=-1

hood=bpy.data.objects['Milo / open draped hood and lining']
evaluated=hood.evaluated_get(bpy.context.evaluated_depsgraph_get())
path=[]
for i in range(28):
    z=.79+.40*i/27
    hit,p,normal,index=evaluated.ray_cast(Vector((0,2,z)),Vector((0,-1,0)))
    if hit: path.append((p.x,p.y+.0016,p.z))
data=bpy.data.curves.new('Milo hood center seam','CURVE'); data.dimensions='3D'; data.bevel_depth=.0012; data.bevel_resolution=2
sp=data.splines.new('NURBS'); sp.points.add(len(path)-1)
for dest,p in zip(sp.points,path): dest.co=(*p,1)
sp.order_u=3; sp.use_endpoint_u=True
data.materials.append(bpy.data.objects['Milo / pocket seam 1'].data.materials[0])
seam=bpy.data.objects.new(data.name,data); bpy.data.collections['03 / separate tailored hoodie'].objects.link(seam)
scene['art_status']='Milo full silhouette study v4. Art approval, retopology and rig pending.'
scene.render.filepath=str(ROOT/'.test-artifacts/milo-full-front.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/characters/cat/milo-authoring.blend'))
bpy.ops.render.render(write_still=True)
result={'scene':bpy.data.filepath,'render':scene.render.filepath,'status':scene['art_status']}
