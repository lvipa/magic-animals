"""Build an unapproved Milo hybrid rig study; never touches the app's CAT."""
from pathlib import Path
import math
import bpy
import bmesh
from mathutils import Matrix, Quaternion, Vector

root = Path(__file__).resolve().parent.parent
out = root / 'assets/characters/cat/studies/milo-hybrid-rig-WIP'
render_out = root / '.test-artifacts/milo-hybrid-rig'
if (out / 'milo-hybrid-rig-trial.blend').exists():
    raise RuntimeError('Study already exists; preserve any manual edits before rebuilding')
out.mkdir(parents=True, exist_ok=True)
render_out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root / 'assets/characters/cat/milo-authoring.blend'))
scene = bpy.context.scene

arm_data = bpy.data.armatures.new('Milo technical skeleton')
arm = bpy.data.objects.new('Milo technical rig - UNAPPROVED', arm_data)
scene.collection.objects.link(arm)
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

make('root', (0, 0, 0.24), (0, 0, 0.52))
make('spine', (0, 0, 0.52), (0, 0, 1.10), 'root')
make('neck', (0, 0, 1.10), (0, 0, 1.32), 'spine')
make('head', (0, 0, 1.32), (0, 0, 1.85), 'neck')
for side, sign in (('L', -1), ('R', 1)):
    make('upper_arm_' + side, (sign * 0.28, 0, 1.08),
         (sign * 0.40, 0, 0.78), 'spine')
    make('lower_arm_' + side, (sign * 0.40, 0, 0.78),
         (sign * 0.49, 0, 0.59), 'upper_arm_' + side)
    make('paw_' + side, (sign * 0.49, 0, 0.59),
         (sign * 0.54, 0, 0.50), 'lower_arm_' + side)
    make('thigh_' + side, (sign * 0.17, 0, 0.51),
         (sign * 0.18, 0, 0.28), 'root')
    make('shin_' + side, (sign * 0.18, 0, 0.28),
         (sign * 0.18, 0, 0.10), 'thigh_' + side)
make('tail_base', (0.18, 0.22, 0.54), (0.43, 0.27, 0.65), 'root')
make('tail_tip', (0.43, 0.27, 0.65), (0.58, 0.25, 0.82), 'tail_base')
bpy.ops.object.mode_set(mode='OBJECT')

base_names = [
    'Milo / connected body limbs and paws',
    'Milo / tailored hoodie with sewn sleeves',
    'Milo / ribbed wrist 1',
    'Milo / ribbed wrist -1',
    'Milo / curved full tail',
]
for name in base_names:
    obj = bpy.data.objects[name]
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO', keep_transform=True)
    count = sum(bool(v.groups) for v in obj.data.vertices)
    print('SKIN', name, count, len(obj.data.vertices),
          [g.name for g in obj.vertex_groups], flush=True)
    if count != len(obj.data.vertices):
        raise RuntimeError(f'Unweighted vertices: {name}')
    # glTF supports four influences per vertex; keep the same four in Blender
    # so the exported pose does not silently change under the weight limit.
    for vertex in obj.data.vertices:
        influence = sorted(((item.group, item.weight) for item in vertex.groups),
                           key=lambda item: item[1], reverse=True)
        if len(influence) <= 4:
            continue
        total = sum(weight for _, weight in influence[:4])
        for group_index, _ in influence[4:]:
            obj.vertex_groups[group_index].remove([vertex.index])
        for group_index, weight in influence[:4]:
            obj.vertex_groups[group_index].add([vertex.index],
                                                 weight / total, 'REPLACE')

# Bone heat leaks from legs into the loose hoodie at the waist. Keep clothing
# on the torso/arms and make sewn details follow the same armature.
hoodie = bpy.data.objects['Milo / tailored hoodie with sewn sleeves']
for vertex in hoodie.data.vertices:
    leaked = [(item.group, item.weight) for item in vertex.groups
              if hoodie.vertex_groups[item.group].name.startswith(
                  ('thigh_', 'shin_', 'tail_'))]
    if not leaked:
        continue
    transfer = sum(weight for _, weight in leaked)
    for group_index, _ in leaked:
        hoodie.vertex_groups[group_index].remove([vertex.index])
    target = 'root' if vertex.co.z < 0.65 else 'spine'
    group = hoodie.vertex_groups[target]
    original = next((item.weight for item in vertex.groups
                     if item.group == group.index), 0.0)
    group.add([vertex.index], original + transfer, 'REPLACE')

