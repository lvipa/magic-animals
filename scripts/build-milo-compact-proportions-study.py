"""Build a separate unapproved compact Milo study; preserve the game CAT."""
from pathlib import Path
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Quaternion

root=Path(__file__).resolve().parent.parent
out=root/'assets/characters/cat/studies/milo-compact-proportions-WIP'
if (out/'milo-friendly-proportions-WIP.blend').exists():
    raise RuntimeError('Study already exists; preserve manual edits before rebuilding')
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/characters/cat/studies/milo-garment-deformation-WIP/milo-garment-deformation-WIP.blend'))
arm=bpy.data.objects['Milo technical rig - UNAPPROVED']
head=bpy.data.objects['Milo projected head - UNAPPROVED hybrid']
bm=bmesh.new(); bm.from_mesh(head.data)
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
    dist=.0001,plane_co=(0,0,1.275),plane_no=(0,0,1),clear_inner=True,clear_outer=False)
bm.to_mesh(head.data); bm.free()
for v in head.data.vertices:
    # Keep face UV landmarks; only change silhouette proportions and ear tips.
    if v.co.z>1.9:
        v.co.z=1.9+(v.co.z-1.9)*.62
    v.co.x*=1.04
    v.co.z-=.16
head.data.update()
# Keep one baked color map without an additional vertex-color multiplier.
# A small albedo-colored shadow fill softens the reconstructed lower face.
# This is a WIP shading choice, not a substitute for a sculpted facial rig.
head_material=head.data.materials[0]
tree=head_material.node_tree
image_node=next(n for n in tree.nodes if n.type=='TEX_IMAGE')
principled=next(n for n in tree.nodes if n.type=='BSDF_PRINCIPLED')
tree.links.new(image_node.outputs['Color'],principled.inputs['Base Color'])
tree.links.new(image_node.outputs['Color'],principled.inputs['Emission Color'])
principled.inputs['Emission Strength'].default_value=.18
for attr in list(head.data.color_attributes): head.data.color_attributes.remove(attr)

def arm_point(p):
    side=1 if p.x>0 else -1
    return Vector((side*(.315+(abs(p.x)-.300)*.85),p.y*1.12,
                   1.075+(p.z-1.075)*.78))

body=bpy.data.objects['Milo / connected body limbs and paws']
bm=bmesh.new(); bm.from_mesh(body.data)
bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z>1.1
    or (abs(f.calc_center_median().x)>.36 and f.calc_center_median().z>.4)],context='FACES')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
bm.to_mesh(body.data); bm.free()
for v in body.data.vertices:
    if abs(v.co.x)>.35 and v.co.z>.4:
        v.co=arm_point(v.co)
    elif v.co.z<.51:
        # Slightly broader stance and fuller feet; keep ground contact.
        v.co.x*=1.10
        v.co.y*=1.08

for name in ('Milo / tailored hoodie with sewn sleeves','Milo / inner garment lining'):
    ob=bpy.data.objects[name]
    for v in ob.data.vertices:
        if name.endswith('sewn sleeves') and v.index>=498:
            v.co=arm_point(v.co)
        else:
            v.co.x*=1.16
            v.co.y*=1.16
            if v.co.z>1.04: v.co.z+=.025
    ob.data.update()
for name in ('Milo / shaped pocket -1','Milo / shaped pocket 1',
             'Milo / zipper teeth','Milo / ribbed lower hem'):
    ob=bpy.data.objects[name]
    for v in ob.data.vertices:
        v.co.x*=1.16; v.co.y*=1.16
for name in ('Milo / ribbed wrist -1','Milo / ribbed wrist 1'):
    ob=bpy.data.objects[name]
    for v in ob.data.vertices: v.co=arm_point(v.co)

# Continuous quad mittens with an integrated thumb swell and softly rounded
# fingertip edge. These replace the old flattened, stretched hand surfaces.
fur=body.data.materials[0]
for side,label in ((-1,'L'),(1,'R')):
    vs=[]; fs=[]; n=32
    rings=[(.463,.694,.061,.054),(.469,.680,.079,.063),
           (.485,.646,.095,.076),(.500,.610,.095,.076),
           (.511,.580,.071,.063),(.516,.560,.039,.039),
           (.518,.553,.013,.014)]
    for j,(cx,z,rx,ry) in enumerate(rings):
        for i in range(n):
            a=2*math.pi*i/n
            thumb=.018*max(0,-math.sin(a))**10*math.exp(-((j-2.0)/1.1)**2)
            radius=rx+thumb
            finger=.004*math.cos(3*a)*math.exp(-((j-4)/1.2)**2)
            vs.append((side*(cx+.925*math.sin(a)*radius),-.012+math.cos(a)*ry,
                       z+.380*math.sin(a)*radius+finger))
        if j:
            for i in range(n):
                k=(i+1)%n; fs.append(((j-1)*n+i,(j-1)*n+k,j*n+k,j*n+i))
    fs.append(tuple(range(n))); fs.append(tuple(reversed(range((len(rings)-1)*n,len(rings)*n))))
    mesh=bpy.data.meshes.new('Milo / '+label+' mitten quad cage')
    mesh.from_pydata(vs,[],fs); mesh.materials.append(fur); mesh.update()
    bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
    for f in mesh.polygons: f.use_smooth=True
    colors=mesh.color_attributes.new(name='Milo_FurColor',type='FLOAT_COLOR',domain='POINT')
    for v in mesh.vertices: colors.data[v.index].color=(.84,.65,.43,1)
    ob=bpy.data.objects.new('Milo / rounded mitten '+label,mesh); bpy.context.scene.collection.objects.link(ob)
    ob.parent=arm
    group=ob.vertex_groups.new(name='paw_'+label); group.add(list(range(len(mesh.vertices))),1,'REPLACE')
    mod=ob.modifiers.new('Editable mitten surface','SUBSURF'); mod.levels=1; mod.render_levels=1
    mod=ob.modifiers.new('Milo mitten skin','ARMATURE'); mod.object=arm

