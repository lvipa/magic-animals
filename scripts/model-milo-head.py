"""First editable head study for the approved Milo, executed via Blender MCP.

Independent facial control mesh with real eye openings, sewn ear roots, eyelid
loops, separate eye optics and groom curves. This is an art study, not the final
web asset: no rig, body or animation is claimed here.
"""
import bpy
import bmesh
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
anatomy = bpy.data.collections['01 / character anatomy']
eyes_col = bpy.data.collections['02 / eyes and facial deformation']
groom_col = bpy.data.collections['04 / groom and realtime fur']
if anatomy.objects:
    if bpy.context.scene.get('art_status') != 'Milo head study v3. No body/rig yet. Visual approval pending.':
        raise RuntimeError('Existing authored work is not this unapproved generated study.')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'.test-artifacts/milo-head-study-v3.blend'), copy=True)
    for col in [anatomy, eyes_col, groom_col]:
        for ob in list(col.objects):
            bpy.data.objects.remove(ob, do_unlink=True)

def material(name, color, roughness=.7):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness
    return m

fur=material('Milo / peach cream fur',(.72,.47,.28),.8)
p=fur.node_tree.nodes.get('Principled BSDF'); p.inputs['Sheen Weight'].default_value=.45
c=fur.node_tree.nodes.new('ShaderNodeVertexColor'); c.layer_name='Milo_FurColor'
fur.node_tree.links.new(c.outputs['Color'],p.inputs['Base Color'])
pink=material('Milo / warm inner ear',(.65,.25,.20),.75)
rim=material('Milo / soft lid margin',(.46,.27,.14),.55)
white=material('Milo / sclera ivory',(.88,.88,.79),.19)
black=material('Milo / deep pupils',(.005,.012,.014),.12)
nose_mat=material('Milo / peach nose',(.70,.24,.19),.48)
mouth_mat=material('Milo / warm lip crease',(.18,.065,.04),.8)
strand_mat=material('Milo / fine groom fibers',(.59,.36,.20),.83)
whisker_mat=material('Milo / cream whiskers',(.91,.80,.64),.6)

class Mesh:
    def __init__(self): self.vertices=[]; self.faces=[]
    def point(self,p): self.vertices.append(tuple(p)); return len(self.vertices)-1
    def ring(self,pts): return [self.point(p) for p in pts]
    def bridge(self,a,b):
        for i in range(len(a)): self.faces.append((a[i],a[(i+1)%len(a)],b[(i+1)%len(b)],b[i]))
    def output(self,name,col,mat,sub=0):
        mesh=bpy.data.meshes.new(name+' / cage'); mesh.from_pydata(self.vertices,[],self.faces); mesh.update()
        bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
        ob=bpy.data.objects.new(name,mesh); col.objects.link(ob); mesh.materials.append(mat)
        for poly in mesh.polygons: poly.use_smooth=True
        if sub:
            m=ob.modifiers.new('Editable facial subdivision','SUBSURF'); m.levels=sub; m.render_levels=sub
        return ob

def color_at(p):
    x,y,z=p
    front=max(0,min(1,(-y-.10)/.19))
    cream=front*math.exp(-((z-1.34)/.14)**2)*math.exp(-(x/.28)**4)
    stripe=front*.5*math.exp(-(x/.07)**2)*math.exp(-((z-1.70)/.24)**2)
    cream=max(cream,stripe)
    base=tuple(a*(1-cream)+b*cream for a,b in zip((.64,.34,.14),(.89,.73,.51)))
    if z>1.88 and y<-.005:
        width=max(.014,.10*(2.08-z)/.20)
        center=.34+(z-1.87)*.32
        inner=math.exp(-((abs(x)-center)/width)**6)*max(0,min(1,(z-1.88)/.055))
        base=tuple(a*(1-inner)+b*inner for a,b in zip(base,(.61,.24,.20)))
    return base

# Sculpted cross sections: cheeks wider than the crown; muzzle and chin are
# integrated into the face surface. The eye openings have their own edge loops.
rows=[(1.13,.05,.08),(1.17,.20,.18),(1.22,.30,.235),(1.27,.375,.26),
      (1.34,.42,.27),(1.40,.44,.28),(1.45,.443,.283),(1.50,.440,.285),
      (1.55,.43,.286),(1.60,.419,.286),(1.65,.405,.281),(1.70,.391,.27),
      (1.75,.385,.268),(1.80,.359,.249),(1.84,.315,.218),(1.89,.247,.180),
      (1.93,.160,.12),(1.95,.045,.035)]
