"""Seven reproducible body/facial motion studies on the supplied Milo rig.

Run with Blender --background --python scripts/build-milo-animation-study.py.
Requires build-milo-face-study.py outputs. All binary outputs remain private.
The friendly Roar includes the connected mouthOpen morph; animation polish
and matching voice audio are still pending.
"""
from pathlib import Path
import bpy, math, json, struct
from mathutils import Vector, Quaternion

root = Path(__file__).resolve().parent.parent / '.deployment/incoming-milo'
bpy.ops.wm.open_mainfile(filepath=str(root / 'milo-face-controls-WIP.blend'))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
faces = [o.data.shape_keys for o in bpy.context.scene.objects
         if o.type == 'MESH' and o.data.shape_keys]
for owner in [rig, *faces]:
    owner.animation_data_clear()
for bone in rig.pose.bones:
    bone.rotation_mode = 'QUATERNION'


def rotate(name, axis, degrees):
    bone = rig.pose.bones[name]
    local_axis = bone.bone.matrix_local.to_quaternion().inverted() @ Vector(axis)
    bone.rotation_quaternion @= Quaternion(local_axis, math.radians(degrees))


def pose(frame, rotations=(), height=0, sideways=0, blink=0, smile=0, mouth=0):
    bpy.context.scene.frame_set(frame)
    for bone in rig.pose.bones:
        bone.rotation_quaternion = Quaternion()
        bone.location = (0, 0, 0)
    for name, axis, angle in rotations:
        rotate(name, axis, angle)
    bone = rig.pose.bones['root']
    # Bone local Z is not scene vertical. Convert the world displacement.
    bone.location = bone.bone.matrix_local.to_quaternion().inverted() @ Vector((sideways, 0, height))
    for bone in rig.pose.bones:
        bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
        bone.keyframe_insert('location', frame=frame, group=bone.name)
    for keys in faces:
        for key in keys.key_blocks:
            if key.name == 'Basis':
                continue
            key.value = blink if key.name.startswith('blink_') else smile if key.name == 'smile' else mouth if key.name == 'mouthOpen' else 0
            key.keyframe_insert('value', frame=frame)


def begin(name):
    for index, owner in enumerate([rig, *faces]):
        owner.animation_data_create()
        action = bpy.data.actions.new(name + ('_body' if index == 0 else '_face_' + str(index)))
        owner.animation_data.action = action


def end(name, last):
    for owner in [rig, *faces]:
        data = owner.animation_data
        action = data.action
        slot = data.action_slot
        data.action = None
        track = data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 1, action)
        strip.action_slot = slot
        strip.frame_end = last
        track.mute = True


Y, X, Z = (0, 1, 0), (1, 0, 0), (0, 0, 1)
clips = []

name = 'Idle_WIP'; begin(name)
for f, head, blink in [(1, 0, 0), (25, 3, 0), (43, 1, 0), (46, 1, 1), (49, 1, 0), (73, -3, 0), (97, 0, 0)]:
    pose(f, [('head', Y, head), ('tail_base', Z, head * 1.5), ('chest', X, -abs(head) * .25)], height=.006 * abs(head), blink=blink)
end(name, 97); clips.append(name)

name = 'Happy_WIP'; begin(name)
for f, lift, height in [(1, 0, 0), (10, 30, .03), (18, 48, .08), (26, 32, .01), (34, 48, .08), (42, 32, .01), (55, 0, 0)]:
    rotations = [('head', Y, math.sin(f / 7) * 5), ('tail_base', Z, math.sin(f / 5) * 12)]
    for side, sign in [('L', -1), ('R', 1)]:
        rotations.extend([(f'upper_arm_{side}', Y, sign * lift), (f'forearm_{side}', Y, sign * lift * .6)])
    pose(f, rotations, height=height, smile=1 if lift else 0, mouth=.3 if lift else 0)
end(name, 55); clips.append(name)

name = 'Wave_WIP'; begin(name)
for f, up, fore, wrist in [(1, 0, 0, 0), (10, 65, 35, 0), (16, 65, 35, -20), (22, 65, 35, 20), (28, 65, 35, -20), (34, 65, 35, 20), (42, 65, 35, 0), (49, 0, 0, 0)]:
    pose(f, [('upper_arm_R', Y, up), ('forearm_R', Y, fore), ('paw_R', Y, wrist), ('head', Y, -4 if up else 0)], smile=.8 if up else 0)
