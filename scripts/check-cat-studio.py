"""Validate the delivered Meshy Milo rig, facial animation and mobile fur asset."""
from pathlib import Path
import json, struct, math, hashlib
root=Path(__file__).resolve().parent.parent
info=json.loads((root/'public/models/cat-master-info.json').read_text(encoding='utf-8'))
asset=root/'public/models'/info['asset'];data=asset.read_bytes()
assert struct.unpack_from('<III',data)==(0x46546C67,2,len(data))
chunk_len,chunk_type=struct.unpack_from('<II',data,12)
assert chunk_type==0x4E4F534A
gltf=json.loads(data[20:20+chunk_len]);binary_start=20+chunk_len+8
assert info['version']==9
assert hashlib.sha256(data).hexdigest()==info['sha256']
assert len(data)==info['bytes'] and len(data)<8_000_000
assert (root/'dist/models'/info['asset']).read_bytes()==data
assert {c['name'] for c in gltf['animations']}=={'idle','happy','wave','jump','run','sleep','roar'}
assert len(gltf['skins'][0]['joints'])==23
primitives=[p for m in gltf['meshes'] for p in m['primitives']]
assert len(primitives)==11
assert all({'JOINTS_0','WEIGHTS_0'}<=p['attributes'].keys() for p in primitives)
triangles=sum(gltf['accessors'][p['indices']]['count']//3 for p in primitives)
# Retain the supplied 118k-triangle surface; both groom LODs are in the file,
# but only one is rendered. Geometry simplification is a separate art step.
assert triangles==info['triangles'] and triangles<130_000
assert {'KHR_draco_mesh_compression','KHR_materials_sheen'}<=set(gltf['extensionsUsed'])
groom=next(m for m in gltf['materials'] if 'matte short fur' in m['name'])
assert groom['alphaMode']=='MASK' and groom['doubleSided']
assert all('COLOR_0' in p['attributes'] for m in gltf['meshes'] if 'Groom' in m['name'] for p in m['primitives'])
assert {'Cast_Groom_HIGH','Cast_Groom_LOW'}<={n.get('name') for n in gltf['nodes']}
nodes={n.get('name'):i for i,n in enumerate(gltf['nodes'])}
def values(i):
    a=gltf['accessors'][i];v=gltf['bufferViews'][a['bufferView']]
    assert a['componentType']==5126
    width={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
    start=binary_start+v.get('byteOffset',0)+a.get('byteOffset',0)
    return [struct.unpack_from('<'+'f'*width,data,start+k*v.get('byteStride',width*4)) for k in range(a['count'])]
def track(name,node,path):
    c=next(c for c in gltf['animations'] if c['name']==name)
    channel=next(ch for ch in c['channels'] if ch['target']['node']==nodes[node] and ch['target']['path']==path)
    return values(c['samplers'][channel['sampler']]['output'])
def angle(a,b):return 2*math.acos(min(1,abs(sum(x*y for x,y in zip(a,b)))))
def swing(name,node):
    v=track(name,node,'rotation');return max(angle(a,b) for a in v[::2] for b in v[::2])
assert swing('wave','upper_arm_R')>.9
assert swing('wave','forearm_R')>.5
assert swing('wave','paw_R')>.25
assert swing('run','thigh_L')>.7 and swing('run','shin_L')>.4
jump=track('jump','root','translation')
assert max(v[1] for v in jump)-min(v[1] for v in jump)>.35
assert swing('sleep','root')>1 and swing('sleep','head')>.1
assert swing('idle','tail_base')>.08
fingerprints=[]
for c in gltf['animations']:
    weights=[values(c['samplers'][ch['sampler']]['output']) for ch in c['channels'] if ch['target']['path']=='weights']
    assert weights and all(math.isfinite(v[0]) for row in weights for v in row)
    fingerprints.append(hashlib.sha256(json.dumps([values(s['output']) for s in c['samplers']]).encode()).hexdigest())
    if c['name'] in ['sleep','roar']:assert max(v[0] for row in weights for v in row)>.95
assert len(set(fingerprints))==7
for image in gltf['images']:
    v=gltf['bufferViews'][image['bufferView']];offset=binary_start+v.get('byteOffset',0)
    if image['mimeType']=='image/png':
        assert data[offset:offset+8]==b'\x89PNG\r\n\x1a\n'
        dimensions=struct.unpack_from('>II',data,offset+16)
    else:
        assert image['mimeType']=='image/jpeg' and data[offset:offset+2]==b'\xff\xd8'
        pos=offset+2
        while True:
            assert data[pos]==255
            marker=data[pos+1];length=struct.unpack_from('>H',data,pos+2)[0]
            if marker in [192,193,194]:
                dimensions=struct.unpack_from('>HH',data,pos+5);break
            pos+=2+length
    assert max(dimensions)<=1024, (image.get('name'),dimensions)
print(f'PASS Milo v9: {len(data):,} bytes, 23 joints, 7 distinct motions, facial tracks, MASK fur with two LODs, {triangles:,} asset triangles')
