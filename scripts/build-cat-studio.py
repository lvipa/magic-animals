"""Authored CAT benchmark asset. Run in portable Blender, not in the game runtime.

Editable sculpt surfaces, groom meshes, PBR maps, skeletal rig and seven clips.
Coordinates in the design are x/right, y/up, z/front; Blender uses z/up.
"""
import bpy, math, random, sys
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/characters/cat'
SOURCE.mkdir(parents=True, exist_ok=True)
TEXTURES = SOURCE / 'textures'
TEXTURES.mkdir(exist_ok=True)
random.seed(7349)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def coord(p): return (p[0], -p[2], p[1])
def image(name, rgb, data=False):
    rgba = np.ones((rgb.shape[0], rgb.shape[1], 4),dtype=np.float32)
    rgba[:,:,:3] = np.clip(rgb,0,1)
    img = bpy.data.images.new(name,width=rgb.shape[1],height=rgb.shape[0])
    if data: img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = str(TEXTURES / (name + '.png'))
    img.file_format = 'PNG'
    img.save()
    img.pack()
    return img

size = 512
y,x = np.mgrid[:size,:size].astype(np.float32)/size
rng = np.random.default_rng(743)
grain = rng.random((size,size))
weave = np.sin(x*math.pi*256)*np.sin(y*math.pi*256)
threads = .5 + .5*np.sin(x*math.pi*128 + np.sin(y*math.pi*256)*.4)
fabric_rgb = np.stack([.48+weave*.045+grain*.025,.27+weave*.026+grain*.016,.58+weave*.048+grain*.025],axis=-1)
fabric_color = image('lilac-woven-fabric',fabric_rgb)
fabric_rough = image('cloth-roughness',np.repeat((.78+threads*.15+grain*.04)[:,:,None],3,axis=2),True)
height = weave*.035+threads*.012+grain*.008
dy,dx = np.gradient(height)
normal = np.stack([-dx*3,-dy*3,np.ones_like(dx)],axis=-1)
normal /= np.linalg.norm(normal,axis=-1)[:,:,None]
fabric_normal = image('woven-normal',normal*.5+.5,True)
fur_flow = np.sin(x*math.pi*420 + np.sin(y*13)*3)*.025+grain*.035
fur_normal = image('short-fur-normal',np.stack([.5+fur_flow,.5+np.sin(y*math.pi*220)*.025,np.ones_like(x)],axis=-1),True)
fur_rough = image('fur-roughness',np.repeat((.81+grain*.16)[:,:,None],3,axis=2),True)
# Radial iris fibers, limbal ring and subtle inner amber flecks.
xx,yy = x*2-1,y*2-1
radius = np.sqrt(xx*xx+yy*yy)
angle = np.arctan2(yy,xx)
fibers = .5+.5*np.sin(angle*150+radius*36 + np.sin(angle*53)*2)
ring = np.clip((1-radius)*7,0,1)
iris_rgb = np.stack([.16+fibers*.10,.46+fibers*.18,.60+fibers*.16],axis=-1)*(.72+.28*ring[:,:,None])
iris_color = image('blue-iris-fibers',iris_rgb)

def material(name,color,rough=.8,sheen=0,coat=0,vertex=False,maps=None):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    mat.diffuse_color=(*color,1)
    nodes=mat.node_tree.nodes; links=mat.node_tree.links
    bs=nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough
    bs.inputs['Sheen Weight'].default_value=sheen
    bs.inputs['Coat Weight'].default_value=coat
    bs.inputs['Coat Roughness'].default_value=.04
    if vertex:
        node=nodes.new('ShaderNodeVertexColor'); node.layer_name='FurTint'
        links.new(node.outputs['Color'],bs.inputs['Base Color'])
    if maps:
        for purpose,img in maps.items():
            node=nodes.new('ShaderNodeTexImage'); node.image=img
            if purpose=='normal':
                n=nodes.new('ShaderNodeNormalMap'); n.inputs['Strength'].default_value=.45
                links.new(node.outputs['Color'],n.inputs['Color']); links.new(n.outputs['Normal'],bs.inputs['Normal'])
            else: links.new(node.outputs['Color'],bs.inputs[purpose])
    return mat

