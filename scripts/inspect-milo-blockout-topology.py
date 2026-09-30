"""Report whether the unapproved Milo blockout can support retopology."""

from pathlib import Path
import bmesh
import bpy

root = Path(__file__).resolve().parent.parent
path = root / 'assets/characters/cat/studies/milo-instantmesh-blockout.glb'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(path))
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert len(objects) == 1, len(objects)
obj = objects[0]
mesh = obj.data
bm = bmesh.new()
bm.from_mesh(mesh)
bm.verts.ensure_lookup_table()
boundary = sum(e.is_boundary for e in bm.edges)
nonmanifold = sum(not e.is_manifold for e in bm.edges)
loose = sum(not v.link_edges for v in bm.verts)
seen = set()
components = []
for vert in bm.verts:
    if vert in seen:
        continue
    todo = [vert]
    seen.add(vert)
    count = 0
    while todo:
        current = todo.pop()
        count += 1
        for edge in current.link_edges:
            other = edge.other_vert(current)
            if other not in seen:
                seen.add(other)
                todo.append(other)
    components.append(count)
print('MILO_TOPOLOGY', {
    'vertices': len(mesh.vertices),
    'faces': len(mesh.polygons),
    'boundary_edges': boundary,
    'nonmanifold_edges': nonmanifold,
    'loose_vertices': loose,
    'components': sorted(components, reverse=True)[:20],
    'uv_layers': len(mesh.uv_layers),
    'color_attributes': [(a.name, a.domain, a.data_type) for a in mesh.color_attributes],
    'material_count': len(mesh.materials),
    'bounds': [(min(v.co[i] for v in bm.verts), max(v.co[i] for v in bm.verts)) for i in range(3)],
}, flush=True)
bm.free()
