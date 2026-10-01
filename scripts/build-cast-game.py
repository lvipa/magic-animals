"""One Blender production pipeline for the seven Milo friends.

Requires the six user-supplied GLBs under .deployment/incoming-cast/.
Cozy Cub is visually verified as LION. BEAR is derived from the round PANDA
mesh, with a fur-only atlas repaint; eyes, clothing and UVs are preserved.
Run Blender --background --python scripts/build-cast-game.py -- [character].
"""
from pathlib import Path
import sys, json, math, hashlib, struct
import bpy, bmesh, numpy as np
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'scripts'))
from cast_face import build_face
from cast_animation import build_animations
from cast_fur import build_fur
PRIVATE=ROOT/'.deployment/incoming-cast'
SPECS={
 'foxy':dict(file='Meshy_AI_Hoodie_Fox_0930215011_texture.glb',head=.14,shoulder=.07,hip=-.51,paw_x=.49,paw_z=-.27,leg_x=.13,leg_center=.06,source_x_shift=.10,face_x=-.026,eye=(.14,.434,.080,.090),orbitals=[('L',.112,.419,.082,.091),('R',-.158,.445,.080,.089)],mouth=(.253,.077)),
 'dog':dict(file='Meshy_AI_Hoodie_Pup_0930214951_texture.glb',head=.26,shoulder=.08,hip=-.46,paw_x=.49,paw_z=-.27,leg_x=.18,eye=(.135,.548,.082,.095),mouth=(.342,.085)),
 'lion':dict(file='Meshy_AI_Cozy_Cub_0930215316_texture.glb',head=.10,shoulder=-.10,hip=-.54,paw_x=.43,paw_z=-.40,leg_x=.16,eye=(.145,.388,.086,.092),mouth=(.208,.081)),
 'bunny':dict(file='Meshy_AI_Bunny_in_a_Pink_Hoodi_0930215127_texture.glb',head=-.13,shoulder=-.24,hip=-.62,paw_x=.42,paw_z=-.50,leg_x=.15,eye=(.131,.145,.081,.085),mouth=(-.013,.065)),
 'panda':dict(file='Meshy_AI_Hoodie_Panda_0930215421_texture.glb',head=.24,shoulder=.08,hip=-.46,paw_x=.48,paw_z=-.28,leg_x=.19,eye=(.143,.515,.085,.097),mouth=(.347,.068)),
 'bear':dict(file='Meshy_AI_Hoodie_Panda_0930215421_texture.glb',head=.24,shoulder=.08,hip=-.46,paw_x=.48,paw_z=-.28,leg_x=.19,eye=(.143,.515,.085,.097),mouth=(.347,.068)),
 'elephant':dict(file='Meshy_AI_Blue_Hoodie_Elephant_0930215525_texture.glb',head=.27,shoulder=.12,hip=-.49,paw_x=.52,paw_z=-.25,leg_x=.20,eye=(.159,.537,.069,.085)),
}

