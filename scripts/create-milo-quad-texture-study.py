"""Bake Milo concept projections onto the unapproved quad sculpt base.

Run with Blender 5.1.2 from the repository root. This makes an editable study
and a portable textured GLB. It does not create a production rig or animation.
"""

from pathlib import Path
import math
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parent.parent
folder = root / 'assets/characters/cat/studies'
glb = folder / 'milo-grid128-quad-study.glb'
image_path = root / 'assets/characters/cat/concepts/milo-rig-pose-v1.png'
turnaround_path = root / 'assets/characters/cat/concepts/milo-turnaround-v1.png'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.import_scene.gltf(filepath=str(glb))
obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
mesh = obj.data
def ramp(value, low, high):
    t = max(0.0, min(1.0, (value - low) / (high - low)))
    return t * t * (3 - 2 * t)

tail_mask = mesh.attributes.new(name='TailColourMask', type='FLOAT', domain='POINT')
arm_mask = mesh.attributes.new(name='SleeveColourMask', type='FLOAT', domain='POINT')
paw_mask = mesh.attributes.new(name='PawColourMask', type='FLOAT', domain='POINT')
ear_mask = mesh.attributes.new(name='EarColourMask', type='FLOAT', domain='POINT')
for vertex in mesh.vertices:
    co = vertex.co
    tail_mask.data[vertex.index].value = (
        ramp(-co.x, 0.25, 0.39)
        * ramp(-co.z, 0.27, 0.43)
        * ramp(-co.y, -0.05, 0.12)
    )
    arm_mask.data[vertex.index].value = (
        ramp(abs(co.x), 0.32, 0.48)
        * ramp(co.z, -0.4, -0.25)
        * (1 - ramp(co.z, 0.08, 0.2))
    )
    paw_mask.data[vertex.index].value = (
        ramp(abs(co.x), 0.47, 0.58)
        * ramp(-co.z, 0.08, 0.18)
        * (1 - ramp(-co.z, 0.34, 0.43))
    )
    ear_mask.data[vertex.index].value = (
        ramp(abs(co.x), 0.23, 0.38)
        * ramp(co.z, 0.47, 0.7)
    )
front_uv = mesh.uv_layers.new(name='FrontConceptProjection')
side_uv = mesh.uv_layers.new(name='SideConceptProjection')
back_uv = mesh.uv_layers.new(name='BackConceptProjection')
for polygon in mesh.polygons:
    for loop_idx in polygon.loop_indices:
        co = mesh.vertices[mesh.loops[loop_idx].vertex_index].co
        x_px = 500 + 660 * co.x
        y_px = 720 - 660 * co.z
        front_uv.data[loop_idx].uv = (x_px / 1024, 1 - y_px / 1536)
        side_x_px = 750 + (450 if polygon.normal.x >= 0 else -450) * co.y
        side_y_px = 475 - 425 * co.z
        side_uv.data[loop_idx].uv = (side_x_px / 1536, 1 - side_y_px / 1024)
        back_x_px = 1300 - 450 * co.x
        back_y_px = 475 - 425 * co.z
        back_uv.data[loop_idx].uv = (back_x_px / 1536, 1 - back_y_px / 1024)

material = mesh.materials[0]
nodes = material.node_tree.nodes
links = material.node_tree.links
bsdf = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
for link in list(bsdf.inputs['Base Color'].links):
    links.remove(link)
source_color = nodes.new('ShaderNodeVertexColor')
source_color.layer_name = 'Color'
front_tex = nodes.new('ShaderNodeTexImage')
front_tex.image = bpy.data.images.load(str(image_path), check_existing=True)
front_coords = nodes.new('ShaderNodeUVMap')
front_coords.uv_map = front_uv.name
links.new(front_coords.outputs['UV'], front_tex.inputs['Vector'])
turnaround = bpy.data.images.load(str(turnaround_path), check_existing=True)
side_tex = nodes.new('ShaderNodeTexImage')
side_tex.image = turnaround
side_coords = nodes.new('ShaderNodeUVMap')
side_coords.uv_map = side_uv.name
links.new(side_coords.outputs['UV'], side_tex.inputs['Vector'])
back_tex = nodes.new('ShaderNodeTexImage')
back_tex.image = turnaround
back_coords = nodes.new('ShaderNodeUVMap')
back_coords.uv_map = back_uv.name
links.new(back_coords.outputs['UV'], back_tex.inputs['Vector'])
geom = nodes.new('ShaderNodeNewGeometry')
sep = nodes.new('ShaderNodeSeparateXYZ')
links.new(geom.outputs['Normal'], sep.inputs['Vector'])
def make_mask(input_socket):
    weight = nodes.new('ShaderNodeMapRange')
    weight.inputs['From Min'].default_value = 0.05
    weight.inputs['From Max'].default_value = 0.55
    links.new(input_socket, weight.inputs['Value'])
    return weight.outputs['Result']