for name, bone_name in (
    ('Milo / ribbed lower hem', 'root'),
    ('Milo / open draped hood and lining', 'neck'),
    ('Milo / shaped pocket -1', 'spine'),
    ('Milo / shaped pocket 1', 'spine'),
    ('Milo / zipper teeth', 'spine'),
    ('Milo / inner garment lining', 'spine'),
):
    obj = bpy.data.objects[name]
    group = obj.vertex_groups.get(bone_name) or obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    obj.parent = arm
    obj.matrix_parent_inverse = arm.matrix_world.inverted()
    modifier = obj.modifiers.new('Follow Milo skeleton', 'ARMATURE')
    modifier.object = arm

# Try the closer-to-reference sculpt head on the clean, separately clothed rig.
# This is a private assembly test only, not a final art asset.
for collection_name in ('02 / eyes and facial deformation',):
    for obj in bpy.data.collections[collection_name].objects:
        obj.hide_render = True
        obj.hide_viewport = True
for obj in bpy.data.collections['01 / character anatomy'].objects:
    if obj.name not in ('Milo / connected body limbs and paws',
                        'Milo / curved full tail'):
        obj.hide_render = True
        obj.hide_viewport = True
for obj in bpy.data.collections['04 / groom and realtime fur'].objects:
    if 'connected body' not in obj.name and 'curved full tail' not in obj.name:
        obj.hide_render = True
        obj.hide_viewport = True
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(root /
    'assets/characters/cat/studies/milo-quad-threeview-projection-study.glb'))
added = [obj for obj in bpy.data.objects if obj not in before and obj.type == 'MESH']
assert len(added) == 1, added
head = added[0]
head.name = 'Milo projected head - UNAPPROVED hybrid'
print('IMPORTED_HEAD_MATRIX', list(head.matrix_world), flush=True)
head.data.transform(Matrix.Rotation(math.pi, 4, 'Z'))
head.data.transform(Matrix.Translation(Vector((0, 0, 1.0))))
print('HEAD_BEFORE_CUT_Z', min(v.co.z for v in head.data.vertices),
      max(v.co.z for v in head.data.vertices), flush=True)
bm = bmesh.new()
bm.from_mesh(head.data)
bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
    dist=0.0001, plane_co=(0, 0, 1.12), plane_no=(0, 0, 1),
    clear_inner=True, clear_outer=False)
boundary = [edge for edge in bm.edges if edge.is_boundary]
print('HEAD_CUT_BOUNDARY', len(boundary), flush=True)
# The imported GLB has UV seam boundaries; filling every boundary would
# create giant faces across its eyes and ears. Leave this hidden neck cut open.
bm.to_mesh(head.data)
bm.free()
head.data.update()
print('HEAD_AFTER_CUT_Z', min(v.co.z for v in head.data.vertices),
      max(v.co.z for v in head.data.vertices), flush=True)
head_group = head.vertex_groups.new(name='head')
head_group.add(list(range(len(head.data.vertices))), 1.0, 'REPLACE')
modifier = head.modifiers.new('Milo head skin', 'ARMATURE')
modifier.object = arm
head.parent = arm
head.matrix_parent_inverse = arm.matrix_world.inverted()
print('HEAD', len(head.data.vertices), len(head.data.polygons), flush=True)

scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 850
scene.render.resolution_y = 950
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
camera = scene.camera
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 2.65
camera.location = (0, -5, 1.08)
camera.rotation_euler = (Vector((0, 0, 1.08)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(render_out / 'rest.png')
bpy.ops.render.render(write_still=True)

pose_bone = arm.pose.bones['upper_arm_R']
pose_bone.rotation_mode = 'QUATERNION'
rest = pose_bone.bone.matrix_local.to_quaternion()
world = Quaternion((0, 1, 0), math.radians(-65))
pose_bone.rotation_quaternion = rest.inverted() @ world @ rest
bpy.context.view_layer.update()
scene.render.filepath = str(render_out / 'wave-front.png')
bpy.ops.render.render(write_still=True)
camera.location = (3.5, -3.5, 1.08)
camera.rotation_euler = (Vector((0, 0, 1.08)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(render_out / 'wave-quarter.png')
bpy.ops.render.render(write_still=True)
camera.location = (5, 0, 1.08)
camera.rotation_euler = (Vector((0, 0, 1.08)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(render_out / 'wave-side.png')
bpy.ops.render.render(write_still=True)

# Store one explicit motion clip to test skinning survives GLB export/import.
upper = arm.pose.bones['upper_arm_R']
upper.rotation_mode = 'QUATERNION'
for frame, degrees in ((1, 0), (9, -60), (17, -72), (25, -58), (33, 0)):
    scene.frame_set(frame)
    upper.rotation_quaternion = rest.inverted() @ (
        Quaternion((0, 1, 0), math.radians(degrees))) @ rest
    upper.keyframe_insert(data_path='rotation_quaternion', frame=frame,
                          group='upper_arm_R')
arm.animation_data.action.name = 'Wave_WIP'
arm.animation_data.action = None

def rotate_world(bone_name, axis, degrees, frame):
    bone = arm.pose.bones[bone_name]
    bone.rotation_mode = 'QUATERNION'
    basis = bone.bone.matrix_local.to_quaternion()
    bone.rotation_quaternion = basis.inverted() @ (
        Quaternion(axis, math.radians(degrees))) @ basis
    bone.keyframe_insert(data_path='rotation_quaternion', frame=frame,
                         group=bone_name)

# One short, deliberately different test cycle: alternating legs and arms,
# plus a root bounce. These are animation plumbing studies, not final motion.
for frame, phase in ((1, 1), (7, -1), (13, 1), (19, -1), (25, 1)):
    scene.frame_set(frame)
    for side, sign in (('L', 1), ('R', -1)):
        rotate_world('thigh_' + side, (1, 0, 0), -28 * phase * sign, frame)
        rotate_world('shin_' + side, (1, 0, 0), 16 * phase * sign, frame)
        rotate_world('upper_arm_' + side, (1, 0, 0), 18 * phase * sign, frame)
    rotate_world('tail_base', (0, 0, 1), 12 * phase, frame)
    root_bone = arm.pose.bones['root']
    root_bone.location.z = 0.035 if phase > 0 else 0.0
    root_bone.keyframe_insert(data_path='location', frame=frame, group='root')
arm.animation_data.action.name = 'Run_WIP'
scene.frame_start = 1
scene.frame_end = 33
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
selected = []
for obj in scene.objects:
    if obj.type in {'MESH', 'ARMATURE'} and not obj.hide_render and \
            obj.name != 'Milo / studio floor':
        obj.select_set(True)
        selected.append(obj.name)
bpy.context.view_layer.objects.active = arm
print('EXPORT_OBJECTS', selected, flush=True)
for name in selected:
    obj = bpy.data.objects[name]
    for modifier in obj.modifiers:
        if modifier.type == 'SUBSURF':
            modifier.levels = 1
            modifier.render_levels = 1
bpy.ops.export_scene.gltf(
    filepath=str(out / 'milo-hybrid-motion-WIP.glb'),
    export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS',
    export_yup=True, export_apply=True)
# Retain the two visible source pipelines and reference empties, but drop
# concealed duplicate facial meshes from the older authoring study.
for obj in list(scene.objects):
    if obj.hide_render and obj.hide_viewport:
        bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.outliner.orphans_purge(do_recursive=True)
scene['status'] = 'UNAPPROVED hybrid deformation trial, not a final character'
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'milo-hybrid-rig-trial.blend'), check_existing=False)
