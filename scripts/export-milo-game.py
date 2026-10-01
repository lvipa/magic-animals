"""Deliver the user's Milo rig to the game, with bounded mobile short fur.

Requires .deployment/incoming-milo/milo-animation-study-WIP.blend.
The editable high-resolution input is never overwritten.
"""
import bpy, math, random, json, hashlib, struct
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
PRIVATE=ROOT/'.deployment/incoming-milo'
bpy.ops.wm.open_mainfile(filepath=str(PRIVATE/'milo-animation-study-WIP.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
body=next(o for o in bpy.context.scene.objects if o.type=='MESH' and 'mouthOpen' in o.data.shape_keys.key_blocks)
bpy.context.scene.frame_set(1)
for pb in rig.pose.bones:
 pb.rotation_mode='QUATERNION';pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0)
for o in bpy.context.scene.objects:
 if o.type=='MESH' and o.data.shape_keys:
  for key in o.data.shape_keys.key_blocks:key.value=0
 for track in o.animation_data.nla_tracks if o.animation_data else []:
  track.name=track.name.replace('_WIP','').lower()
for data in [rig,*[o.data.shape_keys for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys]]:
 if data.animation_data:
  for track in data.animation_data.nla_tracks:track.name=track.name.replace('_WIP','').lower()

# Use the supplied atlas to place fur only on warm animal surfaces.
shader=next(n for n in body.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
source=shader.inputs['Base Color'].links[0].from_node.image
w,h=source.size;pixels=np.empty(w*h*4,dtype=np.float32)
source.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
colors=np.zeros((len(body.data.vertices),4));counts=np.zeros(len(colors))
uv=body.data.uv_layers.active.data
for loop in body.data.loops:
 u,v=uv[loop.index].uv
 colors[loop.vertex_index]+=pixels[min(h-1,max(0,int(v*h))),min(w-1,max(0,int(u*w)))]
 counts[loop.vertex_index]+=1
colors/=np.maximum(counts[:,None],1)
groups={g.index:g.name for g in body.vertex_groups}
candidates=[]
for vertex,color in zip(body.data.vertices,colors):
 x,y,z=vertex.co
 head=z>.34 and (abs(x)>.27 or y>-.25 or z>.73)
 tail=z<-.35 and y>.13 and abs(x)>.18
 paws=z<-.79 or abs(x)>.50 and z<-.16
 neck=.17<z<.29 and abs(x)<.10 and y<-.16
 fur=color[0]-color[2]>.035 and color[0]<color[1]*1.25
 if fur and (head or tail or paws or neck) and vertex.normal.length>.9:
  candidates.append(vertex.index)
assert len(candidates)>1500, 'Fur mask must select actual animal surfaces'

# Three fine strokes in each tapered, curved ribbon. Alpha masking avoids
# transparent draw-order artifacts and keeps the groom to one draw call/LOD.
tw,th=64,128;rgba=np.ones((th,tw,4),dtype=np.float32)
for row in range(th):
 t=row/(th-1)
 for col in range(tw):
  u=col/(tw-1);stroke=0
  for center,phase in [(.25,0),(.49,1.2),(.74,2.1)]:
   center+=.025*math.sin(t*7+phase)
   width=.050*(1-t)**.35+.007
   stroke=max(stroke,math.exp(-((u-center)/width)**2))
  rgba[row,col,3]=stroke*min(1,t*12+.35)*min(1,(1-t)*10)
image=bpy.data.images.new('Milo / short fur strand mask',width=tw,height=th,alpha=True)
image.pixels.foreach_set(rgba.ravel());image.pack()
material=bpy.data.materials.new('Milo / matte short fur');material.use_nodes=True
nodes=material.node_tree.nodes;hair_shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
hair_shader.inputs['Roughness'].default_value=.96
hair_shader.inputs['Sheen Weight'].default_value=.65
hair_shader.inputs['Sheen Roughness'].default_value=.9
texture=nodes.new('ShaderNodeTexImage');texture.image=image
vertex_tint=nodes.new('ShaderNodeVertexColor');vertex_tint.layer_name='Milo_FurTint'
material.node_tree.links.new(vertex_tint.outputs['Color'],hair_shader.inputs['Base Color'])
cutoff=nodes.new('ShaderNodeMath');cutoff.operation='GREATER_THAN';cutoff.inputs[1].default_value=.25
material.node_tree.links.new(texture.outputs['Alpha'],cutoff.inputs[0])
material.node_tree.links.new(cutoff.outputs[0],hair_shader.inputs['Alpha'])
material.surface_render_method='DITHERED';material.alpha_threshold=.28
material.use_backface_culling=False

randomizer=random.Random(20261001)
selected=randomizer.sample(candidates,1200)
def groom(name,indices):
 verts=[];faces=[];values=[];tints=[];normals=[];weights=[]
 for index in indices:
  vertex=body.data.vertices[index];normal=vertex.normal.normalized()
  tangent=normal.cross(Vector((0,0,1)))
  if tangent.length<.1:tangent=normal.cross(Vector((1,0,0)))
  tangent.normalize()
  length=randomizer.uniform(.014,.028);width=randomizer.uniform(.0025,.0045)
  base=len(verts)
  source_weights=[(groups[g.group],g.weight) for g in vertex.groups]
  for step in range(4):
   t=step/3
   center=vertex.co+normal*(.001+length*t)+Vector((0,0,-length*.24*t*t))
   extent=width*(1-t)**.65+.00005
   for side in [-1,1]:
    verts.append(center+tangent*extent*side);values.append(((side+1)/2,t))
    tint=colors[index].copy();tint[3]=1;tints.append(tint)
    normals.append(normal);weights.append(source_weights)
  for step in range(3):
   a=base+step*2;faces.append((a,a+1,a+3,a+2))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(material);mesh.update()
 layer=mesh.uv_layers.new(name='UVMap')
 for poly in mesh.polygons:
  poly.use_smooth=True
  for li,vi in zip(poly.loop_indices,poly.vertices):layer.data[li].uv=values[vi]
 mesh.normals_split_custom_set([normals[loop.vertex_index] for loop in mesh.loops])
 color=mesh.color_attributes.new(name='Milo_FurTint',type='FLOAT_COLOR',domain='POINT')
 for value,tint in zip(color.data,tints):value.color_srgb=tuple(tint)
 mesh.color_attributes.active_color=color
 ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);ob.parent=rig
 for bone in rig.data.bones:ob.vertex_groups.new(name=bone.name)
 for index,groups_for_vertex in enumerate(weights):
  for name,weight in groups_for_vertex:ob.vertex_groups[name].add([index],weight,'REPLACE')
 mod=ob.modifiers.new('Milo shared skin','ARMATURE');mod.object=rig;ob['part']='fur'
 return ob
groom('Milo_Groom_HIGH',selected)
groom('Milo_Groom_LOW',selected[:420])

for ob in bpy.context.scene.objects:
 if ob.type!='MESH':continue
 if ob==body:ob['part']='body'
 elif not ob.name.startswith('Milo_Groom'):ob['part']='head'
for mat in bpy.data.materials:
 if not mat.use_nodes:continue
 shader=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if shader is None:continue
 if mat==body.data.materials[0]:
  for name in ['Roughness','Metallic']:
   for link in list(shader.inputs[name].links):mat.node_tree.links.remove(link)
  shader.inputs['Roughness'].default_value=.86;shader.inputs['Metallic'].default_value=0
  shader.inputs['Sheen Weight'].default_value=.45
  shader.inputs['Sheen Roughness'].default_value=.9
 elif mat.name=='Milo / eyes PBR':
  shader.inputs['Roughness'].default_value=.24;shader.inputs['Coat Weight'].default_value=.12

# Source coordinates remain stable for facial controls and reveal masks;
# a single authoring parent sets the game height and ground origin.
minimum=min(v.co.z for v in body.data.vertices);maximum=max(v.co.z for v in body.data.vertices)
scale=1.15/(maximum-minimum)
origin=bpy.data.objects.new('Milo_GameOrigin',None);bpy.context.collection.objects.link(origin)
origin.scale=(scale,)*3;origin.location=(0,0,-minimum*scale);rig.parent=origin
for index,im in enumerate(bpy.data.images):
 # Packed maps are loaded lazily. Reading the buffer also includes normal maps
 # that have not been sampled while constructing the groom.
 if im.source=='FILE':
  first_pixel=tuple(im.pixels[:4])
  assert len(first_pixel)==4, f'Packed image unavailable: {im.name}'
 if im.has_data and max(im.size)>1024:
  im.scale(1024,1024)
  # Blender may otherwise reuse the old packed JPEG bytes for the normal map.
  im.filepath_raw=str(PRIVATE/f'game-texture-{index}.png');im.file_format='PNG'
  im.save();im.pack()
 elif im.has_data:im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(PRIVATE/'milo-game-short-fur.blend'))
