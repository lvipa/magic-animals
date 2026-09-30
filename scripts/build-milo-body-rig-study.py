"""Non-destructive movement study, not the final game asset."""
from pathlib import Path
import bpy,bmesh,math,json
import argparse,sys,hashlib
from mathutils import Vector,Quaternion
root=Path(__file__).resolve().parent.parent/'.deployment/incoming-milo'
parser=argparse.ArgumentParser();parser.add_argument('--source',default='milo-incoming-source.blend');parser.add_argument('--prefix',default='milo-body-rig-WIP');parser.add_argument('--weights')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.open_mainfile(filepath=str(root/args.source))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
body.name='Milo / Meshy source movement study'
# Merge glTF UV-boundary duplicates; loop UVs are retained by BMesh.
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000002)
bm.to_mesh(body.data);bm.free();body.data.update()
# Keep the original high-resolution surface for this first deformation check.
arm=bpy.data.armatures.new('Milo / shared body rig');rig=bpy.data.objects.new('Milo / body rig WIP',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);body.select_set(False);bpy.ops.object.mode_set(mode='EDIT')
spec=[('root',(0,0,-.42),(0,0,-.25),None),('spine',(0,0,-.4),(0,0,-.03),'root'),('chest',(0,0,-.03),(0,0,.23),'spine'),('neck',(0,0,.23),(0,0,.33),'chest'),('head',(0,0,.33),(0,0,.78),'neck')]
for side,sign in [('L',1),('R',-1)]:
 spec.extend([(f'upper_arm_{side}',(sign*.19,0,.20),(sign*.38,0,.005),'chest'),(f'forearm_{side}',(sign*.38,0,.005),(sign*.51,-.015,-.155),f'upper_arm_{side}'),(f'paw_{side}',(sign*.51,-.015,-.155),(sign*.58,-.03,-.23),f'forearm_{side}'),(f'thigh_{side}',(sign*.16,0,-.39),(sign*.19,0,-.66),'root'),(f'shin_{side}',(sign*.19,0,-.66),(sign*.19,-.015,-.84),f'thigh_{side}'),(f'foot_{side}',(sign*.19,-.015,-.84),(sign*.19,-.17,-.90),f'shin_{side}')])
spec.extend([('tail_base',(.08,.15,-.41),(.25,.31,-.59),'root'),('tail_tip',(.25,.31,-.59),(.42,.34,-.47),'tail_base')])
for name,start,end,parent in spec:
 b=arm.edit_bones.new(name);b.head=start;b.tail=end
 if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
if args.weights:
 saved=json.loads((root/args.weights).read_text(encoding='utf-8'))
 topology=hashlib.sha256(repr([list(p.vertices) for p in body.data.polygons]).encode()).hexdigest()
 assert topology==saved['topology_sha256'] and len(saved['weights'])==len(body.data.vertices), 'Weight transfer topology mismatch'
 body.parent=rig;mod=body.modifiers.new('Milo body deformation','ARMATURE');mod.object=rig
 for name in arm.bones.keys():body.vertex_groups.new(name=name)
 for i,weights in enumerate(saved['weights']):
  for name,value in weights.items():body.vertex_groups[name].add([i],value,'REPLACE')
else:bpy.ops.object.parent_set(type='ARMATURE_AUTO')
if not body.vertex_groups:raise RuntimeError('No automatic weights generated')
bone_ids={body.vertex_groups[n].index:n for n in arm.bones.keys() if n in body.vertex_groups}
unweighted=[v.index for v in body.data.vertices if sum(g.weight for g in v.groups if g.group in bone_ids)<.00001]
if unweighted:raise RuntimeError(f'Automatic weights failed: {len(unweighted)} unweighted vertices')
# A rigid head is suitable for this body motion test. Facial rig is still absent.
head=body.vertex_groups.get('head');neck=body.vertex_groups.get('neck')
for v in body.data.vertices:
 if v.co.z>.34:
  for g in list(v.groups):body.vertex_groups[g.group].remove([v.index])
  head.add([v.index],1,'REPLACE')