head=Mesh(); rings=[]; n=72
for z,rx,ry in rows:
    points=[]
    for i in range(n):
        a=2*math.pi*i/n; x=math.sin(a)*rx; y=-math.cos(a)*ry
        frontal=max(0,math.cos(a))**4
        cheeks=.017*math.exp(-((abs(x)-.27)/.08)**2-((z-1.35)/.09)**2)
        muzzle=.100*sum(math.exp(-((x-s*.083)/.082)**2-((z-1.315)/.065)**2) for s in [-1,1])
        chin=.035*math.exp(-(x/.13)**2-((z-1.23)/.055)**2)
        bridge=.070*math.exp(-(x/.070)**2-((z-1.40)/.075)**2)
        y-=frontal*(cheeks+muzzle+chin+bridge)
        points.append((x,y,z))
    rings.append(head.ring(points))
eye_holes=[(6,11,2,10),(6,11,62,70)]
ear_holes=[(12,16,11,17),(12,16,55,61)]
for j in range(len(rows)-1):
    for i in range(n):
        if any(j0<=j<j1 and i0<=i<i1 for j0,j1,i0,i1 in eye_holes+ear_holes): continue
        head.faces.append((rings[j][i],rings[j][(i+1)%n],rings[j+1][(i+1)%n],rings[j+1][i]))
head.faces.extend([tuple(reversed(rings[0])),tuple(rings[-1])])

def boundary(hole):
    j0,j1,i0,i1=hole
    return ([rings[j0][i] for i in range(i0,i1)]+[rings[j][i1] for j in range(j0,j1)]+
            [rings[j1][i] for i in range(i1,i0,-1)]+[rings[j][i0] for j in range(j1,j0,-1)])

eye_centers=[]
for side,hole in [(1,eye_holes[0]),(-1,eye_holes[1])]:
    cx,cz=side*.195,1.575; eye_centers.append((cx,-.125,cz))
    last=boundary(hole)
    angles=[math.atan2((head.vertices[i][2]-cz)/.15,(head.vertices[i][0]-cx)/.14) for i in last]
    # Reshape the socket boundary itself, avoiding the rectangular opening
    # inherited from the coarse head rings.
    for index,a in zip(last,angles):
        x=.154*math.cos(a); z=.151*math.sin(a)
        head.vertices[index]=(cx+x,-.252+.04*abs(math.cos(a)),cz+z)
    for rx,rz,offset in [(.144,.140,-.008),(.127,.121,-.010),(.121,.112,-.012)]:
        pts=[]
        for a in angles:
            x,z=rx*math.cos(a),rz*math.sin(a)
            z += .010*math.cos(a)*side
            y=-.125-.164*math.sqrt(max(.035,1-(x/.153)**2-(z/.168)**2))+offset
            pts.append((cx+x,y,cz+z))
        ring=head.ring(pts); head.bridge(last,ring); last=ring

for side,hole in [(1,ear_holes[0]),(-1,ear_holes[1])]:
    last=boundary(hole)
    center=sum((Vector(head.vertices[i]) for i in last),Vector())/len(last)
    angles=[math.atan2((head.vertices[i][2]-center.z)/.085,(head.vertices[i][0]-center.x)/.07) for i in last]
    for cx,z,rx,ry in [(.34,1.87,.126,.080),(.375,1.94,.103,.068),
                       (.396,2.00,.065,.048),(.404,2.055,.028,.026),(.400,2.08,.009,.010)]:
        ring=head.ring([(side*cx+math.cos(a)*rx,.010+math.sin(a)*ry,z) for a in angles])
        head.bridge(last,ring); last=ring
    tip=head.point((side*.394,.01,2.09))
    for i in range(len(last)): head.faces.append((last[i],last[(i+1)%len(last)],tip))
head_ob=head.output('Milo / unified head and ear roots',anatomy,fur,2)
attr=head_ob.data.color_attributes.new(name='Milo_FurColor',type='FLOAT_COLOR',domain='POINT')
for v in head_ob.data.vertices: attr.data[v.index].color=(*color_at(v.co),1)
head_ob['art_status']='first head study; facial topology review pending'

