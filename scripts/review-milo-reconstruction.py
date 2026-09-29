"""Inspect the raw local reconstruction in Blender, without replacing CAT."""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
resolution=max([r for r in [128,192,256] if (ROOT/('.test-artifacts/milo-reconstruction-'+str(r)+'/milo-draft.ply')).exists()])
folder='.test-artifacts/milo-reconstruction-'+str(resolution)
source=ROOT/(folder+'/milo-draft.ply')
output=ROOT/('assets/characters/cat/milo-reconstruction-'+str(resolution)+'.blend')
if not source.is_file(): raise RuntimeError('Local reconstruction is missing.')
if output.exists(): raise RuntimeError('Existing review scene preserved.')
bpy.ops.wm.read_homefile(use_empty=True,use_factory_startup=True)
with bpy.data.libraries.load(str(ROOT/'assets/characters/cat/milo-authoring.blend'),link=False) as (available,loaded):
    loaded.collections=['00 / approved Milo references','90 / cameras and studio']
    loaded.worlds=['Milo neutral studio']
for collection in loaded.collections: bpy.context.scene.collection.children.link(collection)
bpy.ops.wm.ply_import(filepath=str(source))
meshes=[ob for ob in bpy.context.selected_objects if ob.type=='MESH']
if len(meshes)!=1: raise RuntimeError('Expected one raw reconstruction mesh.')
ob=meshes[0]; ob.name='Milo / raw local reconstruction '+str(resolution)
vertices=ob.data.vertices
minimum=Vector([min(v.co[i] for v in vertices) for i in range(3)])
maximum=Vector([max(v.co[i] for v in vertices) for i in range(3)])
scale=2.1/(maximum.z-minimum.z)
center=(minimum+maximum)/2
for v in vertices: v.co=Vector(((v.co.x-center.x)*scale,(v.co.y-center.y)*scale,(v.co.z-minimum.z)*scale))
for face in ob.data.polygons: face.use_smooth=True
if not ob.data.color_attributes: raise RuntimeError('Reconstruction has no vertex colors.')
mat=bpy.data.materials.new('Milo / reconstruction vertex color only'); mat.use_nodes=True
p=mat.node_tree.nodes.get('Principled BSDF'); p.inputs['Roughness'].default_value=.85
c=mat.node_tree.nodes.new('ShaderNodeVertexColor'); c.layer_name=ob.data.color_attributes[0].name
mat.node_tree.links.new(c.outputs['Color'],p.inputs['Base Color']); ob.data.materials.clear(); ob.data.materials.append(mat)
ob['art_status']='raw neural mesh; no separated eyes/cloth, UV textures, groom or rig'
scene=bpy.context.scene; scene.world=loaded.worlds[0]
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=900; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene['art_status']='Milo local reconstruction '+str(resolution)+'. Raw mesh inspection only; not approved.'
renders=[]
for name,position in [('front',(5,0,1.08)),('side',(0,-5,1.08)),('back',(-5,0,1.08)),('other-side',(0,5,1.08))]:
    camera=bpy.data.objects['Milo camera / front']
    camera.location=position; camera.rotation_euler=(Vector((0,0,1.08))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=2.6; scene.camera=camera
    scene.render.filepath=str(ROOT/(folder+'/'+name+'.png'))
    bpy.ops.render.render(write_still=True); renders.append(scene.render.filepath)
scene.camera.location=(5,0,1.08)
scene.camera.rotation_euler=(Vector((0,0,1.08))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(output))
result={'scene':str(output),'renders':renders,'triangles':len(ob.data.polygons),'status':scene['art_status']}
