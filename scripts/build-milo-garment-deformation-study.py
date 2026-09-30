"""Reproducible, unapproved garment deformation study; never replaces CAT."""
from pathlib import Path
import math
import bpy
import bmesh

root = Path(__file__).resolve().parent.parent
out = root / 'assets/characters/cat/studies/milo-garment-deformation-WIP'
if (out / 'milo-garment-deformation-WIP.blend').exists():
    raise RuntimeError('Study already exists; preserve manual edits before rebuilding')
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root / 'assets/characters/cat/studies/milo-hybrid-rig-WIP/milo-hybrid-rig-trial.blend'))
obj = bpy.data.objects['Milo / tailored hoodie with sewn sleeves']
assert len(obj.data.vertices) == 658
assert len(obj.data.polygons) == 576
for side, start in ((1, 498), (-1, 578)):
    bone = 'upper_arm_' + ('R' if side > 0 else 'L')
    angles = []
    for i in range(20):
        co = obj.data.vertices[start + i].co
        angles.append(math.atan2((co.z - 1.02) / (.63 * .157), (co.y + .012) / (.82 * .157)))
    # The root loop lies on the armhole plane, rather than folding back into
    # the chest. Subsequent rings follow the arm's real transverse plane.
    sections = ((.300, 1.03, .120, .108, 0., 1., .45),
                (.350, .91, .126, .138, .925, .380, .94),
                (.405, .78, .116, .130, .925, .380, 1.),
                (.455, .65, .098, .105, .925, .380, 1.))
    for row, (cx, cz, ry, radius, vx, vz, weight) in enumerate(sections):
        for i, a in enumerate(angles):
            index = start + row * 20 + i
            vertex = obj.data.vertices[index]
            vertex.co = (side * (cx + vx * radius * math.sin(a)),
                         -.012 + ry * math.cos(a), cz + vz * radius * math.sin(a))
            for item in list(vertex.groups):
                obj.vertex_groups[item.group].remove([index])
            obj.vertex_groups[bone].add([index], weight, 'REPLACE')
            if weight < 1:
                obj.vertex_groups['spine'].add([index], 1 - weight, 'REPLACE')
# Anchor the torso side of the seam; make the weight transition happen across
# the shoulder rings rather than pulling the upper chest with the raised arm.
for vertex in obj.data.vertices:
    if vertex.index >= 498:
        continue
    x, y, z = vertex.co
    if abs(x) < .18 or not .93 <= z <= 1.15:
        continue
    bone = 'upper_arm_' + ('R' if x > 0 else 'L')
    if not any(obj.vertex_groups[item.group].name == bone for item in vertex.groups):
        continue
    for item in list(vertex.groups):
        obj.vertex_groups[item.group].remove([vertex.index])
    obj.vertex_groups['spine'].add([vertex.index], .88, 'REPLACE')
    obj.vertex_groups[bone].add([vertex.index], .12, 'REPLACE')
obj.data.update()
# Clothing is opaque. Keep exposed neck, hands and legs; remove the hidden
# torso/upper arms, which otherwise intersect the independently weighted coat.
body = bpy.data.objects['Milo / connected body limbs and paws']
bm = bmesh.new()
bm.from_mesh(body.data)
covered = []
for face in bm.faces:
    c = face.calc_center_median()
    hand = abs(c.x) > .36 and c.z < .595
    if .50 < c.z < 1.125 and not hand:
        covered.append(face)
removed = len(covered)
bmesh.ops.delete(bm, geom=covered, context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(body.data)
bm.free()
body.data.update()
print('HIDDEN_BODY_FACES_REMOVED', removed, flush=True)
arm = bpy.data.objects['Milo technical rig - UNAPPROVED']
assert {action.name for action in bpy.data.actions} >= {'Wave_WIP', 'Run_WIP'}
for action in bpy.data.actions:
    action.use_fake_user = True
bpy.context.scene['art_status'] = 'UNAPPROVED garment deformation study. Not a CAT benchmark.'
body['hidden_faces_removed'] = removed
obj['study_change'] = 'Reshaped sleeve root rings and shoulder weights; art approval pending.'
bpy.ops.object.select_all(action='DESELECT')
for candidate in bpy.context.scene.objects:
    if candidate.type in {'MESH', 'ARMATURE'} and not candidate.hide_render and candidate.name != 'Milo / studio floor':
        candidate.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=str(out / 'milo-garment-deformation-WIP.glb'),
    export_format='GLB', use_selection=True, export_animations=True,
    export_animation_mode='ACTIONS', export_yup=True, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'milo-garment-deformation-WIP.blend'), check_existing=False)
