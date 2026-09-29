"""Editable full silhouette and tailored outfit study; no production rig yet.

Run through the official Blender MCP on the unapproved v4 head study.
New anatomy uses one sewn cage for torso, arms and legs. Clothing has its own
sewn sleeves and real openings. Refuses to replace existing clothing or body.
"""
from pathlib import Path
import math
import random
import bpy
import bmesh
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
scene=bpy.context.scene
if scene.get('art_status') not in ['Milo head study v4. No body/rig yet. Visual approval pending.',
                                  'Milo full silhouette study v1. Art approval, retopology and rig pending.']:
    raise RuntimeError('Expected the unapproved v4 head study.')
anatomy=bpy.data.collections['01 / character anatomy']
cloth_col=bpy.data.collections['03 / separate tailored hoodie']
if cloth_col.objects:
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'.test-artifacts/milo-full-study-v1.blend'),copy=True)
    for ob in list(cloth_col.objects): bpy.data.objects.remove(ob,do_unlink=True)
    for name in ['Milo / connected body limbs and paws','Milo / curved full tail','Milo / studio floor']:
        bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
else:
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'.test-artifacts/milo-head-study-v4.blend'),copy=True)

def material(name,color,rough=.8):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough
    return m

cloth=material('Milo / lavender fleece',(.35,.22,.43))
p=cloth.node_tree.nodes.get('Principled BSDF'); p.inputs['Sheen Weight'].default_value=.5
for suffix,input_name in [('color','Base Color'),('roughness','Roughness'),('normal',None)]:
    node=cloth.node_tree.nodes.new('ShaderNodeTexImage')
    node.image=bpy.data.images.load(str(ROOT/('assets/characters/cat/textures/master/hoodie-fleece-'+suffix+'.png')),check_existing=True)
    node.image.pack()
    if suffix!='color': node.image.colorspace_settings.name='Non-Color'
    if input_name: cloth.node_tree.links.new(node.outputs['Color'],p.inputs[input_name])
    else:
        normal=cloth.node_tree.nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value=.4
        cloth.node_tree.links.new(node.outputs['Color'],normal.inputs['Color'])
        cloth.node_tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
lining=material('Milo / fleece lining',(.40,.29,.46),.95)
rib=material('Milo / knitted cuffs',(.29,.18,.35),.89)
thread=material('Milo / lavender sewing thread',(.46,.31,.52),.83)
zip_mat=material('Milo / muted brass zipper',(.39,.27,.13),.35)
zip_mat.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.7
fur=bpy.data.materials['Milo / peach cream fur']

class Cage:
    def __init__(self): self.v=[]; self.f=[]
    def point(self,p): self.v.append(tuple(p)); return len(self.v)-1
    def ring(self,points): return [self.point(p) for p in points]
    def bridge(self,a,b):
        if len(a)!=len(b): raise RuntimeError('Seam loop size mismatch.')
        for i in range(len(a)): self.f.append((a[i],a[(i+1)%len(a)],b[(i+1)%len(b)],b[i]))
    def output(self,name,col,mat,sub=2,thickness=0):
        mesh=bpy.data.meshes.new(name+' / control cage'); mesh.from_pydata(self.v,[],self.f); mesh.update()
        bm=bmesh.new(); bm.from_mesh(mesh)
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
        ob=bpy.data.objects.new(name,mesh); col.objects.link(ob); mesh.materials.append(mat)
        for face in mesh.polygons: face.use_smooth=True
        uv=mesh.uv_layers.new(name='Milo cloth layout')
        for loop in mesh.loops:
            co=mesh.vertices[loop.vertex_index].co
            uv.data[loop.index].uv=(co.x*1.5+co.y*.4,co.z*1.5)
        if mat==fur:
            attr=mesh.color_attributes.new(name='Milo_FurColor',type='FLOAT_COLOR',domain='POINT')
            for vertex in mesh.vertices: attr.data[vertex.index].color=(.84,.65,.43,1)
        if sub:
            mod=ob.modifiers.new('Editable surface subdivision','SUBSURF'); mod.levels=sub; mod.render_levels=sub
        if thickness:
            mesh.materials.append(lining)
            mod=ob.modifiers.new('Actual cloth thickness','SOLIDIFY'); mod.thickness=thickness; mod.offset=-1; mod.material_offset=1
        ob['art_status']='silhouette study; weights and animation not authored yet'
        return ob

