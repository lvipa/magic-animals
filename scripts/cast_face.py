"""Surface-conforming eyes and eyelids, shared with the Milo production approach.

Original iris artwork is preserved. Each species supplies orbital landmarks;
we never place a generic sphere over its existing face.
"""
import bpy, bmesh, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
from milo_mouth import build_mouth


def build_face(body, rig, spec):
    mesh = body.data
    verts = [v.co.copy() for v in mesh.vertices]
    faces = [list(p.vertices) for p in mesh.polygons]
    uv = mesh.uv_layers.active.data
    polyuvs = [[uv[i].uv.copy() for i in p.loop_indices] for p in mesh.polygons]
    bvh = BVHTree.FromPolygons(verts, faces, all_triangles=True)

    def front(x, z):
        co, normal, index, distance = bvh.ray_cast(Vector((x, -2, z)), Vector((0, 1, 0)))
        if co is None:
            raise ValueError(f'No facial surface at {x}, {z}')
        value = barycentric_transform(co, *(verts[i] for i in faces[index]),
                                      *(Vector((v.x, v.y, 0)) for v in polyuvs[index]))
        return co, (value.x, value.y)

    def make(name, coordinates, polygons, values, material, bone='head'):
        data = bpy.data.meshes.new(name)
        data.from_pydata(coordinates, [], polygons); data.materials.append(material); data.update()
        layer = data.uv_layers.new(name='UVMap')
        for poly in data.polygons:
            poly.use_smooth = True
            for li, vi in zip(poly.loop_indices, poly.vertices): layer.data[li].uv = values[vi]
        ob = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(ob)
        ob.parent = rig; group = ob.vertex_groups.new(name=bone)
        group.add(list(range(len(data.vertices))), 1, 'REPLACE')
        ob.modifiers.new('Cast shared skin', 'ARMATURE').object = rig
        ob['part'] = 'head'
        return ob

    eye_mat = mesh.materials[0].copy(); eye_mat.name = 'Cast / eyes PBR'
    shader = next(n for n in eye_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for name, value in [('Roughness', .24), ('Metallic', 0), ('Normal', None)]:
        for link in list(shader.inputs[name].links): eye_mat.node_tree.links.remove(link)
        if value is not None: shader.inputs[name].default_value = value
    shader.inputs['Coat Weight'].default_value = .12
    crease_mat=bpy.data.materials.new('Cast / relaxed eyelid crease');crease_mat.use_nodes=True
    cs=next(n for n in crease_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    cs.inputs['Base Color'].default_value=(.065,.034,.024,1);cs.inputs['Roughness'].default_value=.8
    selected = set(); eyes = []
    cx, cz, rx, rz = spec['eye']
    orbitals = spec.get('orbitals', [('L', cx, cz, rx, rz), ('R', -cx, cz, rx, rz)])
    for side, x, cz, rx, rz in orbitals:
        center, _ = front(x, cz)
        chosen = [p.index for p in mesh.polygons if p.center.y < center.y + .08
                  and ((p.center.x-x)/rx)**2 + ((p.center.z-cz)/rz)**2 < 1]
        assert len(chosen) > 10, 'Missing orbital patch'
        selected.update(chosen)
        coordinates = []; polygons = []; values = []
        for index in chosen:
            start = len(coordinates); coordinates.extend(verts[i] for i in faces[index])
            values.extend(polyuvs[index]); polygons.append(list(range(start, start+3)))
        eye = make('Cast / eye '+side, coordinates, polygons, values, eye_mat)
        eye.shape_key_add(name='Basis'); retreat = eye.shape_key_add(name='eyeClose_'+side)
        for v in retreat.data: v.co.y += .10
        eyes.append((eye, side, x, cz, rx, rz, center))

        # Bake each lid from the orbital rim. A continuous field avoids the
        # iris being copied onto closed eyelids and preserves panda markings.
        template = mesh.materials[0]
        source_shader = next(n for n in template.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        source = source_shader.inputs['Base Color'].links[0].from_node.image
        import numpy as np
        w, h = source.size; pixels = np.array(source.pixels[:], dtype=np.float32).reshape(h,w,4)
        samples = []; colors = []
        for i in range(64):
            angle = math.tau*i/64; a=math.cos(angle); b=math.sin(angle)
            _, value = front(x+rx*1.30*a, cz+rz*1.30*b)
            samples.append([1,a,b,a*b,a*a-b*b])
            colors.append(pixels[min(h-1,max(0,int(value[1]*h))),min(w-1,max(0,int(value[0]*w)))])
        coefficients = np.linalg.lstsq(np.array(samples),np.array(colors),rcond=None)[0]
        rgba = np.ones((128,256,4),dtype=np.float32)
        for row in range(128):
            t=row/127
            for col in range(256):
                a=-1+2*col/255; b=math.sqrt(max(0,1-a*a))*(1-2*t)
                rgba[row,col,:3]=np.clip(np.array([1,a,b,a*b,a*a-b*b])@coefficients[:,:3],0,1)
                radius=math.sqrt(a*a+b*b); fade=max(0,min(1,(radius-.91)/.09))
                rgba[row,col,3]=1-fade*fade*(3-2*fade)
        image=bpy.data.images.new('Cast / eyelid '+side,width=256,height=128,alpha=True)
        image.pixels.foreach_set(rgba.ravel()); image.pack()
        lid_mat=template.copy();lid_mat.name='Cast / soft eyelid '+side
        ls=next(n for n in lid_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        for name in ['Base Color','Roughness','Metallic','Normal']:
            for link in list(ls.inputs[name].links):lid_mat.node_tree.links.remove(link)
        tex=lid_mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
        lid_mat.node_tree.links.new(tex.outputs['Color'],ls.inputs['Base Color'])
        lid_mat.node_tree.links.new(tex.outputs['Alpha'],ls.inputs['Alpha'])
        ls.inputs['Roughness'].default_value=.9;ls.inputs['Metallic'].default_value=0
        lid_mat.surface_render_method='BLENDED'
        coordinates=[];closed=[];half=[];values=[];polygons=[];nx=40;ny=16
        for row in range(ny+1):
            t=row/ny
            for col in range(nx+1):
                a=-.999+1.998*col/nx;arc=math.sqrt(1-a*a)
                px=x+rx*1.12*a
                opened,_=front(px,cz+rz*1.12*arc*(1-.025*t));opened.y-=.003
                shut,_=front(px,cz+rz*1.12*arc*(1-2*t));shut.y-=.004
                midway,_=front(px,(opened.z+shut.z)/2);midway.y-=.007
                coordinates.append(opened);closed.append(shut);half.append(midway);values.append(((a+1)/2,t))
        for row in range(ny):
            for col in range(nx):
                a=row*(nx+1)+col;polygons.append([a,a+nx+1,a+nx+2,a+1])
        lid=make('Cast / eyelid '+side,coordinates,polygons,values,lid_mat)
        lid.shape_key_add(name='Basis')
        for name,shape in [('blink_'+side,closed),('blinkHalf_'+side,half)]:
            key=lid.shape_key_add(name=name)
            for v,co in zip(key.data,shape):v.co=co
        coordinates=[];closed=[];values=[];polygons=[];segments=32;sides=6
        for step in range(segments+1):
            a=-.85+1.70*step/segments;px=x+rx*a
            opened,_=front(px,cz+rz*math.sqrt(1-a*a));opened.y-=.005
            shut,_=front(px,cz-.008+.013*(1-a*a));shut.y-=.007
            radius=.0028*math.sin(math.pi*step/segments)**.5+.0001
            for ring in range(sides):
                angle=math.tau*ring/sides
                coordinates.append(opened+Vector((0,math.cos(angle)*.00001,math.sin(angle)*.00001)))
                closed.append(shut+Vector((0,math.cos(angle)*radius,math.sin(angle)*radius)))
                values.append((0,0))
        for step in range(segments):
            for ring in range(sides):
                a=step*sides+ring;b=step*sides+(ring+1)%sides;polygons.append([a,b,b+sides,a+sides])
        crease=make('Cast / eyelid crease '+side,coordinates,polygons,values,crease_mat)
        crease.shape_key_add(name='Basis');key=crease.shape_key_add(name='lidCrease_'+side)
        for v,co in zip(key.data,closed):v.co=co

    bm=bmesh.new();bm.from_mesh(mesh);bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[bm.faces[i] for i in selected],context='FACES')
    bm.to_mesh(mesh);bm.free();mesh.update()
    bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for eye,side,x,z,rx,rz,center in eyes:
        bone=rig.data.edit_bones.new('eye_'+side);bone.head=center;bone.tail=center+Vector((0,-.08,0));bone.parent=rig.data.edit_bones['head']
    bpy.ops.object.mode_set(mode='OBJECT')
    for eye,side,x,z,rx,rz,center in eyes:
        head=eye.vertex_groups['head'];group=eye.vertex_groups.new(name='eye_'+side)
        for v in eye.data.vertices:
            radius=math.sqrt(((v.co.x-x)/rx)**2+((v.co.z-z)/rz)**2)
            amount=max(0,min(1,(.95-radius)/.4));amount=amount*amount*(3-2*amount)
            head.add([v.index],1-amount,'REPLACE');group.add([v.index],amount,'REPLACE')

    if 'mouth' in spec:
        # Reuse Milo's connected lip/cavity/tongue surgery in a temporary
        # local facial coordinate frame. The actual animal is never rescaled.
        z, width=spec['mouth'];scale=width/.105
        mx=spec.get('face_x',0)
        center,_=front(mx,z);offset=Vector((mx,center.y+.445,z-.345*scale))
        def local_front(x,z):
            co,value=front(x*scale+offset.x,z*scale+offset.z)
            return (co-offset)/scale,value
        # Y has its own offset so the reference lip plane remains at -.445.
        offset.y=center.y+.445*scale
        for v in mesh.vertices:v.co=(v.co-offset)/scale
        mesh.update();build_mouth(body,local_front,cut_height=.022)
        for key in mesh.shape_keys.key_blocks:
            for v in key.data:v.co=v.co*scale+offset
        for v in mesh.vertices:v.co=v.co*scale+offset
        mesh.update()
    else:
        body.shape_key_add(name='Basis');key=body.shape_key_add(name='mouthOpen')
        for v in key.data:
            if v.co.y<-.24 and .28<v.co.z<.45 and abs(v.co.x)<.22:
                v.co.z-=.012*max(0,1-(v.co.x/.22)**2)
    smile=body.shape_key_add(name='smile')
    mz=spec.get('mouth',(.35,.08))[0]
    for v in smile.data:
        if v.co.y<-.20 and abs(v.co.x)<.18:
            amount=max(0,1-((v.co.x/.18)**2+((v.co.z-mz)/.065)**2))**2
            v.co.z+=.010*amount*min(1,abs(v.co.x)/.04)
    return {'separate_eyes':True,'eye_bones':2,'eyelid_inbetweens':True,'connected_mouth':'mouth' in spec}
