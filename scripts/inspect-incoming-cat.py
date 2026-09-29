"""Preflight an artist-supplied CAT GLB before replacing the live model.

Checks format and app-facing contract. Visual quality still requires the
eight-angle WebGL review described in CAT_ART_HANDOFF.md.
"""

import argparse
import json
from pathlib import Path
import struct
import sys

REQUIRED_CLIPS = {'idle', 'happy', 'wave', 'jump', 'run', 'sleep', 'roar'}


def inspect(path: Path) -> tuple[dict, list[str], list[str]]:
    problems: list[str] = []
    warnings: list[str] = []
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError('file is too short to be GLB')
    magic, version, length = struct.unpack_from('<III', data)
    if magic != 0x46546C67 or version != 2 or length != len(data):
        raise ValueError('invalid GLB v2 header or length')
    chunk_length, chunk_type = struct.unpack_from('<II', data, 12)
    if chunk_type != 0x4E4F534A or 20 + chunk_length > len(data):
        raise ValueError('missing or truncated GLB JSON chunk')
    gltf = json.loads(data[20:20 + chunk_length])
    accessors = gltf.get('accessors', [])
    primitives = [p for m in gltf.get('meshes', []) for p in m.get('primitives', [])]
    triangles = 0
    skinned = 0
    for primitive in primitives:
        mode = primitive.get('mode', 4)
        if mode != 4:
            warnings.append(f'mesh primitive uses mode {mode}; triangle count excludes it')
            continue
        if 'indices' in primitive:
            triangles += accessors[primitive['indices']]['count'] // 3
        elif 'POSITION' in primitive.get('attributes', {}):
            triangles += accessors[primitive['attributes']['POSITION']]['count'] // 3
        attributes = primitive.get('attributes', {})
        if 'JOINTS_0' in attributes and 'WEIGHTS_0' in attributes:
            skinned += 1
    clips = {a.get('name', '') for a in gltf.get('animations', [])}
    missing = REQUIRED_CLIPS - clips
    if missing:
        problems.append('missing app clips: ' + ', '.join(sorted(missing)))
    if not gltf.get('skins') or skinned == 0:
        problems.append('no skinned character mesh/rig')
    if not primitives:
        problems.append('no renderable mesh primitives')
    if triangles > 80_000:
        warnings.append('triangle count exceeds the 80k mobile target')
    if len(primitives) > 24:
        warnings.append('material primitive count exceeds the 24 draw-call target')
    if len(data) > 8_000_000:
        warnings.append('GLB exceeds the 8 MB mobile target')
    if not gltf.get('images'):
        warnings.append('no embedded images; check whether textures ship separately')
    if not gltf.get('materials'):
        warnings.append('no PBR materials')
    report = {
        'file': str(path.resolve()),
        'bytes': len(data),
        'triangles': triangles,
        'meshPrimitives': len(primitives),
        'skinnedPrimitives': skinned,
        'skins': len(gltf.get('skins', [])),
        'joints': [len(s.get('joints', [])) for s in gltf.get('skins', [])],
        'clips': sorted(clips),
        'materials': len(gltf.get('materials', [])),
        'images': len(gltf.get('images', [])),
        'extensions': sorted(gltf.get('extensionsUsed', [])),
    }
    return report, problems, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('glb', type=Path, help='artist-supplied GLB to inspect')
    args = parser.parse_args()
    try:
        report, problems, warnings = inspect(args.glb)
    except (OSError, ValueError, KeyError, IndexError, struct.error) as exc:
        print(f'Invalid GLB: {exc}', file=sys.stderr)
        return 2
    print(json.dumps({'report': report, 'problems': problems, 'warnings': warnings},
                     ensure_ascii=False, indent=2))
    return 1 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main())
