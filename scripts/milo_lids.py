"""Bake the supplied CAT's own fur detail into continuous eyelid UVs."""
import bpy
import math
import numpy as np


def blur(values, radius=5):
    result = values
    for axis in (0, 1):
        pad = [(0, 0)]*3; pad[axis] = (radius, radius)
        padded = np.pad(result, pad, mode='edge')
        result = sum(np.take(padded, range(offset, offset+values.shape[axis]), axis=axis)
                     for offset in range(2*radius+1))/(2*radius+1)
    return result


def fur_material(template, side, cx, cz, coefficients, front, pixels):
    """No new art source: preserve small hair strokes from forehead texels.

    Sampling through the original BVH resolves source UV seams before baking.
    Only the high-frequency fur detail is transferred; the broad color field
    comes from the orbital surroundings, avoiding a stamped forehead stripe.
    """
    width, height = 256, 128
    detail = np.zeros((height, width, 3), dtype=np.float32)
    field = np.zeros_like(detail)
    source_h, source_w = pixels.shape[:2]
    for row in range(height):
        t = row/(height-1)
        for col in range(width):
            u = -1+2*col/(width-1); arc = math.sqrt(max(0, 1-u*u))
            a = .125*u/.132; b = .120*arc*(1-2*t)/.128
            field[row, col] = np.array([1, a, b, a*b, a*a-b*b])@coefficients[:, :3]
            _, uv = front(cx+.047*u, cz+.143+.045*(1-2*t))
            ix = min(source_w-1, max(0, int(uv[0]*source_w)))
            iy = min(source_h-1, max(0, int(uv[1]*source_h)))
            detail[row, col] = pixels[iy, ix, :3]
    rgba = np.ones((height, width, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(field+.75*(detail-blur(detail)), 0, 1)
    # The lid extends past the cut orbital patch onto intact face geometry.
    # Fade only this overlap, so the lid has no hard circular sticker edge.
    for row in range(height):
        t = row/(height-1)
        for col in range(width):
            u = -1+2*col/(width-1)
            radius = math.sqrt(u*u+(1-u*u)*(1-2*t)**2)
            amount = max(0, min(1, (radius-.91)/.09))
            rgba[row, col, 3] = 1-amount*amount*(3-2*amount)
    image = bpy.data.images.new('Milo / continuous eyelid fur '+side,
                                width=width, height=height, alpha=True)
    image.colorspace_settings.name = 'sRGB'
    image.pixels.foreach_set(rgba.ravel()); image.pack()
    material = template.copy(); material.name = 'Milo / eyelid fur '+side
    shader = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for link in list(shader.inputs['Base Color'].links):
        material.node_tree.links.remove(link)
    texture = material.node_tree.nodes.new('ShaderNodeTexImage'); texture.image = image
    material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    material.node_tree.links.new(texture.outputs['Alpha'], shader.inputs['Alpha'])
    material.surface_render_method = 'BLENDED'
    return material