fur=material('Warm groom · matte fibers',(.39,.32,.27),.88,.8,vertex=True,maps={'normal':fur_normal,'Roughness':fur_rough})
hair=material('Individual groom fibers',(.45,.36,.30),.93,.65,vertex=True)
hair.use_backface_culling=True
cloth=material('Lilac woven hoodie',(.48,.27,.58),.86,.65,maps={'Base Color':fabric_color,'normal':fabric_normal,'Roughness':fabric_rough})
rib=material('Lilac rib knit trim',(.47,.27,.56),.92,.8,maps={'normal':fabric_normal})
stitch=material('Soft cream stitching',(.72,.60,.55),.82,.35)
pink=material('Soft warm inner ear',(.67,.32,.34),.82,.25)
cream=material('Cream muzzle',(.76,.66,.52),.85,.75,vertex=True,maps={'normal':fur_normal})
nosemat=material('Velvet pink nose',(.49,.15,.19),.42,0,.2)
ink=material('Pupil and lips',(.012,.009,.015),.23,0,.55)
white=material('Warm sclera',(.86,.83,.77),.12,0,.65)
iris=material('Blue radial iris',(.18,.44,.58),.15,0,.8,maps={'Base Color':iris_color})
cornea=material('Wet cornea highlights',(.95,.97,1),.025,0,1)

# One armature; every surface is a skinned mesh. All assets remain editable.
armdata=bpy.data.armatures.new('Milo skeletal rig')
arm=bpy.data.objects.new('Milo_Rig',armdata)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
spec=[('root',(0,0,0),None),('body',(0,.34,0),'root'),('head',(0,.85,0),'body'),
      ('arm_L',(-.205,.56,.015),'body'),('arm_R',(.205,.56,.015),'body'),
      ('elbow_L',(-.25,.39,.025),'arm_L'),('elbow_R',(.25,.39,.025),'arm_R'),
      ('leg_L',(-.16,.29,.015),'root'),('leg_R',(.16,.29,.015),'root'),
      ('knee_L',(-.16,.17,.035),'leg_L'),('knee_R',(.16,.17,.035),'leg_R'),
      ('foot_L',(-.16,.085,.045),'knee_L'),('foot_R',(.16,.085,.045),'knee_R'),
      ('ear_L',(-.23,1.1,0),'head'),('ear_R',(.23,1.1,0),'head'),
      ('tail',(0,.19,-.14),'body'),('eye_L',(-.125,.99,.25),'head'),('eye_R',(.125,.99,.25),'head'),
      ('closed_L',(-.125,.99,.25),'head'),('closed_R',(.125,.99,.25),'head'),
      ('mouth_open',(0,.845,.31),'head'),('mouth_rest',(0,.845,.31),'head')]
for name,origin,parent in spec:
    bone=armdata.edit_bones.new(name); bone.head=coord(origin)
    bone.tail=Vector(bone.head)+Vector((0,0,.08))
    if parent: bone.parent=armdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
arm.select_set(False)

def mesh(name,verts,faces,mat,bone,uv=None,colors=None,part='head',custom_normals=None):
    if colors is None and mat in [fur,cream]:
        colors=[(.23,.18,.20) if mat==fur else (.79,.69,.54)]*len(verts)
    data=bpy.data.meshes.new(name)
    data.from_pydata([coord(v) for v in verts],[],faces); data.update()
    ob=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    for poly in data.polygons: poly.use_smooth=True
    if custom_normals:
        data.normals_split_custom_set([coord(custom_normals[loop.vertex_index]) for loop in data.loops])
    if uv:
        layer=data.uv_layers.new(name='UVMap')
        for loop in data.loops: layer.data[loop.index].uv=uv[loop.vertex_index]
    if colors:
        attr=data.color_attributes.new(name='FurTint',type='FLOAT_COLOR',domain='POINT')
        for i,c in enumerate(colors): attr.data[i].color=(*c,1)
    vg=ob.vertex_groups.new(name=bone)
    # Blend the sleeve across the elbow and the trouser leg across the knee.
    # The joint stays closed as it bends; cuffs and paws follow the forearm.
    joint = ('elbow_'+bone[-1],.39,.075) if name.startswith('Sleeve_') else ('knee_'+bone[-1],.17,.045) if name.startswith('Trouser_leg_') else None
    if joint:
        lower=ob.vertex_groups.new(name=joint[0])
        for i,p in enumerate(verts):
            w=max(0,min(1,(joint[1]+joint[2]-p[1])/(joint[2]*2)))
            if w<1: vg.add([i],1-w,'REPLACE')
            if w>0: lower.add([i],w,'REPLACE')
    else: vg.add(list(range(len(verts))),1,'REPLACE')
    ob.parent=arm
    mod=ob.modifiers.new('Skeletal deformation','ARMATURE'); mod.object=arm
    ob['part']=part
    return ob

