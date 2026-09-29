"""CAT topology replacement. Run with Blender 4.5 --background --python.

This builds editable subdivision control cages, sewn shoulder patches and a
connected anatomical mesh. It never calls a primitive mesh operator and does
not import the superseded 79-part studio model. The output is a review candidate,
not a claim of artist approval. Coordinates: right/up/front before conversion.
"""
import bpy, bmesh, math, json, sys
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/characters/cat'
TEXTURES = SOURCE / 'textures/master'
TEXTURES.mkdir(parents=True, exist_ok=True)
REPORT = ROOT / '.test-artifacts/cat-master'
REPORT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
def xyz(p): return (p[0], -p[2], p[1])
def design(p): return (p[0], p[2], -p[1])
def smooth(a, b, x):
    t = max(0, min(1, (x-a)/(b-a)))
    return t*t*(3-2*t)

# Shared named rig; rest bones point upward so local Y is vertical and Z is front.
rig_data = bpy.data.armatures.new('CAT_MasterSkeleton')
rig = bpy.data.objects.new('CAT_MasterRig', rig_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
spec = [('root',(0,0,0),None),('pelvis',(0,.29,0),'root'),
        ('spine',(0,.40,0),'pelvis'),('chest',(0,.57,0),'spine'),
        ('neck',(0,.68,0),'chest'),('head',(0,.91,0),'neck')]
for suffix, s in [('L',-1),('R',1)]:
    spec += [('shoulder_'+suffix,(s*.155,.565,0),'chest'),
             ('arm_'+suffix,(s*.202,.535,0),'shoulder_'+suffix),
             ('elbow_'+suffix,(s*.272,.415,.015),'arm_'+suffix),
             ('paw_'+suffix,(s*.315,.278,.028),'elbow_'+suffix),
             ('leg_'+suffix,(s*.115,.275,0),'pelvis'),
             ('knee_'+suffix,(s*.12,.17,.018),'leg_'+suffix),
             ('foot_'+suffix,(s*.12,.080,.046),'knee_'+suffix),
             ('ear_'+suffix,(s*.235,1.13,.065),'head'),
             ('eye_'+suffix,(s*.132,.991,.218),'head'),
             ('closed_'+suffix,(s*.132,.991,.218),'head')]
tail_path = [(0,.295,-.127),(.07,.29,-.23),(.19,.33,-.32),(.31,.44,-.32),(.35,.59,-.27),(.32,.70,-.23)]
for i,p in enumerate(tail_path[:-1]):
    spec.append(('tail_'+str(i),p,'pelvis' if i==0 else 'tail_'+str(i-1)))
spec += [('mouth_rest',(0,.825,.304),'head'),('mouth_open',(0,.815,.305),'head')]
for name,p,parent in spec:
    bone=rig_data.edit_bones.new(name); bone.head=xyz(p)
    bone.tail=Vector(bone.head)+Vector((0,0,.075))
    if parent: bone.parent=rig_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT'); rig.select_set(False)

def image(name, rgb, data=False):
    rgba=np.ones((rgb.shape[0],rgb.shape[1],4),np.float32); rgba[:,:,:3]=np.clip(rgb,0,1)
    img=bpy.data.images.new(name,width=rgb.shape[1],height=rgb.shape[0])
    if data: img.colorspace_settings.name='Non-Color'
    img.pixels.foreach_set(rgba.ravel()); img.filepath_raw=str(TEXTURES/(name+'.png'))
    img.file_format='PNG'; img.save(); img.pack(); return img

size=1024
y,x=np.mgrid[:size,:size].astype(np.float32)/size
# Directional fibers, not black stipple. The direction bends slowly with the UV.
flow=x*112 + np.sin(y*math.pi*4)*1.4 + np.sin(y*math.pi*10)*.18
fiber=np.sin(flow*math.pi*2)*.038 + np.sin(flow*math.pi*6)*.009
fur_normal=image('fur-direction-normal',np.stack([.5+fiber,.5+np.cos(y*math.pi*160)*.006,np.ones_like(x)],-1),True)
fur_rough=image('fur-direction-roughness',np.repeat((.88+fiber*.6)[:,:,None],3,2),True)
weave=np.sin(x*math.pi*384)*np.sin(y*math.pi*384)
fold=np.sin(x*math.pi*12+y*4)*.012
fabric_color=image('hoodie-fleece-color',np.stack([.48+weave*.015+fold,.30+weave*.010+fold,.60+weave*.018+fold],-1))
fabric_normal=image('hoodie-fleece-normal',np.stack([.5+np.sin(x*math.pi*384)*.07,.5+np.sin(y*math.pi*384)*.06,np.ones_like(x)],-1),True)
fabric_rough=image('hoodie-fleece-roughness',np.repeat((.92+weave*.035)[:,:,None],3,2),True)
xx,yy=x*2-1,y*2-1; rr=np.sqrt(xx*xx+yy*yy); aa=np.arctan2(yy,xx)
radial=(np.sin(aa*153+rr*25)+np.sin(aa*63-rr*18))*.04
edge=np.clip((1-rr)*8,0,1)
iris_map=image('iris-teal-radial',np.stack([.12+radial,.42+radial,.47+radial],-1)*(.35+.65*edge[:,:,None]))

def material(name,color,rough=.8,sheen=0,coat=0,maps=None,vertex=False):
    m=bpy.data.materials.new(name); m.use_nodes=True; m.diffuse_color=(*color,1)
    n=m.node_tree.nodes; l=m.node_tree.links; bs=n.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough
    bs.inputs['Sheen Weight'].default_value=sheen; bs.inputs['Sheen Roughness'].default_value=.75
    bs.inputs['Coat Weight'].default_value=coat; bs.inputs['Coat Roughness'].default_value=.035
    if vertex:
        c=n.new('ShaderNodeVertexColor'); c.layer_name='FurTint'; l.new(c.outputs['Color'],bs.inputs['Base Color'])
    for purpose,img in (maps or {}).items():
        node=n.new('ShaderNodeTexImage'); node.image=img
        if purpose=='normal':
            nm=n.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value=.28
            l.new(node.outputs['Color'],nm.inputs['Color']); l.new(nm.outputs['Normal'],bs.inputs['Normal'])
        else: l.new(node.outputs['Color'],bs.inputs[purpose])
    return m
fur=material('CAT / short directional fur',(.60,.43,.29),.89,.7,maps={'normal':fur_normal,'Roughness':fur_rough},vertex=True)
fur.use_backface_culling=True
groom_material=fur.copy(); groom_material.name='CAT / silhouette fur'
groom_material.use_backface_culling=True
cloth=material('CAT / lavender fleece',(.48,.30,.60),.92,.8,maps={'Base Color':fabric_color,'normal':fabric_normal,'Roughness':fabric_rough})
knit=material('CAT / rib knit',(.55,.36,.66),.94,.7,maps={'normal':fabric_normal})
lining=material('CAT / hood lining',(.64,.43,.72),.95,.6,maps={'normal':fabric_normal})
pink=material('CAT / inner ear and pads',(.70,.35,.36),.79,.18)
nose=material('CAT / moist rose nose',(.48,.18,.20),.40,0,.3)
lip=material('CAT / warm lips',(.10,.055,.043),.63)
sclera=material('CAT / wet sclera',(.88,.86,.79),.16,0,.7)
iris=material('CAT / iris',(.14,.40,.44),.18,0,1,maps={'Base Color':iris_map})
pupil=material('CAT / pupil',(.004,.008,.010),.07,0,1)
cornea=material('CAT / corneal film',(1,1,1),.025,0,1)
bs=cornea.node_tree.nodes.get('Principled BSDF'); bs.inputs['Alpha'].default_value=.09
cornea.surface_render_method='BLENDED'; cornea.use_backface_culling=True
thread=material('CAT / stitches and zipper',(.78,.65,.75),.72)
whisker=material('CAT / soft whisker fibers',(.76,.68,.57),.94)

objects=[]; cage_stats=[]
class Cage:
    def __init__(self,name): self.name=name; self.v=[]; self.f=[]; self.uv=[]; self.w=[]
    def point(self,p,uv=(0,0),weights=None):
        i=len(self.v); self.v.append(tuple(p)); self.uv.append(uv); self.w.append(weights or {'head':1}); return i
    def quad(self,a,b,c,d): self.f.append((a,b,c,d))
    def ring(self,points,weights,offset=0):
        return [self.point(p,(i/len(points),offset),weights(p) if callable(weights) else weights) for i,p in enumerate(points)]
    def bridge(self,a,b):
        for i in range(len(a)): self.quad(a[i],a[(i+1)%len(a)],b[(i+1)%len(a)],b[i])
    def output(self,mat,sub=1,thickness=0,part='head',tint=False):
        tint=tint or mat==fur
        data=bpy.data.meshes.new(self.name+'_control'); data.from_pydata([xyz(p) for p in self.v],[],self.f); data.update()
        ob=bpy.data.objects.new(self.name,data); bpy.context.collection.objects.link(ob); data.materials.append(mat)
        layer=data.uv_layers.new(name='UVMap')
        for loop in data.loops: layer.data[loop.index].uv=self.uv[loop.vertex_index]
        # Circumference seams must not interpolate across the whole texture.
        for poly in data.polygons:
            values=[layer.data[i].uv.x for i in poly.loop_indices]
            if max(values)-min(values)>.5:
                for index in poly.loop_indices:
                    if layer.data[index].uv.x<.25: layer.data[index].uv.x+=1
        if tint:
            attr=data.color_attributes.new(name='FurTint',type='FLOAT_COLOR',domain='POINT')
            for i,(px,py,pz) in enumerate(self.v):
                mask=(1-smooth(.14,.23,abs(px)))*(1-smooth(.85,.94,py))*smooth(.09,.20,pz)*smooth(.71,.80,py)
                paw=(1-smooth(.12,.30,py))*.30
                base=np.array([.60,.43,.29]); cream=np.array([.87,.77,.61])
                color=base*(1-mask)+cream*mask; color=color*(1-paw)+cream*paw
                attr.data[i].color=(*color,1)
        for i,weights in enumerate(self.w):
            total=sum(weights.values())
            for bone,w in weights.items():
                if w<=0: continue
                vg=ob.vertex_groups.get(bone) or ob.vertex_groups.new(name=bone); vg.add([i],w/total,'REPLACE')
        # Consistent outward normals, including the sewn shoulder/crotch branches.
        bm=bmesh.new(); bm.from_mesh(data)
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(data); bm.free()
        for p in data.polygons: p.use_smooth=True
        if sub:
            mod=ob.modifiers.new('Editable Catmull-Clark control cage','SUBSURF'); mod.levels=sub; mod.render_levels=sub
        if thickness:
            mod=ob.modifiers.new('Fabric thickness','SOLIDIFY'); mod.thickness=thickness; mod.offset=-1
            mod.material_offset=1; data.materials.append(lining if mat==cloth else mat)
        mod=ob.modifiers.new('Shared skeletal deformation','ARMATURE'); mod.object=rig
        ob.parent=rig; ob['part']=part; ob['topology']='connected control cage'; objects.append(ob)
        cage_stats.append({'name':self.name,'vertices':len(self.v),'faces':len(self.f)})
        return ob

def blend_y(p,chain):
    yy=p[1]
    if yy<=chain[0][0]: return {chain[0][1]:1}
    for (a,ba),(b,bb) in zip(chain,chain[1:]):
        if yy<=b:
            t=smooth(a,b,yy); return {ba:1-t,bb:t}
    return {chain[-1][1]:1}
def body_weights(p): return blend_y(p,[(.31,'pelvis'),(.43,'spine'),(.57,'chest'),(.70,'neck'),(.82,'head')])
def limb_weights(p,suffix): return blend_y(p,[(.255,'paw_'+suffix),(.335,'elbow_'+suffix),(.49,'arm_'+suffix),(.57,'shoulder_'+suffix)])
def leg_weights(p,suffix): return blend_y(p,[(.065,'foot_'+suffix),(.14,'knee_'+suffix),(.23,'leg_'+suffix),(.31,'pelvis')])

def loft(cage,rows,n=48,weight=body_weights,face=None):
    rings=[]
    for j,(yy,rx,rz,zc) in enumerate(rows):
        points=[]
        for i in range(n):
            a=i/n*math.pi*2; p=(math.sin(a)*rx,yy,zc+math.cos(a)*rz)
            if face: p=face(p,a,j)
            points.append(p)
        rings.append(cage.ring(points,weight,j/(len(rows)-1)))
    return rings
def sew_loft(cage,rings,holes=()):
    n=len(rings[0])
    for j in range(len(rings)-1):
        for i in range(n):
            if any(j0<=j<j1 and i0<=i<i1 for j0,j1,i0,i1 in holes): continue
            cage.quad(rings[j][i],rings[j][(i+1)%n],rings[j+1][(i+1)%n],rings[j+1][i])
def boundary(rings,j0,j1,i0,i1):
    return ([rings[j0][i] for i in range(i0,i1)] + [rings[j][i1] for j in range(j0,j1)] +
            [rings[j1][i] for i in range(i1,i0,-1)] + [rings[j][i0] for j in range(j1,j0,-1)])
def sleeve_branch(cage,opening,s,suffix,skin=False):
    center=np.mean([cage.v[i] for i in opening],axis=0)
    angles=[math.atan2(cage.v[i][2]-center[2],cage.v[i][1]-center[1]) for i in opening]
    last=opening
    profiles=[(.218,.513,.013,.090,.079),(.245,.473,.015,.083,.077),(.273,.416,.020,.079,.072),
              (.298,.351,.026,.073,.068),(.313,.297,.029,.063,.061),(.314,.281,.030,.061,.060)]
    if skin:
        profiles=[(x,y,z,ry*.80,rz*.80) for x,y,z,ry,rz in profiles]
        profiles += [(.323,.260,.033,.054,.057),(.330,.237,.044,.048,.056),(.332,.209,.055,.032,.044),(.332,.198,.054,.012,.017)]
    for j,(cx,cy,cz,ry,rz) in enumerate(profiles):
        pts=[]
        for a in angles:
            # Local cross section is tilted with the sleeve, not a vertical capsule.
            dy=ry*math.cos(a); dz=rz*math.sin(a)
            pts.append((s*(cx+dy*.94),cy+dy*.34,cz+dz))
        ring=cage.ring(pts,lambda p:limb_weights(p,suffix),.3+j*.035); cage.bridge(last,ring); last=ring
    if skin: cage.f.append(tuple(reversed(last)))
    return last

# One anatomical cage: head, neck, torso, arms/paws, branched hips/legs/feet and ears.
body=Cage('CAT_BodyConnected')
rows=[(.275,.172,.112,0),(.30,.181,.124,-.002),(.37,.178,.130,0),(.44,.163,.118,0),
      (.49,.156,.104,0),(.545,.163,.103,0),(.585,.148,.098,0),(.63,.115,.087,0),
      (.68,.081,.071,.006),(.705,.086,.090,.012),(.735,.175,.169,.010),(.785,.259,.211,.013),
      (.810,.282,.222,.013),(.830,.296,.230,.013),
      (.845,.302,.233,.013),(.91,.312,.241,.009),(.948,.305,.237,.009),(.99,.298,.227,.008),
      (1.023,.291,.220,.006),
      (1.055,.283,.213,.004),(1.11,.263,.187,0),(1.16,.221,.158,-.008),
      (1.205,.149,.099,-.012),(1.23,.042,.028,-.012)]
def face_shape(p,a,j):
    px,py,pz=p
    front=max(0,math.cos(a))**3
    cheek=.029*math.exp(-((abs(px)-.196)/.077)**2-((py-.863)/.088)**2)
    muzzle=.066*sum(math.exp(-((px-s*.060)/.052)**2-((py-.826)/.043)**2) for s in [-1,1])
    chin=.023*math.exp(-(px/.07)**2-((py-.771)/.030)**2)
    socket=0
    for s in [-1,1]:
        q=math.sqrt(((px-s*.132)/.091)**2+((py-.991)/.100)**2)
        socket+=.026*math.exp(-q*q*.5)-.020*math.exp(-q*q*4)+.012*math.exp(-((q-1.0)/.22)**2)
    pz+=front*(cheek+muzzle+chin+socket)
    return (px,py,pz)
rings=loft(body,rows,48,face=face_shape)
arm_holes=[(3,6,10,14),(3,6,34,38)]
ear_start=next(i for i,row in enumerate(rows) if row[0]==1.055)
ear_end=next(i for i,row in enumerate(rows) if row[0]==1.205)
ear_holes=[(ear_start,ear_end,6,10),(ear_start,ear_end,38,42)]
sew_loft(body,rings,arm_holes+ear_holes)
for suffix,s,hole in [('R',1,arm_holes[0]),('L',-1,arm_holes[1])]: sleeve_branch(body,boundary(rings,*hole),s,suffix,True)
# A shared crotch bridge joins both leg openings to the existing pelvis rim.
front=rings[0][0]; back=rings[0][24]
crotch=[body.point((0,.251,z),(.5,.1),{'pelvis':1}) for z in [-.070,0,.070]]
right=rings[0][:25]+crotch
left=rings[0][24:]+[front]+list(reversed(crotch))
for suffix,s,opening in [('R',1,right),('L',-1,left)]:
    center=np.mean([body.v[i] for i in opening],axis=0)
    angles=[math.atan2(body.v[i][0]-center[0],body.v[i][2]-center[2]) for i in opening]
    last=opening
    profiles=[(.244,.111,.068,.088,.010),(.214,.119,.065,.080,.013),(.173,.122,.061,.076,.023),
              (.126,.123,.062,.084,.039),(.085,.126,.082,.115,.065),(.047,.125,.092,.128,.074),(.022,.125,.077,.103,.075)]
    for j,(cy,cx,rx,rz,cz) in enumerate(profiles):
        pts=[]
        for a in angles:
            dz=math.cos(a); toe=-.005*math.exp(-((abs(math.sin(a))-.34)/.10)**2)*max(0,dz)
            pts.append((s*cx+math.sin(a)*rx,cy,cz+dz*rz+toe))
        ring=body.ring(pts,lambda p:leg_weights(p,suffix),.05+j*.035); body.bridge(last,ring); last=ring
    body.f.append(tuple(reversed(last)))
body.f.append(tuple(rings[-1]))
for suffix,s,hole in [('R',1,ear_holes[0]),('L',-1,ear_holes[1])]:
    opening=boundary(rings,*hole); center=np.mean([body.v[i] for i in opening],axis=0)
    angles=[math.atan2((body.v[i][0]-center[0])*s,body.v[i][2]-center[2]) for i in opening]
    last=opening
    for j,(cy,cx,rx,rz,cz) in enumerate([(1.174,.240,.075,.041,.059),(1.226,.255,.064,.031,.048),
                                       (1.290,.264,.037,.020,.034),(1.333,.260,.016,.011,.025)]):
        pts=[(s*(cx+math.sin(a)*rx),cy,cz+math.cos(a)*rz) for a in angles]
        weight={'head':max(0,1-j*.48),'ear_'+suffix:min(1,j*.48)}
        ring=body.ring(pts,weight,.8+j*.035); body.bridge(last,ring); last=ring
    tip=body.point((s*.255,1.349,.021),(.8,1),{'ear_'+suffix:1})
    for i in range(len(last)): body.f.append((last[i],last[(i+1)%len(last)],tip))
body_ob=body.output(fur,sub=2,tint=True)

# Sewn hoodie control cage: sleeve boundary shares the torso vertices.
coat=Cage('CAT_HoodieSewn')
coat_rows=[(.280,.197,.139,-.012),(.293,.207,.148,-.012),(.32,.218,.158,-.008),
           (.39,.211,.157,-.006),(.46,.201,.143,-.004),(.51,.191,.127,-.002),
           (.565,.191,.123,0),(.62,.164,.110,0),(.65,.115,.094,.004)]
def cloth_folds(p,a,j):
    px,py,pz=p
    strength=math.sin(j/(len(coat_rows)-1)*math.pi)
    fold=(math.sin(a*8+py*23)*.0055+math.sin(a*3-py*8)*.004)*strength
    return (px+math.sin(a)*fold,py,pz+math.cos(a)*fold)
cr=loft(coat,coat_rows,48,body_weights,cloth_folds)
holes=[(4,7,10,14),(4,7,34,38)]
sew_loft(coat,cr,holes)
wrists=[]
for suffix,s,hole in [('R',1,holes[0]),('L',-1,holes[1])]:
    wrists.append((suffix,s,sleeve_branch(coat,boundary(cr,*hole),s,suffix)))
coat_ob=coat.output(cloth,sub=1,thickness=.0045,part='body')

# The hood is an open bowl with fabric thickness, not a closed skull or torus.
hood=Cage('CAT_HoodOpenShell'); hr=[]
for j,(rx,ry,zc,cy) in enumerate([(.340,.284,.105,.954),(.354,.298,.075,.954),(.374,.325,-.020,.950),
                                (.373,.335,-.145,.944),(.318,.302,-.270,.945),(.194,.200,-.335,.946),(.035,.041,-.358,.946)]):
    pts=[]
    for i in range(48):
        a=i/48*math.pi*2
        # Long broad folds converge behind the head; quieter at the face opening.
        fold=(.008*math.sin(a*5+j*.7)+.004*math.sin(a*9-j*.8))*math.sin(j/6*math.pi)
        pts.append((math.sin(a)*(rx+fold),cy+math.cos(a)*(ry+fold),zc-.022*max(0,math.cos(a))))
    hr.append(hood.ring(pts,lambda p:blend_y(p,[(.63,'chest'),(.71,'neck'),(.81,'head')]),j/6))
for a,b in zip(hr,hr[1:]): hood.bridge(a,b)
hood.f.append(tuple(hr[-1])); hood_ob=hood.output(cloth,sub=1,thickness=.005,part='head')

def ribbon(name,points,radii,mat,bone='head',part='head',n=6,sub=1,weight=None):
    cage=Cage(name); last=None
    for j,p in enumerate(points):
        tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
        tangent.normalize(); side=tangent.cross(Vector((0,0,1)))
        if side.length<.01: side=tangent.cross(Vector((0,1,0)))
        side.normalize(); other=tangent.cross(side).normalized()
        ring=cage.ring([tuple(Vector(p)+radii[j]*(math.cos(i/n*math.pi*2)*side+math.sin(i/n*math.pi*2)*other)) for i in range(n)],weight or {bone:1},j/(len(points)-1))
        if last: cage.bridge(last,ring)
        else: cage.f.append(tuple(reversed(ring)))
        last=ring
    cage.f.append(tuple(last)); return cage.output(mat,sub,part=part)

# Flat sewn rib bands inherit the existing wrist opening; no spherical cuffs.
trim=Cage('CAT_KnitBands')
for suffix,s,ring_ids in wrists:
    source=[coat.v[i] for i in ring_ids]; top=trim.ring([(x*1.006,y+.008,z*1.014) for x,y,z in source],{'elbow_'+suffix:1})
    bottom=trim.ring([(x*1.008,y-.012,z*1.018) for x,y,z in source],{'elbow_'+suffix:1},.2); trim.bridge(top,bottom)
bottom=[coat.v[i] for i in cr[0]]
top=trim.ring([(x*1.02,y+.019,z*1.02) for x,y,z in bottom],{'pelvis':1})
low=trim.ring([(x*1.025,y-.003,z*1.025) for x,y,z in bottom],{'pelvis':1},.2); trim.bridge(top,low)
trim.output(knit,1,.003,part='body')
# Fine stitches, hood centre seam and zipper. Curves are baked to the asset only.
zip_points=[(0,.298,.149),(0,.34,.160),(0,.43,.151),(0,.53,.125),(0,.635,.105)]
ribbon('CAT_Zipper',zip_points,[.0026]*5,thread,part='body',weight=body_weights)
ribbon('CAT_ZipperPull',[(0,.519,.133),(-.008,.507,.135),(0,.494,.136),(.008,.507,.135),(0,.519,.133)],[.0025]*5,thread,part='body',n=5,weight=body_weights)
ribbon('CAT_HoodBackSeam',[(0,.670,-.17),(0,.760,-.301),(0,.956,-.364),(0,1.14,-.280),(0,1.259,-.15)],[.0015]*5,thread,part='head')
for s in [-1,1]:
    ribbon('CAT_PocketSeam_'+str(s),[(s*.021,.335,.164),(s*.065,.356,.163),(s*.115,.388,.149),(s*.132,.405,.135)],[.0015]*4,thread,part='body',weight=body_weights)

# Anatomical detail meshes; the muzzle and toes are already part of BodyConnected.
def oval_cage(name,center,rx,ry,depth,mat,bone='head',nu=24,nv=12,part='head'):
    c=Cage(name); rings=[]
    for j in range(1,nv):
        b=j/nv*math.pi
        rings.append(c.ring([(center[0]+rx*math.sin(b)*math.cos(i/nu*2*math.pi),center[1]+ry*math.cos(b),center[2]+depth*math.sin(b)*math.sin(i/nu*2*math.pi)) for i in range(nu)],{bone:1},j/nv))
    for a,b in zip(rings,rings[1:]): c.bridge(a,b)
    for ring,pt,rev in [(rings[0],(center[0],center[1]+ry,center[2]),True),(rings[-1],(center[0],center[1]-ry,center[2]),False)]:
        tip=c.point(pt,(.5,.5),{bone:1})
        for i in range(nu): c.f.append((ring[(i+1)%nu],ring[i],tip) if rev else (ring[i],ring[(i+1)%nu],tip))
    return c.output(mat,0,part=part)
def disk(name,center,rx,ry,depth,mat,bone):
    c=Cage(name); rings=[]
    for j in range(9):
        r=1-j/9
        ring=[]
        for i in range(40):
            a=i/40*math.pi*2
            ring.append(c.point((center[0]+rx*r*math.cos(a),center[1]+ry*r*math.sin(a),center[2]+depth*(1-r*r)),(.5+.5*r*math.cos(a),.5+.5*r*math.sin(a)),{bone:1}))
        rings.append(ring)
    for a,b in zip(rings,rings[1:]): c.bridge(a,b)
    tip=c.point((center[0],center[1],center[2]+depth),(.5,.5),{bone:1})
    for i in range(40): c.f.append((rings[-1][i],rings[-1][(i+1)%40],tip))
    return c.output(mat,0)

for suffix,s in [('L',-1),('R',1)]:
    # Soft inner ear inset; thickness/subdivision, rounded tip and concave centre.
    c=Cage('CAT_InnerEar_'+suffix); er=[]
    for cy,width,cz in [(1.147,.045,.104),(1.188,.046,.096),(1.232,.036,.083),(1.275,.022,.064),(1.302,.007,.045)]:
        er.append([c.point((s*.25+t*width,cy,cz-.010*(1-t*t)),((t+1)/2,(cy-1.14)/.17),{'ear_'+suffix:1}) for t in [-1,-.5,0,.5,1]])
    for a,b in zip(er,er[1:]):
        for i in range(4): c.quad(a[i],a[i+1],b[i+1],b[i])
    c.output(pink,1,.002)
    eye='eye_'+suffix; closed='closed_'+suffix
    oval_cage('CAT_EyeGlobe_'+suffix,(s*.132,.991,.198),.085,.095,.039,sclera,eye,32,20)
    disk('CAT_Iris_'+suffix,(s*.132,.991,.235),.052,.057,.008,iris,eye)
    disk('CAT_Pupil_'+suffix,(s*.132,.991,.243),.031,.038,.003,pupil,eye)
    disk('CAT_Cornea_'+suffix,(s*.132,.991,.235),.068,.076,.014,cornea,eye)
    # Fitted lids, with a short upper-lid shadow; no thick painted brows.
    points=[]
    for t in np.linspace(-1,1,13):
        points.append((s*.132+t*.080,.991+.075*math.sqrt(max(0,1-t*t)),.215+.014*math.sqrt(max(0,1-t*t))))
    ribbon('CAT_UpperLid_'+suffix,points,[.002+.006*math.sin(i/12*math.pi) for i in range(13)],fur,eye)
    # With the eye hidden, the continuous facial surface is the closed eyelid.
    # A separate flat patch created a visible circular attachment in Sleep.
    pts=[(s*.132+t*.077,.988-.015*(1-t*t),.227+.008*(1-t*t)) for t in np.linspace(-1,1,9)]
    ribbon('CAT_ClosedLash_'+suffix,pts,[.0016]*9,lip,closed)
    oval_cage('CAT_FootPad_'+suffix,(s*.125,.024,.115),.036,.010,.034,pink,'foot_'+suffix,20,10,part='paws')
    # Organic curved whiskers, different lengths and sweep; six in total.
    for j in range(3):
        pts=[]
        for t in np.linspace(0,1,8):
            pts.append((s*(.085+(.178-j*.021)*t),.831-j*.018+(.029-j*.02)*t*t,.315-.095*t*t))
        ribbon('CAT_Whisker_'+suffix+str(j),pts,[.00125*(1-i/8)**.65 for i in range(8)],whisker,n=6,sub=1)
    for dx,yy0 in [(.063,.844),(.090,.831),(.064,.817)]:
        oval_cage('CAT_Follicle_'+suffix,(s*dx,yy0,.308),.0014,.0013,.001,lip,nu=8,nv=4)

# Rose nose is a soft shaped cage, tapered toward the philtrum.
c=Cage('CAT_Nose'); nr=[]
for cy,rx,rz,cz in [(.861,.022,.008,.317),(.853,.027,.013,.321),(.841,.023,.014,.324),(.831,.009,.006,.322)]:
    nr.append(c.ring([(rx*math.sin(i/16*math.pi*2),cy,cz+rz*math.cos(i/16*math.pi*2)) for i in range(16)],{'head':1}))
for a,b in zip(nr,nr[1:]): c.bridge(a,b)
c.f.append(tuple(reversed(nr[0]))); c.f.append(tuple(nr[-1])); c.output(nose,1)
for s in [-1,1]: oval_cage('CAT_Nostril',(s*.014,.841,.336),.003,.0015,.001,lip,nu=12,nv=6)
ribbon('CAT_Philtrum',[(0,.830,.322),(0,.817,.327),(0,.808,.326)],[.0016]*3,lip,'mouth_rest')
for s in [-1,1]:
    ribbon('CAT_RestSmile_'+str(s),[(0,.808,.326),(s*.018,.804,.325),(s*.037,.808,.318),(s*.047,.817,.304)],[.0017,.0021,.0018,.001],lip,'mouth_rest')
disk('CAT_OpenMouth',(0,.793,.304),.041,.032,.002,lip,'mouth_open')
disk('CAT_Tongue',(0,.778,.309),.024,.009,.001,pink,'mouth_open')

# A tapered tail with five deforming segments, natural pelvis root and soft tip.
tail=Cage('CAT_TailChain'); tr=[]
def catmull(points,t):
    segment=min(len(points)-2,int(t*(len(points)-1))); f=t*(len(points)-1)-segment
    p0=np.array(points[max(0,segment-1)]); p1=np.array(points[segment]); p2=np.array(points[segment+1]); p3=np.array(points[min(len(points)-1,segment+2)])
    return .5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f)
