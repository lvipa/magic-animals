"""Package the unapproved InstantMesh blockout in an editable Blender scene.

Run with Blender 5.1.2 from the repository root. This imports an existing GLB
study and packs the approved 2D references. It does not create a game asset,
rig, animation, UV map, or replacement for the current CAT.
"""
from pathlib import Path

import bpy


root = Path(__file__).resolve().parent.parent
study = root / 'assets' / 'characters' / 'cat' / 'studies'
source = study / 'milo-instantmesh-blockout.glb'
destination = study / 'milo-instantmesh-blockout.blend'
if destination.exists():
    raise RuntimeError(f'Existing Blender scene preserved: {destination}')
if not source.is_file():
    raise RuntimeError(f'Blockout GLB is missing: {source}')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if len(meshes) != 1:
    raise RuntimeError(f'Expected one raw mesh, found {len(meshes)}')
mesh = meshes[0]
mesh.name = 'CAT_BLOCKOUT_UNAPPROVED'
mesh.data.name = 'Milo raw reconstructed surface - retopology required'
mesh['status'] = 'study only: NOT approved for game or other characters'
mesh['source'] = 'TencentARC/InstantMesh, official Apache-2.0 model'
mesh['source_glb_sha256'] = '231d557e4220d263e977139a1c0589c026bc22e6019d9134a7bb8bfcda005611'

concepts = root / 'assets' / 'characters' / 'cat' / 'concepts'
for name in ('milo-turnaround-v1.png', 'milo-rig-pose-v1.png',
             'milo-expressions-v1.png'):
    image = bpy.data.images.load(str(concepts / name), check_existing=True)
    image.pack()
    image.use_fake_user = True

notes = bpy.data.texts.new('READ_ME_FIRST')
notes.write('MILO / CAT - UNAPPROVED INSTANTMESH BLOCKOUT\n\n')
notes.write('The approved art is packed as images: milo-turnaround-v1.png, '
            'milo-rig-pose-v1.png, milo-expressions-v1.png.\n')
notes.write('This GLB is a single 15,780-vertex, 31,536-triangle surface with '
            'vertex color only. It has no UV, PBR texture, rig, blendshapes, '
            'or animation. The eyes, muzzle, fur and cloth lack the approved '
            'detail. Do not export it into the game or use it as the CAT '
            'quality benchmark.\n\n')
notes.write('Next art steps: redesign sculpted face and eye sockets; model '
            'separate eyes/eyelids, short-fur materials and true hoodie; '
            'retopologize for deformation, UV unwrap, rig, skin, create seven '
            'clips, and review 360 degrees in Three.js.\n')
notes.write('Provenance and license: see milo-instantmesh-blockout.provenance.json '
            'and BLENDER_WORKFLOW.md. Source art belongs to this project.\n')

scene = bpy.context.scene
scene.name = 'Milo blockout - UNAPPROVED'
scene['status'] = 'DO NOT PUBLISH AS CAT'
scene.unit_settings.system = 'METRIC'
bpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False)
print('BLOCKOUT_SCENE_SAVED', destination, destination.stat().st_size, flush=True)
