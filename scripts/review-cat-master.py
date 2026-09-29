"""Render the actual exported GLB, eight directions and seven clips in Blender.

This is visual QA tooling, not the web renderer. Keeps framing fixed between
actions and reports floor/bounds. Inspect the images; numeric checks alone are
not an art-quality or collision sign-off.
"""
import bpy, math, json, sys, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'artifacts/cat-master-review'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/cat-studio.glb'))
asset_hash=hashlib.sha256((ROOT/'public/models/cat-studio.glb').read_bytes()).hexdigest()
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=12
scene.cycles.use_denoising=True
scene.render.resolution_x=480; scene.render.resolution_y=560; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(.25,.28,.32)
scene.view_settings.view_transform='AgX'
def area(name,location,power,color,size):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.color=color; data.shape='DISK'; data.size=size
    ob=bpy.data.objects.new(name,data); scene.collection.objects.link(ob); ob.location=location
    ob.rotation_euler=(Vector((0,0,.70))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Key',(-2,-3,4),240,(1,.86,.72),4)
area('Fill',(3,-2,2),95,(.72,.82,1),4)
area('Rim',(1,2,3),200,(.88,.78,1),3)
data=bpy.data.meshes.new('QA floor'); data.from_pydata([(-10,-10,0),(10,-10,0),(10,10,0),(-10,10,0)],[],[(0,1,2,3)])
floor=bpy.data.objects.new('QA floor',data); scene.collection.objects.link(floor)
mat=bpy.data.materials.new('QA backdrop'); mat.diffuse_color=(.10,.20,.23,1); floor.data.materials.append(mat)
camdata=bpy.data.cameras.new('Fixed QA camera'); cam=bpy.data.objects.new('Fixed QA camera',camdata); scene.collection.objects.link(cam)
camdata.type='ORTHO'; camdata.ortho_scale=1.74; scene.camera=cam
tracks=list(rig.animation_data.nla_tracks)
print('Imported clips:',[(t.name,[s.action.name for s in t.strips]) for t in tracks],flush=True)
def action(name,phase=.25):
    rig.animation_data.action=None
    chosen=None
    for t in tracks:
        match=name in t.name.lower() or any(name in s.action.name.lower() for s in t.strips)
        t.mute=not match
        if match: chosen=t
    assert chosen,name
    strip=chosen.strips[0]
    scene.frame_set(round(strip.frame_start+(strip.frame_end-strip.frame_start)*phase))
def bounds():
    points=[]; deps=bpy.context.evaluated_depsgraph_get()
    for ob in scene.objects:
        if ob.type!='MESH' or not ob.name.startswith('CAT_'): continue
        ev=ob.evaluated_get(deps); mesh=ev.to_mesh()
        points.extend(ev.matrix_world@v.co for v in mesh.vertices); ev.to_mesh_clear()
    return {'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]}
results=[]
def render(name,angle,phase=.25):
    action(name,phase)
    a=math.radians(angle); cam.location=(3*math.sin(a),-3*math.cos(a),1.00)
    cam.rotation_euler=(Vector((0,0,.70))-cam.location).to_track_quat('-Z','Y').to_euler()
    path=OUT/f'{name}-{angle:03}-{phase:.2f}.png'; scene.render.filepath=str(path)
    result={'action':name,'degrees':angle,'phase':phase,'bounds':bounds(),'file':path.name}
    assert all(math.isfinite(v) for axis in result['bounds'].values() for v in axis)
    results.append(result); bpy.ops.render.render(write_still=True)
    print('REVIEW',path.name,flush=True)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if args and args[0]=='quick':
    render('idle',0); render('idle',90); render('wave',0); render('sleep',90)
else:
    for angle in range(0,360,45): render('idle',angle)
    for name in ['happy','wave','jump','run','sleep','roar']:
        for angle in [0,90]: render(name,angle)
    for phase in [.02,.5,.75]:
        for name in ['jump','run','sleep']: render(name,45,phase)
(OUT/'review.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
(OUT/'asset.json').write_text(json.dumps({'glbSha256':asset_hash,'renderer':'Blender Cycles','approval':'pending'},indent=2),encoding='utf-8')
