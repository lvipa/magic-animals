"""Non-destructive shared polish of the eight existing authored Blender scenes."""
from pathlib import Path
import bpy,sys,json,hashlib,struct,importlib.util,math
ROOT=Path(__file__).resolve().parent.parent;sys.path.insert(0,str(ROOT/'scripts'))
from cast_fur import build_fur
module=importlib.util.spec_from_file_location('normal_compactor',ROOT/'scripts/compact-morph-normals.py');normal_compactor=importlib.util.module_from_spec(module);module.loader.exec_module(normal_compactor)
PRIVATE=ROOT/'.deployment/cast-polish';PRIVATE.mkdir(exist_ok=True)
SPECS={
 'cat':dict(head=.27,hip=-.51,paw_x=.52,paw_z=-.27,eye=(.15,.55,.08,.09),ear=(.22,.76,.90)),
 'foxy':dict(head=.14,hip=-.51,paw_x=.49,paw_z=-.27,eye=(.14,.434,.08,.09),ear=(.24,.63,.92)),
 'dog':dict(head=.26,hip=-.46,paw_x=.49,paw_z=-.27,eye=(.135,.548,.08,.09),ear=(.34,.71,.43)),
 'lion':dict(head=.10,hip=-.54,paw_x=.43,paw_z=-.40,eye=(.145,.388,.08,.09),ear=(.29,.60,.75)),
 'bunny':dict(head=-.13,hip=-.62,paw_x=.42,paw_z=-.50,eye=(.131,.145,.08,.09),ear=(.15,.33,.85)),
 'bear':dict(head=.24,hip=-.46,paw_x=.48,paw_z=-.28,eye=(.143,.515,.08,.09),ear=(.25,.74,.89)),
 'panda':dict(head=.24,hip=-.46,paw_x=.48,paw_z=-.28,eye=(.143,.515,.08,.09),ear=(.25,.74,.89)),
 'elephant':dict(head=.27,hip=-.49,paw_x=.52,paw_z=-.25,eye=(.159,.537,.07,.08),ear=(.34,.61,.46)),
}
def smooth(value):
    value=max(0,min(1,value));return value*value*(3-2*value)