temporary=PRIVATE/'milo-game-short-fur.glb'
bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',export_animations=True,
 export_animation_mode='NLA_TRACKS',export_skins=True,export_yup=True,export_morph=True,
 export_morph_animation=True,export_extras=True,export_draco_mesh_compression_enable=True,
 export_draco_mesh_compression_level=6,export_draco_position_quantization=16,
 export_draco_normal_quantization=12,export_draco_texcoord_quantization=14)
data=temporary.read_bytes();n=struct.unpack_from('<I',data,12)[0];document=json.loads(data[20:20+n])
assert sorted(c['name'] for c in document['animations'])==sorted(['idle','happy','wave','jump','run','sleep','roar'])
assert len(data)<8_000_000, 'Mobile texture/download budget exceeded'
sha=hashlib.sha256(data).hexdigest();asset='cat-milo-'+sha[:12]+'.glb'
(ROOT/'public/models'/asset).write_bytes(data)
primitives=[p for m in document['meshes'] for p in m['primitives']]
report={'version':8,'approval':'user requested game integration; further art polish pending',
 'source':'User-supplied Meshy Milo; original SHA256 de0e348c7eece526c4a7464ab876a73a72287f0cd0313d056b8e803afb1a9e90',
 'pipeline':'Blender shared skeleton, PBR atlas, eyelid in-betweens, connected mouth, skinned short-fur ribbons',
 'asset':asset,'sha256':sha,'bytes':len(data),'height':1.15,'bones':len(rig.data.bones),
 'clips':[c['name'] for c in document['animations']],
 'triangles':sum(document['accessors'][p['indices']]['count']//3 for p in primitives),
 'draw_calls':len(primitives),'groom':{'high_ribbons':1200,'low_ribbons':420,'technique':'alpha-masked, skinned, original atlas colors; no dynamic hair simulation'},
 'limitations':['Remaining crown/cheek reconstruction artifacts','Cloth weights and facial corners still need polish','Physical iPhone AR performance must be measured']}
(ROOT/'public/models/cat-master-info.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(ROOT/'src/characters/catAsset.ts').write_text("// Generated by scripts/export-milo-game.py. Immutable URL avoids an old PWA model.\nexport const CAT_MODEL_URL = '/models/"+asset+"';\n",encoding='utf-8')
print(json.dumps(report))
