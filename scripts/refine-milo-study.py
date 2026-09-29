"""Targeted v2 silhouette corrections, preserving cages and prior source copy."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
scene=bpy.context.scene
if scene.get('art_status')!='Milo full silhouette study v2. Art approval, retopology and rig pending.':
    raise RuntimeError('Expected the untouched v2 study; existing work preserved.')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'.test-artifacts/milo-full-study-v2.blend'),copy=True)
body=bpy.data.objects['Milo / connected body limbs and paws']
body.data.materials[0]=bpy.data.objects['Milo / unified head and ear roots'].data.materials[0]
for vertex in body.data.vertices:
    p=vertex.co
    t=max(0,min(1,(p.z-.59)/.08))*max(0,min(1,(1.12-p.z)/.025))
    p.x*=1-.12*t; p.y*=1-.12*t
    # Soft recessed toe separations, rather than black painted fingers.
    if p.z<.16 and p.y<-.13:
        x=p.x-(.15 if p.x>0 else -.15)
        crease=sum(math.exp(-((x-s*.037)/.008)**2) for s in [-1,1])
        p.y+=.008*crease*math.exp(-((p.z-.105)/.035)**2)
body.data.update()
hem=bpy.data.objects['Milo / ribbed lower hem']
for v in hem.data.vertices:
    v.co.x*=.292/.279; v.co.y*=.218/.204
    v.co.z=.486+(v.co.z-.465)*(.067/.065)
hem.data.update()
hood=bpy.data.objects['Milo / open draped hood and lining']
# Its control rings remain editable. Lower the draped bowl while preserving
# the neck opening; the rear tip hangs against the jacket instead of a cone.
factors=[1,.97,.85,.65,.40,.18,.04]
for row,t in enumerate(factors):
    for i in range(64):
        a=math.pi*2*i/64
        hood.data.vertices[row*64+i].co=(math.sin(a)*.30*max(.15,t),
            .26-.16*t-math.cos(a)*.225*t,
            .76+.40*t-.075*math.cos(a)*t+.03*math.sin(a*3)*t*(1-t))
hood.data.update()

studio=bpy.data.collections['90 / cameras and studio']
# Fabric ribbing has the same material response as the fleece; real shader
# normal detail avoids adding hundreds of separate decorative cylinders.
rib=hem.data.materials[0]; nodes= rib.node_tree.nodes; links=rib.node_tree.links
p=nodes.get('Principled BSDF'); p.inputs['Sheen Weight'].default_value=.45
coord=nodes.new('ShaderNodeTexCoord'); wave=nodes.new('ShaderNodeTexWave')
wave.wave_type='BANDS'; wave.bands_direction='X'; wave.inputs['Scale'].default_value=65
links.new(coord.outputs['Generated'],wave.inputs['Vector'])
bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.22; bump.inputs['Distance'].default_value=.0012
links.new(wave.outputs['Color'],bump.inputs['Height']); links.new(bump.outputs['Normal'],p.inputs['Normal'])

head=bpy.data.objects['Milo / unified head and ear roots']
attr=head.data.color_attributes['Milo_FurColor']
for v in head.data.vertices:
    x,y,z=v.co
    if z>1.885 and y<0:
        width=max(.016,.13*(2.09-z)/.205)
        center=.34+(z-1.87)*.32
        weight=max(0,min(1,(z-1.885)/.055))*math.exp(-((abs(x)-center)/width)**4)
        old=attr.data[v.index].color
        attr.data[v.index].color=(*[old[i]*(1-weight)+(.48,.14,.12)[i]*weight for i in range(3)],1)

cornea=bpy.data.materials.new('Milo / clear corneal lens'); cornea.use_nodes=True
p=cornea.node_tree.nodes.get('Principled BSDF')
p.inputs['Base Color'].default_value=(1,1,1,1); p.inputs['Roughness'].default_value=.035
p.inputs['Transmission Weight'].default_value=1; p.inputs['IOR'].default_value=1.38
eyes=bpy.data.collections['02 / eyes and facial deformation']
for index,cx in enumerate([.195,-.195]):
    vertices=[]; faces=[]; n=64; rings=[]
    for radius in [.002,.025,.055,.080,.101]:
        ring=[]
        for i in range(n):
            a=math.pi*2*i/n; x=radius*math.cos(a); z=radius*1.08*math.sin(a)
            y=-.125-.164*math.sqrt(1-(x/.153)**2-(z/.168)**2)-.018
            ring.append(len(vertices)); vertices.append((cx+x,y,1.575+z))
        rings.append(ring)
    for first,second in zip(rings,rings[1:]):
        for i in range(n): faces.append((first[i],first[(i+1)%n],second[(i+1)%n],second[i]))
    faces.append(tuple(reversed(rings[0])))
    mesh=bpy.data.meshes.new('Milo cornea / '+str(index)); mesh.from_pydata(vertices,[],faces); mesh.materials.append(cornea)
    for face in mesh.polygons: face.use_smooth=True
    ob=bpy.data.objects.new(mesh.name,mesh); eyes.objects.link(ob)
    solid=ob.modifiers.new('Lens shell','SOLIDIFY'); solid.thickness=.001
    # Studio area lights now supply the reflections, without white beads.
    for name in ['Milo / key reflection '+str(index),'Milo / fill reflection '+str(index)]:
        bpy.data.objects[name].hide_render=True

for image in bpy.data.images:
    if image.filepath and not image.filepath.startswith('//'):
        try:
            Path(image.filepath).resolve().relative_to(ROOT)
            image.filepath=bpy.path.relpath(image.filepath,start=str(ROOT/'assets/characters/cat'))
        except ValueError: pass

scene['art_status']='Milo full silhouette study v3. Art approval, retopology and rig pending.'
scene.render.filepath=str(ROOT/'.test-artifacts/milo-full-front.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/characters/cat/milo-authoring.blend'))
bpy.ops.render.render(write_still=True)
result={'scene':bpy.data.filepath,'render':scene.render.filepath,'status':scene['art_status']}