# Keep the zipper and central fabric on the torso. Heat weights otherwise pull
# the central chest toward the raised upper arm and stretch the zipper sideways.
for v in body.data.vertices:
 x,y,z=v.co
 if -.40<z<.23 and abs(x)<.25:
  blend=max(0,min(1,(.25-abs(x))/.10));blend=blend*blend*(3-2*blend)
  weights={g.group:g.weight*(1-blend) for g in v.groups}
  chest_mix=max(0,min(1,(z+.20)/.24))
  for name,part in [('spine',1-chest_mix),('chest',chest_mix)]:
   idx=body.vertex_groups[name].index;weights[idx]=weights.get(idx,0)+blend*part
  for g in list(v.groups):body.vertex_groups[g.group].remove([v.index])
  for idx,weight in weights.items():
   if weight>.00001:body.vertex_groups[idx].add([v.index],weight,'REPLACE')
# Export precisely the same normalized, four-influence weights seen in Blender.
for v in body.data.vertices:
 weights=sorted([(g.group,g.weight) for g in v.groups],key=lambda p:p[1],reverse=True)[:4]
 total=sum(w for _,w in weights)
 for g in list(v.groups):body.vertex_groups[g.group].remove([v.index])
 for idx,w in weights:body.vertex_groups[idx].add([v.index],w/total,'REPLACE')
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
def pose(frame,rotations,root_z=0):
 bpy.context.scene.frame_set(frame)
 for pb in rig.pose.bones:
  pb.rotation_quaternion=Quaternion();pb.location=(0,0,0)
 for name,axis,deg in rotations:
  pb=rig.pose.bones[name];local_axis=pb.bone.matrix_local.to_quaternion().inverted()@Vector(axis)
  pb.rotation_quaternion=Quaternion(local_axis,math.radians(deg))
 rig.pose.bones['root'].location.z=root_z
 for pb in rig.pose.bones:
  pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=pb.name)
  pb.keyframe_insert(data_path='location',frame=frame,group=pb.name)
rig.animation_data_create()
wave=bpy.data.actions.new('Wave_WIP');wave.use_fake_user=True;rig.animation_data.action=wave
for f,up,fore,wrist in [(1,0,0,0),(10,65,35,0),(16,65,35,-20),(22,65,35,20),(28,65,35,-20),(34,65,35,20),(42,65,35,0),(49,0,0,0)]:
 pose(f,[('upper_arm_R',(0,1,0),up),('forearm_R',(0,1,0),fore),('paw_R',(0,1,0),wrist),('head',(0,1,0),-4 if up else 0)])
run=bpy.data.actions.new('Run_WIP');run.use_fake_user=True;rig.animation_data.action=run
for f in [1,7,13,19,25]:
 phase=(f-1)/24*math.tau;s=math.sin(phase);rot=[]
 for side,sign in [('L',1),('R',-1)]:
  rot.extend([(f'thigh_{side}',(1,0,0),sign*s*22),(f'shin_{side}',(1,0,0),-max(0,-sign*s)*25),(f'upper_arm_{side}',(1,0,0),-sign*s*23),(f'forearm_{side}',(1,0,0),-15),(f'foot_{side}',(1,0,0),-sign*s*8)])
 rot.extend([('chest',(0,0,1),s*3),('tail_base',(0,0,1),s*9)])
 pose(f,rot,.018*(1-math.cos(phase*2)))
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=49
rig.animation_data.action=wave;scene.frame_set(1)
rig['study_status']='Unapproved source; body deformation study only, no facial rig or final mobile optimization'
bpy.ops.wm.save_as_mainfile(filepath=str(root/(args.prefix+'.blend')))
bpy.ops.export_scene.gltf(filepath=str(root/(args.prefix+'.glb')),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_yup=True,export_current_frame=False,export_extras=True)
print(json.dumps({'bones':len(arm.bones),'unweighted':len(unweighted),'clips':[wave.name,run.name],'vertices':len(body.data.vertices)}))