for j in range(33):
    t=j/32; p=catmull(tail_path,t); tangent=Vector(catmull(tail_path,min(1,t+.001))-catmull(tail_path,max(0,t-.001))).normalized()
    side=tangent.cross(Vector((0,1,0))).normalized(); other=tangent.cross(side).normalized()
    radius=.058*(1-t)**.57+.005
    npos=t*4; b=min(3,int(npos)); f=npos-b
    weights={'tail_'+str(b):1-f,'tail_'+str(b+1):f}
    tr.append(tail.ring([tuple(Vector(p)+(math.cos(i/16*math.pi*2)*side+math.sin(i/16*math.pi*2)*other)*radius) for i in range(16)],weights,t))
for a,b in zip(tr,tr[1:]): tail.bridge(a,b)
tail.f.append(tuple(reversed(tr[0]))); tail.f.append(tuple(tr[-1])); tail.output(fur,1,tint=True,part='tail')

# Coherent silhouette tufts: short tapered cards, normal aligned to the body.
# No random dark dots, stochastic triangles or dense film strand simulation.
groom=Cage('Groom_MASTER_Silhouette')
def tuft(p,normal,flow,length,weights,color=None):
    normal=Vector(normal).normalized(); direction=(Vector(flow).normalized()*.75+normal*.35).normalized()
    side=direction.cross(normal)
    if side.length<.001: side=direction.cross(Vector((0,0,1)))
    side.normalize(); base=Vector(p)+normal*.001
    a=groom.point(tuple(base-side*.0009),(.0,.0),weights); b=groom.point(tuple(base+side*.0009),(1,0),weights)
    mid=base+direction*length*.6
    c=groom.point(tuple(mid+side*.0006),(1,.6),weights); d=groom.point(tuple(mid-side*.0006),(0,.6),weights)
    e=groom.point(tuple(base+direction*length),(0.5,1),weights)
    groom.quad(a,b,c,d); groom.f.append((d,c,e))