def paint_bear(body, spec):
    """Rasterize only fur UV triangles; retain the original fabric and eyes."""
    mat=body.data.materials[0];shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    image=shader.inputs['Base Color'].links[0].from_node.image
    image.scale(1024,1024);w,h=image.size
    pixels=np.array(image.pixels[:],dtype=np.float32).reshape(h,w,4)
    painted=np.zeros((h,w),dtype=bool);protected=np.zeros((h,w),dtype=bool)
    uv=body.data.uv_layers.active.data
    for poly in body.data.polygons:
        x,y,z=poly.center;cx,cz,rx,rz=spec['eye']
        eye=y<-.17 and any(((x-sign*cx)/(rx*1.15))**2+((z-cz)/(rz*1.1))**2<1 for sign in [-1,1])
        nose=y<-.25 and abs(x)<.043 and .385<z<.445
        mouth=y<-.25 and abs(x)<.09 and .34<z<.38
        fur=z>.25 or z<-.51 or abs(x)>.33
        tri=np.array([uv[i].uv[:] for i in poly.loop_indices])*[w-1,h-1]
        lo=np.maximum(0,np.floor(tri.min(axis=0)).astype(int));hi=np.minimum([w-1,h-1],np.ceil(tri.max(axis=0)).astype(int))
        if any(hi<lo):continue
        xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1))
        a,b,c=tri;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<.001:continue
        u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
        v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
        mask=(u>=-.08)&(v>=-.08)&(u+v<=1.08)
        if not fur or eye or nose or mouth:
            protected[lo[1]:hi[1]+1,lo[0]:hi[0]+1] |= mask
            continue
        region=pixels[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
        tint=np.array([.70,.46,.29]) if not (abs(x)<.17 and .30<z<.44 and y<-.23) else np.array([.84,.67,.46])
        # Same tone on former black and white patches; small original strokes
        # remain as surface detail without retaining panda face markings.
        detail=region[:,:,:3].mean(axis=2);detail=1+(detail-detail.mean())*.12
        region[:,:,:3][mask]=(tint[None,None,:]*detail[:,:,None])[mask]
        painted[lo[1]:hi[1]+1,lo[0]:hi[0]+1] |= mask
    # UV padding is essential: mipmaps otherwise reveal the former white/black
    # atlas gutters as scars across the brown face. Protect occupied clothing
    # and eye texels while extending the nearest painted color into gutters.
    for iteration in range(10):
        for axis,shift in [(0,1),(0,-1),(1,1),(1,-1)]:
            neighbor=np.roll(painted,shift,axis=axis)
            if axis==0:neighbor[0 if shift>0 else -1,:]=False
            else:neighbor[:,0 if shift>0 else -1]=False
            fill=neighbor & ~painted & ~protected
            pixels[fill]=np.roll(pixels,shift,axis=axis)[fill]
            painted |= fill
    image.pixels.foreach_set(pixels.ravel());image.update()
    image.filepath_raw=str(PRIVATE/'bear-fur-atlas.png');image.file_format='PNG';image.save();image.pack()
    # The imported atlas retains its original packed JPEG bytes. Use a fresh
    # image datablock so both Blender and GLB export read the painted PNG.
    replacement=bpy.data.images.load(str(PRIVATE/'bear-fur-atlas.png'),check_existing=False)
    replacement.name='Maple / warm bear atlas';replacement.pack()
    shader.inputs['Base Color'].links[0].from_node.image=replacement

def build(id):
    spec=SPECS[id];source=PRIVATE/spec['file']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    body.name=id+' / source surface';bpy.context.view_layer.objects.active=body;body.select_set(True)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    for vertex in body.data.vertices:vertex.co.x+=spec.get('source_x_shift',0)
    bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000002)
    bm.to_mesh(body.data);bm.free();body.data.update()
    # Dense lion mane shares the same silhouette; collapse redundant tiny
    # triangles before binding, keeping its atlas UVs and smooth normals.
    if len(body.data.polygons)>140000:
        mod=body.modifiers.new('Mobile surface budget','DECIMATE');mod.ratio=130000/len(body.data.polygons)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for image in bpy.data.images:
        if image.source=='FILE':tuple(image.pixels[:4])
    if id=='bear':paint_bear(body,spec)
    arm=bpy.data.armatures.new('Milo family shared skeleton')
    rig=bpy.data.objects.new(id+' / shared rig',arm);bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);body.select_set(False)
    bpy.ops.object.mode_set(mode='EDIT')
    hip=spec['hip'];shoulder=spec['shoulder'];neck=spec['head'];px=spec['paw_x'];pz=spec['paw_z'];lx=spec['leg_x']
    bones=[('root',(0,0,hip),(0,0,hip+.12),None),('spine',(0,0,hip),(0,0,shoulder-.14),'root'),('chest',(0,0,shoulder-.14),(0,0,shoulder+.06),'spine'),('neck',(0,0,shoulder+.06),(0,0,neck+.08),'chest'),('head',(0,0,neck+.08),(0,0,spec['eye'][1]+.15),'neck')]
    for side,sign in [('L',1),('R',-1)]:
        elbow_x=(.22+px)/2;elbow_z=(shoulder+pz)/2
        leg=sign*lx+spec.get('leg_center',0)
        bones.extend([(f'upper_arm_{side}',(sign*.22,0,shoulder),(sign*elbow_x,0,elbow_z),'chest'),(f'forearm_{side}',(sign*elbow_x,0,elbow_z),(sign*px,-.02,pz),f'upper_arm_{side}'),(f'paw_{side}',(sign*px,-.02,pz),(sign*(px+.055),-.035,pz-.05),f'forearm_{side}'),(f'thigh_{side}',(leg,0,hip),(leg,0,(hip-.84)/2),'root'),(f'shin_{side}',(leg,0,(hip-.84)/2),(leg,-.01,-.84),f'thigh_{side}'),(f'foot_{side}',(leg,-.01,-.84),(leg,-.17,-.92),f'shin_{side}')])
    bones.extend([('tail_base',(.06,.13,hip),(.22,.28,hip-.07),'root'),('tail_tip',(.22,.28,hip-.07),(.34,.40,hip+.02),'tail_base')])
    for name,start,end,parent in bones:
        bone=arm.edit_bones.new(name);bone.head=start;bone.tail=end
        if parent:bone.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    assert body.vertex_groups, 'Automatic skin binding failed'
    for v in body.data.vertices:
        x,y,z=v.co
        wrist_start=px-(.075 if id=='foxy' else .13)
        arm_weight=max(0,min(1,(abs(x)-wrist_start)/.07))*max(0,min(1,(pz+.11-z)/.075))
        arm_weight*=max(0,min(1,(z-(pz-.16))/.05))
        if id=='foxy' and y>-.12:arm_weight=0
        if arm_weight>0:
            # The generated hands can be offset in depth from a conventional
            # A-pose. Heat weights may omit the wrist bone entirely. Transfer
            # an explicit smooth wrist influence to the actual paw surface.
            side='L' if x>0 else 'R'
            weights={g.group:g.weight*(1-arm_weight) for g in v.groups}
            index=body.vertex_groups['paw_'+side].index;weights[index]=weights.get(index,0)+arm_weight
            for group in list(v.groups):body.vertex_groups[group.group].remove([v.index])
            for index,weight in weights.items():
                if weight>.00001:body.vertex_groups[index].add([v.index],weight,'REPLACE')
        elif z<hip and abs(x-spec.get('leg_center',0))<.33 and y<.22:
            side='L' if x>spec.get('leg_center',0) else 'R'
            knee=(hip-.84)/2
            shin=max(0,min(1,(knee+.045-z)/.09));shin=shin*shin*(3-2*shin)
            foot=max(0,min(1,(-.78-z)/.09));foot=foot*foot*(3-2*foot)
            for group in list(v.groups):body.vertex_groups[group.group].remove([v.index])
            for name,weight in [(f'thigh_{side}',(1-shin)*(1-foot)),(f'shin_{side}',shin*(1-foot)),(f'foot_{side}',foot)]:
                if weight>.00001:body.vertex_groups[name].add([v.index],weight,'REPLACE')
        elif z>neck+.085:
            for group in list(v.groups):body.vertex_groups[group.group].remove([v.index])
            body.vertex_groups['head'].add([v.index],1,'REPLACE')
        elif hip-.04<z<shoulder+.06 and (abs(x)<(.39 if id=='foxy' and z<shoulder-.12 else .29) or z<hip+.14 or id=='foxy' and y>-.12 and abs(x)<.52):
            # Heat binding sometimes assigns the hem and pocket to a nearby
            # forearm. Explicit torso blending keeps fabric connected while
            # allowing sleeves outside the torso envelope to lift freely.
            torso_width=.39 if id=='foxy' and z<shoulder-.12 else .29
            blend=1 if z<hip+.14 or id=='foxy' and y>-.12 else max(0,min(1,(torso_width-abs(x))/.08))
            blend=blend*blend*(3-2*blend)
            weights={g.group:g.weight*(1-blend) for g in v.groups}
            chest=max(0,min(1,(z-(shoulder-.20))/.20))
            for name,part in [('spine',1-chest),('chest',chest)]:
                index=body.vertex_groups[name].index;weights[index]=weights.get(index,0)+blend*part
            for group in list(v.groups):body.vertex_groups[group.group].remove([v.index])
            for index,weight in weights.items():
                if weight>.00001:body.vertex_groups[index].add([v.index],weight,'REPLACE')
        weights=sorted([(g.group,g.weight) for g in v.groups],key=lambda pair:pair[1],reverse=True)[:4]
        total=sum(weight for _,weight in weights)
        assert total>0,f'Unweighted vertex {v.index}'
        for group in list(v.groups):body.vertex_groups[group.group].remove([v.index])
        for index,weight in weights:body.vertex_groups[index].add([v.index],weight/total,'REPLACE')
    print('CAST_STAGE',id,'skin bound',flush=True)
    face=build_face(body,rig,spec)
    print('CAST_STAGE',id,'face built',flush=True)
    build_fur(body,rig,spec)
    for ob in bpy.context.scene.objects:
        if ob.type=='MESH' and not ob.get('part'):ob['part']='body' if ob==body else 'head'
    mat=body.data.materials[0];shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    for name,value in [('Roughness',.86),('Metallic',0)]:
        for link in list(shader.inputs[name].links):mat.node_tree.links.remove(link)
        shader.inputs[name].default_value=value
    shader.inputs['Sheen Weight'].default_value=.45;shader.inputs['Sheen Roughness'].default_value=.9
    faces=[o.data.shape_keys for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys]
    build_animations(rig,faces)
    scene=bpy.context.scene;scene.render.fps=30;scene.frame_set(1)
    for pb in rig.pose.bones:pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0)
    for keys in faces:
        for key in keys.key_blocks:key.value=0
    minimum=min(v.co.z for v in body.data.vertices);maximum=max(v.co.z for v in body.data.vertices)
    scale=1.15/(maximum-minimum)
    origin=bpy.data.objects.new(id+' / game origin',None);bpy.context.collection.objects.link(origin)
    origin.scale=(scale,)*3;origin.location=(0,0,-minimum*scale);rig.parent=origin
    # Species-specific reveal landmarks are read from the asset by the common
    # runtime. Blender Z is glTF Y; thresholds stay in the source rest pose.
    origin['reveal_head']=neck+.07;origin['reveal_foot']=-.80;origin['reveal_paw_x']=px-.025;origin['reveal_paw_y']=pz+.07
    for index,image in enumerate(bpy.data.images):
        if image.source=='FILE':tuple(image.pixels[:4])
        if image.has_data and max(image.size)>1024:
            image.scale(1024,1024);image.filepath_raw=str(PRIVATE/f'{id}-texture-{index}.png');image.file_format='PNG';image.save();image.pack()
        elif image.has_data:image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(PRIVATE/(id+'-game.blend')))
    temporary=PRIVATE/(id+'-game.glb')
    bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_yup=True,export_morph=True,export_morph_animation=True,export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=16,export_draco_normal_quantization=12,export_draco_texcoord_quantization=14)
    data=temporary.read_bytes();n=struct.unpack_from('<I',data,12)[0];document=json.loads(data[20:20+n])
    assert sorted(c['name'] for c in document['animations'])==sorted(['idle','happy','wave','jump','run','sleep','roar'])
    assert len(data)<8_000_000, 'Mobile download budget exceeded'
    sha=hashlib.sha256(data).hexdigest();asset=id+'-milo-family-'+sha[:12]+'.glb'
    (ROOT/'public/models'/asset).write_bytes(data)
    report={'id':id,'asset':asset,'sha256':sha,'bytes':len(data),'height':1.15,'bones':len(arm.bones),'source_file':source.name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'derived_from':'panda' if id=='bear' else None,'pipeline':'Milo family: Blender skin, original PBR atlas, separate eyes, conforming eyelids, masked skinned short fur, seven NLA clips','facial':face,'clips':[c['name'] for c in document['animations']],'triangles':sum(document['accessors'][p['indices']]['count']//3 for m in document['meshes'] for p in m['primitives']),'limitations':['Automatic cloth weights require further pose polish','Physical mobile GPU and camera testing pending']}
    (ROOT/'public/models'/(id+'-master-info.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('CAST_COMPLETE',json.dumps(report),flush=True)

ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(SPECS)
for id in ids:build(id)