def rows(cage,sections,n=64,folds=False):
    rings=[]
    for z,rx,ry in sections:
        points=[]
        for i in range(n):
            a=2*math.pi*i/n
            displacement=(.008*math.sin(a*7+z*18)+.003*math.sin(a*13-z*24)) if folds else 0
            points.append((math.sin(a)*(rx+displacement),-math.cos(a)*(ry+displacement*.7),z))
        rings.append(cage.ring(points))
    return rings

def shell(cage,rings,holes):
    for j in range(len(rings)-1):
        for i in range(len(rings[0])):
            if any(j0<=j<j1 and i0<=i<i1 for j0,j1,i0,i1 in holes): continue
            cage.f.append((rings[j][i],rings[j][(i+1)%64],rings[j+1][(i+1)%64],rings[j+1][i]))

def boundary(rings,hole):
    j0,j1,i0,i1=hole
    return ([rings[j0][i] for i in range(i0,i1)]+[rings[j][i1] for j in range(j0,j1)]+
        [rings[j1][i] for i in range(i1,i0,-1)]+[rings[j][i0] for j in range(j1,j0,-1)])

def arm(cage,last,side,clothing=False):
    center=sum((Vector(cage.v[i]) for i in last),Vector())/len(last)
    u=Vector((0,1,0)); v=Vector((side*.78,0,.63))
    angles=[math.atan2((Vector(cage.v[i])-center).dot(v),(Vector(cage.v[i])-center).dot(u)) for i in last]
    path=[(.29,1.02,.132),(.35,.91,.129),(.405,.78,.117),(.455,.65,.097)]
    if clothing: path=[(x,z,r+.025) for x,z,r in path]
    else: path +=[(.477,.575,.078),(.493,.53,.087),(.504,.48,.082),(.510,.447,.06),(.510,.428,.026),(.510,.425,.007)]
    for step,(cx,z,radius) in enumerate(path):
        pts=[]
        for a in angles:
            r=radius+(.006*math.sin(a*5+step*2) if clothing else 0)
            p=Vector((side*cx,-.012,z))+u*(math.cos(a)*r*.82)+v*(math.sin(a)*r)
            pts.append(p)
        next_ring=cage.ring(pts); cage.bridge(last,next_ring); last=next_ring
    if not clothing: cage.f.append(tuple(reversed(last)))
    return last,u,v

sections=[(.41,.24,.17),(.50,.25,.18),(.65,.25,.18),(.80,.24,.17),(.94,.245,.17),
          (1.04,.245,.165),(1.12,.185,.12),(1.18,.10,.09),(1.24,.06,.06)]
holes=[(4,6,12,20),(4,6,44,52)]
body=Cage(); rings=rows(body,sections); shell(body,rings,holes)
body.f.append(tuple(rings[-1]))
for side,hole in zip([1,-1],holes): arm(body,boundary(rings,hole),side)
# Shared crotch seam splits one torso loop into two leg loops, without overlapped
# hip spheres or separately attached cylinders.
divider=[rings[0][0]]+[body.point((0,-.17+.34*i/16,.41)) for i in range(1,16)]+[rings[0][32]]
leg_loops=[rings[0][:33]+list(reversed(divider[1:-1])),rings[0][32:]+[rings[0][0]]+divider[1:-1]]
for side,last in zip([1,-1],leg_loops):
    angles=[math.atan2(body.v[i][1],body.v[i][0]-side*.14) for i in last]
    for z,cx,cy,rx,ry in [(.35,.14,0,.112,.125),(.24,.15,-.012,.098,.112),
                          (.16,.15,-.040,.112,.148),(.105,.15,-.065,.128,.166),
                          (.05,.15,-.057,.106,.143),(.035,.15,-.050,.068,.093)]:
        ring=body.ring([(side*cx+math.cos(a)*rx,cy+math.sin(a)*ry,z) for a in angles])
        body.bridge(last,ring); last=ring
    body.f.append(tuple(reversed(last)))
body_ob=body.output('Milo / connected body limbs and paws',anatomy,fur)