def surface(name,fn,mat,bone,nu=64,nv=36,tint=None,part='head'):
    verts=[]; uv=[]; faces=[]; colors=[]
    for j in range(nv+1):
        v=j/nv
        for i in range(nu+1):
            u=i/nu; p=fn(u,v); verts.append(p); uv.append((u,v))
            if tint: colors.append(tint(p,u,v))
    for j in range(nv):
        for i in range(nu):
            a=j*(nu+1)+i; faces.append((a,a+1,a+nu+2,a+nu+1))
    return mesh(name,verts,faces,mat,bone,uv,colors or None,part)

def ellipsoid(center,radii):
    def fn(u,v):
        a=u*2*math.pi; b=v*math.pi
        return (center[0]+radii[0]*math.sin(b)*math.cos(a),center[1]+radii[1]*math.cos(b),center[2]+radii[2]*math.sin(b)*math.sin(a))
    return fn

def headform(u,v):
    px,py,pz=ellipsoid((0,.96,.015),(.333,.302,.265))(u,v)
    if pz>0:
        # Sculpt cheek cushions into the continuous face, soften forehead and jaw.
        cheek=math.exp(-((abs(px)-.135)/.095)**2-((py-.875)/.11)**2)
        pz+=.03*cheek
        px*=1+.045*math.exp(-((py-.855)/.10)**2)
        socket=sum(math.exp(-((px-s*.125)/.095)**2-((py-.99)/.104)**2) for s in [-1,1])
        pz-=socket*.064
    return (px,py,pz)

def furcolor(p,u,v):
    px,py,pz=p
    chin=math.exp(-(px/.23)**4-((py-.845)/.11)**2)*max(0,min(1,pz*6))*max(0,min(1,(.94-py)*8))
    base=np.array([.23,.18,.20])*(1-chin)+np.array([.48,.39,.35])*chin
    stripes=(.5+.5*math.sin(u*math.pi*12+v*10))**12
    weight=.06*stripes*max(0,min(1,(py-1.0)*7))
    return tuple(base*(1-weight))

surface('Sculpted continuous head',headform,fur,'head',80,48,furcolor)

def groom(name,fn,bone,count,tint,part='head',length=.009):
    verts=[]; faces=[]; colors=[]; normals=[]
    for k in range(count):
        u=random.random(); v=.045+random.random()*.91
        p=np.array(fn(u,v)); px,py,pz=p
        # Keep the eyelids, nose and mouth clear. Cheek whisker beds stay fluffy.
        if part=='head' and pz>0:
            eye_clear=any(abs(px-side*.129)<.106 and abs(py-.997)<.103 for side in [-1,1])
            muzzle_clear=abs(px)<.151 and .77<py<.947
            if eye_clear or muzzle_clear: continue
        eps=.001
        du=np.array(fn(u+eps,v))-p; dv=np.array(fn(u,min(.999,v+eps)))-p
        normal=np.cross(dv,du); normal/=np.linalg.norm(normal)+1e-8
        # Determine outward normal robustly from the head center.
        center=np.array([0,.96,.015]) if part=='head' else np.array([0,.25,0])
        if np.dot(normal,p-center)<0: normal=-normal
        flow=dv/(np.linalg.norm(dv)+1e-8)
        direction=normal*.65+flow*.76; direction/=np.linalg.norm(direction)+1e-8
        width=.0007+random.random()*.00045
        side=np.cross(direction,normal+np.array([.02,.01,.03])); side/=np.linalg.norm(side)+1e-8
        long=length*(.65+random.random()*.85)
        if part=='head' and abs(px)>.24: long*=1.7
        start=p+normal*.0012
        mid=start+direction*long*.58
        end=start+direction*long+normal*long*.12
        b=len(verts)
        verts.extend([tuple(start-side*width),tuple(start+side*width),tuple(mid-side*width*.55),tuple(mid+side*width*.55),tuple(end)])
        normals.extend([tuple(normal)]*5)
        faces.extend([(b,b+1,b+3,b+2),(b+2,b+3,b+4)])
        c=np.array(tint(tuple(p),u,v))*(.96+random.random()*.08)
        colors.extend([tuple(c),tuple(c),tuple(c),tuple(c),tuple(c)])
    return mesh(name,verts,faces,hair,bone,colors=colors,part=part,custom_normals=normals)

