"""Render genuine Blender geometry from repeatable inspection angles."""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
scene = bpy.context.scene
original = scene.camera
original_filepath = scene.render.filepath
full_character = str(scene.get('art_status','')).startswith('Milo full silhouette')
height = 1.08 if full_character else 1.65
scale = 2.42 if full_character else 1.28
prefix = 'milo-full-' if full_character else 'milo-head-'
renders = []
for name, position in [('three-quarter',(3,-4,height)),('side',(5,0,height)),('back',(0,5,height))]:
    camera = bpy.data.objects['Milo camera / '+name]
    camera.location = position
    camera.rotation_euler = (Vector((0,0,height))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale = scale
    scene.camera = camera
    scene.render.filepath = str(ROOT / ('.test-artifacts/'+prefix+name+'.png'))
    bpy.ops.render.render(write_still=True)
    renders.append(scene.render.filepath)
scene.camera = original
scene.render.filepath = original_filepath
result = {'renders':renders,'status':'geometry inspection, not approval'}