coat=Cage(); coat_rows=[(z,rx+.027,ry+.022) for z,rx,ry in sections[:-1]]
coat_rows[0]=(.486,.278,.208); coat_rows[1]=(.53,.28,.206)
cr=rows(coat,coat_rows,folds=True); shell(coat,cr,holes)
wrists=[]
for side,hole in zip([1,-1],holes): wrists.append((side,*arm(coat,boundary(cr,hole),side,True)))
coat_ob=coat.output('Milo / tailored hoodie with sewn sleeves',cloth_col,cloth,thickness=.008)
for side,last,u,v in wrists:
    cuff=Cage(); angle_count=48; previous=None
    for z,cx,r in [(.66,.451,.124),(.651,.455,.125),(.599,.471,.113),(.589,.475,.112)]:
        ring=cuff.ring([Vector((side*cx,-.012,z))+u*(math.cos(a)*r*.84)+v*(math.sin(a)*(r+.002*math.cos(a*32)))
            for a in [math.pi*2*i/angle_count for i in range(angle_count)]])
        if previous: cuff.bridge(previous,ring)
        previous=ring
    cuff.output('Milo / ribbed wrist '+str(side),cloth_col,rib,thickness=.009)
hem=Cage(); hr=rows(hem,[(.465,.279,.204),(.469,.279,.204),(.525,.279,.204),(.53,.279,.204)])
shell(hem,hr,[]); hem.output('Milo / ribbed lower hem',cloth_col,rib,thickness=.009)

hood=Cage(); previous=None
for t in [1,.97,.85,.65,.40,.18,.04]:
    ring=hood.ring([(math.sin(a)*.30*t,.10-math.cos(a)*.225*t,
                    .94+.22*t-.075*math.cos(a)*t+.03*math.sin(a*3)*t*(1-t))
                   for a in [math.pi*2*i/64 for i in range(64)]])
    if previous: hood.bridge(previous,ring)
    previous=ring
hood.f.append(tuple(reversed(previous)))
hood.output('Milo / open draped hood and lining',cloth_col,cloth,thickness=.012)

def curve(name,paths,depth,mat):
    data=bpy.data.curves.new(name,'CURVE'); data.dimensions='3D'; data.bevel_depth=depth; data.bevel_resolution=2
    for path in paths:
        sp=data.splines.new('NURBS'); sp.points.add(len(path)-1)
        for dest,p in zip(sp.points,path): dest.co=(*p,1)
        sp.order_u=min(3,len(path)); sp.use_endpoint_u=True
    ob=bpy.data.objects.new(name,data); cloth_col.objects.link(ob); data.materials.append(mat)
    return ob

def cloth_point(x,z,offset=.004):
    evaluated=coat_ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    hit,p,normal,index=evaluated.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    if not hit: raise RuntimeError('Clothing guide missed surface.')
    return (x,p.y-offset,z)

for side in [-1,1]:
    outline=[(.03,.565),(.24,.575),(.25,.61),(.23,.72),(.135,.81),(.045,.78)]
    center=Vector((.13,.65)); pocket=Cage(); last=None
    for factor,offset in [(1,.008),(.97,.012),(.65,.018),(.08,.019)]:
        ring=pocket.ring([cloth_point(side*(center.x+(x-center.x)*factor),center.y+(z-center.y)*factor,offset) for x,z in outline])
        if last: pocket.bridge(last,ring)
        last=ring
    pocket.f.append(tuple(last)); pocket.output('Milo / shaped pocket '+str(side),cloth_col,cloth,thickness=.003)
    seam=[cloth_point(side*x,z,.013) for x,z in outline+[outline[0]]]
    curve('Milo / pocket seam '+str(side),[seam],.0012,thread)

