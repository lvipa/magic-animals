"""Connected mouth surgery on Milo's supplied surface before shape keys.

The cavity joins the existing face boundary. Original UVs and body weights
survive the edit; inserted interior vertices follow the same head bone.
"""
import math
import bpy
import bmesh
from mathutils import Vector


def mouth_line(x):
    corner = max(0, (abs(x) - .04) / .07)
    return .345 + .025 * corner ** 1.6 + .007 * math.exp(-(x / .018) ** 2)


def material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat


def build_mouth(body, front):
    assert body.data.shape_keys is None, 'Mouth surgery must precede shape keys'
    mesh = body.data
    mesh.materials.append(material('Milo / warm mouth interior', (.008, .0015, .0025), .94))
    cavity_material = len(mesh.materials) - 1
    mesh.materials.append(material('Milo / soft pink tongue', (.46, .10, .13), .62))
    tongue_material = len(mesh.materials) - 1
    bm = bmesh.new(); bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    chosen = {f for f in bm.faces if f.calc_center_median().y < -.38
              and (f.calc_center_median().x / .105) ** 2
              + ((f.calc_center_median().z - mouth_line(f.calc_center_median().x)) / .011) ** 2 < 1}
    assert chosen, 'No mouth surface found'
    # Require a single connected cut; never silently build over a fragmented hole.
    unseen = set(chosen); components = []
    while unseen:
        component = set(); pending = [unseen.pop()]
        while pending:
            face = pending.pop(); component.add(face)
            for edge in face.edges:
                for neighbor in edge.link_faces:
                    if neighbor in unseen:
                        unseen.remove(neighbor); pending.append(neighbor)
        components.append(component)
    chosen = max(components, key=len)
    boundary = {edge for face in chosen for edge in face.edges
                if sum(f in chosen for f in edge.link_faces) == 1}
    graph = {}
    for edge in boundary:
        a, b = edge.verts
        graph.setdefault(a, []).append(b); graph.setdefault(b, []).append(a)
    assert all(len(neighbors) == 2 for neighbors in graph.values()), 'Mouth cut is not a closed loop'
    start = min(graph, key=lambda v: (v.co.x, v.co.z, v.co.y))
    loop = [start]; previous = None; current = start
    while True:
        following = next(v for v in graph[current] if v != previous)
        if following == start:
            break
        assert following not in loop, 'Mouth boundary contains multiple loops'
        loop.append(following); previous, current = current, following
    assert len(loop) == len(graph), 'Mouth cut has separate holes'
    # Positive winding in the X/Z plane points toward the front (-Y).
    area = sum(a.co.x * b.co.z - b.co.x * a.co.z for a, b in zip(loop, loop[1:] + loop[:1]))
    if area < 0:
        loop.reverse()
    # Smooth the actual boundary and close it to a thin continuous smile.
    # Keeping a triangle-selected outline would expose sawtooth edges.
    positions = [v.co.copy() for v in loop]
    for _ in range(8):
        positions = [(positions[(i - 1) % len(loop)] + positions[i] * 2
                      + positions[(i + 1) % len(loop)]) / 4 for i in range(len(loop))]
    rim_sides = {}
    for v, co in zip(loop, positions):
        x = co.x
        upper = co.z >= mouth_line(x)
        arc = math.sqrt(max(0, 1 - (x / .106) ** 2))
        z = mouth_line(x) + (.0012 if upper else -.0012) * arc
        point, _ = front(x, z)
        v.co = point
        rim_sides[v] = upper
    removed = len(chosen)
    bmesh.ops.delete(bm, geom=list(chosen), context='FACES_ONLY')
    weights = bm.verts.layers.deform.verify()
    uv = bm.loops.layers.uv.active
    head_index = body.vertex_groups['head'].index
    inserted = []

    def vertex(co, kind):
        v = bm.verts.new(co); v[weights][head_index] = 1
        inserted.append((v, kind)); return v

    def face(vertices, index):
        f = bm.faces.new(vertices); f.material_index = index; f.smooth = True
        if uv:
            for corner in f.loops:
                corner[uv].uv = (0, 0)
        return f

    outer = loop
    for amount, depth in [(.94, .004), (.75, .040)]:
        inner = []
        for v in loop:
            x = v.co.x * amount
            z = mouth_line(x) + (v.co.z - mouth_line(v.co.x)) * amount
            inner.append(vertex((x, v.co.y + depth, z), 'cavity'))
        for i in range(len(loop)):
            j = (i + 1) % len(loop)
            face([outer[i], outer[j], inner[j], inner[i]], cavity_material)
        outer = inner
    center = vertex((0, -.395, .349), 'back')
    for i in range(len(loop)):
        face([outer[i], outer[(i + 1) % len(loop)], center], cavity_material)

    # A compact rounded tongue stays behind the closed lips and enters the
    # opening when the jaw lowers. It is part of the same skinned body mesh.
    rings = []; segments = 24; latitude_count = 10
    for row in range(1, latitude_count):
        angle = math.pi * row / latitude_count; ring = []
        for col in range(segments):
            azimuth = math.tau * col / segments
            ring.append(vertex((.031 * math.sin(angle) * math.cos(azimuth),
                                -.433 + .010 * math.sin(angle) * math.sin(azimuth),
                                .338 + .010 * math.cos(angle)), 'tongue'))
        rings.append(ring)
    top = vertex((0, -.433, .348), 'tongue'); bottom = vertex((0, -.433, .328), 'tongue')
    for col in range(segments):
        nxt = (col + 1) % segments
        face([top, rings[0][col], rings[0][nxt]], tongue_material)
        face([bottom, rings[-1][nxt], rings[-1][col]], tongue_material)
    for first, second in zip(rings, rings[1:]):
        for col in range(segments):
            nxt = (col + 1) % segments
            face([first[col], second[col], second[nxt], first[nxt]], tongue_material)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.verts.index_update()
    inserted_kinds = {v.index: kind for v, kind in inserted}
    boundary_indices = [v.index for v in loop]
    rim_by_index = {v.index: side for v, side in rim_sides.items()}
    bm.to_mesh(mesh); bm.free(); mesh.update()
    body.shape_key_add(name='Basis')
    opened = body.shape_key_add(name='mouthOpen')
    for original, target in zip(mesh.vertices, opened.data):
        x, y, z = original.co
        kind = inserted_kinds.get(original.index)
        if kind == 'tongue':
            target.co.y -= .010; target.co.z -= .033
            continue
        if kind == 'back':
            target.co.z -= .018
            continue
        if original.index in rim_by_index:
            arc = math.sqrt(max(0, 1 - (x / .106) ** 2))
            target.co.z += (.006 if rim_by_index[original.index] else -.052) * arc
            target.co.y += (0 if rim_by_index[original.index] else .009) * arc
            continue
        # Move the chin and lower lip together, fading toward cheeks and neck.
        if y < -.26 and .22 < z < .398 and abs(x) < .18:
            across = max(0, 1 - (x / .18) ** 2)
            across = across * across
            below = 1 if z < mouth_line(x) else 0
            lower_fade = max(0, min(1, (z - .22) / .055))
            weight = across * lower_fade
            target.co.z -= .052 * weight * below
            target.co.y += .011 * weight * below
            if z >= mouth_line(x):
                upper_fade = max(0, 1 - (z - mouth_line(x)) / .035)
                target.co.z += .009 * weight * upper_fade
    opening = [opened.data[i].co.z for i in boundary_indices]
    assert all(math.isfinite(v) for v in opening)
    body['mouth_status'] = 'Connected mouth cavity and tongue; mouthOpen jaw/chin morph'
    return {'cut_faces': removed, 'boundary_vertices': len(loop),
            'inserted_vertices': len(inserted_kinds), 'mouth_morph': 'mouthOpen'}
