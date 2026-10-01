"""Local CAT surface cleanup before the facial mesh is split or morphed."""
import bpy
import numpy as np


def ramp(value, start, end):
    t = max(0, min(1, (value-start)/(end-start)))
    return t*t*(3-2*t)


def refine_neck(body):
    """Keep fur on the skull/neck and fabric on its existing body rig.

    The supplied atlas distinguishes warm fur from lavender cloth. Combine
    that distinction with a narrow geometric mask; never smooth the lips,
    nose, eyes or hoodie. Vertex/loop indices and all UVs remain unchanged.
    """
    shader = next(n for n in body.data.materials[0].node_tree.nodes
                  if n.type == 'BSDF_PRINCIPLED')
    image = shader.inputs['Base Color'].links[0].from_node.image
    w, h = image.size
    pixels = np.empty(w*h*4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(h, w, 4)
    colors = np.zeros((len(body.data.vertices), 3)); counts = np.zeros(len(colors))
    uv = body.data.uv_layers.active.data
    for loop in body.data.loops:
        u, v = uv[loop.index].uv
        colors[loop.vertex_index] += pixels[min(h-1, max(0, int(v*h))),
                                            min(w-1, max(0, int(u*w))), :3]
        counts[loop.vertex_index] += 1
    colors /= np.maximum(counts[:, None], 1)
    originals = [v.co.copy() for v in body.data.vertices]
    group = body.vertex_groups.new(name='sculpt / chin and neck fur')
    masks = {}; weight_changes = 0
    for vertex, color in zip(body.data.vertices, colors):
        x, y, z = vertex.co
        fur = ramp(float(color[0]-color[2]), .012, .06)
        region = fur*ramp(z, .17, .23)*(1-ramp(z, .305, .335))
        region *= (1-ramp(abs(x), .24, .31))*(1-ramp(y, .015, .10))
        if region > .0001:
            masks[vertex.index] = region
        # The lower jaw must follow the head rather than either raised arm.
        region = fur*ramp(z, .17, .24)*(1-ramp(z, .335, .36))
        region *= (1-ramp(abs(x), .24, .31))*(1-ramp(y, .015, .10))
        if region < .0001:
            continue
        head = max(ramp(z, .225, .295), ramp(-y, .24, .32))
        neck = ramp(z, .17, .245)*(1-head)
        target = {'head': head, 'neck': neck, 'chest': 1-head-neck}
        weights = {g.group: g.weight*(1-region) for g in vertex.groups}
        for name, value in target.items():
            index = body.vertex_groups[name].index
            weights[index] = weights.get(index, 0)+region*value
        strongest = sorted(weights.items(), key=lambda item: item[1], reverse=True)[:4]
        total = sum(value for _, value in strongest)
        for g in list(vertex.groups):
            body.vertex_groups[g.group].remove([vertex.index])
        for index, value in strongest:
            if value > .000001:
                body.vertex_groups[index].add([vertex.index], value/total, 'REPLACE')
        weight_changes += 1
    for index, weight in masks.items():
        group.add([index], weight, 'REPLACE')
    bpy.context.view_layer.objects.active = body
    modifier = body.modifiers.new('Rounded chin / neck transition', 'SMOOTH')
    group_name = group.name
    modifier.factor = .65; modifier.iterations = 65; modifier.vertex_group = group_name
    while list(body.modifiers).index(modifier) > 0:
        bpy.ops.object.modifier_move_up(modifier=modifier.name)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    body.vertex_groups.remove(body.vertex_groups[group_name])
    # Limit smoothing on this already approved face silhouette.
    maximum = 0
    for vertex, original in zip(body.data.vertices, originals):
        delta = vertex.co-original
        if delta.length > .025:
            vertex.co = original+delta.normalized()*.025
        maximum = max(maximum, (vertex.co-original).length)
    body.data.update()
    assert len(originals) == len(body.data.vertices)
    assert all(abs(sum(g.weight for g in v.groups)-1) < .00001
               and len(v.groups) <= 4 for v in body.data.vertices)
    return {'smoothed_vertices': len(masks), 'reweighted_vertices': weight_changes,
            'maximum_displacement': round(maximum, 6), 'uv_topology_preserved': True}