side_abs = nodes.new('ShaderNodeMath')
side_abs.operation = 'ABSOLUTE'
links.new(sep.outputs['X'], side_abs.inputs[0])
back_neg = nodes.new('ShaderNodeMath')
back_neg.operation = 'MULTIPLY'
back_neg.inputs[1].default_value = -1
links.new(sep.outputs['Y'], back_neg.inputs[0])

def mix_color(base, image_color, mask):
    blend = nodes.new('ShaderNodeMixRGB')
    blend.blend_type = 'MIX'
    links.new(mask, blend.inputs[0])
    links.new(base, blend.inputs[1])
    links.new(image_color, blend.inputs[2])
    return blend.outputs['Color']

color = source_color.outputs['Color']
color = mix_color(color, side_tex.outputs['Color'], make_mask(side_abs.outputs[0]))
color = mix_color(color, back_tex.outputs['Color'], make_mask(back_neg.outputs[0]))
ear_attribute = nodes.new('ShaderNodeAttribute')
ear_attribute.attribute_name = 'EarColourMask'
ear_colour = nodes.new('ShaderNodeRGB')
ear_colour.outputs['Color'].default_value = (0.78, 0.48, 0.31, 1)
color = mix_color(color, ear_colour.outputs['Color'], ear_attribute.outputs['Fac'])
sleeve_attribute = nodes.new('ShaderNodeAttribute')
sleeve_attribute.attribute_name = 'SleeveColourMask'
sleeve_colour = nodes.new('ShaderNodeRGB')
sleeve_colour.outputs['Color'].default_value = (0.45, 0.34, 0.45, 1)
color = mix_color(color, sleeve_colour.outputs['Color'], sleeve_attribute.outputs['Fac'])
paw_attribute = nodes.new('ShaderNodeAttribute')
paw_attribute.attribute_name = 'PawColourMask'
paw_colour = nodes.new('ShaderNodeRGB')
paw_colour.outputs['Color'].default_value = (0.82, 0.6, 0.42, 1)
color = mix_color(color, paw_colour.outputs['Color'], paw_attribute.outputs['Fac'])
color = mix_color(color, front_tex.outputs['Color'], make_mask(sep.outputs['Y']))
tail_attribute = nodes.new('ShaderNodeAttribute')
tail_attribute.attribute_name = 'TailColourMask'
tail_colour = nodes.new('ShaderNodeRGB')
tail_colour.outputs['Color'].default_value = (0.72, 0.38, 0.2, 1)
color = mix_color(color, tail_colour.outputs['Color'], tail_attribute.outputs['Fac'])
links.new(color, bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.88
for face in mesh.polygons:
    face.use_smooth = True

corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
low = Vector(tuple(min(point[i] for point in corners) for i in range(3)))
high = Vector(tuple(max(point[i] for point in corners) for i in range(3)))
center = (low + high) / 2
size = high - low
scene = bpy.context.scene
camera_data = bpy.data.cameras.new('ReviewCamera')
camera = bpy.data.objects.new('ReviewCamera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = 'ORTHO'
camera_data.ortho_scale = max(size) * 1.28
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 620
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.36, 0.40, 0.46, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.75
scene.view_settings.view_transform = 'AgX'

def area(name, position, power, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = center + Vector(position)
    light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()

area('Key', (3, 4, 5), 550, 4)
area('Fill', (-3, 2, 3), 280, 4)
area('Rim', (0, -3, 4), 380, 3)
camera.location = center + Vector((0, 1, 0)) * max(size) * 3.5
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene['status'] = 'UNAPPROVED IMAGE PROJECTION STUDY'
front_tex.image.pack()
turnaround.pack()

# Bake the nonportable three-projection shader to a conventional UV atlas so
# the study can be inspected as a real glTF material in Three.js.
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
atlas_layer = mesh.uv_layers.new(name='ColorAtlas')
mesh.uv_layers.active = atlas_layer
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(island_margin=0.012)
bpy.ops.object.mode_set(mode='OBJECT')
atlas_uv = 'ColorAtlas'
print('UV_LAYERS_AFTER_SMART_PROJECT', [layer.name for layer in mesh.uv_layers],
      'active', mesh.uv_layers.active.name, flush=True)
bake_image = bpy.data.images.new('Milo_ThreeView_Color_Study', width=2048,
                                 height=2048, alpha=False, float_buffer=False)
bake_image.filepath_raw = str(folder / 'milo-quad-threeview-color-study.png')
bake_image.file_format = 'PNG'
bake_node = nodes.new('ShaderNodeTexImage')
bake_node.image = bake_image
nodes.active = bake_node
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1
scene.render.bake.use_pass_color = True
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False
scene.render.bake.margin = 8
bpy.ops.object.bake(type='DIFFUSE')
bake_image.save()
print('BAKED_ATLAS', bake_image.filepath_raw, flush=True)

baked_material = bpy.data.materials.new('Milo_Baked_Color_Study_UNAPPROVED')
baked_material.use_nodes = True
baked_nodes = baked_material.node_tree.nodes
baked_links = baked_material.node_tree.links
baked_bsdf = baked_nodes.get('Principled BSDF')
baked_tex = baked_nodes.new('ShaderNodeTexImage')
baked_tex.image = bake_image
baked_uv = baked_nodes.new('ShaderNodeUVMap')
baked_uv.uv_map = atlas_uv
baked_links.new(baked_uv.outputs['UV'], baked_tex.inputs['Vector'])
baked_links.new(baked_tex.outputs['Color'], baked_bsdf.inputs['Base Color'])
baked_bsdf.inputs['Roughness'].default_value = 0.88
material.name = 'Milo_ThreeView_Projection_Source_UNAPPROVED'
material.use_fake_user = True
mesh.materials.clear()
mesh.materials.append(baked_material)
obj['status'] = 'unapproved texture projection study, no rig, no animation'
scene['status'] = 'DO NOT DEPLOY AS CAT'
notes = bpy.data.texts.new('READ_ME_FIRST')
notes.write('MILO AUTOQUAD TEXTURE STUDY — NOT AN APPROVED CHARACTER\n')
notes.write('The displayed mesh uses the baked color atlas. The source projection '
            'shader is preserved as a fake-user material named '
            'Milo_ThreeView_Projection_Source_UNAPPROVED.\n')
notes.write('Front/side/back UV sets and both original concept images are packed. '
            'To revise the paint, assign the source material, edit its masks or '
            'UV projection, then bake again.\n')
notes.write('The eyes and mouth are painted only. The hoodie shares one mesh '
            'with the body; no rig, blendshapes or clips exist.\n')
bake_image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'milo-quad-threeview-projection-study.blend'), check_existing=False)
for layer in list(mesh.uv_layers):
    if layer.name != atlas_uv:
        mesh.uv_layers.remove(layer)
mesh.uv_layers.active = mesh.uv_layers[atlas_uv]
bpy.ops.export_scene.gltf(filepath=str(folder / 'milo-quad-threeview-projection-study.glb'),
                          export_format='GLB', use_selection=True)
print('STUDY_GLB', folder / 'milo-quad-threeview-projection-study.glb', flush=True)

# Review the exported GLB rather than trusting Blender's source material.
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(folder / 'milo-quad-threeview-projection-study.glb'))
scene.render.engine = 'BLENDER_EEVEE'
for angle, label in ((180, 'front'), (135, 'front-quarter'),
                     (90, 'side'), (45, 'back-quarter'),
                     (0, 'back'), (315, 'back-quarter-left'),
                     (270, 'side-left'), (225, 'front-quarter-left')):
    radians = math.radians(angle)
    direction = Vector((math.sin(radians), -math.cos(radians), 0))
    camera.location = center + direction * max(size) * 3.5
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(folder / f'milo-quad-threeview-study-{label}.png')
    bpy.ops.render.render(write_still=True)