# A quieter lavender cloth color and subtle micro-normal retain real PBR maps.
cloth=bpy.data.objects['Milo / tailored hoodie with sewn sleeves'].data.materials[0]
color_node=next(n for n in cloth.node_tree.nodes if n.type=='TEX_IMAGE' and 'color' in n.image.name)
cloth_image=color_node.image.copy(); cloth_image.name='Milo / quiet lavender fleece color'
pixels=np.asarray(cloth_image.pixels[:],dtype=np.float32).reshape(-1,4)
luma=pixels[:,:3]@np.array([.2126,.7152,.0722],dtype=np.float32)
pixels[:,:3]=np.clip((pixels[:,:3]*.78+luma[:,None]*.22)*np.array([.95,1.08,.90]),0,1)
cloth_image.pixels.foreach_set(pixels.ravel()); cloth_image.pack(); color_node.image=cloth_image
for n in cloth.node_tree.nodes:
    if n.type=='NORMAL_MAP': n.inputs['Strength'].default_value=.12

# Rebuild the dropped hood as a rounded fabric bag with a supported opening.
# Unlike the old cone, it retains width below the opening before rounding off.
hood=bpy.data.objects['Milo / open draped hood and lining']
materials=list(hood.data.materials)
verts=[]; faces=[]; N=64
sections=[(.322,.247,.102,1.17,.052),(.325,.250,.103,1.155,.052),
          (.333,.249,.145,1.105,.033),(.327,.230,.192,1.040,.020),
          (.290,.192,.229,.985,.010),(.217,.128,.239,.950,0),
          (.100,.052,.244,.937,0),(.028,.015,.244,.936,0)]
for row,(rx,ry,cy,z,slope) in enumerate(sections):
    for i in range(N):
        a=2*math.pi*i/N
        fold=.004*math.sin(5*a+row*.6)*math.sin(math.pi*row/(len(sections)-1))
        verts.append((math.sin(a)*(rx+fold),cy-math.cos(a)*(ry+fold),
                      z-slope*math.cos(a)))
    if row:
        for i in range(N):
            j=(i+1)%N
            faces.append(((row-1)*N+i,(row-1)*N+j,row*N+j,row*N+i))
faces.append(tuple(reversed(range((len(sections)-1)*N,len(sections)*N))))
mesh=bpy.data.meshes.new('Milo / rounded dropped hood cage')
mesh.from_pydata(verts,[],faces); mesh.update()
for mat in materials: mesh.materials.append(mat)
bm=bmesh.new(); bm.from_mesh(mesh)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
uv=mesh.uv_layers.new(name='Milo cloth UV')
for loop in mesh.loops:
    co=mesh.vertices[loop.vertex_index].co
    uv.data[loop.index].uv=(co.x*1.5+co.y*.4,co.z*1.5)
for face in mesh.polygons: face.use_smooth=True
old=hood.data; hood.data=mesh
hood.vertex_groups.clear()
group=hood.vertex_groups.new(name='spine'); group.add(list(range(len(mesh.vertices))),1,'REPLACE')
if old.users==0: bpy.data.meshes.remove(old)

# Rebind the retained clips to the shortened rest skeleton, not to scaled
# object transforms. Bone names/hierarchy and animation tracks stay consistent.
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='EDIT')
for bone in arm.data.edit_bones:
    if bone.name.startswith(('upper_arm_','lower_arm_','paw_')):
        bone.head=arm_point(bone.head); bone.tail=arm_point(bone.tail)
    elif bone.name=='neck': bone.tail.z-=.16
    elif bone.name=='head': bone.head.z-=.16; bone.tail.z-=.16
    elif bone.name.startswith(('thigh_','shin_')):
        bone.head.x*=1.1; bone.tail.x*=1.1
bpy.ops.object.mode_set(mode='OBJECT')
# Let the rounded paw greet with its wrist, rather than just raising the arm.
previous_action=arm.animation_data.action
arm.animation_data.action=bpy.data.actions['Wave_WIP']
paw=arm.pose.bones['paw_R']; paw.rotation_mode='QUATERNION'
basis=paw.bone.matrix_local.to_quaternion()
for frame,degrees in ((1,0),(9,-12),(13,22),(17,-18),(21,22),(25,-12),(33,0)):
    bpy.context.scene.frame_set(frame)
    paw.rotation_quaternion=basis.inverted()@Quaternion((0,1,0),math.radians(degrees))@basis
    paw.keyframe_insert(data_path='rotation_quaternion',frame=frame,group='paw_R')
arm.animation_data.action=previous_action
for action in bpy.data.actions: action.use_fake_user=True
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
bpy.context.scene['art_status']='UNAPPROVED compact proportion study; face rig and fur unfinished.'
bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.context.scene.objects:
    if ob.type in {'MESH','ARMATURE'} and not ob.hide_render and ob.name!='Milo / studio floor': ob.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(out/'milo-friendly-proportions-WIP.glb'),
    export_format='GLB',use_selection=True,export_animations=True,
    export_animation_mode='ACTIONS',export_yup=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'milo-friendly-proportions-WIP.blend'),check_existing=False)
