"""Render the exported unapproved hybrid GLB, independent of its source scene."""
from pathlib import Path
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parent.parent
out = root / 'assets/characters/cat/studies/milo-hybrid-rig-WIP'
source = out / 'milo-hybrid-motion-WIP.glb'
bpy.ops.wm.open_mainfile(filepath=str(out / 'milo-hybrid-rig-trial.blend'))
source_actions = {action.name for action in bpy.data.actions}
assert {'Wave_WIP', 'Run_WIP'} <= source_actions, (
    'Editable Blender source must retain both clips after reopen', source_actions)
print('SOURCE_ACTIONS_REOPENED', sorted(source_actions), flush=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
scene = bpy.context.scene
armatures = [obj for obj in scene.objects if obj.type == 'ARMATURE']
assert len(armatures) == 1
arm = armatures[0]
skinned = [obj for obj in scene.objects if obj.type == 'MESH' and
           any(mod.type == 'ARMATURE' for mod in obj.modifiers)]
print('REIMPORTED', 'meshes', len([o for o in scene.objects if o.type == 'MESH']),
      'skinned', len(skinned), 'actions', [action.name for action in bpy.data.actions],
      'armature', arm.name,
      'active', arm.animation_data.action.name if arm.animation_data and arm.animation_data.action else None,
      flush=True)
assert len(skinned) >= 4

scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 720
scene.render.resolution_y = 840
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
world = bpy.data.worlds.new('Milo GLB preview world')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.32, 0.34, 0.38, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
camera_data = bpy.data.cameras.new('front')
camera = bpy.data.objects.new('front', camera_data)
scene.collection.objects.link(camera)
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 2.65
camera.location = (0, -5, 1.08)
camera.rotation_euler = (Vector((0, 0, 1.08)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
for name, location, energy in (
    ('key', (3, -4, 5), 650), ('fill', (-3, -2, 3), 350),
    ('rim', (0, 3, 4), 400),
):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = 4
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()
rotations = []
arm.animation_data.action = bpy.data.actions['Wave_WIP']
for frame, name in ((1, 'rest'), (17, 'wave')):
    scene.frame_set(frame)
    bone = arm.pose.bones.get('upper_arm_R')
    assert bone is not None
    rotations.append(tuple(round(v, 4) for v in bone.matrix.to_quaternion()))
    scene.render.filepath = str(out / f'glb-reimport-{name}.png')
    bpy.ops.render.render(write_still=True)
print('UPPER_ARM_MATRIX_ROTATIONS', rotations, flush=True)
assert rotations[0] != rotations[1]
arm.animation_data.action = bpy.data.actions['Run_WIP']
run_rotations = []
for frame, name in ((1, 'run-left'), (7, 'run-right')):
    scene.frame_set(frame)
    run_rotations.append(tuple(round(v, 4) for v in
        arm.pose.bones['thigh_R'].matrix.to_quaternion()))
    scene.render.filepath = str(out / f'glb-reimport-{name}.png')
    bpy.ops.render.render(write_still=True)
print('THIGH_RUN_ROTATIONS', run_rotations, flush=True)
assert run_rotations[0] != run_rotations[1]
