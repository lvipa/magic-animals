"""Preserve supplied Milo identity while adding separate eyes and eyelids."""
import bpy,bmesh,math,json,numpy as np,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
root=Path(__file__).resolve().parent.parent/'.deployment/incoming-milo'
sys.path.insert(0,str(Path(__file__).resolve().parent))
from milo_mouth import build_mouth
bpy.ops.wm.open_mainfile(filepath=str(root/'milo-cleaned-rig-WIP.blend'))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
bpy.context.scene.frame_set(1)
mesh=body.data;mat=mesh.materials[0]
verts=[v.co.copy() for v in mesh.vertices];faces=[list(p.vertices) for p in mesh.polygons]
uvs=mesh.uv_layers.active.data
polyuvs=[[uvs[i].uv.copy() for i in p.loop_indices] for p in mesh.polygons]
bvh=BVHTree.FromPolygons(verts,faces,all_triangles=True)
def front(x,z):
 loc,normal,index,distance=bvh.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
 if loc is None:return Vector((x,-.40,z)),(0,0)
 indices=faces[index];values=polyuvs[index]
 uv=barycentric_transform(loc,*(verts[i] for i in indices),*(Vector((v.x,v.y,0)) for v in values))
 return loc,(uv.x,uv.y)
def deform(ob,bone='head'):
 ob.parent=rig;group=ob.vertex_groups.new(name=bone);group.add(list(range(len(ob.data.vertices))),1,'REPLACE')
 mod=ob.modifiers.new('Milo shared rig','ARMATURE');mod.object=rig