def polish(id):
    info=json.loads((ROOT/'public/models'/f'{id}-master-info.json').read_text(encoding='utf-8'))
    base_asset=info.get('previous_asset',info['asset']) if info.get('version')==9 else info['asset']
    approved=(ROOT/'public/models'/base_asset).read_bytes();chunk=struct.unpack_from('<I',approved,12)[0];approved_doc=json.loads(approved[20:20+chunk]);approved_binary=approved[28+chunk:]
    source=ROOT/'.deployment'/('incoming-milo/milo-game-short-fur.blend' if id=='cat' else f'incoming-cast/{id}-game.blend')
    bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;scene.frame_set(1)
    # Saved source scenes can retain packed 2K bytes despite a 1K image size.
    # Reuse the exact approved embedded maps, rather than silently upscaling.
    textures={}
    for index,image in enumerate(approved_doc['images']):
        view=approved_doc['bufferViews'][image['bufferView']];offset=view.get('byteOffset',0)
        path=PRIVATE/f'{id}-approved-{index}.png';path.write_bytes(approved_binary[offset:offset+view['byteLength']])
        textures[image.get('name','')]=path
    replacements={}
    for mat in bpy.data.materials:
        if not mat.use_nodes:continue
        for node in mat.node_tree.nodes:
            if node.type!='TEX_IMAGE' or not node.image:continue
            image=node.image;name=image.name if image.name in textures else Path(image.filepath).stem
            if name in textures:
                if name not in replacements:
                    replacements[name]=bpy.data.images.load(str(textures[name]),check_existing=False);replacements[name].pack()
                    replacements[name].colorspace_settings.name=image.colorspace_settings.name
                node.image=replacements[name]
    rig=next(o for o in scene.objects if o.type=='ARMATURE')
    body=max((o for o in scene.objects if o.type=='MESH' and 'Groom' not in o.name),key=lambda o:len(o.data.vertices))
    for pb in rig.pose.bones:pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0)
    for ob in scene.objects:
        if ob.type=='MESH' and ob.data.shape_keys:
            for key in ob.data.shape_keys.key_blocks:key.value=0
    spec=SPECS[id];spec['species']=id
    for ob in list(scene.objects):
        if 'Groom' in ob.name:bpy.data.objects.remove(ob,do_unlink=True)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    ex,ez,tip=spec['ear']
    for side,sign in [('L',1),('R',-1)]:
        bone=rig.data.edit_bones.new('ear_'+side);bone.head=(sign*ex,0,ez);bone.tail=(sign*(ex+.035),0,tip);bone.parent=rig.data.edit_bones['head']
    if id=='elephant':
        for name,start,end,parent in [('trunk_base',(0,-.32,.48),(0,-.45,.30),'head'),('trunk_tip',(0,-.45,.30),(.025,-.48,.17),'trunk_base')]:
            bone=rig.data.edit_bones.new(name);bone.head=start;bone.tail=end;bone.parent=rig.data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for name in ['ear_L','ear_R']+(['trunk_base','trunk_tip'] if id=='elephant' else []):body.vertex_groups.new(name=name)
    counts={name:0 for name in ['ear_L','ear_R']+(['trunk_base','trunk_tip'] if id=='elephant' else [])}
    for vertex in body.data.vertices:
        x,y,z=vertex.co;assign=[]
        if tip>ez:
            influence=smooth((z-ez+.04)/.12)*smooth((abs(x)-ex+.075)/.09)
        else:
            influence=smooth((abs(x)-ex+.06)/.09)*smooth((z-(.34 if id=='elephant' else .36))/.10)
        influence*=smooth((.21-y)/.10)
        if influence>.001:assign=[('ear_L' if x>0 else 'ear_R',influence*.85)]
        if id=='elephant' and abs(x)<.085 and y<-.31 and .12<z<.48:
            influence=smooth((.48-z)/.085)*smooth((-.31-y)/.075)*smooth((.085-abs(x))/.035)
            lower=smooth((.32-z)/.13)
            if influence>.001:assign=[('trunk_base',influence*(1-lower)),('trunk_tip',influence*lower)]
        if not assign:continue
        amount=sum(w for _,w in assign);weights={g.group:g.weight*(1-amount) for g in vertex.groups}
        for name,weight in assign:
            group=body.vertex_groups[name];weights[group.index]=weights.get(group.index,0)+weight
            if weight>.15:counts[name]+=1
        weights=sorted(weights.items(),key=lambda pair:pair[1],reverse=True)[:4];total=sum(w for _,w in weights)
        for group in list(vertex.groups):body.vertex_groups[group.group].remove([vertex.index])
        for index,weight in weights:
            if weight>1e-7:body.vertex_groups[index].add([vertex.index],weight/total,'REPLACE')
    assert all(count>20 for count in counts.values()),counts
    build_fur(body,rig,spec)
    bpy.ops.wm.save_as_mainfile(filepath=str(PRIVATE/f'{id}-polished.blend'))
    temporary=PRIVATE/f'{id}-polished.glb'
    bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_yup=True,export_morph=True,export_morph_animation=True,export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=16,export_draco_normal_quantization=12,export_draco_texcoord_quantization=14)
    original=temporary.read_bytes();data,optimization=normal_compactor.compact(original)
    assert len(data)<8_000_000, 'Approved texture size must be preserved'
    document=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
    sha=hashlib.sha256(data).hexdigest();asset=f'{id}-milo-polished-{sha[:12]}.glb'
    (ROOT/'public/models'/asset).write_bytes(data)
    info.update(version=9,asset=asset,sha256=sha,bytes=len(data),bones=len(rig.data.bones),secondary_controls=counts,optimization=optimization,previous_asset=base_asset,triangles=sum(document['accessors'][p['indices']]['count']//3 for m in document['meshes'] for p in m['primitives']))
    info['pipeline']='Milo shared PBR/rig, original body and facial shapes, clean short fur, soft ear/trunk controls, compact morph normals'
    (ROOT/'public/models'/f'{id}-master-info.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
    if id=='cat':(ROOT/'src/characters/catAsset.ts').write_text(f"// Generated by scripts/polish-cast.py.\nexport const CAT_MODEL_URL = '/models/{asset}';\n",encoding='utf-8')
    print('POLISH_COMPLETE',id,info['bytes'],counts,optimization,flush=True)
ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(SPECS)
for id in ids:polish(id)
