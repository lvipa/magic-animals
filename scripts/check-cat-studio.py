"""Validate the authored CAT delivery without needing Blender at runtime."""
from pathlib import Path
import json, struct, math

root = Path(__file__).resolve().parent.parent
asset = root / 'public/models/cat-studio.glb'
data = asset.read_bytes()
magic, version, length = struct.unpack_from('<III', data)
assert (magic, version, length) == (0x46546C67, 2, len(data))
chunk_len, chunk_type = struct.unpack_from('<II', data, 12)
assert chunk_type == 0x4E4F534A
gltf = json.loads(data[20:20 + chunk_len])
expected = {'idle', 'happy', 'wave', 'jump', 'run', 'sleep', 'roar'}
clips = {clip['name'] for clip in gltf['animations']}
assert clips == expected, (clips, expected)
assert gltf.get('skins') and len(gltf['skins'][0]['joints']) >= 22
assert len(gltf.get('images', [])) >= 6
assert len(gltf.get('meshes', [])) >= 35
assert len(gltf.get('materials', [])) >= 9
assert 'KHR_draco_mesh_compression' in gltf['extensionsUsed']
assert 'KHR_materials_sheen' in gltf['extensionsUsed']
assert 'KHR_materials_clearcoat' in gltf['extensionsUsed']
assert (root / 'assets/characters/cat/milo.blend').is_file()
assert len(data) < 8_000_000
assert (root / 'dist/models/cat-studio.glb').read_bytes() == data
assert (root / 'public/draco/draco_decoder.wasm').is_file()

# Check exported motion, not just clip names. This catches a frozen rig or
# seven different buttons accidentally playing the same near-idle animation.
binary_start=20+chunk_len+8
nodes={node['name']:i for i,node in enumerate(gltf['nodes']) if 'name' in node}
def values(accessor_index):
    accessor=gltf['accessors'][accessor_index]
    view=gltf['bufferViews'][accessor['bufferView']]
    assert accessor['componentType']==5126
    width={'SCALAR':1,'VEC3':3,'VEC4':4}[accessor['type']]
    start=binary_start+view.get('byteOffset',0)+accessor.get('byteOffset',0)
    stride=view.get('byteStride',width*4)
    return [struct.unpack_from('<'+'f'*width,data,start+i*stride) for i in range(accessor['count'])]
def track(clip_name,node_name,path):
    clip=next(c for c in gltf['animations'] if c['name']==clip_name)
    channel=next(c for c in clip['channels'] if c['target']['node']==nodes[node_name] and c['target']['path']==path)
    return values(clip['samplers'][channel['sampler']]['output'])
def angle(a,b):
    return 2*math.acos(min(1,abs(sum(x*y for x,y in zip(a,b)))))
wave=track('wave','arm_R','rotation')
idle=track('idle','arm_R','rotation')[0]
assert max(angle(idle,q) for q in wave)>1.7, 'Wave must lift the shoulder visibly'
elbow=track('wave','elbow_R','rotation')
assert max(angle(a,b) for a in elbow for b in elbow)>.65, 'Wave must bend the elbow'
jump=track('jump','root','translation')
assert max(q[1] for q in jump)-min(q[1] for q in jump)>.26, 'Jump needs vertical airtime'
leg=track('run','leg_L','rotation')
assert max(angle(leg[0],q) for q in leg)>.6, 'Run needs a leg stride'
knee=track('run','knee_L','rotation')
assert max(angle(knee[0],q) for q in knee)>.8, 'Run needs a knee bend'
sleep=track('sleep','head','rotation')[0]
assert angle(track('idle','head','rotation')[0],sleep)>.24, 'Sleep needs its own resting pose'
assert angle(track('idle','root','rotation')[0],track('sleep','root','rotation')[0])>1.5, 'Sleep must curl onto the side'
print('PASS motion: lifted shoulder, bending elbow/knee, airborne jump, running stride, resting pose')
print(f'PASS authored CAT: {len(data):,} bytes, {len(clips)} clips, '
      f'{len(gltf["skins"][0]["joints"])} joints, {len(gltf["images"])} maps, '
      f'{len(gltf["meshes"])} meshes')