def make(name,coordinates,polygons,uvvalues,material):
 data=bpy.data.meshes.new(name);data.from_pydata(coordinates,[],polygons);data.materials.append(material);data.update()
 layer=data.uv_layers.new(name='UVMap')
 for poly in data.polygons:
  poly.use_smooth=True
  for li,vi in zip(poly.loop_indices,poly.vertices):layer.data[li].uv=uvvalues[vi]
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);return ob
eye_mat=mat.copy();eye_mat.name='Milo / eyes PBR'
shader=next(n for n in eye_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
for name,value in [('Roughness',.34),('Metallic',0),('Normal',None)]:
 for link in list(shader.inputs[name].links):eye_mat.node_tree.links.remove(link)
 if value is not None:shader.inputs[name].default_value=value
lid_mat=mat.copy();lid_mat.name='Milo / soft eyelid fur'
lid_shader=next(n for n in lid_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
base_image=lid_shader.inputs['Base Color'].links[0].from_node.image
w,h=base_image.size;pixels=np.empty(w*h*4,dtype=np.float32);base_image.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
def fur_color(x,z):
 _,uv=front(x,z);ix=min(w-1,max(0,int(uv[0]*w)));iy=min(h-1,max(0,int(uv[1]*h)))
 return pixels[max(0,iy-4):min(h,iy+5),max(0,ix-4):min(w,ix+5)].mean(axis=(0,1))
for link in list(lid_shader.inputs['Base Color'].links):lid_mat.node_tree.links.remove(link)
color_node=lid_mat.node_tree.nodes.new('ShaderNodeVertexColor');color_node.layer_name='Milo_LidColor';lid_mat.node_tree.links.new(color_node.outputs['Color'],lid_shader.inputs['Base Color'])
for name,value in [('Normal',None),('Roughness',.9),('Metallic',0)]:
 for link in list(lid_shader.inputs[name].links):lid_mat.node_tree.links.remove(link)
 if value is not None:lid_shader.inputs[name].default_value=value
crease_mat=bpy.data.materials.new('Milo / warm eyelid crease');crease_mat.diffuse_color=(.075,.040,.026,1);crease_mat.use_nodes=True
crease_shader=next(n for n in crease_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');crease_shader.inputs['Base Color'].default_value=(.075,.040,.026,1);crease_shader.inputs['Roughness'].default_value=.7
eye_specs=[('L',.137,.502),('R',-.137,.502)]
selected=set();eyes=[];lids=[]
for side,cx,cz in eye_specs:
 chosen=[p.index for p in mesh.polygons if p.center.y<-.27 and ((p.center.x-cx)/.108)**2+((p.center.z-cz)/.100)**2<1]
 selected.update(chosen);ids=sorted({i for pi in chosen for i in faces[pi]});mapping={v:i for i,v in enumerate(ids)}
 coords=[verts[i] for i in ids];triangles=[[mapping[v] for v in faces[pi]] for pi in chosen]
 # Keep original per-loop UVs, including seams, by copying faces independently.
 coordinates=[];polygons=[];values=[]
 for pi in chosen:
  base=len(coordinates);coordinates.extend(verts[i] for i in faces[pi]);values.extend(polyuvs[pi]);polygons.append(list(range(base,base+3)))
 eye=make('Milo / eye '+side,coordinates,polygons,values,eye_mat)
 patch=bmesh.new();patch.from_mesh(eye.data);bmesh.ops.remove_doubles(patch,verts=list(patch.verts),dist=.000002);patch.to_mesh(eye.data);patch.free();eye.data.update()
 deform(eye);eyes.append(eye)
 eye.shape_key_add(name='Basis');key=eye.shape_key_add(name='blink_'+side)
 for v in key.data:v.co.y+=.045
 # A curved lid slides over the original orbital surface, following its shape.
 coordinates=[];closed=[];values=[];polygons=[];nx=48;ny=12;rx=.094;rz=.092
 def closed_point(u,t):
  arc=math.sqrt(max(0,1-u*u));x=cx+.115*u
  top,_=front(x,cz+.111*arc);bottom,_=front(x,cz-.111*arc)
  return Vector((x,top.y*(1-t)+bottom.y*t-.004-.015*4*t*(1-t)*(1-u*u),cz+.111*arc*(1-2*t)))
 for row in range(ny+1):
  t=row/ny
  for col in range(nx+1):
   u=-.999+1.998*col/nx;arc=math.sqrt(max(0,1-u*u));x=cx+rx*u
   z=cz+rz*arc*(1-.035*t);zc=cz+.111*arc*(1-1.99*t)
   co,_=front(x,z);co.y-=.003;coordinates.append(co)
   closed.append(closed_point(u,t))
   _,uv=front(cx+rx*u*.6,cz+.135+.016*t);values.append(uv)
 for row in range(ny):
  for col in range(nx):
   a=row*(nx+1)+col;polygons.append([a,a+nx+1,a+nx+2,a+1])
 lid=make('Milo / eyelid '+side,coordinates,polygons,values,lid_mat);deform(lid)
 colors=lid.data.color_attributes.new(name='Milo_LidColor',type='FLOAT_COLOR',domain='POINT')
 # Fit a smooth fur-color field from the surrounding face, so isolated atlas
 # texels and UV seams cannot become vertical bands on a closed eyelid.
 samples=[];sample_colors=[]
 for step in range(64):
  angle=math.tau*step/64;u=math.cos(angle);v=math.sin(angle)
  samples.append([1,u,v,u*u,u*v,v*v])
  sample_colors.append(fur_color(cx+.128*u,cz+.125*v))
 coefficients=np.linalg.lstsq(np.array(samples),np.array(sample_colors),rcond=None)[0]
 for row in range(ny+1):
  t=row/ny
  for col in range(nx+1):
   u=-.999+1.998*col/nx;arc=math.sqrt(max(0,1-u*u));x=cx+.115*u
   v=arc*(1-2*t);color=np.clip(np.array([1,u,v,u*u,u*v,v*v])@coefficients,0,1)
   color[3]=1;colors.data[row*(nx+1)+col].color_srgb=tuple(color)
 lid.shape_key_add(name='Basis');key=lid.shape_key_add(name='blink_'+side)
 for v,co in zip(key.data,closed):v.co=co
 lids.append(lid)
 # A soft curved crease makes a closed eye readable as a relaxed expression.
 coordinates=[];closed=[];values=[];polygons=[];segments=40;sides=8
 for step in range(segments+1):
  u=-.90+1.80*step/segments;x=cx+.094*u
  opened,_=front(x,cz+.092*math.sqrt(1-u*u));opened.y-=.005
  v=-.010+.018*(1-u*u);tu=(1-v/(.111*math.sqrt(1-u*u)))/2
  shut=closed_point((x-cx)/.115,tu);shut.x=x;shut.y-=.002
  radius=.0025*math.sin(math.pi*step/segments)**.5+.0001
  for ring in range(sides):
   angle=ring/sides*math.tau
   coordinates.append(opened+Vector((0,math.cos(angle)*.00001,math.sin(angle)*.00001)))
   closed.append(shut+Vector((0,math.cos(angle)*radius,math.sin(angle)*radius)));values.append((0,0))
 for step in range(segments):
  for ring in range(sides):
   a=step*sides+ring;b=step*sides+(ring+1)%sides;polygons.append([a,b,b+sides,a+sides])
 crease=make('Milo / eyelid crease '+side,coordinates,polygons,values,crease_mat);deform(crease)
 crease.shape_key_add(name='Basis');key=crease.shape_key_add(name='blink_'+side)
 for v,co in zip(key.data,closed):v.co=co
# Remove duplicated eye patches from the base surface, preserving its UVs.
bm=bmesh.new();bm.from_mesh(mesh);bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm,geom=[bm.faces[i] for i in selected],context='FACES');bm.to_mesh(mesh);bm.free();mesh.update()
# Eye controls share the head transform. Blend their influence to zero at seams.
bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for side,cx,cz in eye_specs:
 bone=rig.data.edit_bones.new('eye_'+side);bone.head=(cx,-.33,cz);bone.tail=(cx,-.44,cz);bone.parent=rig.data.edit_bones['head']
bpy.ops.object.mode_set(mode='OBJECT')
for eye,(side,cx,cz) in zip(eyes,eye_specs):
 group=eye.vertex_groups.new(name='eye_'+side);head=eye.vertex_groups['head']
 for v in eye.data.vertices:
  radius=math.sqrt(((v.co.x-cx)/.089)**2+((v.co.z-cz)/.083)**2)
  weight=max(0,min(1,(.97-radius)/.40));weight=weight*weight*(3-2*weight)
  group.add([v.index],weight,'REPLACE');head.add([v.index],1-weight,'REPLACE')
 rig.pose.bones['eye_'+side].rotation_mode='XYZ'
# Cut the mouth before adding the expression keys; UVs and existing body
# weights are retained. The cavity is connected to the actual lip boundary.
mouth_report=build_mouth(body,front)
smile=body.shape_key_add(name='smile')
for vertex in smile.data:
 x,y,z=vertex.co
 if y<-.30 and .26<z<.395 and abs(x)<.18:
  d=((x/.16)**2+((z-.325)/.07)**2);weight=max(0,1-d)**2
  vertex.co.z+=.013*weight*min(1,abs(x)/.06);vertex.co.x+=.006*weight*(1 if x>0 else -1)
body['facial_status']='separate eyes, gaze bones, upper eyelid morphs, mouth cavity, tongue, mouthOpen and smile'
rig['study_status']='Unapproved facial control study; same supplied identity, body clips still WIP'
for im in bpy.data.images:
 if im.has_data and not im.packed_file:im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(root/'milo-face-controls-WIP.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'milo-face-controls-WIP.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_yup=True,export_morph=True)
print(json.dumps({'eye_patches':[len(e.data.polygons) for e in eyes],'bones':len(rig.data.bones),'morphs':['blink_L','blink_R','mouthOpen','smile'],'mouth':mouth_report}))