groom('Groom_HIGH_head',headform,'head',9000,furcolor)
groom('Groom_LOW_head',headform,'head',1700,furcolor)

def torso(u,v):
    yy=.205+v*.475; a=u*math.pi*2
    profile=.095+.16*math.sin((.15+.7*v)*math.pi)
    wrinkle=1+.016*math.sin(a*11+v*25)*math.sin(v*math.pi)**2
    return (profile*math.cos(a)*wrinkle,yy,.18*math.sin(a)*wrinkle-.022)
surface('Tailored hoodie with folds',torso,cloth,'body',64,36,part='body')

def tube(name,points,radii,mat,bone,part='head',segments=10):
    verts=[]; faces=[]; uv=[]
    for j,pt in enumerate(points):
        tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
        tangent.normalize(); right=tangent.cross(Vector((0,0,1)))
        if right.length<.001: right=tangent.cross(Vector((0,1,0)))
        right.normalize(); up=tangent.cross(right).normalized()
        for i in range(segments+1):
            a=i/segments*math.pi*2
            p=Vector(pt)+(right*math.cos(a)+up*math.sin(a))*radii[j]
            verts.append(tuple(p)); uv.append((i/segments,j/(len(points)-1)))
    for j in range(len(points)-1):
        for i in range(segments):
            a=j*(segments+1)+i; faces.append((a,a+1,a+segments+2,a+segments+1))
    faces.append(tuple(range(segments,-1,-1)))
    faces.append(tuple((len(points)-1)*(segments+1)+i for i in range(segments+1)))
    return mesh(name,verts,faces,mat,bone,uv,part=part)

def ring(name,center,rx,ry,rz,mat,bone,part='body'):
    points=[(center[0]+rx*math.cos(i/64*math.pi*2),center[1]+ry*math.sin(i/64*math.pi*2),center[2]+rz*math.sin(i/64*math.pi*2)) for i in range(65)]
    return tube(name,points,[.008]*65,mat,bone,part,8)

# Hood behind the head, with fabric UVs and a soft stitched rim.
surface('Seamless fabric hood',ellipsoid((0,.96,-.105),(.355,.315,.245)),cloth,'head',64,40)
ring('Hoodie ribbed hem',(0,.212,-.022),.187,0,.148,rib,'body')
surface('Padded hoodie collar',ellipsoid((0,.661,.035),(.210,.064,.190)),rib,'body',48,20,part='body')
tube('Front zipper seam',[(0,.231,.151),(0,.34,.174),(0,.48,.169),(0,.59,.142)],[.003]*4,stitch,'body','body',6)
surface('Soft zipper pull',ellipsoid((0,.49,.177),(.012,.022,.008)),stitch,'body',20,12,part='body')
for s in [-1,1]:
    tube('Hoodie drawstring_'+str(s),[(s*.09,.62,.153),(s*.096,.55,.177),(s*.097,.46,.188)],
         [.003,.003,.002],stitch,'body','body',6)