def curve(name,paths,depth,mat,col):
    data=bpy.data.curves.new(name,'CURVE'); data.dimensions='3D'; data.bevel_depth=depth; data.bevel_resolution=2
    for points in paths:
        sp=data.splines.new('NURBS'); sp.points.add(len(points)-1)
        for k,(dest,p) in enumerate(zip(sp.points,points)):
            dest.co=(*p,1)
            if 'groom' in name or 'whiskers' in name:
                dest.radius=max(.06,1-k/(len(points)-1))
        sp.order_u=min(3,len(points)); sp.use_endpoint_u=True
    ob=bpy.data.objects.new(name,data); col.objects.link(ob); data.materials.append(mat); return ob

# Pink inner-ear coloration belongs to the ear surface, not a floating panel.

iris=bpy.data.materials.new('Milo / teal radial iris'); iris.use_nodes=True
bs=iris.node_tree.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=.23
texture=iris.node_tree.nodes.new('ShaderNodeTexImage')
texture.image=bpy.data.images.load(str(ROOT/'assets/characters/cat/textures/master/iris-teal-radial.png'),check_existing=True); texture.image.pack()
iris.node_tree.links.new(texture.outputs['Color'],bs.inputs['Base Color'])

def optic(name,cx,cy,cz,radii,mat):
    mesh=Mesh(); rr=[]
    for j in range(33):
        angle=math.pi*(.002+.996*j/32)
        rr.append(mesh.ring([(cx+radii[0]*math.sin(angle)*math.cos(a),
                             cy+radii[1]*math.sin(angle)*math.sin(a),cz+radii[2]*math.cos(angle))
                            for a in [2*math.pi*i/64 for i in range(64)]]))
    for a,b in zip(rr,rr[1:]): mesh.bridge(a,b)
    mesh.faces.extend([tuple(reversed(rr[0])),tuple(rr[-1])]); return mesh.output(name,eyes_col,mat)

for side,(cx,cy,cz) in enumerate(eye_centers):
    optic('Milo / eyeball '+str(side),cx,cy,cz,(.153,.164,.168),white)
    mesh=Mesh(); rr=[]
    for radius in [.003,.030,.060,.080,.084]:
        pts=[]
        for i in range(64):
            a=2*math.pi*i/64; x=radius*math.cos(a); z=radius*1.08*math.sin(a)
            y=cy-.164*math.sqrt(1-(x/.153)**2-(z/.168)**2)-.003
            pts.append((cx+x,y,cz+z))
        rr.append(mesh.ring(pts))
    for a,b in zip(rr,rr[1:]): mesh.bridge(a,b)
    mesh.faces.append(tuple(rr[0])); ob=mesh.output('Milo / iris '+str(side),eyes_col,iris)
    uv=ob.data.uv_layers.new()
    for loop in ob.data.loops:
        p=ob.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=((p.x-cx)/.168+.5,(p.z-cz)/.18144+.5)
    optic('Milo / pupil '+str(side),cx,cy-.169,cz,(.044,.006,.050),black)
    highlight=material('Milo / eye catchlight '+str(side),(1,1,1),.1)
    optic('Milo / key reflection '+str(side),cx-.025,cy-.174,cz+.035,(.012,.002,.016),highlight)
    optic('Milo / fill reflection '+str(side),cx+.026,cy-.171,cz-.030,(.004,.002,.006),highlight)

nose=Mesh(); contour=[(-.038,1.388),(-.030,1.403),(0,1.408),(.030,1.403),(.038,1.388),
                     (.023,1.374),(.009,1.357),(0,1.354),(-.009,1.357),(-.023,1.374)]
last=None
for factor,y in [(1,-.350),(.96,-.369),(.66,-.380),(.06,-.383)]:
    ring=nose.ring([(x*factor,y,1.383+(z-1.383)*factor) for x,z in contour])
    if last: nose.bridge(last,ring)
    last=ring
nose.faces.append(tuple(last)); nose.output('Milo / sculpted nose',anatomy,nose_mat,2)
def face_point(x,z):
    evaluated=head_ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    hit,p,normal,index=evaluated.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
    if not hit: raise RuntimeError('Lip guide missed the face surface.')
    return (x,p.y-.0015,z)
lip=[]
for i in range(41):
    x=-.13+.26*i/40
    z=1.298+.019*(abs(x)/.13)**2+.024*math.exp(-(x/.027)**2)
    lip.append(face_point(x,z))
curve('Milo / philtrum and lip corners',[
    [face_point(0,z) for z in [1.357,1.345,1.332,1.323]],lip],.0017,mouth_mat,anatomy)
