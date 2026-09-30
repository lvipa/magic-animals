"""Private skinning and visible wave-deformation test on Milo's quad base."""
from pathlib import Path
import math
import bpy
from mathutils import Quaternion, Vector

root = Path(__file__).resolve().parent.parent
folder = root / 'assets/characters/cat/studies'
source = root / 'assets/characters/cat/studies/milo-quad-threeview-projection-study.glb'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
mesh = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH')
mesh.name = 'MILO_SKIN_TEST_UNAPPROVED'
print('MESH_MATRIX', list(mesh.matrix_world), 'BBOX',
      [(round(min(v[i] for v in mesh.bound_box), 3),
        round(max(v[i] for v in mesh.bound_box), 3)) for i in range(3)], flush=True)
arm_data = bpy.data.armatures.new('MiloTestSkeleton')
arm = bpy.data.objects.new('MiloTestRig_UNAPPROVED', arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')

def make(name, head, tail, parent=None):
    bone = arm_data.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    if parent:
        bone.parent = arm_data.edit_bones[parent]
    return bone

make('root', (0, 0, -0.64), (0, 0, -0.48))
make('spine', (0, 0, -0.48), (0, 0, 0.11), 'root')
make('neck', (0, 0, 0.11), (0, 0, 0.29), 'spine')
make('head', (0, 0, 0.29), (0, 0, 0.82), 'neck')
for side, sign in (('L', -1), ('R', 1)):
    make('upper_arm_' + side, (sign * 0.25, 0, 0.02),
         (sign * 0.40, 0, -0.14), 'spine')
    make('lower_arm_' + side, (sign * 0.40, 0, -0.14),
         (sign * 0.53, 0.01, -0.28), 'upper_arm_' + side)
    make('paw_' + side, (sign * 0.53, 0.01, -0.28),
         (sign * 0.61, 0.01, -0.33), 'lower_arm_' + side)
    make('thigh_' + side, (sign * 0.17, 0, -0.48),
         (sign * 0.17, 0, -0.73), 'root')
    make('shin_' + side, (sign * 0.17, 0, -0.73),
         (sign * 0.17, 0.02, -0.95), 'thigh_' + side)
make('tail_base', (-0.23, -0.08, -0.54),
     (-0.43, -0.12, -0.55), 'root')
make('tail_tip', (-0.43, -0.12, -0.55),
     (-0.59, -0.08, -0.45), 'tail_base')
bpy.ops.object.mode_set(mode='OBJECT')

bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
result = bpy.ops.object.parent_set(type='ARMATURE_AUTO', keep_transform=True)
print('AUTO_SKIN', result, 'GROUPS', [(group.name, group.index)
                                    for group in mesh.vertex_groups], flush=True)
if len(mesh.vertex_groups) < 10:
    raise RuntimeError('Automatic skin weights were not created')
weighted = sum(bool(vertex.groups) for vertex in mesh.data.vertices)
print('WEIGHTED_VERTICES', weighted, len(mesh.data.vertices), flush=True)

# Blend abrupt bone-heat transitions across the quad surface, then normalize.
neighbors = [set() for _ in mesh.data.vertices]
for edge in mesh.data.edges:
    a, b = edge.vertices
    neighbors[a].add(b)
    neighbors[b].add(a)
count = len(mesh.vertex_groups)
weights = [[0.0] * count for _ in mesh.data.vertices]
for vertex in mesh.data.vertices:
    for item in vertex.groups:
        weights[vertex.index][item.group] = item.weight
for _ in range(5):
    updated = []
    for index, row in enumerate(weights):
        adjacent = neighbors[index]
        if adjacent:
            average = [sum(weights[n][g] for n in adjacent) / len(adjacent)
                       for g in range(count)]
            mixed = [0.65 * row[g] + 0.35 * average[g] for g in range(count)]
            total = sum(mixed)
            updated.append([value / total for value in mixed])
        else:
            updated.append(row)
    weights = updated
for group in mesh.vertex_groups:
    group.remove(list(range(len(mesh.data.vertices))))
for vertex_index, row in enumerate(weights):
    for group_index, weight in enumerate(row):
        if weight > 0.0001:
            mesh.vertex_groups[group_index].add([vertex_index], weight, 'REPLACE')

def world_y_rotation(name, degrees):
    pose_bone = arm.pose.bones[name]
    pose_bone.rotation_mode = 'QUATERNION'
    rest = pose_bone.bone.matrix_local.to_quaternion()
    world = Quaternion((0, 1, 0), math.radians(degrees))
    pose_bone.rotation_quaternion = rest.inverted() @ world @ rest

arm.data.pose_position = 'POSE'
bpy.context.view_layer.update()

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 620
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.36, 0.40, 0.46, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.75
scene.view_settings.view_transform = 'AgX'
camera_data = bpy.data.cameras.new('TestCamera')
camera = bpy.data.objects.new('TestCamera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 2.55

def area(name, location, power, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()

area('Key', (3, 4, 5), 550, 4)
area('Fill', (-3, 2, 3), 280, 4)
area('Rim', (0, -3, 4), 380, 3)
center = Vector((0, 0, 0))
camera.location = center + Vector((0, 7, 0))
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(folder / 'milo-auto-rig-rejected-rest.png')
bpy.ops.render.render(write_still=True)
world_y_rotation('upper_arm_L', 65)
world_y_rotation('lower_arm_L', -20)
world_y_rotation('head', -8)
bpy.context.view_layer.update()
for angle, label in ((180, 'front'), (135, 'quarter'), (90, 'side')):
    radians = math.radians(angle)
    direction = Vector((math.sin(radians), -math.cos(radians), 0))
    camera.location = center + direction * 7
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(folder / f'milo-auto-rig-rejected-wave-{label}.png')
    bpy.ops.render.render(write_still=True)
scene['status'] = 'REJECTED auto skinning test. Do not export as a game character.'
bpy.data.texts.new('READ_ME_FIRST').write('''REJECTED automatic-rigging test.
The shoulder and neck surfaces visibly break in Wave.
This mesh is a sculpt reference, not a deformable character.
Do not put this CAT in the app or use it as the cast benchmark.
Rebuild separate clean body/clothing shells and shoulder/neck loops,
then repaint weights and review all clips from front, side and back.
''')
bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'milo-auto-rig-rejected.blend'), check_existing=False)
