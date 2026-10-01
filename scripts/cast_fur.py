"""Milo-compatible masked short-fur cards with transferred skin weights."""
import bpy,math,random,numpy as np
from mathutils import Vector

def build_fur(body, rig, spec):
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
     head=z>spec['head']+.10 and (abs(x)>.26 or y>-.14 or z>spec['eye'][1]+.19)
     tail=z<spec['hip'] and y>.14
     paws=z<spec['hip']-.05 or abs(x)>spec['paw_x']-.02 and z<spec['paw_z']+.025
     # Spatial exclusion keeps fabric, iris, nose and trunk free of hair.
     fur=head or tail or paws
     if fur and vertex.normal.length>.9:
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
    image=bpy.data.images.new('Cast / short fur strand mask',width=tw,height=th,alpha=True)
    image.pixels.foreach_set(rgba.ravel());image.pack()
    material=bpy.data.materials.new('Cast / matte short fur');material.use_nodes=True
    nodes=material.node_tree.nodes;hair_shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    hair_shader.inputs['Roughness'].default_value=.96
    hair_shader.inputs['Sheen Weight'].default_value=.65
    hair_shader.inputs['Sheen Roughness'].default_value=.9
    texture=nodes.new('ShaderNodeTexImage');texture.image=image
    vertex_tint=nodes.new('ShaderNodeVertexColor');vertex_tint.layer_name='Cast_FurTint'
    material.node_tree.links.new(vertex_tint.outputs['Color'],hair_shader.inputs['Base Color'])
    cutoff=nodes.new('ShaderNodeMath');cutoff.operation='GREATER_THAN';cutoff.inputs[1].default_value=.25
    material.node_tree.links.new(texture.outputs['Alpha'],cutoff.inputs[0])
    material.node_tree.links.new(cutoff.outputs[0],hair_shader.inputs['Alpha'])
    material.surface_render_method='DITHERED';material.alpha_threshold=.28
    material.use_backface_culling=False

    randomizer=random.Random(20261001)
    selected=randomizer.sample(candidates,min(1200,len(candidates)))
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
     color=mesh.color_attributes.new(name='Cast_FurTint',type='FLOAT_COLOR',domain='POINT')
     for value,tint in zip(color.data,tints):value.color_srgb=tuple(tint)
     mesh.color_attributes.active_color=color
     ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);ob.parent=rig
     for bone in rig.data.bones:ob.vertex_groups.new(name=bone.name)
     for index,groups_for_vertex in enumerate(weights):
      for name,weight in groups_for_vertex:ob.vertex_groups[name].add([index],weight,'REPLACE')
     mod=ob.modifiers.new('Cast shared skin','ARMATURE');mod.object=rig;ob['part']='fur'
     return ob
    groom('Cast_Groom_HIGH',selected)
    groom('Cast_Groom_LOW',selected[:420])
