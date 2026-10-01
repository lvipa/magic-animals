"""Shared seven-clip animation language from the Milo production rig."""
import bpy, math
from mathutils import Vector, Quaternion

def build_animations(rig, faces):
    for owner in [rig, *faces]: owner.animation_data_clear()
    for bone in rig.pose.bones: bone.rotation_mode = "QUATERNION"
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
                retreat = max(0, min(1, (blink-.6)/.4))
                retreat = retreat*retreat*(3-2*retreat)
                key.value = max(0,2*blink-1) if key.name.startswith('blink_') else 1-abs(2*blink-1) if key.name.startswith('blinkHalf_') else retreat if key.name.startswith(('eyeClose_', 'lidCrease_')) else smile if key.name == 'smile' else mouth if key.name == 'mouthOpen' else 0
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

    name = 'idle'; begin(name)
    for f, head, blink in [(1, 0, 0), (25, 3, 0), (43, 1, 0), (45, 1, .6), (46, 1, 1), (47, 1, .6), (49, 1, 0), (73, -3, 0), (97, 0, 0)]:
        pose(f, [('head', Y, head), ('tail_base', Z, head * 1.5), ('chest', X, -abs(head) * .25)], height=.006 * abs(head), blink=blink)
    end(name, 97); clips.append(name)

    name = 'happy'; begin(name)
    for f, lift, height in [(1, 0, 0), (10, 30, .03), (18, 48, .08), (26, 32, .01), (34, 48, .08), (42, 32, .01), (55, 0, 0)]:
        rotations = [('head', Y, math.sin(f / 7) * 5), ('tail_base', Z, math.sin(f / 5) * 12)]
        for side, sign in [('L', -1), ('R', 1)]:
            rotations.extend([(f'upper_arm_{side}', Y, sign * lift), (f'forearm_{side}', Y, sign * lift * .6)])
        pose(f, rotations, height=height, smile=1 if lift else 0, mouth=.3 if lift else 0)
    end(name, 55); clips.append(name)

    name = 'wave'; begin(name)
    for f, up, fore, wrist in [(1, 0, 0, 0), (10, 65, 35, 0), (16, 65, 35, -20), (22, 65, 35, 20), (28, 65, 35, -20), (34, 65, 35, 20), (42, 65, 35, 0), (49, 0, 0, 0)]:
        pose(f, [('upper_arm_R', Y, up), ('forearm_R', Y, fore), ('paw_R', Y, wrist), ('head', Y, -4 if up else 0)], smile=.8 if up else 0)
    end(name, 49); clips.append(name)

    name = 'jump'; begin(name)
    for f, crouch, lift, height in [(1, 0, 0, 0), (10, 28, -12, -.075), (15, 0, 25, .05), (23, 10, 45, .32), (31, 0, 25, .05), (36, 24, -8, -.065), (49, 0, 0, 0)]:
        rotations = [('chest', X, crouch * .12)]
        for side, sign in [('L', -1), ('R', 1)]:
            rotations.extend([(f'thigh_{side}', X, crouch), (f'shin_{side}', X, -crouch * 1.6), (f'foot_{side}', X, crouch * .6), (f'upper_arm_{side}', Y, sign * lift)])
        pose(f, rotations, height=height, smile=.8 if lift > 0 else 0)
    end(name, 49); clips.append(name)

    name = 'run'; begin(name)
    for f in range(1, 26, 3):
        phase = (f - 1) / 24 * math.tau; s = math.sin(phase); rotations = []
        for side, sign in [('L', 1), ('R', -1)]:
            rotations.extend([(f'thigh_{side}', X, sign * s * 22), (f'shin_{side}', X, -max(0, -sign * s) * 25), (f'upper_arm_{side}', X, -sign * s * 23), (f'forearm_{side}', X, -15), (f'foot_{side}', X, -sign * s * 8)])
        rotations.extend([('chest', Z, s * 3), ('tail_base', Z, s * 9)])
        pose(f, rotations, height=.018 * (1 - math.cos(phase * 2)), smile=.4)
    end(name, 25); clips.append(name)

    name = 'sleep'; begin(name)
    for f, lean, blink in [(1, 0, 0), (20, 22, .3), (30, 49, .6), (40, 76, 1), (65, 77, 1), (90, 76, 1), (115, 77, 1), (140, 76, 1), (150, 49, .6), (170, 0, 0)]:
        amount = lean / 76
        rotations = [('root', Y, lean), ('head', Y, -8 * amount), ('upper_arm_R', Y, -22 * amount), ('upper_arm_L', Y, 22 * amount)]
        for side in ['L', 'R']:
            rotations.extend([(f'forearm_{side}', X, -50 * amount), (f'thigh_{side}', X, 28 * amount), (f'shin_{side}', X, -48 * amount)])
        pose(f, rotations, height=-.34 * amount, sideways=-.25 * amount, blink=blink)
    end(name, 170); clips.append(name)

    name = 'roar'; begin(name)
    for f, lift, head, mouth in [(1, 0, 0, 0), (12, 12, -5, .3), (22, 32, -12, 1), (29, 30, -10, .7), (36, 25, -8, .3), (49, 0, 0, 0)]:
        pose(f, [('upper_arm_R', Y, lift), ('upper_arm_L', Y, -lift), ('chest', X, head * .3), ('head', X, head)], smile=.6 if lift else 0, mouth=mouth)
    end(name, 49); clips.append(name)