for s in [-1,1]:
    def sleeve(u,v,s=s):
        a=u*2*math.pi; b=v*math.pi; y=.395+.165*math.cos(b)
        return (s*(.205+(.56-y)*.27)+.073*math.sin(b)*math.cos(a),y,.025+.077*math.sin(b)*math.sin(a))
    surface('Sleeve_'+str(s),sleeve,cloth,'arm_L' if s<0 else 'arm_R',40,24,part='body')
    surface('Knitted cuff_'+str(s),ellipsoid((s*.289,.235,.035),(.073,.024,.081)),rib,
            'elbow_L' if s<0 else 'elbow_R',32,16,part='body')
    pawfn=ellipsoid((s*.30,.18,.045),(.071,.064,.078))
    surface('Front_paw_'+str(s),pawfn,fur,'elbow_L' if s<0 else 'elbow_R',40,24,lambda p,u,v:(.34,.26,.26),part='paws')
    surface('Soft thumb_'+str(s),ellipsoid((s*.246,.18,.078),(.026,.032,.037)),fur,'elbow_L' if s<0 else 'elbow_R',32,20,lambda p,u,v:(.34,.26,.26),part='paws')
    surface('Palm bean_'+str(s),ellipsoid((s*.30,.174,.120),(.029,.029,.004)),pink,'elbow_L' if s<0 else 'elbow_R',24,16,part='paws')
    surface('Trouser_leg_'+str(s),ellipsoid((s*.16,.19,.025),(.075,.115,.080)),cloth,'leg_L' if s<0 else 'leg_R',40,28,part='body')
    surface('Ankle_cuff_'+str(s),ellipsoid((s*.16,.11,.045),(.077,.022,.084)),rib,'knee_L' if s<0 else 'knee_R',32,16,part='body')
    footfn=ellipsoid((s*.16,.068,.065),(.099,.069,.125))
    surface('Foot_'+str(s),footfn,fur,'foot_L' if s<0 else 'foot_R',40,24,lambda p,u,v:(.34,.26,.26),part='paws')
    padfn=ellipsoid((s*.16,.064,.183),(.043,.032,.012))
    surface('Bean_pad_'+str(s),padfn,pink,'foot_L' if s<0 else 'foot_R',24,12,part='paws')
    for dx in [-.037,0,.037]:
        surface('Toe_bean',ellipsoid((s*.16+dx,.105,.164),(.013,.012,.009)),pink,'foot_L' if s<0 else 'foot_R',16,10,part='paws')
    # Authored triangular ear shell: rounded base tapering to a soft tip.
    def earfn(u,v,s=s):
        a=u*math.pi*2; yy=1.125+v*.265
        width=.103*(1-v)**.74+.005
        return (s*(.213+v*.025)+math.cos(a)*width,yy,-.007+math.sin(a)*(.042*(1-v)+.008))
    bone='ear_L' if s<0 else 'ear_R'
    surface('Furred_ear_'+str(s),earfn,fur,bone,40,24,lambda p,u,v:(.27,.21,.23))
    def inner(u,v,s=s):
        t=u*math.pi*2; r=math.sin(v*math.pi)*(.056*(1-v)+.007)
        return (s*(.213+v*.025)+r*math.cos(t),1.152+v*.187,-.002+(.043*(1-v)+.012)*abs(math.sin(t)))
    surface('Ear_inner_'+str(s),inner,pink,bone,32,24)
    # Eye globes, convex iris, pupil, lid rims and independent corneal catchlights.
    eye_bone='eye_L' if s<0 else 'eye_R'
    center=(s*.129,.997,.202)
    surface('Eye_globe_'+str(s),ellipsoid(center,(.078,.083,.040)),white,eye_bone,48,32)
    def discfn(u,v,s=s):
        a=u*math.pi*2; r=(1-v)*.049
        return (s*.129+r*math.cos(a),.997+r*math.sin(a),.239+.008*(1-(r/.049)**2))
    ob=surface('Iris_'+str(s),discfn,iris,eye_bone,64,16)
    # Iris map uses radial disk UVs, so its fibers are visible at any viewing angle.
    uv=ob.data.uv_layers.active
    for loop in ob.data.loops:
        p=ob.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=((p.x-s*.129)/.098+.5,(p.z-.997)/.098+.5)
    surface('Pupil_'+str(s),ellipsoid((s*.129,.997,.249),(.030,.037,.006)),ink,eye_bone,40,24)
    rim=[(s*.129+.079*math.cos(i/64*math.pi*2),.997+.085*math.sin(i/64*math.pi*2),.207+.009*abs(math.sin(i/64*math.pi*2))) for i in range(65)]
    tube('Lid_rim_'+str(s),rim,[.0045]*65,fur,eye_bone,segments=8)
    upper=[(s*.129+t*.076,.997+.061+.018*math.cos(t*math.pi/2),.234)
           for t in [-1,-.75,-.5,-.25,0,.25,.5,.75,1]]
    tube('Soft upper eyelid_'+str(s),upper,[.009,.011,.013,.014,.014,.014,.013,.011,.009],
         fur,eye_bone,segments=8)
    for dx,dy,rr in [(-.016,.020,.008),(.014,-.011,.003)]:
        surface('Corneal_glint',ellipsoid((s*.129+dx,.997+dy,.256),(rr,rr*.85,.002)),cornea,eye_bone,20,12)
    # A closed smile eye replaces the open globe during Sleep and selected Happy frames.
    pts=[]
    for t in [-1,-.5,0,.5,1]:
        px=s*.123+t*.072; py=.992+.032*math.sin((t+1)*math.pi/2)
        pz=.015+.265*math.sqrt(max(0,1-(px/.333)**2-((py-.96)/.302)**2))
        pz+=.03*math.exp(-((abs(px)-.135)/.095)**2-((py-.875)/.11)**2)
        pz-=.064*sum(math.exp(-((px-side*.125)/.095)**2-((py-.99)/.104)**2) for side in [-1,1])
        pts.append((px,py,pz+.004))
    tube('Closed_eye_'+str(s),pts,[.004]*5,ink,'closed_L' if s<0 else 'closed_R',segments=6)
    eyebrow=[(s*.123+t*.07,1.145+.015*math.cos(t*math.pi/2),.235) for t in [-1,-.5,0,.5,1]]
    tube('Soft_brow_'+str(s),eyebrow,[.004,.006,.007,.006,.003],fur,'head',segments=8)
    # Cream whisker cushions, with short fine individual whiskers.
    for i in range(3):
        tube('Fine_whisker',[(s*.12,.875-i*.022,.301),(s*.211,.894-i*.029,.270),(s*.29,.916-i*.04,.209)], [.0013,.001,.00025],cream,'head',segments=5)