lid_mat=material('Milo / fine upper lash line',(.075,.034,.016),.78)
brow_mat=material('Milo / peach eyebrow fur',(.39,.18,.065),.85)
for cx,cy,cz in eye_centers:
    upper=[]
    for i in range(33):
        a=math.pi*i/32; x=.121*math.cos(a); z=.112*math.sin(a)+.010*math.cos(a)*(1 if cx>0 else -1)
        y=cy-.164*math.sqrt(max(.035,1-(x/.153)**2-(z/.168)**2))-.014
        upper.append((cx+x,y,cz+z))
    curve('Milo / upper lid contour '+str(cx),[upper],.003,lid_mat,eyes_col)
    eyebrow=[face_point(cx-.071+.142*i/24,1.77+.023*math.sin(math.pi*i/24)) for i in range(25)]
    curve('Milo / relaxed brow '+str(cx),[eyebrow],.006,brow_mat,anatomy)
for side in [-1,1]:
    paths=[]
    for j in range(4):
        root=(side*.090,-.402,1.34-j*.018)
        paths.append([root,(side*.185,-.405,root[2]+(.018-j*.012)),
                      (side*.32,-.375,root[2]+(.034-j*.022)),(side*.49,-.33,root[2]+(.049-j*.033))])
    curve('Milo / whiskers '+str(side),paths,.00075,whisker_mat,groom_col)

# Groom follows the evaluated sculpt, with shorter forehead fibers and longer
# cheek silhouette strands. Actual curves are preserved for later hair-card bake.
random.seed(8411)
deps=bpy.context.evaluated_depsgraph_get(); evaluated=head_ob.evaluated_get(deps); mesh=evaluated.to_mesh()
mesh.calc_loop_triangles(); triangles=list(mesh.loop_triangles)
areas=[((mesh.vertices[t.vertices[1]].co-mesh.vertices[t.vertices[0]].co).cross(
    mesh.vertices[t.vertices[2]].co-mesh.vertices[t.vertices[0]].co)).length/2 for t in triangles]
samples=random.choices(triangles,weights=areas,k=45000)
paths=[]
for tri in samples:
    a,b,c=[mesh.vertices[i].co for i in tri.vertices]
    u,v=random.random(),random.random()
    if u+v>1: u,v=1-u,1-v
    pos=a+(b-a)*u+(c-a)*v; normal=tri.normal.normalized()
    # Exclude eye rims and nostril/mouth region; a soft clean face is essential.
    if pos.y<-.18 and any(((pos.x-cx)/.166)**2+((pos.z-cz)/.176)**2<1.12 for cx,cy,cz in eye_centers): continue
    if pos.y<-.27 and abs(pos.x)<.15 and pos.z<1.405: continue
    length=random.uniform(.008,.020)
    if abs(pos.x)>.32 and pos.z<1.56: length*=1.8
    direction=Vector((pos.x*.8,0,.3 if pos.z>1.75 else -.25))
    tangent=direction-normal*direction.dot(normal)
    if tangent.length: tangent.normalize()
    growth=(normal*.70+tangent*.50).normalized()
    paths.append([pos,pos+growth*length*.5,pos+growth*length+Vector((0,0,-length*.10))])
evaluated.to_mesh_clear()
groom=curve('Milo / directional short fur groom',paths,.00015,strand_mat,groom_col)
palette=[]
for t in [0,.25,.5,.75,1]:
    color=tuple(a*(1-t)+b*t for a,b in zip((.64,.34,.14),(.89,.73,.51)))
    palette.append(color)
    groom.data.materials.append(material('Milo / blended groom '+str(t),color,.8))
for spline,path in zip(groom.data.splines,paths):
    color=color_at(path[0])
    spline.material_index=1+min(range(len(palette)),key=lambda i:sum((a-b)**2 for a,b in zip(color,palette[i])))
scene=bpy.context.scene
scene['art_status']='Milo head study v4. No body/rig yet. Visual approval pending.'
scene.camera=bpy.data.objects['Milo camera / front']
scene.camera.data.ortho_scale=1.28
scene.camera.location=(0,-5,1.65)
scene.camera.rotation_euler=(math.pi/2,0,0)
scene.render.resolution_x=900; scene.render.resolution_y=900
scene.render.filepath=str(ROOT/'.test-artifacts/milo-head-front.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/characters/cat/milo-authoring.blend'))
bpy.ops.render.render(write_still=True)
result={'file':bpy.data.filepath,'head_control_vertices':len(head_ob.data.vertices),'groom_strands':len(paths),
        'render':scene.render.filepath,'status':'editable head study; not approved or ready for production'}