end(name, 49); clips.append(name)

name = 'Jump_WIP'; begin(name)
for f, crouch, lift, height in [(1, 0, 0, 0), (10, 28, -12, -.075), (15, 0, 25, .05), (23, 10, 45, .32), (31, 0, 25, .05), (36, 24, -8, -.065), (49, 0, 0, 0)]:
    rotations = [('chest', X, crouch * .12)]
    for side, sign in [('L', -1), ('R', 1)]:
        rotations.extend([(f'thigh_{side}', X, crouch), (f'shin_{side}', X, -crouch * 1.6), (f'foot_{side}', X, crouch * .6), (f'upper_arm_{side}', Y, sign * lift)])
    pose(f, rotations, height=height, smile=.8 if lift > 0 else 0)
end(name, 49); clips.append(name)

name = 'Run_WIP'; begin(name)
for f in range(1, 26, 3):
    phase = (f - 1) / 24 * math.tau; s = math.sin(phase); rotations = []
    for side, sign in [('L', 1), ('R', -1)]:
        rotations.extend([(f'thigh_{side}', X, sign * s * 22), (f'shin_{side}', X, -max(0, -sign * s) * 25), (f'upper_arm_{side}', X, -sign * s * 23), (f'forearm_{side}', X, -15), (f'foot_{side}', X, -sign * s * 8)])
    rotations.extend([('chest', Z, s * 3), ('tail_base', Z, s * 9)])
    pose(f, rotations, height=.018 * (1 - math.cos(phase * 2)), smile=.4)
end(name, 25); clips.append(name)

name = 'Sleep_WIP'; begin(name)
for f, lean, blink in [(1, 0, 0), (20, 22, .3), (40, 76, 1), (65, 77, 1), (90, 76, 1), (115, 77, 1), (140, 76, 1), (170, 0, 0)]:
    amount = lean / 76
    rotations = [('root', Y, lean), ('head', Y, -8 * amount), ('upper_arm_R', Y, -22 * amount), ('upper_arm_L', Y, 22 * amount)]
    for side in ['L', 'R']:
        rotations.extend([(f'forearm_{side}', X, -50 * amount), (f'thigh_{side}', X, 28 * amount), (f'shin_{side}', X, -48 * amount)])
    pose(f, rotations, height=-.34 * amount, sideways=-.25 * amount, blink=blink)
end(name, 170); clips.append(name)

name = 'Roar_WIP'; begin(name)
for f, lift, head, mouth in [(1, 0, 0, 0), (12, 12, -5, .3), (22, 32, -12, 1), (29, 30, -10, .7), (36, 25, -8, .3), (49, 0, 0, 0)]:
    pose(f, [('upper_arm_R', Y, lift), ('upper_arm_L', Y, -lift), ('chest', X, head * .3), ('head', X, head)], smile=.6 if lift else 0, mouth=mouth)
end(name, 49); clips.append(name)

scene = bpy.context.scene
scene.render.fps = 30; scene.frame_start = 1; scene.frame_end = 170
scene.frame_set(1)
for bone in rig.pose.bones:
    bone.rotation_quaternion = Quaternion(); bone.location = (0, 0, 0)
for keys in faces:
    for key in keys.key_blocks:
        key.value = 0
rig['study_status'] = 'Seven motion studies with shared blink, smile and mouthOpen; polish and audio pending'
bpy.ops.wm.save_as_mainfile(filepath=str(root / 'milo-animation-study-WIP.blend'))
bpy.ops.export_scene.gltf(filepath=str(root / 'milo-animation-study-WIP.glb'), export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True, export_yup=True, export_morph=True, export_morph_animation=True)
data = (root / 'milo-animation-study-WIP.glb').read_bytes()
length = struct.unpack_from('<I', data, 12)[0]
document = json.loads(data[20:20 + length])
exported = document.get('animations', [])
assert sorted(a['name'] for a in exported) == sorted(clips), [a['name'] for a in exported]
for animation in exported:
    assert any(c['target']['path'] == 'weights' for c in animation['channels']), animation['name']
print(json.dumps({'clips': clips, 'bytes': len(data), 'facial_tracks_in_all_clips': True}))