# One softly sculpted muzzle, with a broad readable smile and cheek dimples.
def muzzleform(u,v):
    px,py,pz=ellipsoid((0,.859,.267),(.127,.079,.045))(u,v)
    if pz>.267:
        pz+=.007*math.exp(-((abs(px)-.060)/.035)**2-((py-.88)/.035)**2)
    return (px,py,pz)
surface('Continuous cream muzzle',muzzleform,cream,'head',64,36,lambda p,u,v:(.79,.70,.60))

# A curved, tapering tail; groom follows its flow.
points=[]
for i in range(33):
    t=i/32
    points.append((.045+.42*math.sin(t*math.pi*.6),.18+.39*t-.08*math.sin(t*math.pi),-.13-.065*math.sin(t*math.pi)))
tube('Curved_cat_tail',points,[.072*(1-i/38) + .012 for i in range(33)],fur,'tail','tail',16)
for i in range(3):
    t=.90+i*.025
    p=(.045+.42*math.sin(t*math.pi*.6),.18+.39*t-.08*math.sin(t*math.pi),-.13-.065*math.sin(t*math.pi))
    surface('Tail_tip',ellipsoid(p,(.038,.042,.038)),fur,'tail',24,16,lambda p,u,v:(.25,.19,.21),part='tail')
surface('Tiny heart nose',ellipsoid((0,.887,.317),(.027,.020,.020)),nosemat,'head',40,24)
for s in [-1,1]:
    surface('Nostril',ellipsoid((s*.015,.883,.334),(.004,.002,.002)),ink,'head',16,8)
tube('Philtrum',[(0,.872,.321),(0,.849,.317)],[.0028,.0028],ink,'mouth_rest',segments=6)
def smiling_mouth(u,v):
    a=u*2*math.pi; r=1-v; px=.055*r*math.cos(a)
    return (px,.824+.024*r*math.sin(a)+.005*(px/.055)**2,.315+.003*v)
