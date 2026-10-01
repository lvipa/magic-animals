"""Check actual exported skin and motion channels for the complete cast."""
from pathlib import Path
import json,struct,hashlib,math
ROOT=Path(__file__).resolve().parent.parent
expected={'idle','happy','wave','jump','run','sleep','roar'}
for id in ['cat','foxy','dog','lion','bunny','bear','panda','elephant']:
 info=json.loads((ROOT/'public/models'/(id+'-master-info.json')).read_text(encoding='utf-8'))
 data=(ROOT/'public/models'/info['asset']).read_bytes()
 assert hashlib.sha256(data).hexdigest()==info['sha256']
 assert len(data)==info['bytes'] and len(data)<8_000_000
 n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);binary=20+n+8
 assert {c['name'] for c in doc['animations']}==expected
 assert len(doc['skins'][0]['joints'])==21
 assert all({'JOINTS_0','WEIGHTS_0'}<=p['attributes'].keys() for m in doc['meshes'] for p in m['primitives'])
 assert any('Groom_HIGH' in node.get('name','') for node in doc['nodes'])
 assert any('Groom_LOW' in node.get('name','') for node in doc['nodes'])
 groom=next(m for m in doc['materials'] if 'matte short fur' in m.get('name',''))
 assert groom['alphaMode']=='MASK' and groom['doubleSided']
 nodes={node.get('name'):i for i,node in enumerate(doc['nodes'])}
 def values(index):
  a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
  width={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];assert a['componentType']==5126
  start=binary+v.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from('<'+'f'*width,data,start+k*v.get('byteStride',width*4)) for k in range(a['count'])]
 def track(clip,node,path):
  c=next(c for c in doc['animations'] if c['name']==clip)
  channel=next(ch for ch in c['channels'] if ch['target']['node']==nodes[node] and ch['target']['path']==path)
  return values(c['samplers'][channel['sampler']]['output'])
 def swing(clip,node):
  quats=track(clip,node,'rotation')[::2]
  return max(2*math.acos(min(1,abs(sum(x*y for x,y in zip(a,b))))) for a in quats for b in quats)
 assert swing('wave','upper_arm_R')>.9 and swing('wave','forearm_R')>.5
 assert swing('run','thigh_L')>.7 and swing('run','shin_L')>.4
 assert swing('sleep','root')>1
 jump=track('jump','root','translation');assert max(v[1] for v in jump)-min(v[1] for v in jump)>.35
 fingerprints=[]
 for c in doc['animations']:
  fingerprints.append(hashlib.sha256(json.dumps([values(s['output']) for s in c['samplers']]).encode()).hexdigest())
  weights=[values(c['samplers'][ch['sampler']]['output']) for ch in c['channels'] if ch['target']['path']=='weights']
  assert weights and all(math.isfinite(v[0]) for row in weights for v in row)
  if c['name']=='sleep':assert max(v[0] for row in weights for v in row)>.95
 assert len(set(fingerprints))==7
 print(f'PASS {id}: 21 bones, 7 distinct body/facial motions, skinned MASK fur, {len(data):,} bytes')
assert hashlib.sha256((ROOT/'public/models/cat-milo-56d1f528f55c.glb').read_bytes()).hexdigest()=='56d1f528f55cdf5693a39063cb68e0072fd9aa466168d396c6c85cb30d92a58e'
print('PASS approved CAT binary preserved')
