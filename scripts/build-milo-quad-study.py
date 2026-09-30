"""Build an editable, unapproved quad-topology study from Milo Grid128.

Run with Blender 5.1.2 from the repository root. This is a sculpt base, not a
finished character or a replacement for the currently deployed CAT.
"""
from pathlib import Path
import bmesh
import bpy
from mathutils.kdtree import KDTree

root = Path(__file__).resolve().parent.parent
folder = root / 'assets/characters/cat/studies'
input_glb = folder / 'milo-instantmesh-grid128.glb'
output_glb = folder / 'milo-grid128-quad-study.glb'
output_blend = folder / 'milo-grid128-quad-study.blend'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.import_scene.gltf(filepath=str(input_glb))
source = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
source.name = 'RECONSTRUCTION_REFERENCE_DO_NOT_EXPORT'
source.hide_render = True
source.hide_set(True)
working = source.copy()
working.data = source.data.copy()
bpy.context.collection.objects.link(working)
working.name = 'TEMP_VOXEL_SHELL'
working.hide_set(False)
working.hide_render = False
bpy.ops.object.select_all(action='DESELECT')
working.select_set(True)
bpy.context.view_layer.objects.active = working
working.data.remesh_voxel_size = 0.03
bpy.ops.object.voxel_remesh()

bm = bmesh.new()
bm.from_mesh(working.data)
seen = set()
remove = []
components = []
for seed in bm.verts:
    if seed in seen:
        continue
    stack = [seed]
    seen.add(seed)
    members = []
    while stack:
        vertex = stack.pop()
        members.append(vertex)
        for edge in vertex.link_edges:
            other = edge.other_vert(vertex)
            if other not in seen:
                seen.add(other)
                stack.append(other)
    components.append(len(members))
    if len(members) < 100:
        remove.extend(members)
bmesh.ops.delete(bm, geom=remove, context='VERTS')
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.verts.index_update()
print('VOXEL_COMPONENTS', sorted(components, reverse=True), flush=True)
print('VOXEL_TOPOLOGY', len(bm.verts), len(bm.faces),
      'nonmanifold', sum(not e.is_manifold for e in bm.edges), flush=True)
quad_mesh = bpy.data.meshes.new('Milo_AutoQuad_SculptBase')
quad_mesh.from_pydata([tuple(v.co) for v in bm.verts], [],
                      [[v.index for v in face.verts] for face in bm.faces])
quad_mesh.update()
bm.free()
quad = bpy.data.objects.new('MILO_AUTOQUAD_UNAPPROVED', quad_mesh)
bpy.context.scene.collection.objects.link(quad)
bpy.ops.object.select_all(action='DESELECT')
quad.select_set(True)
bpy.context.view_layer.objects.active = quad
result = bpy.ops.object.quadriflow_remesh(target_faces=8000,
                                         use_mesh_symmetry=False)
if result != {'FINISHED'}:
    raise RuntimeError(f'QuadriFlow failed: {result}')
print('QUAD_OUTPUT', len(quad.data.vertices), len(quad.data.polygons), flush=True)

wrap = quad.modifiers.new('Restore source silhouette', 'SHRINKWRAP')
wrap.target = source
wrap.wrap_method = 'NEAREST_SURFACEPOINT'
wrap.offset = 0
bpy.ops.object.modifier_apply(modifier=wrap.name)
for face in quad.data.polygons:
    face.use_smooth = True

# Copy predicted colours only as a diagnostic fallback; the approved concept
# projection will later supply Milo's eye, fur, and fabric details.
colors = source.data.color_attributes['Color']
totals = [[0.0, 0.0, 0.0, 0.0] for _ in source.data.vertices]
counts = [0 for _ in source.data.vertices]
for loop in source.data.loops:
    index = loop.vertex_index
    rgba = colors.data[loop.index].color
    for channel in range(4):
        totals[index][channel] += rgba[channel]
    counts[index] += 1
tree = KDTree(len(source.data.vertices))
for vertex in source.data.vertices:
    tree.insert(vertex.co, vertex.index)
tree.balance()
dest = quad.data.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
for loop in quad.data.loops:
    co = quad.data.vertices[loop.vertex_index].co
    _, nearest, _ = tree.find(co)
    dest.data[loop.index].color = [total / max(1, counts[nearest])
                                   for total in totals[nearest]]
material = bpy.data.materials.new('ReconstructionColour_UNAPPROVED')
material.use_nodes = True
nodes = material.node_tree.nodes
links = material.node_tree.links
attribute = nodes.new('ShaderNodeVertexColor')
attribute.layer_name = 'Color'
links.new(attribute.outputs['Color'], nodes['Principled BSDF'].inputs['Base Color'])
nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
quad.data.materials.append(material)
quad['status'] = 'retopology experiment; unrigged and unapproved'
quad['source_sha256'] = '6f9f3b179850efaeb3eee248aa9e40740fd421a4218e941505cc4ead3e134297'

bpy.ops.object.select_all(action='DESELECT')
working.select_set(True)
bpy.ops.object.delete(use_global=False)
quad.select_set(True)
bpy.context.view_layer.objects.active = quad
notes = bpy.data.texts.new('READ_ME_FIRST')
notes.write('MILO AUTOQUAD STUDY — NOT AN APPROVED CHARACTER\n')
notes.write('Grid128 InstantMesh output -> 0.03 voxel -> QuadriFlow 8000 faces '
            '-> shrinkwrap back to source -> nearest predicted vertex color.\n')
notes.write('This is a sculpt/skin topology experiment only. Face, fur, clothing, '
            'eyes, tail and pose need manual art work. No rig or clips.\n')
bpy.context.scene['status'] = 'DO NOT DEPLOY'
bpy.ops.wm.save_as_mainfile(filepath=str(output_blend), check_existing=False)
bpy.ops.export_scene.gltf(filepath=str(output_glb), export_format='GLB',
                          use_selection=True)
print('QUAD_STUDY_SAVED', output_blend, output_glb, flush=True)
