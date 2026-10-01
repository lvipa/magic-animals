"""Repair tail binding and smooth jaw deformations in approved editable assets.

Body topology, original PBR atlases, eyes, clips and joint counts stay intact.
Output has a new immutable URL; old versions remain available for rollback.
"""
from pathlib import Path
import bpy, sys, json, struct, hashlib, importlib.util
import numpy as np
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'scripts'))
from cast_fur import build_fur
PRIVATE=ROOT/'.deployment/cast-polish'
loader=importlib.util.spec_from_file_location('compactor',ROOT/'scripts/compact-morph-normals.py')
compactor=importlib.util.module_from_spec(loader);loader.loader.exec_module(compactor)
SPECS={
 'foxy':dict(head=.14,hip=-.51,paw_x=.49,paw_z=-.27,eye=(.14,.434,.08,.09),species='foxy'),
 'dog':dict(head=.26,hip=-.46,paw_x=.49,paw_z=-.27,eye=(.135,.548,.08,.09),species='dog'),
}
def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def repair(id):
    info_path=ROOT/'public/models'/f'{id}-master-info.json'
    info=json.loads(info_path.read_text(encoding='utf-8'))
    bpy.ops.wm.open_mainfile(filepath=str(PRIVATE/f'{id}-polished.blend'))
    scene=bpy.context.scene;scene.frame_set(1)
    rig=next(o for o in scene.objects if o.type=='ARMATURE')
    body=max((o for o in scene.objects if o.type=='MESH' and 'Groom' not in o.name),key=lambda o:len(o.data.vertices))
    # Reuse embedded approved 1K maps. Packed source images can retain 2K bytes.
    asset=(ROOT/'public/models'/info['asset']).read_bytes();length=struct.unpack_from('<I',asset,12)[0]
    doc=json.loads(asset[20:20+length]);binary=asset[28+length:];textures={};replacements={}
    for i,image in enumerate(doc['images']):
        view=doc['bufferViews'][image['bufferView']];offset=view.get('byteOffset',0)
        path=PRIVATE/f'{id}-repair-map-{i}.png';path.write_bytes(binary[offset:offset+view['byteLength']]);textures[image.get('name','')]=path
    for mat in bpy.data.materials:
        if not mat.use_nodes:continue
        for node in mat.node_tree.nodes:
            if node.type!='TEX_IMAGE' or not node.image:continue
            old=node.image;name=old.name if old.name in textures else Path(old.filepath).stem
            if name in textures:
                if name not in replacements:
                    new=bpy.data.images.load(str(textures[name]),check_existing=False);new.pack();new.colorspace_settings.name=old.colorspace_settings.name;replacements[name]=new
                node.image=replacements[name]
    keys=body.data.shape_keys.key_blocks
    for key in keys:key.value=0
    for pb in rig.pose.bones:pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0)
    shader=next(n for n in body.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    atlas=shader.inputs['Base Color'].links[0].from_node.image
    w,h=atlas.size;pixels=np.array(atlas.pixels[:]).reshape(h,w,4)
    colors=np.zeros((len(body.data.vertices),3));counts=np.zeros(len(colors));uv=body.data.uv_layers.active.data
    for loop in body.data.loops:
        u,v=uv[loop.index].uv;colors[loop.vertex_index]+=pixels[min(h-1,max(0,int(v*h))),min(w-1,max(0,int(u*w))),:3];counts[loop.vertex_index]+=1
    colors/=np.maximum(counts[:,None],1)
    tail=[]
    for vertex,color in zip(body.data.vertices,colors):
        x,y,z=vertex.co;r,g,b=color
        fur=(r>g*1.09 and r>b*1.09) or min(r,g,b)>.67
        if y>.17 and z<-.12 and (z<SPECS[id]['hip']-.035 or (fur and abs(x)>.15)):
            tail.append(vertex.index)
    assert len(tail)>200,(id,'No tail surface',len(tail))
    # Tail cannot follow a sleeve or leg during jumping. Bind its continuous
    # fur surface to the two tail joints with a smooth transition at the root.
    for i in tail:
        v=body.data.vertices[i];x,y,z=v.co
        influence=smooth((y-.17)/.11);tip=smooth((y-.29)/.26)
        old={g.group:g.weight*(1-influence) for g in v.groups}
        for name,weight in [('tail_base',influence*(1-tip)),('tail_tip',influence*tip)]:
            index=body.vertex_groups[name].index;old[index]=old.get(index,0)+weight
        weights=sorted(old.items(),key=lambda t:t[1],reverse=True)[:4];total=sum(weight for _,weight in weights)
        for group in list(v.groups):body.vertex_groups[group.group].remove([i])
        for index,weight in weights:
            if weight>1e-7:body.vertex_groups[index].add([i],weight/total,'REPLACE')
    # Smooth only the jaw's displacement field. Preserve the closed face and
    # the lip/cavity boundary, avoiding the pointed chin when the jaw opens.
    basis=keys['Basis'];opened=keys['mouthOpen'];delta=[v.co-base.co for v,base in zip(opened.data,basis.data)]
    neighbours=[set() for _ in delta]
    for edge in body.data.edges:
        a,b=edge.vertices;neighbours[a].add(b);neighbours[b].add(a)
    mouth_indices=set()
    for polygon in body.data.polygons:
        if polygon.material_index>0:mouth_indices.update(polygon.vertices)
    fixed=set(mouth_indices)
    for i in mouth_indices:fixed.update(neighbours[i])
    active=[i for i,d in enumerate(delta) if d.length>1e-7 and i not in fixed]
    for _ in range(10):
        next_delta=list(delta)
        for i in active:
            near=neighbours[i]
            if near:next_delta[i]=delta[i]*.4+sum((delta[j] for j in near),delta[i]*0)/len(near)*.6
        delta=next_delta
    for i,(v,base) in enumerate(zip(opened.data,basis.data)):v.co=base.co+delta[i]*.70
    for ob in list(scene.objects):
        if 'Groom' in ob.name:bpy.data.objects.remove(ob,do_unlink=True)
    build_fur(body,rig,SPECS[id])
    path=PRIVATE/f'{id}-repaired.blend';bpy.ops.wm.save_as_mainfile(filepath=str(path))
    glb=PRIVATE/f'{id}-repaired.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_yup=True,export_morph=True,export_morph_animation=True,export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=16,export_draco_normal_quantization=12,export_draco_texcoord_quantization=14)
    data,optimization=compactor.compact(glb.read_bytes());sha=hashlib.sha256(data).hexdigest();name=f'{id}-milo-polished-{sha[:12]}.glb'
    assert len(data)<8_000_000
    (ROOT/'public/models'/name).write_bytes(data)
    info.update(version=10,previous_asset=info['asset'],asset=name,sha256=sha,bytes=len(data),deformation_repair={'tail_vertices':len(tail),'jaw_smoothed_vertices':len(active),'jaw_scale':.70},optimization=optimization)
    info_path.write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
    print('REPAIR_COMPLETE',id,name,info['deformation_repair'],flush=True)
for id in sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else SPECS:repair(id)