zip_path=[cloth_point(0,.52+.61*i/36,.010) for i in range(37)]
curve('Milo / zipper tapes',[[ (x-.010,y,z) for x,y,z in zip_path],[(x+.010,y,z) for x,y,z in zip_path]],.003,rib)
curve('Milo / brass zipper chain',[zip_path],.003,zip_mat)
teeth=Cage()
for i in range(70):
    z=.54+i*.0078; x=(-1 if i%2 else 1)*.005; cx,cy,cz=cloth_point(x,z,.015)
    ids=[teeth.point((cx+dx,cy+dy,cz+dz)) for dx,dy,dz in [(-.005,0,-.002),(.005,0,-.002),(.005,0,.002),(-.005,0,.002),(-.005,.003,-.002),(.005,.003,-.002),(.005,.003,.002),(-.005,.003,.002)]]
    for face in [(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]: teeth.f.append(tuple(ids[j] for j in face))
teeth.output('Milo / zipper teeth',cloth_col,zip_mat,sub=0)
cx,cy,cz=cloth_point(0,1.05,.023)
curve('Milo / zipper pull',[[(-.012,cy,cz+.02),(.012,cy,cz+.02),(.012,cy-.01,cz-.03),(-.012,cy-.01,cz-.03),(-.012,cy,cz+.02)]],.0035,zip_mat)

tail=Cage(); previous=None
path=[(0,.18,.56,.066),(.08,.29,.53,.067),(.24,.31,.51,.077),(.40,.28,.56,.081),
      (.51,.25,.67,.080),(.55,.23,.80,.068),(.53,.21,.90,.043),(.50,.20,.94,.009)]
for i,(x,y,z,r) in enumerate(path):
    tangent=Vector(path[min(i+1,len(path)-1)][:3])-Vector(path[max(i-1,0)][:3]); tangent.normalize()
    u=tangent.cross(Vector((0,1,0))).normalized(); v=tangent.cross(u).normalized()
    ring=tail.ring([Vector((x,y,z))+u*(math.cos(a)*r)+v*(math.sin(a)*r) for a in [math.pi*2*j/32 for j in range(32)]])
    if previous: tail.bridge(previous,ring)
    previous=ring
tail.f.append(tuple(previous)); tail_ob=tail.output('Milo / curved full tail',anatomy,fur)

# Sculpt groom is stored as actual tapered curves. Realtime hair cards and
# texture bake are a later export step, not this high-detail inspection scene.
random.seed(2914)
groom_col=bpy.data.collections['04 / groom and realtime fur']
groom_mat=material('Milo / soft cream body groom',(.84,.65,.43),.82)
groom_mat.node_tree.nodes.get('Principled BSDF').inputs['Sheen Weight'].default_value=.45
for ob,count in [(body_ob,24000),(tail_ob,26000)]:
    evaluated=ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); mesh=evaluated.to_mesh(); mesh.calc_loop_triangles()
    tris=list(mesh.loop_triangles)
    areas=[((mesh.vertices[t.vertices[1]].co-mesh.vertices[t.vertices[0]].co).cross(mesh.vertices[t.vertices[2]].co-mesh.vertices[t.vertices[0]].co)).length/2 for t in tris]
    paths=[]
    for tri in random.choices(tris,weights=areas,k=count):
        a,b,c=[mesh.vertices[i].co for i in tri.vertices]; u,w=random.random(),random.random()
        if u+w>1: u,w=1-u,1-w
        pos=a+(b-a)*u+(c-a)*w
        if ob==body_ob and not (pos.z<.46 or (abs(pos.x)>.47 and pos.z<.60) or (pos.z>1.11 and abs(pos.x)<.12)): continue
        normal=tri.normal.normalized(); flow=Vector((pos.x*.25,0,-.4))
        flow-=normal*flow.dot(normal)
        if flow.length: flow.normalize()
        direction=(normal*.75+flow*.4).normalized()
        length=random.uniform(.009,.023) if ob==body_ob else random.uniform(.025,.046)
        paths.append([pos,pos+direction*length*.55,pos+direction*length+Vector((0,0,-length*.08))])
    evaluated.to_mesh_clear()
    data=bpy.data.curves.new(ob.name+' / soft groom','CURVE'); data.dimensions='3D'; data.bevel_depth=.00016; data.bevel_resolution=1
    data.materials.append(groom_mat)
    for points in paths:
        sp=data.splines.new('NURBS'); sp.points.add(2); sp.order_u=3; sp.use_endpoint_u=True
        for i,(p,co) in enumerate(zip(sp.points,points)): p.co=(*co,1); p.radius=[1,.55,.04][i]
    groom=bpy.data.objects.new(data.name,data); groom_col.objects.link(groom)

floor_mat=material('Milo / warm matte studio floor',(.22,.19,.17),.9)
floor=Cage(); ids=floor.ring([(-100,-100,.0),(100,-100,.0),(100,100,.0),(-100,100,.0)])
floor.f.append(tuple(ids)); floor.output('Milo / studio floor',bpy.data.collections['90 / cameras and studio'],floor_mat,sub=0)
scene.camera=bpy.data.objects['Milo camera / front']
scene.camera.location=(0,-5,1.08); scene.camera.data.ortho_scale=2.42
scene.render.resolution_x=1000; scene.render.resolution_y=1100
scene.render.filepath=str(ROOT/'.test-artifacts/milo-full-front.png')
scene['art_status']='Milo full silhouette study v2. Art approval, retopology and rig pending.'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/characters/cat/milo-authoring.blend'))
bpy.ops.render.render(write_still=True)
result={'render':scene.render.filepath,'scene':bpy.data.filepath,'status':scene['art_status']}