for s in [-1,1]:
    for j in range(56):
        t=j/55; py=.795+t*.29; px=s*(.275+.030*math.sin(t*math.pi)); pz=.04+.08*math.sin(t*math.pi)
        for k in range(3): tuft((px,py,pz-k*.022),(s,0,.15),(s*.4,-1,-.12),.008+.006*math.sin(t*math.pi),{'head':1})
    for j in range(30):
        t=j/29; py=1.16+t*.17; px=s*(.24+.071*(1-t)); pz=.051
        tuft((px,py,pz),(s,.2,.2),(s*.1,1,0),.006,{'ear_'+('L' if s<0 else 'R'):1})
for j in range(100):
    t=j/100; p=catmull(tail_path,t); radius=.058*(1-t)**.57+.005
    for a in [0,math.pi/2,math.pi,math.pi*1.5]:
        n=Vector((math.cos(a),math.sin(a),0)); point=Vector(p)+n*radius
        b=min(4,int(t*4)); tuft(point,n,(0,.65,-.2),.006,{'tail_'+str(b):1})
groom_ob=groom.output(groom_material,0,tint=True)
# Ribbon lighting follows fur, not the thin card face: avoids black speckles.
custom=[]
for loop in groom_ob.data.loops:
    p=design(groom_ob.data.vertices[loop.vertex_index].co)
    n=Vector((p[0],(p[1]-.94)*.25,max(.05,p[2]))).normalized()
    custom.append(xyz(n))