surface('Friendly smile cavity',smiling_mouth,ink,'mouth_rest',48,20)
surface('Smile tongue',ellipsoid((0,.810,.320),(.028,.010,.002)),pink,'mouth_rest',32,16)
surface('Little upper tooth',ellipsoid((-.013,.844,.321),(.009,.006,.002)),white,'mouth_rest',24,12)
for s in [-1,1]:
    tube('Smile dimple',[(s*.051,.831,.316),(s*.061,.840,.311),(s*.065,.850,.306)],[.0023]*3,ink,'mouth_rest',segments=6)
surface('Open playful mouth',ellipsoid((0,.827,.315),(.069,.044,.006)),ink,'mouth_open',48,28)
surface('Pink tongue',ellipsoid((0,.804,.322),(.034,.014,.002)),pink,'mouth_open',32,20)

# Skeletal clips: all bone transforms keyed in one NLA track per animation.
scene=bpy.context.scene
scene.render.fps=24
scene.frame_start=1; scene.frame_end=145
arm.animation_data_create()
bones=arm.pose.bones
for b in bones: b.rotation_mode='XYZ'
actions=['idle','happy','wave','jump','run','sleep','roar']
for action_name in actions:
    action=bpy.data.actions.new(action_name)
    arm.animation_data.action=action
    duration={'idle':4.4,'happy':2.8,'wave':2.8,'jump':1.7,'run':.85,'sleep':4.8,'roar':2.0}[action_name]
    frames=round(duration*24)
    for frame in range(frames+1):
        t=frame/frames*duration
        phase=t*2*math.pi/duration
        for b in bones:
            b.location=(0,0,0); b.rotation_euler=(0,0,0); b.scale=(1,1,1)
        bones['body'].scale=(1+math.sin(phase*2)*.006,1+math.sin(phase*2)*.006,1+math.sin(phase*2)*.011)
        bones['head'].rotation_euler=(math.sin(phase)*.025,math.sin(phase)*.022,math.sin(phase)*.10)
        bones['tail'].rotation_euler=(0,math.sin(phase*2)*.12,math.sin(phase*2)*.18)
        for name,s in [('ear_L',-1),('ear_R',1)]: bones[name].rotation_euler=(0,s*math.sin(phase*2)*.035,0)
        blink=.08 if action_name=='sleep' else (1-.95*math.sin(t/.16*math.pi) if t<.16 else 1)
        happy=action_name=='happy'
        closed=action_name=='sleep' or (happy and math.sin(phase*2)>.3)
        for name in ['eye_L','eye_R']: bones[name].scale=(.001,.001,.001) if closed else (1,1,blink)
        for name in ['closed_L','closed_R']: bones[name].scale=(1,1,1) if closed else (.001,.001,.001)
        bones['mouth_open'].scale=(.001,.001,.001)
        if happy:
            bounce=max(0,math.sin(phase*3))
            bones['root'].location.y=bounce*.045
            bones['body'].rotation_euler.y=math.sin(phase*2)*.16
            bones['head'].rotation_euler.z=math.sin(phase*2)*.16
            for suffix,s in [('L',-1),('R',1)]:
                bones['arm_'+suffix].rotation_euler.z=s*(.45+bounce*.40)
                bones['elbow_'+suffix].rotation_euler.z=s*.3
        if action_name=='wave':
            # Local Z is the front axis. Local Y twists along the vertical bone.
            bones['arm_R'].rotation_euler.z=1.9+.12*math.sin(phase*3)
            bones['elbow_R'].rotation_euler.z=.45+.42*math.sin(phase*4)
            bones['arm_L'].rotation_euler.z=-.14
            bones['head'].rotation_euler.z=-.09+.04*math.sin(phase*2)
        if action_name=='jump':
            # Anticipation, takeoff, airtime, soft landing, then settle.
            anticipation=max(0,math.sin(math.pi*min(1,t/.28))) if t<.28 else 0
            airborne=math.sin(math.pi*(t-.28)/.72) if .28<=t<=1.0 else 0
            landing=max(0,math.sin(math.pi*(t-1.0)/.24)) if 1.0<t<1.24 else 0
            squash=anticipation*.11+landing*.09
            bones['root'].location.y=airborne*.29-squash*.18
            bones['body'].scale=(1+squash,1+squash,1-squash)
            for suffix,s in [('L',-1),('R',1)]:
                bones['arm_'+suffix].rotation_euler.z=s*(.15+airborne*1.0)
                bones['elbow_'+suffix].rotation_euler.z=s*airborne*.25
                bones['leg_'+suffix].rotation_euler.x=-anticipation*.32+airborne*.25
                bones['knee_'+suffix].rotation_euler.x=anticipation*.6+airborne*.38+landing*.35
                bones['foot_'+suffix].rotation_euler.x=-airborne*.3-landing*.2
        if action_name=='run':
            stride=math.sin(phase)
            bones['body'].rotation_euler.x=.14
            bones['root'].location.y=(.5-.5*math.cos(phase*2))*.04
            bones['head'].rotation_euler.x=-.08
            for suffix,s in [('L',-1),('R',1)]:
                bones['arm_'+suffix].rotation_euler.x=s*stride*.72
                bones['arm_'+suffix].rotation_euler.z=s*.22
                bones['elbow_'+suffix].rotation_euler.x=-.55
                bones['leg_'+suffix].rotation_euler.x=-s*stride*.70
                bend=max(0,s*stride)*.95+.12
                bones['knee_'+suffix].rotation_euler.x=bend
                bones['foot_'+suffix].rotation_euler.x=-bend*.65
        if action_name=='sleep':
            # Curl onto the side, with the head resting at floor height.
            bones['root'].rotation_euler.z=-math.pi/2
            bones['root'].location.x=-.47
            bones['root'].location.y=.34
            bones['body'].rotation_euler.x=.10
            bones['body'].scale.z=.96+math.sin(phase)*.016
            bones['head'].rotation_euler.x=.26
            bones['head'].rotation_euler.z=.19
            for suffix,s in [('L',-1),('R',1)]:
                bones['arm_'+suffix].rotation_euler.z=-s*.15
                bones['elbow_'+suffix].rotation_euler.x=-1.05
                bones['leg_'+suffix].rotation_euler.x=-.70
                bones['knee_'+suffix].rotation_euler.x=1.05
                bones['foot_'+suffix].rotation_euler.x=-.55
        if action_name=='roar':
            expression=.5-.5*math.cos(phase)
            bones['head'].rotation_euler.x=-expression*.20
            bones['body'].rotation_euler.x=-expression*.08
            bones['mouth_rest'].scale=(.001,.001,.001)
            bones['mouth_open'].scale=(1,.8+expression*.55,1)
            for suffix,s in [('L',-1),('R',1)]:
                bones['arm_'+suffix].rotation_euler.z=s*(.45+expression*.6)
                bones['elbow_'+suffix].rotation_euler.x=-.45
            bones['tail'].rotation_euler.z=math.sin(phase*3)*.35
        for b in bones:
            b.keyframe_insert('location',frame=frame+1)
            b.keyframe_insert('rotation_euler',frame=frame+1)
            b.keyframe_insert('scale',frame=frame+1)
    arm.animation_data.action=None
    track=arm.animation_data.nla_tracks.new(); track.name=action_name
    strip=track.strips.new(action_name,1,action)
    strip.action_frame_start=1; strip.action_frame_end=frames+1
    track.mute=True

for b in bones:
    b.location=(0,0,0); b.rotation_euler=(0,0,0); b.scale=(1,1,1)
for name in ['closed_L','closed_R','mouth_open']: bones[name].scale=(.001,.001,.001)
arm['designVersion']=6
arm['assetPipeline']='Authored surfaces + groom + PBR textures + skeletal NLA clips'
scene['art_direction']='CAT benchmark first; original Milo, lilac woven hoodie, warm short fur and blue eyes'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'milo.blend'))
for track in arm.animation_data.nla_tracks: track.mute=False
args=dict(filepath=str(ROOT/'public/models/cat-studio.glb'),export_format='GLB',export_yup=True,
          export_animations=True,export_skins=True,export_extras=True,export_texcoords=True,
          export_normals=True,export_materials='EXPORT',export_image_format='AUTO',
          export_animation_mode='NLA_TRACKS',export_force_sampling=True,
          export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
properties=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
args={k:v for k,v in args.items() if k in properties}
bpy.ops.export_scene.gltf(**args)
print('CAT authored benchmark saved:',ROOT/'public/models/cat-studio.glb',flush=True)