groom_ob.data.normals_split_custom_set(custom)
groom_ob.data.materials[0].use_backface_culling=True

# Bake subdivision/thickness for web export; preserve editable cages in .blend.
scene=bpy.context.scene; scene.render.fps=24
rig.animation_data_create(); bones=rig.pose.bones
for b in bones: b.rotation_mode='XYZ'
durations={'idle':4.4,'happy':2.8,'wave':2.8,'jump':1.7,'run':.85,'sleep':4.8,'roar':2}
for action_name,duration in durations.items():
    action=bpy.data.actions.new(action_name); rig.animation_data.action=action
    frames=round(duration*24)
    for frame in range(frames+1):
        t=frame/frames*duration; phase=t/duration*2*math.pi
        for b in bones: b.location=(0,0,0); b.rotation_euler=(0,0,0); b.scale=(1,1,1)
        bones['chest'].scale=(1+.004*math.sin(phase*2),1+.005*math.sin(phase*2),1+.006*math.sin(phase*2))
        bones['head'].rotation_euler=(.015*math.sin(phase),.015*math.sin(phase),.042*math.sin(phase))
        bones['pelvis'].rotation_euler.z=.015*math.sin(phase)
        for i in range(5): bones['tail_'+str(i)].rotation_euler.z=.045*math.sin(phase*2-i*.5)
        for suffix,s in [('L',-1),('R',1)]: bones['ear_'+suffix].rotation_euler.z=s*.022*math.sin(phase*2)
        closed=action_name=='sleep' or (1.72<t<1.86)
        for suffix in ['L','R']:
            bones['eye_'+suffix].scale=(.001,.001,.001) if closed else (1,1,1)
            bones['closed_'+suffix].scale=(1,1,1) if closed else (.001,.001,.001)
            bones['eye_'+suffix].location.x=.0016*math.sin(phase)
        bones['mouth_open'].scale=(.001,.001,.001)
        if action_name=='happy':
            bounce=max(0,math.sin(phase*2)); bones['root'].location.y=.025*bounce
            bones['head'].rotation_euler.z=.10*math.sin(phase*2)
            bones['mouth_rest'].scale=(.001,.001,.001); bones['mouth_open'].scale=(1,.60,1)
            for suffix,s in [('L',-1),('R',1)]: bones['arm_'+suffix].rotation_euler.z=s*(.18+.20*bounce)
        if action_name=='wave':
            bones['arm_R'].rotation_euler.z=1.72+.06*math.sin(phase*2)
            bones['elbow_R'].rotation_euler.z=.28+.30*math.sin(phase*4)
            bones['paw_R'].rotation_euler.z=.14*math.sin(phase*4)
            bones['shoulder_R'].rotation_euler.z=.08
            bones['head'].rotation_euler.z=-.08
        if action_name=='jump':
            anticipation=math.sin(math.pi*t/.28) if t<.28 else 0
            air=max(0,math.sin(math.pi*(t-.28)/.72)) if .28<t<1 else 0
            land=max(0,math.sin(math.pi*(t-1)/.24)) if 1<t<1.24 else 0
            squash=.08*anticipation+.06*land
            bones['root'].location.y=.29*air-.02*(anticipation+land)
            bones['spine'].scale=(1+squash,1+squash,1-squash)
            for suffix,s in [('L',-1),('R',1)]:
                bones['arm_'+suffix].rotation_euler.z=s*(.13+.7*air)
                bones['leg_'+suffix].rotation_euler.x=-.24*anticipation+.15*air
                bones['knee_'+suffix].rotation_euler.x=.40*anticipation+.20*air+.3*land
        if action_name=='run':
            stride=math.sin(phase); bones['root'].location.y=.025*(1-math.cos(phase*2))
            bones['chest'].rotation_euler.x=.08
            for suffix,s in [('L',-1),('R',1)]:
                bones['arm_'+suffix].rotation_euler.x=.48*s*stride
                bones['arm_'+suffix].rotation_euler.z=.13*s
                bones['elbow_'+suffix].rotation_euler.x=-.28
                bones['leg_'+suffix].rotation_euler.x=-.50*s*stride
                bend=.10+.72*max(0,s*stride); bones['knee_'+suffix].rotation_euler.x=bend
                bones['foot_'+suffix].rotation_euler.x=-bend*.55
        if action_name=='sleep':
            # Seated, folded doze. No camera trick or whole-model tip onto its face.
            bones['root'].location.y=-.045
            bones['pelvis'].rotation_euler.x=-.12
            bones['spine'].rotation_euler.x=.12
            bones['neck'].rotation_euler.x=.16
            bones['head'].rotation_euler.x=.17; bones['head'].rotation_euler.z=.13
            for suffix,s in [('L',-1),('R',1)]:
                bones['leg_'+suffix].rotation_euler.x=-.52
                bones['knee_'+suffix].rotation_euler.x=.80
                bones['foot_'+suffix].rotation_euler.x=-.28
                bones['arm_'+suffix].rotation_euler.z=-s*.10
                bones['elbow_'+suffix].rotation_euler.x=-.24
            for i in range(5): bones['tail_'+str(i)].rotation_euler.z=.08*math.sin(phase-i*.3)
        if action_name=='roar':
            e=.5-.5*math.cos(phase); bones['head'].rotation_euler.x=-.12*e
            bones['mouth_rest'].scale=(.001,.001,.001); bones['mouth_open'].scale=(1,.7+.3*e,1)
            for suffix,s in [('L',-1),('R',1)]: bones['arm_'+suffix].rotation_euler.z=s*(.18+.22*e)
        for b in bones:
            b.keyframe_insert('location',frame=frame+1); b.keyframe_insert('rotation_euler',frame=frame+1); b.keyframe_insert('scale',frame=frame+1)
    rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new(); track.name=action_name
    strip=track.strips.new(action_name,1,action); strip.action_frame_end=frames+1; track.mute=True
for b in bones: b.location=(0,0,0); b.rotation_euler=(0,0,0); b.scale=(1,1,1)
for name in ['closed_L','closed_R','mouth_open']: bones[name].scale=(.001,.001,.001)
rig['designVersion']=7; rig['assetPipeline']='Connected subdivision cages / sewn garment / UV PBR / weighted skeleton'
rig['approval']='REVIEW_CANDIDATE_NOT_APPROVED'
scene['CAT_quality_gate']='Eight directions and seven clips; user art approval remains required'
scene['source_note']='Algorithmically authored control topology; not a manual artist sculpt and not imported from a third-party character'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'milo-master.blend'))

# Export this saved source. Subsequent artist edits use export-cat-master.py directly.
import runpy
runpy.run_path(str(ROOT/'scripts/export-cat-master.py'),run_name='__main__')
